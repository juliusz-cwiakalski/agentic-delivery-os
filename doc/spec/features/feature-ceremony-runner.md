---
ados_distribution: internal
id: SPEC-CEREMONY-RUNNER
status: Current
created: 2026-11-16
last_updated: 2026-11-16
owners: ["engineering"]
service: delivery-os
summary: "The `ceremony` family and the ceremony layer: four verbs (list, run, resume, catch-up) over one declaration contract (`delivery.ceremony.declarations.v1`) with closed step, slot, verification, trigger, cadence, scope-key, recorded-trigger and verdict vocabularies plus fixed bounds; six built-in declarations (morning brief, retro evidence pass, sprint rollover, night-watch, testing-session assessment, decision-record mirror sync) executed through one runner path; deterministic intake (declaration-held scope key, note or cadence-derived window, recorded trigger provenance), artifact-verified per-step execution with read-back verification, durable `ceremony.run` and `ceremony.step` records with derived durations, phase-boundary compaction, resume from the first unverified step, and single-window catch-up with identity-based satisfaction; project declarations in one committed `<configDirectoryName>/ceremonies.yaml` document with no tooling change; the pure tier engine over the delivered plan `tier` and pm-notes `variant` phase sets with a `tier-mismatch`/`unresolved-phase`/`unevaluated-trigger` finding vocabulary; the four sub-R1 retro levels with the concept's fixed note schema and follow-through-first agenda; the ceremony artifact family; and exactly two `ceremony.*` error identities under a new `ceremony` domain kind."
links:
  related_changes: ["GH-296"]
  contracts:
    - "packages/core/src/contracts/ceremony.ts"
    - "packages/core/src/contracts/ceremony-builtins.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/state/ceremony.ts"
    - "packages/adapters/src/file/ceremony-declarations.ts"
---

# Feature: Ceremony Runner

## 1. Overview

A ceremony is a declared, deterministic, artifact-verified unit of recurring work: a title, the tiers it serves, its triggers, its GET-only inputs, an ordered agenda of phases and steps, the scope-key derivation that makes a rerun idempotent, its catch-up semantics, and the phase boundaries at which carried state is compacted. Ceremonies are data, never code: each declaration uses only closed vocabularies, and the same runner executes every declaration, built-in or project-declared.

The shipped `ceremony` family has exactly four verbs — `list`, `run`, `resume`, and `catch-up`. `run` resolves the run identity `(ceremony, scopeKey, window)` from the declaration (and the note, where the declaration requires one), appends one `ceremony.run` record, executes the agenda in declared order, writes every step's output to its declared slot, reads it back, validates it against the step's declared verification mode, and appends one `ceremony.step` record per attempt. The run verdict is a fold over the step records: `verified`, `dry-run`, or `unverified`. `resume` continues at the first unverified index and returns the recorded verdict without appending when nothing remains. `catch-up` evaluates each scheduled declaration against recorded runs as a pure function and replays at most one missed window per ceremony per invocation, labelled `catch-up`.

Six built-in declarations ship as contract data: `morning-brief`, `retro-evidence-pass`, `sprint-rollover`, `night-watch`, `testing-session-assessment`, and `decision-record-mirror-sync`. A project adds its own ceremonies by committing one declaration document in the project-committed configuration slot; a valid entry registers with origin `project` and runs through the same steps, verifiers, records, and artifact slots. No new verb, flag, build step, or code path is involved.

A separate pure tier engine answers which lifecycle phases a change's declared tier obligates: it consumes the delivered plan `tier` declaration and the delivered pm-notes `variant` phase sets, maps them once, and reports disagreement, unresolved phase ids, and unevaluable escalation triggers as findings. The runner records per-step durations, so ceremony time is computable from durable records rather than from self-reported timestamps.

The runner adds no event topic, no MCP tool, no scheduler, no model call, no metrics surface, and no completion-asserted step. It consumes the delivered state layer, result envelope, exit projection, retro evidence pipeline, plan validation, pm-notes variant sets, memory tree, and configuration slot unchanged.

## 2. Business Context

### 2.1 Problem Statement

- **Problem:** Recurring factory rituals are prose and judgement unless they are units. A ritual whose inputs, steps, rendered output, verification, and behaviour after a miss live in habit cannot be checked — that a brief was rendered, that a retro note carries a follow-through section, that an owner's testing note received a coverage verdict, or that a decision record reached an affected repository — and a missed window is indistinguishable from a quiet one. A rerun without an idempotency anchor duplicates work instead of appending an addendum, ceremony time stays a self-reported proxy, a declared tier is a label rather than a reduced obligation, and a project ritual needs bespoke code. The ceremony layer removes each of those failure modes by making the ritual a declaration executed by one deterministic runner: artifact-verified steps, a recorded run identity, bounded catch-up, the plan tier and pm-notes variant consumed as one mapping, and durable per-step durations.
- **Affected Users:** Coordinators and owners running the recurring rituals, agents that invoke a ceremony instead of improvising one, reviewers who need a run's evidence, auditors reading the durable records, and the later metric and action-registry surfaces that consume these records.
- **Business Impact:** A declared, artifact-verified, idempotent, resumable and measurable ceremony unit is the precondition for moving ceremony share at all: `MET-CEREMONY-SHARE` is a `PARTIAL` proxy with no engine able to move it until a ceremony is a declared unit with recorded durations.

### 2.2 Goals

- Make a ceremony a declaration with closed vocabularies, fixed bounds, and no executable content.
- Execute every declaration through one deterministic, artifact-verified runner that resumes and compacts.
- Detect and replay one missed scheduled window exactly once, and distinguish nothing-missed from a declared gap.
- Let a project declare ceremonies in one committed document and run them with zero tooling change.
- Consume the delivered plan tier and pm-notes variant with exactly one mapping and no second phase-set vocabulary.
- Make ceremony time computable from durable records and record one honest `MET-CEREMONY-SHARE` comparison.
- Serve the four sub-R1 retro levels over the delivered retro evidence pipeline without re-implementing it.

### 2.3 Non-Goals

- No metrics presentation, aggregate report, alarm, or threshold (the `metrics` surface is M2-S6); the runner records data and one committed comparison.
- No retro action registry: filing, artifact/outcome closure, aging, and the action board are M2-S10; the retro ceremony records a declared-actions handoff.
- No ceremony packs, no pack registry, no signed bundle, no cross-repository ceremony coordination.
- No scheduler: no daemon integration, cron/systemd unit, timer, unattended cadence, sleep, or child process. The runner evaluates schedules and offers `catch-up`.
- No new event topic or event kind; no MCP tool; no board/status/brief ceremony surface.
- No change to the retro pipeline's collection grammar, evidence plane, truth checks, or level-registry status, and no change to the closeout transaction (including its change-level R1 retro).
- No model, agent, or network call in any step, fold, render, verification, or tier path.

## 3. User Experience & Functionality

### 3.1 Command family

```
<binary> ceremony list [--json] [--verbose] [--pretty]
<binary> ceremony run <name> [--note <path>] [--window <start>..<end>] [--apply]
<binary> ceremony resume <runId> [--apply]
<binary> ceremony catch-up [--name <name>]
```

| Verb | Behaviour | Exit |
|---|---|---|
| `list` | Lists every registered ceremony — built-in first, then project — with `id`, `origin` (`built-in`\|`project`), declared `tiers`, declared trigger labels, declared catch-up mode, and a `lastRun` summary (`runId`, folded `verdict`, `startedAtMs`) when a run is recorded. | `0` |
| `run <name>` | Resolves the declaration, the note (when required), the scope key, the window and the recorded trigger; reuses a recorded run identity; otherwise appends the run record, executes the agenda, and renders the run data. | `0` for `verified`/`dry-run`; `1` for a refusal or `unverified`; `2` for a state/platform failure |
| `resume <runId>` | Reads the run and its step records, refuses a contradicted sequence as `state.store.torn`, executes from the first unverified index, and returns the recorded verdict with `reused: true` when the run is already complete. | as `run` |
| `catch-up [--name <name>]` | Evaluates every eligible scheduled declaration against recorded runs and replays at most one missed window per ceremony. | `0` for `nothing-missed`, `caught-up`, or `declared-gap`; `1` when a replay is `unverified`; `2` on a state/platform failure |

Grammar rules:

- The grammar is decided from argv before any read: a missing verb, an unknown verb, an unexpected positional (other than the single `run` name or `resume` run id), an unknown flag, or a missing flag value is refused as `fallback.invocation` at exit `1` with no declaration, input, or state read.
- `--window` parses `<start>..<end>`; a malformed pair, a missing side, or `start > end` is refused as `input.value.rejected` naming `--window` before any run.
- A flag the declaration does not use is accepted and inert, so one invocation shape serves every ceremony: `--apply` on a declaration with no `sync` step produces the same verdict and the same artifacts as a run without it.
- An undeclared ceremony name is refused as `input.value.rejected` naming the requested name and the declared set, with zero records and zero artifacts.
- `--name` on `catch-up` restricts the invocation to one declared ceremony; an undeclared name is refused the same way.

### 3.2 The declaration contract

One declaration carries exactly these members, and the document wraps them:

| Member | Contract |
|---|---|
| Document | `schemaVersion` must equal `delivery.ceremony.declarations.v1`; `ceremonies[]` holds 1..16 declarations with unique ids. |
| `id` | `^[a-z][a-z0-9-]*$`, at most 64 characters, unique across built-ins and project declarations. |
| `title` | Non-empty one-line title. |
| `tiers` | Non-empty subset of `PLAN_KNOWN_TIERS` (`full`\|`lite`); no other tier name is valid. |
| `triggers[]` | 1..8 declared triggers: `{ kind: "schedule", cadence: "daily"\|"weekly"\|"milestone"\|"iteration", at?: "<HH:MM>" }` on a UTC basis, or `{ kind: "event", event }` from `session-end`, `incident-severity`, `milestone-end`, `change-merged`, `owner-note`, `pre-dispatch`. At most one schedule trigger per declaration. |
| `inputs[]` | 0..16 GET-only inputs, each naming one closed input source with an optional boolean `window`; the closed vocabulary is the declaration's whole read surface. |
| `agenda[]` | 1..12 phases, each with a non-empty `id` and 1..n steps; at most 32 steps per declaration. A step carries a closed `kind`, optional `inputs`, at least one `output` (`slot` from the closed set plus a schema identifier), and a required `verify` mode. At most 8 `mirror-target` outputs per declaration. |
| `scopeKey` | Required: `{ kind: "literal", value }` (kebab-case token), `{ kind: "repository" }`, or `{ kind: "note" }`. A `note` derivation is legal only when `note.required` is `true`. |
| `note` | Optional `{ required: boolean, schema, scopeKey: "required" }`. |
| `catchUp` | `{ mode: "once"\|"none", maxMissedWindows: 1 }`. |
| `compaction` | `atPhases[]` (declared phase indices), `maxBytes` ≤ 4 096, `maxLines` ≤ 40. |

Closed vocabularies:

| Vocabulary | Members |
|---|---|
| Step kinds | `collect`, `fold`, `render`, `assess`, `sync`, `record` |
| Output slots | `memory`, `ceremony-artifact`, `state-record`, `mirror-target` |
| Verification modes | `artifact-conforms`, `artifact-covers-items`, `artifact-equals-source` |
| Assess verdicts | `covered`, `partial`, `uncovered`, `not-applicable` |
| Run verdicts | `verified`, `dry-run`, `unverified` |
| Recorded trigger kinds | `schedule`, `event`, `catch-up`, `explicit` |
| Recorded trigger resolutions | `note`, `declaration`, `unspecified` |
| Retro levels | `session`, `incident`, `window`, `project` |
| Carry-over reasons | `blocked-dependency`, `unfinished-scope`, `awaiting-review`, `owner-gate`, `carried-by-owner` |
| Follow-through verdicts | `applied`, `partial`, `violated-with-consequence` |
| Check states (night-watch) | `clean`, `anomaly`, `unavailable` |
| Escalation triggers | `phase-reopen`, `dor-rework`, `review-rework`, `gate-failure`, `owner-escalation` |
| Tier findings | `tier-mismatch`, `unresolved-phase`, `unevaluated-trigger` |
| Comparison verdicts | `improved`, `regressed`, `flat`, `not-established`, `insufficient-sample` |

Contract properties:

- **One validator.** `validateCeremonyDeclaration` and `validateCeremonyDocument` serve the built-ins and project declarations alike: same vocabularies, same bounds, same refusals. A violation is `ceremony.declaration.invalid` naming the ceremony id and the offending field, and nothing registers.
- **No executable content.** The validator refuses any member named `command`, `commands`, `path`, `paths`, `model`, `models`, `script`, `scripts`, `instruction`, `instructions`, `exec`, `shell`, `handler`, or `function`, at any depth. A declaration names vocabularies, never a command, path, or model.
- **Deterministic digest.** Each declaration has a pure FNV-1a digest recorded on the run, so a run states the declaration it executed.
- **Bounded document.** A declaration document over 1 048 576 UTF-8 bytes is refused as `config.file.malformed` by the reader before validation.

### 3.3 The six built-in declarations

| Ceremony | Tiers | Triggers | Agenda | Declared outputs and verification | Scope key | Catch-up |
|---|---|---|---|---|---|---|
| `morning-brief` | `full`, `lite` | schedule `daily` at `07:00` | `collect` → `render` `delivery.brief.v1` → `record` | brief render (`artifact-conforms`) with the ten surfaces, three anchor groups and the closed placeholder catalog; a `state-record` output | `repository` | `once` |
| `retro-evidence-pass` | `full`, `lite` | event `session-end`, event `incident-severity`, schedule `daily`, event `milestone-end` | follow-through fold → evidence fold → insights render → actions render → `record` to `memory` | note conforming to `delivery.ceremony.note.v1`; follow-through verified by `artifact-covers-items` | `note` | `once` |
| `sprint-rollover` | `full` | schedule `iteration`, event `milestone-end` | `collect` → `fold` → `render` → `record` | rollover report whose entries name ref, closed reason and next milestone (`artifact-conforms`) | `repository` | `once` |
| `night-watch` | `full`, `lite` | schedule `daily` at `02:00` | `collect` → `fold` → `render` → `record` | report with the four declared checks exactly once, each carrying a closed state (`artifact-covers-items`) | `repository` | `once` |
| `testing-session-assessment` | `full` | event `owner-note` | intake → `assess` → `render` → `record` | assessment in which every note item carries one closed verdict and `unassessedCount` is `0` (`artifact-covers-items`) | `note` | `none` |
| `decision-record-mirror-sync` | `full` | event `pre-dispatch` | `collect` → `sync` → `render` | mirror report per declared target plus a `mirror-target` output verified by `artifact-equals-source` (no extra, no missing) | `repository` | `once` |

The retro declaration declares exactly the four sub-R1 level triggers and no `change-merged`: R1 stays the closeout's own change-level retro. It is the only built-in whose first phase is follow-through verification, and that position is asserted, so moving it fails the parity suite.

Parity is a property, not a claim: every built-in runs through the same entry point, step dispatcher, artifact reader, verifier and record writer; one parametric suite iterates the six declarations over injected synthetic inputs and asserts each declared agenda, output set, verification mode and verdict; and a structure suite fails if a built-in acquires a distinct path. A declaration whose verification cannot fail is not accepted as parity evidence, so each built-in has at least one negative case.

### 3.4 Intake: identity, window, trigger

A run holds exactly one identity and one window, resolved from the declaration before any input read, state read, or write.

- **Scope key.** The declaration's derivation decides: `literal` uses the declared token, `repository` uses the invoking project's key, `note` uses the supplied note's `scopeKey`. Where the declaration derives from `note`, a note without `scopeKey` is refused as `ceremony.note-invalid` naming `scopeKey`. Where the declaration derives from `literal` or `repository`, a supplied note must carry the identical key and a disagreement is refused as `ceremony.note-invalid` naming `scopeKey` rather than silently overriding either side.
- **Note validation.** A declaration with `note.required: true` refuses a run without a note as `input.value.rejected` naming the note. A supplied note must carry `schemaId: delivery.ceremony.note.v1`, the executing ceremony's id, a non-empty `scopeKey`, and a `window` with `start` ≤ `end`; a note that declares a `level` additionally requires the concept's fixed members (`participants`, `evidenceRefs`, `facts`, `interpretations`, `wins` with `text` and `mechanism`, `gaps`, `candidateLessons`, `actions`, `confidence`) and its `trigger` member, and each omission is refused as `ceremony.note-invalid` naming the field.
- **Window.** A note's `window` governs; a `--window` that disagrees is refused as `input.value.rejected` naming both. A note-less declaration with a schedule trigger takes `--window` when supplied and otherwise derives the window from the injected clock at the cadence's UTC unit: `daily` the UTC day, `weekly` the ISO week (Monday start), `iteration` a 14-day period, `milestone` a 30-day period, the last two anchored at the Unix epoch. A note-less declaration whose triggers are event-only has no cadence to derive from, so `--window` is required and its omission is refused as `input.value.rejected` naming `--window`.
- **Recorded trigger.** Every run records exactly one kind plus the resolution of the declared trigger it stands for. A `catch-up` replay records `catch-up` with the missed window as its identity, the execution window beside it, and resolution `declaration`. An explicit `ceremony run` records `explicit` and resolves the declared trigger named by the note's `trigger` member (resolution `note`), else the declaration's single declared trigger (resolution `declaration`), else no single trigger (resolution `unspecified`, with the declared trigger set named). A note naming a trigger the declaration does not declare is refused as `input.value.rejected`. The recorded `explicit` kind is provenance only: it satisfies a window's identity like any other run and never impersonates or rewrites a `schedule`, `event`, or `catch-up` firing.
- **Idempotency.** A run whose `(ceremony, scopeKey, window)` identity is already recorded returns the recorded verdict with `data.reused: true` and appends nothing. A rerun at a different window is a new run identity and appends an addendum to the note body.
- **Trigger labels.** A declared trigger renders as `schedule:<cadence>` with `@<HH:MM>` appended when a time is declared, or `event:<event>`; the labels are what `list` and a note's `trigger` member use.

### 3.5 Execution, verification, compaction, resume

- **Declared order.** Phases and steps execute in declaration order. No step is skipped, reordered, retried, or parallelised. A step reads its declared inputs through the injected reader; an unavailable source arrives as a declared degradation (`state: unavailable` with a reason) rather than an error or a zero.
- **Write, read back, verify.** A step's rendered output is written to its declared slot and read back through the same slot; the read-back content is parsed and validated against the step's declared verification mode. Only a passing read-back makes the step `verified`.
  - `artifact-conforms` validates the document against its schema identifier and required shape: the brief's ten surfaces / three anchor groups / placeholder catalog, the rollover entry fields with a closed reason, the night-watch declared check set with a closed state, the assessment item verdicts with `unassessedCount: 0`, the mirror report's per-target equality, and the built-in schema set.
  - `artifact-covers-items` requires every item to carry a verdict from a closed set; an empty item set verifies only when the artifact declares `verifiedEmpty: true`, and the night-watch artifact must carry each declared check exactly once.
  - `artifact-equals-source` requires every target to be equal with empty `extra` and `missing` lists.
- **Failure stops the agenda.** A failed verification records the step `unverified` with the reason, stops later steps, and makes the run verdict `unverified` at exit `1`. The run record, the step records, and the produced artifact stay durable so the failure is inspectable.
- **Durability per attempt.** Each attempted step appends one `ceremony.step` record. The run's status, run duration (first step start to last step end), and per-phase durations are folds over the records; no mutable run document exists.
- **Compaction.** At each declared phase boundary the runner folds the phase's completed step outputs into a bounded carried summary (at most 4 096 bytes and 40 lines) and reports the summary, its byte and line counts, and an explicit `omitted` count when it truncated. Per-step detail stays in the durable records.
- **Resume.** `resume` reads the run record and its step records, validates the recorded index sequence against the declaration, and starts at the first unverified index. A verified step is never re-executed, re-rendered, or destructively re-verified; a failed step is re-attempted and appends a new record. A sequence with a missing middle index, an index outside the agenda, two attempts where the earlier one verified, or an unverified step followed by recorded later steps is refused as `state.store.torn` with zero writes. A run whose steps are all verified returns the recorded verdict with `reused: true` and appends nothing.
- **Verdict.** `verified` (every step verified and landable effects applied), `dry-run` (every step verified and a `sync` step deliberately unapplied), or `unverified` (a step failed verification). The verdict is derived, never written separately.

### 3.6 Catch-up

- Schedule evaluation is pure over the declaration, the injected clock, and the recorded runs: for the declared cadence, the windows due strictly before the current window, minus the windows whose `(ceremony, scopeKey, window)` identity a recorded run already occupies, are the missed windows. The bounded look-back is declaration data: 7 windows for `daily`, 4 for `weekly`, 2 for `iteration`, and 2 for `milestone`.
- At most one missed window is replayed per ceremony per invocation, oldest first. The replayed run records the missed window as its identity, the execution window beside it, and `trigger.kind: "catch-up"`; it reads current inputs, so no missed window's data is fabricated.
- A window whose identity is occupied is satisfied: no replay is produced for it, no outstanding obligation survives, and the invocation's single replay slot stays available for a genuinely different missed window. A second `catch-up` for a replayed window appends nothing.
- A ceremony with `catchUp.mode: "none"` reports its missed window as a declared gap with its bounds and executes nothing.
- A note-derived scope key and an event-triggered declaration are reported as declared gaps in a catch-up invocation, because catch-up supplies no note and an event trigger has no due window; the declaration is not invented into a run.
- A declaration recorded in the run history whose declaration is no longer registered is reported as a declared gap while its history stays readable.
- The report outcome is `unverified` when a replay failed, else `caught-up` when any replay executed, else `declared-gap` when any ceremony reported a gap, else `nothing-missed`. The report carries each ceremony's disposition (`current`, `satisfied`, `caught-up`, `still-missed`, `declared-gap`, `unverified`), its missed and satisfied windows, and the run id when a replay executed. `appendedRuns` counts the run records a catch-up appended.
- Catch-up never applies a `sync` effect: it composes the runner with `apply: false`.

### 3.7 Project declarations

- One committed document at `<gitRoot>/<configDirectoryName>/ceremonies.yaml` with `schemaVersion: delivery.ceremony.declarations.v1` and `ceremonies[]`. Absence, or an empty `ceremonies[]`, is the built-ins-only path.
- One bounded read per invocation. A present document that cannot be read or parsed is refused as `config.file.malformed` at exit `1` before any run, naming the path; a present document with a defective entry is refused as `ceremony.declaration.invalid` naming the id and field. Registration is all-or-nothing: zero partial registration, and the built-ins stay effective.
- A project declaration whose id collides with a built-in is refused, so a project adds ceremonies but cannot redefine one.
- A project declaration uses only declared vocabularies, slots, verifiers, triggers, and step kinds. It cannot name a new source, a new slot, a command, a model, or a path.
- No overlay, user-global, or environment source supplies or completes a declaration.

### 3.8 Tier engine

The engine answers, as data, which lifecycle phases a change's declared tier obligates and which escalation triggers apply. It consumes exactly two delivered sources and adds no third vocabulary:

| Input | Delivered source | Role |
|---|---|---|
| Plan `tier` | `delivery.plan.v1` required `tier` (`name` in `PLAN_KNOWN_TIERS`, optional integer `phases`, optional `escalationTriggers`) | Declared intent |
| pm-notes `variant` | `variant: full`\|`lite` (absent means `full`) with `PM_NOTES_REQUIRED_PHASES_BY_VARIANT` | Recorded lifecycle truth |

| Effective tier | Effective phase set | Source |
|---|---|---|
| `full` | the eleven canonical phases | `PM_NOTES_REQUIRED_PHASES_BY_VARIANT.full` |
| `lite` | `clarify_scope`, `specification`, `delivery`, `quality_gates`, `dod_check`, `pr_creation` | `PM_NOTES_REQUIRED_PHASES_BY_VARIANT.lite` |

Rules:

- **The variant governs.** The recorded variant supplies the phase set. When the plan's `tier.name` disagrees with it — including a tier name outside `PLAN_KNOWN_TIERS` — the verdict carries a `tier-mismatch` finding naming both and the variant's set is effective. The engine never picks silently, never blocks delivery, and never rewrites either declaration.
- **Declared phases narrow.** Plan `tier.phases` is a list of integer phase numbers resolved against the canonical eleven. Resolved ids narrow the effective set and set `phaseSetSource` to `plan.tier.phases`; an id that does not resolve produces an `unresolved-phase` finding and is not applied. A plan phase list can never introduce a phase outside the canonical vocabulary.
- **Escalations are evidence-gated.** Only the five closed escalation triggers are evaluated; a matched trigger whose evidence is present escalates the effective tier to `full` and is recorded with the trigger and its evidence reference. A declared trigger string outside the vocabulary is reported verbatim as `unevaluated` and produces an `unevaluated-trigger` finding — never dropped, never treated as false.
- **Verdict shape.** `effectiveTier`, `phaseSet[]` in canonical order, `phaseSetSource`, `declaredTier`, `declaredVariant`, `escalationTriggers[]` (each `matched`/`unmatched`/`unevaluated`), `escalations[]`, and `findings[]`. Findings are data, not error identities.
- **The lever.** `lite` omits exactly `test_planning`, `delivery_planning`, and `dor_check` — three of the seven phases `MET-CEREMONY-SHARE` counts as ceremony — so tiered intake is the declared lever on the committed metric without touching work phases.

### 3.9 Retro ceremonies

`retro-evidence-pass` serves the four levels below R1. R1 itself stays the closeout's own change-level retro.

| Level | Declared trigger | Scope | Per-level output |
|---|---|---|---|
| `session` | event `session-end` | one agent session | session note: evidence refs, self-error observations, near-miss captures, candidate lessons |
| `incident` | event `incident-severity` | the incident | incident note: system-level findings, attribution across originating step, propagation failure and missed detection, candidate actions |
| `window` | schedule `daily` | the project window | window note: cross-change patterns, follow-through verification, candidate promotions |
| `project` | event `milestone-end` | the milestone | project note: consolidation candidates, tribal-knowledge graduation, recurrence report |

- **Follow-through first.** The first phase is follow-through verification over the recorded actions, with the verdict vocabulary `applied`, `partial`, `violated-with-consequence`. A status claim is never evidence, and the phase's first position is asserted.
- **Fixed note schema.** The note carries `schemaId`, `ceremony`, `scopeKey`, `window`, `trigger`, the level and the concept's fixed members. The fixed schema is validated at intake before any output; the `record` step writes the note to the memory slot and its verification confirms the memory file is readable and parses as an object rather than re-validating the fixed schema a second time.
- **Idempotent scope keys.** The declaration takes `scopeKey: { kind: "note" }`, so the level's scope is the note's key. A rerun for the same `(scopeKey, window)` returns the recorded verdict; a rerun at a new window appends an addendum and never rewrites a prior note body.
- **Null retro is a success.** A retro whose evidence supports no finding, action, or lesson is a `verified` run with an explicit empty finding set; nothing is fabricated to fill a quiet window.
- **The evidence plane is the delivered pipeline.** The evidence step is a read-only fold over the delivered retro evidence records and run records plus the declared citations. The ceremony adds no collector, sidecar, chain, or truth check, and R1 coverage stays the closeout's `retro.run` read.
- **Actions are handed off.** Declared actions are rendered as a handoff section in the note; filing, the five-field action contract, aging, and closure belong to M2-S10.
- **Levels are ceremony data.** The pipeline's collection grammar stays `change`-only and its registry keeps the four levels `declared`; selecting a level through `retro collect` is still refused there, while the ceremony layer selects the level through the note.

### 3.10 Measurement and the committed comparison

- **Run record.** One `ceremony.run` record per run identity carries the ceremony id, run id, origin, declaration digest, trigger provenance (kind, resolution, declared trigger or declared set, declared window, actual window, execution window and catch-up marker where present), the scope key with its derivation, the consumed tier facts (`effectiveTier`, `phaseSetSize`, `escalations[]`), the injected start time, and the declared phase count. The recorded tier facts default to `full` with the eleven-phase size and no escalations when no verdict is supplied.
- **Step record.** One `ceremony.step` record per attempt carries the run id, step index, phase index, kind, outcome (`verified`\|`unverified`\|`dry-run`), start and end times, duration in milliseconds, output slot, artifact reference, verification verdict, and an optional classified reason.
- **Derived, not stored twice.** Run status, run duration, and per-phase durations are folds over the records.
- **The native basis.** The measurement fold derives per-run duration, per-ceremony run counts, arithmetic mean and nearest-rank p90, and run/step/phase totals from the verified records — no self-reported input.
- **The committed comparison.** One `delivery.ceremony.comparison.v1` record is committed in the measurement log's additive `comparisons[]` list: the committed `MET-CEREMONY-SHARE` identity, the definition reference with the log path and the metric row's `source_commit`, the `before` value with its window, sample size, status and basis, the `after` value with its window, per-change samples, sample size and basis, `sampleMinimum: 5`, the closed verdict, the native basis with the non-interchangeability statement, and a `disclosure` naming sample, window and basis difference. `improved` requires the sample minimum met and `after < before`. Below the minimum the verdict is `insufficient-sample` and no trend is claimed. At delivery the observed after sample is zero.
- **No reporting surface.** There is no command that computes or prints a metric; the builder is a library function, and the record is committed data. Aggregation, thresholds, alarms and presentation are M2-S6's.

### 3.11 Envelope, exit projection, human output

- **Envelope.** Every outcome is one `delivery.result.v1` envelope with the five delivered keys; every ceremony field lives under `data`, and `data` XOR `error` holds.
- **Exit.** `0` for a declared verdict, `1` for a refusal (`fallback.invocation`, `input.value.rejected`, `ceremony.note-invalid`, `ceremony.declaration.invalid`, `config.file.malformed`) or a data-bearing `unverified` verdict, `2` for a state/platform failure. No fourth value exists.
- **Human output.** One line per ceremony for `list`, one line per step plus a verdict line for `run` and `resume`, one line per ceremony plus an outcome line for `catch-up`; bounded to 32 lines and 6 144 bytes with an explicit omission marker, deterministic over the same data, and never a raw payload or a secret.

### 3.12 Edge cases

| Case | Behaviour |
|---|---|
| A required note is absent | `input.value.rejected` naming the note, before any output |
| A note omits `scopeKey` | `ceremony.note-invalid` naming `scopeKey`, exit `1`, zero output |
| A note names another ceremony | `ceremony.note-invalid` naming both ids |
| A note's `scopeKey` or `window` disagrees with the declaration or `--window` | `ceremony.note-invalid` naming `scopeKey`, or `input.value.rejected` naming both windows |
| The same identity is run twice | The recorded verdict with `reused: true`; zero appends |
| A run is interrupted mid-agenda | Step records stay durable; `resume` starts at the first unverified index |
| A resumed run's records contradict the declaration | `state.store.torn`, exit `2`, zero writes |
| A collector is unavailable | The artifact carries that surface's declared degradation (state plus reason) and still verifies; no zero or empty claim |
| A `sync` step runs without `--apply` | Verdict `dry-run`; the write set is computed and precondition-checked; nothing lands |
| A mirror target is absent, dirty, off-base, or drifted | That target is unequal with its reason; the step and run are `unverified` at exit `1`; no force path |
| A project declaration collides with a built-in | `ceremony.declaration.invalid` naming the id; zero partial registration |
| The declaration document is present but unparseable or oversized | `config.file.malformed`, exit `1`, before any run |
| An assessment item cites no evidence | `uncovered` with the missing citation named; the artifact still verifies |
| A note-less event-triggered run omits `--window` | `input.value.rejected` naming `--window`, exit `1`, zero records and artifacts |
| A declaration omits `scopeKey`, derives from a note it does not require, carries a malformed literal, or declares two schedule triggers | `ceremony.declaration.invalid` naming `scopeKey` or `triggers[]` |
| A comparison has fewer than five post-boundary changes | `insufficient-sample` with the observed `n` and per-change values; no trend claim |

## 4. Technical Architecture & Codebase Map

### 4.1 High-level design

Runtime-neutral contracts hold the vocabulary, the bounds, the six built-in declarations, the note and record payload types, the boundary declaration, and the error rows. Pure domain modules implement validation, intake, execution, verification, compaction, resume, schedule arithmetic, mirror planning, retro note assembly, the tier engine, and the measurement fold. The state module owns the two record kinds over the injected state port. The CLI command module owns grammar only, the output module owns the bounded human render, and the edge composes the runtime from injected seams. Adapters own the declaration-document read and the artifact family's bytes.

### 4.2 Core components

| Path | Responsibility |
|---|---|
| `packages/core/src/contracts/ceremony.ts` | The declaration, note, run/step and comparison vocabulary, closed sets, bounds, trigger labels, and the `ceremony.` artifact-boundary declaration. |
| `packages/core/src/contracts/ceremony-builtins.ts` | The six built-in declarations as contract data, in canonical order. |
| `packages/core/src/domain/ceremony-declaration.ts` | The single validator, the document validator, the binary-content scan, and the declaration digest. |
| `packages/core/src/domain/ceremony-intake.ts` | Scope-key precedence, window resolution, note validation, trigger resolution, and cadence-window derivation. |
| `packages/core/src/domain/ceremony-run.ts` | Ordered agenda execution, per-kind rendering, slot write and read-back verification, compaction, and the run verdict. |
| `packages/core/src/domain/ceremony-resume.ts` | Recorded-sequence validation and resume from the first unverified index. |
| `packages/core/src/domain/ceremony-schedule.ts` | Due-window arithmetic, identity-based satisfaction, and the bounded catch-up loop. |
| `packages/core/src/domain/ceremony-registry.ts` | The built-ins-plus-project registry and its refusal identities. |
| `packages/core/src/domain/ceremony-mirror.ts` | Declared write-set planning, target preconditions, equality in both directions, and the dry-run default. |
| `packages/core/src/domain/ceremony-retro.ts` | Level triggers, the fixed note members, and the follow-through-first assertion. |
| `packages/core/src/domain/ceremony-tier.ts` | The single plan-tier ↔ pm-notes-variant mapping, phase narrowing, escalation evaluation, and findings. |
| `packages/core/src/domain/ceremony-comparison.ts` | The native measurement fold and the committed comparison builder with its honesty scan. |
| `packages/core/src/state/ceremony.ts` | The record port: fenced appends with post-append verified re-reads, four read verdicts, and the run/step/duration folds. |
| `packages/adapters/src/file/ceremony-declarations.ts` | The one bounded declaration-document read. |
| `packages/adapters/src/file/ceremony-artifacts.ts` | The per-run artifact family: `<runId>` naming, `0600`, read-back by slot. |
| `packages/cli/src/commands/ceremony.ts` | The four-verb grammar, `--note`/`--window`/`--apply`/`--name` parsing, and the exit projection. |
| `packages/cli/src/output/ceremony-text.ts` | The bounded deterministic human render. |
| `packages/cli/src/edge.ts` | The ceremony runtime composition: registry read, note read, input reader, artifact store, record port, memory port, mirror port, memory/artifact seams. |
| `packages/cli/src/production.ts` | The unconditional production composition of the family. |

### 4.3 Key functions

`validateCeremonyDeclaration`, `validateCeremonyDocument`, `ceremonyExecutableField`, `ceremonyDeclarationDigest`, `resolveCeremonyIntake`, `deriveCeremonyCadenceWindow`, `matchDeclaredTrigger`, `validateCeremonyNoteForDeclaration`, `flattenCeremonyAgenda`, `executeCeremonyAgenda`, `runCeremony`, `compactCeremonyCarried`, `validateCeremonyStepSequence`, `resumeCeremony`, `dueCeremonyWindows`, `ceremonyWindowRecorded`, `evaluateCeremonySchedule`, `catchUpCeremonies`, `buildCeremonyRegistry`, `planCeremonyMirror`, `evaluateCeremonyTier`, `foldCeremonyMeasurement`, `buildCeremonyComparison`, `createCeremonyRecordPort`, `appendCeremonyRun`, `appendCeremonyStep`, `createCeremonyArtifactStore`, `createCeremonyCommandDefinition`, `renderCeremonyText`.

### 4.4 Data architecture

Two additive record kinds inside `delivery.state.v1`, declared in one artifact boundary under the `ceremony.` key prefix:

| Kind | Payload schema | Key | Identity |
|---|---|---|---|
| `ceremony.run` | `delivery.ceremony.run.v1` | `ceremony.runs:<runId>` | `runId` |
| `ceremony.step` | `delivery.ceremony.step.v1` | `ceremony.steps:<runId>:<index>` | `runId` |

The boundary validates required fields and the closed `origin`, `kind`, `outcome`, `slot`, and `verification` vocabularies on write and read. A nonconforming write refuses `state.store.unknown` with `not_landed` and fills no default; a read classifies `valid`, `verified-empty`, `torn`, or `unknown` distinctly. Appends use one single-writer fence and a post-append verified re-read requiring exactly one new record. Run status, run duration, and per-phase durations are folds; no derived run document exists, and the records never enter salvage, repair, or index rebuild differently from any other record kind.

Output slots:

| Slot | Home |
|---|---|
| `ceremony-artifact` | The per-repository artifact family `<stateDirectory>/ceremony-artifacts.<workspaceId>/`, named `<runId>.json`, `0600`, forever retention, outside the ledger and outside the derived-document set. |
| `state-record` | A JSON artifact in the same family, named `<runId>.state-record.<digest>.json`. The ledger receives only the runner's own `ceremony.run`/`ceremony.step` records. |
| `mirror-target` | A JSON artifact in the same family, named `<runId>.mirror-target.<digest>.json`, recording the per-target plan and equality. |
| `memory` | The committed memory tree under `.ai/memory/ceremony/`, one file per encoded scope key. A first run writes the note body; a rerun appends an addendum after a newline and never rewrites the prior body. |

Each artifact names its schema identifier; a render that cannot be read back fails its step's verification. Because the `ceremony-artifact` name is the run id, successive steps in that slot address one artifact per run.

### 4.5 Interfaces and contracts

- **Envelope and errors.** Five-field `delivery.result.v1`; two additive `ERROR_TABLE` rows under the new `ceremony` domain kind (see §4.6).
- **State.** The two record kinds, the boundary, and the fenced-append/verified-read discipline of [State Layer](feature-state-layer.md).
- **Declaration document.** `<gitRoot>/<configDirectoryName>/ceremonies.yaml`, schema `delivery.ceremony.declarations.v1`, one bounded read, max 1 048 576 bytes.
- **Note document.** `--note <path>`, schema `delivery.ceremony.note.v1`, read as one YAML file and validated against the note contract before any output. The note read is a plain file read at the composed edge; no byte-size bound is applied to it.
- **Retro pipeline.** Read-only consumption of verified evidence records and `retro.run` records; no write, no new collector, no chain material.
- **Measurement log.** One additive `comparisons[]` entry under `schema_version: 2`; no metric row edited.
- **Tier inputs.** `PLAN_KNOWN_TIERS` and `PM_NOTES_REQUIRED_PHASES_BY_VARIANT` imported, not restated.

### 4.6 Error identities

| Code | Domain kind | Category | Retryable | Consequence | Projection | Exit | Emitted when |
|---|---|---|---|---|---|---|---|
| `ceremony.note-invalid` | `ceremony` | `user` | `false` | `not_landed` | `user-validation` | `1` | A note required by the declaration is absent, omits a required member or its idempotent `scopeKey`, names another ceremony, or disagrees with the declaration's scope key; the field is named and no partial ceremony output is written. |
| `ceremony.declaration.invalid` | `ceremony` | `user` | `false` | `not_landed` | `user-validation` | `1` | A built-in or project declaration violates the contract — unknown step kind, input source, output slot, verification mode, trigger event, cadence, or tier; missing verification or output schema; duplicate id; built-in collision; unparseable schedule; over-bound collection; missing or illegal scope-key derivation; executable content — naming the ceremony id and the field, with nothing registered. |

`ceremony.note-invalid` is a kind-first two-segment code and is in the reserved exact allowlist; `ceremony.declaration.invalid` is three-segment. Grammar refusals use `fallback.invocation`; undeclared names, a missing note, a missing `--window`, and window disagreement use `input.value.rejected`; a malformed declaration document uses `config.file.malformed`; a contradicted record sequence or unreadable records use `state.store.torn`/`state.store.unknown`; a failed verification is a data-bearing `unverified` verdict, not an error row. The machine table and the documented table in [Result Contract](feature-result-contract.md) are in two-way sync at 138 identities and a 54-entry reserved two-segment allowlist.

### 4.7 Invariants

- No step's completion is asserted: every step carries a verification mode and every `verified` step passed a read-back.
- One recorded run per identity; one note body per scope key per window, with addenda only.
- At most one replay per ceremony per catch-up invocation, and no replay for an occupied identity.
- Run status and every duration are folds over records; no derived document is written.
- Determinism: identical injected inputs, clock and declaration produce byte-identical artifacts and human text.
- Zero model calls, zero network calls, zero child processes, zero ambient clock or environment reads in the fold, render, verification, and tier paths.
- The declaration cannot express executable content.

## 5. Non-Functional Requirements

| ID | Requirement | Delivered value |
|---|---|---|
| Envelope and exit continuity | Five keys, new fields under `data`, exits in `{0,1,2}` | Delivered; golden envelopes cover each outcome class |
| Determinism | Byte-identical artifacts and human text for identical injected inputs | Delivered; determinism and hermetic suites assert it, and a planted network import, `HOME` read, or skip fails the scan |
| Artifact-verified completion | 100% of declared steps carry a verification mode; every `verified` step passed read-back | Delivered; bounds suite refuses an over-bound or verification-less declaration |
| Resume correctness | Zero re-executed verified steps; a contradicted sequence refuses with zero writes | Delivered |
| Idempotency | Zero duplicate run records per identity; addenda only for notes; zero appends for a caught-up window | Delivered |
| Catch-up boundedness | ≤1 replayed window per ceremony per invocation; zero fabricated windows; zero replays for an occupied identity | Delivered |
| Bounded carried state | Summary ≤4 096 bytes / 40 lines with an explicit omission count; run record ≤16 KiB; step record ≤2 KiB; declaration document ≤1 MiB | Delivered |
| Error-table binding | Two rows, one domain kind, one reserved two-segment entry, two-way sync | Delivered at 138 identities and a 54-entry allowlist |
| Tier neutrality | Exactly two phase-set sources, no third vocabulary, no hardcoded default set | Delivered; a structure suite fails on a second literal |
| Measurement completeness | Every executed step carries a duration and a verification verdict | Delivered |
| Mirror safety | Declared targets only (≤8), equality in both directions, no force path, no landing without `--apply` | Delivered over injected mirror ports |
| Human output bounds | ≤32 lines / 6 144 bytes with an omission marker | Delivered |
| Read/run cost | Deliverable bound: one declaration read per invocation, ≤16 declared input reads per run, two verified state reads per fenced append (pre-append list read plus post-append verified re-read), and one step-history read per recorded run for `list` | Measured by the performance suite as `reads ≤ 2 × (1 + steps) + 2`; see §9 for the deviation from the change's original budget |
| Duration reference | `morning-brief` run under one second on the reference fixture; `catch-up` over six declarations in tens of milliseconds | CI asserts bounded work rather than wall-clock deadlines; the reference figure is informational |

## 6. Quality Assurance Strategy

All ceremony fixtures are synthetic and committed: injected clocks, id factories, fence tokens, input readers, artifact bytes, and mirror ports. No live credential, network call, child process, or live-tree write is involved, and a skip never counts as a pass.

| Suite | Coverage |
|---|---|
| `tests/behaviour/ceremony-declaration.test.ts`, `ceremony-declaration-bounds.test.ts` (TC-007..010, TC-061) | Declaration validation, the defect corpus, executable-content refusal, bounds, scope-key derivations |
| `tests/structure/ceremony-contract.test.ts`, `ceremony-parity-invariants.test.ts` (TC-007, TC-011, TC-049, TC-061) | Vocabulary closure, the six built-ins validate, no per-ceremony path, boundary shape |
| `tests/behaviour/ceremony-parity.test.ts` (TC-011, TC-012, TC-019) | One parametric suite over the six built-ins plus per-built-in negative cases |
| `tests/behaviour/ceremony-run.test.ts`, `ceremony-run-triggers.test.ts`, `ceremony-notes.test.ts`, `ceremony-state-boundary.test.ts` (TC-005, TC-020..023, TC-025, TC-039, TC-040, TC-062..064) | Execution order, verification failure, reuse, trigger recording, note validation, records, folds |
| `tests/behaviour/ceremony-resume.test.ts` (TC-021, TC-022) | Resume from the first unverified index, torn-sequence refusal, complete-run reuse |
| `tests/behaviour/ceremony-catch-up.test.ts`, `tests/structure/ceremony-catch-up-purity.test.ts` (TC-026..029, TC-065) | Missed windows, bounded replay, `mode: none`, occupied identity, purity |
| `tests/behaviour/ceremony-project-declarations.test.ts` (TC-030..032) | Absent, empty, malformed, defective, colliding, and accepting documents |
| `tests/behaviour/ceremony-tier.test.ts`, `ceremony-tier-intake.test.ts`, `tests/structure/ceremony-tier-single-source.test.ts` (TC-033..038, TC-051) | Agreement, mismatch, declared phases, escalations, unevaluated triggers, single-source scan |
| `tests/behaviour/ceremony-flow-*.test.ts` (TC-013..018, TC-043..045, TC-047, TC-048) | The six built-ins end to end (brief, rollover, night-watch, assessment, mirror, retro levels) |
| `tests/behaviour/ceremony-comparison.test.ts`, `tests/golden/ceremony-comparison.test.ts`, `tests/checks/ceremony-comparison-honesty.test.ts` (TC-041, TC-042) | Native fold, committed record deep-equal, `insufficient-sample` honesty |
| `tests/behaviour/ceremony-cli.test.ts`, `ceremony-list.test.ts`, `tests/golden/ceremony-envelope.test.ts` (TC-001..006) | Grammar, refusals, exit projection, envelope, listing |
| `tests/behaviour/ceremony-bounds.test.ts`, `ceremony-determinism.test.ts`, `ceremony-performance.test.ts` (TC-050, TC-053..055) | Output and record bounds, replay determinism, measured read cost and bounded-work posture |
| `tests/behaviour/ceremony-nonregression.test.ts` (TC-057) | The retro pipeline's payloads, identities, and registry status stay byte-identical |
| `tests/checks/ceremony-hermetic.test.ts`, `ceremony-mutants.test.ts` (TC-050, TC-056) | No skips, sockets, spawns, `HOME` reads, or live-tree writes; sixteen disabled rules each fail their suite |
| `tests/checks/error-table-sync.test.ts`, `tests/structure/error-table.test.ts`, `doc-conformance.test.ts` | Two-way error sync, 138 identities, 54-entry allowlist, documentation truth |

Mounting is covered by the help/coverage matrix, the prompt-set count assertion, root and family help, and the M2 reference page; a mapping whose reference page is absent fails `pnpm check:help`.

## 7. Operational & Support

### 7.1 Configuration

- One declaration document in the project-committed slot; absence is the built-ins-only path. No environment variable, overlay, or user-global file supplies a ceremony.
- The invoking project's key is the `repository` scope-key value; an invocation outside a work tree composes the declared `unbound` scope through the delivered scope policy.
- Schedule semantics are UTC with no daylight-saving handling and no timezone declaration. `at` is a declared minute-of-day carried as trigger metadata; the derived window is the cadence's UTC unit, not the `at` time.

### 7.2 Observability

The durable record set is the observability surface: what ran (run record), what each step did and how long it took (step records), what was skipped and why (declared gaps, `nothing-missed`, `dry-run`, `unverified` with reason), and what the tier engine decided (tier facts and findings on the run). No event, metric, exporter, or log sink is added.

### 7.3 Retention and cost

One run record, one step record per attempt, and one artifact file per step slot per run. Retention follows the state layer: forever, with no compaction of history. No scheduler and no background process exists, so cost is bounded by invocation.

## 8. Dependencies & Risks

| Direction | Item | Note |
|---|---|---|
| Depends on | Status digest, brief | Morning-brief inputs and the `delivery.brief.v1` render contract, consumed read-only |
| Depends on | Retro evidence pipeline | Verified evidence, `retro.run` records, and the level trigger model, consumed read-only |
| Depends on | Machine-readable plan | `PLAN_KNOWN_TIERS` and the required `tier` declaration |
| Depends on | pm-notes lint and phase transitions | `PM_NOTES_REQUIRED_PHASES_BY_VARIANT`, the pinned per-tier phase sets |
| Depends on | State layer | Ledger, artifact boundaries, fenced appends, classified damage, retention |
| Depends on | Entrypoint and self-description | Prompt-required composition, family and verb help, reference-page coverage |
| Depends on | Measurement baseline | The committed metric definition, formula, status semantics, and comparison protocol |
| Blocks | the `metrics` surface (M2-S6) | The metric surface consumes runner durations and the committed comparison |
| Feeds (no recorded board edge) | Retro action registry (M2-S10), board ceremony surface (M2-S4+) | The action handoff and the ceremony state are available; neither surface ships here |
| Risk | The declaration vocabulary is too narrow for a real ritual | The six built-ins are the expressiveness proof; a missing vocabulary is a reviewed contract extension, never a silent code path |
| Risk | A declaration becomes a scripting surface | Closed vocabularies plus the recursive executable-member refusal, asserted structurally |
| Risk | The mirror sync writes into another repository unintentionally | Declared targets only, dry-run default, preconditions, equality verification, no force path |
| Risk | Ceremony share is claimed from too small a sample | The sample minimum, the closed verdict, and the honesty scan |
| Risk | The runner increases ceremony time | Bounded declarations, one replay per invocation, per-step durations, and a comparison that exposes a regression |
| Risk | Tier mapping drifts into a second vocabulary | Imported phase sets, a variant-governs rule, and a structure test |
| Risk | A ceremony verifies a stale artifact | Artifacts are named by run id and a step verifies what it wrote in this run |

## 9. Delivered limits and known gaps

These are current properties of the shipped surface, stated so a reader does not infer capability the code does not have.

- **Composed input readers cover note-derived facts only.** The production edge composes the `owner-note` source from the supplied note's `actions`, and the retro evidence sources from the note's `evidenceRefs`; every other declared source returns `state: unavailable` with the reason `collector "<source>" is not composed for this invocation`. A built-in run therefore records declared degradations for collectors whose live wiring is not composed, and its artifact still conforms and verifies. The declarations name the full input set; the runtime composition is the gap.
- **The mirror landing path is not composed.** `mirror.inspect` reports `absent` and `mirror.apply` refuses with `no mirror landing path is composed`. With no composed `affected-repositories` facts, a real `decision-record-mirror-sync` run ends its `sync` step `unverified` with `no affected repository targets were declared` at exit `1`, rather than fabricating an empty set or a landing. The declared write-set planning, preconditions, dry-run default and two-way equality verification are delivered and exercised through injected mirror ports.
- **The tier engine is a library surface, not a composed intake gate.** `evaluateCeremonyTier` is pure and exported; no CLI surface computes a change's verdict, and no ceremony run receives one, so a recorded run carries the default `effectiveTier: "full"`, `phaseSetSize: 11`, and no escalations unless a caller supplies a verdict. Tier-based obligation filtering of ceremonies is not applied by the family.
- **Read cost is above the change's original target.** Each fenced append performs a pre-append list read inside the boundary plus the post-append verified re-read — two verified state reads per append — against an original target of at most one, and `ceremony list` performs one run read plus one step-history read per ceremony that has a recorded run (bounded by registry size) against an original target of at most two reads in total; a `list` with no recorded run performs one run read. The delivered bound is pinned by the performance suite as `reads ≤ 2 × (1 + steps) + 2`.
- **Fixed window arithmetic is declaration data.** `iteration` windows are 14 days and `milestone` windows 30 days, anchored at the Unix epoch; the catch-up look-back is 7 daily, 4 weekly, 2 iteration, and 2 milestone windows. These constants are not configurable and are not the iteration or milestone calendars a tracker defines.
- **`state-record` and `mirror-target` outputs are artifacts, not ledger records.** Only the runner's own `ceremony.run` and `ceremony.step` records enter the ledger; those two slots persist their rendered output as files in the ceremony artifact family.
- **The `ceremony-artifact` slot holds one file per run.** A multi-step ceremony writing that slot addresses `<runId>.json` from each such step, so the last write wins; `state-record` and `mirror-target` names carry a content digest. A step always verifies what it wrote in this run, so verification is not weakened, but per-step artifact retention in that slot is not available.
- **Retro notes land in a ceremony memory folder.** Notes are written to `.ai/memory/ceremony/<encoded scopeKey>.md` as a JSON body, with an addendum appended after a newline on a rerun. The committed retro archive and its index are not touched by the runner.
- **Catch-up never applies a `sync` effect.** The verb has no `--apply` and composes the runner with `apply: false`; a note-derived or event-triggered declaration reports a declared gap rather than executing.
- **Follow-through verdicts are note-supplied.** The retro declaration's first phase is follow-through verification and its position is asserted, but the verdicts come from the note: a note carrying a `followThrough` list has each entry's verdict validated against `applied`/`partial`/`violated-with-consequence` (an out-of-set verdict becomes `partial`), and a note without that list renders each `actions` entry as `applied` with a synthetic `note:action:<index>` reference. A null retro (no actions, no findings) renders `verifiedEmpty: true` and verifies.
- **Composed note facts attach a synthetic evidence reference.** The edge maps each note `action` to an assessment item carrying `evidenceRef: "note:action"`, so a composed testing-session assessment records every item `covered`; the `uncovered` branch for an item citing no evidence is delivered and tested through injected input facts. A note whose `actions` list is empty yields no covered item, and the assessment step's `artifact-covers-items` verification then fails.
- **The note read is not size-bounded.** A note document is read as one YAML file at the edge and validated against the note contract before any output; no byte-size bound is applied to the read itself.
- **The comparison record is committed data, not a command.** The builder is a library function; the log entry is authored in the delivering change. There is no CLI verb that recomputes or prints it.
- **`--apply` has no composed target.** For the shipped built-ins, the only `sync` step is the mirror sync, which cannot land while the mirror port is uncomposed; `dry-run` and applied verdicts are reachable through injected ports and covered by suites, not through the shipped binary.

## 10. Glossary & References

| Term | Definition |
|---|---|
| Ceremony | A declared, deterministic, artifact-verified unit of recurring work. |
| Ceremony declaration | The data defining a ceremony (`delivery.ceremony.declarations.v1`) using only closed vocabularies. |
| Agenda step | One declared unit of agenda work (`collect`, `fold`, `render`, `assess`, `sync`, `record`) with declared inputs, outputs, and a verification mode. |
| Artifact verification | Reading a step's declared artifact back from its slot and validating it against the declared verification mode; the only evidence a step completed. |
| Scope key | The declaration-derived identity component that makes reruns idempotent (`literal`, `repository`, `note`). |
| Run identity | `(ceremony, scopeKey, window)`; decides whether a run executes or returns a recorded verdict. |
| Window obligation | The requirement that a due declared window hold a recorded run identity, satisfied by the existence of that identity whatever kind produced it. |
| Explicit run | An operator `ceremony run`, recorded with `trigger.kind: "explicit"` and a resolution of `note`, `declaration`, or `unspecified`. |
| Run verdict | `verified`, `dry-run`, or `unverified`, derived from the step fold. |
| Catch-up | Replaying at most one missed scheduled window, labelled as such, exactly once. |
| Compaction | Folding a completed phase's step outputs into a bounded carried summary (4 096 bytes / 40 lines) with an explicit omission marker. |
| Tiered intake | Deriving which ceremonies a change is obligated to run from its effective tier. |
| Parity | The property that every built-in executes through the same runner, vocabularies, and verification discipline, asserted by one parametric suite. |
| Native basis | Runner-measured ceremony durations from run and step records — a different basis from the committed proxy and never substituted for it. |

## Related

- [Result Contract and Error Table](feature-result-contract.md) — the envelope, exit projection, and the `ceremony` domain kind.
- [State Layer](feature-state-layer.md) — the ledger, artifact boundaries, fenced appends, and the `ceremony.*` record kinds.
- [Retro Evidence Pipeline](feature-retro-pipeline.md) — the evidence plane and level registry the retro ceremony consumes.
- [Machine-Readable Plan Schema](feature-plan-schema.md) — the plan `tier` declaration the tier engine consumes.
- [pm-notes Lint and Phase Transitions](feature-pm-notes-lint-and-phase-transitions.md) — `PM_NOTES_REQUIRED_PHASES_BY_VARIANT`.
- [Measurement Baseline](feature-measurement-baseline.md) — `MET-CEREMONY-SHARE` and the additive `comparisons[]` record.
- [Brief](feature-brief.md) — the `delivery.brief.v1` render contract the morning-brief ceremony verifies.
- [Closeout Transaction](feature-closeout.md) — the mechanical-ceremony precedent and the change-level R1 retro.
- [CLI Entrypoint and Self-Description](feature-cli-entrypoint.md) — the prompt-required composition and help gates.
- [Ceremony runner guide](../../guides/ceremony-runner.md) — operator guide: verbs, declaration document, worked example, catch-up, artifacts, measurement record.
- [M2 `ceremony` command contract](../../planning/oss-tooling/milestones/m2/commands/ceremony.md) — the reference page served by `ceremony --help`.
