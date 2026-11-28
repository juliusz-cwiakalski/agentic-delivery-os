---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/13-context-delivery.md
---
# 13. Context delivery: formats, forms, and deltas

## The question

If the tool becomes the only door to the artifacts, two design choices decide whether it
reduces tokens or merely moves them:

1. **What the tool returns.** Raw YAML is structured but verbose; JSON is worse for prose;
   Markdown is compact but less structured; a stripped YAML saves little.
2. **What the tool accepts.** CLI flags are precise but unwieldy for a facet; a form is
   comfortable but is another artifact to keep in sync.

The answer is a **projection envelope** for output and a **generated form** for input.

## Output: the projection envelope

### The three layers

```text
# header (one compact block, machine-readable)
change=GH-416 phase=P3 role=coder tier=L
revisions=spec:3,test-plan:2,plan:4,handover-P2:1
budget=16KB used=9.8KB
bundle=sha256:7f3a...

# body (Markdown sections, stable order, terse facts)
## Phase
P3: The command, the renderer, and the edge wiring.
Goal: expose `push <ref>` as a prompt-required command and wire it into the composed program.
Acceptance: AC-1, AC-2, AC-3.

## Acceptance criteria
| ID | Statement | Evidence |
|---|---|---|
| AC-1 | `push <ref>` pushes once and reports the remote head. | TC-LCMD-001 |
| AC-2 | A refused transport is a data-bearing answer with a closed cause. | TC-LCMD-002, TC-LCMD-004 |
| AC-3 | `dispatch status` carries the additive `lanePush` fact. | TC-LCMD-000, TC-LCMD-003 |

## Paths
| Path | Kind | Role | Why |
|---|---|---|---|
| packages/cli/src/commands/push.ts | add | producer | the command entry and grammar |
| packages/cli/src/output/push-text.ts | add | producer | the renderer |
| packages/cli/src/production.ts | modify | consumer | the composed program |

## Interfaces
API-1 (cli, added): `jaiship push <ref>`; positional ref, optional `--json`; exit 0 on pushed,
exit 1 on a refused act; standard envelope on a grammar refusal.

## Tests to satisfy
| ID | Title | Steps | Expected |
|---|---|---|---|
| TC-LCMD-001 | push once and report the head | 3 steps | exit 0, verdict pushed |
| TC-LCMD-003 | status carries lanePush | 2 steps | additive, no field changed |

## Verify
- `pnpm typecheck` (cwd `.`, exit 0)
- `pnpm test tests/behaviour/dispatch-lane-push-command.test.ts` (cwd `.`, exit 0)

## Handover from P2
Done: resolve, act, append, answer over injected ports.
Deviations: the append follows a failed act so the record carries the refusal.
Next inputs: the renderer must not add an error identity for a refusal.

## Invariants
DEC-1: the lane owns the push act; the engine's ensure-push is the backstop.
NG-1: no change to branch protection or the merge path.

## Next phase expects
P4 needs the command registered in the composed program and the help inventory updated.

## Missing (fetch on demand)
- spec.prose.rationale: `jaiship context get --change GH-416 --section spec.prose.rationale`
- plan.P1.steps: not needed for P3
```

### Why this works

- **Semantic keys stay; YAML structure keys go.** A table keeps the keys that carry meaning
  (ID, statement, evidence, path, kind) and drops the syntax (`acceptanceCriteria:`, `- id:`,
  indentation). The agent reads meaning, not YAML.
- **Projection, not stripping.** The envelope contains only the sections the role needs. The
  raw YAML contains every field of every facet; the envelope contains the facts. Removing YAML
  keywords from a full document saves a few percent; removing unrelated sections saves most of
  the tokens.
- **Tables for lists.** Acceptance criteria, paths, and tests are naturally tables. A table is
  denser than one bullet per field and is still readable by a model.
- **Stable order.** The agent learns where to look. The same role always gets the same section
  order, so it can cache and compare.
- **No prose in machine sections.** Prose appears only in the handover and the invariants,
  where it carries judgment. The machine sections are facts.
- **A visible budget.** The header states the budget and the used bytes. A bundle that is over
  budget is a plan problem, not a rendering problem.
- **A visible `missing`.** The agent knows what it does not have and how to get it. This is the
  difference between a bounded context and a blind one.

### Formats

| Format | Use | Why |
|---|---|---|
| `md` (default) | agents | compact, readable, stable sections |
| `json` | tools, telemetry, tests | machine-readable, easy to assert |
| `yaml` | debugging, diff review | human-readable structure |
| `delta` | versioned reads | unchanged, changed, new, removed |

The default is `md` because the agent reads it directly. `json` is for the tool and the tests.
`yaml` is for a human debugging a schema. `delta` is for the versioning protocol below.

### What not to do

- Do not return the whole facet because "the agent might need it". That is the 35x read
  amplification again.
- Do not strip keys from a full document and call it a projection. It is still the whole
  document.
- Do not put prose in a machine section. It bloats the bundle and invites parsing.
- Do not reorder sections between calls. The agent cannot cache what it cannot predict.
- Do not hide the budget. A silent truncation is worse than a visible `missing`.

### Measuring the format

The metric is **facts per token**, not bytes. A fact is an acceptance criterion, a path, a
test, a verify command, a handover item. The pilot compares the raw YAML, the envelope, and a
stripped YAML on the same phase, and measures tokens, task accuracy, and the number of
on-demand fetches. The target is a 2 to 4 times reduction in tokens for the same facts, with
no increase in errors.

## Input: flags for facts, forms for facets

### The two surfaces

**Flags for a single fact.** Precise, validated, no YAML for the agent to write:

```bash
jaiship spec ac add GH-416 --id AC-3 --statement "..." --evidence test --tests TC-LCMD-003
jaiship pm loop add GH-416 --text "..." --owner pm --due P4
jaiship review finding add GH-416 --severity high --path packages/cli/src/commands/push.ts \
  --line 42 --ac AC-2 --text "..."
```

**A form for a facet.** When a write spans many fields, the tool generates a form from the
schema, prefilled from the current artifact. The agent edits the form in a scratch location and
submits it; the tool validates and writes the artifact.

```bash
jaiship spec form --change GH-416 --prefill > /tmp/spec-form.yaml
# edit /tmp/spec-form.yaml
jaiship spec set --change GH-416 --from-file /tmp/spec-form.yaml
```

The form is a **view**, not a second source of truth. It is generated from the schema, so it
cannot drift. It carries a `formVersion` and a `basedOnRevision`; the tool refuses a form whose
`basedOnRevision` is stale, so two agents cannot overwrite each other blindly.

### Why a form

- A facet has 10 to 40 fields. Forty flags are unreadable and error-prone.
- A form is familiar to an agent: it is a file to edit, with comments and examples.
- The form can be prefilled, so an edit is a small diff, not a rewrite.
- The form can be validated before submission, with field paths in the errors.
- The form keeps the "no hand edit" rule: the agent edits the form, not the artifact.

### The error format

```json
{
  "code": "change.budget.exceeded",
  "detail": "prose.rationale is 1480 words; the L budget is 1200",
  "path": "doc/changes/.../chg-GH-416-spec.yaml",
  "field": "prose.rationale",
  "limit": 1200,
  "fix": "Shorten the rationale or move the detail to the decision record."
}
```

Every error carries the field, the limit, and a fix suggestion. No stack traces, no "something
went wrong".

### What not to do

- Do not accept free text where an enum exists. A severity is `high`, `medium`, or `low`, not a
  sentence.
- Do not accept a note without a type and a size. A note is a loop, a decision, a risk, or
  evidence; each has a schema.
- Do not let the agent edit the committed artifact directly. The form is the editing surface;
  the artifact is the committed truth.
- Do not version the form by hand. The tool owns `formVersion` and `basedOnRevision`.

## Versioning and deltas (deferred)

**Deferred by the owner's review decision (section 14).** The first version is stateless full
bundles per role and phase. The `--since` protocol below is a future option, not a slice.

### The problem

An agent asks for phase P3. It asked before, and nothing changed. Returning the full bundle
again costs tokens. Returning nothing is dangerous: the agent may have lost its context to
compaction.

### The protocol

Every facet and every section has a content hash. The bundle header carries the hashes it used.
The agent can pass the last bundle hash:

```bash
jaiship context bundle --for coder --change GH-416 --phase P3 --since sha256:7f3a...
```

The response has four kinds of section:

- `unchanged`: the section hash is the same. The tool returns the hash and a one-line summary,
  not the content.
- `changed`: the section hash differs. The tool returns the new content and a one-line
  `changed because` (the facet revision and the field that moved).
- `new`: the section did not exist in the `since` bundle.
- `removed`: the section existed and is gone.

```text
# delta header
since=sha256:7f3a... now=sha256:9c21...
changed=plan.P3.steps, test-plan.TC-LCMD-003
unchanged=spec.AC-1, spec.AC-2, spec.AC-3, handover-P2
new=plan.P3.verify
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
  resend the whole specification.

### The challenge

The tool cannot know what is in the agent's context. It can only know what it served. The
`since` hash is the contract; the agent is responsible for passing the hash of the bundle it
actually has. If the agent's context was compacted, it omits `--since` and gets a full bundle.
Do not build a mind-reading seen-state store; build a clear protocol.

### When the delta is worth it

- A long delivery phase where the plan and the test plan change while the coder works.
- A review that spans several sessions.
- A PM brief that is refreshed at every phase boundary.

When it is not worth it: a fresh agent, a small S change, a one-shot read.

## The push model (out of scope)

**Out of scope for this pack** by the owner's review decision (section 14). The messaging
system is a separate concept for loosely coupled coordination, not the strict single-change
lifecycle; see `../inter-agent-communication.md`. The design is kept for reference.

### The idea

One agent changes a facet that another agent depends on. The tool should tell the second agent
what changed, at the read point, without a chat system.

### The design

- Every write records a **change event**: the facet, the revision, the changed sections, the
  command, the change ref, and the actor role.
- The next bundle for a dependent role includes a `## What changed since your last bundle`
  section, derived from the events and the plan's `dependsOn` and `nextInputs`.
- The tool can answer a direct question:

```bash
jaiship context changes --change GH-416 --since sha256:7f3a...
```

```text
plan.P3.steps: changed at revision 5 by plan-writer (added the renderer step)
test-plan.TC-LCMD-003: changed at revision 3 by test-plan-writer (expected result clarified)
spec.AC-2: unchanged
```

### The boundary

This is **artifacts over messages**, the frame in `../inter-agent-communication.md`. It is
pull-based: the agent reads at a read point, not an interruption. There is no inbox, no TTL, no
receipt, no chat. The event log is derived from the artifacts; the bundle is the delivery; the
plan's dependencies are the routing.

### The challenge

A push model can become a message system with its own inbox, TTL, and receipts, and then it
needs its own reliability guarantees. Keep it simple: the events are a projection of the
artifact history, the bundle is the only delivery, and the `since` hash is the only state. If
the bundle miss rate is low, the push section is a convenience, not a dependency.

## The research plan

The external researcher can survey prior art and the team can prototype the envelope. The
questions:

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
accuracy, and latency; then a pilot on one M ticket. The external researcher produces a short
brief with sources; the team prototypes the envelope and the delta on the pilot.

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
  plan's dependencies are the routing.
- **"The tool does everything" can over-centralize.** The tool does the deterministic 80
  percent; the agent does the judgment 20 percent. The boundary is the total-function test.

## Part 2 open points

Answer inline under each question.

### Q31. Should the current change be resolved from the registry, the branch, or both?

Priority: **P1**.

Default: the worktree registry is primary, the branch is a legacy fallback, explicit `--change`
for CI and the main checkout; fail closed on ambiguity; one lane, one change.

Answer:

**Answered (2026-11-27):** The worktree registry is primary; the branch name is a legacy fallback. One lane, one change.

### Q32. Should the agent be allowed to pass `--change` explicitly?

Priority: **P2**.

Default: yes, always; it is the escape hatch and the CI path.

Answer:

**Answered (2026-11-27):** Yes, explicit `--change` for CI and cross-change operations; the default is the current change.

### Q33. Should `workflow next` be the PM's only navigation command?

Priority: **P1**.

Default: yes for the happy path; the PM uses `pm brief` for exceptions and judgment states.

Answer:

**Answered (2026-11-27):** Yes for the happy path. The PM or CEO selects the workflow template at intake, can add a state with a reason, and uses `pm brief` for exceptions.

### Q34. Should commit messages be fully deterministic or model-assisted?

Priority: **P1**.

Default: deterministic for artifact commits and phase commits; the model may write the
pull-request description, not the commit.

Answer:

**Answered (2026-11-27):** Deterministic wherever possible: phase title as the first line, acceptance criteria as the body.

### Q35. What is the default output format?

Priority: **P1**.

Default: the Markdown envelope; JSON for tools; YAML for debugging.

Answer:

**Partially answered (2026-11-27):** the Markdown envelope with semantic keys; keys that help understanding stay; JSON for tools.

**Recorded (2026-11-28):** It depends on the direction. Written by the tool: YAML, the balance between human and agent readability and full machine readability. Served to an agent: the Markdown envelope. Between tools: JSON.

### Q36. Should the form be the default for complex writes?

Priority: **P2**.

Default: yes for a facet; flags for a single field.

Answer:

**Explained and proposed (2026-11-28):** a form is the input counterpart of a bundle. For a complex write (a whole contract with its sections) the tool serves a template of the fields to fill, the agent fills it in, and the tool validates it as one write; a single field stays a command flag. Proposed: yes for the first write of a contract, commands for later edits.

### Q37. Should deltas be stateless (`--since`) or stateful (a seen-state store)?

Priority: **P1**.

Default: deferred. The first version is stateless full bundles; `--since` is a future option.

Answer:

**Answered (2026-11-27):** Deferred. Focus on slicing what is provided in the context; stateless full bundles first.

### Q38. What is the acceptable delta error rate?

Priority: **P2**.

Default: deferred with the delta protocol; when it is built, zero false `unchanged`.

Answer:

**Answered (2026-11-27):** Deferred with the delta protocol.

### Q39. Should the push section be built in the first slice or later?

Priority: **P2**.

Default: out of scope for this pack; the messaging system is a separate concept.

Answer:

**Answered (2026-11-27):** Out of scope. The messaging system is a separate concept for loosely coupled coordination.

### Q40. Should the external researcher be launched now?

Priority: **P2**.

Default: yes, with the six questions in this file; the owner decides the scope.

Answer:

**Answered (2026-11-28):** skip it while every point has a conclusion. Use the external researcher only where a decision is stuck.
