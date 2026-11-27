---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/01-analysis.md
---
# 01. The vision, and where it is over-optimistic

## The vision, restated

1. The PM context, the delivery plan, the test plan, and possibly the change specification
   become structured data with a schema.
2. A tool (Jaiship) becomes the only writer: typed commands validate, serialize, and commit.
3. An agent reads through the tool: it asks for the part it needs in its current context and
   receives a bounded bundle, not a whole file.
4. Every artifact change carries git proof that the tool made it; a hand edit is visible.
5. A phase handover lets a fresh coder continue without rereading the change.
6. Affected paths in the plan let the scheduler decide parallel versus serial before code
   exists.

## Verdict

**The direction is right, and the biggest win is not the schema. It is changing the read
path.** The measurements show that artifacts are read about 35 times their size by
fresh-context agents. Structure is what makes a filtered read possible, but structure alone
changes nothing if agents keep calling `read` on whole files. The second biggest win is the
single writer, because it removes a real corruption class and makes the queue's state
trustworthy.

The vision is over-optimistic in five places: it assumes the specification can be fully
structured, that structure automatically reduces tokens, that a filtered bundle can be
complete on the first try, that signing can enforce tool-only writes, and that the plan's
structured fields will be accurate enough to schedule against. Each has a mitigation; none
is fatal.

## Where the vision is right

- **The read amplification is real and large.** On GH-416 the four artifacts total about
  435KB. Via the `read` tool alone they were read about 15.1MB, roughly 35 times their size:
  readiness-reviewer 6.2MB, spec-writer 2.7MB, plan-writer 2.5MB, coder 1.3MB, PM 1.0MB.
  Every fresh subagent starts with zero context and reads the whole set. A role/phase bundle
  attacks this directly.
- **The artifacts are larger than the change needs.** The test plan is 24.8k words for 31
  cases, about 800 words per case, with ten metadata fields per case and 26 percent duplicate
  lines. The plan is 135KB, of which 86 percent is comments; the data is 19.5KB. The
  specification has 25 sections, many of them boilerplate for a mid-size change.
- **Hand editing is a real failure mode.** On GH-416 the PM wrote the PM context by hand five
  times with `write` and `edit`. One note contained a backslash before a backtick, which is
  an invalid escape in a YAML double-quoted scalar. The product's strict parser rejected the
  document at line 434; `verify` failed; the watcher read zero phases; the landing chain
  would have refused. The product had typed commands for phase state and blockers, but no
  typed command for notes or decisions, and lint was not a gate on the write. The design gap
  is real, not a one-off mistake.
- **The plan already carries the seed of affected paths.** The current plan phase has
  `scope.files` and `interactions` with producer and consumer roles. That is enough to
  evolve into a machine-computable conflict check; it is not a new invention.
- **The PM context is the right place to split working memory from history.** The PM needs
  open loops, next actions, and blocking decisions, not 37KB of prose. The retrospective
  agent needs the history, not the PM.

## Ten challenges

### 1. "Fully structured" is not fully achievable, and trying too hard makes it worse

A specification carries rationale, trade-offs, rejected alternatives, and the "why" behind a
contract. Those resist a schema. If you force them into fields, you get `description: |-`
blobs, which is the current problem wearing a YAML hat. The machine-readable part of a
specification is its **contract**: acceptance criteria, decisions, interfaces, affected
paths, risks, open questions, non-goals. The rest is bounded prose.

**Mitigation:** a hybrid specification. The contract is typed and validated; the prose is
word-budgeted and never used for control flow. For S and M changes the prose shrinks to a
short context and rationale; for L changes it can keep a longer rationale, still budgeted.

### 2. Structure does not reduce tokens by itself

If the tool serves a 16KB bundle but the agent still calls `read` on the 135KB plan, the
token bill does not change. The read path is a behavior, not a file format. Three things must
change together: the tool serves bundles, the agent definitions instruct bundle-first, and
the harness makes whole-file reads of artifacts inconvenient or impossible.

**Mitigation:** a path-scoped permission that denies `edit`, `write`, and `read` on
`doc/changes/**` for agents, with the CLI as the only door. If the harness cannot scope reads,
deny writes and rely on instructions plus measurement for reads. Add a lint that flags a
`read` of an artifact in a session trace (telemetry), and report it per role.

### 3. A filtered bundle can be incomplete, and a missing fact costs more than a whole read

This is the central risk. If the coder's bundle omits a decision that constrains its phase,
it will build the wrong thing, the reviewer will catch it, and the rework will cost more than
reading the whole plan. The tool can only serve what the plan and specification declare; if
the links are wrong, the bundle is wrong. "Just in time" can become "just too late".

**Mitigation:** a context contract per role and phase, written down and tested; a `missing`
list in every bundle; an on-demand `context get --section` escape hatch; a measured miss rate
(the share of bundles after which the agent fetches more). Start with generous bundles and
tighten from evidence. Keep a small global invariants section in every bundle so JIT does not
become local optimization.

### 4. Tool-only editing cannot be enforced by signing alone

A signature proves who wrote a file; it does not stop an agent with an `edit` tool, and it
adds key management, rotation, and a verification path. The real controls are a path-scoped
permission, a CI lint that rejects an artifact commit without the tool trailer, and agent
instructions that make the CLI the only door. Also, "hand edit means an agent is cheating" is
too strong: it can be a legitimate repair, an older session, or a human fixing a typo. Treat
it as an **untyped edit**, detect it, and correct it; do not build an accusation system.

**Mitigation:** commit trailer `Jaiship-Tool: <command>@<version>` on every artifact commit;
a generated-by header in the file; a CI check that any commit touching an artifact carries
the trailer; a path-scoped deny for agent writes where the harness supports it. Signing is
optional and not a substitute.

### 5. Auto-commit on every write changes the history and can fight the commit discipline

The repository's rule is one conventional commit per change, through the commit primitive.
If every note writes a commit, the branch becomes noisy, a rebase can conflict, and a
half-written artifact can be committed before its author intended. On the other hand, a
commit per write is the provenance the owner wants.

**Mitigation:** tool commits are atomic, pathspec-only, and typed (`chore(change): ...`),
never mix code and artifacts, and are squashed at merge. A write either validates and commits
or changes nothing. The agent never runs `git commit` for an artifact. Code commits keep the
commit primitive and the one-commit-per-change rule. If a write must span several fields, the
command accepts a file or a batch and commits once.

### 6. The plan's structured fields are only as good as the plan-writer's declarations

The parallelism promise depends on affected paths being right. A plan that omits one file
overlaps silently; a plan that over-declares serializes everything. The same applies to
acceptance links and verify commands. The tool cannot invent the plan's intent; it can only
check consistency and derive suggestions.

**Mitigation:** a `plan audit` at the pull request that compares the declared paths with the
actual diff and fails or records the drift; tool-assisted path suggestions from imports, grep,
and test coverage at plan time; a lint that every phase has at least one path, one acceptance
criterion, and one verify command; retro evidence on misprediction rates. Conservative
default: undeclared scope serializes.

### 7. Phase handovers can become the new 500KB artifact

A handover is valuable only if it is short, typed, and stable. Free-form "notes for the next
coder" will grow into another prose dump, and the next coder will read it whole.

**Mitigation:** a handover schema with fixed fields (done, deviations, open risks, next
inputs, evidence), a hard budget of about 1KB, tool validation, and a tool-generated summary
from the phase's evidence rather than a free-written essay. The next phase's bundle includes
the handover plus the plan's `nextInputs`, not the whole history.

### 8. A milestone contract is a new artifact and a new cost

For dozens of tickets, a milestone contract that holds shared context once is a large win.
For one or two tickets, it is ceremony. The owner's plan is multi-milestone, so the contract
is justified, but it should be introduced after the per-ticket slices prove themselves.

**Mitigation:** introduce the milestone contract in a later slice, measure its authoring cost
against the per-ticket savings, and keep it to goals, scope, architecture, dependency graph,
shared test strategy, and definition of done. It is not a second specification.

### 9. Eleven phases are too heavy for small changes

A 200-line fix does not need a 25-section specification, a 31-case test plan, a 135KB plan,
and a readiness review that reads 6MB. The lifecycle was designed for a human-supervised,
single-change flow; unattended dozens-of-tickets delivery needs proportionality.

**Mitigation:** tiers. S: a one-page contract and a checklist, with clarify and specification
collapsed, the test plan as a list of cases, and the plan as a file list. M: a structured
contract, a test table, and a short plan. L: the full set. Tier thresholds are an open point.

### 10. This is a significant product change, and boiling the ocean is the fastest way to fail

The pack touches schemas, the CLI, the agent definitions, the harness permissions, the queue,
the review flow, and the milestone process. Building it all at once would be a large, risky
change with no early evidence.

**Mitigation:** slices with a metric and a rollback each (section 08). Start with the typed
ledger and lint (small, immediate, removes the corruption class), then the data-first plan and
the coder and reviewer bundles on one pilot ticket, then the test table, then the
specification contract, then handovers, then affected-path parallelism, then the milestone
contract.

## Design principles

1. **Facets, not documents.** One fact, one home, referenced by ID everywhere else.
2. **Machine first, prose bounded.** Typed fields for control flow; word-budgeted prose for
   judgment; never parse prose for a decision.
3. **One writer.** The CLI is the only door; writes are atomic, validated, committed, and
   stamped.
4. **Read by bundle.** Role and phase in, bounded sections out, with a `missing` list and an
   on-demand fetch.
5. **Plan is the scheduler's input.** Paths, acceptance, tests, and verify are declared and
   audited.
6. **Tiered depth.** The artifact set scales with risk and size.
7. **Milestone memory.** Shared context once, per-ticket deltas.
8. **Measure the read path, not the schema.** Tokens per ticket, read amplification, miss
   rate, reopens, review edits, cycle time.

## Non-goals

- A general-purpose workflow engine.
- A replacement for decision records (ADR, PDR, TDR, BDR, ODR).
- A replacement for the tracker.
- A formal methods specification language.
- A promise that every artifact becomes machine-checkable end to end.
- A change to the repository's public boundary.

## Kill criteria

Stop or reassess if, after a three-ticket pilot:

- the bundle miss rate stays above 25 percent after two bundle iterations;
- input tokens per ticket do not fall by at least 20 percent;
- hand-edit prevention requires harness changes that block legitimate work;
- the plan's affected paths are wrong more than 20 percent of the time, measured by the
  pull-request audit;
- the artifact authoring cost rises more than the read cost falls.

## Success metrics

| Metric | Today (GH-416) | Target after pilot |
|---|---|---|
| Input tokens per 1k changed lines | about 397k | 250k or less |
| Read amplification (bytes read / artifact bytes) | about 35x | 5x or less |
| Artifact bytes per 1k changed lines | about 47KB | 25KB or less |
| Bundle miss rate | not measured | 10 percent or less |
| Reopens per ticket | 2 in this lane | 1 or less |
| Edits after review per 10k lines | about 373 | 150 or less |
| Hand-edit incidents | 1 in this lane | 0 after the pilot |
| Artifact-caused verify failures | 1 in this lane | 0 |

The baseline numbers are measurements from one lane, not a benchmark; section 10 states the
method and the caveats.

## Recommendation

Proceed, in slices, and treat the read path as the product. The first slice is small and
removes a live failure: a typed writer for the PM context, a fail-closed phase completion, and
a lint that rejects an untyped artifact commit. The second slice proves the bundle idea on one
M ticket with a data-first plan and coder and reviewer bundles. The rest follows the evidence.
