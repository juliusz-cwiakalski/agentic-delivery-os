---
change:
  ref: GH-226
  type: feat
  status: Proposed
  slug: machine-readable-plan-schema
  title: "M1-S13: Machine-readable delivery plan schema"
  owners: [engineering]
  service: delivery-os-cli
  labels: [change, m1, delivery-engine]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal: [delivery-os-core contracts and domain, delivery-os-cli command surface, state layer (GH-174), pm-notes lint and phase transitions (GH-179), result contract (envelope and error table), read-only repository reader]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make delivery plans machine-readable declared artifacts so parallelism is computable, overlap is answered mechanically with paths named, and a change is ready for development exactly when its plan validates — without an LLM in the scheduler's loop.

## 1. SUMMARY

Delivery plans stop being prose markdown consumed only by LLMs and become a versioned, machine-readable (YAML) declared artifact: per-phase declared scope (files, packages, folders), done-artifacts, repo leases and build-weight class, declared producer/consumer interactions, and the ceremony tier as data. This change delivers the `plan` command family — `validate` (schema plus the ready-for-development verdict), `diff` (declared scope versus actual branch diff), `overlap` (pairwise run-in-sequence-versus-parallel with overlapping paths named) — integrates a plan target into `lint`, and migrates the plan-writer output format while keeping legacy markdown plans readable during the transition. Scheduling, lane execution, and artifact verification at joins remain downstream consumers (M1-S17 and later); this story makes their input computable.

## 2. CONTEXT

### 2.1 Current State Snapshot

The delivery pipeline is orchestrated around plans that are prose markdown documents authored by the plan-writer agent and consumed by the run-plan command and the coder agent. The eleven-phase lifecycle is hardcoded rather than declared data; the M0 state layer (GH-174, delivered) provides verified state reads, and the pm-notes lint plus phase transitions (GH-179, delivered) provide a lint command surface (pm-notes default target, registry flag) and the envelope/error-table/exit-taxonomy contract that all commands share. Milestone M1 packs already specify the proposed `plan` command surface, its man page, seeded test scenarios, and the `plan` registry row; the operator requirements input ranks machine-readable plans with per-phase scope and done-artifacts as P0 (R4) and ceremony tiers as configuration as P1 (R10, seam here; engine M2-S3).

### 2.2 Pain Points / Gaps

- Plans carry no computable scope: parallelism between two changes cannot be decided without an LLM reading prose.
- The scheduler cannot batch without an LLM in the loop; there is no mechanical sequence-versus-parallel answer.
- Lane joins verify exit codes instead of artifacts: plans do not declare the MR URL, pipeline id, deployed environment, or tracker transition that would make a phase verifiably done.
- The eleven-phase lifecycle is hardcoded instead of declared per ceremony tier/variant as data.
- There is no schema-level conformance check for plans at write time, and no ready-for-development gate grounded in a validated plan.

## 3. PROBLEM STATEMENT

Because delivery plans are unstructured prose, the coordinating system cannot compute parallelism, order producers before consumers, verify phase completion by artifacts, or gate development start on a validated declared scope — so batching requires an LLM in the loop, unsafe overlaps go undetected until conflicts surface in review, and the fixed eleven-phase ceremony is applied regardless of change size, resulting in wasted delivery cycles and unverifiable lane joins.

## 4. GOALS

- **G-1**: Define a versioned machine-readable (YAML) delivery plan schema as the plan-writer output format, declaring per-phase scope, done-artifacts, leases, weight class, interactions, and ceremony tier.
- **G-2**: Make parallelism computable: `plan overlap` answers run-in-sequence or parallel for a plan pair, naming the overlapping paths and ordering producers before consumers.
- **G-3**: Provide the `plan` command family — `validate`, `diff`, `overlap` — with classified errors and stable verdict data in the standard envelope.
- **G-4**: Integrate plan conformance into `lint` as a plan target checked at write time.
- **G-5**: Ground the ready-for-development gate in the plan: a change is ready for development exactly when its plan validates and its scope is declared; the gate refuses an unvalidatable plan.
- **G-6**: Make the ceremony tier/variant data in the plan (per-tier phase sets and escalation triggers; no hardcoded eleven), and declare planning phases lease-free versus delivery phases lease-taking.
- **G-7**: Provide a migration path from the markdown plan format: the writer output flips in this change and legacy markdown plans remain readable throughout the transition.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Plan-writer output conformance | 100% of plans written after the format flip pass `plan validate` with verdict `valid` |
| Overlap correctness (seeded scenario SC-M1-06) | Every run-in-sequence verdict names ≥1 overlapping path that exists in both declared scopes; 0 false-parallel fixtures |
| Disjoint-plan verdicts | 100% of disjoint pairs answer `parallel` with an empty overlapping-path list |
| Tier source of truth | 0 built-in default phase sets consulted by plan verdicts; the declared tier is echoed verbatim in verdict data; unknown tier rejected with `plan.tier.unknown` |
| Error classification | 100% of rejectable plans rejected with a classified `plan.*` code naming phase and field; 0 silent accepts of invalid schema fixtures |
| Ready-for-development gate (seeded scenario SC-M1-07) | 100% of unvalidatable-plan fixtures refused: `readyForDevelopment=false`, classified error, exit 1 |
| Legacy readability | 100% of legacy markdown plans answered with a classified transition verdict; 0 crashes, 0 silent schema-valid accepts |
| Verdict latency and posture | p95 < 500 ms per invocation for plans up to 30 phases; 0 network calls, 0 LLM calls, 0 writes |

### 4.2 Non-Goals

- **NG-1**: No scheduling, queueing, lanes, daemon, dispatch, or lane execution — those consume this story's verdicts (M1-S17 and related).
- **NG-2**: No commit primitive or phase-transition commits (M1-S14).
- **NG-3**: No ceremony runner or tier engine (M2-S3); only the tier-as-data declaration and its reflection in verdicts land here.
- **NG-4**: No LLM, network, or provider-engine calls in any plan verdict path; all verdicts are deterministic.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Versioned machine-readable delivery plan document (YAML) as the plan-writer output format | The declared artifact is the engine's input; prose cannot be computed against. |
| F-2 | Per-phase declared scope: files, packages, folders | Makes conflict detection and scope checking mechanical. |
| F-3 | Per-phase done-artifacts: MR URL, pipeline id, deployed environment, tracker transition | Lane joins verify artifacts, not exit codes. |
| F-4 | Per-phase repo leases and build-weight class | Scheduling can respect single-flight and heavy-build constraints without re-deriving them. |
| F-5 | Declared interactions: contract files and generated code with producer/consumer semantics | The scheduler orders producers before consumers mechanically. |
| F-6 | Ceremony tier/variant as data: per-tier phase sets and escalation triggers in the plan | No hardcoded eleven; small tickets stop paying full-ceremony cost. |
| F-7 | Phase lease classes declared in the plan: planning phases lease-free, delivery phases lease-taking | Parallel-safe preparation is distinguishable from protected delivery by data. |
| F-8 | `plan validate`: schema conformance verdict plus the ready-for-development verdict | One command answers "is this plan computable and is this change ready". |
| F-9 | `plan diff`: declared scope versus actual branch diff, per-path classified | Scope discipline becomes observable during delivery. |
| F-10 | `plan overlap`: pairwise sequence-versus-parallel verdict with overlapping paths named and producer-first ordering | The batching decision becomes mechanical and auditable. |
| F-11 | Plan lint target in `lint` | Conformance is checked at write time, before the plan is consumed. |
| F-12 | Ready-for-development gate grounded in plan validity | Development starts only on a validated, scope-declared plan. |
| F-13 | Migration path from markdown plans: writer output flips; legacy plans readable during transition | In-flight changes are not stranded by the format flip. |

### 5.1 Capability Details

- **F-1**: The plan is a versioned YAML document stored with the change artifacts under the unified change convention, carrying a schema version field so the format evolves additively. It is the authoritative plan-writer output after the flip.
- **F-2**: Each phase declares the files, packages, and folders it will modify. Declarations are inert comparison data; wildcards at package/folder granularity are expressible so declarations stay maintainable.
- **F-3**: Each delivery phase declares the artifacts that prove it done — MR URL, pipeline id, deployed environment, tracker transition — as typed declaration slots. Verdicts echo them; verification of their reality is downstream scope (scheduler/lane joins).
- **F-4**: Each phase (or the plan) declares the repo leases it needs and its build-weight class (for example standard versus heavy). Verdict data echoes leases and weight so later scheduling never re-derives them.
- **F-5**: Phases declare interactions — written contract files and generated code — annotated with producer/consumer semantics, so a pair's ordering can be computed from declarations alone.
- **F-6**: The plan declares its ceremony tier/variant. Per-tier phase sets and escalation triggers are plan data, not command constants; validate and overlap read the tier from the plan and echo it. A tier outside the known set is classified, not guessed.
- **F-7**: The plan distinguishes planning phases (declared lease-free, safely parallel) from delivery phases (lease-taking). Validate reflects this split in per-phase verdict data.
- **F-8**: `plan validate <ref>` answers verdict `valid` or `invalid` with per-error classified codes (naming phase and missing/invalid field), per-phase data (scope, artifacts, leases, weight, interactions, tier), and `readyForDevelopment`. Invalid schema, an unknown tier, or undeclared declared-scope violations are classified; a legacy-format plan is answered with a classified transition verdict (readable, not schema-valid).
- **F-9**: `plan diff <ref> [--against <base>]` compares declared scope against the actual branch diff and reports a per-path table: `within`, `outside-declared` (actual change outside any declared scope), `undeclared-missing` (declared but untouched). Undeclared actual paths are reported under the classified scope code.
- **F-10**: `plan overlap <refA> <refB>` answers `parallel` or `run-in-sequence`. A sequence verdict names every overlapping path (present in both declared scopes) and reports an ordering with the producer plan first and a reason such as shared contract files. The verdict is an answer, not an error state.
- **F-11**: `lint` gains a plan target checked at write time, reporting per-document verdicts with classified errors and locations, consistent with the existing pm-notes and registry targets.
- **F-12**: A change is ready for development when its plan validates and its scope is declared. The gate is computed by `plan validate` and expressed as `readyForDevelopment` in verdict data; an unvalidatable plan is refused with exit 1 and a classified error.
- **F-13**: The plan-writer output format flips to the schema in this change; the implementation-plan template and consuming prompts are updated with it. Legacy markdown plans remain readable for the whole transition: verdicts classify them as legacy format rather than crashing or silently accepting them as schema-valid. Removal of legacy readability is explicitly deferred.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Authoring (write time)
  plan-writer produces the YAML plan for <ref>
    → lint plan <ref> runs at write time
    → non-conformant: classified errors with locations loop back to the writer
    → conformant: plan is committed with the change artifacts
```

```
Flow 2 — Ready gate
  coordinator asks: plan validate <ref>
    → verdict valid | invalid; per-phase data (scope, artifacts, leases, weight, interactions, tier)
    → valid: readyForDevelopment=true, exit 0
    → invalid: classified plan.* error naming phase and field, readyForDevelopment=false, exit 1 (gate refuses)
```

```
Flow 3 — Planning a batch (parallelism computed)
  coordinator validates each candidate plan
    → pairwise plan overlap:
        disjoint scopes      → verdict=parallel (exit 0)
        shared paths         → verdict=run-in-sequence, overlappingPaths named,
                               ordering producer-first, reason=shared-contract-files (exit 1, a verdict)
    → downstream (M1-S17) queue add consumes the verdicts; its park-behind-valid-plan
      warning is the recorded integration point, not this story's behavior
```

```
Flow 4 — Delivery-time scope observation
  plan diff <ref> [--against <base>]
    → per-path table: within | outside-declared | undeclared-missing
    → informational in this story; blocking enforcement is downstream scope
```

```
Flow 5 — Legacy transition
  plan validate on a change still carrying a markdown plan
    → readable: classified legacy-format verdict, no crash, never silently schema-valid
    → new plans are written in the YAML format from the flip onward
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The versioned machine-readable (YAML) plan schema: per-phase declared scope (files, packages, folders), done-artifacts (MR URL, pipeline id, deployed environment, tracker transition), repo leases, build-weight class, declared interactions (contract files, generated code; producer/consumer), ceremony tier/variant as data (per-tier phase sets and escalation triggers), and the planning-lease-free / delivery-lease-taking phase classes.
- The `plan` command family: `validate`, `diff`, `overlap` with the verdicts, output data fields, classified error codes, and exit semantics specified in section 8.
- Plan lint integrated into the `lint` command surface as a plan target.
- The ready-for-development verdict and gate refusal computed by `plan validate`.
- The migration path: plan-writer output flips to the schema; implementation-plan template, writing guidance, and consuming prompts updated together (including generated-plugin regeneration for prompt changes); legacy markdown plans remain readable during the transition.
- Scenario fixtures covering the seeded scenarios SC-M1-06 and SC-M1-07 and schema conformance classes.
- Documentation impacts: new feature specification under the system spec area (authored at the documentation-reconciliation phase or flagged as a gap), plan file naming in the unified change convention guide, and `ados_distribution` markers on changed guides/templates.

### 7.2 Out of Scope

- [OUT] Scheduler, queue scheduling, lanes, daemon, dispatch, and lane execution (M1-S17 and related stories).
- [OUT] Commit primitive and phase-transition commits (M1-S14).
- [OUT] Ceremony runner and tier engine (M2-S3); only tier-as-data and its reflection in verdicts land here.
- [OUT] `queue add` parking/warning behavior behind a valid plan — recorded as the M1-S17 integration point; the existing read-only `queue ready` command is unchanged (see DEC-2).
- [OUT] Execution-time verification of done-artifacts at lane joins — plans declare them; verifying their reality is scheduler/lane scope.
- [OUT] Blocking enforcement of `plan diff` findings; diff is observational in this story.
- [OUT] Removal of legacy markdown plan readability (deferred past the transition window).
- [OUT] New HTTP/REST surfaces, external integrations, credential reads, or LLM participation in any verdict path.
- [OUT] Built-in default phase sets or tier constants in command behavior (anti-goal; tier is plan data only).

### 7.3 Deferred / Maybe-Later

- N-way overlap and batch composition (the scheduler's batching job, not pairwise analysis).
- Lint auto-fix for plan documents.
- Machine evaluation of escalation triggers (consumed as data here; evaluated by the M2-S3 engine).
- Promoting `plan diff` findings to blocking gates once scheduler consumers exist.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. No HTTP endpoints are added or changed. The command-line surface is the contract:

| Invocation | Verdict / data | Exit |
|------------|----------------|------|
| `<binary> plan validate <ref>` | `verdict` `valid`/`invalid`; `perPhase` (scope, artifacts, leases, weight, interactions, tier); `readyForDevelopment`; per-error classified codes naming phase and field | 0 valid; 1 invalid or unvalidatable |
| `<binary> plan diff <ref> [--against <base>]` | declared-versus-actual per-path table: `within` / `outside-declared` / `undeclared-missing` | 0 when fully within declared scope; 1 with classified scope findings otherwise |
| `<binary> plan overlap <refA> <refB>` | `verdict` `parallel`/`run-in-sequence`; `overlappingPaths`; `ordering`; `reason` | 0 parallel; 1 sequence verdict — a verdict, not a failure |

Exit semantics follow the plan man page: exit 1 carries negative verdicts (invalid schema, unvalidatable plan) and a run-in-sequence overlap verdict alike; verdict data is always present in the envelope so consumers branch on data, not on exit alone (DEC-1). All commands return the standard result envelope with machine-output support.

### 8.2 Events / Messages

None. No events are emitted or consumed; verdicts are returned in the command envelope.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Delivery plan document | Versioned YAML artifact stored with the change artifacts per the unified change convention; carries a schema version for additive evolution; named `chg-<ref>-plan.yaml` (DEC-7). |
| DM-2 | Phase scope declaration | Per-phase files, packages, folders with package/folder granularity wildcards. |
| DM-3 | Done-artifact declaration | Typed per-phase slots: MR URL, pipeline id, deployed environment, tracker transition. |
| DM-4 | Lease and weight declaration | Repo lease needs and build-weight class per phase or plan-wide. |
| DM-5 | Interaction declaration | Contract-file and generated-code writes with producer/consumer semantics. |
| DM-6 | Tier/variant declaration | Ceremony tier as data: per-tier phase sets and escalation triggers. |
| DM-7 | Verdict payloads | Envelope data for validate/diff/overlap: verdict, perPhase, overlappingPaths, ordering, readyForDevelopment, per-path diff table. |
| DM-8 | Additive error identities | Classified codes: `plan.schema.invalid`, `plan.scope.undeclared-paths`, `plan.tier.unknown` (pinned by the contracts pack), plus the proposed additive transition identity `plan.format.legacy-markdown` so legacy readability has a classified verdict surface (refinement empowered by the milestone-pack "contracts are proposals" rule). |

### 8.4 External Integrations

None new. Tracker transitions, MR URLs, and pipeline ids appear in plans as inert declaration data; this story performs no tracker or CI reads or writes. `plan diff` consumes the existing read-only repository diff capability already available to read-only commands.

### 8.5 Backward Compatibility

- Legacy markdown plans remain readable for the whole transition window; verdicts classify them (`plan.format.legacy-markdown`, proposed) rather than crashing or silently accepting them as schema-valid. Removal is deferred.
- The plan-writer output format flips in this change; consuming prompts and the template flip with it, and generated-plugin output is regenerated in the same change so downstream harnesses stay in sync.
- Envelope, error-table, and exit-taxonomy contracts are extended additively; existing pm-notes/registry lint targets and all delivered commands are unchanged.
- The existing read-only `queue ready` surface is unchanged (DEC-2).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism: identical inputs produce byte-identical machine output (replay property) | 100% byte-identical on replay |
| NFR-2 | Verdict latency: no network, provider-engine, or LLM calls; bounded by local reads | p95 < 500 ms per invocation for plans up to 30 phases |
| NFR-3 | Read-only posture: plan validate/diff/overlap and the lint plan target perform zero writes, fences, state mutations, process spawns, and credential reads | 0 violations across all fixtures |
| NFR-4 | Bounded output: verdict payloads are bounded; oversized path lists truncate deterministically with an explicit truncation marker | No unbounded emission; deterministic truncation marker present |
| NFR-5 | Error classification: every rejection carries a `plan.*` code from the error table naming the phase and field; the generic internal fallback appears only for genuine internal defects | 100% of rejectable fixtures classified; 0 fallback-classified schema fixtures |
| NFR-6 | Transition availability: legacy markdown plans resolve for the entire transition window | 0 crashes; 100% answered with a classified transition verdict |
| NFR-7 | Purity boundaries: schema definitions and verdict logic live as data and pure functions in the core contracts/domain layers; command definitions stay I/O-free with injected runtimes; YAML parsing follows the existing adapter precedent | Boundary checks pass with 0 violations |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

The standard envelope's run id and timing accompany every invocation; verdict, per-phase data, and error codes are already structured envelope data, so verdict outcomes are observable without new telemetry infrastructure. No new metrics, logs, traces, or alerts are introduced; the seeded scenarios and fixtures are the regression evidence.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Schema drift between plan-writer output and the validator (plans written that fail validation) | H | M | The schema is the single source for both surfaces; lint checks plans at write time; conformance fixtures cover the seeded scenarios and error classes. | Low: drift caught at write time, before consumption. |
| RSK-2 | In-flight changes carrying markdown plans when the writer flips | M | M | Legacy plans stay readable with a classified transition verdict; no forced rewrite; readability removal explicitly deferred (section 7.2). | Low: transition window covers all in-flight work. |
| RSK-3 | Over- or under-declared scope makes `plan diff` noisy (false outside-declared findings) | M | M | Package/folder granularity wildcards keep declarations maintainable; diff is observational this story; lint flags under-declaration at write time. | Low: findings informational, tuned before enforcement lands. |
| RSK-4 | Exit-1-on-sequence-verdict surprises script consumers expecting exit 0 (seed SC-M1-06 asserted exit 0) | M | M | Exit semantics pinned to the plan man page ("a verdict, not a failure", DEC-1); verdict data always present so consumers branch on data; the test plan reconciles the seed assertion. | Low: documented and consistently applied across the family. |
| RSK-5 | Changed guides/templates fail the documentation-distribution drift guard | M | M | `ados_distribution` markers declared on every changed distributable doc; the distribution test runs in quality gates and blocks merge on drift. | Low: guard is deterministic and wired into CI. |
| RSK-6 | Generated Claude-plugin output drifts after prompt-format changes | M | M | Prompt-source changes and regenerated plugin output are committed together; CI fails on stale generated output. | Low: staleness check is automatic. |
| RSK-7 | Consumer prompts (run-plan, coder) temporarily expect markdown while the writer emits YAML | H | L | Writer flip, template, and consuming prompt updates land in the same change (F-13 scope); legacy readability bridges any gap. | Low: single-change atomic flip with bridge. |

## 12. ASSUMPTIONS

- Dependencies are delivered and in-tree: the state layer (GH-174) and pm-notes lint plus phase transitions (GH-179), including the `lint` command surface and the result contract (envelope, error table, exit taxonomy).
- Plans remain change-folder artifacts under the unified change convention; the YAML plan file name follows DEC-7.
- Milestone-pack contracts (plan man page, contracts section, seeded scenarios) are proposals that this story refines; the four pinned decisions are binding and not re-derived.
- The existing read-only repository reader is sufficient for `plan diff`'s actual-diff input; no new repository access class is required.
- Workspace code follows the repository's TypeScript, testing-strategy, and purity rules; no license headers are added by agents.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | State layer (GH-174) | Verified state reads; delivered. |
| Depends on | pm-notes lint + phase transitions (GH-179) | `lint` command surface hosting the plan target; delivered. |
| Depends on | Result contract | Envelope, error table, `{0,1,2}` exit projection; extended additively. |
| Depends on | Read-only repository reader | Actual branch diff input for `plan diff`. |
| Blocks | M1-S17 Scheduling engine (GH ticket per backlog) | Consumes overlap verdicts, tier, ready-for-development, leases, weight. |
| Blocks | M1-S20 Agent integration | Plan-writer emits the M1-S13 schema; prompts reference the plan surface. |
| Blocks | M2-S3 Ceremony engine | Consumes tier data declared in M1-S13 plans. |
| Informs | M1-S14 Commit primitive | Declared scope is useful context for precise staging; formal dependency is that story's to declare. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| — | None at time of writing. | The exit-code reconciliation and the `queue ready` scope question were resolved during planning; both are recorded as DEC-1 and DEC-2. The legacy-format verdict identity is proposed as an additive refinement (DM-8) and confirmed at review. | Closed |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Adopt the plan man page's exit semantics: exit 0 for valid/parallel verdicts; exit 1 for invalid schema, unvalidatable plans, and run-in-sequence overlap verdicts ("a verdict, not a failure"), with verdict data always in the envelope. | The contracts pack empowers story-time refinement of proposed contracts; the man page is internally consistent with the shared refusal pin, and envelope data lets consumers branch on verdicts. The SC-M1-06 seed asserting exit 0 is reconciled by the test plan. | 2026-11-05 |
| DEC-2 | The ready-for-development gate is computed and refused by `plan validate`; the existing read-only `queue ready` command is unchanged, and the queue-add park-behind-valid-plan warning is recorded as the M1-S17 integration point. | Minimal in-scope realization: `queue ready` ships six closed readiness conditions with zero-new-reads guarantees; extending it would duplicate the gate and expand a shipped read-only surface. | 2026-11-05 |
| DEC-3 | Ceremony tier/variant is data in the plan — per-tier phase sets and escalation triggers; no hardcoded eleven. | Binding pin from the ticket and planning session; enables P1 operator requirement R10 (seam here, engine M2-S3). | 2026-11-05 |
| DEC-4 | Planning phases are declared lease-free (safely parallel); delivery phases are lease-taking. | Binding pin from the ticket and planning session; makes the parallel/protected boundary computable. | 2026-11-05 |
| DEC-5 | Overlap verdicts name the overlapping paths. | Binding pin from the ticket and planning session; a sequence verdict without paths is not auditable. | 2026-11-05 |
| DEC-6 | Ready-for-development refuses an unvalidatable plan: `readyForDevelopment=false`, classified `plan.schema.invalid` naming phase and field, exit 1. | Binding pin from the ticket and planning session; the gate must be mechanical. | 2026-11-05 |
| DEC-7 | The machine-readable plan is named `chg-<ref>-plan.yaml` under the existing change folder; legacy `chg-<ref>-plan.md` remains valid during the transition and both are documented in the unified change convention guide. | Preserves the established `chg-<ref>-*` artifact naming; the suffix distinguishes format so consumers and humans never guess. | 2026-11-05 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Delivery plan schema definition (core contracts/data layer) | New |
| Plan verdict and overlap logic (core domain layer, pure) | New |
| `plan` command family — validate, diff, overlap (CLI command surface) | New |
| Error table — additive `plan.*` identities | Updated |
| `lint` command family — plan target | Updated |
| plan-writer agent output contract | Updated |
| write-plan command guidance | Updated |
| run-plan command and coder plan-consumption guidance | Updated |
| Implementation plan template (`doc/templates/implementation-plan-template.md`) | Updated |
| Unified change convention guide (`doc/guides/unified-change-convention-tracker-agnostic-specification.md`) — YAML plan file naming | Updated |
| CLI command registry (`doc/planning/oss-tooling/cli-command-registry.md`) — plan family status | Updated |
| Generated Claude-plugin output (regenerated with prompt sources, committed together) | Regenerated |
| Feature specification under `doc/spec/features/` | New (authored at the documentation-reconciliation phase, or flagged as a gap) |

Changed distributable docs (guides, templates) declare their `ados_distribution` marker in existing frontmatter; `.opencode` prompt changes ship with plugin regeneration in the same commit.

## 17. ACCEPTANCE CRITERIA

**Schema and validation**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F8-1 | **Given** a delivery plan with an invalid schema (for example, a phase missing its declared scope), **when** `plan validate <ref>` runs, **then** the plan is rejected with the classified error `plan.schema.invalid` naming the phase and the missing field, verdict is `invalid` with `readyForDevelopment=false`, and the process exits 1. | F-8, F-2, DM-8, NFR-5 |
| AC-F6-1 | **Given** two plans declaring different ceremony tiers, **when** each is validated, **then** each verdict echoes the plan's own declared tier in per-phase data and no built-in default tier is consulted; and **given** a plan declaring an unknown tier, **when** validated, **then** it is rejected with `plan.tier.unknown`. | F-6, F-8, DM-6 |
| AC-F3-1 | **Given** a schema-valid plan, **when** validated, **then** every delivery phase's done-artifacts (MR URL, pipeline id, deployed environment, tracker transition) are echoed in per-phase verdict data so lane joins can verify artifacts rather than exit codes. | F-3, F-8, DM-3 |
| AC-F7-1 | **Given** a schema-valid plan, **when** validated, **then** planning phases are reported lease-free and delivery phases lease-taking, with leases and build-weight class echoed per phase. | F-7, F-4, DM-4 |

**Overlap (parallelism)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F10-1 | **Given** two plans whose declared scopes both include at least one identical file path, **when** `plan overlap <refA> <refB>` runs, **then** verdict is `run-in-sequence`, every overlapping path is named and appears in both declared scopes, and the process exits 1 with the verdict carried in envelope data (a verdict, not a failure). | F-10, F-2, DEC-1, DEC-5 |
| AC-F10-2 | **Given** two plans whose declared scopes share no paths, **when** `plan overlap` runs, **then** verdict is `parallel`, the overlapping-path list is empty, and the process exits 0. | F-10, F-2 |
| AC-F10-3 | **Given** a run-in-sequence verdict caused by a declared contract-file interaction, **when** the verdict is reported, **then** the ordering places the producer plan before the consumer with the shared-contract reason stated. | F-10, F-5, DM-5 |

**Scope observation**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F9-1 | **Given** a branch whose actual diff touches a path outside the plan's declared scope, **when** `plan diff <ref>` runs, **then** that path is classified `outside-declared`, declared-but-untouched paths are classified `undeclared-missing`, conforming paths `within`, and out-of-scope findings carry `plan.scope.undeclared-paths`. | F-9, F-2, DM-8 |

**Lint and gate**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F11-1 | **Given** a non-conformant plan document, **when** the plan lint target runs for that ref, **then** the document is reported non-conformant with classified errors including location, and the process exits 1; conformant plans exit 0. | F-11, F-8, NFR-3 |
| AC-F12-1 | **Given** a change whose plan does not validate, **when** the ready-for-development gate is consulted via `plan validate`, **then** the gate refuses: `readyForDevelopment=false`, a classified error names the phase and field, and the process exits 1. | F-12, F-8, DEC-6 |

**Migration**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F13-1 | **Given** a change still carrying a legacy markdown plan during the transition, **when** `plan validate` runs, **then** the plan is read and answered with a classified legacy-format verdict — no crash, and never silently accepted as schema-valid. | F-13, DM-8, NFR-6 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

Single change delivered on the standard branch convention; layered delivery inside the change: schema and verdict logic (pure, data-first) → command surfaces → lint integration → writer flip with template and prompt updates (plugin regeneration committed together) → documentation and registry updates. No feature flag: the writer flip is atomic with the consuming-prompt updates, and legacy readability bridges the transition. In-flight changes with markdown plans are unaffected. The documentation-distribution drift guard runs in quality gates for changed guides/templates. Adoption is communicated through the change artifacts and the PR description; no external announcement surface is involved.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

No data migration. The state store and existing change artifacts are untouched; existing changes keep their markdown plans and remain readable (classified transition verdict). New plans are written in the YAML format from the flip onward. The only "seed" content is the conformance fixture corpus covering the seeded scenarios and error classes.

## 20. PRIVACY / COMPLIANCE REVIEW

None. Plans declare repository paths, artifact references, and tier data — no personal data, credentials, or secrets. The commands are read-only with zero credential reads (NFR-3); committed plan artifacts pass through the existing review process, and commit-time privacy scanning remains the emitter's responsibility in the downstream commit primitive (out of scope here).

## 21. SECURITY REVIEW HIGHLIGHTS

- Plans are untrusted input: the validator bounds document size/depth and classifies malformed input rather than failing openly; parse errors surface as classified errors, not stack traces.
- Declared paths, leases, and artifact references are inert comparison and echo data; no verdict path grants filesystem access, executes anything, or drives writes from plan contents.
- Read-only posture across the whole family (NFR-3) means the story adds no write or spawn surface.
- No new credentials, network calls, or external integrations (section 8.4).

## 22. MAINTENANCE & OPERATIONS IMPACT

- Schema evolution is additive and version-gated (DM-1); breaking shape changes require a new schema version, never a silent reinterpretation.
- The conformance fixture corpus is the regression harness for schema, verdict, overlap, diff, and transition behavior; it grows with each classified error class.
- The plan man page, CLI command registry row, and unified change convention guide are kept in sync with the shipped surface.
- The error-code vocabulary (`plan.*`) becomes a stability surface: codes are consumed by downstream scheduling, so renames are breaking.
- Prompt-source and generated-plugin output must stay in sync; CI staleness checking enforces this mechanically.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Machine-readable delivery plan | The versioned YAML change artifact declaring per-phase scope, done-artifacts, leases, weight, interactions, and tier. |
| Declared scope | The files, packages, and folders a phase declares it will modify. |
| Done-artifact | Declared evidence that a phase is complete (MR URL, pipeline id, deployed environment, tracker transition); verified at lane joins, not inferred from exit codes. |
| Repo lease | Exclusive right to deliver to a repository; delivery phases take leases, planning phases are lease-free. |
| Build-weight class | Resource class of a change's build (for example standard versus heavy) used later by scheduling. |
| Declared interaction | A contract-file or generated-code write annotated with producer/consumer semantics. |
| Ceremony tier | The change variant declared as plan data: per-tier phase sets and escalation triggers; no hardcoded eleven. |
| Ready for development | The state in which a change's plan validates and its scope is declared; computed by `plan validate`. |
| Overlap verdict | The pairwise answer `parallel` or `run-in-sequence`, with overlapping paths named and producer-first ordering. |
| Transition verdict | The classified answer given to legacy markdown plans during the migration window. |

## 24. APPENDICES

### A. Design-baseline citations

- Backlog, "M1-S13 Machine-readable delivery plan schema" (`doc/planning/oss-tooling/backlog.md`) — canonical scope and ACs.
- Contracts pack, "`plan validate` / `plan diff` / `plan overlap` (M1-S13, proposed)" (`doc/planning/oss-tooling/milestones/m1/contracts.md`) — inputs, outputs, error codes `plan.schema.invalid`, `plan.scope.undeclared-paths`, `plan.tier.unknown`.
- Plan man page (`doc/planning/oss-tooling/milestones/m1/commands/plan.md`) — synopsis, output data fields, exit-status semantics adopted by DEC-1, envelope examples.
- Lint man page (`doc/planning/oss-tooling/milestones/m1/commands/lint.md`) — plan target joins the shipped lint surface.
- Seeded scenarios SC-M1-06 and SC-M1-07 (`doc/planning/oss-tooling/milestones/m1/test-scenarios.md`) — inherited and reconciled by the test plan (SC-M1-06 exit assertion reconciled per DEC-1; SC-M1-07 queue-add warning recorded as the M1-S17 integration point per DEC-2).
- Interactions pack, Session B (`doc/planning/oss-tooling/milestones/m1/interactions.md`) — validate/overlap example sessions; producer-first ordering with `reason=shared-contract-files`.
- CLI command registry (`doc/planning/oss-tooling/cli-command-registry.md`) — the `plan` family naming surface owned by M1-S13; lint extension for the delivery plan schema is this story's job.
- Operator requirements R4 (P0) and R10 (P1, seam here) (`doc/planning/oss-tooling/operator-requirements-2026-11.md`).

### B. Current-code grounding (verification from planning)

- Layering precedent: type/data contracts in the core contracts layer; pure verdict logic fits the core domain layer (existing lint-rule precedent); CLI command definitions are I/O-free with injected runtimes and no exit-code choice in handlers; YAML parsing has an existing adapters-layer precedent.
- Error contract: shared error table and envelope with `{0,1,2}` exit projection; additive identity precedent exists (verify story).
- Exit taxonomy: the delivered verify story pins handler/edge separation — handlers return data or error; the CLI edge projects exits — the plan family follows the same contract, with DEC-1 fixing the projection class for verdict outcomes.
- `queue ready` (shipped, read-only): six closed tri-state conditions, zero-new-reads guarantee — the basis for DEC-2.

### C. Seeded scenario reconciliation summary

| Seed | Spec position |
|------|---------------|
| SC-M1-06 (overlap names paths; seed asserts exit 0) | Verdict and path-naming adopted (AC-F10-1); exit semantics adopt the man page (exit 1, DEC-1); test plan reconciles the seed assertion. |
| SC-M1-07 (gate refuses unvalidatable plan; seed asserts queue-add warning) | Gate refusal adopted (AC-F12-1, DEC-6); queue-add warning recorded as the M1-S17 integration point; `queue ready` unchanged (DEC-2). |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-05 | spec-writer | Initial specification from planning-session context, ticket GH-226, and the M1 design-baseline pack. |

---

## AUTHORING GUIDELINES

- Sources: ticket GH-226 (milestone M1), the PM planning summary and pinned decisions from clarify_scope, the M1 milestone pack (contracts, man page, test scenarios, interactions, registry), the canonical backlog entry, and verified current-code grounding (state layer GH-174 and pm-notes lint GH-179 delivered).
- The four pinned decisions are encoded verbatim as DEC-3..DEC-6; the two planning-time reconciliations are encoded as DEC-1 and DEC-2 with rationale; the plan file naming is pinned as DEC-7.
- Two refinements beyond the pinned three error codes are flagged explicitly rather than silently introduced: exit semantics adopted from the man page (DEC-1) and the additive `plan.format.legacy-markdown` identity required by the migration path (DM-8). Both are empowered by the milestone-pack rule that contracts are proposals refined at story delivery.
- Tech-neutral throughout: capabilities describe behavior and contracts, not code-level tasks, file paths, or implementation steps; affected components are named at component/document level only.
- The binary name stays behind the branding seam: synopses use `<binary>`; no hardcoded product name appears in this spec.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-226)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-, G-, NG-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (contracts cited, not re-published)
- [x] Front matter validates per front_matter_rules
