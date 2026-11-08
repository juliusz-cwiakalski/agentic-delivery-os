---
ados_distribution: internal
id: SPEC-PLAN-SCHEMA
status: Current
created: 2026-11-05
last_updated: 2026-11-08
owners: ["engineering"]
service: delivery-os
summary: "The versioned machine-readable delivery plan (`delivery.plan.v1`) and the `plan` command family: the YAML document shape (per-phase optional summary, scope, typed done-artifacts, leases, weight class, interactions, and ceremony tier as data), the YAML-before-markdown artifact precedence with the classified legacy transition, the pure validate/diff/overlap verdicts (ready-for-development, per-path scope classification, pairwise sequence versus parallel with named overlapping paths and producer-first ordering), the shared `plan.*` error identities, the additive `lint plan` target, the DEC-1 exit projection, and the deterministic, read-only, bounded-output posture."
links:
  related_changes: ["GH-226", "GH-242"]
  related_decisions: ["ODR-0003"]
  contracts:
    - "packages/core/src/contracts/plan.ts"
    - "packages/core/src/domain/plan-validate.ts"
    - "packages/core/src/domain/plan-overlap.ts"
    - "packages/core/src/domain/plan-diff.ts"
---

# Feature: Machine-Readable Delivery Plan Schema and Plan Commands

## Overview

A delivery plan is the declared input the delivery engine computes against. It is a versioned YAML change artifact named `chg-<workItemRef>-plan.yaml`, stored with the change artifacts under the unified change convention. The document declares per-phase scope (files, packages, folders), an optional per-phase summary, typed done-artifacts, repository leases, a build-weight class, producer/consumer interactions, and the ceremony tier as data. The plan declares phases and scope only: it carries no `tasks` key and no progress log, and plan-phase progress is recorded in pm-notes `notes:` entries naming the plan phase id, commit hash, and test result. The plan is inert declaration data: verdicts compare, echo, and order it; they never execute it or mutate the repository.

Three read-only verdicts consume that document. `plan validate <ref>` answers schema conformance and the ready-for-development gate, with classified errors naming the phase and field and per-phase data echoed for downstream consumers. `plan diff <ref> [--against <base>]` compares declared scope against the actual branch diff and classifies each path `within`, `outside-declared`, or `undeclared-missing`. `plan overlap <refA> <refB>` answers `parallel` or `run-in-sequence`, naming every overlapping path, ordering a declared producer first, and stating a stable reason. `lint plan <ref>` runs the same schema conformance at write time with document locations.

A legacy `chg-<workItemRef>-plan.md` stays readable during the transition. It is answered with the classified `plan.format.legacy-markdown` verdict, is never treated as schema-valid, and never produces a crash. When both plan files exist for one ref, the YAML plan wins and the verdict discloses the artifact it read.

The plan family consumes the [result contract](feature-result-contract.md) envelope, error table, and `{0, 1, 2}` exit projection, and the [pm-notes lint and phase transitions](feature-pm-notes-lint-and-phase-transitions.md) lint surface. Actual-diff input for `plan diff` is the embedder-injected `readDiff` port: no production repository-diff reader ships in-tree, and the repository adapter reads `.git` metadata without spawning git. A composition that does not inject `readDiff` classifies the diff read as `input.value.rejected` with exit `1` (the shared user-validation projection) and a summary stating that the repository diff could not be read; the port seam preserves the zero-spawn, read-only posture (NFR-3). The documented contract default base for the comparison is `main-tools`. The command surface is registered in the [CLI command registry](../../planning/oss-tooling/cli-command-registry.md); [ODR-0003](../../decisions/ODR-0003-cli-command-naming-v1-lock.md) locks the v1 names and records M1 additions through its superseding-note path. The change that delivered the surface is [GH-226](../../changes/2026-11/2026-11-05--GH-226--machine-readable-plan-schema/chg-GH-226-spec.md).

## Business Context

### Problem Statement

- **Problem:** A prose plan carries no computable scope, so parallelism, ordering, and phase completion cannot be decided without an LLM reading the document. Unsafe overlaps surface only in review, and a change can start delivery without a validated declared scope.
- **Affected users:** Lifecycle agents that author and consume plans (`@plan-writer`, `@pm`, `@coder`), the coordinator planning a batch, and the downstream scheduler, lane, and ceremony consumers (M1-S17 and later).
- **Business impact:** The declared plan becomes the engine's input: the ready-for-development gate is mechanical, overlap is answered with named paths, scope drift is observable during delivery, and ceremony tiers are plan data rather than a hardcoded phase set.

### Goals & Success Metrics

- **Primary goal:** Make delivery plans machine-readable so that a change is ready for development exactly when its plan validates, and sequence-versus-parallel is computed from declared scope.
- **KPIs:** Every post-format-change plan passes `plan validate`; every `run-in-sequence` verdict names at least one path present in both scopes; every disjoint pair answers `parallel` with an empty list; no built-in default phase set is consulted; every rejection carries a `plan.*` code naming phase and field; every unvalidatable plan is refused with `readyForDevelopment=false` and a non-zero exit; every legacy markdown plan is answered with a classified transition verdict; verdict latency stays below the bound with zero network, LLM, or write activity.

## User Experience & Functionality

### Command surface

`plan` is a top-level command with three subcommands. `lint plan` is the write-time target of the existing `lint` surface. `--json` is the global machine-output flag; `--against` is the only command-specific flag.

| Invocation | Outcome | Exit |
|---|---|---|
| `plan validate <ref>` | Validate verdict with per-phase data, classified errors, and `readyForDevelopment`. | `0` valid and ready; `1` invalid or unvalidatable |
| `plan diff <ref> [--against <base>]` | Per-path declared-versus-actual table and findings. Default base is `main-tools`. | `0` fully within declared scope; `1` findings |
| `plan overlap <refA> <refB>` | Pairwise verdict with overlapping paths, ordering, and reason. | `0` parallel; `1` run-in-sequence (a verdict, not a failure) |
| `lint plan <ref>` | Per-document plan conformance with locations. | `0` conformant; `1` non-conformant; `2` unreadable |

Exit `1` on a `run-in-sequence` overlap verdict is deliberate: the exit code projects a negative verdict, not an execution failure. Verdict data is always present in the envelope so consumers branch on data, not on the exit alone. Broken invocation grammar resolves through `input.value.rejected` (exit `1`); a diff read that cannot be performed also resolves through `input.value.rejected`.

### Plan document shape

The only accepted schema identifier is `schemaVersion: delivery.plan.v1`.

| Field | Presence | Contract |
|---|---|---|
| `schemaVersion` | Required | Exactly `delivery.plan.v1`; a missing, non-string, or unsupported version is `plan.schema.invalid` naming `schemaVersion`. |
| `workItemRef` | Optional | String declaration of the change ref; never used to locate the artifact. |
| `tier` | Required | Mapping with `name` (required, one of the known tiers `full` or `lite`), optional `phases` (integer phase ids), and optional `escalationTriggers` (non-empty strings). The phase set and triggers are inert declaration data: they round-trip in the verdict and are never evaluated. |
| `defaultLeases` | Optional | Up to 16 non-empty lease names applied to phases that declare no `leases`. |
| `defaultWeightClass` | Optional | Plan-level build-weight default applied once to phases that declare no `weightClass`. |
| `phases` | Required | Non-empty array of at most 64 phase declarations. |

A phase declares:

| Field | Presence | Contract |
|---|---|---|
| `id` | Optional | Positive integer; defaults to the phase's 1-based position. Duplicate ids are `plan.schema.invalid`. |
| `title` | Required | Non-empty string. |
| `summary` | Optional | Non-empty one-line summary echoed by `plan validate` and consumed by the commit path as the plan-phase message context. Omission remains valid; a present but empty or non-string value is `plan.schema.invalid` naming `summary`. |
| `kind` | Required | `planning` (lease-free) or `delivery` (lease-taking). |
| `scope` | Required | Mapping of `files`, `packages`, and `folders`; at least one key must declare a non-empty list. Unknown scope keys are invalid. Each list holds at most 512 non-empty path strings of at most 512 characters. |
| `leaseClass` | Optional | When present it must equal the class implied by `kind`: planning phases are `lease-free`, delivery phases are `lease-taking`. |
| `leases` | Optional | Up to 16 non-empty lease names; falls back to `defaultLeases`. |
| `weightClass` | Optional | Non-empty string; falls back to `defaultWeightClass`. An unknown class is echoed as opaque data, not rejected. |
| `doneArtifacts` | Optional | Mapping of the typed slots `mergeRequestUrl`, `pipelineId`, `deployedEnvironment`, and `trackerTransition`; each present slot is a non-empty string. Unknown slots and non-string values are invalid. |
| `interactions` | Optional | Up to 32 entries of `kind` (`contract-file` or `generated-code`), `target` (a path inside the phase's own scope), and `role` (`producer` or `consumer`). |

Scope matching is boundary-aware and shared by validation, diff, and overlap:

- `files` entries are concrete repository-relative paths and match exactly.
- `folders` entries are directory prefixes matching the folder and its descendants; `src/plan` matches `src/plan/a.ts` but never `src/planner/a.ts`.
- `packages` entries are package-granularity globs such as `packages/core/src/contracts/**`; `*` stays inside one path segment and `**` crosses segments. A package entry with no wildcard is a boundary-aware folder prefix.

### Validate verdict

`plan validate` returns one of two verdicts. `valid` sets `readyForDevelopment: true` and exits `0`. `invalid` sets `readyForDevelopment: false`, carries classified errors, and exits `1`. A change is ready for development exactly when its plan validates and its scope is declared.

The payload carries `verdict`, `readyForDevelopment`, `perPhase`, `errors`, `truncated`, and `totalErrors`. When an artifact was read, it also carries `artifact` (`kind` and `path`) so the format actually used is disclosed. When the document parsed far enough, it carries `schemaVersion`, `tier`, and `tierDeclaration`.

Each error carries `code`, `field`, `problem` (`missing`, `invalid`, or `unsupported`), and—when the defect belongs to a phase—`phase` and a bounded `detail`. Errors are sorted by phase, then field, then code, and truncated deterministically at 32 entries with the total count preserved.

Per-phase data echoes the declared shape for every parsed phase: `id`, `title`, `kind`, the implied `leaseClass`, the optional `summary`, normalized `scope`, effective `leases`, `interactions`, the declared `tier`, and, when declared, `doneArtifacts` and `weightClass`. Planning phases report no delivery artifacts without failing validation or inventing placeholders. Leases and weight are echoed, never re-derived.

The verdict never consults a built-in phase set. The declared tier is echoed verbatim; a tier outside the known set is rejected with `plan.tier.unknown`. Malformed or oversized documents (over 1,048,576 characters or beyond the parser bound) are classified `plan.schema.invalid`, never a stack trace.

### Diff verdict

`plan diff` validates the plan first; an invalid plan resolves to a classified error envelope. It then reads the actual branch diff for `--against` (default `main-tools`) and produces one sorted entry per path plus a findings list:

| Classification | Meaning | Identity |
|---|---|---|
| `within` | The path is covered by at least one phase's declared scope; the first covering phase id is echoed. | none |
| `outside-declared` | The actual path is covered by no declared scope. | `plan.scope.undeclared-paths` |
| `undeclared-missing` | A declared concrete file was not touched by the actual diff. | none (`phase` names the declaring phase) |

The data carries `verdict` (`within` or `findings`), `against`, `entries`, `findings`, `truncated`, and `totalEntries`. Paths are deduplicated, normalized, and sorted; the table is bounded at 64 entries with an explicit truncation marker. The finding is observational: it reports scope drift and does not block delivery.

### Overlap verdict

`plan overlap` validates both plans; if either is invalid, the invocation returns a classified error envelope naming the first plan defect. For two valid plans it computes the most concrete shared descriptor for every declared pair, then returns:

| Verdict | Data | Exit |
|---|---|---|
| `parallel` | Empty `overlappingPaths`, `totalOverlappingPaths: 0`. | `0` |
| `run-in-sequence` | Sorted `overlappingPaths`, `ordering`, `reason`. | `1` |

An overlapping entry is the concrete path when either plan declares it concretely, otherwise the shared pattern string. The list is sorted lexicographically and bounded at 64 entries with a total count. Every sequence verdict names at least one overlapping path; a sequence verdict without paths is not representable.

Ordering is producer-first when a declared interaction decides it: a `producer` interaction in one plan on the same target as a `consumer` interaction in the other places the producer plan first with `reason: shared-contract-files`. Otherwise, a plan that declares production over an overlapping path is ordered first; when neither or both sides do, ordering falls back to the lexicographically smaller change ref. Every non-interaction sequence verdict carries `reason: shared-paths`. Ordering is symmetric across argument order: the same pair yields the same ordering and reason.

Package-pattern comparison is conservative: two patterns that share a static prefix answer `run-in-sequence` even when their dynamic segments are provably disjoint (for example `packages/core/a*` and `packages/core/b*`). The error direction is safe—a false sequence, never a false parallel—and exact pattern-pair intersection belongs to the downstream scheduler (M1-S17). `tests/behaviour/plan-overlap-precision.test.ts` pins this approximation.

### Lint target

`lint plan <ref>` is an additive target of the existing lint surface. It reports `{ changeRef, target: "plan", documents: [{ path, verdict, errors: [{ code, location, detail }] }] }`, where `location` names the phase and field. It cannot be combined with `--pm-notes` or `--registry`.

A conformant plan is `verdict: valid` with exit `0`. A non-conformant plan is `verdict: invalid` with the shared `plan.*` identities and exit `1`. A missing plan is invalid with `plan.artifact.missing`. A document that cannot be read or decoded is `verdict: unreadable` with `lint.document.unreadable` and exit `2`, because the document was not evaluated. The pm-notes and registry targets are unchanged and keep their existing output.

### Artifact precedence and legacy transition

`readPlanArtifact` locates the change folder through the unified change convention and applies a fixed precedence: read `chg-<ref>-plan.yaml` when present; otherwise read `chg-<ref>-plan.md`. When both exist, the YAML plan is read and the verdict's `artifact` names it. A markdown plan is answered with `plan.format.legacy-markdown`, `readyForDevelopment=false`, and exit `1`; it is readable and classified, never schema-valid and never a crash. A ref with no plan artifact of either format is `plan.artifact.missing`. Legacy readability is a transition contract: it stays available, and its removal is a separate future change.

### Edge cases

- **Absent plan:** `plan validate` returns the invalid verdict with `plan.artifact.missing`; `plan diff` and `plan overlap` return a classified error envelope.
- **Unreadable artifact:** `plan validate` classifies `plan.schema.invalid` naming the artifact; `lint plan` reports `lint.document.unreadable` and exits `2`.
- **Unknown tier:** `plan.tier.unknown`, naming `tier.name`, regardless of any other valid content.
- **Wrong lease class:** a `leaseClass` that disagrees with `kind` is `plan.schema.invalid` naming the field and phase.
- **Interaction outside scope:** an interaction target not covered by the phase's own scope is invalid.
- **Unknown weight class:** accepted and echoed as opaque data; the known-weight vocabulary belongs to the downstream scheduler.
- **Oversized input:** the document size and parse bounds classify the document instead of consuming unbounded resources.
- **Repeated errors:** sorted and bounded; truncation never changes the verdict.

## Technical Architecture & Codebase Map

### High-level design

The schema, vocabulary, bounds, and verdict payload types are runtime-neutral contracts data. Validation, overlap, diff, and path matching are pure domain functions that receive plan values and injected read outcomes; YAML parsing arrives through an injected port. CLI handlers are I/O-free over injected runtimes, return data or a classified failure, and never choose an exit digit. The standalone CLI edge composes the file adapter and projects a verdict to `{0, 1, 2}` through the result-contract projection.

### Core components and directory structure

| Path | Component | Responsibility |
|---|---|---|
| `packages/core/src/contracts/plan.ts` | Plan vocabulary | `delivery.plan.v1`, known tiers and phase kinds, done-artifact slots, interaction kinds/roles, overlap reasons, diff classifications, payload types, bounds, `plan.*` identities, and the artifact-path/lease-class helpers. |
| `packages/core/src/domain/plan-validate.ts` | Validation verdict | Pure schema validation, classified errors, tier and per-phase echo, ready-for-development, legacy and absent classification, bounded payloads, and document recovery for downstream consumers. |
| `packages/core/src/domain/plan-overlap.ts` | Overlap verdict | Pairwise shared-descriptor computation, producer-first ordering, stable reasons, and bounded path lists. |
| `packages/core/src/domain/plan-diff.ts` | Diff verdict | Declared-versus-actual path classification, first-covering-phase echo, findings, and bounded tables. |
| `packages/core/src/domain/plan-paths.ts` | Path matching | Path normalization, wildcard-to-regex conversion, boundary-aware folder matching, package coverage, and static prefix extraction. |
| `packages/adapters/src/file/plan-artifact.ts` | Artifact reader | Change-folder location, YAML-before-markdown precedence, and text/absent/unreadable outcomes. |
| `packages/cli/src/commands/plan.ts` | Command family | `validate`, `diff`, and `overlap` handlers, grammar, injected runtimes, text rendering, and verdict-to-exit projection. |
| `packages/cli/src/commands/lint.ts` | Lint target | `lint plan` grammar, document report, unreadable classification, and exit projection. |
| `packages/cli/src/output/plan-text.ts` | Text renderers | Deterministic `verdict=`, `overlapping=`, classification-line, and truncation output. |
| `packages/core/src/contracts/error-table.ts` | Error identities | The five additive `plan.*` rows and the lint unreadable row. |
| `packages/cli/src/edge.ts` | Composition | Composes the plan runtime over the file adapter and injected diff reader and registers the command. |

### Data architecture

The plan document is a YAML file in the change folder; no other store is read or written by the verdict paths. The validate path performs one plan read; overlap performs two plan reads; diff performs one plan read plus one injected diff read through the `readDiff` port. Verdict payloads are derived data only. The `artifact` echo records which file was read; the document is never modified.

### API and interface contracts

- `readPlanArtifact({ changeRef, changesDirectory, fs })` returns `{ ok: true, artifact, text }` or `{ ok: false, reason: "absent" | "unreadable", workItemRef, path? }`.
- `validatePlan({ workItemRef, read, parseYaml })` returns the `PlanValidateData` verdict; `planDocumentFromValidateData(data)` recovers the declared shape for overlap and diff.
- `computePlanOverlap({ refA, planA, refB, planB })` returns `PlanOverlapData`.
- `computePlanDiff({ workItemRef, document, actualPaths, against })` returns `PlanDiffData`.
- The injected YAML parser returns a parsed value or an `unparseable`/`bounded` failure; it never throws into a verdict.

## Non-Functional Requirements

| Concern | Current guarantee |
|---|---|
| Determinism | Identical inputs produce byte-identical machine output, including path order, error order, ordering, and reasons. |
| Latency | No network, provider-engine, or LLM calls; p95 below 500 ms per invocation for plans up to 30 phases. The recorded 30-phase evidence is a 6.41 ms median and 11.25 ms p95 (Bun 1.4.4, linux/x64). |
| Read-only posture | Validate, diff, overlap, and `lint plan` perform zero writes, fences, state mutations, process spawns, network calls, and credential reads. |
| Bounded output | Documents, phases, scope entries, interactions, errors, overlapping paths, and diff paths have declared bounds; truncation is explicit and deterministic and never changes a verdict. |
| Error classification | Every rejection carries a `plan.*` code naming the phase and field; the generic fallback is reserved for genuine internal defects. |
| Purity and boundaries | Schema and payloads are contracts data; verdict logic is pure domain code; handlers are I/O-free with injected runtimes; the CLI edge alone projects exits. |
| Transition availability | Legacy markdown plans resolve for the entire transition window with zero crashes and a classified verdict. |

## Quality Assurance Strategy

### Testing approach

| Level | Location | Scope |
|---|---|---|
| Behaviour | `tests/behaviour/plan-validate.test.ts`, `plan-validate-rejections.test.ts`, `plan-tier.test.ts`, `plan-ready-gate.test.ts`, `plan-legacy.test.ts`, `plan-overlap-*.test.ts`, `plan-diff.test.ts`, `plan-lint.test.ts`, `plan-envelope.test.ts`, `plan-readonly.test.ts`, `plan-determinism.test.ts`, `plan-bounded-output.test.ts`, `plan-performance.test.ts` | Valid and rejected plans, tier and artifact echo, gate refusal, legacy and absent handling, overlap precision and ordering, diff classification, lint classes, envelope and exit projection, read-only posture, replay determinism, truncation, and latency. |
| Structure | `tests/structure/plan-contract.test.ts` | Contract constants, payload shape, subpath exports, and registration. |
| Golden | `tests/golden/plan/*.json` with `tests/golden/plan/regenerate.ts` | Captured validate, diff, and overlap envelopes for the baseline, findings, parallel, and sequence cases. |
| Fixtures | `tests/fixtures/plan/**` | Valid, invalid, legacy, absent, diff, overlap, bounded, and queue-ready non-regression corpora. |

### Test data and scenarios

Valid fixtures cover the baseline, `full` and `lite` tiers, and wildcard scope. Invalid fixtures hold one defect per file with a committed expectation table naming code, phase, and field. Legacy fixtures cover prose, headings and checklists, empty content, a YAML fragment stored as markdown, a large document, and the both-formats precedence case. Diff and overlap fixtures cover within, outside, wildcards, bounded payloads, parallel pairs, production ordering, and precision. The `queue-ready` non-regression fixture proves the shipped command performs zero plan reads and emits byte-identical output.

## Operational & Support

### Configuration

The family reads no configuration key and no environment variable. The only option is `--against <base>` for diff; the default base is `main-tools`. The artifact directory is the repository `doc/changes` tree resolved by the edge.

### Observability

The standard envelope supplies the run id, timing, and exit code. Verdicts, per-phase echoes, overlapping paths, ordering, reasons, and classified errors are structured envelope data, so no new metric, log, trace, or alert is required.

### Cost and infrastructure

The feature adds no dependency, package, service, or CI job. It runs inside the existing workspace test and boundary jobs.

## Dependencies & Risks

- **Depends on** the [result contract](feature-result-contract.md) for the envelope, the error table, classification, and exit projection.
- **Depends on** the [pm-notes lint and phase transitions](feature-pm-notes-lint-and-phase-transitions.md) surface that hosts the plan lint target.
- **Depends on** an embedder-injected `readDiff` port for actual-diff input and the file adapter for artifact reads.
- **Consumed by** the scheduler (M1-S17) for overlap verdicts, tier, ready-for-development, leases, and weight; by the [commit primitive](feature-commit-primitive.md) (M1-S14) for declared scope context; and by the ceremony engine (M2-S3) for tier data.
- **Risk — schema drift:** the writer and validator could diverge. Mitigation: one contracts vocabulary, write-time lint, and fixtures derived from the template shape.
- **Risk — false parallel:** incomplete declarations could hide a real overlap. Mitigation: package/folder granularity, boundary-aware matching, a precision corpus, and a non-vacuity guard that a sequence verdict names real shared paths.
- **Risk — legacy rot:** in-flight markdown plans could stop being readable. Mitigation: a legacy corpus and a classified transition verdict that never crashes.
- **Risk — exit-code folklore:** consumers may treat a sequence verdict as a failure. Mitigation: verdict data is always present, and DEC-1's projection is asserted across the family.

## Glossary & References

| Term | Definition |
|---|---|
| Delivery plan | The versioned YAML change artifact `chg-<ref>-plan.yaml` declaring phases, scope, done-artifacts, leases, weight, interactions, and tier. |
| Declared scope | The files, packages, and folders a phase declares it will modify. |
| Done-artifact | Declared evidence that a phase is complete (MR URL, pipeline id, deployed environment, tracker transition); echoed, not verified in this surface. |
| Repo lease | Exclusive right to deliver to a repository; delivery phases are lease-taking, planning phases are lease-free. |
| Build-weight class | Resource class of a change's build, echoed for downstream scheduling. |
| Declared interaction | A contract-file or generated-code write annotated `producer` or `consumer`. |
| Ceremony tier | The plan-declared ceremony variant (`full`, `lite`, or a rejected unknown identifier) with inert phase-set and escalation-trigger data. |
| Ready for development | The state in which a plan validates and its scope is declared; computed by `plan validate`. |
| Overlap verdict | The pairwise answer `parallel` or `run-in-sequence`, with named overlapping paths and producer-first ordering. |
| Transition verdict | The classified `plan.format.legacy-markdown` answer for a legacy markdown plan. |

See also: [Result Contract and Error Table](feature-result-contract.md), [pm-notes Lint and Phase Transitions](feature-pm-notes-lint-and-phase-transitions.md), [Verify Change and Exit Taxonomy](feature-verify-change-and-exit-taxonomy.md), [Repository glossary](../../overview/glossary.md), [CLI command registry](../../planning/oss-tooling/cli-command-registry.md), and [ODR-0003](../../decisions/ODR-0003-cli-command-naming-v1-lock.md).

## Scheduling engine reconciliation (GH-237)

The scheduler owns the weight vocabulary the plan schema deferred. A validated
plan that omits `weightClass`/`defaultWeightClass` resolves to `standard`; a
declared-but-unrecognized value resolves to `heavy`; an invalid, unreadable, or
absent plan resolves to `heavy` with source evidence `plan-unreadable` or
`plan-absent`. The plan's tier and declared interactions are consumed as intent
evidence; the scheduler never treats declared `leases` as a grant. See
[Scheduling Engine](feature-scheduling-engine.md).
