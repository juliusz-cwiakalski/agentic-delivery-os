---
ados_distribution: internal
id: SPEC-MEMORY-LINT
status: Current
created: 2026-11-15
last_updated: 2026-11-15
owners: ["engineering"]
service: delivery-os
summary: "The canonical committed agent-memory store and its repository invariant: the completed `.ai/memory/` layout (index, lessons, tacit fragments, preferences, guild trees, retro archive, per-agent entry points), one published typed-record schema with single-sourced bounds, eight lint areas with the closed `memory.<area>.<condition>` finding register, both-direction index coverage over two universes, budget caps, advisory derivable-content heuristics, privacy-vocabulary secret findings, deterministic bounded output, and wiring into the aggregate gate and the CI invariants job."
links:
  related_changes: ["GH-301"]
  decisions: ["ADR-0011"]
  contracts:
    - "packages/core/src/contracts/memory-record.ts"
    - "packages/core/src/domain/memory-lint.ts"
    - "packages/adapters/src/file/memory-scan.ts"
    - "scripts/checks/memory-lint.ts"
    - "packages/core/src/contracts/capsule.ts"
    - "packages/adapters/src/io/privacy-rules.ts"
---

# Feature: Memory Records, Layout, and Lint

> **Role of this Document:** Source of truth for the committed agent-memory store, its canonical record schema, and the memory-lint repository invariant. It describes delivered behavior; the decision of record for the record model is [ADR-0011](../../decisions/ADR-0011-canonical-memory-record-schema.md).

## 1. Overview

Agent memory is a committed filesystem tree at `.ai/memory/`. It holds one bounded index, four durable record areas (lessons, tacit fragments, preferences, and guild trees), a retro archive with its own index, and one free-text entry point per agent folder and per guild folder. A durable record is exactly one file carrying a typed frontmatter record; per-agent memory stays free text.

One repository invariant keeps the tree healthy. `bun run scripts/checks/memory-lint.ts` scans the tree and the `AGENTS.md` memory section, evaluates every record against the published schema, checks dates, provenance, references, index coverage, budgets, derivable content, and secret-shaped content, prints a deterministic bounded report, and exits non-zero only when an error finding exists. It is chained into the aggregate `pnpm check` as `check:memory` and runs in the CI `ts-invariants` job. It adds no CLI command, no doctor area, no error-table identity, and no state or event surface.

## 2. Business Context

### 2.1 Problem Statement

- **Problem:** A committed memory tree without enforcement is convention. A malformed, undated, unprovenanced, dangling, oversized, or derivable record reaches a green build, index coverage cannot be proven in either direction, and a credential pasted into memory is caught at best as a generic repository privacy failure with no memory-scoped verdict. Every downstream consumer then has to re-decide what a record is.
- **Affected Users:** Every agent that writes memory, the `consolidate-memory` curator, closeout promotion, bootstrap template consumers, reviewers and operators auditing the memory store, and the future memory command family and compiler.
- **Business Impact:** Without one schema and one gate, project memory accumulates unstructured prose that later tooling cannot trust. With them, the learning loop produces records that are typed, dated, provenanced, reference-checked, budgeted, and privacy-scanned at the point where a defect is cheapest to catch.

### 2.2 Goals & Success Metrics

- **Primary Goal:** One canonical memory layout, one published record schema, and one repository invariant that proves memory health on every local and CI gate run.
- **KPIs:** Eight of eight lint areas enforced with a named finding identity; zero schema findings on the delivered tree; one schema authority with zero field drift across the index rendering, the promotion writer, and the capsule projection; zero record-file merge conflicts for concurrent creators; memory lint adds at most one second to `pnpm check`; byte-identical output for one tree and one injected date.

## 3. User Experience & Functionality

### 3.1 Capabilities

#### Canonical layout

The committed tree carries exactly these areas:

```text
.ai/memory/
  README.md                 # index: conventions, schema, budgets, lint contract, one row per covered path
  agents/<agent>/README.md   # per-agent entry point; topic files may sit beside it
  lessons/<id>.md            # typed lesson records
  tacit/<id>.md              # typed tacit-fragment records
  preferences/<id>.md        # typed preference records (owner-written)
  guilds/<guild>/README.md   # guild entry point
  guilds/<guild>/<id>.md     # typed guild-scoped records
  retro/INDEX.md             # archive index
  retro/<year>/<note>.md     # dated append-only retro notes
```

`.ai/local/**` is git-ignored ephemeral scratch, not memory; it is outside the tree and outside the lint. An empty area is proved by a `.gitkeep` placeholder, which is never a record, an index target, or a finding. The tree has no fleet import quarantine area (`external/`). A record's home area follows its `kind`: `lesson` → `lessons/`, `tacit_fragment` → `tacit/`, `preference` → `preferences/`; guild records live under `guilds/<guild>/` and carry that folder's name in `guild`.

Per-agent memory is the free-text episodic tier: a charter, its read/write policy, dated capture lines, and optional topic files. It is not converted to record files and produces no record findings; the lint checks its entry-point budget, capture-line date shape, and secret patterns.

The delivered layout is this repository's committed tree, which the invariant scans. The bootstrap scaffold provisions the memory index, the per-agent entry points, `lessons/`, and `tacit/`, and installs no invariant ([Bootstrapper](feature-bootstrapper.md)).

#### Canonical record schema

`packages/core/src/contracts/memory-record.ts` is the schema authority. `.ai/memory/README.md` publishes its human rendering. Reconciliation runs one way — authority → rendering and authority → capsule projection; a divergence is a defect in the rendering or projection, never a second schema. ADR-0011 owns the record-model decision.

Required spine (every record carries all ten keys, in published order): `id`, `kind`, `scope`, `statement`, `evidence`, `source`, `trust`, `created_by`, `created`, `status`.

Closed optional key set: `supersedes`, `superseded_by`, `contradicts`, `applies_when`, `basis`, `revalidate_after`, `invalid_from`, `confidence`, `evaluation`, `guild`. An undeclared key is a finding.

| Element | Contract |
|---|---|
| `kind` | `lesson`, `tacit_fragment`, `preference`. The capsule class token `tacit` projects to `tacit_fragment`. |
| `scope` | `repo`, `component`, `change`. `fleet` is candidate-only and has no record home. |
| `status` | `candidate`, `validated`, `authoritative`, `superseded`, `archived`. Promotion writes `candidate` on creation and `superseded` on a declared supersession. |
| `trust` | `T0`–`T5`, the vocabulary shared with the capsule candidate contract. |
| `source` | `review_verdict`, `ci_verdict`, `human_correction`, `merged_pr`. |
| `evidence` | Exactly one shaped link: `review-verdict:`, `ci-verdict:`, `human-correction:`, `merged-pr:`, or `test:`. Further evidence is cited in the body. |
| `statement` | Non-empty; at most **280 characters**. |
| `created` | `YYYY-MM-DD`; the single validity start; never inferred; never in the future. |
| `id` | `<prefix>-<YYYY>-<NNN>` with prefix `lesson`, `tacit`, or `preference`; monotonic next free per prefix and year; unique across the tree; never reused after supersession or pruning. |
| File name | `<id>.md` or `<id>-<slug>.md`, lowercase kebab-case, so a file name always begins with its id. |
| `applies_when` | Optional scalar predicate. A single-element sequence is read as its scalar; a multi-clause list is rejected. It feeds the index row's read-when hint. |
| `confidence` | Optional number. |
| `evaluation` | Optional mapping; its presence marks a behaviour-changing lesson. |

Conditional requirements:

- `basis` is one of the five capture-bar bases (`repeat-occurrence`, `review-catch`, `human-correction`, `verified-outcome`, `repeated-workflow`). It is required on every promotion-written record and optional on a hand-authored one.
- `revalidate_after` is `YYYY-MM-DD`. It is required for an authoritative behaviour-changing lesson (a lesson carrying `evaluation`) and optional otherwise. A malformed value is an error; an expired window is an advisory.
- `guild` is required exactly under `guilds/<guild>/` and equals that folder's name; it is forbidden outside a guild folder.
- `superseded_by` is required when `status` is `superseded`.
- A `preference` record's `source` is `human_correction`.
- `rationale` is not a frontmatter key; the body carries it. `evidence` is not a list.

#### Promotion write path

Closeout promotion renders the full required spine plus the conditional requirements it triggers: `trust`, `basis`, a `kind` mapped from the capsule class (`tacit` → `tacit_fragment`), the home area derived from the kind, and an index row whose second column is a read-when hint. The hint is the collapsed `applies_when` when it fits the bound, or the collapsed statement when there is no applicability and the statement fits. When the chosen source exceeds the bound the writer renders a deterministic read-when phrase derived from the candidate's class and scope; it never truncates a statement into the hint. A candidate whose `source` is outside the four channels is refused at candidate-schema time, as is a candidate whose `statement` exceeds the published bound. A `lesson` or `tacit` candidate carrying `scope: fleet` is refused at candidate-schema time through the existing `closeout.capsule-invalid` identity, before any record file or index row is written. The promotion read scope stays `lessons/` and `tacit/`. See [Change Capsule](feature-capsule.md) and [Closeout Transaction](feature-closeout.md).

#### Index rows and coverage

The memory index has a two-column table under its `## Index` heading: the covered path in backticks, then a non-empty read-when hint of at most **120 characters** that answers when to read the path. Row parsing starts at that heading and stops at the next second-level heading, so the index's other tables are never read as coverage rows; the archive index has the same two-column shape and is read as a whole file. Coverage is evaluated independently over two universes, and each finding names its universe:

- **Memory index (U-1)** covers every record file in the four record areas, every per-agent entry point, every guild entry point, and `retro/INDEX.md`.
- **Archive index (U-2)** covers every dated retro note under `retro/<year>/`.

A retro note is covered by the archive index only. Topic files are represented by their entry point. `.gitkeep`, the memory index itself, and area directories are not covered paths; there are no directory rows.

#### Lint surface

| Surface | Contract |
|---|---|
| Check | `scripts/checks/memory-lint.ts`; `bun run scripts/checks/memory-lint.ts` |
| Package script | `pnpm check:memory` → `bun run scripts/checks/memory-lint.ts` |
| Aggregate gate | `pnpm check` chains `pnpm check:memory` after `pnpm check:boundaries` |
| CI | the `ts-invariants` job runs `bun run scripts/checks/memory-lint.ts` |

The scanner (`packages/adapters/src/file/memory-scan.ts`) enumerates `.ai/memory/**` plus the repository `AGENTS.md`, performs one read per file, parses YAML frontmatter, and writes nothing. The check edge reads the ambient date exactly once and injects it. The pure evaluator (`packages/core/src/domain/memory-lint.ts`) receives the scanned files, the injected date, and the privacy vocabulary, and performs no I/O, clock access, randomness, or network access.

#### Finding areas and identities

Findings use the closed lowercase dotted identity `memory.<area>.<condition>`, reported in this area order: `schema`, `dating`, `provenance`, `reference`, `index`, `budget`, `derivable`, `secret`.

| Area | Findings | Severity |
|---|---|---|
| `schema` | `frontmatter-missing`, `frontmatter-malformed`, `keys-missing`, `key-unknown`, `id-malformed`, `id-duplicate`, `file-name-mismatch`, `value-unknown`, `statement-too-long`, `preference-source`, `guild-mismatch`, `superseded-by-missing` | error |
| `dating` | `created-malformed`, `created-future`, `revalidate-missing`, `revalidate-malformed`, `revalidate-expired`, `entry-line-date` | error, except `revalidate-expired` (warn) |
| `provenance` | `evidence-missing`, `evidence-shape-unknown`, `created-by-missing` | error |
| `reference` | `supersedes-dangling`, `superseded-by-dangling`, `supersede-asymmetry`, `contradicts-dangling`, `link-dangling` | error |
| `index` | `record-uncovered`, `row-unbacked`, `row-duplicate`, `row-malformed`, `hint-missing` | error |
| `budget` | `index-lines`, `index-bytes`, `agent-entry-lines`, `guild-entry-lines`, `archive-index-lines`, `kernel-lines` | error, except the kernel advisory band (warn) |
| `derivable` | `file-listing`, `command-echo` | warn |
| `secret` | `memory.secret.<recognizer-class>` for each injected privacy recognizer class | error |

Presence partitions by key and the partition is exhaustive and disjoint. The schema area owns `source`: an absent `source` is `memory.schema.keys-missing`, and an out-of-channel `source` is `memory.schema.value-unknown`. The provenance area owns `evidence` and `created_by`. One defect yields one finding.

#### Dating

`created` is the single validity start. An absent `created` is classified by the schema area as a missing required key, never also as a dating finding. When `created` is present, a non-`YYYY-MM-DD` value is `memory.dating.created-malformed`, and a value after the injected date is `memory.dating.created-future`. The date is never inferred. A malformed `revalidate_after` is an error; an expired window is an advisory. A per-agent capture line is a bullet whose leading token is calendar-shaped (for example `YYYY-MM-DD`, `YYYY/MM/DD`, or a date-time); its date must be exactly `YYYY-MM-DD` or it is `memory.dating.entry-line-date`. A bullet whose leading token is not date-like (`- GH-301: ...`, `- T0-T5: ...`) is not a capture line and produces no finding.

#### References

A `supersedes`, `superseded_by`, or `contradicts` value must name an existing record id. A supersession must be symmetric across the pair: the superseded record names its replacement in `superseded_by`, and the replacement names the old record in `supersedes`. An in-tree relative Markdown link in a record body must resolve to a scanned file. A link that resolves outside `.ai/memory/` (for example `../../../AGENTS.md`) or an absolute repository path (for example `/doc/spec/...`) is a citation outside the memory tree and produces no finding; only an in-tree relative link that resolves to no scanned path is dangling.

#### Budgets

| Surface | Cap |
|---|---|
| Record statement | 280 characters |
| Index read-when hint | 120 characters |
| Memory index | 200 lines and 25 KB |
| Per-agent entry point | 150 lines |
| Guild entry point | 150 lines |
| Archive index | 200 lines |
| `AGENTS.md` `## Agent memory` section | 200 lines advisory, 220 lines error |

Each numeric bound is declared once in the contract module; the lint and its fixtures import that value rather than restating it. A surface exactly at its cap produces no finding.

#### Derivable content

Two deterministic heuristics over record bodies produce advisories only:

- **File listing:** a fenced block of at least two lines where every line is a repository path under `packages/`, `scripts/`, `tests/`, `tools/`, `doc/`, `.opencode/`, `.ai/`, or `.github/`.
- **Command echo:** a fenced block containing a line equal to a declared workspace command, or beginning with one followed by a space (`pnpm check`, `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`, `bun test`).

#### Secret patterns

Every scanned file is evaluated with the delivered privacy-rule definition set and its suppression classes. The lint declares no pattern of its own. A finding names the file, the line, and the recognizer class — never the matched value. Suppression markers are evaluated only against the value segment a rule protects, exactly as the whole-tree privacy guard does, so a marker in the key half (for example `fake_token: <value>`) does not silence a real value while a marker inside the value does. A match whose protected value carries a declared suppression marker (documentation placeholder, redaction marker, or fabricated sample) is not a finding. The possible secret rule suffixes are the privacy vocabulary's recognizer classes exactly.

#### Output and exit

Findings print as one line each:

```text
FAIL memory-lint: <rule-id> <path>[:<line>] <detail>
WARN memory-lint: <rule-id> <path>[:<line>] <detail>
```

The summary line always follows:

```text
memory-lint: records=<n> areas=8 errors=<n> advisories=<n>
```

At most 100 error lines and 100 advisory lines print. When either true count exceeds its ceiling, one truncation line follows with the true totals and the printed counts. Ordering is area order, then path, then line, then rule id, so a truncated run is deterministic. The exit is `1` when at least one error finding exists and `0` otherwise; advisories never change the exit.

### 3.2 User Flows

**Agent captures at event time.** An agent reads its own entry point, appends one dated capture line in its own folder, and changes nothing else. The lint checks the entry point's budget, capture-line dates, and secret patterns. Record creation is a new-file write in the creator's namespace; the shared index row is append-maintained and resolves by the documented union rule after a merge.

**Closeout promotes a candidate.** The promotion writer renders the canonical record and a read-when hint row. The lint proves the record is covered, dated, provenanced, within budget, and free of secrets.

**Quality gate runs the invariant.** `pnpm check` invokes `check:memory`, which scans, evaluates, prints FAIL and WARN lines plus the summary, and exits on any error. The owning writer fixes the record, row, or capped surface.

**Curator consolidation runs.** `consolidate-memory` merges duplicates, marks supersession, prunes with a recorded reason, splits an over-cap folder into topic files, appends one pointer row, and rebuilds the index. The same lint re-proves coverage and caps afterward.

### 3.3 Edge Cases & Error Handling

- A missing or malformed frontmatter block is a schema error, not a silent skip.
- An absent `created` is one schema missing-key finding; a present malformed or future date is a dating finding. No date is inferred.
- An absent `source` is a schema missing-key finding; an out-of-channel `source` is a schema value finding. `evidence` and `created_by` are provenance findings.
- A supersession that names an unknown id, or is not symmetric across the pair, is a reference error.
- A row with no covered path and a covered path with no row are independent findings, each naming its universe.
- A record or retro note that is not represented by its index is `memory.index.record-uncovered`; a row that resolves to no covered path is `memory.index.row-unbacked`.
- A conforming record, row, or surface produces no finding; the check passes on an empty record area and on a growing one.
- A secret match never echoes the matched value.
- The check performs no writes, so a gate run cannot mutate the tree or state.

### 3.4 UI States & References

No UI. The command-line report is the entire surface: `FAIL` lines, `WARN` lines, the summary line, and the optional truncation line.

## 4. Technical Architecture & Codebase Map

### 4.1 High-Level Design

The contract tier declares the schema, closed vocabularies, bounds, finding register, and evaluation types as types and `as const` data. The domain tier holds the pure evaluation. The adapter/file tier scans the tree and parses frontmatter. The check edge reads the clock once, calls the scanner and evaluator, prints the result, and projects the exit. The aggregate gate and the CI invariants job cite the same invocation.

### 4.2 Core Components & Directory Structure

| Path | Responsibility |
|---|---|
| `packages/core/src/contracts/memory-record.ts` | The schema authority: required and optional key sets, kind/scope/status/trust/source/basis/evidence vocabularies, id and file-name grammars, statement and hint bounds, budget and output constants, the finding area order and closed register, and the evaluation input/result types. Data only. |
| `packages/core/src/domain/memory-lint.ts` | The pure evaluator: schema, dating, provenance, references, both-direction coverage, budgets, derivable heuristics, secret matching, deterministic ordering, bounded output, summary, and exit projection. |
| `packages/adapters/src/file/memory-scan.ts` | The tree scanner: repository-relative enumeration of `.ai/memory/**` plus `AGENTS.md`, one read per file, YAML frontmatter parse, and an injectable filesystem seam. |
| `scripts/checks/memory-lint.ts` | The check edge: injects the privacy vocabulary, performs the single ambient date read, prints the deterministic lines, and exits. |
| `package.json` | Declares `check:memory` and chains it into `check`. |
| `.github/workflows/ci.yml` | Runs the identical invocation in the `ts-invariants` job. |
| `.ai/memory/README.md` | The human rendering of the schema, layout, budgets, index rows, capsule reconciliation, and lint contract. |

### 4.3 Key Classes & Functions

```ts
scanMemoryTree(root, fs?): MemoryScanResult
evaluateMemory({ files, today, privacy }): MemoryEvaluationResult
runMemoryLint({ root?, readToday?, files? }): MemoryEvaluationResult
```

`MemoryEvaluationResult` carries the sorted findings, the summary counts, the exit code, and the printed lines. `MemoryScannedFile` carries the repository-relative path, text, byte count, and parsed frontmatter state.

### 4.4 Data Architecture

The tree is committed Markdown. Record frontmatter is YAML 1.2 parsed by the scanner. The index is a Markdown table; the archive index is a Markdown table. The lint derives no durable artifact and writes nothing. The finding register, budgets, bounds, grammars, and vocabularies are constants in the contract module. The two coverage universes are path sets derived from the scan; no generated index exists.

### 4.5 API & Interface Contracts

- **`bun run scripts/checks/memory-lint.ts`** — the invariant invocation; exit `0` or `1`.
- **`runMemoryLint(options)`** — the injectable entry the check and tests consume.
- **`evaluateMemory(input)`** — the pure evaluation over the scanned files, one injected date, and the privacy vocabulary.
- **`scanMemoryTree(root, fs?)`** — the read-only scanner with an injectable filesystem seam.
- No HTTP endpoint, event, state record, CLI command, doctor area, or error-table identity is added.

## 5. Non-Functional Requirements

### 5.1 Security & Privacy

- Secret findings reuse the delivered privacy vocabulary and suppression classes; the lint defines no pattern and never echoes a matched value. Only path, line, and recognizer class are reported.
- The check is read-only: no writes, no state append, no network, no randomness, and one date read at the edge.
- The memory tree is advisory, untrusted data; it never overrides instructions, repo rules, or current code and spec truth.
- The invariant is a repository check of this repository. Bootstrap installs the manual doctor checklist, not the invariant; a bootstrapped project's gates do not run it.

### 5.2 Performance & Scalability

The scan is one read per file and linear in file count. The check runs within the aggregate gate in at most about one second on this repository's tree and is bounded at 2,000 files or 8 MB of memory content on the CI runner. Validation is linear over the bounded tree.

### 5.3 Localization & Accessibility

No localization or accessibility surface is added. Findings are deterministic ASCII-shaped lines.

## 6. Quality Assurance Strategy

### 6.1 Testing Approach

| Level | Location | Scope |
|---|---|---|
| Structure | `tests/structure/memory-layout.test.ts`, `memory-record-schema.test.ts`, `memory-lint-wiring.test.ts`, `memory-lint-docs.test.ts`, `tests/checks/milestone-gate.test.ts` | Layout, schema parity and whole-tree legality, gate/CI parity, documentation conformance, and the aggregate-chain pin. |
| Checks | `tests/checks/memory-lint-{schema,dating,provenance,reference,index,budget,derivable,secret,output,performance}.test.ts` | One fixture family per area, boundary values, deterministic output, truncation, and scan cost. |
| Behaviour | `tests/behaviour/memory-promotion-schema.test.ts`, `memory-concurrency-merge.test.ts` | Promotion rendering, schema-valid promotion, concurrent record creation, and union resolution of index rows. |
| Boundary | `tests/boundaries/**`, `pnpm check:boundaries` | Contracts/domain purity and package edges. |

### 6.2 Test Data & Scenarios

Fixtures build synthetic memory trees under a temporary directory, one defect per case, at and around each published bound. Secret positives are assembled at runtime from non-matching fragments so the repository privacy guard and the commit safety scan do not flag the fixture source. Schema fixtures import the contract's constants instead of restating a bound. The concurrency exercise creates two temporary branches with disjoint record files and proves both records are covered after merge; the shared index-row conflict is resolved by the documented union step.

## 7. Operational & Support

### 7.1 Configuration

No configuration key is added. The check consumes the repository root, the scanned tree, the injected date, and the delivered privacy vocabulary. The bounds and vocabularies are compiled contract data.

### 7.2 Observability

The report is the observability surface: one line per finding, a summary line with record, area, error, and advisory counts, and a truncation line when a print ceiling is exceeded. The check appends nothing to the state ledger, a capsule, or telemetry.

### 7.3 Cost & Infrastructure

The invariant runs only as a build-time check. It adds no daemon, scheduled job, dependency, network call, or storage. Its cost is the scan of the committed memory tree.

## 8. Dependencies & Risks

- **Depends on** the canonical record schema decision ([ADR-0011](../../decisions/ADR-0011-canonical-memory-record-schema.md)) for the required spine, closed optional set, dispositions, grammars, conditional requirements, and the 280/120 bounds.
- **Depends on** the change-capsule candidate contract and promotion writer ([Change Capsule](feature-capsule.md)) for the projection, the `fleet` refusal, and the write path the lint validates.
- **Depends on** the privacy vocabulary ([Privacy and No-Cloud Guards](feature-privacy-guard.md)) for secret detection and suppression; the lint adds no second pattern table.
- **Depends on** the repository-invariant convention and the aggregate gate ([Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md)) for the check shape, the CI job, and local/CI parity.
- **Risk — gate noise:** derivable content is advisory only, secret detection reuses a tuned suppression-aware vocabulary, and the delivered tree must be zero-finding before the gate is enabled.
- **Risk — schema drift:** one machine authority and one published rendering, with the promotion writer and capsule projection reconciled to it; drift is a rendering or projection defect, never a second schema.
- **Risk — index conflict:** record files never conflict, but two end-of-table appends to the shared index do; the row is deliberately outside the zero-conflict claim and resolves by the documented union rule, after which coverage is proved.

## 9. Glossary & References

| Term | Definition |
|---|---|
| Memory record | One committed file carrying the canonical ten-key frontmatter record. |
| Memory index | `.ai/memory/README.md`: conventions, schema, budgets, lint contract, and one row per covered path. |
| Archive index | `.ai/memory/retro/INDEX.md`: one row per dated retro note. |
| Coverage universe | The path set an index must cover exactly: U-1 the memory index, U-2 the archive index. |
| Read-when hint | The index row's second column: when to read the path, bounded at 120 characters. |
| Finding register | The closed `memory.<area>.<condition>` identity set the check may emit. |
| Advisory | A `warn` finding that is reported and never changes the exit. |
| Memory invariant | The repository check `bun run scripts/checks/memory-lint.ts`. |

See also: [Change Capsule](feature-capsule.md), [Closeout Transaction](feature-closeout.md), [Privacy and No-Cloud Guards](feature-privacy-guard.md), [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md), [Doctor](feature-doctor.md), [`.ai/memory/README.md`](../../../.ai/memory/README.md), and [ADR-0011](../../decisions/ADR-0011-canonical-memory-record-schema.md).

**Change record:** `doc/changes/2026-11/2026-11-15--GH-301--memory-records-layout-lint/`.
