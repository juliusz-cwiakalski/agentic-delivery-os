---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/03-schemas.md
---
# 03. Schemas and invariants

Status: **Proposal** (2026-11-28). Governed by part 5 of `14-review-decisions.md` (decisions 11
to 42) and by sections 15 to 18; where this file and they disagree, they win.

## The rules for every stored file

- The header is `schemaVersion`, `changeRef`, `revision` and `generatedBy`, with the versions
  `change.contract.v1`, `change.open-items.v1` and `change.handover.v1`. The tool writes the
  last two fields. No file has a status field: a write that succeeds is committed.
- A typed field holds one statement on one line. Prose lives only in a declared slot.
- Identifiers come from the register in `02-artifact-model.md`; a reference that resolves to
  nothing fails the lint. Coverage, state, the add-ons of a flag and the proposed flags are
  derived and stored nowhere.
- `schemas/contract.schema.json` is the machine-readable schema of the contract (JSON Schema,
  draft 2020-12): required fields, closed enumerations, and no property left undeclared. The
  examples beside it are `contract.yaml`, `open-items.yaml` and `handover.yaml`.

## The contract (`change.contract.v1`)

The header holds `title`; `kind` (`fix`, `feature`, `refactor`, `behavior-change`, `docs`,
`infra`), which the tool proposes from the paths and which selects the expected baseline
(`16-testing-in-a-change.md`, section 4); and an optional `milestone` label, never a link to a
goal graph.

### Section 1: `goal`, scope and non-goals

| Field | Kind | Rules |
|---|---|---|
| `goal.statement` | one line | what is true after the change and was not before it |
| `goal.docs` | `none`, or a list of paths | the current-truth documents the change reconciles |
| `goal.scope.in` | list | what the change includes |
| `goal.scope.interfaces` | `id` (`API-`, `EVT-`, `DM-`), `surface`, `change` (`added`, `modified`, `removed`), `contract` | |
| `goal.nonGoals` | `id` (`NG-`), `statement` | binds like the scope |

### Section 2: `criteria`

| Field | Kind | Rules |
|---|---|---|
| `id`, `form` | `AC-<n>`; `example`, `property`, `table` | |
| `statement` | one line | an example states its given, when and then, and the expected outcome |
| `vectors` | list of `input`, `expected` | when `form` is `table`, and only then |
| `asserts` | list of `INVAR-` refs | optional |
| `supersededBy` | an `AC-` ref | written by a revision |

### Section 3: `facts`

| Field | Kind | Rules |
|---|---|---|
| `id`, `statement` | `VFACT-<n>`; one line | a fact of the diagnosis |
| `check.kind` | `read`, `command`, `version` | how it was checked |
| `check.target` | a path with an anchor (`path#symbol`), an argument vector, or a version | the preflight confirms that it exists or runs |
| `check.observed` | one line | what was seen |

### Section 4: `decisions`

| Field | Kind | Rules |
|---|---|---|
| `taken[].id`, `.question`, `.choice` | `DEC-<n>`; one line each | |
| `taken[].why` | one line | the purpose; served to the PM |
| `taken[].consequences` | list, at least one | |
| `taken[].alternatives` | list of `id` (`ALT-<n>`), `option`, `whyNot` | optional; only a rejected alternative that changes how the change is delivered |
| `taken[].record`, `.status` | a decision record identifier, optional; `accepted` or `superseded` | a decision that outlives the change links its record |
| `openQuestions[].id`, `.question`, `.default`, `.answer` | `OQ-<n>`; one line each | the default applies when nobody answers; `answer` is optional |

### Section 5: `oracle`

An obligation links a criterion to its proof. A test reference alone is not a proof.

| Field | Kind | Rules |
|---|---|---|
| `obligations[].id`, `.criterion` | `PROOF-<n>`; an `AC-` ref | the criterion proved |
| `.claim` | one line | what this proof establishes for the criterion |
| `.observable` | one line | what is watched: a return value, a file, an exit code, an output stream, a rendered page |
| `.predicate` | one line | the condition on the observable that must hold |
| `.method` | `test`, `command`, `battery`, `rehearsal`, `rendered` | a native test by its `TC-` reference; a command with its expected output; a listed set of inputs or faults with one recorded result per item (the CI job battery, a mutation battery); a scripted scenario run to a command (a hostile run, a concurrency rehearsal, a consumer check, a check of the integration branch); a rendered artifact compared with an expected form |
| `.boundary` | one line | what the proof leaves out |
| `.test` | a `TC-` ref | with `method: test` |
| `.command` | `argv`, `cwd`, `expect` (`exit`, optional `output`), `origin` (`tracker`, `author`, `tool`) | with every other method; run under the command policy (`04-cli.md`) |
| `.baseline`, `.requiredForMerge` | `red`, `green`; boolean | what is expected on the base: `green` marks a guard, which needs an added case |
| `.addOnOf` | a flag | optional; set when the obligation is the add-on of a flag |
| `tests[].id`, `.path`, `.case` | `TC-<FEATURE>-<nnn>`; a test file; one line | the file is existing or planned; `case` is the name or the selector of the case |

### Section 6: `work`

| Field | Kind | Rules |
|---|---|---|
| `phases[].id`, `.title` | `PH-<nn>`; a verb phrase with an object | the title is also the commit subject; a noun phrase fails the lint |
| `.goal`, `.criteria` | one line; `AC-` refs, at least one | what the phase is for, and what it makes true |
| `.paths` | `path`, `access` (`read`, `write`), and for a write `kind` (`add`, `modify`, `delete`) | a file, a folder or a glob; at least one write |
| `.steps` | `id` (`PH-<nn>_S<nn>`), `action` (imperative, one line), `paths`, `verify` | each step has its paths and its verify command |
| `.verify` | commands, at least one | |
| `.dependsOn` | `PH-` refs | the graph is acyclic |
| `.handover.required`, `.handover.nextInputs` | boolean; a list | required when the next phase runs in a fresh session |
| `.contextFor` | by role: `include`, `exclude` | optional; the tool's mandatory set for a role cannot be excluded (`05-context-bundles.md`) |

### Section 7: `flags`, and the slots

| Field | Kind | Rules |
|---|---|---|
| `flags.active` | the eight flags (`15-classification-and-rounds.md`, part 2) | proposed by the tool, confirmed by the PM |
| `flags.removed` | `flag`, `reason` | a proposal the PM removed |
| `flags.risks` | `id` (`RSK-<n>`), `statement`, `mitigation` | |
| `slots` | `name`, `useIn` (roles) or `archive: true`, `text` | at most three; one of `useIn` and `archive`; about 120 words is a guide that warns |

Invariants, which the lint enforces:

- Every criterion has at least one obligation, and every obligation names its observable and
  its predicate.
- Every obligation resolves to a test reference or to a command the policy allows.
- Every phase has a criterion, a write path and a verify command. Every step has paths and a
  verify command. A flag is active or removed, never both. Every reference resolves.
- The watchlist of an obligation is computed by the tool (`16-testing-in-a-change.md`, section 6).
- A write to `oracle` is accepted only from the author (`04-cli.md`).

## Typed open items (`change.open-items.v1`)

| List | Fields | Written by |
|---|---|---|
| `blockers` | `ref`, `text`, `owner`, `due` (a `PH-` ref), `raisedAt` | `pm blocker add`, `pm blocker clear` |
| `questions` | `ref`, `text`, `default`, `owner`, `oq` (optional), `askedAt`, `answer`, `answeredAt` | `blockers publish`, `blockers answer` |
| `decisions` | `ref`, `text`, `owner`, `cites` (optional), `due`, `raisedAt` | `pm decision add`, `pm decision close` |
| `nextActions` | `ref`, `text`, `owner`, `blocking`, `due`, `raisedAt` | `pm next add`, `pm next done` |

Invariants:

- The tool numbers `ref` inside the file; it is not a catalog identifier. The file holds open
  items only: a closed item leaves it, and the commit that removed it is the record. `cites`
  and `oq` resolve in the contract.
- State is never written here: the tool folds it from the event log for the PM brief.

## Handovers (`change.handover.v1`)

| Field | Written by | Holds |
|---|---|---|
| `phase` | the tool | a `PH-` ref; one entry per phase |
| `done` | the tool drafts, the coder confirms | what is true after the phase |
| `deviations` | the tool drafts, the coder confirms | what differs from the work section, and why |
| `openRisks` | the tool drafts, the coder confirms | what the next phase must watch |
| `nextInputs` | the tool drafts, the coder confirms | the interfaces, files or decisions the next phase consumes |
| `evidence` | the tool only | references: `kind`, `digest`, `bytes`, `runId` and a one-line `summary` |

- Three items per field are the skeleton of the draft, not a quota. The coder keeps only what
  the next phase needs and what the contract does not state.
- An entry is at most 1 KB. Timings and evidence bodies do not travel in it. An entry is
  required when the next phase runs in a fresh session: the last `step done` of a phase
  refuses without it.

## Event kinds

The event log is the capsule's `events.jsonl`. Nothing is added inside a version: a new kind
is a version bump of the envelope. Four of the five kinds below enter it that way; the cost
record has its own store. Gating and privacy: `15-classification-and-rounds.md`, part 7.

| Kind | Store | Appended through | Payload |
|---|---|---|---|
| `step.done` | the event log | `step done` | `step`, `phase`, `role`, `session`, `evidence` (references), `handover` |
| `review.finding` | the event log | `review finding add`, `resolve`, `withdraw`; the lint and the preflight | the finding record, below |
| `gate.run` | the event log | `obligation run`, `obligation mutate`, `preflight`, `lint change`, the gates | `subject`, `leg` (`base`, `candidate`, `mutant`), `tree`, `command`, `status`, `counts`, `redKind`, `durationMs`, `evidence` (a reference), `waiver` (`reason`, `expiresAt`, `approvedBy`) |
| `round.decision` | the event log | `review verdict`; `review rounds allowed --allow` | `reader`, `round`, `materialFindings`, `largeChange`, `ceiling`, `allowed`, `escalation`; for a raised ceiling `raisedBy`, `reason` |
| `cost.record` | the repository's measurement log, once per change at closeout; never the capsule | `closeout` | per role and per phase: `sessions`, `inputTokens`, `outputTokens`, `cacheTokens`, `minutes`; per gate: `rounds`, `findings` by category and materiality. Aggregates only |

- An append that carries state (`step.done`, `review.finding`, `round.decision`) is gating: if
  it fails, the command fails and nothing is written. Any other append is recorded as refused.
- Token figures never enter the capsule. The cost of each boundary is host-local telemetry,
  read live by `change cost`. One aggregate per change reaches the measurement log at closeout.
- `status` and `redKind` follow `16-testing-in-a-change.md`, section 3: only a failed assertion
  is a red. A missing symbol, an unresolved import and a harness error are recorded as their kind.
- A payload carries identifiers, references, counts, verdicts and one-line summaries: no
  transcript, diff, prompt, tool output or credential.

The finding record:

| Field | Kind | Rules |
|---|---|---|
| `id` | `RFIND-<n>` | the tool allocates it in the event log; a reader never does |
| `category` | `design`, `contract`, `security`, `data`, `code`, `coverage`, `fact`, `environment`, `format`, `process` | |
| `materiality` | `material`, `useful`, `cosmetic` | the reader's judgment; a material finding earns a round and a finding without a materiality never does |
| `nonMaterialReason` | one line | required when the category is `design`, `contract`, `security` or `data` and the materiality is not `material`: what would have to be true for it to be material |
| `path`, `line` | a repository path; a line, optional | |
| `round` | integer from 1 | the reader's round |
| `reader` | `pre-code-reader`, `reviewer`, `coder`, `lint`, `preflight` | the coder reads first in the light shape |
| `summary` | one line | |
| `cites`, `ticket` | contract identifiers; a locator in the ticket | optional |
| `resolution` | `raised`, `resolved`, `withdrawn` | a later event with the same `id`; `verifiedBy` (`lint`, `reader`) goes with `resolved` |

A finding the lint or the preflight mints is mechanical: it has no materiality and no round, so
it never earns one, and the tool resolves it after the fix.

## Persisted content

| Rule | Statement |
|---|---|
| YAML 1.2 core | No tags, anchors, aliases or merge keys. `true` and `false` are the booleans and nothing else resolves to one |
| Duplicate keys | The parser rejects them; the last value never wins |
| Byte cap | The contract 256 KiB, the open items 32 KiB, the handovers 64 KiB (numbers are a proposal). A file over its cap is refused, never truncated |
| One serialization | The canonical emission below |
| One parser | One pinned parser version reads every stored file, in the CLI and in CI; CI refuses another |
| Secret scan | Every persisted string, keys and values, slot prose and summaries included. A hit refuses the write with `change.secret.detected` and names the field; the value is never echoed |

## Canonical emission

| Aspect | Rule |
|---|---|
| Key order | The order of the field tables in this file, at every level |
| Indent and lists | Two spaces; every list in block style, one item per line; never a flow list |
| Scalars | Plain by default; double quotes only when a scalar would read as another type or starts with a special character; never single quotes; prose as a literal block (`\|-`) |
| Width and endings | A block wraps at 100 columns; a one-line field stays on one line; LF endings; one newline at the end |
| Comments | None |

The tool parses a stored file and emits it again. Equal bytes: the file is as the tool wrote
it. Different bytes: a hand edit (`change.canonical.diverges`), for `change repair`.

## Lint steps and error codes

`jaiship lint change <ref>` runs these steps in order and stops at the first that fails:

1. Parse and schema: YAML 1.2 core, duplicate keys, the byte cap, the pinned parser, then
   `contract.schema.json` and the tables above for the two other files.
2. Identifiers: registered prefixes, each minted once, every reference resolved.
3. The proof join: every criterion has an obligation; every obligation names its observable and
   its predicate and resolves to a test or an allowed command; every phase title is a verb
   phrase with an object; at most three slots, each with a reader or archived.
4. Paths: every declared path exists or is declared `add`; none is outside the scope or
   protected. The map and the protected list are read from the merge base.
5. Commands: every cited command is on the allowlist, has a working directory inside the
   worktree and carries its origin. A command from the tracker names a known gate or an
   existing test path.
6. Secrets: every persisted string.
7. Shape: the flags and the tripwire are recomputed from the contract's paths. A new flag or a
   crossed tripwire is an escalation the tool records and the PM confirms. It is not an error.
8. Provenance: the file re-emits byte for byte, and the commit that wrote it carries the trailer.
9. Measures, as warnings that never fail: duplicate line share, free-text words per criterion,
   the warning line of the shape, a slot over its guide.

| Code | Meaning |
|---|---|
| `change.schema.invalid` | a file does not parse, misses a required field, or carries an undeclared field |
| `change.ref.unresolved` | a reference resolves to nothing |
| `change.id.duplicate` | an identifier is minted twice |
| `change.coverage.missing` | a criterion has no obligation; a phase or a step has no path or no verify command |
| `change.obligation.unpinned` | a criterion's obligation names no observable or no predicate |
| `change.phase.title.invalid` | a phase title is not a verb phrase with an object |
| `change.paths.undeclared` | the diff touches a path the work section did not declare |
| `change.paths.unmodified` | a declared write path is unchanged |
| `change.map.protected` | the diff touches the surface map or another protected path, and the change lacks the `protected-path` flag or the owner's sign-off |
| `change.map.narrowed` | the diff narrows a pattern of the surface map |
| `change.command.not-allowed` | a cited command is not on the allowlist, or comes from the tracker and names no known gate or existing test path |
| `change.secret.detected` | a persisted string holds a secret; the error names the field |
| `change.provenance.missing` | a commit touched a stored file without the tool trailer, or `generatedBy` is absent |
| `change.canonical.diverges` | a stored file does not re-emit byte for byte: it was edited by hand |
| `change.budget.exceeded` | a file is over its byte cap, or a handover entry is over 1 KB |

The write transaction raises its own codes, among them `change.revision.stale` (a stale
revision) and `change.lock.busy` (a locked change). They are listed in `04-cli.md`.
