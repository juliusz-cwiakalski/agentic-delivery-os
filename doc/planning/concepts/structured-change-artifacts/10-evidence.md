---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/10-evidence.md
---
# 10. Evidence and caveats

The claims in this pack rest on measurements from real changes in this repository. This file
states the method, the numbers, and what they do and do not prove.

## Method

- **Session store.** The harness's local session store, opened read-only. Sessions were grouped
  by the change's worktree directory and title; tokens were summed by kind (input, output,
  cache read).
- **Read amplification.** Tool calls of type `read` whose path ended in one of the four
  artifacts, counted per agent role. Shell `cat`, `grep`, and `sed` reads are not counted, so
  the true amplification is higher.
- **Artifact sizes.** Bytes, lines, words, headings, table rows, code fences, and duplicate
  lines, measured on the files in the change folder. For the plan, the comment share was
  measured as the bytes of lines beginning with `#`.
- **Diff size.** `git show --shortstat` for merged changes; `git diff --shortstat` against the
  base for the in-flight change. GH-416 was in flight when it was measured, before its final
  commit: 108 files and 9.3k changed lines. Its merged diff is 129 files, about 12.6k inserted
  lines and 383 deleted. Every ratio in this file that rests on the 9.3k figure is kept as it
  was measured.
- **Phase intervals.** The phase ledger, read with Jaiship's parser. On GH-416 the ledger
  was malformed (see below), so a repaired copy was used for the phase split; the totals come
  from the session store and do not depend on the repair.
- **Comparison.** The last pre-native changes (delivered with the earlier wrapper) and the
  native changes (delivered with the CLI), normalized per 1,000 changed lines. The comparison is
  descriptive, not a controlled experiment.

## The artifacts on GH-416

| Artifact | Size | Content |
|---|---|---|
| specification | 101KB, 16.3k words | 25 sections, 46 headings, 131 table rows, 7 local decisions |
| test plan | 156KB, 24.8k words | 31 cases, about 800 words per case, 10 metadata fields per case, 26 percent duplicate lines |
| delivery plan | 135KB | 86 percent comments; 19.5KB of data; 1,666 comment lines |
| PM context | 37KB, 5.7k words | hand-written prose notes |
| total | 435KB, about 67k words | for 9.3k changed lines measured before the final commit, about 7 words of planning per line |

The specification's 25 sections include rollout, data migration, privacy, security,
maintenance, glossary, appendices, document history, authoring guidelines, and a validation
checklist. Most of them are boilerplate for a mid-size change. The test plan's ten fields per
case (`Scenario Type`, `Impact Level`, `Priority`, `Related IDs`, `Preconditions`, `Steps`,
`Expected Outcome`, `Automation Level`, `Tags`, `Target Layer`) are the main source of its
size. The plan's data is 19.5KB; the rest is commentary that the coder reads but the tool
cannot use.

## Read amplification on GH-416

| Role | Specification reads | Test plan reads | Plan reads | PM context reads | About MB read |
|---|---|---|---|---|---|
| readiness-reviewer | 9 | 15 | 21 | 3 | 6.2 |
| spec-writer | 23 | 2 | 0 | 1 | 2.7 |
| plan-writer | 2 | 3 | 13 | 1 | 2.5 |
| coder | 2 | 4 | 3 | 2 | 1.3 |
| PM | 6 | 0 | 1 | 8 | 1.0 |
| test-plan-writer | 2 | 2 | 0 | 1 | 0.6 |
| decision-advisor | 2 | 0 | 2 | 1 | 0.5 |
| toolsmith | 2 | 0 | 1 | 0 | 0.3 |
| total | 48 | 26 | 41 | 17 | 15.1 |

The 435KB set was read about 15.1MB through the `read` tool alone, about 35 times its size.
The readiness-reviewer, a gate that should read the contract and the coverage table, read the
most. Every fresh subagent starts with zero context and reads the whole set.

## The corruption on GH-416

The PM wrote the PM context by hand five times in the lane: a `write` at 05:45:10, then `edit`
at 05:45:42, 05:46:00, 05:54:33, and 10:43:03. One note contained a backslash before a
backtick, an invalid escape in a YAML double-quoted scalar. Jaiship's strict parser
rejected the document at line 434. `verify change` failed with `lint.notes.malformed`; the
watcher read zero phases; the landing chain would have refused. Jaiship had typed commands
for phase state and blockers but no typed command for notes or decisions, and lint was not a
gate on the write. The design gap is the evidence for T1 (`17-roadmap.md`).

## The reopen loop on GH-416

The specification was completed at 05:54, reopened at 11:48 and 12:26 after test-planning
findings, and re-completed at 13:30. The test plan completed at 14:16, the delivery plan at
14:02, and DoR at 14:17. The loop cost about 2.5 hours and added sections to the artifacts.
It is structural: the test plan is authored after the specification is declared complete, so a
gap can only be found after a "complete" state. A gap bundle and a cheap completeness check
before test planning are the design response.

## Review churn

- GH-413: 1,274 edits after a review.
- GH-416: 347 edits after a review, at the time of measurement, with the review still open.

The churn is not necessarily waste; a review that finds real issues produces edits. But the
volume is a signal that the review and the fix loop are expensive, and that a pre-review
self-check against the acceptance criteria could reduce it.

## The comparison with the earlier wrapper

| Change | Era | Files / lines | Wall | Input | Output | Input per 1k lines |
|---|---|---|---|---|---|---|
| GH-386 | earlier wrapper | 55 / 5.8k | 7.2h | 1.87M | 257k | 322k |
| GH-388 | earlier wrapper | 24 / 5.0k | 3.5h | 2.20M | 228k | 441k |
| GH-350 | earlier wrapper | 185 / 28.3k | 29.1h | 6.06M | 2.03M | 214k |
| GH-404 | native | 98 / 12.4k | 17.3h | 19.45M | 632k | 1,572k |
| GH-413 | native | 137 / 15.6k | 12.9h | 12.82M | 1.79M | 822k |
| GH-416 | native, in flight when measured | 108 / 9.3k | 9.7h with a 4.8h park | 3.69M | 736k | 397k |

The two foundation tickets (GH-404, GH-413) are the outliers, not the pipeline. GH-416 is
leaner per line than both native predecessors and inside the earlier-wrapper band. The
comparison is confounded by ticket scope, model and seat changes, and the park; it is
descriptive, not causal. The per-line figures of the GH-416 row use the diff measured before
its final commit (Method); the merged diff is 129 files, about 12.6k inserted lines and 383
deleted.

## What the evidence proves

- The artifacts are large, template-heavy, and read far more than they are written.
- Fresh-context subagents are the amplifier.
- Hand-editing a machine-read ledger caused a real failure.
- The reopen loop is structural, not a one-off.
- The native pipeline is not inherently more token-heavy; the foundation tickets are the
  outliers.

## What the evidence does not prove

- That a bundle will reduce tokens by a specific amount. The mechanism is sound; the number is
  a hypothesis until the pilot.
- That the miss rate will be low. That is the main risk, and it is measured in the pilot.
- That the plan's affected paths will be accurate. The audit and the retro measure it.
- That the harness can deny path reads. That is an implementation question (open point 15).
- That the lifecycle change will not increase authoring cost. The pilot measures both sides.

## How the concept's success is measured

| Metric | Baseline | Target | Source |
|---|---|---|---|
| Input tokens per 1k changed lines | about 397k | 250k or less | session store |
| Read amplification | about 35x | 5x or less | read tool counts |
| Artifact bytes per 1k changed lines | about 47KB | 25KB or less | change folder |
| Bundle miss rate | not measured | 10 percent or less | context fetch events |
| Reopens per ticket | 2 in this lane | 1 or less | phase registry |
| Edits after review per 10k lines | about 373 | 150 or less | session store |
| Hand-edit incidents | 1 in this lane | 0 after the pilot | lint and CI |
| Artifact-caused verify failures | 1 in this lane | 0 | verify and lint |

The baseline is one lane, not a benchmark. The pilot establishes the comparison. Its per-line
figures use the diff of GH-416 as measured before the final commit.
