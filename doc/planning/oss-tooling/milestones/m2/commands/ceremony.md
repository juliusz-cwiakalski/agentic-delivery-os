# `ceremony` command contract

Status: Delivered (M2-S3)

The `ceremony` family runs declared, deterministic, artifact-verified units of
recurring work. A ceremony is declaration data on the closed
`delivery.ceremony.declarations.v1` contract; no per-ceremony code path exists.
The family has exactly four verbs: `list`, `run`, `resume`, and `catch-up`.

## Grammar

```
<binary> ceremony list [--json] [--verbose] [--pretty]
<binary> ceremony run <name> [--note <path>] [--window <start>..<end>] [--apply]
<binary> ceremony resume <runId> [--apply]
<binary> ceremony catch-up [--name <name>]
```

Flags the declaration does not use are accepted and inert. A declaration is
declared in the project-committed slot `<configDirectoryName>/ceremonies.yaml`;
absence means the six built-ins only.

## Verbs

| Verb | Behaviour | Exit |
|---|---|---|
| `list` | Lists every declared ceremony with id, origin (`built-in`/`project`), tier applicability, declared trigger, declared catch-up mode, and last-run summary. | `0` |
| `run <name>` | Runs one declaration: note intake when required, ordered agenda, per-step slot write and read-back verification, compaction at declared boundaries, durable run/step records, rendered artifact. | `0` verified or dry-run; `1` refusal or `unverified`; `2` state/platform failure |
| `resume <runId>` | Continues at the first unverified step and never re-executes a verified step; a contradicted record sequence is `state.store.torn` at exit `2` with zero writes. | as `run` |
| `catch-up [--name <name>]` | Evaluates each eligible declaration's schedule against recorded runs and replays at most one missed window per ceremony. An occupied identity is satisfied, never replayed. | `0` clean or declared gap; `1` an `unverified` replay; `2` state/platform failure |

## Options

| Option | Meaning |
|---|---|
| `--note <path>` | The ceremony note document; required by note-consuming declarations. |
| `--window <start>..<end>` | The run window; required by a note-less event-triggered declaration and refused before any read or write when omitted. |
| `--apply` | Lands a `sync` step's declared write set. Dry-run is the default; the flag is inert on a declaration with no `sync` step. |
| `--name <name>` | Limits `catch-up` to one declared ceremony. |
| `--json` | Emits exactly one `delivery.result.v1` envelope; every ceremony field is under `data`. |
| `--help` | Renders this page's grammar at exit `0`. |
| `--version` | Renders the build identity at exit `0`. |

## Declarations and vocabularies

The declaration contract fixes the member set, the closed step kinds
(`collect`, `fold`, `render`, `assess`, `sync`, `record`), output slots
(`memory`, `ceremony-artifact`, `state-record`, `mirror-target`), verification
modes (`artifact-conforms`, `artifact-covers-items`, `artifact-equals-source`),
trigger events, cadences, catch-up modes, scope-key derivations (`literal`,
`repository`, `note`), and the bounds (16 ceremonies per document, 12 phases,
32 steps, 16 inputs, 8 targets, 1 MiB, id ≤ 64, at most one `schedule` trigger).
A declaration cannot carry executable content, a model reference, or a
free-form instruction.

## Built-ins and project declarations

The six built-ins are `morning-brief`, `retro-evidence-pass`,
`sprint-rollover`, `night-watch`, `testing-session-assessment`, and
`decision-record-mirror-sync`. Each is a declaration on the same contract and
executes through the same runner. A project declares its own ceremonies in one
committed document; a valid project declaration registers with origin `project`
and runs with zero tooling change. An unparseable document refuses
`config.file.malformed`; a defective entry or a built-in collision refuses
`ceremony.declaration.invalid` naming the id and field, with zero partial
registration.

## Tiered intake and measurement

The tier engine consumes exactly the delivered plan `tier` declaration and the
delivered pm-notes `variant` phase sets. The recorded variant governs a
disagreement (a `tier-mismatch` finding); plan phase ids narrow within the
canonical eleven (`unresolved-phase` for a non-canonical id); the five
escalation triggers are evidence-gated; an unknown declared trigger is reported
verbatim as `unevaluated`. An explicit `ceremony run` is always allowed.

Every executed step carries a duration, so run duration and per-phase duration
are folds over the records. This change records one honest
`MET-CEREMONY-SHARE` comparison; below five post-boundary changes the verdict is
`insufficient-sample` and no trend is claimed.

## Boundaries

No scheduler, no daemon, no cron/systemd unit, no ceremony pack, no action
registry, no metrics or board surface, no new event topic, and no MCP tool.
`ceremony` records data; the metric presentation belongs to its own story, and
filing, aging, and closure of actions are the `retro action` group in the retro
command family ([retro.md](retro.md)). The retro ceremony reads the registry's
recorded actions through the composed follow-through producer.

## See also

- [feature-ceremony-runner.md](../../../../spec/features/feature-ceremony-runner.md)
- [feature-state-layer.md](../../../../spec/features/feature-state-layer.md)
- [feature-result-contract.md](../../../../spec/features/feature-result-contract.md)
