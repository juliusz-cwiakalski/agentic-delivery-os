---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/guides/ceremony-runner.md
ados_distribution: redistributable
id: GUIDE-CEREMONY-RUNNER
status: Current
created: 2026-11-16
owners: ["engineering"]
summary: "Operator guide to the ceremony runner: the four verbs, the declaration document and its closed vocabularies, a worked project declaration, notes and windows, dry-run and --apply, catch-up, the tier mapping, artifact homes, and the measurement record."
links:
  related_changes: ["GH-296", "GH-287", "GH-299"]
---

# Ceremony Runner Guide

A ceremony is a declared, deterministic, artifact-verified unit of recurring work — a morning brief, a retro evidence pass, a sprint rollover, a night watch, a testing-session assessment, a decision-record mirror sync, or a ritual your project declares for itself. The `ceremony` family runs them: `list`, `run`, `resume`, and `catch-up`. Every step's completion is proven by reading its artifact back and validating it; nothing is "done because it was reported done".

This guide is for the operator who runs ceremonies, writes a project declaration, or reads ceremony records. The contract of record is [Ceremony Runner](../spec/features/feature-ceremony-runner.md).

## Before you start

- Ceremonies write into the delivery state directory of the invoking project, and read one declaration document from the project-committed configuration slot: `<configDirectoryName>/ceremonies.yaml`, where `<configDirectoryName>` is your brand's configuration directory (for example `.jaiship`).
- No declaration document means the six built-ins and nothing else. Creating the document is how a project adds its own ceremony; it is the only input, and no code change is involved.
- State scope follows the delivered per-project policy: an invocation inside a work tree uses that project's state root; an invocation outside any work tree uses the declared `unbound` scope with one bounded warning.

## The four verbs

```
<binary> ceremony list [--json] [--verbose] [--pretty]
<binary> ceremony run <name> [--note <path>] [--window <start>..<end>] [--apply]
<binary> ceremony resume <runId> [--apply]
<binary> ceremony catch-up [--name <name>]
```

| Verb | What it does | Exit |
|---|---|---|
| `list` | Every registered ceremony with its id, origin (`built-in`/`project`), tiers, declared triggers, catch-up mode, a per-ceremony `obligated` flag when the checkout's tier verdict resolves, and the last recorded run's verdict when one exists. | `0` |
| `run <name>` | One run: intake, the declared agenda in declared order, per-step artifact verification, phase-boundary compaction, durable records, the rendered artifact. | `0` for `verified` or `dry-run`; `1` for a refusal or `unverified`; `2` for a state/platform failure |
| `resume <runId>` | Continue an interrupted run at its first unverified step. A run that is already complete returns its recorded verdict with `reused: true` and appends nothing. | as `run` |
| `catch-up [--name <name>]` | Evaluate every scheduled declaration against recorded runs and replay at most one missed window per ceremony. | `0` for `nothing-missed`, `caught-up`, or `declared-gap`; `1` when a replay is `unverified`; `2` for a state/platform failure |

Examples:

```
<binary> ceremony list
<binary> ceremony run morning-brief
<binary> ceremony run night-watch --json
<binary> ceremony run retro-evidence-pass --note ./retro-window-2026-11-16.yaml
<binary> ceremony resume 6d0f3c1a-...
<binary> ceremony catch-up
<binary> ceremony catch-up --name morning-brief
```

Grammar and flag rules:

- The grammar is decided from argv before anything is read: a missing verb, an unknown verb, an unexpected positional, an unknown flag, or a missing flag value is refused as `fallback.invocation` at exit `1`.
- `--window` takes exactly `<start>..<end>`; a malformed pair or `start > end` is refused as `input.value.rejected` naming `--window`.
- A flag the declaration does not use is accepted and inert, so one invocation shape serves every ceremony. `--apply` on a ceremony with no `sync` step changes nothing.
- An undeclared name is refused as `input.value.rejected` naming the requested name and the declared set. No run record, step record, or artifact is produced.
- `--json` emits one `delivery.result.v1` envelope and every ceremony field lives under `data`.

## Declaring a ceremony

A project's ceremonies live in one committed document:

```yaml
schemaVersion: delivery.ceremony.declarations.v1
ceremonies:
  - id: project-daily-audit
    title: Project daily audit
    tiers: [full, lite]
    triggers:
      - kind: schedule
        cadence: daily
        at: "05:30"
    inputs:
      - source: audit-ledger
      - source: queue-state
        window: true
    agenda:
      - id: collect
        steps:
          - kind: collect
            inputs: [audit-ledger, queue-state]
            outputs:
              - slot: ceremony-artifact
                schema: delivery.ceremony.audit.v1
            verify: artifact-conforms
      - id: record
        steps:
          - kind: record
            outputs:
              - slot: state-record
                schema: delivery.ceremony.audit-record.v1
            verify: artifact-conforms
    scopeKey:
      kind: repository
    catchUp:
      mode: once
      maxMissedWindows: 1
    compaction:
      atPhases: [0]
      maxBytes: 4096
      maxLines: 40
```

With that document committed, `ceremony list` shows `project-daily-audit` with origin `project`, and `ceremony run project-daily-audit` executes it through the same runner, the same verifiers, and the same records as a built-in. No flag, build step, or code change is involved.

A document that cannot be parsed or exceeds 1 MiB is refused as `config.file.malformed` at exit `1` before any run, naming the path. A document with a defective entry is refused as `ceremony.declaration.invalid` naming the ceremony id and the field. Registration is all-or-nothing: nothing partial is registered, and the built-ins stay effective. An entry whose id collides with a built-in is refused, so a project adds ceremonies but never redefines one. An empty `ceremonies: []` behaves exactly like an absent document.

### Declaration members

| Member | Rule |
|---|---|
| `id` | `^[a-z][a-z0-9-]*$`, at most 64 characters, unique across built-ins and project declarations |
| `title` | Non-empty one-line title |
| `tiers` | Non-empty subset of `full`, `lite` |
| `triggers[]` | 1..8 triggers; at most one `schedule` |
| `inputs[]` | 0..16 GET-only inputs from the closed source list; optional boolean `window` |
| `agenda[]` | 1..12 phases, 1..32 steps in total; every step needs outputs and a verification mode; at most 8 `mirror-target` outputs |
| `scopeKey` | Required: `literal`, `repository`, or `note` (a `note` derivation requires `note.required: true`) |
| `note` | Optional `{ required, schema, scopeKey: "required" }` |
| `catchUp` | `{ mode: "once"\|"none", maxMissedWindows: 1 }` |
| `compaction` | `atPhases[]` of declared phase indices, `maxBytes` ≤ 4096, `maxLines` ≤ 40 |

### Closed vocabularies

| Vocabulary | Members |
|---|---|
| Step kinds | `collect`, `fold`, `render`, `assess`, `sync`, `record` |
| Output slots | `memory`, `ceremony-artifact`, `state-record`, `mirror-target` |
| Verification modes | `artifact-conforms`, `artifact-covers-items`, `artifact-equals-source` |
| Assess verdicts | `covered`, `partial`, `uncovered`, `not-applicable` |
| Trigger events | `session-end`, `incident-severity`, `milestone-end`, `change-merged`, `owner-note`, `pre-dispatch` |
| Cadences | `daily`, `weekly`, `milestone`, `iteration` |
| Scope-key derivations | `literal`, `repository`, `note` |
| Recorded trigger kinds | `schedule`, `event`, `catch-up`, `explicit` |
| Recorded trigger resolutions | `note`, `declaration`, `unspecified` |
| Run verdicts | `verified`, `dry-run`, `unverified` |
| Retro levels | `session`, `incident`, `window`, `project` |

Every closed name a declaration uses is validated: an unknown step kind, input source, output slot, verification mode, trigger event, cadence, or tier; a missing verification mode; an output without a schema identifier; a duplicate id; a built-in collision; an unparseable schedule; an over-bound collection; a missing or illegal `scopeKey` — each is `ceremony.declaration.invalid` naming the id and field.

A declaration cannot carry executable content. Any member named `command`, `commands`, `path`, `paths`, `model`, `models`, `script`, `scripts`, `instruction`, `instructions`, `exec`, `shell`, `handler`, or `function`, at any depth, is refused. A declaration names vocabularies; it never names a command, a filesystem path, or a model. That is what keeps "a project declares its own ceremony" from becoming "a project ships code".

## Notes: the idempotency anchor

Two built-ins require a note (`retro-evidence-pass` and `testing-session-assessment`), and any declaration with `note.required: true` does too. A required note that is absent is refused as `input.value.rejected` naming the note. The note read is bounded in bytes (1 048 576, the configuration parser class's bound) and an over-bound note is refused as `ceremony.note-invalid` naming the bound; a stored note read back for a resume is re-validated against the same note contract before the agenda continues.

A note is one document supplied with `--note <path>`:

```yaml
schemaId: delivery.ceremony.note.v1
ceremony: testing-session-assessment
scopeKey: testing-session-2026-11-16
window:
  start: "2026-11-16T00:00:00.000Z"
  end: "2026-11-16T23:59:59.999Z"
trigger: owner-note
facts:
  - text: "The retry path is untested"
    evidenceRef: "evidence:session-1"
  - "The credential guard needs a negative case"
evidenceRefs:
  - "evidence:session-1"
actions:
  - "Cover the retry path with a regression test"
  - "Add a negative case for the credential guard"
body: "Owner note for the 2026-11-16 testing session."
```

The note contract:

- `schemaId` must be `delivery.ceremony.note.v1`, `ceremony` must name the ceremony being run, `scopeKey` must be non-empty, and `window` must satisfy `start` ≤ `end`.
- Each `facts` entry is a non-empty string, or an object with non-empty `text` and an optional non-empty `evidenceRef`; a malformed entry is refused as `ceremony.note-invalid` naming `facts`. An assessment item is `covered` only when its citation resolves in the delivered evidence (the note's declared `evidenceRefs` or an evidence list a present input delivered); an uncited or unresolvable item is `uncovered` with the reason named.
- `scopeKey` is the idempotency anchor. Where the declaration derives its scope key from the note, this value is the run's scope key; a note without it is refused as `ceremony.note-invalid` naming `scopeKey`, with zero output. Where the declaration derives from `literal` or `repository`, a supplied note must carry the identical key — a disagreement is refused rather than silently overridden.
- The note's `window` governs the run. A `--window` that disagrees is refused with both windows named.
- For a retro note (`level` present), the concept's fixed members are required: `participants`, `evidenceRefs`, `facts`, `interpretations`, `wins` (each with `text` and `mechanism`), `gaps`, `candidateLessons`, `actions`, `confidence`, plus `trigger` naming the level's declared trigger. An omission is `ceremony.note-invalid` naming the member.
- The retro note's declared actions are a handoff: filing, aging, and closure are the [Retro Action Registry](../spec/features/feature-retro-action-registry.md)'s `retro action` group. The retro-evidence pass reads the registry's recorded actions and assigns `applied`, `partial`, or `violated-with-consequence` from each action's verification artifact — never from the owner's status claim — and an unresolvable artifact degrades to `unverified`.
- A note naming a trigger the declaration does not declare is refused as `input.value.rejected`.

## Windows and triggers

Every run holds exactly one window and one recorded trigger.

- **A note's window governs.**
- **A note-less scheduled declaration** takes `--window` when given; otherwise the window derives from the clock at the declared cadence's UTC unit: `daily` the UTC day, `weekly` the ISO week (Monday start), `iteration` a 14-day period, `milestone` a 30-day period.
- **A note-less event-triggered declaration** has no cadence to derive from, so `--window` is required. Omitting it is `input.value.rejected` naming `--window`, before any record or artifact. `decision-record-mirror-sync` is the built-in in this class.
- **The recorded trigger** names what happened. An explicit `ceremony run` records `explicit`, with resolution `note` when the note's `trigger` names a declared trigger, `declaration` when the declaration declares exactly one, and `unspecified` when several are declared and none is named. The `explicit` kind is provenance: a manual run satisfies its window's identity like any other run, and it never impersonates a scheduled, event, or catch-up firing.

`at` (`"HH:MM"`) is declared trigger metadata on a UTC basis; it appears in the trigger label (`schedule:daily@07:00`) and does not change the derived window unit.

## Reruns, idempotency, addenda

A run's identity is `(ceremony, scopeKey, window)`.

- Running the same identity again returns the recorded verdict with `data.reused: true` and appends nothing — no second run record, no second step record, no second artifact.
- A note-consuming ceremony rerun at a **new** window is a new identity: the note body receives an addendum and the prior body is never rewritten.
- A process interrupted mid-agenda leaves its step records durable. `ceremony resume <runId>` continues at the first unverified index and never re-executes a verified step. If the recorded steps contradict the declaration — a missing middle index, an index outside the agenda, two attempts where the earlier one verified, or an unverified step with recorded later steps — the runner refuses as `state.store.torn` at exit `2` with zero writes and guesses no repair.

## Verification, dry-run, and `--apply`

Every step writes its output to its declared slot, reads it back, and validates it against its declared verification mode:

- `artifact-conforms` — the artifact exists and matches its declared schema and required shape.
- `artifact-covers-items` — every declared item carries a verdict from a closed set; an empty item set verifies only when the artifact declares `verifiedEmpty: true`.
- `artifact-equals-source` — each target's set equals its source set, with no extra and no missing member.

A failed read-back makes the step `unverified` with the reason, stops the agenda, and makes the run verdict `unverified` at exit `1`. The run record, the step records, and the artifact that was produced stay durable so the failure is inspectable.

A `sync` step is dry-run by default: it computes the declared write set, checks the target preconditions, and lands nothing. `--apply` is the only way a declared effect lands; the verdict is then `verified` rather than `dry-run`. A target that is absent, dirty, off its declared base, or drifted reports its reason and the step is `unverified`; there is no force path and no write to a repository the declaration does not name.

> **Composed landing.** The shipped mirror sync resolves its target set from the invoking checkout's own operator-local, git-ignored `projects.yaml` members (`repoKey`, minus the invoking repository; `root` names the local checkout; an absent or empty document is the declared empty target set, and no target checkout's document is read) and its source set from the invoking repository's `doc/decisions/` register. A dry run is `dry-run` at exit `0` even against fresh targets — the computed write set is the report. With `--apply`, each declared target checkout receives the register's record files byte for byte; a target that still differs in either direction afterwards leaves the run `unverified` naming the target. The records land as files; the target checkout's own mirror commit is composed by the delivery flow there, never by the ceremony.

## Artifact homes

| Slot | Where it lands |
|---|---|
| `ceremony-artifact` | The project's ceremony artifact directory under the state directory: one JSON file per writing step, named `<runId>.s<index>.json`, mode `0600`, retained forever, outside the ledger. Two steps never overwrite one another; a re-attempt replaces its own step's file. |
| `state-record` | The delivery ledger itself: the step's validated record document lands as the ceremony record its slot declares, and the step record's artifact reference names the ledger record. No artifact file is written for this slot. |
| `mirror-target` | A JSON file in the same family, named `<runId>.mirror-target.<digest>.json`, recording each target's plan and equality; the landing goes to the declared target checkout's decisions directory. |
| `memory` | The committed memory tree under `.ai/memory/ceremony/`, one file per scope key; a rerun appends an addendum after a newline. |

Each artifact carries its schema identifier, and an artifact that cannot be read back fails its step's verification. Because the `ceremony-artifact` file name carries the writing step's index, per-step artifacts in that slot are retained individually.

The durable ledger records are `ceremony.run` (one per run identity: ceremony, run id, origin, declaration digest, trigger provenance, scope key and derivation, tier facts, start time, phase count) and `ceremony.step` (one per attempt: index, phase, kind, outcome, start, end, duration, slot, artifact reference, verification verdict, optional reason). Run status, run duration, and per-phase durations are folds over those records; there is no separate run document to disagree with them.

## Catch-up

`ceremony catch-up` answers "did a scheduled ceremony miss a window, and can it still run?" — as a pure function of the declarations, the clock, and the recorded runs.

- The missed windows are the windows due before the current window whose `(ceremony, scopeKey, window)` identity no recorded run occupies. The look-back is bounded: 7 daily windows, 4 weekly, 2 iteration, 2 milestone.
- At most **one** missed window is replayed per ceremony per invocation, oldest first, labelled `catch-up` in the record with the missed window as the identity, the execution window beside it, and the declaration's own origin (`built-in`/`project`). It reads current inputs; nothing is back-dated or fabricated.
- A window already covered by a run — including a manual `ceremony run` — is satisfied: it is not replayed, it leaves no outstanding obligation, and the single replay slot stays available for a different missed window. A second catch-up for a replayed window appends nothing.
- A declaration with `catchUp.mode: "none"` reports its missed window as a declared gap with its bounds and runs nothing.
- A note-derived declaration (`retro-evidence-pass`, and project note ceremonies) and an event-triggered declaration are reported as declared gaps in catch-up, because catch-up supplies no note and an event trigger has no due window.
- A ceremony whose declaration was removed is reported as a declared gap while its run history stays readable.
- The report outcome is `unverified`, else `caught-up`, else `declared-gap`, else `nothing-missed`. Each ceremony carries a disposition (`current`, `satisfied`, `caught-up`, `still-missed`, `declared-gap`, `unverified`), its missed and satisfied windows, and the run id when a replay executed.
- Catch-up never lands a `sync` effect; it runs with `apply: false` and has no `--apply` flag.

## Tiered intake and the tier mapping

Two declarations already exist in a change, and the ceremony layer maps them once, with no third vocabulary:

| Source | What it supplies |
|---|---|
| Plan `tier` (`chg-<ref>-plan.yaml`) | Declared intent: `name` (`full`\|`lite`), optional integer `phases`, optional `escalationTriggers` |
| pm-notes `variant` | Recorded lifecycle truth: `full`\|`lite` (absent means `full`), with the pinned per-variant required phase sets |

The mapping:

| Effective tier | Phase set | Source |
|---|---|---|
| `full` | the eleven canonical phases | `PM_NOTES_REQUIRED_PHASES_BY_VARIANT.full` |
| `lite` | `clarify_scope`, `specification`, `delivery`, `quality_gates`, `dod_check`, `pr_creation` | `PM_NOTES_REQUIRED_PHASES_BY_VARIANT.lite` |

- **The recorded variant governs.** If the plan says `full` and pm-notes records `lite` (or the reverse), the variant's set is effective and the verdict reports a `tier-mismatch` finding naming both. Delivery is never blocked and neither document is rewritten.
- **Plan `phases` narrow.** Declared integer phase numbers resolve against the canonical eleven; resolved ids narrow the set, and an id that does not resolve is reported as `unresolved-phase` and not applied.
- **Escalations are evidence-gated.** Only `phase-reopen`, `dor-rework`, `review-rework`, `gate-failure`, and `owner-escalation` are evaluated against recorded evidence; a match escalates the effective tier to `full` and records the trigger with its evidence. A trigger string outside that vocabulary is reported verbatim as `unevaluated` — never silently false, never dropped.
- **The lever.** `lite` omits exactly `test_planning`, `delivery_planning`, and `dor_check`, three of the seven phases `MET-CEREMONY-SHARE` counts as ceremony, so a lighter tier reduces ceremony obligation without touching work phases.

Each ceremony declaration names the `tiers` it serves, so a change's effective tier decides which ceremonies carry an obligation; an explicit `ceremony run` is always allowed regardless of obligation.

> **Composed intake.** The shipped runtime evaluates the verdict per invocation. It selects the checkout's delivery change from the recorded `phase.transition` ledger truth (the change with the newest recorded transition timestamp; ties break on the greatest ref), reads that change's committed pm-notes (`variant`, `blockers`) and plan (`tier`), and maps recorded reopens to the closed trigger facts: any reopen is `phase-reopen`; a reopen of `review_fix` is `review-rework`; of `quality_gates` is `gate-failure`; of `dor_check` is `dor-rework`; an open pm-notes blocker entry is `owner-escalation`. `ceremony list` carries the verdict as `data.tier` with a per-ceremony `obligated` flag; `ceremony run` and `catch-up` record the tier facts each run consumed, and catch-up replays only obligated ceremonies. A checkout with no recorded lifecycle history resolves no verdict, keeps the delivered default tier facts, and obligates nothing beyond the full set.

## Measurement

Ceremony time is a fold over durable records, not a self-report:

- every attempted step carries a duration and a verification verdict;
- run duration is the span from the first step start to the last step end;
- per-ceremony run count, mean, and nearest-rank p90 are derived from the same records.

The committed metric `MET-CEREMONY-SHARE` — ceremony-phase time over total lifecycle phase time, lower is better — remains the comparable measurement, and the runner's figures are a **native second basis**, disclosed as such and never substituted for the proxy. One `delivery.ceremony.comparison.v1` record is committed per delivery in the measurement log's `comparisons[]` list: the committed metric identity and definition reference, the `before` value with its window, sample size, status, and basis, the `after` value with its samples and sample size, `sampleMinimum: 5`, a closed verdict, the native basis, and a disclosure naming the sample and basis difference. Below five post-boundary changes the verdict is `insufficient-sample` and no trend is claimed. The ceremony family has no verb that computes or prints a metric: the `metrics` report is a separate read-only family that reads these records and the committed comparison as data, reports ceremony share on its native runner-fold basis, and applies the caveat on any cross-kind comparison.

## Troubleshooting

| Symptom | What it means |
|---|---|
| `fallback.invocation` at exit `1` | The grammar was wrong: verb, positional, flag, or flag value. Nothing was read. |
| `ceremony.declaration.invalid` naming `scopeKey` | The declaration omits `scopeKey`, derives from a note it does not require, or carries a malformed literal token. |
| `ceremony.declaration.invalid` naming `triggers[]` | Two schedule triggers, an unknown cadence, or an invalid `at` time. |
| `ceremony.note-invalid` naming `scopeKey` | The note omits its idempotency key, or its key disagrees with the declaration. |
| `input.value.rejected` naming `--window` | A note-less event-triggered ceremony was run without a window. |
| `config.file.malformed` | The declaration document is unreadable, unparseable, or over 1 MiB. |
| verdict `unverified` at exit `1` | A step's artifact failed its declared verification; the step records name the step and the reason. Fix the cause and `ceremony resume <runId>`, or run again at a new window. |
| `state.store.torn` at exit `2` | The recorded step sequence contradicts the declaration; the runner does not repair it. Inspect the records before acting. |
| A ceremony reports `declared-gap` in catch-up | Either `catchUp.mode: "none"`, a note-derived scope key, an event-only trigger, or a removed declaration. Inspect the reported reason. |

## Current limits

The shipped surface has known composition gaps, stated here so you do not plan around capability that is not wired: most declared collectors are not composed in the binary and arrive as declared `unavailable` degradations. The full list, with what is delivered and tested beside each gap, is in [Ceremony Runner §9: Delivered limits and known gaps](../spec/features/feature-ceremony-runner.md#9-delivered-limits-and-known-gaps).

## See also

- [Ceremony Runner](../spec/features/feature-ceremony-runner.md) — the current-truth contract.
- [`ceremony` command contract](../planning/oss-tooling/milestones/m2/commands/ceremony.md) — the reference page served by `ceremony --help`.
- [State Layer](../spec/features/feature-state-layer.md) — the ledger, boundaries, and fenced writes behind the records.
- [Retro Evidence Pipeline](../spec/features/feature-retro-pipeline.md) — the evidence plane the retro ceremony consumes.
- [Retro Action Registry](../spec/features/feature-retro-action-registry.md) — the recorded actions the retro-evidence pass verifies against their artifacts.
- [Machine-Readable Plan Schema](../spec/features/feature-plan-schema.md) — the plan `tier` declaration.
- [Measurement Baseline](../spec/features/feature-measurement-baseline.md) — `MET-CEREMONY-SHARE` and the `comparisons[]` record.
