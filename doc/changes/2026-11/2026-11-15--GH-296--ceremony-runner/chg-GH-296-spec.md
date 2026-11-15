---
change:
  ref: GH-296
  type: feat
  status: Proposed
  slug: ceremony-runner
  title: "M2-S3: Ceremony runner (M2)"
  owners: [Juliusz Ćwiąkalski]
  service: delivery-os
  milestone: "M2: Ceremonies, measurement, and memory"
  labels: [milestone-m2, cli, ceremony, retro, tiering, measurement, state]
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: high
  dependencies:
    internal:
      - "GH-175 (M0-S6 status digest) and GH-228 (M1-S6 brief — delivered): the collector facts and the `delivery.brief.v1` render the morning brief ceremony projects"
      - "GH-232 (M1-S8 retro evidence pipeline — delivered): the verified evidence sidecar, the `retro.run` registry records, the four `retro` identities, and the memory-audit recording seam the retro ceremony consumes"
      - "GH-226 (M1-S13 machine-readable plan — delivered): `PLAN_KNOWN_TIERS`, the required `tier` declaration with inert `phases` and `escalationTriggers`, and `plan.tier.unknown`"
      - "GH-179 (M0-S10 pm-notes lint and phase transitions — delivered): `PM_NOTES_REQUIRED_PHASES_BY_VARIANT` and the effective `full`/`lite` variant"
      - "GH-174 (M0-S5 state layer — delivered): the append-only ledger, artifact-boundary declarations, fenced appends, classified damage, and store-managed artifacts"
      - "GH-227 (M1-S14 commit primitive — delivered): the landing path the decision-record mirror sync composes when it writes into an affected repository"
      - "GH-301 (M2-S8 memory records — delivered): the committed memory tree, its retro archive with generated index, and the record schema"
      - "GH-186 (M0-S17 measurement baseline — delivered): the committed `MET-CEREMONY-SHARE` definition, formula, window, status semantics, and comparison protocol"
      - "GH-242 (M1-S20 entrypoint and self-description — delivered): the prompt-required composition, family help entries, and the help/guide coverage matrix"
      - "GH-240 (M1-S12 closeout — delivered): the mechanical-ceremony precedent — declared plan, artifact-verified steps, idempotent re-run, dry-run default, bounded report"
      - "M0-S13 provider engine (ticket-declared dependency, delivered): the availability and park vocabulary a ceremony cites when it renders provider conditions"
    external: []
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/296
  related_changes: ["GH-284", "GH-232", "GH-226", "GH-186", "GH-240", "GH-301", "GH-300"]
  related_decisions: ["ODR-0002", "ODR-0003", "TDR-0005", "TDR-0022", "ADR-0003"]
  contracts:
    - "ceremony declaration contract (delivery.ceremony.declarations.v1) with closed step, input, output-slot, verification, trigger, trigger-resolution, scope-key derivation, and catch-up vocabularies"
    - "ceremony note contract (delivery.ceremony.note.v1) carrying the required idempotent scope key and the retro fixed schema"
    - "ceremony run and step records (delivery.ceremony.run.v1, delivery.ceremony.step.v1) under the ceremony. state key prefix"
    - "ceremony tier verdict derived from the delivered plan tier and the delivered pm-notes variant phase sets"
    - "two additive ceremony error identities, one of them a reserved two-segment code"
    - "additive comparisons record in the committed measurement log"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Turn the recurring factory rituals into declared, deterministic, artifact-verified units that one runner executes, resumes, compacts at boundaries and catches up after a missed window — so ceremony time becomes measurable, tiered intake can shrink ceremony share toward 40 percent, and a project can declare its own ceremony without a tooling change.

## 1. SUMMARY

The post-merge closeout is the one ritual mechanised today: a declared step plan, artifact-verified steps, a recorded operation ledger, idempotent re-run, dry-run default, and a bounded report ([Closeout Transaction](../../../spec/features/feature-closeout.md)). Every other recurring ritual is ad-hoc and model-driven: the morning brief is run when someone remembers, the retro evidence pass has no schedule, sprint rollover is a manual sweep, night-watch is an operator habit, a testing session's assessment is prose, and decision records reach affected repositories only if a human copies them. None of them has a declared unit, a deterministic runner, a per-step artifact check, a resume point, or catch-up. Ceremony share of active agent time is a committed metric (`MET-CEREMONY-SHARE`, value `0.406648` over the bash-era window, `PARTIAL`), and no engine exists that can move it.

This change delivers the ceremony runner as an M2 surface:

1. A `ceremony` root command family that runs declared ceremonies: list, run, resume, catch-up.
2. A ceremony declaration contract — trigger, inputs from collectors, agenda steps, render, verification, catch-up semantics — held as data, so a ceremony is a declaration and not logic.
3. The six built-in declarations on that contract (morning brief, retro evidence pass, sprint rollover, night-watch, testing-session assessment, decision-record mirror sync), each parity-testable through the same runner path.
4. A deterministic, artifact-verified execution discipline: a step is complete only when its declared artifact verifies, a run resumes from its first unverified step, and carried state compacts at declared phase boundaries.
5. Catch-up: a missed scheduled window is detected from the declaration and the recorded runs and replayed exactly once, labelled as catch-up.
6. Project-declared ceremonies that run through the same runner with no tooling change, from one committed declaration document with closed vocabularies.
7. The ceremony tier engine: per-tier phase sets and escalation triggers as data, consuming the delivered plan `tier` declaration and the delivered pm-notes `variant` phase sets — one mapping, no second vocabulary.
8. Durable ceremony run records carrying per-step durations and outcomes, so ceremony time becomes computable, plus the recorded before/after ceremony-share comparison this change owes its own acceptance.
9. Retro ceremonies that follow `doc/planning/concepts/retrospectives.md`: a declared trigger model, a follow-through-first agenda, the fixed note schema, idempotent scope keys, and per-level outputs — over the delivered retro evidence pipeline, without re-implementing its collection, truth checks, or the M2-S10 action registry.

No new event topic, no new LLM call, no new vendor integration, and no change to any delivered command's behaviour.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **One ceremony is mechanised.** Closeout is a deterministic twelve-step transaction over a declared operation set with per-operation outcome records, idempotent re-run, dry-run default, and a bounded residue report. It is the reference shape for "a ceremony is a declared unit whose steps are verified by their artifacts" and it is the only such unit in the product ([Closeout Transaction](../../../spec/features/feature-closeout.md)).
- **The recurring rituals are not units.** The morning brief is a command ([Brief](../../../spec/features/feature-brief.md)) with no schedule, no run record, and no catch-up. The retro evidence pass is a command family ([Retro Evidence Pipeline](../../../spec/features/feature-retro-pipeline.md)) whose `change` level runs on demand at closeout; its `session`, `incident`, `window`, and `project` levels are declared in the level registry with `status: declared` and owning story `M2-S3`, and selecting one refuses with a hint naming that story. Sprint rollover, night-watch, testing-session assessment, and decision-record mirror sync have no surface at all.
- **The retro registry already hosts the scheduled-trigger concept.** `retro.trigger` is a validated record kind; the `memory-audit` trigger is declared as `{ kind: schedule, cadence: weekly, owningBinding: "memory consolidation skill" }` and the retro pipeline states that scheduled invocation belongs to the ceremony runner ([Retro Evidence Pipeline](../../../spec/features/feature-retro-pipeline.md), [State Layer](../../../spec/features/feature-state-layer.md)).
- **The tier data exists and is inert.** A plan's `tier` is required declaration data: `name` in `full|lite`, optional integer `phases`, optional `escalationTriggers`. `plan validate` echoes it, rejects an unknown name with `plan.tier.unknown`, and never evaluates it; the module states that tier phase sets and escalation triggers are inert declaration data and that no default phase set is declared ([Machine-Readable Plan](../../../spec/features/feature-plan-schema.md), `PLAN_KNOWN_TIERS`). A change's effective lifecycle variant is recorded separately in pm-notes as `variant: full|lite` with pinned per-variant required phase sets; absence means `full` ([pm-notes Lint and Phase Transitions](../../../spec/features/feature-pm-notes-lint-and-phase-transitions.md), `PM_NOTES_REQUIRED_PHASES_BY_VARIANT`).
- **Ceremony share is measured, once, as a proxy.** `MET-CEREMONY-SHARE` defines ceremony share as the share of recorded lifecycle phase time spent in the seven ceremony phases (`clarify_scope`, `specification`, `test_planning`, `delivery_planning`, `dor_check`, `dod_check`, `pr_creation`) rather than the four work phases (`delivery`, `system_spec_update`, `review_fix`, `quality_gates`), over spine-included changes, at one decimal, with overlapping phases counted in both numerator and denominator. Its status is `PARTIAL` because the source is self-reported pm-notes timestamps; direction is "lower is better"; the comparison protocol requires the same metric ID and definition over an equal-length window, and a definition change allocates a new `MET-` ID ([Measurement Baseline](../../../spec/features/feature-measurement-baseline.md), committed log `doc/planning/oss-tooling/measurement-baseline.yaml`).
- **The lite variant removes exactly ceremony phases.** The pinned `lite` set is `clarify_scope`, `specification`, `delivery`, `quality_gates`, `dod_check`, `pr_creation` — three of the seven ceremony phases (`test_planning`, `delivery_planning`, `dor_check`) are absent. Tiered intake therefore has a direct, already-declared lever on the committed metric, and no engine consumes that lever today.
- **The command surface is closed and mounted by declaration.** A family is reachable only when it is in the prompt-required set, composed by the production entrypoint, advertised in root `--help`, and served by a reference page that the help/guide coverage matrix names ([CLI Entrypoint](../../../spec/features/feature-cli-entrypoint.md)). The registry carries a planned `ados ceremony` row, and the strangler mapping lists "ceremony scripts" as replaced at M2-S3 ([command registry](../../../planning/oss-tooling/cli-command-registry.md)).
- **The event taxonomy is closed at six topics.** No ceremony topic exists, and adding one is not part of this change ([Event Taxonomy](../../../spec/features/feature-event-taxonomy.md)).
- **The declaration documents that exist.** The project-committed configuration document (`<configDirectoryName>/config.yaml`) declares provider, merge, verify, and lane policy; it is a catalog-bounded node set whose complex nodes are validated by their own resolvers, and configuration overlays other than the committed slot are not policy of record ([Configuration Layer](../../../spec/features/feature-config-layer.md)). The committed memory tree holds the retro archive with its own index ([Memory Lint](../../../spec/features/feature-memory-lint.md)).

### 2.2 Pain Points / Gaps

- **No declared unit.** A ritual's inputs, steps, rendered output, verification, and behaviour after a miss live in prose prompts and operator habit. Two agents running "the morning brief" produce different work, and nothing can be compared across days.
- **No deterministic runner.** Every ritual consumes model judgement for work that is mechanical: reading collectors, rendering a screen, checking that an artifact exists, noticing that yesterday never ran. That judgement is unmeasurable, unrepeatable, and unverifiable.
- **No artifact verification.** A ritual "completed" because an agent said so. Nothing checks that the brief was rendered, that a retro note carries a follow-through section, that every item of an owner's testing note received a coverage verdict, or that a decision record actually reached an affected repository.
- **No resume and no catch-up.** An interrupted ritual restarts or is abandoned; a missed daily window is simply lost, and nothing distinguishes "nothing to do" from "never ran".
- **No idempotency key.** Re-running a ritual duplicates notes or rewrites them, instead of appending an addendum, so reruns are avoided and drift accumulates.
- **No measurement path.** Ceremony share is a proxy computed from self-reported pm-notes timestamps once, with no per-run durations, so the metric cannot regress-test an improvement to the ceremonies themselves.
- **Tier data is inert.** A plan declares `full` or `lite`, plans declare escalation triggers, and pm-notes pins the two phase sets — and nothing consumes any of it, so `lite` is a label rather than a reduced ceremony obligation.
- **Project ceremony declarations have no contract.** A project that wants its own ritual has no vocabulary to declare one, so it writes a bespoke script — precisely the surface this change is meant to retire.
- **Retro levels are declared but unreachable.** `R2`–`R5` name `M2-S3` as their owning story and refuse selection, so the retro concept's declared trigger model, per-level outputs, fixed note schema, and scope-key idempotency are unimplemented at exactly the levels that need scheduling.

## 3. PROBLEM STATEMENT

Because every recurring ritual is prose-and-judgement rather than a declared unit with artifact-verified steps, a deterministic runner, a resume point, an idempotency key and catch-up, the team cannot run its own ceremonies reliably or measure the time they consume; consequently ceremony share stays a `PARTIAL` proxy around 40 percent with no engine able to move it, a missed ceremony is indistinguishable from an empty one, a project cannot add a ritual without new tooling, and the retro concept's levels and trigger model remain declared-only.

## 4. GOALS

- **G-1**: Make a ceremony a declared unit — trigger, inputs from collectors, agenda steps, render, verification, catch-up semantics, compaction — held as data, never as per-ceremony logic.
- **G-2**: Deliver one deterministic runner that executes any declaration, verifies every step by its declared artifact, resumes from the first unverified step, compacts carried state at declared boundaries, and catches up a missed window exactly once.
- **G-3**: Ship the six built-in ceremonies as declarations on that contract and prove them parity-testable through the same runner path.
- **G-4**: Let a project declare its own ceremonies in one committed document and run them through the same runner with zero tooling change.
- **G-5**: Land the ceremony tier engine — per-tier phase sets and escalation triggers as data — consuming the delivered plan tier and the delivered pm-notes variant, with exactly one mapping and no second phase-set vocabulary.
- **G-6**: Make ceremony time measurable: durable per-step durations and outcomes, plus the recorded before/after ceremony-share comparison this change owes.
- **G-7**: Make retro ceremonies follow the retrospective concept: a declared trigger model, a follow-through-first agenda, the fixed note schema, idempotent scope keys, and per-level outputs.
- **G-8**: Keep the delivered contracts intact: the five-field `delivery.result.v1` envelope, the `{0, 1, 2}` exit projection, boundary-validated state writes through the state layer, a runtime-neutral core, deterministic render and verification with zero model calls, and the error table synced in both directions.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Built-in ceremonies declared on the contract | 6 of 6, each with declared trigger, inputs, ordered agenda, output slot, verification mode and catch-up semantics |
| Built-in ceremonies parity-testable through one runner path | 6 of 6 by one parametric suite; 0 ceremonies with a bespoke execution path |
| Declared agenda steps carrying a verification mode | 100%; 0 steps whose completion is asserted without an artifact check |
| Interrupted runs resuming without repeating a verified step | 100% of steps 1..k re-executed = 0 after interruption at step k |
| Duplicate run records for one `(ceremony, scopeKey, window)` identity | 0 |
| Runs whose identity cannot be resolved | 0: every run resolves its scope key from the declaration (F-2) and its window from the note or the declared cadence (F-1), or is refused before any read |
| Ceremony run record duration coverage | 100% of executed steps carry a step duration; 100% of runs carry a run duration |
| Ceremony-share comparison recorded from committed data | 1 comparison record per delivery, with before value, after sample, sample size, and a verdict from the closed set; 0 trend claims below the declared sample minimum |
| Project-declared ceremony executed without a tooling change | 1 acceptance case: declaration document only, same runner, same verification discipline |
| Tier mapping sources | 2 (plan `tier`, pm-notes `variant`) mapped once; 0 additional phase-set vocabularies |
| Retro ceremony levels with a declared trigger and per-level output | 4 of 4 (`session`, `incident`, `window`, `project`) |
| New model calls in render or verification paths | 0 |
| Ceremony-share direction after tiered intake | At or below the committed before value over an equal-length window once the sample minimum is met; below minimum the record states `insufficient-sample` |

### 4.2 Non-Goals

- **NG-1**: No ceremony-share reporting surface. `ados metrics` and every metric presentation, alarm, and aggregation belong to M2-S6; this change delivers the durable duration data and one recorded comparison only.
- **NG-2**: No retro action registry. The five-field action contract, artifact and outcome closure, aging, and board surface stay M2-S10; the retro ceremony consumes recorded follow-through and does not implement the registry.
- **NG-3**: No custom ceremony pack distribution. Projects declare their own ceremonies; distributable, versioned packs are later work.
- **NG-4**: No scheduler. The runner evaluates declared schedules as a pure function and offers `catch-up`; driving cadence continuously (daemon, cron, systemd) stays with the delivered scheduling and daemon surfaces and is not extended here.
- **NG-5**: No new retro collection capability. The retro pipeline's `retro collect`/`retro report` grammar, its evidence plane, its truth checks, and its level registry implementation status are unchanged.
- **NG-6**: No new event topic, no new envelope key, no new exit value.
- **NG-7**: No MCP tool for ceremonies in this change.
- **NG-8**: No LLM in any render, verification, fold, or tier path.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | `ceremony` command family: list, run, resume, catch-up | One mounted surface is where a declared ceremony becomes an executed, reportable unit; without a family there is no runner to declare against |
| F-2 | Ceremony declaration contract as data | The unit must be a declaration (trigger, inputs, agenda, render, verification, catch-up, compaction) or every new ceremony is code and "projects declare their own" is impossible |
| F-3 | Six built-in declarations on that contract | The M2 built-in set is the delivered proof that the contract is expressive enough for the real rituals |
| F-4 | Deterministic artifact-verified execution with resume and compaction | A ceremony is only deterministic if each step is complete only when its artifact verifies, resumable from the first unverified step, and bounded in carried state |
| F-5 | Catch-up of a missed scheduled run | A missed ritual must be distinguishable from a quiet one and replayed exactly once, or the schedule is decorative |
| F-6 | Project-declared ceremonies through the same runner | The contract is only a contract if a declaration written by a project runs unchanged by tooling |
| F-7 | Ceremony tier engine over delivered tier data | Tiered intake is the declared lever on ceremony share; it must consume the delivered plan tier and pm-notes variant instead of inventing a vocabulary |
| F-8 | Durable run records and ceremony-share measurement | Ceremony time cannot be reduced if it is not measured; per-step durations make the committed metric computable and auditable |
| F-9 | Retro ceremonies per the retrospective concept | The concept's trigger model, follow-through-first agenda, fixed note schema, scope keys and per-level outputs are the retro part of the contract and the ticket's AC4 |

### 5.1 Capability Details

#### F-1 — The `ceremony` command family

The family is mounted the way every family is mounted: a prompt-required composition entry, a production composition, family and verb help entries, an M2 reference page, and a coverage-inventory row. It is exactly four verbs.

| Invocation | Behaviour | Exit |
|---|---|---|
| `ceremony list` | Lists every declared ceremony (built-in origin and project origin) with its id, origin, tier applicability, declared trigger, declared catch-up mode, and last-run summary. | `0` |
| `ceremony run <name> [--note <path>] [--window <start>..<end>] [--apply]` | Runs one declared ceremony: note intake (when the declaration requires a note), agenda execution step by step with artifact verification, compaction at declared boundaries, run and step records, rendered artifact. | `0` when the run verdict is `verified` or `dry-run`; `1` on a refusal or an `unverified` verdict; `2` on a state/platform failure |
| `ceremony resume <runId>` | Continues an interrupted run from its first unverified step; never re-executes a verified step. | as `run` |
| `ceremony catch-up [--name <name>]` | Evaluates every eligible declaration's schedule against recorded runs and executes each missed window exactly once, labelled `catch-up`. | `0` when every eligible ceremony is current or caught up; `1` when a catch-up run is `unverified`; `2` on a state/platform failure |

Rules that hold across the family:

- **Envelope continuity.** Every outcome is the delivered five-field `delivery.result.v1` envelope; all new data lives under `data`; no new top-level key, no `ok`, no `command`.
- **Exit discipline.** `0` is a declared verdict (`verified`, `dry-run`, or a clean `catch-up`); `1` is a refusal or a data-bearing negative verdict (`unverified`, or a `catch-up` that found a missed run it could not complete); `2` is a platform, state, or provider failure carrying its delivered identity. No fourth value exists.
- **Grammar refusals** — a missing verb, an unknown verb, an unexpected positional, an unknown flag, a missing flag value — resolve through the delivered `fallback.invocation` identity at exit `1` before any read or write.
- **An undeclared ceremony name** is refused as `input.value.rejected` (exit `1`) naming the requested name and the declared set; no run record, step record, or artifact is produced.
- **A flag the declaration does not use is not an error** (`--apply` on a read-only ceremony is accepted and inert), because a uniform invocation shape is what makes the family scriptable.
- **Window resolution.** Every run holds exactly one window, resolved here and nowhere else, in this order:
  1. **A ceremony that consumes a note** — the note's `window` governs the run identity, and a `--window` that disagrees is refused as `input.value.rejected` naming both.
  2. **A note-less ceremony with a schedule trigger** — `--window` supplies the window when given; when omitted, the window is derived from the injected clock at the declared cadence's UTC unit: `daily` → the current UTC day, `weekly` → the current ISO week, `iteration` → the current iteration, `milestone` → the current milestone. A declaration declares at most one schedule trigger (F-2), so the derived unit is never ambiguous.
  3. **A note-less ceremony whose triggers are event-only** — no cadence exists to derive a window from, so `--window` is required and its omission is refused as `input.value.rejected` naming `--window` at exit `1` before any read or write: no run record, no step record, no artifact.
  A run never holds two windows, and no run identity is ever resolved from a window that does not exist.
- **No side effect without `--apply`.** A `sync` step is dry-run by default: it computes the declared write set, verifies the target preconditions, records the run with `applied: false`, and lands nothing. `--apply` is the only way a declared effect lands. This follows the delivered closeout dry-run default.

#### F-2 — The ceremony declaration contract

A ceremony declaration is data. It carries exactly:

| Member | Contract |
|---|---|
| `id` | Stable kebab-case identifier, `^[a-z][a-z0-9-]*$`, 1..64 characters, unique across built-ins and project declarations. |
| `title` | Non-empty one-line human title. |
| `tiers` | Non-empty subset of the delivered plan tier vocabulary (`full`, `lite`). No other tier name is legal. |
| `triggers[]` | One or more declared triggers (1..8), each either `{ kind: "schedule", cadence: "daily" \| "weekly" \| "milestone" \| "iteration", at?: "<HH:MM>" }` on a UTC basis or `{ kind: "event", event: "<event>" }` from the closed event set `session-end`, `incident-severity`, `milestone-end`, `change-merged`, `owner-note`, `pre-dispatch`. A declaration declares at most one schedule trigger, so the window of a note-less run derives from one unambiguous cadence (F-1). The event set is a vocabulary, not an obligation: a declaration declares only the triggers it serves, so a project ceremony may declare `change-merged` even where no built-in does. What a run records is stated once under *Declared versus recorded triggers* below. |
| `inputs[]` | Ordered GET-only inputs, each naming one declared source from the closed input vocabulary, with an optional window parameter. Inputs are read, never written. |
| `agenda[]` | Ordered phases; each phase holds one or more steps; each step names a `kind` from the closed step vocabulary, its `inputs`, its `outputs[]` (each with a declared output slot and schema identifier) and its `verify` mode. |
| `scopeKey` | Required. How the run's idempotent scope key is derived, from the closed derivation set: `{ kind: "literal", value: "<token>" }` (the declared token verbatim), `{ kind: "repository" }` (the invoking repository's delivered normalized identity), or `{ kind: "note" }` (the supplied note's `scopeKey`; legal only when `note.required` is `true`). There is no default and no implied source: a declaration that omits `scopeKey`, declares `note` while requiring no note, or carries a malformed literal token is invalid and refused as `ceremony.declaration.invalid` naming `scopeKey`. |
| `note` | Optional note requirement: `{ required: boolean, schema: "<schema-id>", scopeKey: "required" }`. A ceremony whose declaration requires a note cannot run without one, and a note without its idempotent scope key is refused (F-9, DM-2). |
| `catchUp` | `{ mode: "once" \| "none", maxMissedWindows: 1 }`. `once` means a missed window is replayed exactly once; `none` means a missed window is recorded as a declared gap. |
| `compaction` | Declared phase boundaries at which carried state is compacted, plus the compacted-summary bound. |

Closed vocabularies (a declaration is valid only when every name it uses is declared here):

| Vocabulary | Members |
|---|---|
| Step kinds | `collect` (read declared GET-only inputs), `fold` (mechanically fold declared inputs into the declared intermediate), `render` (deterministically render the declared artifact), `assess` (item-by-item verdict over a declared item source with a declared verdict vocabulary), `sync` (idempotent application of a declared write set to declared targets), `record` (append the declared note or fact to its declared home) |
| Output slots | `memory` (the committed memory tree), `ceremony-artifact` (the per-repository ceremony artifact family in the state directory), `state-record` (the ceremony record kinds in the delivery ledger), `mirror-target` (a declared affected repository) |
| Verification modes | `artifact-conforms` (the artifact exists and validates against its declared schema and required sections), `artifact-covers-items` (every declared item carries a verdict from the declared closed verdict set), `artifact-equals-source` (the target's content digest set equals the declared source set, with no extra and no missing member) |
| Verdict vocabulary (run) | `verified`, `dry-run`, `unverified` |
| Verdict vocabulary (assess step) | `covered`, `partial`, `uncovered`, `not-applicable` |
| Trigger events | `session-end`, `incident-severity`, `milestone-end`, `change-merged`, `owner-note`, `pre-dispatch` |
| Scope-key derivations | `literal` (a declared kebab-case token), `repository` (the invoking repository's normalized identity), `note` (the supplied note's `scopeKey`) |
| Recorded trigger kinds | `schedule` (a declared cadence fired), `event` (a declared event fired), `catch-up` (a missed window replayed), `explicit` (an operator `ceremony run`) |
| Recorded trigger resolutions | `note` (the supplied note named a declared trigger), `declaration` (the declaration's single declared trigger), `unspecified` (the declaration declares several triggers and no note resolved one) |

Contract properties:

- **Every step is verified.** A declaration with a step carrying no `verify`, an output carrying no schema identifier, an unknown step kind, an unknown input source, an unknown output slot, an unknown verification mode, an unknown trigger event, a tier outside the delivered vocabulary, a duplicate `id`, an unparseable schedule, or an over-bound collection is invalid and is refused as `ceremony.declaration.invalid` naming the ceremony id and the offending field. A built-in declaration is validated by the same validator as a project declaration — the built-ins get no privileged path.
- **Scope-key derivation and precedence, stated once.** The run identity's scope key is declaration data, never implied and never left to the ceremony. When the declaration declares `scopeKey.kind: "note"`, the supplied note's `scopeKey` is the run's scope key and a note lacking it is refused as `ceremony.note-invalid` (E-2, DM-2). Otherwise the declaration's own derivation (`literal` or `repository`) supplies the key; a note the same ceremony also consumes must carry the identical key, and a disagreement is refused as `ceremony.note-invalid` naming `scopeKey` rather than silently overriding either side. Every declaration therefore resolves exactly one scope key before any read: four of the six built-ins consume no note and derive their key from the invoking repository, a note-consuming built-in derives it from the note, and a project declaration must do one of the three.
- **Declared versus recorded triggers.** `triggers[]` declares how a ceremony is offered. Every run records exactly one trigger kind from the recorded-trigger vocabulary plus the resolution of the declared trigger it stands for. A scheduled or event firing records `schedule` or `event` with the declared trigger that fired and resolution `declaration`. `catch-up` records `catch-up` with the missed window and the declared trigger it replays, resolution `declaration`. An explicit `ceremony run` records `explicit` and resolves the declared trigger it stands for to the trigger its supplied note's `trigger` member names when the declaration declares it (resolution `note`), else to the declaration's single declared trigger (resolution `declaration`), else to no single trigger (resolution `unspecified`, with the declaration's declared trigger set named in the record). An explicit run is never counted as the fulfilment of a scheduled or event obligation. A note whose `trigger` names a trigger the declaration does not declare is refused as `input.value.rejected` naming both.
- **No executable content.** A declaration names vocabularies; it never carries a command, a shell fragment, a path to run, a model call, or a free-form instruction. This is what keeps "a project declares its own ceremony" from becoming "a project ships code".
- **Deterministic render.** `render` and `fold` steps are pure over the injected inputs: no model call, no ambient clock, no ambient environment, no network. A render whose inputs are identical produces byte-identical output.
- **Bounded.** A declaration caps at 12 phases, 32 steps per ceremony, 16 inputs, 8 targets, and 1 MiB of declaration document; the agenda is ordered and the order is the execution order.

#### F-3 — The six built-in declarations

The built-ins ship as contract data in the runtime-neutral core, using exactly the vocabularies of F-2. Each is a declaration, not a branch.

| Ceremony | Trigger | Inputs | Agenda (steps) | Outputs and verification | Catch-up |
|---|---|---|---|---|---|
| `morning-brief` | schedule `daily` at a declared UTC time | status collector facts and the brief projection; spend citation; open typed questions; provider park facts | `collect` the collector facts → `render` the brief → `record` the run | `ceremony-artifact` render conforming to `delivery.brief.v1` with all ten surfaces, three anchor groups, and the closed placeholder catalog (`artifact-conforms`) | `once` |
| `retro-evidence-pass` | event `session-end`, event `incident-severity`, schedule `daily`, and event `milestone-end` — exactly the four sub-R1 level triggers of F-9, and nothing else. `change-merged` and the R1 change level are deliberately absent: R1 stays closeout's own retro (§7.2, F-9, DEC-4, DEC-17), so a `change-merged` firing can never reach this declaration and no firing lacks a level | the retro pipeline's verified evidence and `retro.run` records; the spend fold; the memory-audit seam; pm-notes retro notes | follow-through verification → evidence fold → insight note → declared-actions handoff → `record` the level note | `memory` note per level conforming to the fixed note schema, ending with a follow-through section (`artifact-conforms`), and every agenda step's declared output present (`artifact-covers-items` over agenda steps) | `once` |
| `sprint-rollover` | schedule `iteration` and event `milestone-end` | queue state, tracker milestone state, the measurement log's committed metric rows | `collect` rollover facts → `fold` carry-over set → `render` the rollover report → `record` | `ceremony-artifact` rollover report in which every carry-over entry names its ref, its reason from the closed reason set, and its next milestone (`artifact-conforms`) | `once` |
| `night-watch` | schedule `daily` at a declared overnight UTC time | audit-ledger read, harness telemetry, lane and queue facts, gate verification facts | `collect` overnight facts → `fold` anomaly set → `render` the night-watch report → `record` | `ceremony-artifact` report in which every declared check appears exactly once, each anomaly cites its evidence reference, and every clean area is an explicit verified-empty (`artifact-conforms`, `artifact-covers-items` over declared checks) | `once` |
| `testing-session-assessment` | event `owner-note` | the owner note; the test artefacts the note cites; the delivered gate report | note intake → `assess` each note item against its cited evidence → `render` the item-by-item assessment → `record` | `ceremony-artifact` assessment in which every note item carries exactly one verdict from `covered`, `partial`, `uncovered`, `not-applicable`, and the count of unassessed items is zero (`artifact-covers-items`) | `none` (event-triggered) |
| `decision-record-mirror-sync` | event `pre-dispatch` (before a ticket dispatches into an affected repository) | the decision register projection; the declared affected-repository set | `collect` register and target facts → `sync` the declared mirror write set into each affected repository (dry-run unless `--apply`) → `render` the mirror report | `mirror-target` mirror state per affected repository, plus a `ceremony-artifact` mirror report; verification is `artifact-equals-source` (each target's mirrored decision-record set equals the register set for that repository — no extra, no missing) | `once` |

Declared scope keys for the built-ins (F-2 `scopeKey`), the member that makes every built-in's idempotency defined whether or not it consumes a note:

| Ceremony | `scopeKey` | What the key is |
|---|---|---|
| `morning-brief` | `{ kind: "repository" }` | The invoking repository's identity; a second brief in the same derived day window reuses the recorded run (AC-F4-7) |
| `retro-evidence-pass` | `{ kind: "note" }` | The level's scope — session, incident, project window, or milestone — as the note carries it (F-9) |
| `sprint-rollover` | `{ kind: "repository" }` | The invoking repository; one rollover per iteration or milestone window |
| `night-watch` | `{ kind: "repository" }` | The invoking repository; one night-watch per derived day window |
| `testing-session-assessment` | `{ kind: "note" }` | The owner note's scope key |
| `decision-record-mirror-sync` | `{ kind: "repository" }` | The invoking repository, with the declared affected repositories as the write set; the supplied `--window` completes the identity (F-1) |

The two `note` derivations are legal because those two declarations require a note (F-2); the other four require none and derive their key from the invoking repository, which is why every built-in's idempotency is defined without a note.

Parity obligations that make "parity-testable" a property rather than a claim:

- One runner path. Every built-in declaration is executed by the same entry point, the same step dispatcher, the same artifact reader, the same verifier, and the same record writer. There is no per-ceremony code branch and no per-ceremony verb.
- One parametric suite. A single suite iterates the six declarations, asserts each declaration validates against F-2, executes it over synthetic injected inputs, and asserts the declared-vs-observed step set, output set, verification mode, and verdict. Adding a built-in adds a declaration and a fixture row, never a suite.
- Declared triggable and refusable cases. Each built-in has at least one negative case in which its declared verification fails, so a green parity run cannot be vacuous.
- Degradation is data, not failure. A collector that is unavailable renders inside the artifact exactly as the brief digest already models it (state plus reason); the artifact still conforms to its schema and the step still verifies. A ceremony never turns a degraded read into a clear, empty, or zero claim, and never fails a run because the world was quiet.

#### F-4 — Artifact-verified execution, compaction, resume

Execution discipline, in order, for one run:

1. **Intake.** Resolve the declaration; resolve its `scopeKey` by the F-2 scope-key precedence and its window by the F-1 window resolution; validate the note when one is required; then compute the run identity `(ceremony, scopeKey, window)` and read the recorded runs for it. An identical identity is not re-executed: the recorded verdict is returned with `data.reused: true` and nothing is appended. This is the idempotency rule, and it holds for every declaration — a note-consuming ceremony is keyed by its note, and a note-less ceremony by the declaration's `literal` or `repository` derivation. A run whose identity cannot be resolved is never reached, because the declaration is invalid (F-2) or the note is refused (E-2) or the window is refused (E-18) before any read.
2. **Declared order.** Phases and steps execute in declaration order. No step is skipped, reordered, retried, or parallelised.
3. **Per-step verification.** A step's output is written to its declared slot and then read back through the same slot and validated against the declared verification mode. The step is `verified` only when that read-back passes. A failed verification makes the step `unverified`, stops the agenda, and makes the run verdict `unverified`; the run record, the step records, and the produced artifact stay durable so the failure is inspectable.
4. **Durability per step.** Each attempted step appends one step record carrying its index, kind, outcome, duration, artifact reference, and verification verdict, through the state layer's boundary-validated, fenced append. The run's status is a fold over its step records, never a mutable document.
5. **Compaction at declared boundaries.** At the end of each declared phase, the runner folds the phase's completed step outputs into a bounded carried summary (at most 4 096 bytes and 40 lines) and releases the per-step working detail to the durable records. The next phase receives the summary, plus the identifiers of the artifacts it may read. A summary that would exceed the bound is truncated with an explicit omitted count — never silently.
6. **Resume.** A run interrupted after step *k* resumes at step *k+1* from the compacted summary plus the verified step records. Verified steps are never re-executed, never re-verified destructively, and never re-rendered. A resume of a run whose recorded steps contradict its declaration (a missing middle step, a step record for an undeclared index, two records for one index) is refused with the delivered `state.store.torn` identity: the runner does not guess a repair.
7. **Termination.** The run ends `verified` (every step verified, all declared effects landed), `dry-run` (every step verified, `sync` effects deliberately unapplied because `--apply` was absent), or `unverified` (a step failed verification). The verdict is derived from the step fold; there is no separate terminal write to diverge from it.

#### F-5 — Catch-up of a missed scheduled run

- Schedule evaluation is a pure function of the declaration, the injected clock, and the recorded runs: for a cadence, the windows due before now, minus the windows already recorded for that ceremony, are the missed windows. A ceremony whose trigger is an event has no missed windows; its missed obligation is recorded as a declared gap rather than invented.
- `catch-up` executes at most one missed window per ceremony per invocation (`maxMissedWindows: 1`), labelled `trigger.kind: "catch-up"` and carrying the missed window bounds, because replaying a week of daily briefs produces artifacts nobody uses and consumes the time this change exists to reduce.
- A second `catch-up` for the same missed window appends nothing and reports the window as already caught up. A `catch-up` with no missed window is an explicit success: `data.outcome: "nothing-missed"`, zero run records, exit `0`.
- A ceremony with `catchUp.mode: "none"` reports its missed window as a declared gap with the window bounds and no run.
- Catch-up never fabricates a missed window's data: the replayed run reads current inputs and records both the missed window and the execution window.

#### F-6 — Project-declared ceremonies

- **One declaration document.** A project declares its ceremonies in one committed document in the project-committed configuration slot: `<configDirectoryName>/ceremonies.yaml`, schema `delivery.ceremony.declarations.v1`. It carries `schemaVersion` and `ceremonies[]`; every entry is an F-2 declaration.
- **Same contract, no tooling change.** A project declaration uses exactly the vocabularies of F-2. A declaration that validates runs through the same `ceremony run`, the same step dispatcher, the same verifiers, and the same records as a built-in. No new verb, no new flag, no code change, no build step.
- **Read posture.** One bounded read of the committed document per invocation. Absent → the built-ins only, which is the parity path. Present but unreadable or unparseable → the delivered `config.file.malformed` refusal (exit `1`) before any run, because silently dropping a project's ceremonies is worse than refusing. Present with a defective declaration → `ceremony.declaration.invalid` naming the ceremony id and field, before any run, with zero partial registration. No overlay, user-global, or environment source supplies or completes a ceremony declaration; the committed document is the declaration of record.
- **Never shadows a built-in.** A project declaration whose `id` collides with a built-in is refused; a project can add ceremonies but cannot redefine a built-in.
- **Declared, not privileged.** A project declaration can only name declared inputs, declared step kinds, declared output slots, declared verification modes, and declared trigger events. It cannot name a new source, a new slot, a command, a model, or a path to execute.

#### F-7 — The ceremony tier engine

The engine answers one question as data: for a change, which lifecycle phases does its declared tier obligate, and which escalation triggers apply?

**The single mapping.** The engine consumes exactly two delivered declarations and adds no third vocabulary:

| Input | Delivered source | Role |
|---|---|---|
| Plan `tier` | `delivery.plan.v1` required `tier` (`name` in `PLAN_KNOWN_TIERS` = `full`\|`lite`, optional integer `phases`, optional `escalationTriggers`) | Declared intent |
| pm-notes `variant` | `variant: full`\|`lite` (absent means `full`), with `PM_NOTES_REQUIRED_PHASES_BY_VARIANT` | Recorded lifecycle truth |

| Effective tier | Effective phase set | Source (verbatim, no restatement) |
|---|---|---|
| `full` | `clarify_scope`, `specification`, `test_planning`, `delivery_planning`, `dor_check`, `delivery`, `system_spec_update`, `review_fix`, `quality_gates`, `dod_check`, `pr_creation` | `PM_NOTES_REQUIRED_PHASES_BY_VARIANT.full` |
| `lite` | `clarify_scope`, `specification`, `delivery`, `quality_gates`, `dod_check`, `pr_creation` | `PM_NOTES_REQUIRED_PHASES_BY_VARIANT.lite` |

Rules, stated once:

- **Authority.** The pm-notes variant is the recorded lifecycle truth — it is what `verify change` checks for ledger completeness — so it supplies the effective phase set. When the plan's declared `tier.name` disagrees with the variant, the variant governs and the disagreement is reported as a `tier-mismatch` finding in the engine's verdict. The engine never silently picks one, never blocks delivery, and never rewrites either declaration.
- **Plan `tier.phases`.** When a plan declares explicit phase ids, they are validated against the canonical eleven-phase vocabulary. Ids that resolve narrow the effective set to the declared subset for ceremony obligation purposes; ids that do not resolve are reported as `unresolved-phase` findings and are not applied. A plan phase-id list never introduces a phase outside the canonical vocabulary, so it cannot create a second phase-set language.
- **Escalation triggers.** The engine's closed trigger vocabulary is `phase-reopen` (a recorded phase reopen for the change), `dor-rework` (a DoR gate verdict of rework), `review-rework` (a review verdict of rework), `gate-failure` (a failing quality-gate battery verdict), and `owner-escalation` (an open owner-audience blocker question for the change). A plan-declared trigger string that matches a member is evaluated against the delivered evidence for the change; a matched trigger whose evidence is present escalates the effective set to `full` for the remainder of that change and is recorded in the run record as a tier escalation naming the trigger and its evidence. A declared trigger string outside the vocabulary is reported verbatim as `unevaluated` — never dropped, never evaluated as false.
- **Tiered intake.** The engine's verdict is the input to ceremony intake: a ceremony declaration names the tiers it serves, a change's effective tier decides which declared ceremonies carry an obligation, and an escalation re-introduces the obligations the lite set omits. An explicit `ceremony run` is always allowed regardless of obligation; the verdict governs automated and catch-up intake, not operator intent.
- **The lever.** The lite set omits exactly `test_planning`, `delivery_planning`, and `dor_check` — three of the seven phases the committed `MET-CEREMONY-SHARE` definition counts as ceremony. Tiered intake therefore reduces the measurement the ticket targets without touching work phases.

#### F-8 — Durable run records and ceremony-share measurement

- **Run record.** One `ceremony.run` record per run identity: ceremony id, run id, trigger (kind, resolution, declared and actual window, catch-up marker), scope key with its derivation, origin (built-in or project), tier facts consumed (effective tier, phase-set size, escalations), the declaration snapshot digest, start time from the injected clock, and the declaration's phase count.
- **Step record.** One `ceremony.step` record per attempted step: run id, step index, phase index, step kind, outcome, start and end, duration, output slot, artifact reference, and verification verdict. A step attempted twice (a resumed step that failed again) appends again; history is never rewritten.
- **Derived, not stored twice.** Run status, run duration (first step start to last step end), and per-phase durations are folds over the verified records. There is no mutable run document to diverge from the ledger.
- **Measurement contract.** Because every executed step carries a duration and every step belongs to a declared phase, ceremony time becomes computable per ceremony, per phase, and per window, with no self-reported input. That is the mechanism this change owes: the committed `MET-CEREMONY-SHARE` definition is a lifecycle-phase ratio and remains the comparable measurement; the runner's figures are a native second basis and are disclosed as such, never substituted silently.
- **The recorded comparison.** This change produces exactly one committed comparison record, using the committed metric ID, definition, formula, unit, and direction verbatim (no new `MET-` ID, because the definition does not change):

| Member | Contract |
|---|---|
| `metricId` | `MET-CEREMONY-SHARE` |
| `definitionRef` | The committed log's metric row and its `source_commit` |
| `before` | The committed baseline value with its window, sample size, and status (`PARTIAL`, self-reported pm-notes basis) |
| `after` | The same definition and formula recomputed over changes whose ceremony phases were recorded after the runner's delivery boundary, with the window, the per-change values, and the sample size |
| `sampleMinimum` | 5 changes; below it the verdict is `insufficient-sample` |
| `verdict` | `improved`, `regressed`, `flat`, `not-established`, or `insufficient-sample`; `improved` requires `after < before` with the sample minimum met, and no verdict is ever inferred from a single change |
| `nativeBasis` | The runner-derived durations (runs, steps, phases, means) with an explicit statement that this basis is not interchangeable with the committed proxy |
| `disclosure` | Sample size, window, basis difference, and the metric's own limitation text, carried not summarised away |

- **Not this change's surface.** No aggregate report, alarm, threshold, or presentation is added. The record is data inside this change's artifacts and the baseline log; `ados metrics` remains M2-S6's surface (NG-1).

#### F-9 — Retro ceremonies per the retrospective concept

The retro evidence pass is one declaration serving the four levels the retrospective concept defines below R1, and R1 itself stays closeout's own change-level retro.

| Level | Declared trigger | Scope kind | Per-level output |
|---|---|---|---|
| `session` (R2) | event `session-end` | one agent session | A session note: evidence refs, self-error audit observations, near-miss captures, candidate private lessons |
| `incident` (R3) | event `incident-severity` | the incident | An incident note: blameless system-level findings, attribution across originating step, propagation failure, and missed detection, candidate actions |
| `window` (R4) | schedule `daily` | the project window | A window note: cross-change patterns, follow-through verification of open actions, candidate promotions |
| `project` (R5) | event `milestone-end` | the milestone | A project note: memory consolidation candidates, tribal-knowledge graduation, recurrence report |

Contract properties:

- **Declared trigger model.** Each level's trigger is declaration data (F-2). An incident or session retro without a pre-declared trigger is itself a recorded finding, per the concept's rule — the runner reports `undeclared-trigger` rather than inventing a trigger. The declaration's trigger set is exactly the four triggers in the table above: it declares no `change-merged` trigger and serves no R1 level, because R1 stays closeout's own change-level retro (DEC-4, DEC-17), so no firing of this declaration can lack a level. An explicit `ceremony run` records `trigger.kind: "explicit"` and resolves the level's declared trigger from the note's `trigger` member (resolution `note`), so a manual level run still records the trigger that level declares.
- **Follow-through first.** The agenda's first phase is follow-through verification: for every open action recorded for the scope, the step inspects the action's verification artifact and records `applied`, `partial`, or `violated-with-consequence`. A status claim is never evidence. The step is declared first and its position is asserted, so a later edit that moves it fails the parity suite.
- **Fixed note schema.** The note carries the concept's fixed machine-readable schema: level, trigger, window, scope key, participants, evidence refs, facts, interpretations, wins with mechanism, gaps, candidate lessons, actions, confidence. The schema is declared as one identifier and validated on write and on read-back; a note that omits a required member is refused.
- **Idempotent scope keys.** This declaration takes `scopeKey: { kind: "note" }` (F-2), so each level's scope — the session, the incident, the project window, the milestone — is the note's key, and the run identity is `(ceremony, scopeKey, window)`. A rerun for the same scope key at a new window appends an addendum to the note and never rewrites a prior note body; a rerun for the same `(scopeKey, window)` returns the recorded verdict and appends nothing. A note missing its scope key is refused before any output exists (see §5.2).
- **Null retro is a success.** A retro whose evidence supports no finding, no action, and no lesson is a `verified` run with an explicit empty finding set, per the concept. The runner never fabricates a finding to fill a quiet window.
- **Evidence is the delivered pipeline.** The evidence step is a read-only fold over the retro pipeline's verified evidence records and `retro.run` records for the scope and window, plus the level's declared read-only citations. The ceremony adds no collector, no sidecar, no chain, and no truth check; the pipeline's tamper detection, verified-empty explicitness, and `retro.truth.vacuous-run` rule are consumed unchanged.
- **Actions are handed off, not filed.** The agenda records declared actions as a handoff section in the note. Filing, the five-field contract, aging, and closure belong to M2-S10; the ceremony asserts no action row (NG-2).
- **Levels belong to the ceremony layer.** The four levels are ceremony declarations selected by the runner. The retro pipeline's own collection grammar stays `change`-only and its level registry keeps its delivered implementation status; this change adds no retro verb, no level selector, and no second evidence plane (see DEC-4).

### 5.2 Edge Cases

| # | Case | Behaviour |
|---|------|-----------|
| E-1 | A note required by the declaration is absent | Refused as `input.value.rejected` naming the missing note before any read or write; no run record, no artifact |
| E-2 | A note omits its idempotent scope key | Refused as `ceremony.note-invalid` naming `scopeKey`, exit `1`, zero partial ceremony output (SC-M2-S3-02). The same refusal covers a note whose `scopeKey` disagrees with the declaration's own `literal` or `repository` derivation |
| E-3 | A note names a ceremony other than the one being run | Refused as `ceremony.note-invalid` naming both identifiers |
| E-4 | The same `(ceremony, scopeKey, window)` is run twice | The recorded verdict is returned with `data.reused: true`; zero appends; no second note body. A rerun at a new window is a new run identity and appends an addendum to the note body (F-9) |
| E-5 | A run is interrupted mid-agenda | Step records for completed steps stay durable; `resume` starts at the first unverified index; verified steps stay untouched |
| E-6 | A resumed run's records contradict its declaration | `state.store.torn`, exit `2`; the runner does not repair, reorder, or guess |
| E-7 | A collector a render step depends on is unavailable | The artifact renders with that surface's declared degradation (state plus reason); it still conforms and verifies; no zero, no empty claim |
| E-8 | A `sync` step runs without `--apply` | Verdict `dry-run`; the declared write set is computed and precondition-checked, nothing lands, exit `0` |
| E-9 | An affected repository for the mirror sync is absent, dirty, or not on its declared base | The step is `unverified` with the named precondition and that repository; no force path; the run verdict is `unverified` at exit `1`; other targets are still reported per target |
| E-10 | A project declaration collides with a built-in id | `ceremony.declaration.invalid` naming the id; the built-in stays effective; zero partial registration |
| E-11 | The ceremony declaration document is present but unparseable | `config.file.malformed`, exit `1`, before any run; project ceremonies are never silently dropped |
| E-12 | A plan declares a tier the pm-notes variant contradicts | The variant's phase set is effective and a `tier-mismatch` finding is reported; delivery is never blocked by the engine |
| E-13 | A plan declares an escalation trigger string the engine does not know | Reported verbatim as `unevaluated`; never silently false, never dropped |
| E-14 | A ceremony is due and its last run is already recorded for that window | `catch-up` reports `nothing-missed`; zero run records |
| E-15 | A scheduled ceremony's declaration is removed between runs | The recorded run history stays readable; `catch-up` reports the missing declaration as a declared gap rather than inventing a run |
| E-16 | A note item in a testing-session assessment cites no evidence | The item's verdict is `uncovered` with the missing citation named, never `covered`; the assessment still verifies because every item carries a verdict |
| E-17 | Ceremony-share comparison has fewer than 5 post-boundary changes | `insufficient-sample` with the observed n and per-change values; no trend claim, no fabrication |
| E-18 | A note-less event-triggered ceremony is invoked without `--window` | Refused as `input.value.rejected` naming `--window` at exit `1` before any read or write; no run record, step record, or artifact, so no run identity is ever partially resolved (F-1, AC-F4-8) |
| E-19 | A declaration carries no `scopeKey`, a `note` derivation while requiring no note, a malformed literal token, or two schedule triggers | `ceremony.declaration.invalid` naming `scopeKey` or `triggers[]`; nothing is registered and no run with an undefined identity or an ambiguous window is possible (F-1, F-2, AC-F2-4) |
| E-20 | An explicit `ceremony run` of a declaration with several declared triggers and no note resolving one | The run records `trigger.kind: "explicit"` with resolution `unspecified` and names the declaration's declared trigger set; the run is never counted as the fulfilment of a scheduled or event obligation (F-2, AC-F3-8) |

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Scheduled morning brief with catch-up
  Operator/cadence invokes `ceremony catch-up`
    → the runner evaluates every schedule declaration against recorded runs
    → `morning-brief` has one missed daily window
    → the declaration's agenda runs: collect → render → record
    → the render is read back from the ceremony-artifact slot and validated against delivery.brief.v1
    → the step record and run record land; the run is labelled trigger.kind=catch-up with the missed window
    → verdict `verified`, exit 0; a second catch-up reports nothing-missed and appends nothing
```

```
Flow 2 — Retro evidence pass at the window level (follow-through first)
  A daily `window` retro is due
    → intake validates the note: level, trigger, window, scope key, participants, evidence refs, facts,
      interpretations, wins-with-mechanism, gaps, candidate lessons, actions, confidence
    → phase 1: follow-through verification inspects each open action's verification artifact
      (applied | partial | violated-with-consequence), never the owner's status claim
    → phase 2: the evidence fold reads the retro pipeline's verified evidence and run records for the window
    → phase 3: insights are written as facts-with-evidence-refs and interpretations-with-confidence
    → phase 4: declared actions are written as a handoff section (filing stays M2-S10)
    → phase 5: the note is written to the memory slot and read back against the fixed schema
    → verdict `verified`, exit 0, with the follow-through section carrying at least one verified action
  A note without `scopeKey` refuses earlier: `ceremony.note-invalid` naming scopeKey, exit 1, nothing written
```

```
Flow 3 — A project declares its own ceremony
  A project commits <configDirectoryName>/ceremonies.yaml with one declaration:
    trigger schedule weekly at 06:00 UTC; inputs: the delivered audit-ledger read, queue facts;
    agenda: collect → fold → render → record; outputs: ceremony-artifact; verify: artifact-conforms;
    catchUp: once; compaction at the single phase boundary
    → `ceremony list` shows it with origin `project`
    → `ceremony run <project-ceremony>` executes through the same steps, verifiers, and records
    → zero tooling change: the same binary, the same path, the same verification discipline
  A defective declaration refuses at load: ceremony.declaration.invalid naming id and field
```

```
Flow 4 — Tiered intake and escalation
  A change's plan declares tier lite; its pm-notes record variant lite
    → the tier engine returns the pinned six-phase set from PM_NOTES_REQUIRED_PHASES_BY_VARIANT.lite
    → ceremony intake obligates only the ceremonies whose `tiers` include lite
    → a review verdict of rework is recorded for the change
    → the declared escalation trigger `review-rework` matches with present evidence
    → the effective set escalates to full for the remainder of the change; the escalation is
      recorded with the trigger and its evidence
    → the run record carries the effective tier, the phase-set size, and the escalation
```

```
Flow 5 — Decision-record mirror sync before dispatch
  A dispatch is requested into repository R, which the mirror-sync declaration names as an affected target
    → the `pre-dispatch` obligation resolves the mirror-sync declaration, and the invoking window is supplied
      (`--window` is required here because this declaration is event-triggered and takes no note)
    → collect: the decision register projection and R's current mirror state
    → sync (dry-run unless --apply): compute R's declared write set, check R is a declared target,
      clean, and on its declared base; with --apply, land one idempotent mirror commit per target
    → render: the mirror report; verification: R's mirrored record set equals the register set for R
    → verdict `verified` (applied) or `dry-run` (computed, not applied)
    → a drift after verification is `unverified` at exit 1, naming the target and the drift
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The `ceremony` root family with exactly `list`, `run`, `resume`, `catch-up`, mounted through the prompt-required set, the production composition, family and verb help, an M2 reference page, and a coverage-inventory row.
- The ceremony declaration contract with its closed vocabularies, bounds, validation, and refusal identities.
- The six built-in declarations and their parity obligations.
- Deterministic artifact-verified execution, per-step durability, compaction at declared boundaries, and resume.
- Catch-up of a missed scheduled window, exactly once, with an explicit nothing-missed outcome.
- Project ceremony declarations in one committed document, running through the same runner with no tooling change.
- The ceremony tier engine over the delivered plan tier and pm-notes variant, with the single mapping, the closed escalation-trigger vocabulary, tiered intake, and the finding-based reporting of disagreement and unevaluable triggers.
- The two additive `ceremony.` state record kinds with boundary validation, fenced appends, and derived run status.
- The ceremony-share comparison record from committed data, plus the native runner-duration basis disclosed beside it.
- Retro ceremonies at `session`, `incident`, `window`, and `project` with declared triggers, follow-through-first agenda, fixed note schema, idempotent scope keys, per-level outputs, and null-retro success.
- The two additive error identities, their documented rows, the `ceremony` domain kind, and the reserved two-segment allowlist extension.
- The documentation deltas enumerated in Appendix C, including the new guide's distribution marker.

### 7.2 Out of Scope

- [OUT] The `ados metrics` surface, ceremony-share presentation, alarms, thresholds, aggregation, and burn-rate reporting (M2-S6). This change delivers data and one committed comparison only.
- [OUT] The retro action registry: the five-field contract, filing, artifact and outcome closure, aging nudges, escalation, rollback conditions, and the board surface (M2-S10).
- [OUT] Custom ceremony packs: a distributable, versioned, importable pack format, pack registries, pack signing, and pack upgrade semantics.
- [OUT] Continuous schedule driving: daemon integration, cron/systemd units, timers, and unattended cadence. The runner evaluates schedules and offers catch-up; it never sleeps, self-schedules, or spawns a process.
- [OUT] Any change to the retro pipeline: no new `retro` verb, no `--level` grammar change, no new collector, no new evidence record kind, no level-registry status change, no change to its truth checks or its keyed chain.
- [OUT] Any change to the closeout transaction, including its change-level (R1) retro and its session-compaction checkpoint.
- [OUT] New event topics or event kinds; the run record is the observability surface.
- [OUT] An MCP tool, resource, or prompt for ceremonies.
- [OUT] `board`, `status`, and `brief` render surfaces for ceremony state (M2-S4 and later).
- [OUT] Memory-record schema or memory-lint changes; the retro ceremony writes through the delivered archive convention and the delivered record schema.
- [OUT] Cross-repository ceremony coordination (one ceremony spanning member repositories) — ceremonies are per-repository in this change.
- [OUT] Any LLM, model, or agent invocation inside a ceremony step; no step kind exists for one.

### 7.3 Deferred / Maybe-Later

- A ceremony run-history read verb (full history, pages, filters) once M2-S6 needs it.
- A native `MET-` metric ID for runner-measured ceremony time, allocated by the measurement log's allocator when a definition change is justified.
- Ceremony packs: built-in and project declarations packaged for reuse across repositories.
- Ceremony-driven scheduling admission (a missed ceremony blocking a dispatch) once the obligation model has run for a milestone.
- Ceremony state on the board beside lanes, gates, asks, and parked work.
- Per-ceremony cost attribution once telemetry v2 attribution covers non-delivery work.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface is added or changed. The observable interface is the CLI grammar of F-1 and its `delivery.result.v1` envelope: one positional (the ceremony name, for `run`; the run id, for `resume`), three command-specific flags (`--note <path>`, `--window <start>..<end>`, `--apply`), and the three global flags. No MCP tool mirrors the family in this change (NG-7); the engine is composed by the CLI edge only, so an MCP surface can later project the same engine without a second contract.

### 8.2 Events / Messages

No new topic and no new event kind. The six delivered topics and their kinds are unchanged, and the ceremony runner publishes nothing to them: ceremony state is durable state, not an event stream. The retro registry's `memory-audit` trigger keeps its delivered declaration and gains a consuming ceremony rather than a new trigger record; scheduled invocation now has a runner, which is what the pipeline's contract reserved for M2-S3. Phase-transition, commit, and closeout events are read as inputs where a declaration cites them, never written.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Ceremony declaration contract | `delivery.ceremony.declarations.v1`: `schemaVersion` plus `ceremonies[]`, each entry exactly the F-2 member set with `scopeKey` required. Closed vocabularies: step kinds (`collect`, `fold`, `render`, `assess`, `sync`, `record`), output slots (`memory`, `ceremony-artifact`, `state-record`, `mirror-target`), verification modes (`artifact-conforms`, `artifact-covers-items`, `artifact-equals-source`), trigger events (`session-end`, `incident-severity`, `milestone-end`, `change-merged`, `owner-note`, `pre-dispatch`), cadences (`daily`, `weekly`, `milestone`, `iteration`), catch-up modes (`once`, `none`), scope-key derivations (`literal`, `repository`, `note`), recorded trigger kinds (`schedule`, `event`, `catch-up`, `explicit`), recorded trigger resolutions (`note`, `declaration`, `unspecified`), assess verdicts (`covered`, `partial`, `uncovered`, `not-applicable`), run verdicts (`verified`, `dry-run`, `unverified`). Bounds: ≤16 ceremonies per document, ≤12 phases, ≤32 steps, ≤16 inputs, ≤8 targets, 1 MiB document, id `^[a-z][a-z0-9-]*$` ≤64 characters, unique, and at most one schedule trigger per declaration so a note-less window is never ambiguous. No member may carry executable content, a model reference, or a free-form instruction. |
| DM-2 | Ceremony note contract | `delivery.ceremony.note.v1`: required `schemaId`, `ceremony`, `scopeKey`, `window` (`start` ≤ `end`), `trigger`; the retro declaration additionally requires the concept's fixed members — `level`, `participants`, `evidenceRefs`, `facts`, `interpretations`, `wins` (each with mechanism), `gaps`, `candidateLessons`, `actions`, `confidence`. `scopeKey` is the idempotency anchor and is required on every note; the run's scope key is the note's value when the declaration's derivation is `note`, and must equal the declaration's `literal` or `repository` key otherwise (F-2 precedence). A note without it is `ceremony.note-invalid` naming `scopeKey`, before any output. `trigger` names the declared trigger the note's level or ceremony stands for, and resolves an explicit run's recorded trigger. Addenda are appended to the note body and never replace it. |
| DM-3 | `ceremony.run` record | Additive state kind, payload schema `delivery.ceremony.run.v1`, key `ceremony.runs:<runId>`: ceremony id, run id, origin (`built-in`\|`project`), declaration snapshot digest, trigger (`kind` from `schedule`\|`event`\|`catch-up`\|`explicit`, `resolution` from `note`\|`declaration`\|`unspecified`, the declared trigger reference or the declared trigger set where resolution is `unspecified`, the declared window, the actual window, the catch-up marker), scope key with the derivation that produced it (`literal`\|`repository`\|`note`), tier facts (`effectiveTier`, `phaseSetSize`, `escalations[]` with trigger and evidence), injected-clock start, declared phase count. Append-only; one record per run identity, so the identity is readable from the record and never recomputed. |
| DM-4 | `ceremony.step` record | Additive state kind, payload schema `delivery.ceremony.step.v1`, key `ceremony.steps:<runId>:<index>`: run id, step index, phase index, step kind, outcome, start, end, duration ms, output slot, artifact reference, verification verdict, and an optional classified reason. One record per attempted step; a re-attempt appends again. |
| DM-5 | Ceremony record boundary | The two kinds are declared in one artifact boundary under the `ceremony.` key prefix with their identity fields, required fields, and closed vocabularies. A nonconforming write refuses `state.store.unknown` with `not_landed` and fills no default; reads classify valid, verified-empty, torn, and unknown distinctly, and an entry-level malformation is classified in band rather than crashing. Appends use one single-writer fence and a post-append verified re-read requiring exactly one new record. Run status, run duration, and per-phase durations are pure folds over verified records; no derived run document exists. |
| DM-6 | Ceremony artifact family | The `ceremony-artifact` output slot is a per-repository file family in the state directory, one artifact per run, named by run id, `0600`, forever retention, outside the ledger and outside the derived-document set. It is not a state record kind and never enters salvage, repair, or index rebuild. Each artifact declares its schema identifier; a render that cannot be read back fails its step's verification. |
| DM-7 | Tier verdict | The engine's data verdict: `effectiveTier`, `phaseSet[]` (in canonical order), `phaseSetSource`, `declaredTier`, `declaredVariant`, `escalationTriggers[]` (each `matched`\|`unmatched`\|`unevaluated` with the declared string verbatim), `escalations[]` (trigger, evidence reference, effective-from phase), and `findings[]` (`tier-mismatch`, `unresolved-phase`, `unevaluated-trigger`, each naming its subject). Additive `data.tier` on `ceremony run`, `ceremony list`, and the comparison record; no new error identity is used for a finding. |
| DM-8 | Ceremony-share comparison record | One committed record per delivery, carrying `metricId` (`MET-CEREMONY-SHARE`), `definitionRef` (log path plus `source_commit`), `before` (value, window, sample size, status, basis), `after` (value, window, per-change values, sample size, basis), `sampleMinimum` (5), `verdict` (`improved`, `regressed`, `flat`, `not-established`, `insufficient-sample`), `nativeBasis` (runner durations with the non-interchangeability statement), and `disclosure`. Additive `comparisons[]` entry in the committed measurement log under a declared schema-version bump; existing metric rows and their values are untouched, and no `MET-` ID is reallocated because the definition does not change. |
| DM-9 | Error identities and the two-segment allowlist | Two additive `ERROR_TABLE` rows under a new `ceremony` domain kind. `ceremony.note-invalid`: `user`, not retryable, `not_landed`, `user-validation` (exit `1`), naming the missing or malformed note field. `ceremony.declaration.invalid`: `user`, not retryable, `not_landed`, `user-validation` (exit `1`), naming the ceremony id and field. `ceremony.note-invalid` is a two-segment code, so it joins the reserved two-segment allowlist (52 → 53) in the sync check and the structural suite. The documented table grows from 136 to 138 identities. Both rows carry their documented counterpart in the same delivering boundary; the `ceremony` kind requires an exact code, so an undeclared or missing code is contained by `fallback.internal`. |

**Additive documented error rows (two-way sync).**

| Code | Domain kind | Category | Retryable | Consequence | Projection class | Exit | Emitted when |
|---|---|---|---|---|---|---|---|
| `ceremony.note-invalid` | `ceremony` | `user` | `false` | `not_landed` | `user-validation` | `1` | A ceremony note required by the declaration is absent, omits a required member, or omits its idempotent scope key; the error names the field (`scopeKey` for SC-M2-S3-02) and no partial ceremony output is written |
| `ceremony.declaration.invalid` | `ceremony` | `user` | `false` | `not_landed` | `user-validation` | `1` | A built-in or project ceremony declaration violates the contract (unknown step kind, input, output slot, verification mode, trigger event, or tier; missing verification; missing output schema; duplicate id; built-in collision; unparseable schedule; over-bound collection); the error names the ceremony id and field and registers nothing |

### 8.4 External Integrations

N/A — no vendor, API, credential, or network surface is added. Every input is a delivered local read (state ledger, memory tree, committed documents, artifact files); the only write outside the ceremony family's own artifacts is the declared mirror sync into an affected repository, which composes the delivered commit primitive and the delivered checkout preflight vocabulary. No model provider is called; the render and verification paths contain no inference client.

### 8.5 Backward Compatibility

- **No delivered command changes behaviour.** The grammar, payloads, exits, records, human text, and failure summaries of every existing family are untouched. The morning brief ceremony consumes the brief projection; it does not modify the `brief` command.
- **The envelope is unchanged in shape.** Five keys, `data` XOR `error`, exits in `{0, 1, 2}`. Every new field is under `data`; no `error.detail` member is added and no `ok`/`command` key appears.
- **The error table grows by exactly two rows and one domain kind**, and the documented table by exactly two rows; the two-segment allowlist grows by exactly one entry (`ceremony.note-invalid`). No delivered row is renamed, reworded, re-projected, or removed, and the sync check stays binding in both directions.
- **State is additive.** Two new record kinds under a new `ceremony.` prefix, no schema-version bump, no migration, no change to the store layout's existing artifacts, and no change to any delivered boundary. An existing reader that never touches the `ceremony.` prefix sees the same store.
- **The retro pipeline is byte-identical.** Its commands, evidence records, registry records, identities, chain, level registry status, and refusals are unchanged. The ceremony is a consumer; the pipeline gains no verb and no collection path.
- **The closeout is byte-identical**, including its change-level retro coverage read.
- **The prompt-required set grows by one family** (twenty → twenty-one), with the composition, help entries, reference page, and coverage-inventory row that mounting requires; the structure test that asserts the prompt-set count is updated in the same change.
- **The plan and pm-notes contracts are unchanged.** The tier engine consumes the delivered declarations as they are; a plan that declares an unknown tier keeps its delivered `plan.tier.unknown` refusal, and a plan declaring `full` or `lite` keeps validating exactly as before.
- **The measurement log's existing values are immutable.** The additive `comparisons[]` key arrives with a declared schema-version bump; no committed metric value, sample counter, definition, or window is edited, and no reader that selects metrics by ID is affected.
- **No project sees a change by default.** A repository with no ceremony declaration document gets the built-ins and no project ceremony; a repository that never invokes `ceremony` sees no new files and no new state records.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Envelope and exit continuity | 0 new top-level envelope keys; every new field under `data`; exits in `{0, 1, 2}` only; 0 new exit values; `data` XOR `error` on 100% of outcomes |
| NFR-2 | Deterministic render and verification, zero model calls | Identical injected inputs, clock, and declaration produce byte-identical artifacts and human text; 0 inference-client imports, 0 model identifiers, 0 network modules, 0 ambient clock/random/environment reads in the fold, render, verification, and tier paths — asserted structurally with a failing control |
| NFR-3 | Artifact-verified completion | 100% of declared steps carry a verification mode; 100% of `verified` steps passed a read-back validation; 0 steps whose completion is asserted by outcome alone; 0 over-bound declarations accepted |
| NFR-4 | Resume correctness | After an interruption at step *k* of *n*, re-executed verified steps = 0 and total step records for the run ≤ *n* + the re-attempts of the failed step; a contradicted record sequence refuses as `state.store.torn` with 0 writes |
| NFR-5 | Idempotency | Duplicate run records for one `(ceremony, scopeKey, window)` = 0; duplicate note bodies = 0 (addenda only); a repeat `catch-up` for a caught-up window appends 0 records |
| NFR-6 | Catch-up boundedness | ≤1 missed window replayed per ceremony per invocation; 0 fabricated windows; a no-miss catch-up appends 0 records and exits `0` |
| NFR-7 | Bounded carried state and output | Compacted phase summary ≤4 096 bytes and ≤40 lines with an explicit omitted count on truncation; run record ≤16 KiB serialized; step record ≤2 KiB serialized; render artifacts inherit their family bound (`delivery.brief.v1` stays ≤65 536 bytes serialized data); declaration document ≤1 MiB |
| NFR-8 | Error-table binding | Exactly 2 rows added, exactly 1 domain kind added, exactly 1 reserved two-segment entry added; 100% two-way sync between the machine table and the documented table; 0 delivered rows changed |
| NFR-9 | Tier neutrality | Exactly 2 phase-set sources consumed (the delivered plan tier declaration and the delivered pm-notes per-variant sets); 0 additional phase-set vocabularies, 0 tier names outside `full`\|`lite`, 0 hardcoded default phase sets outside the delivered per-variant data — asserted structurally |
| NFR-10 | Measurement completeness | 100% of executed steps carry a duration; 100% of runs carry a start and a derivable duration; 100% of comparison records carry before, after, sample size, sample minimum, verdict, and disclosure; 0 trend claims below the sample minimum |
| NFR-11 | Read and run cost | `ceremony list` ≤ 2 verified state reads and 1 bounded declaration read; `ceremony run` performs 1 declaration read, ≤16 declared input reads, and ≤1 verified state read per fenced append; `resume` performs ≤2 verified state reads plus the declared remaining steps; `catch-up` performs 1 declaration read and ≤2 verified state reads per ceremony; 0 retries, 0 pagination crawls, 0 child processes, 0 network calls |
| NFR-12 | Mirror-sync safety | ≤8 declared targets per declaration; 100% of targets verified contract-conformant after a `sync`; 0 force paths; 0 writes to an undeclared repository; 0 writes without `--apply`; a target whose mirror set differs in either direction yields `unverified` with the target named |
| NFR-13 | Duration budget | `ceremony run morning-brief` ≤ 30 s at declared collector caps on the reference environment; `ceremony run retro-evidence-pass` (window level) ≤ 60 s over a 10 000-record evidence sidecar; `resume` ≤ 10 s when ≤5 steps remain; `catch-up` ≤ 60 s over six declarations |
| NFR-14 | Quality gates and commit hygiene for the delivering change | `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR opens; conventional commit subjects scoped `GH-296`; every body and footer line ≤100 characters; PR targets `main-tools` and stays open |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

No metric, exporter, log sink, or event is added. Observability is the durable record set plus one committed comparison:

- **What ran.** The `ceremony.run` record names the ceremony, its origin, its trigger (kind, resolution, declared and actual window, catch-up marker), its scope key and that key's derivation, the injected start, and the tier facts it consumed.
- **What each step did.** The `ceremony.step` record names the step, its phase, its kind, its outcome, its duration, its artifact, and its verification verdict, so a reader can see which step failed, how long each took, and which artifact proved it.
- **How long.** Durations are stored per step and derived per phase and per run; the derived figures are what make ceremony time computable with the committed metric's basis, and the comparison record discloses the basis difference between the proxy and the native measurement.
- **What was skipped and why.** A declared gap (`catchUp.mode: none`), a `nothing-missed` outcome, a `dry-run` verdict, and an `unverified` step are all explicit and distinguishable; nothing is silent.
- **What the tier engine decided.** Findings (`tier-mismatch`, `unresolved-phase`, `unevaluated-trigger`) and escalations (trigger plus evidence) travel with the run so a tier decision is auditable after the fact.
- **Rendered surfaces.** Human output is a bounded, deterministic summary — one line per ceremony for `list`, one line per step plus a verdict line for `run` and `resume`, one line per ceremony plus a total for `catch-up` — naming state, never a raw payload, never a secret, at most 32 lines and 6 144 bytes with an explicit omission marker.
- **No aggregation surface.** Totals across runs, alarm thresholds, and trend presentation are M2-S6's; this change records, it does not report a metric.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The declaration vocabulary is too narrow, so a real ritual needs a step kind it cannot express and the "no tooling change" promise fails on first contact | H | M | The six built-ins are the expressiveness proof and are declared in exactly the project vocabularies; a parametric acceptance case runs a declaration-only ceremony; a missing vocabulary is a reviewed contract extension, never a silent code path | M |
| RSK-2 | The runner becomes an accidental scripting surface (a declaration that names a command, a model, or a path) | H | L | The vocabularies are closed and validated; no member can carry executable content, a model reference, or a path to run; a project declaration cannot name a new source, slot, verifier, or step kind; structure tests assert the absence of an execution member | L |
| RSK-3 | The mirror sync writes into other repositories, and a bad declaration or a dirty target produces drift or an unintended commit | H | M | Dry-run default with `--apply` as the only landing path; declared targets only (≤8) verified contract-conformant; clean-checkout and declared-base preconditions with no force path; `artifact-equals-source` verification; the delivered commit primitive lands the mirror commit | M |
| RSK-4 | Ceremony share is claimed to improve from a sample too small to support it, which is the exact vanity-metric failure the retro concept warns about | M | M | The comparison record carries the sample, the minimum, the basis difference, and the metric's own limitation; `improved` requires the minimum met; `insufficient-sample` is a first-class verdict and a tested case | L |
| RSK-5 | The runner increases ceremony time instead of reducing it (more rituals, more often) | H | M | Tiered intake is the declared lever; catch-up replays at most one window; declarations are bounded; per-step durations make the cost visible; the comparison record exposes a regression instead of hiding it | M |
| RSK-6 | Tier mapping drifts into a second phase-set vocabulary or silently overrides pm-notes | M | M | One mapping table sourced verbatim from delivered data; the variant governs and disagreement is a finding; a structural test fails on a hardcoded default phase set or an unknown tier name | L |
| RSK-7 | The retro levels appear implemented in the pipeline, producing a contradictory contract | M | M | The boundary is stated once (DEC-4): the ceremony layer selects levels; the pipeline's grammar and registry status are unchanged; the pipeline spec keeps its delivered wording | L |
| RSK-8 | The measurement-log schema bump breaks a consumer that pins `schema_version: 1` | M | L | The change is additive (a new `comparisons[]` key, no metric row edited), the bump is declared in the schema-version field and the spec, and the only planned consumer (M2-S6) reads metrics by ID; the version is asserted by the log's own spec update | L |
| RSK-9 | State growth from a record per step per run | M | M | One run record plus *n* step records per run; reconciliation blocks in both directions remain intact; retention follows the state layer; no compaction of history and no derived document to rebuild; the run identity prevents duplicate records | L |
| RSK-10 | A ceremony that verifies a stale artifact (a file left by a prior run) reads as verified | M | L | Artifacts are named by run id, never by ceremony id; a step verifies the artifact it just wrote in this run; a resumed run reads only verified records of the same run | L |
| RSK-11 | Documentation drift across the new spec, the new guide, the M2 pack, the registry, the entrypoint delta, the baseline log and its spec, and the two error tables | M | M | Appendix C enumerates every delta with its phase; the error-table sync gate and the distribution guard cover the mechanical parts | L |
| RSK-12 | Scope creep into M2-S6 metrics or M2-S10 actions under pressure to "finish the loop" | M | M | §7.2 names both exclusions and NG-1/NG-2 restate them; the ceremony records a handoff and asserts no action row and no aggregate | L |

## 12. ASSUMPTIONS

- The declared local reads (status collector facts, brief projection, retro evidence and registry, spend fold, audit ledger, harness telemetry, queue and lane facts, tracker state, pm-notes, decision register, measurement log, memory tree) are sufficient for the six built-ins; no new collector is needed and none is added.
- A ceremony's environmental state (clock, ids, fence tokens, brand, input readers, and the state port) is injected the way every other command surface injects it, so a run is reproducible in process with no live network, credential, or child process in the default suites.
- The invoking repository's normalized identity (`host/owner/name`) is available to the ceremony edge from the delivered repository identity resolver, so a `repository` scope-key derivation is a delivered read and introduces no collector and no new input source.
- The committed measurement log is the allocator of `MET-` IDs and remains so; this change reuses `MET-CEREMONY-SHARE` because it does not change the definition.
- The project-committed configuration slot is the correct home for a project's ceremony declarations, and the delivered configuration layer's size, permission, and classification rules apply to that document.
- The retro archive in the committed memory tree is the home of retro ceremony notes, and its index is regenerated by the delivered convention rather than by this runner.
- A plan's `tier` declaration and a change's pm-notes `variant` normally agree; disagreement is an anomaly to report, not a state to resolve silently.
- The five closed escalation triggers (phase reopen, DoR rework, review rework, gate failure, owner escalation) are the lifecycle evidence that exists today and is recorded; a new trigger is a reviewed contract extension.
- The ticket's declared dependencies (M0-S6, M0-S13, M1-S8) are delivered on `main-tools`, which the clarify phase verified.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Status digest (M0-S6) and brief (M1-S6) | Morning brief inputs and the `delivery.brief.v1` render contract; consumed read-only |
| Depends on | Retro evidence pipeline (M1-S8) | Verified evidence records, `retro.run` records, the four `retro` identities, and the memory-audit seam |
| Depends on | Machine-readable plan (M1-S13) | `PLAN_KNOWN_TIERS`, the required `tier` declaration, and `plan.tier.unknown` |
| Depends on | pm-notes lint and phase transitions | `variant` and `PM_NOTES_REQUIRED_PHASES_BY_VARIANT` — the pinned per-tier phase sets |
| Depends on | State layer | Ledger, artifact boundaries, fenced appends, classified damage, store-managed artifacts, retention |
| Depends on | Commit primitive (M1-S14) | Landing path for the mirror sync's declared writes into an affected repository |
| Depends on | Memory tree and retro archive (M2-S8) | Home of retro notes and the index convention |
| Depends on | Measurement baseline | The committed metric definition, formula, window, status semantics, and comparison protocol |
| Depends on | Entrypoint and self-description | Prompt-required composition, family help, reference-page coverage |
| Depends on | Closeout (M1-S12) | The mechanical-ceremony precedent this contract generalises |
| Blocks | `ados metrics` (M2-S6) | The metric surface consumes runner durations and the recorded comparison; M2-S6 records `Depends on: M1-S19, M2-S3, M2-S14`, so the edge is in the backlog |
| Feeds (edge not recorded in the backlog) | Retro action registry (M2-S10) | The registry is expected to consume the retro ceremony's action handoff, and this change ships no registry (NG-2, §7.2); the backlog records `Depends on: M1-S8` only for M2-S10, so no recorded blocks edge is claimed here |
| Feeds (edge not recorded in the backlog) | Board ceremony surface (M2-S4 and later) | Ceremony state becomes available to a render surface, and this change ships no board surface (§7.2); M2-S4's recorded `Depends on` set does not name M2-S3, so no recorded blocks edge is claimed here |
| Blocked by | none | No open upstream gate; the ticket's three dependencies are delivered |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Does ceremony run history deserve its own read verb now (`ceremony list --runs`, pages, filters), or is the last-run summary plus the durable records enough until M2-S6? | A read verb is a contract addition; M2-S6 may need history anyway. Proposed: ship the last-run summary now, keep history in the records, and let M2-S6 add the read if it needs one. | Open (non-blocking) — proposed resolution may be adopted by plan authoring; otherwise Decision needed: consult `@decision-advisor` |
| OQ-2 | Should the comparison record carry an aggregate native ceremony-time figure (per ceremony mean and p90) beside the per-run durations? | The ticket asks for a trend on the committed metric; the native basis is supplementary. Proposed: per-ceremony counts, means, and p90 for the observed runs, with the non-interchangeability disclosure, and no cross-metric aggregation. | Open (non-blocking) — proposed resolution may be adopted by plan authoring; otherwise Decision needed: consult `@decision-advisor` |
| OQ-3 | Is the `pre-dispatch` obligation advisory or blocking once the mirror sync exists? | Blocking would make a stale mirror refuse a dispatch, which is a scheduling-policy decision beyond this contract. Proposed: advisory in this change — the obligation is reported with drift as a finding, and blocking admission is deferred (§7.3). | Open (non-blocking) — proposed resolution may be adopted by plan authoring; otherwise Decision needed: consult `@decision-advisor` |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Ceremony-share measurement in this change is scoped to durable run records plus one recorded before/after comparison using the committed `MET-CEREMONY-SHARE` definition; the `ados metrics` surface belongs to M2-S6 and is out of scope | Recorded planning decision. Reporting is a different story's contract; this change owes the data and its own AC evidence, not a metric surface | 2026-11-15 |
| DEC-2 | The tier engine consumes the delivered plan `tier` declaration and the delivered pm-notes `variant` phase sets as the only two phase-set sources, with one mapping and the recorded variant governing on disagreement | Recorded planning decision. Inventing a third vocabulary would fork the lifecycle contract and break `verify change`'s ledger semantics | 2026-11-15 |
| DEC-3 | The retro action registry and its five-field contract stay M2-S10; the retro ceremony consumes the delivered retro pipeline and records actions as a handoff | Recorded planning decision. Filing and closure are M2-S10's contract; duplicating them here would ship two registries | 2026-11-15 |
| DEC-4 | The four retro levels below R1 are selected and scheduled by the ceremony layer; the retro pipeline's own collection grammar stays `change`-only, its level-registry status is unchanged, and the ceremony reads the pipeline's verified evidence and run records | The pipeline's contract already reserves scheduled invocation for M2-S3; adding a level selector and a per-level collection path would be a second evidence design and a much larger change. The ceremony level is declaration data and per-level output is the delivery | 2026-11-15 |
| DEC-5 | Exactly two new error identities (`ceremony.note-invalid`, `ceremony.declaration.invalid`); a failed artifact verification is a data-bearing negative verdict at exit `1`, not an error row | The result contract's delivered precedent makes a report-carrying negative verdict data at exit `1` (plan validate, plan overlap, the cross-repository gate report); verification failure is a verdict, not a failure identity | 2026-11-15 |
| DEC-6 | Ceremony definitions are contract data; project declarations are one committed configuration document (`<configDirectoryName>/ceremonies.yaml`) with closed vocabularies; no declaration may carry executable content | "Projects declare their own ceremonies without a tooling change" is only true if the vocabulary is closed, complete, and data-only; a document of record also keeps unreviewed overlays out of the policy path | 2026-11-15 |
| DEC-7 | The ceremony note is the idempotency anchor: `scopeKey` is required by every note-consuming ceremony, and a rerun for the same identity appends an addendum and appends no duplicate run (generalised by DEC-16: the anchor is the declaration's scope key, which a note supplies where the declaration asks it for one) | The retrospective concept's rule (scope keys make reruns idempotent; reruns append, never rewrite) applies to every note-producing ceremony, and the inherited scenario pins the refusal identity | 2026-11-15 |
| DEC-8 | The measurement log gains an additive `comparisons[]` list under a declared schema-version bump; existing metric rows and values are untouched; no `MET-` ID is reallocated | AC1 needs a committed comparison with the committed definition; the log's comparison protocol forbids inventing a new ID for an unchanged definition, and immutability forbids editing values | 2026-11-15 |
| DEC-9 | No new event topic and no MCP tool; the run and step records are the observability surface | The event taxonomy is a closed M2 contract owned by M2-S13, and the ceremony surface's consumer is the operator and the metric layer, not a subscriber | 2026-11-15 |
| DEC-10 | The family mounts through the prompt-required set plus an M2 reference page and a coverage-inventory row | Delivered mounting rule: a family reachable only when it is prompt-required, composed, helped, and documented, or root `--help` and the coverage gate disagree | 2026-11-15 |
| DEC-11 | Compaction is carried-state compaction at declared phase boundaries with a 4 096-byte/40-line bound and an explicit omitted count; run history is never compacted | The closeout precedent and the concept's anti-pattern list both require bounded context and no wholesale rewriting of history | 2026-11-15 |
| DEC-12 | A `sync` step is dry-run by default and lands only with `--apply`; a dry run is a `dry-run` verdict at exit `0` | The closeout's dry-run default is the delivered safety posture for a ceremony with real side effects, and it gives a verifiable rehearsal path | 2026-11-15 |
| DEC-13 | The tier engine's closed escalation-trigger vocabulary is `phase-reopen`, `dor-rework`, `review-rework`, `gate-failure`, `owner-escalation`, each bound to delivered evidence; an unknown declared string is reported `unevaluated` verbatim | Escalation needs evaluable triggers; these five are the delivered lifecycle verdicts, and plan-inert strings must not be silently dropped or silently false | 2026-11-15 |
| DEC-14 | The after-window sample minimum is 5 changes sharing the metric definition and window; below it the verdict is `insufficient-sample` and no trend is claimed | Prevents the vanity-metric failure the concept names; one change cannot establish a trend, and the AC is satisfiable by an honest sample disclosure | 2026-11-15 |
| DEC-15 | Ceremony declaration and note documents are read only from the project-committed slot; no overlay, user-global, or environment source supplies or completes them | Mirrors the delivered configuration posture for policy-data nodes: an unreviewed overlay must not be able to change what the factory runs | 2026-11-15 |
| DEC-16 | The scope key is a required declaration member with a closed derivation set (`literal`, `repository`, `note`); a note supplies the key only where the declaration asks it (`note`), a declared derivation wins elsewhere, and a note that disagrees is refused rather than silently overridden | The run identity is load-bearing (intake, run record, note idempotency, the duplicate-record target) and four of six built-ins take no note, so a note-only source left the identity of the majority of ceremonies — and of any note-less project declaration — undefined and forceable by the coder. Declaration-held derivation keeps one closed, data-only source, keeps the inherited note refusal, and needs no new flag | 2026-11-15 |
| DEC-17 | The retro evidence pass declares exactly the four sub-R1 level triggers and no `change-merged` trigger; an explicit `ceremony run` records `trigger.kind: "explicit"` with a resolution of `note`, `declaration`, or `unspecified`, and is never counted as a scheduled or event obligation | R1 stays closeout's own retro (DEC-4) and the delivered registry maps no sub-R1 level to `change-merged`, so a `change-merged` firing had no level and no output. Naming the recorded kind for a manual invocation closes the other half of the same hole without adding a flag to a three-flag grammar | 2026-11-15 |
| DEC-18 | A note-less event-triggered declaration requires `--window` and is refused with `input.value.rejected` when it is omitted; a note-less scheduled declaration derives its window from the injected clock at its cadence's UTC unit (day, ISO week, iteration, milestone), and a declaration declares at most one schedule trigger so that derivation is single-valued | The mirror sync is event-triggered, note-less, and the highest-blast-radius built-in, so a derived window would make its identity and dedupe a guess; requiring the window is the safe form. The scheduled derivation is taken from the cadence rather than from a separate granularity member on purpose: a granularity coarser than the cadence would collapse two due windows into one run identity, which is the dedupe bug the identity exists to prevent | 2026-11-15 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Core contracts — ceremony vocabulary | New: declaration contract, note contract, closed vocabularies, bounds, trigger and verdict vocabularies, the six built-in declarations, run and step record payload schemas, tier verdict types, comparison record types, and the two error identities with the `ceremony` domain kind |
| Core domain — ceremony runner engine | New: declaration validation, intake and idempotency, ordered agenda execution, step dispatcher, artifact read-back verification, compaction, resume, catch-up evaluation, mirror-sync planning, deterministic human render |
| Core domain — ceremony tier engine | New: the single plan-tier ↔ pm-notes-variant mapping, canonical phase validation, escalation-trigger evaluation, findings |
| Core domain — retro ceremony | New: per-level note assembly, follow-through-first fold over delivered retro evidence, fixed-schema validation, addendum append; consumes the delivered retro engine read-only |
| Core state — ceremony record boundary | New: the `ceremony.run` and `ceremony.step` kinds, the boundary declaration, fenced append and post-append re-read, verified reads and folds, classified damage |
| CLI — `ceremony` family | New: four verbs, grammar, note and window flags, exit projection, human render, failure hooks |
| CLI — production composition and help | Updated: prompt-required set entry, unconditional composition, family and verb help entries, reference-page coverage row, prompt-set count assertion |
| CLI — edge composition | Updated: declaration document read, state port, injected clock and id factories, input readers, artifact writer, mirror-sync target reads, comparison-record writer |
| Adapters — file and configuration reads | Updated: one bounded read of the committed ceremony declaration document (schema, size, permission, classification) and the artifact family's write/read/verify path; no new runtime-API location |
| State layer (contract) | Additive: two record kinds and one boundary; no schema-version bump, no migration, no new driver |
| Result contract (documented table) | Additive: two rows, one domain kind, one reserved two-segment entry, 136 → 138 identities |
| Retro pipeline | Unchanged behaviour; consumed read-only (verified evidence, run records, memory-audit seam); documentation gains the ceremony-consumer statement |
| Measurement baseline (data + spec) | Additive `comparisons[]` record under a declared schema-version bump; existing rows untouched |
| Documentation set | Updated: new current-truth spec, new operator guide (redistributable), M2 pack command page and index, command registry row, entrypoint delta, backlog progress, feature-spec cross-references, documentation index rows (Appendix C) |
| Test surface | New: declaration validation, parity, execution/verification, resume, catch-up, project declaration, tier engine, retro ceremony, measurement record, mount/help, structure and boundary, performance suites (Appendix E) |

## 17. ACCEPTANCE CRITERIA

### Family surface (F-1)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the composed CLI, **when** `ceremony --help` and `<binary> --help` run, **then** the family appears in the root listing with its four verbs documented, a reference page exists, and the coverage inventory names it, all at exit `0` | F-1, NFR-14 |
| AC-F1-2 | **Given** an undeclared ceremony name, **when** `ceremony run <name>` runs, **then** it is refused as `input.value.rejected` at exit `1` naming the requested name, and no run record, step record, or artifact is produced | F-1, DM-3 |
| AC-F1-3 | **Given** any ceremony outcome, **when** `--json` is used, **then** exactly one `delivery.result.v1` envelope is written with the five delivered keys, the outcome under `data` or `error`, and an exit in `{0, 1, 2}` | F-1, NFR-1 |
| AC-F1-4 | **Given** a ceremony whose declaration uses no `sync` step, **when** it is run with and without `--apply`, **then** both runs produce the same verdict and the same artifacts | F-1, F-4 |

### Declaration contract (F-2)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** the six built-in declarations, **when** they are validated by the declaration validator, **then** all six validate, 100% of their steps carry a verification mode, 100% of their outputs carry a schema identifier, and no declaration carries executable content or an undeclared vocabulary name | F-2, F-3, NFR-3 |
| AC-F2-2 | **Given** a declaration with an unknown step kind, a step without verification, a duplicate id, a built-in id collision, an unknown tier, or an unparseable schedule, **when** it is loaded, **then** it is refused as `ceremony.declaration.invalid` naming the ceremony id and field at exit `1`, and nothing is registered | F-2, F-6, DM-9 |
| AC-F2-3 | **Given** a declaration exceeding a declared bound (phases, steps, inputs, targets, or document size), **when** it is loaded, **then** it is refused as `ceremony.declaration.invalid` naming the exceeded bound | F-2 |
| AC-F2-4 | **Given** the six built-in declarations and a project declaration, **when** they are validated, **then** each carries exactly one `scopeKey` from the closed derivation set (`literal`, `repository`, `note`), a `note` derivation appears only on a ceremony that requires a note, and each declares at most one schedule trigger; a declaration with no derivation, a `note` derivation without a note requirement, a malformed literal token, or two schedule triggers is refused as `ceremony.declaration.invalid` naming `scopeKey` or `triggers[]` | F-2, F-1, DM-1, DM-2 |

### Built-in ceremonies (F-3)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** the six built-in declarations, **when** the parametric parity suite executes each through the same runner over synthetic injected inputs, **then** each run satisfies its declared agenda, output set, verification mode, and verdict, and zero built-ins require a path the others do not use | F-3, F-4 |
| AC-F3-2 | **Given** the morning brief ceremony, **when** it runs, **then** its artifact validates against `delivery.brief.v1` with all ten surfaces, three anchor groups, and the closed placeholder catalog, and the run exits `0` | F-3, F-4 |
| AC-F3-3 | **Given** the retro evidence pass declaration, **when** it runs at each of the four levels, **then** each level produces its declared per-level note with its level's declared trigger recorded | F-3, F-9 |
| AC-F3-4 | **Given** a testing-session assessment over an owner note with several items, **when** it runs, **then** every item carries exactly one verdict from the closed set, the unassessed count is zero, and an item citing no evidence is `uncovered` | F-3, DM-1 |
| AC-F3-5 | **Given** a decision-record mirror sync over two affected repositories, **when** it runs with `--apply`, **then** each repository's mirrored record set equals the register set for that repository, the verdict is `verified`, and a subsequent drift produces `unverified` at exit `1` naming the target | F-3, NFR-12 |
| AC-F3-6 | **Given** a night-watch run over a quiet overnight window, **when** it completes, **then** every declared check appears exactly once and each clean area is an explicit verified-empty rather than an omitted line | F-3 |
| AC-F3-7 | **Given** a sprint rollover with carry-over work, **when** it runs, **then** every carry-over entry names its ref, a reason from the closed set, and its next milestone | F-3 |
| AC-F3-8 | **Given** an explicit `ceremony run`, **when** the run's trigger is recorded, **then** `trigger.kind` is `explicit` and its resolution is `note` where the supplied note names a declared trigger (a retro level run), `declaration` where the declaration declares exactly one trigger, and `unspecified` — with the declaration's declared trigger set named in the record — where several are declared and none is named; the run is never counted as the fulfilment of a scheduled or event obligation, a note naming an undeclared trigger is refused as `input.value.rejected`, and the retro declaration declares no `change-merged` trigger and produces no R1 output | F-3, F-9, DM-3 |

### Execution, verification, resume, compaction (F-4)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** a step whose artifact fails read-back validation, **when** the run continues, **then** the step is `unverified`, no later step executes, the run verdict is `unverified` at exit `1`, and the run and step records plus the produced artifact stay durable | F-4, NFR-3 |
| AC-F4-2 | **Given** a run interrupted after step *k*, **when** `ceremony resume <runId>` runs, **then** execution starts at step *k+1* and no verified step is re-executed or re-rendered | F-4, NFR-4 |
| AC-F4-3 | **Given** a run whose persisted step records contradict its declaration, **when** it is resumed, **then** it refuses with the delivered `state.store.torn` identity at exit `2` and no write occurs | F-4, NFR-4 |
| AC-F4-4 | **Given** a declaration with two phase boundaries, **when** the run passes each boundary, **then** the next phase receives a carried summary within 4 096 bytes and 40 lines, and an over-bound summary carries an explicit omitted count | F-4, NFR-7 |
| AC-F4-5 | **Given** a run with a `sync` step and no `--apply`, **when** it completes, **then** the verdict is `dry-run` at exit `0`, the declared write set was computed and precondition-checked, and nothing landed | F-1, F-4, NFR-12 |
| AC-F4-6 | **Given** an identical `(ceremony, scopeKey, window)` already recorded, **when** the same run is invoked, **then** the recorded verdict is returned with `data.reused: true` and zero records and zero note bodies are appended | F-4, NFR-5 |
| AC-F4-7 | **Given** the note-less scheduled `morning-brief` declaration, **when** it is run twice in the same UTC day without `--window`, **then** the window is the cadence's derived day, the scope key is the declaration's `repository` derivation, the second invocation returns the recorded verdict with `data.reused: true`, and zero run records, step records, and artifacts are appended | F-4, F-1, DM-1, DM-2, NFR-5 |
| AC-F4-8 | **Given** the note-less event-triggered `decision-record-mirror-sync` declaration, **when** it is run without `--window`, **then** it is refused as `input.value.rejected` naming `--window` at exit `1` before any read or write with zero records and zero artifacts, and with `--window` supplied its run identity is `(ceremony, repository scope key, that window)` | F-1, F-4, DM-3 |

### Catch-up (F-5)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** a daily ceremony with one missed window and no recorded run for it, **when** `ceremony catch-up` runs, **then** exactly one run executes with `trigger.kind: "catch-up"` and the missed window bounds, and a second `catch-up` appends nothing and reports the window as caught up | F-5, NFR-6 |
| AC-F5-2 | **Given** every eligible ceremony is current, **when** `ceremony catch-up` runs, **then** it reports `nothing-missed`, appends zero records, and exits `0` | F-5, NFR-6 |
| AC-F5-3 | **Given** a ceremony declared with `catchUp.mode: "none"` and one missed window, **when** `catch-up` runs, **then** the window is reported as a declared gap with its bounds and no run executes | F-5 |

### Project declarations (F-6)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F6-1 | **Given** a project declaration of a new ceremony in the committed declaration document and no other change, **when** `ceremony list` and `ceremony run <project-ceremony>` run, **then** the ceremony appears with origin `project` and executes through the same steps, verifiers, and records as a built-in, with zero tooling change | F-6, F-2 |
| AC-F6-2 | **Given** a present declaration document that cannot be parsed, **when** any ceremony invocation runs, **then** it refuses as `config.file.malformed` at exit `1` before any run and no project ceremony is silently dropped | F-6 |
| AC-F6-3 | **Given** a project declaration document that declares no ceremony, **when** the family runs, **then** the behaviour is identical to a repository with no document, and the built-ins are unaffected | F-6 |

### Tier engine (F-7)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F7-1 | **Given** a plan declaring tier `lite` and a pm-notes record declaring variant `lite`, **when** the tier engine evaluates the change, **then** the effective phase set equals the delivered pinned lite set element for element, the source is named, and no additional vocabulary contributes | F-7, NFR-9 |
| AC-F7-2 | **Given** a plan tier that disagrees with the pm-notes variant, **when** the engine evaluates the change, **then** the variant's phase set is effective and a `tier-mismatch` finding names both declarations, with delivery unaffected | F-7, DM-7 |
| AC-F7-3 | **Given** a plan declaring the escalation trigger `review-rework` and a recorded review-rework verdict for the change, **when** the engine evaluates it, **then** the effective set escalates to the full set, the escalation names the trigger and its evidence, and the run record carries it | F-7, DM-3 |
| AC-F7-4 | **Given** a plan declaring a trigger string outside the closed vocabulary, **when** the engine evaluates it, **then** the string is reported verbatim as `unevaluated` and is neither dropped nor treated as false | F-7, DM-7 |
| AC-F7-5 | **Given** a change whose effective tier is `lite`, **when** ceremony intake is computed, **then** only the ceremonies whose declared `tiers` include `lite` carry an obligation, and an explicit `ceremony run` of a non-obligated ceremony still executes | F-7, F-3 |

### Measurement (F-8)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F8-1 | **Given** any executed run, **when** its records are read back, **then** every executed step carries a duration and a verification verdict, the run duration is derivable, and no run document exists to disagree with the ledger | F-8, NFR-10 |
| AC-F8-2 | **Given** the delivered change, **when** the comparison record is produced, **then** it carries the committed `MET-CEREMONY-SHARE` identity, definition reference, before value with its window and sample, after value with its window, per-change values, sample size, sample minimum, verdict, native basis, and disclosure — and the before value equals the committed baseline value | F-8, DM-8 |
| AC-F8-3 | **Given** fewer than five post-boundary changes, **when** the comparison is computed, **then** the verdict is `insufficient-sample`, the observed `n` and the per-change values are recorded, and no trend claim appears in the record or the change artifacts | F-8, NFR-10, DEC-14 |

### Retro ceremonies (F-9)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F9-1 | **Given** a ceremony note that omits its idempotent scope key, **when** the retro ceremony runs, **then** it is refused as `ceremony.note-invalid` naming `scopeKey` at exit `1`, no partial ceremony output is written, and no run or step record is appended (SC-M2-S3-02) | F-9, DM-2, DM-9 |
| AC-F9-2 | **Given** a ceremony note satisfying the fixed note schema, **when** the retro ceremony runs, **then** each agenda step produces its declared output, the run ends with an artifact-verified follow-through section carrying at least one verified action, and the run exits `0` (SC-M2-S3-01) | F-9, F-4 |
| AC-F9-3 | **Given** a retro at `window` or `project` level with open actions, **when** the agenda executes, **then** follow-through verification is the first phase and each action's verdict cites its verification artifact, never an owner status claim | F-9 |
| AC-F9-4 | **Given** a retro note already recorded for a scope key at an earlier window, **when** the ceremony runs for that scope at a later window, **then** an addendum is appended, the prior note body is not rewritten, and the new window records exactly one new run | F-9, NFR-5 |
| AC-F9-5 | **Given** a retro window whose evidence supports no finding, **when** it runs, **then** the note carries an explicit empty finding set, no fabricated action, and the run is `verified` at exit `0` | F-9 |
| AC-F9-6 | **Given** a retro ceremony run, **when** its evidence step executes, **then** it performs a read-only fold over the delivered retro pipeline's verified evidence and run records and writes no retro evidence, no retro registry record, and no chain material | F-9, DEC-4 |

### Contract constraints (NFRs)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-NFR2-1 | **Given** the ceremony fold, render, verification, and tier paths, **when** the structural scans run, **then** zero inference clients, model identifiers, network modules, and ambient clock/random/environment reads are found, and a mutation that adds one fails the scan | NFR-2 |
| AC-NFR8-1 | **Given** the two new identities, **when** the error-table sync check runs, **then** both rows exist in the machine table and the documented table with identical structured fields, the `ceremony` kind requires an exact code, and the reserved two-segment allowlist contains `ceremony.note-invalid` | NFR-8, DM-9 |
| AC-NFR9-1 | **Given** the tier engine and the built-in declarations, **when** the structure suite runs, **then** exactly two phase-set sources are consumed, no tier name outside `full` or `lite` exists, and no hardcoded default phase set exists outside the delivered per-variant data | NFR-9 |
| AC-NFR12-1 | **Given** a mirror-sync declaration with more than eight targets or a target outside the declared set, **when** it does not land, **then** the declaration is refused or the undeclared target is untouched, and no force path exists on any target | NFR-12, F-3 |
| AC-NFR14-1 | **Given** the completed change, **when** the gates run, **then** `TMPDIR=$PWD/tmp/tmpdir pnpm check` is green before the PR opens, commits follow the declared conventions, and the PR targets `main-tools` | NFR-14 |

### 17.1 Definition of Done (change-specific)

- **DoD-1**: All four verbs are reachable in the composed binary, advertised in root and family help, served by the M2 reference page, and named by the coverage inventory.
- **DoD-2**: The declaration contract, its closed vocabularies, its bounds, and its two refusal identities are delivered and validated by one validator used by built-ins and projects alike.
- **DoD-3**: The six built-ins are declarations on that contract and pass the single parametric parity suite with at least one negative case each.
- **DoD-4**: Execution is artifact-verified per step, durable per step, resumable from the first unverified step, and compacted at declared boundaries with an explicit truncation marker.
- **DoD-5**: Catch-up replays at most one missed window per ceremony per invocation, is idempotent, and distinguishes nothing-missed from a declared gap.
- **DoD-6**: A project-declared ceremony runs through the same runner with zero tooling change, proven by an acceptance case whose only input is a declaration document.
- **DoD-7**: The tier engine consumes exactly the delivered plan tier and pm-notes variant, reports disagreement and unevaluated triggers as findings, records escalations with evidence, and computes tiered intake.
- **DoD-8**: Run and step records land through the boundary-validated, fenced state path, run status and durations are folds, and no mutable run document exists.
- **DoD-9**: The ceremony-share comparison record exists with the committed definition, before and after values, sample size, minimum, verdict, native basis, and disclosure, and the change claims no trend below the minimum.
- **DoD-10**: The four retro levels carry declared triggers, the follow-through-first agenda, the fixed note schema, idempotent scope keys, per-level outputs, and null-retro success; the pipeline is unchanged.
- **DoD-11**: Two error identities, one domain kind, and one reserved two-segment entry are delivered with the documented counterpart, and the count moves 136 → 138 with the sync check green.
- **DoD-12**: Appendix C's documentation deltas are applied in the phase each names, the new guide declares `ados_distribution: redistributable`, and the distribution guard passes.
- **DoD-13**: No excluded surface was delivered: no metrics surface, no action registry, no ceremony pack, no scheduler, no new retro or event capability, no MCP tool, no LLM in a ceremony path.
- **DoD-14**: The quality gates are green with the declared tmpdir environment before the PR opens, and the PR targets `main-tools` and stays open.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **One change, one PR, capability-ordered phases.** Contracts and vocabularies first, then the record boundary, then the engine (intake, agenda, verification, compaction, resume), then catch-up, then the built-in declarations, then project declarations, then the tier engine, then the measurement record, then the mount and documentation. Each phase lands green; the family is composed only once its engine and declarations exist, so an uncomposed surface can never answer partially.
- **No flag day.** Every existing command keeps its bytes. A repository that never invokes `ceremony` sees no change; a repository that declares no ceremony document gets the built-ins only.
- **Adoption is opt-in per repository.** The factory begins running its own ceremonies after this change lands, which is also the after-window sample for the comparison record; the first meaningful trend read is M2-S6's, on the data this change produces.
- **Rollback is subtraction.** The family can be dropped from the prompt-required set to remove the surface without touching delivered commands; the two state record kinds stay readable and inert, and no migration exists in either direction.
- **Communication.** The change note in the delivery PR names the declaration document location, the four verbs, the closed vocabularies, the tier mapping, and the two exclusions (metrics, action registry) so reviewers do not read the change as an incomplete loop.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

- **State.** Two additive record kinds under a new `ceremony.` prefix; no schema-version bump, no migration, no backfill. Historical ceremony runs are unobservable and are not invented: the record set starts empty and verified-empty is explicit.
- **Built-in declarations.** They ship as contract data, not as seeded state records; no seeding write occurs on a first run.
- **Project declarations.** Absent by default; a project authors its own document. No default ceremony is written into a project's tree.
- **Measurement log.** One additive `comparisons[]` entry with a declared schema-version bump; no existing row, value, sample counter, or window is edited, and no `MET-` ID is reallocated.
- **Memory tree.** Retro notes are appended to the delivered retro archive and its index is regenerated by the delivered convention; no existing note is rewritten.
- **Migration of a running ceremony.** None: there are no prior ceremony runs to migrate, and a run interrupted mid-delivery is resumed by its own run id.

## 20. PRIVACY / COMPLIANCE REVIEW

- **No new personal data.** Ceremony notes name participants and actors the way pm-notes and retro notes already do; the retro ceremony's fixed schema carries the concept's blameless rule — findings describe system conditions, never an individual's carelessness.
- **No new egress.** All reads are local; no network call, no telemetry export, no third-party processor, and no model provider is added.
- **Secret hygiene.** Every artifact and envelope passes the delivered serialization redaction chokepoint; no ceremony output carries a registered secret value, and no step reads the ambient environment.
- **Retention.** State and ceremony artifacts follow the state layer's forever retention; the memory tree follows the committed-memory budget and lint rules; no new retention or deletion path exists.
- **Auditability.** Run and step records are append-only, and the comparison record discloses sample, window, basis, and limitation, so a later reader can recompute rather than trust.
- **Cross-repository writing.** The mirror sync writes decision records only — already committed project artifacts — into declared repositories; it moves no personal or credential data and carries no payload beyond the declared record set.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Data-only declarations.** The declaration contract cannot express executable content: no command, no shell fragment, no path to run, no model reference, no free-form instruction. This is the primary control that keeps a project declaration from becoming a code-execution surface.
- **Closed vocabularies, exact refusal.** Every name a declaration uses comes from a declared vocabulary; an unknown name refuses with `ceremony.declaration.invalid` naming id and field, so a declaration cannot smuggle capability by naming something the runner does not know.
- **Declared write targets only.** A `sync` step writes only to targets its declaration names, at most eight, each verified contract-conformant, with clean-checkout and declared-base preconditions and no force path. Dry-run is the default; `--apply` is the only landing switch.
- **State discipline.** All ceremony state writes go through the state layer's boundary-validated, fenced append path with `0600` artifacts and verified reads; a malformed payload is a classified state failure, never a zeroed fold.
- **No path traversal from a declaration.** A declaration names slots, not filesystem paths; the runner resolves a slot to its delivered home, so a declaration cannot point a write outside the artifact family, the memory archive, the ledger, or a declared repository.
- **Note intake is bounded.** `--note <path>` is a bounded read of one document (size and parse bounds inherited from the configuration parser class), validated against the note contract before any output, and refused with the field named on failure.
- **Blast radius.** The largest new capability is the mirror sync, bounded by declared targets, dry-run default, and equality verification; the second is note writing into the memory archive, bounded by the delivered archive convention and the memory lint.
- **No secrets in artefacts.** Artifact references are identifiers; envelopes and artifacts pass the single redaction path; a ceremony never prints a raw provider payload, a transcript, or a token.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Adding a ceremony** is a declaration plus a parity fixture row; adding a built-in additionally needs a documentation row. No new verb and no new code path is the design intent.
- **Adding a step kind, input source, output slot, verification mode, trigger event, or escalation trigger** is a reviewed contract extension: the vocabulary, the validator, the built-ins that use it, the parity suite, and this spec change together.
- **Schedule semantics** are UTC-based with no daylight-saving handling and no timezone declaration; a change of basis is a contract change.
- **The comparison record** is per-delivery work at closeout: recompute with the committed definition, disclose the sample, and never carry a prior verdict forward.
- **The metric surface** will consume runner durations when M2-S6 lands; until then the records are read by operators and by this change's comparison.
- **Retention and growth.** One run record plus *n* step records per run and one artifact file per run; retention forever with no compaction of history. An operator inspects through the surfaces, not by editing files.
- **Blamelessness and idempotency** are load-bearing conventions: a rerun appends an addendum, and a note describes conditions rather than people. Both are asserted in review on any change to the retro ceremony.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Ceremony | A declared, deterministic, artifact-verified unit of recurring work: a trigger, inputs, an ordered agenda, renders, verifications, catch-up semantics, and compaction. |
| Ceremony declaration | The data that defines a ceremony (`delivery.ceremony.declarations.v1`), using only closed vocabularies. |
| Agenda | The declared ordered phases and steps a ceremony executes. |
| Agenda step | One declared unit of agenda work (`collect`, `fold`, `render`, `assess`, `sync`, `record`) with declared inputs, outputs, and a verification mode. |
| Artifact verification | Reading a step's declared artifact back from its declared slot and validating it against the declared verification mode; the only evidence that a step completed. |
| Output slot | The closed set of artifact homes a declaration may target (`memory`, `ceremony-artifact`, `state-record`, `mirror-target`). |
| Ceremony note | The input/output note of a note-consuming ceremony (`delivery.ceremony.note.v1`); it carries the idempotent scope key and, for retrospectives, the concept's fixed schema. |
| Scope key | The declaration-derived identity that makes reruns idempotent, from the closed set `literal`, `repository`, or `note`; a note-consuming ceremony takes it from the note, and a note without it is refused. |
| Run identity | `(ceremony, scopeKey, window)` — the key that decides whether a run executes or returns a recorded verdict; both parts resolve from the declaration before any read (F-1, F-2). |
| Explicit run | A `ceremony run` invoked by an operator rather than by a firing; recorded with `trigger.kind: "explicit"` and a trigger resolution of `note`, `declaration`, or `unspecified`. |
| Run verdict | `verified`, `dry-run`, or `unverified`; derived from the step fold, never stored separately. |
| Catch-up | Replaying at most one missed scheduled window, labelled as such, exactly once. |
| Compaction | Folding a completed phase's step outputs into a bounded carried summary (4 096 bytes / 40 lines) with an explicit omission marker. |
| Ceremony tier | The declared lifecycle weight of a change, `full` or `lite`, as declared in the plan and recorded in pm-notes. |
| Tiered intake | Deriving which ceremonies a change is obligated to run from its effective tier. |
| Escalation trigger | A declared lifecycle event that promotes a `lite` change's effective phase set to `full` for the remainder of the change. |
| Parity | The property that every built-in ceremony executes through the same runner, vocabularies, and verification discipline, asserted by one parametric suite. |
| Ceremony share | The committed metric `MET-CEREMONY-SHARE`: ceremony-phase time over total lifecycle phase time, lower is better. |
| Native basis | Runner-measured ceremony durations from run and step records — a different basis from the committed proxy and never substituted for it. |
| Built-in ceremony | One of the six declarations shipped with the product. |
| Project ceremony | A ceremony declared by a project in its committed declaration document, running through the same runner. |
| Retro level | One of `change` (R1, closeout's), `session` (R2), `incident` (R3), `window` (R4), `project` (R5). |
| Follow-through first | The retrospective rule that the first agenda phase verifies prior actions against their artifacts, never against status claims. |

## 24. APPENDICES

### Appendix A — Ticket acceptance criteria mapping

The ticket's acceptance block, in intent, mapped to this spec's criteria and to the inherited scenario seeds:

| Ticket AC (M2-S3) | Spec criterion | Scenario seed |
|---|---|---|
| AC1 — ceremony share measured before and after; trend toward 40 percent; recorded from committed data | AC-F8-2, AC-F8-3 | — (change-specific; the committed metric is the source) |
| AC2 — every built-in ceremony is parity-testable | AC-F3-1, AC-F2-1 | SC-M2-S3-01 (execution), plus the parametric parity suite |
| AC3 — a project-declared ceremony runs through the same runner without tooling changes | AC-F6-1 | — (acceptance case in this change's artifacts) |
| AC4 — retro ceremonies follow the retrospective concept: declared trigger model, follow-through-first agenda, fixed note schema, idempotent scope keys, per-level outputs | AC-F9-1..AC-F9-6, AC-F3-3 | SC-M2-S3-01, SC-M2-S3-02 |
| SC-M2-S3-01 — a conforming note produces each agenda step's declared output and an artifact-verified follow-through section; exit `0` | AC-F9-2 | SC-M2-S3-01 |
| SC-M2-S3-02 — a note missing its scope key is refused naming `scopeKey`; exit `1`; `error.code == "ceremony.note-invalid"` | AC-F9-1 | SC-M2-S3-02 |

The ticket's three tasks map as: "reduce ceremony share" → F-7 tiered intake and F-8 measurement; "compact at boundaries" → F-4 compaction; "tiered intake" → F-7. The ticket's built-in set maps one-to-one onto the six declarations in F-3, and its ceremony-tier sentence maps onto F-7.

### Appendix B — Constraint register (carried into plan and test authoring)

- **C-1 — Envelope continuity.** Five-field `delivery.result.v1`, new keys under `data`, no new top-level key, no `ok`/`command`, `data` XOR `error` (NFR-1, AC-F1-3).
- **C-2 — Exit projection.** `0` declared verdict, `1` refusal or data-bearing negative verdict, `2` platform/state/provider; no new exit value; the `attention` class is not used by this family (NFR-1).
- **C-3 — State discipline.** Every ceremony write goes through a boundary-validated, fenced append with a post-append verified re-read; no derived run document; a contradicted record sequence is `state.store.torn` and is never repaired by the runner (DM-3..DM-5, AC-F4-3).
- **C-4 — Runtime neutrality.** Contracts are types and `as const` data only; domain is pure over injected ports; runtime APIs stay in the delivered driver edge; no new package or subpath (NFR-2, AC-NFR2-1).
- **C-5 — No LLM in render or verification.** Zero inference clients, model identifiers, network modules, and ambient reads in the fold/render/verify/tier paths, asserted structurally with a failing control (NFR-2, AC-NFR2-1).
- **C-6 — Mounting.** Prompt-required set entry, unconditional production composition, family and verb help entries, M2 reference page, coverage-inventory row, and the prompt-set count assertion updated in the same change (DEC-10, DoD-1).
- **C-7 — Error-table binding.** Two rows in both tables, one domain kind, one reserved two-segment entry, 136 → 138, zero reworded delivered rows (NFR-8, AC-NFR8-1).
- **C-8 — Documentation.** Appendix C is the complete delta list; every new or changed document under `doc/guides/`, `doc/templates/`, or the standalone set declares `ados_distribution`; the distribution guard passes (DoD-12).
- **C-9 — Gates and hygiene.** `TMPDIR=$PWD/tmp/tmpdir pnpm check` green before the PR; conventional subjects scoped `GH-296`; ≤100-character body and footer lines; PR to `main-tools`, left open (NFR-14, DoD-14).
- **C-10 — Scope exclusions are binding.** No M2-S6 metric surface, no M2-S10 action registry, no ceremony packs, no scheduler, no retro-pipeline change, no event topic, no MCP tool (§7.2, NG-1..NG-8, DoD-13).

### Appendix C — Documentation impacts (the delta list)

| # | Surface | Delta | Phase |
|---|---|---|---|
| 1 | `doc/spec/features/feature-ceremony-runner.md` (new) | New current-truth feature spec: the family, the declaration contract, the six built-ins, execution/resume/compaction, catch-up, project declarations, the tier engine, the records, retro levels, the two identities. Carries `ados_distribution: internal` per the existing spec convention. | 7 |
| 2 | `doc/spec/features/feature-result-contract.md` | Add the `ceremony` domain kind, the two documented rows, the two-segment allowlist entry (52 → 53), and the 136 → 138 count. Required in the delivering boundary because the error-table sync gate lives in `pnpm check`. | delivering |
| 3 | `doc/spec/features/feature-state-layer.md` | Add the two `ceremony.*` record kinds, the boundary, the artifact family, and the derive-not-store rule to the consumer list and store layout. | 7 |
| 4 | `doc/spec/features/feature-plan-schema.md` | State that the plan tier declaration now has a consumer: the ceremony tier engine, with the single mapping and the variant-governs rule. No plan-contract change. | 7 |
| 5 | `doc/spec/features/feature-pm-notes-lint-and-phase-transitions.md` | State that `PM_NOTES_REQUIRED_PHASES_BY_VARIANT` is the phase-set source the ceremony tier engine consumes. No pm-notes contract change. | 7 |
| 6 | `doc/spec/features/feature-retro-pipeline.md` | Replace "scheduled invocation belongs to the ceremony runner" with the delivered consumer statement: the retro evidence pass reads verified evidence and run records and selects the four sub-R1 levels at the ceremony layer; pipeline grammar and registry status unchanged. | 7 |
| 7 | `doc/spec/features/feature-measurement-baseline.md` | Document the additive `comparisons[]` list, its schema-version bump, and its members; keep the immutability rule stated. | delivering (the log is data this change writes) |
| 8 | `doc/planning/oss-tooling/measurement-baseline.yaml` | Append one `comparisons[]` entry (DM-8) and declare the schema-version bump; edit no existing metric row. | delivering |
| 9 | `doc/spec/features/feature-cli-entrypoint.md` | Prompt-required set gains `ceremony` (twenty-one families); composition, help, reference page, and coverage row. | 7 |
| 10 | `doc/guides/ceremony-runner.md` (new) | Operator guide: the four verbs, the declaration document and its vocabularies, a worked project declaration, the tier mapping, catch-up, dry-run/`--apply`, artifact homes, and the measurement record. Declares `ados_distribution: redistributable` and passes the distribution guard. | 7 |
| 11 | `doc/planning/oss-tooling/cli-command-registry.md` | Move the `ados ceremony` row to Delivery with the delivered verb set; update the ceremony-script strangler row's parity statement; keep `ados metrics` as M2-S6. | delivering |
| 12 | `doc/planning/oss-tooling/milestones/m2/commands/ceremony.md` (new) | Command contract page (status `Delivered (M2-S3)`): grammar, four verbs, flags, exits, the declaration contract by reference, and the no-scheduler/no-metrics boundaries. | delivering |
| 13 | `doc/planning/oss-tooling/milestones/m2/README.md` | Add the command page to the pack contents and change the M2-S3 story row from "none in this pack" to the page. | delivering |
| 14 | `doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md` | Record the mount observation: twenty-one families, `ceremony` in the prompt-required set, its reference page. | delivering |
| 15 | `doc/planning/oss-tooling/backlog.md` | M2-S3 progress line naming the delivered scope (runner, six built-ins, project declarations, tier engine, records, comparison, retro levels). | delivering |
| 16 | `doc/00-index.md` | Register the new feature spec and the new guide. | 7 |
| 17 | `doc/spec/nonfunctional.md` | Add the ceremony NFR/budget row and its test evidence, matching the existing per-feature table shape. | 7 |
| 18 | `doc/planning/concepts/retrospectives.md` | Story-mapping note: M2-S3 delivered the ceremony layer's per-level outputs and triggers; R1 stays closeout's. No concept change. | 7 |

No change is required to `doc/spec/features/feature-brief.md`, `feature-status-digest.md`, `feature-event-taxonomy.md`, `feature-closeout.md`, `feature-owner-gate-sla.md`, the memory-record schema, or the memory lint; naming them here is deliberate so a reviewer does not read their absence as an omission.

### Appendix D — Single-source tier mapping (normative restatement)

This table is the only place the mapping is stated. It consumes delivered data and defines nothing new:

| Plan `tier.name` | pm-notes `variant` | Effective phase set | Source of the set |
|---|---|---|---|
| `full` | `full` (or absent) | eleven phases | `PM_NOTES_REQUIRED_PHASES_BY_VARIANT.full` |
| `lite` | `lite` | six phases | `PM_NOTES_REQUIRED_PHASES_BY_VARIANT.lite` |
| any | any (disagreement) | the variant's set | `PM_NOTES_REQUIRED_PHASES_BY_VARIANT`, with a `tier-mismatch` finding |
| any | any, with plan `tier.phases` | the declared subset, restricted to canonical ids | the plan's declaration, validated against the canonical vocabulary |
| any | any, escalation fired | the `full` set for the remainder | the escalation rule of F-7 |

Three quantities are deliberately absent from this table: a tier name outside the delivered two, a phase outside the canonical eleven, and a default phase set not declared by the delivered per-variant data.

### Appendix E — Testability notes

| Property to prove | How it is made provable |
|---|---|
| Declarations are total and closed | One validator over the six built-ins and every project fixture; a defect corpus with one defect per declaration; a structure assertion that the vocabularies are the only names the validator admits |
| Parity is real, not asserted | One parametric suite iterating the six declarations; an assertion that no built-in carries a distinct entry point, step dispatcher, verifier, or writer; a mutation that adds a per-ceremony branch fails it |
| Verification is not cosmetic | For each built-in, a negative case mutating the artifact so its declared verification fails; the run must be `unverified` at exit `1` with the step named |
| Resume never redoes work | A crash fixture stops the run after step *k*; the resume's record set is asserted against the pre-crash set (no re-executed index) |
| Idempotency is keyed | Double-invocation fixtures for a note-consuming ceremony and for the note-less repository-derived `morning-brief`, each asserting one run record, one note body where a note exists, and `data.reused: true` on the second call; a fixture asserting that a note-less event-triggered run without `--window` is refused before any write |
| Catch-up is bounded | Fixtures for one missed window, several missed windows, a caught-up window, `mode: none`, and an event-triggered ceremony |
| Triggers are resolved, not assumed | Fixtures for every recorded kind and resolution (`explicit` with `note`, `declaration`, and `unspecified`; `catch-up`; `schedule`; `event`), plus an assertion that the retro declaration declares no `change-merged` trigger and produces no R1 output |
| Project declarations are equivalent | A declaration-only fixture (no code, no flag) runs through the family and produces the same record shape and verification discipline as a built-in |
| The tier mapping is single-sourced | A structure test asserting no additional phase-set literal and no tier name outside the delivered two; behaviour fixtures for agreement, disagreement, declared phases, escalation, and unevaluated triggers |
| The measurement record is honest | A fixture with `n < 5` must yield `insufficient-sample` and no trend token anywhere in the record or the change artifacts; a fixture with `n ≥ 5` must recompute from its cited inputs |
| The pipeline is untouched | A parity fixture asserting the retro family's payloads, identities, and registry status are byte-identical before and after this change |
| Mounting is complete | The help/coverage matrix, the prompt-set count assertion, root and family help, and the reference page |
| Envelope and identities | Golden envelopes for every outcome class; the error-table sync check; a scripted one-line projection case; a redaction canary |
| Performance and bounds | The NFR-13 budgets over cap-sized fixtures; the NFR-7 bounds asserted at and above their limits |

All default fixtures are synthetic and committed: injected clocks, id factories, fence tokens, input readers, and byte-level artifact I/O; no live credential, network call, child process, or live-tree write. A skip never counts as a pass.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-15 | spec-writer (DeepSeek V4.1 Flash) | Initial specification from GitHub issue #296 (M2-S3), backlog story M2-S3, the M2 milestone pack (README, contracts, architecture, test-scenario seeds SC-M2-S3-01/02, entrypoint delta, command registry), `doc/planning/concepts/retrospectives.md`, the committed measurement baseline, and the current-truth specs it composes (result contract, state layer, retro pipeline, plan schema, brief, status digest, CLI entrypoint, closeout, event taxonomy, owner-gate SLA); the two recorded planning decisions carried into DEC-1..DEC-3 |
| 1.1 | 2026-11-15 | spec-writer (DeepSeek V4.1 Flash) | DoR iteration-1 remediation (findings 1, 2, 3, 6). Finding 1: `scopeKey` is a required declaration member with a closed derivation set and one precedence rule (F-2, F-3 built-in table, F-4 intake, F-9, §5.2, DM-1, DM-2, DM-3, §23, DEC-16). Finding 2: the retro evidence pass declares only the four sub-R1 triggers and names R1 as a non-goal in that cell; recorded trigger kinds and resolutions are a closed vocabulary and an explicit run records `trigger.kind: "explicit"` (F-2, F-3, F-9, DM-1, DM-3, §10, DEC-17). Finding 3: window resolution is stated once, the note-less event-triggered case requires `--window` and is refused when omitted, and scheduled windows derive from the cadence (F-1, F-4, DM-3, E-18, §12, DEC-18). Finding 6: §13 edges the backlog does not record are stated as feeds. Acceptance criteria added: AC-F2-4, AC-F3-8, AC-F4-7, AC-F4-8 (45 → 49); no existing criterion weakened. Findings 4 (test plan bound ladder) and 5 (plan Phase 8 summary) belong to `test_planning` and `delivery_planning` and are not touched here |

---

## AUTHORING GUIDELINES

Sources: GitHub issue #296 "M2-S3: Ceremony runner (M2)" (authoritative scope and AC, quoted in intent in Appendix A); backlog story M2-S3 (canonical task list and dependency set); `chg-GH-296-pm-notes.yaml` (milestone, variant, the two recorded decisions, and the clarify-phase dependency verification); the M2 milestone pack — `README.md` (story-to-artifact map), `contracts.md` (shared continuity, the closed event taxonomy, telemetry and spend continuity), `architecture.md`, `test-scenarios.md` (SC-M2-S3-01/02 inherited by name, not restated), `entrypoint-delta.md` (the mounting pattern); `doc/planning/concepts/retrospectives.md` (levels and triggers, the five-stage follow-through-first process, the fixed note schema, scope-key idempotency, blamelessness, null retro, the vanity-metric warning); `doc/planning/oss-tooling/cli-command-registry.md` (`ados ceremony` and the ceremony-script strangler row); `doc/planning/oss-tooling/measurement-baseline.yaml` and `feature-measurement-baseline.md` (the metric definition, formula, status semantics, comparison protocol, and immutability); current truth — `feature-result-contract.md` (envelope, error table, the reserved two-segment allowlist, the data-bearing negative verdict precedent), `feature-state-layer.md` (boundary declarations, fenced appends, classified damage, retention), `feature-retro-pipeline.md` (evidence plane, registry kinds and level statuses, the memory-audit trigger), `feature-plan-schema.md` (tier as inert data, `plan.tier.unknown`), `feature-pm-notes-lint-and-phase-transitions.md` (the pinned per-variant phase sets), `feature-brief.md` (render-only, no-LLM, degradation-as-data precedent), `feature-cli-entrypoint.md` (the prompt-required mounting rule), `feature-closeout.md` (the mechanical-ceremony precedent, dry-run default, compaction checkpoint), `feature-event-taxonomy.md` (the closed topic set), `feature-memory-lint.md` (the retro archive).

Resolutions applied to the planning open points, each recorded rather than assumed: ceremony-share scope (DEC-1), tier mapping and authority (DEC-2), retro action registry boundary (DEC-3), the retro level ownership question DEC-4 resolves — the ceremony layer selects the four levels while the pipeline's grammar and registry status stay delivered — the error-identity minimalism (DEC-5), declarations as data plus a committed document (DEC-6), scope-key idempotency (DEC-7), the log's additive comparison record (DEC-8), no event/MCP surface (DEC-9), mounting (DEC-10), compaction (DEC-11), dry-run default (DEC-12), the escalation-trigger vocabulary (DEC-13), the sample minimum (DEC-14), and the declaration read posture (DEC-15). Three contract-detail decisions close the DoR iteration-1 gaps in the same recorded form: the scope-key derivation and its precedence (DEC-16), the retro trigger set and the recorded trigger of an explicit run (DEC-17), and the window of a note-less event-triggered run (DEC-18). Three genuine detail gaps remain as non-blocking OQ-1..OQ-3 with proposed resolutions; none needs a product decision to start planning.

Constraints honoured: scope is stated at capability and contract level only — no implementation steps, no source paths, and no code-level instructions. Artifact homes (the committed declaration document, the memory retro archive, the ceremony artifact family, the measurement log) are named because they *are* the contract surface a declaration and a verification resolve against, not because they are implementation targets. Scenario seeds and delivered contracts are referenced by name and never duplicated.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-296)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] `change.milestone` equals the pm-notes milestone verbatim (`M2: Ceremonies, measurement, and memory`)
- [x] All sections present in order (1–25, 17.1, appendices, authoring guidelines, checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact and Probability with mitigated residual
- [x] No implementation details (no source paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (delivered vocabularies referenced by name)
- [x] Documentation impacts enumerated with the phase each lands in (Appendix C)
- [x] New/changed guides and specs carry their `ados_distribution` requirement
