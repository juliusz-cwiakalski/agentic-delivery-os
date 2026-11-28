---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/REVIEW-2026-11-28-ceo-disposition.md
---
# Disposition of the critique grid review, 2026-11-28

Written by the CEO agent after reading `REVIEW-2026-11-28-critique-grid.md` in full and checking
its factual claims against the product's specifications. The owner asked for an independent
review and for judgment, not blanket acceptance. Result: 21 findings accepted, 4 accepted in
part, none rejected. The decisions that follow are recorded as decisions 34 to 42 in
`14-review-decisions.md`; this file says, finding by finding, what was done and why.

Severity here is the CEO's judgment of what a concept pack must settle before the owner's final
read. Several findings the review marks BLOCKING are design details that a ticket settles; they
are accepted and written into the pack, and they do not hold up T1.

## Area A: the pack's statements about itself

| ID | Verdict | What changes |
|---|---|---|
| CG-01 | Accepted | Decision 8 carries an inline note that its facet list is superseded by decision 11. The stored set is three artifacts: the contract, the typed open items, the handovers. The summary table and the README say so. |
| CG-02 | Accepted | Decision 22 is marked superseded by decision 24. |
| CG-03 | Accepted | The README's counts, review order and settled list are corrected; its list of files still on the earlier model is exhaustive. The handover of 2026-11-28 carries a banner that its status sections are superseded by the README and the decision file. |
| CG-04 | Accepted | The operator-local section is removed from the public handover. The tool is called Jaiship or the tool. |

## Area B: testing inside a change

| ID | Verdict | What changes |
|---|---|---|
| CG-05 | Accepted | An obligation names the observable and the predicate, not only a test reference. The removal check runs per obligation. A test that is green on the base may serve only as a guard, and then a case is added. |
| CG-06 | Accepted | A run has two legs. The base leg runs on the merge-base tree with the change's test files added. A red has a kind: a failed assertion counts; a missing symbol, an unresolved import or a harness error is recorded and is not a red. Staleness is defined per leg. A waiver is an audited event with an expiry. The base leg runs once per change for the acceptance obligations, not once per obligation. A base leg that cannot be attempted is shown at the definition of done. |
| CG-07 | Accepted | The watchlist of an obligation is its test file, what the test imports, the test configuration and the CI workflow that runs it. Only the author revises an obligation; a revision by the coder is a finding. |

## Area C: agents, prompts and the state machine

| ID | Verdict | What changes |
|---|---|---|
| CG-08 | Accepted | Mutation is a tool command: it copies the tree, applies a fault set, runs the obligation and records the result. The reviewer requests it and reads it; it stays read-only for source. The ticket and the non-goals are in the mandatory set of every reader. |
| CG-09 | Accepted, and it corrects two decisions | The author is a new agent, the contract author, built from the plan-writer's prompt (paths, steps, verify commands) and the specification writer's contract sections. The specification writer and the plan-writer retire. Section 15 gains a table of states, gates, agents and writers. |
| CG-10 | Accepted in substance; the remedy is different | The review is right that the light shape must keep a pre-code check. The remedy is not a reader session for every change. In the light shape the coder is the first reader: it must have the ticket and the card, and it does not start on a card that does not cover the ticket; a typed finding returns the card. When the ticket carries a typed block, the tool checks that every check in it has an obligation. Intake gains an explicit diagnosis step. The figures are restated as population bounds. Q48 is reworded: an urgent fix takes the shape its surface dictates. |

## Area D: roadmap and migration

| ID | Verdict | What changes |
|---|---|---|
| CG-12 | Accepted in part | Rejected in its strong form: the claim that three prefixes run with one check fewer than today. The product has no independent test author today (the test-plan-writer wrote a document, not tests), and the readiness gate and the reviewer keep running after T2 and T3. What T4 withdraws from unflagged changes is the readiness session, replaced by the preflight and the coder as first reader (CG-10). Accepted: T5 depends on T4; the acceptance author appears in the flag table; T2 names the rule that splits the PM's card from the author's contract before T4 exists; every prefix gets a check matrix (present, replaced or absent for each of today's checks); every ticket gets one numeric criterion; T3 stays one ticket with an internal order and a signal for each part; T2's deviation from two rules of section 08 is recorded with its reason (one small file is read whole until T3). |
| CG-13 | Accepted, verified | T1's cost half becomes: expose the telemetry the product already captures per change, phase and role, and add the phase and gate dimensions it lacks. |
| CG-14 | Accepted, verified | Section 15 gains a store matrix and a fact-home table. The capsule keeps its closed kinds; state-bearing appends are gating. Read telemetry is host-local. Token figures never enter the capsule. |
| CG-15 | Accepted | Migration rules: the tool reads every shape the previous version wrote and writes only the current one; the contract is the only new shape; the files of a change in flight stay until it lands; a migration refuses to drop content; the compatibility reader goes when no open change uses the earlier files. These are acceptance criteria of T2. |

## Area E and F: classification, rounds and evidence

| ID | Verdict | What changes |
|---|---|---|
| CG-11 | Accepted | Materiality decides: a material finding of any category earns a round, and a finding that is not material never does. "Mechanical" says how a fix is verified, not whether a round is earned. A large change has three phases, or two flags, or crosses the line tripwire. The flags are scripted in part; the PM confirms and a removed proposed flag needs a reason. A finding on design, contract, security or data that is marked not material carries a reason. The tables are rewritten as rules. |
| CG-16 | Accepted | Section 17 says plainly that the classification lever is small in minutes and that the larger levers (artifact volume, the read path, rounds) are unsized until T1 measures. Before the surface map is frozen, past diffs are replayed against draft maps and the flagged share is reported. |
| CG-17 | Accepted | The removal test stays as intent. Measures stand in for a ceiling: duplicate line share across sections, free-text words per criterion, and a per-shape warning line. |
| CG-18 | Accepted | Section 18 reconciles every count, states the disposition of the changes without a ledger, reports 19 of 37 beside the population figure, and labels the minutes comparison as confounded. The figure for the large example is corrected: its merged diff is 129 files and about 12.6k inserted lines. |

## Area G, H and I: data model, trust, identifiers

| ID | Verdict | What changes |
|---|---|---|
| CG-19 | Accepted | Every write takes a per-change lock, an expected revision and an idempotency key. A write is refused when the file differs from the committed version. Only the written file is staged. An evidence reference is a content hash with kind, size and run identity. Reading the cost of a landed change is an acceptance criterion of T1. |
| CG-20 | Accepted | The rewrite ships a machine-readable schema for the contract; the examples follow the rules and use only registered prefixes. |
| CG-21 | Accepted | The surface map is read from the merge base, in the lane and again in CI. A change that touches the map always takes the policy flag and needs the owner's sign-off. An agent-delivered change may widen a pattern and never narrow one. |
| CG-22 | Accepted, with its limit stated | The trailer proves attribution by convention, not identity; the pack says so. A write is refused on a hand-edited file; a repair starts from a failing lint; the CI rule covers files that carry the generator field; each write records the session and the role, and the lane's session report can check the declaration. On one host with one operating-system user this raises the bar and makes a bypass visible; it does not make it impossible. |
| CG-23 | Accepted | A command policy: an allowlist of command prefixes per repository, no shell, a working directory confined to the worktree, an environment without credentials, ticket hints limited to known gates and existing test paths, every command marked with its origin, and every tool-run command shown to the reviewer. |
| CG-24 | Accepted | YAML 1.2 core, duplicate keys rejected, a byte cap per file, one canonical serialization, one pinned parser for the CLI and CI, and a secret scan on every persisted string that names the field. |
| CG-25 | Accepted | One grammar for phases and steps everywhere. The letter-level reading of rule R5 is applied consistently, so the two new prefixes that start with F are renamed; the proposed names are `VFACT-` and `RFIND-`, and the catalog owner decides. The contract allocates its own prefixes; the tool allocates findings in the change's event log. |

## The review's questions for the owner

1. The light shape keeps a pre-code check: the coder as first reader, the ticket coverage, the preflight. No reader session for every change.
2. The base leg runs once per change for the acceptance obligations, not once per obligation.
3. T1 exposes the existing telemetry. Where the committed token figures live is put to the owner: decision 29 said they stay with the change as events; the product's rule keeps telemetry out of the committed capsule. The proposal is one aggregate cost record per change in the repository's measurement log at closeout.
4. Answered on 2026-11-27 (Q16): the trailer and the CI check are enough; signing is optional.
5. Answered by the authority model: a delivery question may proceed on its default, recorded; a question of product scope goes to the owner with a default; the CEO is accountable under the delegated authority.
6. Yes. Every shape reconciles the current-truth documents when documented behavior changes. The contract records whether it does, and the reviewer's finding can add it.

## What is still open after this disposition

The three points in questions 1 to 3 are the owner's to confirm or veto. The names of the two renamed prefixes are his.
