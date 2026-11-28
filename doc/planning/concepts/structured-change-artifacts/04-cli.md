---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/04-cli.md
---
# 04. The command surface

Status: **Proposal** (2026-11-28). Governed by part 5 of `14-review-decisions.md` (decisions 11
to 42) and by sections 15 to 18; where this file and they disagree, they win.

## Commands

Agents read through bundles and write through typed commands. The contract has one family, and
it is the only way the contract is written.

| Command | Run by | Writes | What it does |
|---|---|---|---|
| `contract form <ref>` | author | nothing | prints the form for the first write: the schema as a template, with the tool's proposals filled in |
| `contract set <ref> --from-file <form> [--section <id>]` | author | the contract | the first write, or a whole section |
| `contract add <ref> --section <id> --from-file <item>`, or flags | author | the contract | appends one item to a list of the section |
| `contract revise <ref> --reason <text> [--finding RFIND-<n>] --from-file <form>` | author | the contract | a new revision with a recorded reason; identifiers are kept; an item that stops applying is marked superseded |
| `pm next add`, `pm next done`, `pm blocker add`, `pm blocker clear`, `pm decision add`, `pm decision close` | PM | open items | the typed working state |
| `blockers publish`, `blockers answer`, `blockers list` | PM, owner | open items | a question with its default, and its answer |
| `pm brief` | PM, CEO | nothing | state plus the typed open items |
| `handover draft <ref> --phase <PH->` | coder | nothing | prints the tool's draft, built from the events of the phase |
| `step done <ref> PH-02_S03 [--handover <file>]`, `step reopen <ref> PH-02_S03 --reason <text>` | coder, PM | handovers; events | progress and a reopen are events over a stable identifier; the contract is not edited |
| `preflight <ref>` | any | events | the checks that run before any reader |
| `lint change <ref>` | any | events | the steps and codes in `03-schemas.md` |
| `review finding add`, `review finding resolve`, `review finding withdraw`, `review finding list` | a reader | events | typed findings |
| `review rounds allowed <ref> [--allow --reason <text>]` | reader, PM, CEO | an event with `--allow` | whether a further round is allowed |
| `review verdict <ref> --round <n> --verdict pass\|fail` | reviewer | events | closes a round |
| `obligation run <ref> --leg base\|candidate [--id PROOF-<n>] [--scope acceptance]` | gates, reviewer | events | the two legs |
| `obligation mutate <ref> --id PROOF-<n> [--fault-set <name>]` | reviewer | an event | a mutation in a copy of the tree |
| `change current` | any | nothing | the resolved change |
| `change classify <ref> [--confirm <flags>] [--remove <flag> --reason <text>]` | the tool proposes, the PM confirms | the contract, section 7 | the flags, the kind, the shape and the tripwire |
| `change cost <ref> [--phase <PH->] [--by role\|phase\|gate]` | any | nothing | the cost per role, phase and gate |
| `change repair <ref> --file <path>` | a person or an agent | that file | the repair path, from a failing lint |
| `change migrate <ref> [--dry-run]` | PM | the contract, open items | moves a change in flight; never drops content |
| `context bundle`, `context get` | any | nothing | the only read path for agents (`05-context-bundles.md`) |
| `workflow next`, `workflow status` | PM | nothing | the gated state machine (`12-deterministic-core.md`) |
| `phase`, `commit`, `verify` | as today | state | unchanged |

Every command is `jaiship <command>`. The change is resolved from the worktree registry;
`--change <ref>` serves CI, the main checkout and a cross-change operation. One lane, one
change. Every write carries `--role`, `--expect-revision` and `--idempotency-key`. An agent
reads with `context bundle --for <role> [--phase <PH->] [--step <PH-nn_Snn>] [--findings
RFIND-...]` and fetches one section on demand with `context get --section <id>`.

## The contract family

- Seven sections, seven values of `--section`: `goal`, `criteria`, `facts`, `decisions`,
  `oracle`, `work`, `flags`.
- An option is for one field and a form is for many. A form is a view generated from the
  schema, prefilled, carrying the revision it is based on. It is edited in a scratch location,
  never in the change folder.
- An identifier is minted only by a write to the contract. `contract add` takes the `--id`
  the author names, when it is free and registered, and otherwise allocates the next number.
- The oracle is the author's. From another role the write is refused with
  `change.role.forbidden` and recorded as a finding of the category `contract`.

## Steps and handovers

- `step done` records who completed the step, when, and with what evidence (a reference). A
  reopened step keeps its identifier.
- At the last step of a phase the handover is the argument of `step done`: the coder edits the
  draft from `handover draft` in a scratch location and passes it with `--handover`. The
  handover and the event land in one transaction.

## Checks, findings and proofs

- `preflight`: every cited path, anchor and version exists; every cited command runs once,
  under the command policy, and is checked for a pattern that matches itself; every changed
  literal is searched across the repository, its tests, its CI and its documentation; every
  named gate exists; every criterion has an oracle entry; every check in a typed block of the
  ticket has an obligation. Exit 1 on a miss.
- `review finding add` takes `--category`, `--materiality`, `--path`, `--round` and
  `--summary`, plus `--non-material-reason` when the category is design, contract, security or
  data and the finding is not material. The tool allocates `RFIND-`.
- `review rounds allowed` prints the reader, the rounds run and whether each was substantial,
  whether the change is large, the ceiling, and `allowed` with the rule that decided. `--allow`
  records a ceiling raised by the PM or the CEO. The rule is in
  `15-classification-and-rounds.md`, part 6.
- `obligation run --leg base --scope acceptance` runs the acceptance obligations once per
  change, on the merge-base tree taken by digest with the change's test files added. Only a
  failed assertion is a red. `--leg candidate` runs the required obligations on the merge
  candidate; a result is `STALE` when the candidate, the obligation or its watchlist changes.
- `obligation mutate` copies the tree, applies a fault set, runs the obligation and records the
  result. The reviewer requests it and reads the result; the source stays read-only.

## The change as a unit

- `change classify` prints the proposal: the flags from the paths matched against the surface
  map read from the merge base, the kind, the shape and the tripwire. `--confirm` writes
  section 7. `--remove` records a proposal the PM removed, and is refused without a reason.
  When the contract is validated, at review and before merge the tool computes the flags again:
  a new flag is a recorded change the PM confirms, and a path on a surface the contract does
  not flag escalates automatically.
- `change cost` prints, per role and per phase, the sessions, the tokens and the minutes, and
  per gate the rounds and the findings by category and materiality. It reads the host-local
  store live, and it answers for a change after its merge.
- `change repair` is accepted only on a file that `lint change` rejects, and only if the
  repaired file passes. It commits with a `Repaired-By` trailer and records the session and the
  role. The metric is the tool-written share of artifact changes, 95 percent or more after the
  pilot.
- `change migrate` reads the files a change in flight carries and writes the contract and the
  open items in one commit. Content with no slot is named, and the migration refuses
  (`change.migrate.loss`). `--dry-run` prints the mapping. The earlier files stay until the
  change lands.

## The write transaction

Every write runs the same steps, in order:

1. Resolve the change, and check one lane, one change.
2. Take the per-change lock. A lock not taken in bounded attempts is `change.lock.busy`.
3. Check the idempotency key. A key already applied to this change returns the recorded result
   and writes nothing.
4. Compare the file with its committed version. A difference is a hand edit: refuse with
   `change.file.diverges`.
5. Check the expected revision. Anything else is `change.revision.stale`.
6. Check the role. A command the role may not run is `change.role.forbidden`.
7. Validate against the schema, the references, the command policy and the secret scan. A
   refusal writes nothing.
8. Emit the canonical bytes. Write them to a temporary file in the same directory and rename
   it over the target.
9. Append the event. When a gating append fails, restore the file and fail the command.
10. Stage the written files only: the artifact file and, when an event was appended, the event
    log. Compare the staged blob with what was written. Commit with the trailer.
11. Release the lock and report the commit, the revision and the lint result.

`--dry-run` prints the diff and the message. Every write commits: the tool commits on the
branch are the audit trail, the integration branch receives one squash commit per change, and
code never shares a commit with an artifact.

## Provenance

The tool derives the subject and the body of an artifact commit without a model call
(`12-deterministic-core.md`). The trailers are:

```text
Jaiship-Tool: contract add@0.1.0
Change-Ref: GH-77
Artifact-Revision: 4
Session: 018G2E7635NQKQA268RYJJDZ43
Role: pm
Idempotency-Key: ef0c971b-be32-4cf8-8900-3801bca0168c
```

A repair carries `Repaired-By` instead of `Role`.

| The trailer proves | The trailer does not prove |
|---|---|
| Attribution by convention: the blob equals the canonical emission of the parsed file, the commit of the write is in the event log, and the declared session and role can be compared with the lane's session report | Identity. Every lane agent calls the same CLI as the same operating-system user, so the role is a claim and the trailer is a string an agent could write |
| That a hand edit did not ride into a tool commit: a file that differs from its committed version is refused, and only the written files are staged | That the content is right. The lint and the readers judge it |
| That a repair was a repair: it starts from a file the lint rejects | Tamper evidence. A signature is optional; signing the merge commit is the owner's choice (Q16) |

CI fails a commit that touches a stored file, a file carrying `generatedBy`, without the
trailer (`change.provenance.missing`). Memory candidates, which agents write, are out of its
scope. On one host with one operating-system user these rules raise the bar and make a bypass
visible: a commit without an event, a role without a session, a blob that is not the canonical
emission. They do not make it impossible.

## The command policy

The tool runs a command that a contract or a ticket cites only under this policy. The
preflight, `obligation run` and `obligation mutate` run under it.

1. **Allowlist.** The argument vector must match a prefix on the repository's allowlist.
2. **No shell.** The command is an argument vector. The tool never hands it to a shell, so
   there is no pipe, redirection or substitution.
3. **Working directory.** `cwd` is resolved and must lie inside the worktree.
4. **Environment.** A minimal environment without credentials: no tracker token, no git
   credential, no secret from the host.
5. **Ticket hints.** A command whose origin is the tracker must name a known gate or an
   existing test path. It is never a free argument vector.
6. **Origin.** Every command carries it: `tracker`, `author` or `tool`.
7. **Shown to the reviewer.** Every command the tool runs, with its origin and its result, is
   in the reviewer's bundle.

A command that fails the policy is refused with `change.command.not-allowed`, and nothing runs.
An allowlist is declared per repository, in `.jaiship/config.yaml`; everything else is refused:

```yaml
commandPolicy:
  allow:
    - [pnpm, test]
    - [pnpm, typecheck]
    - [node, bin/export.js]
    - [git, grep]
```

## The error model

- Exit 0: the command completed and returned its declared verdict. Warnings may be present.
- Exit 1: refused, invalid, or a negative verdict. Nothing was written.
- Exit 2: a platform, state or provider failure prevented the operation. The file is unchanged.

The JSON envelope carries `code`, `detail`, `path` and `field`, and what applies of `expected`,
`actual`, `command`, `origin` and `retryable`:

```json
{
  "code": "change.command.not-allowed",
  "detail": "The command is not on the allowlist of this repository.",
  "path": "oracle.obligations[2].command",
  "field": "argv",
  "command": ["curl", "-s", "https://example.invalid/status"],
  "origin": "tracker"
}
```

Step 7 of the transaction raises the lint's codes too; their table is in `03-schemas.md`. The
transaction and the other commands add:

| Code | Meaning |
|---|---|
| `change.revision.stale` | the expected revision is not the file's revision |
| `change.lock.busy` | another write holds the change; retryable |
| `change.file.diverges` | the file differs from its committed version: a hand edit, which goes through `change repair` |
| `change.role.forbidden` | the role may not run this command |
| `change.resolve.ambiguous` | two candidates for the current change; the command never guesses |
| `change.branch.behind` | the branch is behind its base; the PM syncs first. A write never rewrites history |
| `change.file.legacy` | a write to a file a change in flight carries |
| `change.migrate.loss` | the migration would drop content; it names what has no slot |

## What agents may and may not do

May: read through `context bundle` and `context get`; write through the typed commands of
their role; run `lint change`, `preflight` and the gates.

May not: edit or write a stored file; run `git add` or `git commit` for one; read a whole
artifact when a bundle exists; run a command outside the policy through the tool; write the
oracle unless they are the author.

The envelope never contains the change folder or an artifact path. `context get --raw` is for
debugging. Reads are behavior, not a security boundary; a deny on writes is added if the pilot
shows accidental edits.

## Examples

One neutral change: `GH-77`, a `--json` output for an export command. Every write carries
`--expect-revision` and `--idempotency-key`; the examples show them on the first only.

```bash
# A criterion and its obligation. AC-1 and PROOF-1 are minted by these two writes.
jaiship contract add GH-77 --section criteria --role pm --form example --id AC-1 \
  --statement "Given a finished export, when --json is passed, stdout is one JSON document that parses." \
  --expect-revision 3 --idempotency-key ef0c971b-be32-4cf8-8900-3801bca0168c
jaiship contract add GH-77 --section oracle --role pm --id PROOF-1 --criterion AC-1 \
  --claim "The JSON branch produces a document a script can parse." \
  --observable "The stdout of export --json, captured as one string." \
  --predicate "The string parses as one JSON object whose jobs array is not empty." \
  --method test --test TC-EXPORT-001 --boundary "Not a failed export." \
  --baseline red --required-for-merge
```

```bash
# Progress, a finding, and whether another round is earned.
jaiship step done GH-77 PH-01_S01 --role coder
jaiship review finding add GH-77 --role reviewer --round 1 --category coverage \
  --materiality material --path tests/cli/export-json.test.ts --cites PROOF-1 \
  --summary "The test stays green with the JSON branch removed."
jaiship review rounds allowed GH-77
```

```bash
# The two legs, then a mutation the reviewer asks for.
jaiship obligation run GH-77 --leg base --scope acceptance
jaiship obligation run GH-77 --leg candidate
jaiship obligation mutate GH-77 --id PROOF-1 --role reviewer
```
