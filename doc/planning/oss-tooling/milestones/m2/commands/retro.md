# retro(1)

Status: Delivered M2 (GH-287 extends the delivered M1-S8 family). Implemented
contract.

## NAME

`retro` - the retro evidence pipeline and the retro action registry: collect,
report, and the `action` verb group (`file`, `close`, `list`).

## SYNOPSIS

```
<binary> retro collect [--level <name>]
<binary> retro report [--level <name>] [--json]
<binary> retro action file --owner <name> --owner-kind <kind> --verb <verb>
          --outcome <text> --tracker <ref> --due <date> --artifact <ref>
          --outcome-evidence <ref> --outcome-window <start>..<end>
          --rollback <text> [--window <name>] [--level <name>] [--json]
<binary> retro action close --action <id> [--route <route>] [--plane <plane>]
          [--decision <ref>] [--artifact <ref>] [--reason <text>]
          [--successor <id>] [--evidence <ref>] [--json]
<binary> retro action list [--window <name>] [--json]
```

## DESCRIPTION

`retro collect` and `retro report` are the delivered M1-S8 evidence pipeline:
they collect evidence from the independent keyed-chain sidecar into the retro
registry and fold a report over it. Their grammar and semantics are unchanged.

The `action` verb group is the additive GH-287 surface inside the same command
family. `retro action file` validates the five-field contract (a named agent
role or human owner, a verb from add/remove/change/test/deploy, a measurable
outcome, a real tracker entry, a due date) plus the verification artifact, the
outcome verifier (a delayed metric window), and the rollback condition
all-or-nothing: a missing member or a present-but-non-conforming field is
refused with exit 1 under `retro.action-incomplete` naming the offending field,
and no action row is created. Filing dates come from the command's injected
clock.

`retro action close` records one explicit closure decision. `done` requires an
artifact and closes the artifact plane only; `deprioritized` requires a reason
and `superseded` requires a recorded successor, and each closes both planes in
that one decision, mooting the verification window by the decision and not by
time. `--plane outcome --evidence <ref>` records an explicit outcome decision
citing in-window verifier evidence. An incomplete attempt is refused under
`retro.closure-incomplete`; a decision targeting an already-closed plane is
refused under the same identity, naming the plane and its existing closure.

`retro action list` renders every recorded action with its owner, verb, level,
improvement window, age, derived aging state (`current`, `nudged` at 14 days
open since filing, `escalated` at 30 days or on a second missed due date), both
closure planes, and each window's open count and declared limit. An empty
registry is an explicit success with `actions: []`.

The improvement WIP limit is the fixed contract-data value 3: a filing into a
window at its limit is refused with exit 1 under `retro.wip-limit-exceeded`,
naming the window, its open count, and its limit, and no action row lands.
Aging is derived at read and render time; no scheduler or background write
exists.

## OPTIONS

| Option | Meaning |
|---|---|
| `--level <name>` | Retro level; declared names are `change`, `session`, `incident`, `window`, `project`, `fleet` (only `change` is implemented) |
| `--owner <name>` | Named owner: one agent role or one human (action file) |
| `--owner-kind <kind>` | `agent-role` or `human`; team-owned actions are refused |
| `--verb <verb>` | One of `add`, `remove`, `change`, `test`, `deploy` |
| `--outcome <text>` | Measurable outcome (bounded) |
| `--tracker <ref>` | Real tracker entry; a placeholder is refused |
| `--due <date>` | Due date |
| `--artifact <ref>` | Verification artifact (action file/close) |
| `--outcome-evidence <ref>` | Delayed-metric evidence (action file) |
| `--outcome-window <start>..<end>` | Verifier window (action file) |
| `--rollback <text>` | Rollback condition (action file) |
| `--window <name>` | Improvement window (action file/list) |
| `--action <id>` | Action reference (action close) |
| `--route <route>` | `done`, `deprioritized`, or `superseded` (action close) |
| `--decision <ref>` | Explicit closure decision reference (action close) |
| `--reason <text>` | Deprioritize reason (action close) |
| `--successor <id>` | Superseding action reference (action close) |
| `--evidence <ref>` | In-window verifier evidence (action close) |
| `--plane <plane>` | `artifact` (default) or `outcome` (action close) |
| `--json` | Emit the machine envelope |
| `--help` | Show command help |
| `--version` | Show the binary version |

## OUTPUT

Collect `data`: `level`, `outcome` (`collected` | `no-target`), `selection`,
`counts`, and (for a collected run) `runId` and `truth`. Report `data`: exactly
`level`, `findings[]`, `followThrough[]`, and `evidenceRefs[]`; follow-through
entries carry the recorded action, a verdict (`verified` | `unverified` |
`unknown`), an optional artifact reference, and registry provenance inside the
entry. `retro report` gains no new top-level data key.

Action `data`: `file` returns `actionId` and the recorded `action`; `close`
returns `actionId`, `route`, `plane`, `decision`, `artifactClosure`,
`outcomeClosure`, `windowState`, and the filed `verificationWindow`; `list`
returns `actions[]` (identity, owner, verb, level, window, measurable outcome,
tracker entry and corroboration state, due date, lapse count, verification
artifact, outcome verifier, rollback condition, filing instant, age, aging
state, both closure planes, and the verification-window state) plus `windows[]`
(per-window `openCount` and the declared `limit`).

## EXIT STATUS

0 filed, closed, listed, collected, reported, or an explicit `no-target`
collect; 1 a filing/closure/WIP refusal, a malformed evidence entry, a detected
chain break, a vacuous run, or an input/permission refusal; 2 an evidence or
registry store unreachable (torn store, missing key material) or a write refused
outside the collector seam.

## EXAMPLES

```
<binary> retro collect --level change
<binary> retro report --level change --json
<binary> retro action file --owner agent-role:reviewer --owner-kind agent-role \
  --verb add --outcome "the guard rejects the malformed envelope" \
  --tracker GH-287 --due 2026-11-30 --artifact artifact:tests/guard.test.ts \
  --outcome-evidence metric:rejection-rate \
  --outcome-window 2026-12-01..2026-12-15 --rollback "revert the guard" \
  --window window-2026-11
<binary> retro action close --action action-1 --route done --decision decision-42 \
  --artifact artifact:tests/guard.test.ts
<binary> retro action list --window window-2026-11
```

## SEE ALSO

- [retro-pipeline.md](retro-pipeline.md) - the evidence pipeline and report fold
- [retro-action-registry.md](retro-action-registry.md) - records, filing,
  aging, closure planes, and the WIP limit
- [../commands.md](../commands.md) - the M2 command inventory and `--help`/`--version`
