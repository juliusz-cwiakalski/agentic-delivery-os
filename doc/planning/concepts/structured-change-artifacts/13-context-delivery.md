---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/13-context-delivery.md
---
# 13. Context delivery: formats, forms, and deltas

Status: governed by `14-review-decisions.md` (decisions 1, 5 to 7, 14, 16, 20, 23, 31 and 35
to 40) and by `15-classification-and-rounds.md`.

## The question

If the tool becomes the only door to the artifacts, two design choices decide whether it
reduces tokens or merely moves them:

1. **What the tool returns.** Raw YAML is structured but verbose; JSON is worse for prose;
   Markdown is compact but less structured; a stripped YAML saves little.
2. **What the tool accepts.** CLI flags are precise but unwieldy for a whole contract; a form
   is comfortable but is another file to keep in sync.

The answer is a **projection envelope** for output, and for input **a form for the first write
of a contract and commands for every later edit**.

## Output: the projection envelope

### The header and the body

The envelope has two layers. The header is one compact block, machine-readable: the change,
the shape, the flags, the role, the phase, the contract revision and the bundle hash. The body
is Markdown sections in a stable order. Three example bundles are in
`05-context-bundles.md`.

One format for each direction (Q35):

| Direction | Format | Why |
|---|---|---|
| The tool writes the stored artifacts to disk | YAML | the balance between human and agent readability and full machine readability |
| The tool appends to the event log | JSON lines | append-only, one parser, easy to fold into state |
| The tool serves an agent | the Markdown envelope | compact, readable, stable sections |
| The tool talks to a tool | JSON | machine-readable, easy to assert |

The contract is one YAML file, and there is no separate prose file. The stored YAML also
serves debugging and diff review.

### Every fact carries its origin

A reader must be able to tell whether a statement, a path or a check started in the tracker,
was written by an author, or was derived by the tool. Every row that carries a fact is tagged
with its origin:

| Origin | Means | Examples |
|---|---|---|
| `tracker` | written in the ticket | the title, the body, the typed block of areas, checks, stages and flags |
| `author` | written by an agent through a typed command | the goal, the criteria, the verified facts, the decisions, the oracle, the Work section, the PM's confirmation of a flag |
| `tool` | derived or recorded by the tool | the proposed flags, the lint and preflight results, the state, the recorded runs, the commands the tool ran |

A table of facts has an `Origin` column when its rows differ, and a section whose rows share
one origin names it in its heading. A row outside the contract carries the role that wrote
it: `(pm)` for the typed open items, `(reviewer)` for a finding, `(coder)` for the lines it
keeps in a handover. A command carries the same three names as its origin (`04-cli.md`).
Every command the tool runs carries its origin in the reviewer's bundle and runs under the
command policy whatever it is; a command from the tracker is limited to a known gate or an
existing test path.

### Example: the PM brief

The PM brief is state plus typed open items.

```markdown
# PM brief / GH-416
change=GH-416 shape=phased flags=data state=delivery role=pm
revision=contract:5 bundle=sha256:5d02...

## State (tool)
phase=PH-03 step=PH-03_S01 done=PH-01, PH-02
next=PH-03_S02 (coder), then the handover of PH-03
rounds: pre-code 1, closed with no material finding; review 0
parked=no

## Typed open items (pm)
| Ref | Kind | Statement | Owner | Due | Blocking |
|---|---|---|---|---|---|
| 1 | question | OQ-1: is the record written when the act fails? Default: yes, with the cause. | contract author | | no |
| 2 | decision | Does the dispatch feature page need a section for the record kind? | PM | PH-04_S02 | no |
| 3 | next action | Confirm the changeset before the full gate. | PM | the gates | no |
| 4 | next action | Wait for the handover of PH-03, then start PH-04 in a fresh session. | coder | | yes |

Blockers: none.

## Flags with unmet add-ons (tool)
| Flag | Add-on | Status |
|---|---|---|
| `data` | concurrency rehearsal | open; due with the gates |

## Decisions (author), one line each
DEC-1: the lane owns the push act, so that the outcome is recorded once. Record TDR-0079.
DEC-2: a closed cause vocabulary, so that a refusal is data and never prose.

## Last handover (tool drafts, coder confirms), summary
PH-02: resolve, act, append, answer over injected ports. The append follows a failed act.

## Missing (fetch on demand)
- decisions.DEC-1: the alternatives, if a new decision must be taken.
```

### Why this works

- **Semantic keys stay; YAML structure keys go.** A table keeps the keys that carry meaning
  (ID, statement, proof, path, kind) and drops the syntax (`acceptanceCriteria:`, `- id:`,
  indentation). The agent reads meaning, not YAML.
- **Projection, not stripping.** The envelope contains only the sections the role needs. The
  stored file contains every field of the contract; the envelope contains the facts the role
  acts on. Removing YAML keywords from a full document saves a few percent; removing
  unrelated sections saves most of the tokens.
- **Tables for lists.** Criteria, paths, and steps are naturally tables. A table is denser
  than one bullet per field and is still readable by a model.
- **Stable order.** The agent learns where to look. The same role always gets the same
  section order, so it can cache and compare.
- **No prose in machine sections.** Prose appears only in the handover and in a declared
  free-text slot, where it carries judgment. The machine sections are facts.
- **The header carries the shape and the flags.** The reader knows which add-ons are in
  force before the first section.
- **An origin on every fact.** A reader can weigh a statement by where it came from, and a
  reviewer can see every command the tool ran and who asked for it.
- **A visible `missing`.** The agent knows what it does not have and how to get it. This is
  the difference between a bounded context and a blind one.

### What not to do

- Do not return the whole contract because "the agent might need it". That is the 35x read
  amplification again.
- Do not strip keys from a full document and call it a projection. It is still the whole
  document.
- Do not put prose in a machine section. It bloats the bundle and invites parsing.
- Do not reorder sections between calls. The agent cannot cache what it cannot predict.
- Do not truncate silently. A visible `missing` entry is better than a quiet cut.

### Measuring the format

The metric is **facts per token**, not bytes. A fact is a criterion, a path, a step, a verify
command, a handover item. The pilot compares the raw YAML, the envelope, and a stripped YAML
on the same phase, and measures tokens, task accuracy, and the number of on-demand fetches.
The target is a 2 to 4 times reduction in tokens for the same facts, with no increase in
errors.

## Input: a form for the first write, commands for later edits

### The two surfaces

**Commands for a single fact.** Precise, validated, no YAML for the agent to write:

```bash
jaiship contract add GH-77 --section criteria --id AC-3 --form example \
  --statement "When --help is passed, the help text lists --json."
jaiship contract add GH-77 --section oracle --id PROOF-3 --criterion AC-3 --method command \
  --observable "The stdout and stderr of export --help." \
  --predicate "The output contains --json." --argv node bin/export.js --help --baseline red
jaiship change classify GH-77 --remove contract \
  --reason "The export command is used by a person at a terminal; no service or client consumes its stdout."
jaiship review finding add GH-77 --round 1 --category coverage --materiality material --cites PROOF-1 \
  --summary "The test stays green with the JSON branch removed."
```

**A form for the first write of a contract.** The write spans seven sections. The tool
generates a form from the schema; the agent fills it in; the tool validates it as one write
and writes the contract (Q36).

```bash
jaiship contract form GH-77 > /tmp/contract-form.yaml
# fill the sections: goal, criteria, facts, decisions, oracle, work, flags
jaiship contract set GH-77 --from-file /tmp/contract-form.yaml
```

The form is a **view**, not a second source of truth. It is generated from the schema, so it
cannot drift. It carries a `formVersion` and a `basedOnRevision`. Every write takes a
per-change lock, an expected revision and an idempotency key, and is refused when the file
differs from the committed version (decision 39). Two agents cannot overwrite each other
blindly, and a hand edit cannot ride into a tool commit.

### Why a form

- A contract has seven sections and dozens of fields. Dozens of flags are unreadable and
  error-prone.
- A form is familiar to an agent: it is a file to fill, with comments and examples.
- The form can be prefilled, so an edit is a small diff, not a rewrite.
- The form can be validated before submission, with field paths in the errors.
- The form keeps the single-writer rule: the agent edits the form, never the contract.

### The error format

```json
{
  "code": "change.ref.unresolved",
  "detail": "PROOF-4 cites TC-9, which the contract does not hold. Reference an existing TC- identifier, or add the test case first.",
  "path": "oracle.obligations[3].test",
  "field": "test"
}
```

Every error carries the field inside the file and, in its detail, what to do about it. No
stack traces, no "something went wrong". `path` locates a field, never a file: the envelope
carries no artifact path.

### What not to do

- Do not accept free text where an enum exists. A materiality is `material`, `useful` or
  `cosmetic`; a category is one of ten names. Neither is a sentence.
- Do not accept a note without a type. An open item is a blocker, a question with a default, a
  decision or a next action; each has a schema.
- Do not let the agent edit the committed contract directly. The form and the commands are
  the editing surface; the contract is the committed truth.
- Do not version the form by hand. The tool owns `formVersion` and `basedOnRevision`.

## Versioning and deltas (deferred)

**Deferred by the owner's review decision (section 14).** The first version is stateless full
bundles per role and phase. The `--since` protocol below is a future option, not a slice.

### The problem

An agent asks for phase PH-03. It asked before, and nothing changed. Returning the full bundle
again costs tokens. Returning nothing is dangerous: the agent may have lost its context to
compaction.

### The protocol

Every section has a content hash. The bundle header carries the hashes it used. The agent can
pass the last bundle hash:

```bash
jaiship context bundle --for coder --phase PH-03 --since sha256:7f3a...
```

The response has four kinds of section:

- `unchanged`: the section hash is the same. The tool returns the hash and a one-line summary,
  not the content.
- `changed`: the section hash differs. The tool returns the new content and a one-line
  `changed because` (the contract revision and the field that moved).
- `new`: the section did not exist in the `since` bundle.
- `removed`: the section existed and is gone.

```text
# delta header
since=sha256:7f3a... current=sha256:9c21...
changed=work.PH-03, oracle.PROOF-3
unchanged=criteria.AC-1, criteria.AC-2, criteria.AC-3, handover.PH-02
new=work.PH-03.verify
removed=none
```

### The rules

- **Stateless first.** The agent passes the hash; the tool keeps no per-agent seen-state. This
  avoids a state store and a privacy question.
- **`unchanged` is not empty.** The tool returns the hash and a summary. The agent can keep its
  cached copy or force a full fetch.
- **A stale `since` is a full bundle.** If the hash is unknown or older than the retained
  history, the tool returns a full bundle and says so.
- **A fresh agent gets a full bundle.** The delta is for a long-lived phase, not for a new
  session.
- **The delta is per section, not per file.** A change to one acceptance criterion does not
  resend the whole contract.

### The challenge

The tool cannot know what is in the agent's context. It can only know what it served. The
`since` hash is the contract; the agent is responsible for passing the hash of the bundle it
actually has. If the agent's context was compacted, it omits `--since` and gets a full bundle.
Do not build a mind-reading seen-state store; build a clear protocol.

### When the delta is worth it

- A long delivery phase where the contract changes while the coder works.
- A review that spans several sessions.
- A PM brief that is refreshed at every state boundary.

When it is not worth it: a fresh agent, a light change, a one-shot read.

## The push model (out of scope)

**Out of scope for this pack** by the owner's review decision (section 14). The messaging
system is a separate concept for loosely coupled coordination, not the strict single-change
lifecycle; see `../inter-agent-communication.md`. The design is kept for reference.

### The idea

One agent changes a section of the contract that another agent depends on. The tool should
tell the second agent what changed, at the read point, without a chat system.

### The design

- Every write records a **change event**: the section, the revision, the changed fields, the
  command, the change ref, and the actor role.
- The next bundle for a dependent role includes a `## What changed since your last bundle`
  section, derived from the events, from the dependencies between phases in the Work section,
  and from the handovers.
- The tool can answer a direct question:

```bash
jaiship context changes --change GH-416 --since sha256:7f3a...
```

```text
work.PH-03: changed at revision 5 by contract-author (a step added)
oracle.PROOF-3: changed at revision 3 by contract-author (expected output clarified)
criteria.AC-2: unchanged
```

### The boundary

This is **artifacts over messages**, the frame in `../inter-agent-communication.md`. It is
pull-based: the agent reads at a read point, not an interruption. There is no inbox, no TTL, no
receipt, no chat. The event log is derived from the artifacts; the bundle is the delivery; the
dependencies in the Work section are the routing.

### The challenge

A push model can become a message system with its own inbox, TTL, and receipts, and then it
needs its own reliability guarantees. Keep it simple: the events are a projection of the
artifact history, the bundle is the only delivery, and the `since` hash is the only state. If
the bundle miss rate is low, the push section is a convenience, not a dependency.

## The research plan

The external researcher can survey prior art and the team can prototype the envelope. It is
launched only where a decision is stuck (Q40). The questions:

1. **Output format.** For LLM agents, which format minimizes tokens while preserving accuracy:
   YAML, JSON, Markdown, key=value, or tables? Measure task accuracy, tokens, and latency.
2. **Delta protocol.** Does an `unchanged` plus hash response reduce tokens without increasing
   errors? What is the right signal for "you already have this"?
3. **Input format.** For complex structured writes, do flags, forms, JSON, or natural language
   with a parser produce fewer validation errors and retries?
4. **Prior art.** How do agent frameworks and tool protocols handle context packing, tool
   result truncation, and structured tool output? What can be adopted without a new dependency?
5. **Commit messages.** What quality is acceptable from a deterministic generator? Compare
   human, model, and tool messages on usefulness and accuracy.
6. **Change resolution.** What are the failure modes of branch-name and worktree-based change
   resolution in practice: ambiguity, renames, security, CI?

The method: a small benchmark with three tasks, three formats, two models; measure tokens,
accuracy, and latency; then a pilot on one change of each shape. The external researcher
produces a short brief with sources; the team prototypes the envelope and the delta on the
pilot.

## Challenges to part 2

The owner's answers to these challenges are in `14-review-decisions.md`. The bullets below are
the challenges as first written; the decisions file records what changed.

- **Auto-discovery is convenient but the branch name is untrusted.** Use the registry first,
  the branch second, and fail closed on ambiguity. Keep an explicit `--change` for CI and the
  main checkout.
- **"The agent does not care about the change ID" is right for reads and wrong for escalation.**
  The envelope carries the ID; the agent can name it when it reports a problem.
- **The state machine can become a rigid workflow engine.** Keep judgment states explicit and
  the PM as the exception handler. The machine handles the happy path and the known failures.
- **A deterministic commit message can be bland.** The phase title and the handover are the
  source; lint the phase title for a verb phrase; never invent a summary.
- **The output format's biggest win is projection, not key stripping.** Measure facts per
  token; do not strip keys from a full document and call it a projection.
- **Delta and versioning add state and complexity.** Start stateless with `--since`; add a
  seen-state store only if the miss rate is low and the tokens justify it.
- **The push model can become a message system.** Keep it artifact-centric and pull-based; the
  dependencies in the Work section are the routing.
- **"The tool does everything" can over-centralize.** The tool does the deterministic 80
  percent; the agent does the judgment 20 percent. The boundary is the total-function test.

## Part 2 open points

Answer inline under each question.

### Q31. Should the current change be resolved from the registry, the branch, or both?

Priority: **high**.

Default: the worktree registry is primary, the branch is a legacy fallback, explicit `--change`
for CI and the main checkout; fail closed on ambiguity; one lane, one change.

Answer:

**Answered (2026-11-27):** The worktree registry is primary; the branch name is a legacy fallback. One lane, one change.

### Q32. Should the agent be allowed to pass `--change` explicitly?

Priority: **normal**.

Default: yes, always; it is the escape hatch and the CI path.

Answer:

**Answered (2026-11-27):** Yes, explicit `--change` for CI and cross-change operations; the default is the current change.

### Q33. Should `workflow next` be the PM's only navigation command?

Priority: **high**.

Default: yes for the happy path; the PM uses `pm brief` for exceptions and judgment states.

Answer:

**Answered (2026-11-27):** Yes for the happy path. The PM or CEO selects the workflow template at intake, can add a state with a reason, and uses `pm brief` for exceptions.

### Q34. Should commit messages be fully deterministic or model-assisted?

Priority: **high**.

Default: deterministic for artifact commits and phase commits; the model may write the
pull-request description, not the commit.

Answer:

**Answered (2026-11-27):** Deterministic wherever possible: phase title as the first line, acceptance criteria as the body.

### Q35. What is the default output format?

Priority: **high**.

Default: the Markdown envelope; JSON for tools; YAML for debugging.

Answer:

**Partially answered (2026-11-27):** the Markdown envelope with semantic keys; keys that help understanding stay; JSON for tools.

**Recorded (2026-11-28):** It depends on the direction. Written by the tool: YAML, the balance between human and agent readability and full machine readability. Served to an agent: the Markdown envelope. Between tools: JSON.

### Q36. Should the form be the default for complex writes?

Priority: **normal**.

Default: yes for the first write of a whole contract; commands for a single fact and for
every later edit.

Answer:

**Explained and proposed (2026-11-28):** a form is the input counterpart of a bundle. For a complex write (a whole contract with its sections) the tool serves a template of the fields to fill, the agent fills it in, and the tool validates it as one write; a single field stays a command flag. Accepted (2026-11-28): yes for the first write of a contract, commands for later edits.

### Q37. Should deltas be stateless (`--since`) or stateful (a seen-state store)?

Priority: **high**.

Default: deferred. The first version is stateless full bundles; `--since` is a future option.

Answer:

**Answered (2026-11-27):** Deferred. Focus on slicing what is provided in the context; stateless full bundles first.

### Q38. What is the acceptable delta error rate?

Priority: **normal**.

Default: deferred with the delta protocol; when it is built, zero false `unchanged`.

Answer:

**Answered (2026-11-27):** Deferred with the delta protocol.

### Q39. Should the push section be built in the first slice or later?

Priority: **normal**.

Default: out of scope for this pack; the messaging system is a separate concept.

Answer:

**Answered (2026-11-27):** Out of scope. The messaging system is a separate concept for loosely coupled coordination.

### Q40. Should the external researcher be launched at this point?

Priority: **normal**.

Default: yes, with the six questions in this file; the owner decides the scope.

Answer:

**Answered (2026-11-28):** skip it while every point has a conclusion. Use the external researcher only where a decision is stuck.
