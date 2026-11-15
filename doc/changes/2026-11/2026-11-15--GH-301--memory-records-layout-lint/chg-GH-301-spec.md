---
change:
  ref: GH-301
  type: feat
  status: Proposed
  slug: memory-records-layout-lint
  title: "M2-S8: Memory records, layout, and lint (M2)"
  owners: [Juliusz Ćwiąkalski]
  service: delivery-os
  milestone: "M2: Ceremonies, measurement, and memory"
  labels: [milestone-m2, memory, quality-gates, repository-invariants, schema]
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "GH-302 (M2-S9 memory conventions in bootstrap templates — delivered: the index, per-agent entry points, lessons, tacit, the manual doctor checklist, and the negative guard this change replaces)"
      - "GH-240 (M1-S12 change capsule and closeout promotion — delivered: candidate schema, five evidence-link shapes, trust vocabulary, confined lessons/tacit home writes, index-row append)"
      - "Privacy-literal vocabulary (the one committed credential- and private-literal definition set consumed by the repository file guard and the envelope content policy)"
      - "Delivered repository-invariant convention (bun-run checks with an exported pure entry and mutation tests in tests/checks)"
      - "Delivered aggregate gate and the CI TS-invariants job"
    external: []
  links:
    related_changes: ["GH-302", "GH-240"]
    decisions: ["ADR-0011"]
    decisions_note: "ADR-0011 (One Canonical Agent-Memory Record Schema) is the system-level decision of record for the record model: the required spine, the closed optional set, the concept-key dispositions, the file-name and validity rules, the conditional requirements, the one-way reconciliation direction, and the 280/120 published bounds. It is Proposed at this revision and is owner-ratified or vetoed at the GH-301 open-PR gate (R2; AI does not accept it). This specification consumes that record and does not re-decide it."
---

# CHANGE SPECIFICATION

> **PURPOSE**: Turn the committed memory tree into one canonical, budgeted, reference-checked store — complete its layout, publish a single typed record schema that human and machine authorities share, and enforce memory health (schema, dating, provenance, dangling references, index coverage, budget caps, derivable-content heuristics, secret patterns) as a repository invariant in the quality gates.

## 1. SUMMARY

The agent-memory learning loop is wired end to end and its tree exists, but the tree is convention without enforcement. Its record format is prose in one README; three promoted records carry a field set that no code reads; the promotion writer renders a *different* subset; the capsule contract carries a third; and nothing verifies any of it. Index coverage, budgets (~200-line index, ~150-line entry points), dating, provenance, dangling references, and derivable content are all documented manual checks — so a malformed record or an unbacked index row lands in a green build, and a credential in a record is caught at best as a generic repository privacy failure with no memory-scoped verdict. Every later memory consumer must re-decide what a record is.

This change delivers M2-S8: the committed tree is completed to the canonical layout (index, lessons, tacit fragments, preferences, per-agent entry points, guild trees, retro archive); one typed record per file carrying id, kind, scope, provenance, trust, validity, and status under a single published schema that the human README, the promotion writer, and the capsule contract all reconcile to; and a memory lint invariant that fails the quality gates on every named area, with derivable-content heuristics reported as non-gating advisories and secret detection reusing the existing privacy vocabulary rather than a second pattern table. Concurrent agents keep creating record files that merge without conflict because each creator writes only new paths in its own namespace; the shared index stays a bounded, append-maintained surface whose row conflicts resolve by the documented union rule and whose coverage the lint proves in both directions.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The tree exists and is populated but incomplete.** The committed tree holds the index (172 lines, at or under the declared 200-line cap), four per-agent entry points (12–39 lines each, under the declared ~150-line cap), three promoted lesson records, and an empty `tacit/` area. `preferences/`, `guilds/`, and a retro archive area do not exist. The index indexes agent folders and the three records with a read-when hint per row.
- **The record format is documentary only.** The index README publishes a frontmatter format (id, kind, scope, statement, evidence, source, created_by, created, status, supersedes, optional applies_when) under YAML 1.2 core semantics, and states the id-allocation, supersede-never-rewrite, curator-operation, promotion-routing, and conflict-reality rules. Nothing validates a record against it. The three delivered records carry no `trust`, and their `evidence` values are free text rather than one of the five declared evidence-link shapes.
- **The reader tolerates everything.** The memory facts reader behind closeout promotion parses frontmatter with a regular expression, silently skips a malformed record, reads only `lessons/` and `tacit/`, and validates no schema. A record it cannot parse simply disappears from the dedup population.
- **The writer renders a third variation.** Closeout promotion renders candidate content with kind, scope, statement, evidence, source, created_by, created, status, supersedes, and optional applies_when — no `trust` — and appends an index row whose second column is the statement truncated to 120 characters, not a read-when hint.
- **The capsule contract carries its own subset.** The capsule candidate model carries id, class, scope, statement, evidence, basis, source, trust, status, created_by, created, supersedes, contradicts, applies_when, hint with closed class/scope/status/trust/basis vocabularies and five evidence-link prefixes; its memory-record read projection is `{id, class, statement, status, path}`. The T0–T5 trust vocabulary exists in two places — the capsule contract and the architecture concept's own trust-level table — and the five evidence-link prefixes are declared only in the capsule contract.
- **No memory invariant exists.** There is no check, no gate entry, no lint, no index-coverage proof, no dangling-reference check, no budget enforcement, and no derivable-content or dating analysis over the memory tree. The whole-tree privacy guard *does* scan the tree: it enumerates every tracked and untracked-not-ignored file (`git ls-files --cached --others --exclude-standard`), so all ten `.ai/memory/**` files already sit inside its scan set. What the tree lacks is a memory-shaped verdict: that guard's findings are generic, whole-repository privacy-literal failures shared with every other file, with no memory rule id, no record identity, no area, and no place in a memory summary. The scope classes (package tree, root manifests, root workspace files, ignore rules, registered user-facing docs under `doc/`) belong to the separate forbidden-literals guard and are not the privacy guard's scan set.
- **The doctor is a five-check command.** The read-only doctor runs exactly five checks (repo, tracker, provider, state, ci) and its contract requires a spec amendment for a sixth area; the production composition does not register it. The manual doctor checklist shipped by GH-302 is documentation that performs nothing and states it stays manual until memory lint lands.
- **A deliberate negative guard protects the current absence.** A structure test asserts that no memory-doctor or memory-lint component exists anywhere in `scripts/`, `tools/`, or `packages/`, that no package script names one, and that the doctor command carries no memory scope. Its own comment names this change as the owner of its sanctioned replacement.
- **Planning truth for this story.** The backlog M2-S8 task line names exactly this tree and exactly these lint areas; the milestone pack records that M2-S8 owns no architecture flow and no contract surface, only the scenario seeds; the memory-architecture concept puts lint-in-gates at increment step 2 (conventions are step 1, delivered by GH-302) and the command family at step 4; the autonomy concept assigns this story the guild tree in the layout conventions and assigns visibility tags, loader enforcement, and the compiler to M3.

### 2.2 Pain Points / Gaps

- **GAP-1 — No single record schema.** Four renderings of "a memory record" exist (documented README format, promotion writer output, capsule candidate model, capsule read projection). Every consumer re-decides which fields are required, and a field added in one place is silently absent in the others.
- **GAP-2 — The tree is incomplete.** Preferences, guild trees, and the retro archive have no home, so preference-class and guild-class knowledge has nowhere to go and retro notes have no archive inside the memory tree.
- **GAP-3 — No schema validation.** A record missing its id, statement, kind, scope, trust, or status is accepted by every reader; the promotion reader silently drops what it cannot parse.
- **GAP-4 — No dating or provenance enforcement.** A record with no creation date is accepted as a complete record, a present date that is malformed or in the future goes unnoticed, and an empty evidence link, an evidence value outside the declared shapes, or a missing writer lands unchallenged; revalidation windows are neither required nor checked.
- **GAP-5 — No reference integrity.** A `supersedes` or `superseded_by` naming a nonexistent id, an asymmetric supersession, or an in-tree relative link to a deleted file is invisible.
- **GAP-6 — No index coverage in either direction.** An index row with no backing file and a record with no index row both pass. The index is also the one shared surface whose write shape differs between agent rows and promotion rows.
- **GAP-7 — Budgets are unenforced guidance.** The ~200-line index, its 25 KB bound, the ~150-line per-agent entry point, and the ~200-line kernel section are prose. Growth past a cap is discovered by a human reading the file.
- **GAP-8 — Derivable content accumulates unchecked.** Nothing detects a record whose body is a repository listing or a restated command definition — content the repository answers in one command and that the write gate forbids.
- **GAP-9 — Memory privacy findings have no memory-scoped identity.** The whole-tree privacy guard already scans `.ai/memory/**` like every other tracked file, so a credential pasted into a record, an entry point, or a retro note is caught — as a generic repository privacy failure. Nothing renders that hit as memory: no `memory.secret.<recognizer-class>` identity, no record or row context, no area ordering, no memory summary, and no uniform contract shared with the other memory findings. The tree's privacy verdict therefore cannot be reviewed, counted, or acted on per record.
- **GAP-10 — Concurrent creation safety is a claim, not a proof.** The one-file-per-record rule and the append-only index row are convention; no check proves that two concurrent creators touch disjoint files or that both records end up covered.

## 3. PROBLEM STATEMENT

Because the committed memory tree has an incomplete layout, four competing renderings of a record, and no enforcement of any kind, project memory is not one canonical store: malformed, undated, unprovenanced, dangling, oversized, or derivable memory reaches a green build unchallenged, credential-bearing memory is caught at best as an untyped repository privacy failure rather than a memory finding, index coverage is unknowable in either direction, and every downstream memory consumer (closeout promotion, the curator skill, bootstrap templates, and the future command family and compiler) has to re-decide what a record is — so the learning loop accumulates unstructured prose that later tooling cannot trust, and the repository cannot claim its memory is budgeted or reference-checked.

## 4. GOALS

- **G-1 — One layout.** The committed tree carries exactly the areas the backlog names — index, lessons, tacit fragments, preferences, per-agent entry points, guild trees, retro archive — with no invented area.
- **G-2 — One record schema.** Exactly one canonical typed-record schema is published, with an explicit reconciliation direction across the documented README format, the promotion writer, and the capsule contract, so no fifth variation can appear.
- **G-3 — One enforcement point.** Memory health is enforced by a single repository invariant in the local aggregate gate and the CI invariants job, reporting named findings, never adding a CLI command, an error-table identity, or a doctor area.
- **G-4 — Both-directions index coverage and real caps.** Index coverage is proven in both directions and every declared budget is mechanically enforced, so the index and the entry points stay bounded as the tree grows.
- **G-5 — Conflict-free creation.** Record creation by concurrent agents remains a new-file operation with zero merge conflicts, and the shared index stays a bounded, append-maintained surface whose post-merge coverage the gate proves.
- **G-6 — No new secret vocabulary.** Memory secret detection consumes the delivered privacy-rule definition set, so the memory gate and the whole-tree privacy gate cannot drift apart.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Lint areas enforced with a named finding identity | 8 of 8 named areas (schema, dating, provenance, dangling references, index coverage, budget caps, derivable content, secret patterns) |
| Signed-off acceptance quality | Zero false-positive findings on the delivered tree at the delivered HEAD |
| Record-schema authorities | Exactly one published schema, with the documented README, the promotion writer, and the capsule contract reconciled to it and zero residual field drift |
| Schema-drift surface | Zero required fields present in the schema and absent from a rendered record (measured over the whole tree) |
| Concurrent creation | Zero merge conflicts when two distinct agents create records on parallel branches; both records covered by the index after merge |
| Gate cost | Memory lint adds ≤1 s to `pnpm check` on this repository's tree |
| Determinism | Byte-identical finding output on repeated runs over an unchanged tree at a fixed injected date |
| Distribution and conformance | `pnpm check` green including boundary, prompt/help conformance, and doc-distribution guards |

### 4.2 Non-Goals

- **NG-1**: No `ados memory` command family — no `lint`, `candidates`, `promote`, `supersede`, `conflicts`, `stale`, `doctor`, or `compile` subcommand (M3-S8).
- **NG-2**: No memory compiler and no role-filtered projection of memory into harness surfaces (M3-S9).
- **NG-3**: No visibility-class enforcement at a loader; guild trees are a layout area with a schema tag, not a read gate.
- **NG-4**: No sixth `doctor` area — the doctor keeps its five checks and stays a wiring diagnostic; memory health is a repository invariant, not a doctor check.
- **NG-5**: No fleet import quarantine area (`external/`) — it is absent from the M2-S8 task line and belongs to the fleet layer.
- **NG-6**: No change to the promotion routing authority: closeout keeps rejecting the preference and fleet classes, and preference records stay owner-written in this change.
- **NG-7**: No retrofit of previously bootstrapped projects and no extension of the installed delivery-script set with the memory invariant; the manual doctor checklist remains a bootstrapped project's audit path.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Committed memory tree completed to the canonical layout | An area that has no home cannot be captured, indexed, or checked |
| F-2 | One canonical typed-record schema published with an explicit reconciliation direction | Without a single authority the record model drifts per consumer |
| F-3 | Write-path alignment: promotion writer, curator rules, and index rows conform to the schema | A schema the writers do not render is decoration; promoted records must pass the gate |
| F-4 | Memory lint as one repository invariant in the quality gates | The gate is where a defect is cheapest to catch and the only place a claim becomes a proof |
| F-5 | Schema findings | A record that is not a record must not be silently skipped |
| F-6 | Dating findings | Validity starts nowhere and revalidation never expires unless dates are checked |
| F-7 | Provenance findings | Trust that cannot be traced to an evidence link is not provenance |
| F-8 | Reference integrity findings | A supersession chain and an in-tree link must resolve or be flagged |
| F-9 | Index coverage in both directions | The index claims what exists; both claims must be provable |
| F-10 | Budget caps enforcement | Bounded retrieval surfaces are the point of the caps |
| F-11 | Derivable-content heuristics as advisory findings | Forbidden content that the repository already answers is judgment-shaped, so it advises rather than gates |
| F-12 | Secret-pattern detection over the memory tree using the delivered privacy vocabulary | A memory-scoped, uniformly rendered privacy verdict is what lets a record's privacy result be reviewed per record instead of surfacing as a generic repository hit |
| F-13 | Concurrency-safe record creation with both-directions coverage after merge | Parallel agents must never contend for one memory file |
| F-14 | Sanctioned replacement of the GH-302 negative guard with boundary preservation | The guard that protected the absence must become the guard that protects the boundary |

### 5.1 Capability Details

- **F-1 — Layout.** The tree carries the index at its root, four durable record areas (lessons, tacit fragments, preferences, guild trees) and the retro archive, plus one entry point per agent folder and one per guild folder. Every area exists even when empty; `.gitkeep` proves an empty area's existence and is not a record, an index target, or a lint finding. The fleet import quarantine area is deliberately absent. Per-agent memory keeps its delivered free-text tier (charter, read/write policy, dated capture lines, optional topic files) and gains no record files of its own; the typed schema applies to the four durable record kinds, one record per file.
- **F-2 — One schema.** The schema is published twice from one definition: as the human contract in the memory index (the record format a reader copies) and as a machine contract module of types and closed vocabularies that the lint and the promotion writer both consume. It fixes the required key set, the optional key set, the closed vocabularies (kind, scope, status, trust, source, capture basis, evidence-link shape), the id grammar and allocation rule, the file-name shape, the one validity-start date, and the two published numeric bounds. The authority, the required spine, the closed optional set, the concept-key dispositions, and the reconciliation direction are ADR-0011's decision of record this change consumes. The reconciliation direction is explicit and one-way: the backlog's seven conceptual fields are the schema's required spine; the concept document's model reconciles key by key under ADR-0011 D3's disposition table — accepted as declared, accepted with a narrowed shape or a renamed vocabulary, or rejected by design with the intent's retained home named — so a record copied from the concept validates instead of producing unknown-key, unknown-value, and unknown-shape findings; the delivered README format is upgraded to the schema; the capsule contract keeps its candidate model and extends only where the schema demands (see §8.3 and DEC-5). No fourth rendering is permitted; the capsule read projection stays a projection, not a schema.
- **F-3 — Write-path alignment.** The promotion writer renders every required schema key — adding the trust level and the capture basis that promotion requires — and renders the index row's second column as the record's read-when hint derived from its applicability statement, with the statement as fallback, so every row reads as a read-when. The curator skill's written rules name the same schema, budgets, id allocation, and status transitions, so a consolidation pass cannot author a record its own gate rejects.
- **F-4 — Enforcement surface.** One repository invariant, exposed as a bun-run check with an exported pure evaluation entry and a thin executable edge, wired into the aggregate local gate and the CI invariants job with the same invocation. It reports findings only — no writes, no network, no state append, and no hidden input: the thin edge performs exactly one date read and injects it into the evaluation, which is the only clock contact in the whole check and the only input besides the tree, the injected privacy vocabulary, and the published constants. Its verdict is one exit code: non-zero when at least one error finding exists, zero otherwise. Advisories never change the exit. No CLI command, flag, error-table identity, or doctor area is added.
- **F-5 — Schema.** Malformed or absent frontmatter, a missing required key, an undeclared key, a malformed id, a duplicate or reused id, a file name that disagrees with its id, a non-empty value outside a closed vocabulary, an over-long statement, a preference record whose source is not an explicit human correction, a guild tag that disagrees with the guild directory (or appears outside one), and a superseded record without its replacement link are classified individually.
- **F-6 — Dating.** The creation date is the validity start and a required key, so an *absent* `created` is reported once as a missing required key by the schema area (`memory.schema.keys-missing`) and never also as a dating finding. The dating area owns the present value: a `created` that is not `YYYY-MM-DD` is malformed, and a `created` later than the run's single injected date is in the future; both are dating findings naming the record and the value's name, and the date is never inferred from a file name, a commit, or anything else. A behaviour-changing lesson carries a revalidation date when it is authoritative; a malformed revalidation date is a finding, and an expired revalidation date is an advisory rather than a gate failure, because expiry is a demotion signal owned by the curator, not a build break. Dated capture lines inside a per-agent entry point are checked for the same date shape.
- **F-7 — Provenance.** Evidence must be present and must be one of the five declared evidence-link shapes; the writer must be named; the source must be one of the four declared channels. A record whose provenance cannot be traced to a link is not promotable memory.
- **F-8 — Reference integrity.** A `supersedes` id that names no record, a `superseded_by` id that names no record, a supersession that is not symmetric across the pair, a `contradicts` id that names no record, and an in-tree relative link that resolves to no file are each classified with the offending reference in the detail.
- **F-9 — Index coverage.** Two directions over two declared universes, each evaluated independently: the *memory index* over its covered paths (every record file, every agent entry point, every guild entry point, and the archive index), and the *archive index* over the retro notes it represents. In each universe every covered path has exactly one row and every row resolves to a covered path, with the universe named in the finding detail so the two evaluations never blur. A row whose second column is empty, or longer than the declared hint bound, is malformed. Topic files and retro notes have no memory-index row — their entry point or their archive index represents them — and no directory row is allowed for a record area.
- **F-10 — Budgets.** The index is bounded by lines and bytes, each per-agent entry point by lines, the kernel memory section by lines under a small published tolerance, and each archive index by lines. A budget finding names the file, the measured value, and the cap.
- **F-11 — Derivable content.** Two narrow, deterministic heuristics over record bodies: a fenced block that is a repository file listing, and a fenced block that restates a declared workspace command. Both are advisories by design (DEC-6): they are judgment-shaped and must never fail a build, so precision is bought by keeping the heuristic set small and closed rather than by widening it.
- **F-12 — Secrets.** Every record, entry point, archive note, and convention file in the tree is evaluated with the delivered privacy-rule definition set and the delivered suppression classes, so a documentation placeholder is not a finding, and the memory gate's pattern surface is the whole-tree guard's pattern surface rather than a second table. A finding names the file, the line, and the recognizer class — never the matched value — under a memory-scoped rule id, so the same hit the whole-tree guard reports generically is rendered here as one record's privacy verdict with a memory area, a memory rule id, and a place in the ordered memory summary. The lint defines no pattern of its own.
- **F-13 — Concurrency.** A creator writes only new record files in its own namespace and never edits a record path another writer owns, so two distinct agents on parallel branches merge their record files with zero conflicts. The boundary sits exactly there because the index is *not* namespace-partitioned: a promotion write appends its own row to the end of the single two-column index table, and two branches appending different rows at end-of-file of one table do conflict — a two-branch append reproduces that conflict empirically — so the shared index row is deliberately outside the zero-conflict claim and resolves by the documented union rule instead. Same-role parallel worktrees stay merge-conflict capable, which the tree does not claim away. After the union resolution the lint's coverage evaluation proves that both records are indexed and no row is orphaned or duplicated.
- **F-14 — Guard replacement.** The GH-302 negative guard is replaced, not deleted, and its protective intent is *narrowed by declaration* rather than claimed wholesale. The replacement asserts the invariant exists and is cited by both gate surfaces; it retains one narrowed negative assertion — a file-name scan over `scripts/`, `tools/`, and `packages/` in which every match is one of the sanctioned memory modules (the invariant's check, the pure evaluator, and the schema contract module) — so a stray `memory-doctor` component or a second memory health surface anywhere in those trees still fails the suite; and it keeps the absences it protected: no memory subcommand on the CLI, no memory member in the doctor's five-check set, and no new error-table identity. What it no longer asserts is the blanket absence of any memory-named file, because the delivered invariant would contradict it.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Agent captures operational memory at event time (any agent)
   Agent reads its own entry point at session start -> capture bar decides
   durability -> the agent appends one dated, evidence-linked line in its
   own folder (no shared write) -> nothing else changes; the lint checks
   the entry point's cap, its date shapes, and its secret patterns.

Flow 2: Change closeout promotes a candidate into durable memory
   capsule candidates/ validated -> capture bar, evidence, dedup,
   contradiction, routing -> home write: one new record file carrying the
   canonical schema (trust and basis included) + one index row reading as a
   read-when hint -> the memory lint proves the record is covered, dated,
   provenanced, within budget, and free of secrets.

Flow 3: Quality gate runs the memory invariant (local and CI)
   pnpm check -> check:memory -> pure evaluation over the scanned tree ->
   FAIL lines per error finding, WARN lines per advisory, deterministic
   order -> exit 1 on any error -> the owning writer fixes the record, the
   row, or the cap; a verdict is never argued with a waiver.

Flow 4: Curator consolidation pass
   consolidate-memory merges duplicates, marks supersession, prunes with a
   recorded reason, splits an over-cap folder into topic files, appends one
   pointer row, rebuilds the index -> the same lint re-proves coverage in
   both directions and the caps after the pass.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Completion of the committed memory tree to the canonical layout: four durable record areas (lessons, tacit fragments, preferences, guild trees), the retro archive area with its archive index, per-agent entry points retained as the free-text episodic tier, and one entry point per guild folder.
- The canonical typed-record schema published as the human record format in the memory index and as a machine contract consumed by the lint and the promotion writer, including the reconciliation direction (§8.3).
- Promotion-writer alignment: every required schema key rendered, and the index row's second column rendered as a read-when hint.
- Curator-rule alignment so consolidation writes satisfy the schema, the id rule, and the caps.
- One memory-lint repository invariant with a pure evaluation entry and a thin executable edge, covering the eight named areas with the closed finding-identity register of §24 Appendix A.
- Wiring into the aggregate local gate and the CI invariants job, with a parity test asserting both surfaces cite the same invocation.
- Migration of the three delivered records and the four delivered entry points to the canonical schema and budgets, without changing any statement, status, or meaning.
- Sanctioned replacement of the GH-302 negative guard at its declared location: the positive presence assertion, one narrowed file-name sanction scan, and the preserved boundary absences (no memory subcommand, five doctor checks, unchanged error-table identities).
- Documentation reconciliation inside this change where the memory tree's own contract lives: the memory index (schema, layout, budgets, lint), the kernel memory section (one gate/lint clause and a schema pointer), the manual doctor checklist template (its manual-until-tooling wording becomes an automation-boundary statement), and the curator skill.
- Registration of any new user-facing doc under `doc/**` in the forbidden-literal registry where the registry requires it, and the distribution marker on any new doc under a marker-required root.
- Backlog M2-S8 progress marker per milestone delivery conventions.

### 7.2 Out of Scope

- [OUT] Any `ados memory` subcommand and any CLI grammar change (M3-S8).
- [OUT] The memory compiler and role-filtered projections (M3-S9).
- [OUT] Visibility-class enforcement at a loader or at retrieval; guild tags are recorded, not enforced.
- [OUT] A sixth doctor area or any change to the doctor's five-check contract.
- [OUT] The fleet import quarantine area (`external/`) and any fleet-layer routing.
- [OUT] Changing closeout's promotion routing: the preference and fleet classes keep their delivered rejections, and preference records stay owner-written.
- [OUT] Shipping the memory invariant into the installed delivery-script set for bootstrapped projects (OQ-1).
- [OUT] Any generator for the archive index or for the memory index (increment step 3).
- [OUT] A model-assisted or similarity-based derivable-content judgment; the heuristics stay deterministic string and structure rules.
- [OUT] Any change to the change-capsule event contract, candidate file naming, or the terminal close.

### 7.3 Deferred / Maybe-Later

- Archive-index and memory-index generation, which retires the append-maintained row rule and the union-resolution step (increment step 3).
- The validated lifecycle state and the evaluation ladder as *required* keys once the progressive-evaluation work lands; they stay optional and type-checked here.
- Distributing the memory invariant to bootstrapped projects via the installed script set, which would let the manual doctor checklist retire (OQ-1).
- Preference promotion authority under autonomous delivery, which turns the delivered preference rejection into a governed home write.
- Guild seeding at bootstrap, so a new project starts with a guild tree shape rather than an empty area.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface is added or changed.

### 8.2 Events / Messages

N/A — no event or message surface is added or changed. Capsule events, the state ledger, and the telemetry stream are untouched: the lint appends nothing anywhere.

### 8.3 Data Model Impact

**DM-1 — Canonical typed-record schema (one authority, two renderings).** The schema is ADR-0011's decision of record; this table consumes it and re-decides nothing. Its required spine, closed optional set, closed vocabularies, grammars, conditional requirements, and numeric bounds are declared in ADR-0011 D1–D6 and are stated here so a reader of this change needs no second hop.

| Aspect | Contract |
|---|---|
| Required keys | `id`, `kind`, `scope`, `statement`, `evidence`, `source`, `trust`, `created_by`, `created`, `status` — the backlog's seven conceptual fields resolve as id; kind; scope; provenance = source + created_by + evidence; trust; validity = created (+ optional revalidation date); status (ADR-0011 D2) |
| Optional keys (closed set) | `supersedes`, `superseded_by`, `contradicts`, `applies_when`, `basis`, `revalidate_after`, `invalid_from`, `confidence`, `evaluation`, `guild` — an undeclared key is a finding, so every accepted key is named here (ADR-0011 D3) |
| `kind` | `lesson`, `tacit_fragment`, `preference` (the capsule class token `tacit` is the reader's projection name for `tacit_fragment`) |
| `scope` | `repo`, `component`, `change` — the candidate vocabulary additionally offers `fleet`, which is deliberately the value with no implemented home and is refused on a promotable record |
| `status` | `candidate`, `validated`, `authoritative`, `superseded`, `archived` — the full concept lifecycle; the promotion writer emits only `candidate` on creation and `superseded` on a declared supersession, exactly as today, so the capsule contract needs no widening |
| `trust` | `T0`–`T5`, the vocabulary already published by the capsule contract and by the architecture concept's trust-level table |
| `source` | `review_verdict`, `ci_verdict`, `human_correction`, `merged_pr` |
| `statement` | The claim; non-empty; at most **280 characters** — the bound is a published, single-sourced contract constant (ADR-0011 D6) |
| `basis` | One of the five capture-bar bases. Required on every promotion-written record, because promotion already refuses an empty basis; optional on a hand-authored record and omitted when absent (ADR-0011 D5) |
| `evidence` | Non-empty; exactly one of the five declared evidence-link shapes (review verdict, CI verdict, human correction, merged pull request, test); further evidence is cited in the record body |
| `created` | `YYYY-MM-DD`; the single validity start; never in the future; never inferred |
| `revalidate_after` | `YYYY-MM-DD`; required for an authoritative behaviour-changing lesson, optional otherwise |
| `guild` | Required exactly when the record lives under a guild folder, and equal to that folder's name; forbidden outside one |
| `confidence` / `evaluation` | Accepted and type-checked, never required — the concept's optional depth survives as declared optional keys |
| `id` | `lesson-<YYYY>-<NNN>` or `tacit-<YYYY>-<NNN>` or `preference-<YYYY>-<NNN>`; monotonic next free per prefix and year; unique across the whole tree; never reused after supersession or pruning |
| File name | `<id>.md` or `<id>-<slug>.md`, slug lowercase kebab-case, so a file name always begins with its record id; the home area is a function of `kind`, never of a class token pluralized at run time (ADR-0011 D4) |
| Conditional requirements | `basis` required on a promotion-written record and optional on a hand-authored one; `revalidate_after` required for an authoritative behaviour-changing lesson; `guild` required exactly under a guild folder and forbidden outside one; `superseded_by` required when `status` is `superseded`; a `preference` record's `source` is `human_correction` — declared in the contract and checked by the lint, so a hand-authored record cannot be stricter or looser than a promoted one (ADR-0011 D5) |
| Concept-key dispositions | ADR-0011 D3 owns the table and is the reference; in summary, `valid_from` is **renamed** to `created` (one validity start, never two); the concept's `source: {type, ref}` mapping is **shape-narrowed** to the scalar channel, with its `ref` half carried by the `evidence` link; the concept's evidence **list** is **rejected as a shape by design**, because exactly one shaped link keeps provenance single-valued and classifiable, and additional evidence lives in the body; `rationale` is **rejected as a frontmatter key by design** and lives in the body the record already owns; `trust: agent_verified` is **renamed** to a `T0`–`T5` token; `scope: fleet` is **rejected for records by design** and stays candidate-only. The concept is upstream design input, not an authority, and a record copied from it validates |
| Precedence rule | The machine contract module is the schema authority (ADR-0011 D1); the index's published format is its human rendering; the lint enforces it; the promotion writer and the curator render it. Any divergence is a defect in the rendering or the projection, never a second schema. This change consumes that authority and does not re-decide it |

**DM-2 — Canonical tree layout.**

| Area | Contents | Indexed | Budget |
|---|---|---|---|
| Kernel | The AGENTS.md memory section (facts, routing, invariants) | No | Memory section ≤200 lines, advisory above that and failing above the published tolerance |
| Index | The memory tree's root README: conventions, schema, id rule, routing, and one row per covered path | It is the index | ≤200 lines and ≤25 KB |
| Per-agent entry points | `agents/<agent>/README.md`: charter, read/write policy, dated capture lines; optional topic files beside it | The entry point (topic files and capture lines are not rows) | Entry point ≤150 lines |
| Lessons | Typed lesson records, one per file | Each record | — |
| Tacit fragments | Typed tacit-fragment records, one per file | Each record | — |
| Preferences | Typed preference records, one per file, owner-written | Each record | — |
| Guild trees | `guilds/<guild>/README.md` plus typed guild-scoped records, one per file, tagged with the guild | The guild entry point and each record | Guild entry point ≤150 lines |
| Retro archive | `retro/INDEX.md` plus dated append-only retro notes under a year folder | The archive index (notes are represented by it) | Archive index ≤200 lines |
| Ephemeral | `.ai/local/**` — never committed, outside the tree and outside the lint | No | — |

An empty area is proved by `.gitkeep`, which is never a record, an index target, or a finding. The fleet import quarantine area is absent by decision.

**DM-3 — Index row and coverage contract.**

| Element | Contract |
|---|---|
| Row shape | One row per covered path: the path in backticks, then the read-when hint, in the index's two-column table |
| Hint | Non-empty, **≤120 characters** — a published constant, not a derived truncation (ADR-0011 D6); it answers "when do I read this"; the promotion writer derives it from the record's applicability statement and falls back to the statement |
| Coverage universe U-1 — memory index (must have exactly one row) | Every record file in the four record areas; every per-agent entry point; every guild entry point; the archive index |
| Coverage universe U-2 — archive index (must have exactly one row) | Every dated retro note under the archive's year folders. A retro note is a covered path of the archive index *only*: it carries no memory-index row, because the archive index represents it there |
| Two universes, two evaluations | `memory.index.record-uncovered` and `memory.index.row-unbacked` are evaluated once per universe, over the universe's own path set and its own row set, and each finding names the universe in its detail. The same rule ids therefore express both "a record has no memory-index row" and "a retro note has no archive-index row" without a second identity and without contradicting the archive's non-coverage by the memory index |
| Explicitly not covered | Topic files (represented by their entry point), `.gitkeep`, the memory index itself, and area directories (no directory rows). Retro notes are not covered by the memory index but are covered by the archive index under U-2 |
| Both directions | Within each universe, a covered path with no row and a row with no covered path are separate findings with the path and the universe in the detail |

**DM-4 — Finding model and identity convention.**

| Element | Contract |
|---|---|
| Identity shape | `memory.<area>.<condition>`, lowercase dotted, matching the repository's existing dotted identity style; the closed register is §24 Appendix A |
| Area set and order | `schema`, `dating`, `provenance`, `reference`, `index`, `budget`, `derivable`, `secret` — the reported order |
| Finding fields | Rule id, repository-relative path, line when the finding is line-scoped, area, severity, and a bounded detail naming the field, the offending value's *name* (never a secret value), or the measured-versus-cap numbers |
| Severity | `error` fails the check; `warn` is reported and never changes the exit. Every area is `error` except the derivable-content heuristics and an expired revalidation window |
| Emission | One line per finding under the check's own namespace prefix, in the repository's existing check style, with a human-readable one-line summary carrying the record count, area count, and finding counts |
| Exit | Non-zero when at least one `error` finding exists; zero otherwise; the check has no third exit |
| Ceiling | At most 100 error findings and 100 advisories are printed per run, followed by one explicit truncation line carrying the true totals; ordering is area order, then path, then line, then rule id, so a truncated run is still deterministic |

**DM-5 — Budget and bound declaration (single source).**

| Surface | Cap | Severity |
|---|---|---|
| Record statement length | 280 characters | error (`memory.schema.statement-too-long`) |
| Index read-when hint length | 120 characters | error (`memory.index.row-malformed`; an empty hint is `memory.index.hint-missing`) |
| Memory index lines | 200 | error |
| Memory index bytes | 25 KB | error |
| Per-agent entry point lines | 150 | error |
| Guild entry point lines | 150 | error |
| Archive index lines | 200 | error |
| Kernel memory section lines | 200 advisory, 220 error (the published realization of the "~200" guidance) | warn / error |

Both numeric record bounds are ADR-0011 D6's decision: 280 characters for the statement (sized from the longest delivered statement at 245, which the migration may not rewrite) and 120 characters for the read-when hint. Each is declared once as a constant in the schema contract module and published in the human rendering; the lint and the boundary fixtures import that one value instead of restating the number, so a published bound, the enforced bound, and the tested bound cannot disagree.

**DM-6 — Reconciliation against the capsule contract.**

| Capsule element | Reconciliation |
|---|---|
| Candidate required key set | Unchanged in key names and vocabularies; `source` is tightened from free text to the schema's four-value closed set, validated at candidate-schema time so the existing capsule-invalid identity carries the refusal (DEC-8) |
| Candidate trust vocabulary | Unchanged — it is the schema's `trust` vocabulary |
| Candidate evidence shapes | Unchanged — they are the schema's `evidence` shapes |
| Memory-record read projection | Stays a projection (`id`, class, statement, status, path); its status vocabulary is the schema's subset; it is not a second schema and gains no field |
| Promotion write content | Extended additively to render the schema's required spine plus the conditional requirements promotion triggers — the trust level, the capture basis, and the read-when hint; record id allocation, supersession marking, confinement, and index-row dedup are unchanged |
| Promotion read scope | Unchanged — `lessons/` and `tacit/` only; preferences and guild records are not dedup inputs and are not promotion targets in this change |
| Capsule events, candidate file naming, terminal close | Unchanged |

### 8.4 External Integrations

N/A — no vendor or API integration is added or changed. The lint performs no network access.

### 8.5 Backward Compatibility

- **Existing records**: the three delivered records keep their ids, statements, and status; they gain the schema's required trust level, a shaped evidence link, and nothing else. A schema backfill is not a semantic rewrite and does not weaken supersede-never-rewrite (DEC-12).
- **Existing readers**: the promotion reader's tolerance for malformed records is unchanged in this change, but the population it can see now conforms, so its silent-skip behaviour no longer hides defects in practice.
- **Existing tree consumers**: the curator skill and the manual doctor checklist are reconciled in the same change, so no consumer is left describing the pre-schema format.
- **Bootstrapped projects**: unaffected — the invariant is a repository-invariant check of this repository, not an installed script (NG-7); the manual checklist remains their audit path and is worded as an automation boundary rather than a ticket-gated placeholder.
- **The aggregate gate becomes stricter**: a tree that violates the schema, the coverage, a cap, or a secret pattern now fails. The migration in §19 lands before the gate is enabled for the tree, so the change is not landed red.
- **CLI and doctor surfaces**: byte-identical. No command, flag, error identity, doctor check, or exit projection changes.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism and read-only evaluation, measured against a fixed date input: for one tree and one injected date the finding output — order and truncation included — is byte-identical on every run. The thin edge performs exactly one date read and injects it; the pure evaluation reads no clock, no randomness, and no network, and performs no writes. The injected date is the only input that may change output between two runs over an unchanged tree | Zero byte variance across repeated runs at a fixed injected date; exactly one injected date read per run; zero writes, randomness, or network |
| NFR-2 | Scan cost on a growing tree | ≤1 s wall for ≤2,000 files or ≤8 MB of memory content on the CI runner; one read per file, linear in file count |
| NFR-3 | Gate overhead | ≤1 s added to the aggregate local gate on this repository's tree, measured and recorded in the change evidence |
| NFR-4 | Tier and purity: the evaluation is pure — it receives the file list, the file text, the privacy vocabulary, the published constants, and the single injected date, and it performs no I/O, no clock access, and no filesystem access; it lives in the domain tier, contracts hold data and types only, file reading belongs to the adapter/edge tier, and the check imports packages across the delivered dev edge as existing checks do | Boundary and purity checks green; no runtime API in contracts or domain |
| NFR-5 | Bounded output | ≤100 error findings and ≤100 advisories printed per run, with one truncation line carrying the true totals and the deterministic order preserved under truncation |
| NFR-6 | Local/CI parity | The aggregate local gate and the CI invariants job invoke the identical check with identical verdicts on the same tree; a parity test asserts both surfaces cite it |
| NFR-7 | Documentation conformance | Every new user-facing doc under `doc/**` is registered in the forbidden-literal registry where the registry requires it; every new doc under a distribution-marker root carries `ados_distribution`; the distribution guard passes with zero drift |
| NFR-8 | Authoring-time gate | The aggregate gate is green on a clean checkout with a repository-local temporary directory before the pull request opens; commit subjects are conventional |
| NFR-9 | Secret hygiene of findings | A finding never echoes a matched secret or private value — only the path, the line, and the recognizer class |
| NFR-10 | No new surface: no CLI command, flag, error-table row, domain kind, state record, event, or doctor check is added by this change | Error-table row count, domain-kind membership, command inventory, and doctor check count identical to the pre-change values |
| NFR-11 | Verdict stability under growth | Findings assert meaning, not population size: the check passes on an empty record area and on a growing one, with no assertion that the record count equals a fixed number |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — no telemetry ships. The memory lint is a build-time invariant: its observations are its finding lines on the check's own stream plus the change evidence recorded in the plan phases. It appends nothing to the state ledger, the capsule, or the telemetry stream, and it must not, because a gate that writes state could not be replayed deterministically (NFR-1). Memory-health counts (records, areas, coverage, budget headroom) are reported in the check's summary line, which is the whole observability surface this story needs; retrieval-quality metrics such as miss rate and stale influence remain future work that depends on the telemetry and retrieval layers.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Record-schema drift: the schema becomes a fifth variation because a writer or the capsule keeps its own field set | H | M | One machine authority, two renderings, explicit reconciliation table (§8.3), and an acceptance criterion that a promoted record passes the gate with zero findings; DM-6 names which capsule element changes and which does not | Low |
| RSK-2 | Gate noise: false positives make the invariant something people disable | H | M | Derivable heuristics are advisory only (DEC-6); secret detection reuses a tuned, suppression-aware vocabulary; the heuristic set is closed at two rules; the verdict must be zero-finding on the delivered tree before the PR opens | Medium |
| RSK-3 | Landed red: existing records or entry points fail the new gate on the first run | M | H | §19 migrates the three records and re-measures every capped file in-change, and the tree is green at the delivered HEAD before the invariant is enabled in the aggregate gate | Low |
| RSK-4 | Boundary erosion: the invariant drifts into the deferred M3 surfaces | M | L | F-14 replaces the negative guard with a positive presence assertion, one narrowed file-name sanction scan over `scripts/`, `tools/`, and `packages/`, and the preserved boundary absences (no memory subcommand, no doctor member, no error identity), and NFR-10 pins the inventories | Low |
| RSK-5 | Index conflict: two promotion writes append rows to the same shared file | M | M | Record files never conflict; the row is append-only with an exact-row dedup and the documented union resolution, and the spec does not claim the row is conflict-free because two end-of-table appends do conflict; the lint proves both records covered and no duplicate row after resolution (AC-F13-2) | Medium |
| RSK-6 | Budget churn: a hard cap forces constant splitting | L | M | Caps match the published guidance, the kernel's "~200" is realized with a published tolerance and a warn band, and the split remedy (topic files plus one pointer row) is the documented growth path | Low |
| RSK-7 | Capsule tightening breaks a live promotion path: `source` free text becomes a closed set | M | L | The tightening is additive validation on an already-required key, refuses through the existing capsule-invalid identity, and the authoring convention already names the four channels; a record-level fallback is not invented | Low |
| RSK-8 | Performance regression on a large tree or in a shallow CI checkout | L | L | NFR-2 bounds the scan linearly with one read per file; the check never shells out and never reads git history | Low |
| RSK-9 | Documentation drift: the manual checklist template, the curator skill, or the kernel section keeps describing the pre-schema format | M | M | All three are reconciled in this change and named in the affected-components table; the guard replacement reads the template so stale wording fails a test | Low |
| RSK-10 | Advisory blindness: warnings are read as pass | L | M | The summary line always carries the advisory count, closing with a non-zero total when advisories exist, so silence is impossible | Low |

## 12. ASSUMPTIONS

- The AGENTS.md memory section remains the kernel authority for the learning loop; this change adds one gate/schema clause to it and rewrites no routing rule.
- The memory index README is the single human authority for the record format, and it can carry the schema, the layout, and the budgets within its own 200-line and 25 KB caps.
- The delivered privacy-rule definition set is stable and sufficient; this change consumes it and adds no pattern.
- The five evidence-link shapes and the T0–T5 trust vocabulary delivered with the capsule contract are the right vocabularies for durable records, not a capsule-only accident.
- The promotion writer is the only automated creator of durable records in this change; the curator skill is the only cross-folder writer; per-agent capture stays free-text.
- The three delivered records' evidence can be expressed in the declared evidence shapes without changing what they claim.
- No package in a bootstrapped project runs this invariant, so its strictness affects this repository only.
- Story M2-S7 (suite-to-job parity) does not gate this change; the local/CI parity assertion here is delivered by this change's own tests.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-302 (M2-S9) | Delivered — supplies the tree scaffold, the index contract, the entry-point template, the manual doctor checklist, and the negative guard replaced here |
| Depends on | GH-240 (M1-S12) | Delivered — supplies the candidate model, evidence shapes, trust vocabulary, confined home writes, and the index-row append this change aligns |
| Depends on | Privacy-literal definition set | The one credential/private-literal vocabulary; consumed, never duplicated |
| Depends on | ADR-0011 (canonical memory record schema) | The system-level decision of record for this change's record model — authority and one-way direction, required spine, closed optional set, concept-key dispositions, file-name and validity rules, conditional requirements, and the 280/120 bounds. Proposed at this revision; owner-ratified or vetoed at the open-PR gate. Consumed here, never re-decided |
| Depends on | Repository-invariant convention | The bun-run check shape, its exported pure entry, the mutation tests, and the aggregate gate plus CI job wiring |
| Blocks | Future memory consumers | Promotion, curation, bootstrap templates, the M3-S8 command family, and the M3-S9 compiler all consume the schema published here |
| Related (not blocking) | M2-S3 ceremony runner, M2-S10 retro action registry | Future producers of retro notes into the archive area delivered here |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the memory invariant ship to bootstrapped projects through the installed delivery-script set, retiring the manual doctor checklist there? | The installed set carries shell delivery scripts, not TypeScript invariants; distributing it would need a bun-run distribution path and an install-set contract. Decision needed: consult `@decision-advisor` | Open — deferred; the checklist remains the bootstrapped-project path (NG-7) |
| OQ-2 | When do `confidence` and `evaluation` become required for behaviour-changing records? | They are accepted and type-checked now; requiring them depends on the progressive-evaluation ladder and its replay evidence, which no story has delivered | Open — deferred to the evaluation work |
| OQ-3 | Do guild trees get seeded at bootstrap, and how many guilds does a fresh project need? | The autonomy concept names guilds (quality, delivery, docs, architecture) as examples, not a fixed set; GH-302 deliberately provisioned no extra areas | Open — deferred; the area exists and guild folders are project-chosen |
| OQ-4 | Does an expired revalidation window ever become gating? | It is an advisory now, because expiry is a curator demotion signal rather than a build break; making it gating would create time-triggered red builds | Open — deferred; revisit with the lifecycle-state work |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Deliver M2-S8 exactly as the backlog task line states: the committed typed-record memory tree plus memory lint in the quality gates. Non-goals: the `ados memory` command family, the memory compiler and role-filtered projections, visibility enforcement at the loader, and a sixth doctor area | Backlog story dependency graph; the architecture concept's increment plan puts lint-in-gates at step 2 and the command family at step 4 (binding PM decision, from pm-notes) | 2026-11-15 |
| DEC-2 | Layout: complete the tree GH-302 deferred — preferences, guild trees, and the retro archive join the delivered index, per-agent entry points, lessons, and tacit. One typed record per file and append-only index rows stay the merge rule. No `external/` fleet quarantine area | GH-302 named preferences and retro as this story's scope; the M2-S8 task line names them plus guild trees; `external/` is absent from that line and belongs to the fleet layer (binding PM decision, from pm-notes) | 2026-11-15 |
| DEC-3 | Enforcement surface: one repository invariant (`scripts/checks/memory-lint.ts` over pure domain evaluation in `packages/core/src/domain/`), wired into `pnpm check` and the CI TS-invariants job, mirroring the delivered checks convention. CLI `lint`/`verify`/`doctor` grammars unchanged | The backlog says memory lint in the quality gates; a CLI target would encroach on M3-S8 (binding PM decision, from pm-notes) | 2026-11-15 |
| DEC-4 | Secret detection reuses the privacy-rule vocabulary and its suppression classes; the lint defines no pattern of its own and adds no second table | The memory gate and the whole-tree privacy gate must not drift apart (binding PM decision, from pm-notes) | 2026-11-15 |
| DEC-5 | One canonical record schema, owned by ADR-0011 as the system-level decision of record and consumed here: the backlog's seven conceptual fields are the required spine; the README format upgrades to it; the concept document's model is reconciled key by key through ADR-0011 D3's disposition table — accepted as declared, accepted with a narrowed shape or renamed vocabulary, or rejected by design with the intent's home named — rather than accepted wholesale as an open superset; the capsule keeps its candidate model and changes only `source` (DEC-8). `created` is the single validity start; the `fleet` scope stays candidate-only because it has no implemented home; status keeps the five lifecycle states while writers emit only `candidate` and `superseded`; `basis` is required on a promotion-written record and optional on a hand-authored one | Four renderings exist today and none is authoritative; ADR-0011 fixes the authority so no consumer becomes a second schema, and a per-key disposition is what lets the concept stay a usable design input without competing with the contract | 2026-11-15 |
| DEC-6 | Severity policy: schema, dating, provenance, reference, index, budget, and secret findings are `error`; derivable-content heuristics and an expired revalidation window are `warn`. Advisories never change the exit | The gating areas are mechanical and cheap to satisfy; the heuristic areas are judgment-shaped, and a gate that fails on judgment gets disabled (RSK-2) | 2026-11-15 |
| DEC-7 | The index row's second column is the read-when hint, not a duplicated statement; the promotion writer derives it from the record's applicability statement with the statement as fallback, bounded at the published 120-character hint limit and never produced by truncating the statement (ADR-0011 D6) | Today two row shapes coexist (agent rows carry a hint, promotion rows carry a truncated statement), so "coverage" could not also mean "the row tells you when to read it" | 2026-11-15 |
| DEC-8 | The capsule candidate `source` is tightened from free text to the schema's four-value channel set, refused through the existing capsule-invalid identity at candidate-schema time | Otherwise the writer can render a record the schema rejects, which would make the gate fail on a legitimate promotion path | 2026-11-15 |
| DEC-9 | Kernel budget realized as advisory above 200 lines and failing above 220; index, archive index, and entry-point caps enforced exactly at their published values | The published kernel guidance is "~200", so a knife-edge cap would fail on a wrapped line; the tolerances are published rather than implicit | 2026-11-15 |
| DEC-10 | The retro archive holds dated append-only notes (episodes, not typed records) plus an archive index that is append-maintained by the note's writer and proved by the lint; the memory index carries one row for the archive index. Index *generation* stays deferred | A generated index needs a generator, which is increment step 3; coverage proof in both directions is what makes the archive trustworthy now | 2026-11-15 |
| DEC-11 | Per-agent memory stays the free-text episodic tier (charter, dated capture lines, optional topic files) and is not converted to record files; the typed schema covers the four durable record kinds | The architecture concept keeps per-agent memory free-text with lighter headers, and converting it would rewrite four populated entry points for no coverage gain (DEC-2's one-record-per-file rule applies to durable records) | 2026-11-15 |
| DEC-12 | The GH-302 negative guard is replaced by a positive assertion that the invariant exists and is cited by both gate surfaces, one narrowed negative assertion — a file-name scan over `scripts/`, `tools/`, and `packages/` whose only permitted matches are the sanctioned memory module set (the invariant's check, the pure evaluator, the schema contract module) — and the preserved boundary absences (no memory subcommand, five doctor checks, unchanged error-table rows and domain kinds). Migrating a record to the schema is a schema backfill, not a semantic rewrite | The guard's own comment assigns this change its sanctioned replacement, and leaving it would make a living test contradict the delivered tree; the protective intent is narrowed by declaration — the blanket "no memory-named component may exist" assertion cannot survive, but a stray second memory health surface must still fail, so one sanction scan is retained rather than dropping the negative side entirely | 2026-11-15 |
| DEC-13 | The memory lint is not distributed to bootstrapped projects in this change; the manual doctor checklist is reworded as an automation boundary instead of being deleted | Deleting it would leave a bootstrapped project with no audit path at all, and distributing an invariant needs an install-set contract (OQ-1) | 2026-11-15 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Canonical record-schema contract | New — types and `as const` closed vocabularies: required and optional key sets, kind/scope/status/trust/source/basis/evidence vocabularies, id and file-name grammars, the single-sourced 280- and 120-character bounds and budget constants, and the finding-identity register. Data only; the schema authority ADR-0011 declares |
| Memory-lint evaluation (domain tier) | New — one pure evaluation over an injected file list and text map: frontmatter validation, dating, provenance, reference resolution, index coverage, budgets, derivable heuristics, secret matching through the injected privacy vocabulary, finding ordering, and the output ceiling |
| Memory-lint invariant check (repository check edge) | New — the bun-run entry that enumerates the memory tree, parses YAML at the edge, calls the pure evaluation, prints findings and the summary, and projects the exit; carries the check's own namespace prefix |
| Memory tree scanner (adapter file tier) | New — repository-relative enumeration of the tree, text reads, YAML-frontmatter parse, and the covered-path set; no writes |
| Promotion writer | Extended — renders the required spine plus the promotion-triggered conditionals and the read-when hint; id allocation, supersession marking, confinement, and row dedup unchanged |
| Capsule candidate contract | Tightened additively — `source` validated against the four-value channel set through the existing capsule-invalid identity; no other candidate field, event, or projection changes |
| Aggregate gate and CI invariants job | Extended — one new check invocation on both surfaces, asserted equal by a parity test |
| Negative memory-tooling guard (structure suite) | **Replaced** — positive presence assertion, one narrowed file-name sanction scan over `scripts/`, `tools/`, and `packages/`, and the preserved boundary absences (no memory subcommand, five doctor checks, unchanged error-table rows and domain kinds) |
| Memory tree (this repository's `.ai/memory/**`) | Completed and migrated — preferences, guilds, and retro areas created; three records backfilled to the schema; index rewritten to the canonical schema, layout, budgets, and lint contract within its caps; entry points unchanged in content beyond budget and date-shape compliance |
| AGENTS.md memory section | Extended by one clause — the memory invariant as a gate, and the record-schema pointer; no routing rule rewritten; section stays inside its budget |
| Curator skill (`consolidate-memory`) | Reconciled — its written rules name the schema, id allocation, status transitions, budgets, and the read-when row shape |
| Manual doctor checklist template | Reconciled — the "manual until memory lint lands" wording becomes an automation-boundary statement for projects whose gates do not run the invariant |
| Backlog M2-S8 entry | Updated — Ticket and Progress markers per milestone delivery conventions |
| Current-truth feature specs | Reconciled in phase 7 — a new memory-lint feature spec; capsule, closeout, bootstrapper, document-templates, and doctor specs updated where they describe the pre-lint state |

## 17. ACCEPTANCE CRITERIA

**Layout completion (ticket task line)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the delivered repository, **when** the committed memory tree is listed, **then** it carries the index at its root, the four durable record areas (lessons, tacit fragments, preferences, guild trees), the retro archive with its archive index, and one entry point for every agent folder and guild folder; every empty area is proved by a placeholder file, and no area outside this set exists — in particular no fleet import quarantine area | F-1, DM-2, NG-5 |
| AC-F1-2 | **Given** the completed tree, **when** the placeholder and directory rules are applied, **then** a placeholder file is neither a record, an index target, nor a finding; a record area has no directory row in the index; and topic files and retro notes are represented by their entry point or archive index rather than by their own rows | F-1, F-9, DM-3 |

**One record schema (ticket task line: one typed record per file)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** the published schema, **when** a record is read against it, **then** the required spine (id, kind, scope, statement, evidence, source, trust, created_by, created, status) is exactly the set the human record format publishes and exactly the set the machine contract declares; the optional key set is closed and identical in both; every closed vocabulary matches across the machine contract, the human format, and the capsule contract where they overlap; and the reconciliation table names, per capsule element, whether it changes | F-2, DM-1, DM-6, NFR-10 |
| AC-F2-2 | **Given** a record violating the schema in one isolated way — a missing required key, an undeclared key, a malformed id, a duplicate id, a file name that does not begin with its id, a non-empty value outside a closed vocabulary, an over-long statement, a preference record whose source is not an explicit human correction, a guild tag disagreeing with its directory or present outside one, or a superseded record without its replacement link — **when** the invariant runs, **then** exactly one `memory.schema.*` error finding of the matching rule id names the file, the field, and the offending value's name, and no other area reports that defect | F-2, F-5, DM-1, DM-4 |
| AC-F2-3 | **Given** the whole migrated tree, **when** the invariant runs at the delivered HEAD, **then** every record renders every required key, reports zero schema findings, and no required field exists in the schema and absent from a rendered record | F-2, F-5, DM-1, NFR-11 |

**Write-path alignment**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** a capsule candidate that passes the capture bar and evidence rules, **when** the promotion home write is applied, **then** the written record renders every required schema key plus the conditional requirements promotion triggers — including the trust level and the capture basis, which promotion requires and already refuses to leave empty — the index row's second column is a non-empty read-when hint of at most 120 characters derived from the record's applicability statement with the statement as fallback, and the invariant reports zero findings for that record and that row | F-3, DM-1, DM-3, DM-6 |
| AC-F3-2 | **Given** the curator skill's written rules, **when** they are compared with the schema, the id-allocation rule, the status transitions, the budgets, and the row shape, **then** they agree with zero contradictions, and a consolidation pass that follows them produces a tree the invariant reports clean | F-3, DM-1, DM-2, DM-3 |

**Enforcement surface (ticket AC: lint fails)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** a tree with at least one error finding, **when** the invariant runs, **then** it prints one line per error finding in the declared order under its own namespace, prints the summary line with record, area, error, and advisory counts, and exits non-zero; **given** a tree with advisories only, **then** the advisory lines and the summary are printed with the same order and the exit is zero; **given** an unchanged tree and the same injected date, **then** two consecutive runs produce byte-identical output | F-4, DM-4, NFR-1, NFR-5 |
| AC-F4-2 | **Given** the delivered gate surfaces, **when** the aggregate local gate and the CI invariants job are inspected, **then** both invoke the same memory invariant, a parity test asserts both citations, and the command inventory, the error-table rows, the domain kinds, and the doctor's check set are identical to their pre-change values | F-4, F-14, NFR-6, NFR-10 |

**Dating**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F6-1 | **Given** a record with no `created` key, **when** the invariant runs, **then** it is exactly one `memory.schema.keys-missing` error naming the file and the key, and no `memory.dating.*` finding is produced for it — the ticket intent that lint fails on a record missing a date holds unchanged, with the missing-key area owning the classification; **and given** a record whose `created` is present but not `YYYY-MM-DD`, **and** a record whose `created` lies after the run's single injected date, **then** each is one `memory.dating.*` error naming the file and the value's name; the date is never inferred from a file name, a commit, or anything else | F-6, F-5, DM-1, DM-4 |
| AC-F6-2 | **Given** an authoritative behaviour-changing lesson with no revalidation date, **and** a record with a malformed revalidation date, **and** a record whose revalidation date has passed, **when** the invariant runs, **then** the first two are `memory.dating.*` errors and the expired window is a `memory.dating.*` advisory that does not change the exit; **given** a per-agent entry point capture line, **then** its date must match the declared date shape or it is a dating error | F-6, DM-1, DM-5, DEC-6 |

**Provenance (ticket AC: fails on a record missing evidence)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F7-1 | **Given** a record with no evidence link, an empty evidence link, or an evidence value that is non-empty but outside the five declared shapes, **when** the invariant runs, **then** each is exactly one `memory.provenance.*` error finding naming the file and never echoing a full evidence value; **and given** a record missing its writer or carrying a source outside the four declared channels, **then** each is one error finding of the matching rule id | F-7, DM-1, DM-4, NFR-9 |
| AC-F7-2 | **Given** the migrated tree, **when** its three pre-existing records are inspected, **then** each carries a trust level consistent with its recorded evidence channel, a shaped evidence link expressing the same evidence as before, and an unchanged statement and status | F-7, DM-1, DEC-12 |

**Dangling references**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F8-1 | **Given** a record whose supersession, replacement, or contradiction link names no existing record, a supersession that is not symmetric across the pair, or an in-tree relative link that resolves to no file, **when** the invariant runs, **then** each is one `memory.reference.*` error finding naming the file and the offending reference, and a resolvable reference of the same kind produces no finding | F-8, DM-1, DM-3 |

**Index coverage in both directions (ticket AC)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F9-1 | **Given** a record file with no index row, **when** the invariant runs, **then** one `memory.index.record-uncovered` error names the record path; **and given** an index row whose path is not a covered path, **then** one `memory.index.row-unbacked` error names the row's path; the two directions are reported independently, so a tree with one of each yields exactly two findings | F-9, DM-3, DM-4 |
| AC-F9-2 | **Given** an index row with an empty or over-long read-when hint, a duplicated row for one covered path, and a row resolving to a topic file or an area directory, **when** the invariant runs, **then** each is one `memory.index.*` error finding of the matching rule id; **and given** the archive index under its own coverage universe, **then** a retro note with no archive-index row is one `memory.index.record-uncovered` and an archive-index row backed by no note is one `memory.index.row-unbacked`, each carrying the archive-index universe in the detail, so the archive's note coverage is reported without a rule identity outside the closed register | F-9, F-1, DM-3, DEC-10 |

**Budget caps (ticket AC)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F10-1 | **Given** an index over 200 lines or over 25 KB, a per-agent or guild entry point over 150 lines, an archive index over 200 lines, and a kernel memory section over 200 but not over 220 lines, **when** the invariant runs, **then** each over-cap surface is one `memory.budget.*` error finding naming the file, the measured value, and the cap, except the kernel band which is an advisory at or below 220 lines; **and given** the kernel section over 220 lines, **then** it is an error; **given** a surface exactly at its cap, **then** no finding is produced | F-10, DM-5, DEC-9 |
| AC-F10-2 | **Given** the delivered tree after the layout and schema work, **when** every capped surface is measured, **then** all are within their caps, the index remains at or under 200 lines and 25 KB with the added schema and layout content, and the kernel section stays inside its advisory band | F-10, F-1, F-2, DM-5 |

**Derivable content**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F11-1 | **Given** a record whose body contains a fenced block that is a repository file listing, **and** a record whose body contains a fenced block restating a declared workspace command, **when** the invariant runs, **then** each produces exactly one `memory.derivable.*` advisory finding naming the file and the class, the exit stays zero, and the summary line reports the advisory count; **given** a record body containing neither pattern, **then** no derivable finding is produced | F-11, DEC-6, DM-4 |

**Secret patterns (ticket security intent)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F12-1 | **Given** a record, entry point, archive note, or convention file containing a value matching one recognizer class of the delivered privacy vocabulary, **when** the invariant runs, **then** one `memory.secret.<recognizer-class>` error finding names the file, the line, and the class, and never the matched value; **given** the same tree, **then** the set of possible secret rule ids equals the privacy vocabulary's recognizer classes exactly, with no pattern defined inside the memory check | F-12, DM-4, DEC-4, NFR-9 |
| AC-F12-2 | **Given** a committed documentation placeholder or a declared suppression marker inside a matched span, **when** the tree is scanned, **then** no finding is produced, so a documented example does not fail the gate; **and given** a markerless value of the same shape, **then** the finding is produced | F-12, DEC-4 |

**Concurrency (ticket AC: zero merge conflicts)**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F13-1 | **Given** two distinct agents on parallel branches each creating a record file in its own namespace, **when** both branches merge, **then** the merge reports zero conflicts across the record files and across each creator's own entry-point namespace — no branch edited a record path or an entry point the other branch created or owns, so no conflict exists for the union to resolve — and after the merge the invariant reports each new record with zero findings and both records covered by exactly one index row each. The index rows are the one surface outside that zero-conflict assertion: each branch appends its own row to the end of the single index table, two end-of-table appends conflict by construction, and that row pair is the union resolution AC-F13-2 requires | F-13, F-1, F-9 |
| AC-F13-2 | **Given** two promotion writes landing one new record file each plus one index row each, **when** both land, **then** the two record files never conflict, both index rows are present after the documented union resolution, no row is duplicated or orphaned, and a re-run of the promotion path adds no file and no row | F-13, F-3, F-9, RSK-5 |

**Guard replacement and boundary**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F14-1 | **Given** the delivered structure suite, **when** the memory-tooling guard runs, **then** it asserts the memory invariant exists and is cited by both gate surfaces; it retains one narrowed negative assertion — a file-name scan over `scripts/`, `tools/`, and `packages/` in which every match must be one of the sanctioned memory modules (the invariant's check, the pure evaluator, the schema contract module), so an unsanctioned `memory-doctor` or a second memory-lint component anywhere in those trees still fails the suite; and it still asserts the preserved absences: no memory subcommand on the CLI, the doctor check set unchanged at five with no memory member, and the error-table row set unchanged. The former blanket assertion that no memory-named component may exist in those trees no longer exists in its old form; its protective intent survives as the sanctions list, narrowed by declaration | F-14, NFR-10, DEC-12 |

**Non-functional**

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-NFR1-1 | **Given** a fixed tree, one fixed injected date, and two executions, **when** the finding output is compared, **then** it is byte-identical including order and truncation; the edge performed exactly one date read and injected it, the pure evaluation read no clock of its own, and the run performed zero writes and opened no network connection; **and given** the same unchanged tree at a later injected date, **then** only findings derived from the injected date may differ | NFR-1, NFR-4 |
| AC-NFR2-1 | **Given** a synthetic tree at the declared size bound, **when** the invariant runs on the CI runner, **then** it completes within the declared wall-clock bound with one read per file and no shell-out | NFR-2 |
| AC-NFR5-1 | **Given** a tree with more defects than the print ceiling, **when** the invariant runs, **then** at most the declared number of error findings and advisories are printed in the declared deterministic order, followed by one truncation line carrying the true totals | NFR-5, DM-4 |
| AC-NFR7-1 | **Given** the change's documentation output, **when** the conformance guards run, **then** every new user-facing doc is registered where the registry requires registration, every new doc under a distribution-marker root carries its marker, and the distribution guard reports zero drift | NFR-7 |
| AC-NFR8-1 | **Given** the delivered HEAD on a clean checkout, **when** the aggregate gate runs with a repository-local temporary directory, **then** it is green including the memory invariant, the boundary check, the prompt/help conformance checks, and the doc-distribution guard | NFR-8, NFR-6 |
| AC-NFR10-1 | **Given** the delivered change, **when** the command inventory, the error table, the domain-kind membership, the state record kinds, the event topics, and the doctor check set are inspected, **then** every one is identical to its pre-change value and no new identity, command, flag, or check exists | NFR-10, F-4, F-14 |

### 17.1 Definition of Done (change-specific)

This change is done when every condition below holds. Each condition binds §17 criteria to a checkable outcome, names its verification method, and is proven in the delivering plan phase of `chg-GH-301-plan.yaml` that owns the capability. This specification claims no passing evidence and no acceptance; the conditions define what must be proven. Two framing rules are binding:

1. **Tree-green rule.** The invariant may not be enabled in the aggregate gate while the delivered tree fails it: migration and layout land first, then the gate is turned on, and the delivered HEAD is green (§19, RSK-3).
2. **Boundary rule.** No condition requires or permits a memory subcommand, a doctor area, an error-table identity, a second secret-pattern table, or an installed-script distribution of the invariant; any such artifact in the delivered diff fails this DoD (NG-1, NG-4, NG-6, DEC-4, DEC-13).

| # | Done condition | Binds | Verification (test / evidence) | Proven in plan |
|---|---|---|---|---|
| DoD-1 | The tree carries exactly the canonical layout — index, four record areas, retro archive with its archive index, per-agent and guild entry points — with empty areas proved by placeholders, no fleet quarantine area, no directory rows, and topic files and retro notes represented by their entry point or archive index | F-1, DM-2, AC-F1-1, AC-F1-2 | Structure suite over the committed tree; negative fixture for an invented area | Layout phase |
| DoD-2 | One schema is published in both renderings with an identical required spine, an identical closed optional set, identical closed vocabularies, and a reconciliation table naming each capsule element's disposition; the whole tree renders every required key with zero schema findings | F-2, DM-1, DM-6, AC-F2-1, AC-F2-3 | Contract/schema parity test (human format parsed against the machine contract); whole-tree run recorded | Schema phase |
| DoD-3 | Every schema violation class is classified with its own rule id, naming the file, the field, and the offending value's name, and no defect is double-reported under another area | F-5, AC-F2-2 | One-defect-per-case fixture table green | Schema phase |
| DoD-4 | The promotion writer renders the full schema (trust and basis included) and a read-when hint row, and a promoted record plus its row yields zero findings; the curator rules agree with the schema, the id rule, the budgets, and the row shape | F-3, AC-F3-1, AC-F3-2 | Promotion behaviour suite over the memory fixture; skill-content comparison review | Write-path phase |
| DoD-5 | The invariant exists as one check with a pure evaluation entry and a thin edge, is cited identically by the aggregate local gate and the CI invariants job with a parity test, and adds no command, flag, error identity, or doctor check | F-4, F-14, AC-F4-2, AC-NFR10-1 | Gate/CI parity test; inventory assertions; error-table sync check | Enforcement phase |
| DoD-6 | Output is deterministic, ordered, bounded, and verdict-correct: byte-identical repeated runs, advisory and error lines distinguishable, exit non-zero on any error and zero on advisories only, ceiling plus truncation line carrying true totals | F-4, AC-F4-1, AC-NFR1-1, AC-NFR5-1 | Determinism and truncation tests; exit-projection assertions | Enforcement phase |
| DoD-7 | Dating is enforced: missing, malformed, and future creation dates are errors; the revalidation window is required for authoritative behaviour-changing lessons, malformed values are errors, and an expired window is a non-gating advisory; entry-point capture lines carry the declared date shape | F-6, AC-F6-1, AC-F6-2 | Dating fixture table green | Dating phase |
| DoD-8 | Provenance is enforced: evidence presence and shape, writer presence, and source channel; findings never echo a full evidence value; the three migrated records carry a trust level consistent with their recorded channel and keep their statements and statuses | F-7, AC-F7-1, AC-F7-2 | Provenance fixture table; migration diff review | Provenance phase |
| DoD-9 | Reference integrity is enforced for supersession, replacement, contradiction, and in-tree relative links, with a resolvable reference producing no finding | F-8, AC-F8-1 | Reference fixture table green | Reference phase |
| DoD-10 | Index coverage is proven in both directions over the declared universe, with row-shape and duplicate-row findings, and the archive index covers its notes exactly | F-9, AC-F9-1, AC-F9-2 | Coverage fixture table; archive-index coverage test | Index phase |
| DoD-11 | Every declared budget is enforced at its published threshold with the published kernel band, a surface exactly at cap passes, and the delivered tree measures within every cap | F-10, DM-5, AC-F10-1, AC-F10-2 | Budget fixture table; measured line and byte counts recorded as evidence | Budget phase |
| DoD-12 | Derivable content is reported as advisories only: exactly one finding per class on a matching record, none on a clean record, and no exit change | F-11, AC-F11-1 | Derivable fixture pair (positive and negative) | Heuristics phase |
| DoD-13 | Secrets are detected with the delivered privacy vocabulary only: one finding per recognizer class naming path, line, and class and never the value; suppression classes prevent false positives; the rule-id set equals the vocabulary's class set with no local pattern | F-12, AC-F12-1, AC-F12-2 | Secret fixture table per recognizer class plus a suppression case; rule-id derivation test | Secret phase |
| DoD-14 | Concurrency is proven: two agents on parallel branches create records with zero merge conflicts and both are covered; two promotion writes never conflict in record files, both rows survive union resolution, no duplicate or orphan row exists, and a re-run adds nothing | F-13, AC-F13-1, AC-F13-2 | Temporary-repository merge exercise (agent case) and promotion union exercise | Concurrency phase |
| DoD-15 | The GH-302 negative guard is replaced by the positive presence assertion plus the preserved boundary absences, and the old absence-only assertion is gone | F-14, AC-F14-1, DEC-12 | Structure suite green; changed-file diff review | Guard phase |
| DoD-16 | The migrated tree is green at the delivered HEAD before the invariant is enabled in the aggregate gate, with zero error findings and any advisories disclosed in the summary | §19, RSK-3, AC-F10-2 | Whole-tree run recorded before and after the gate is wired | Layout and enforcement phases |
| DoD-17 | Documentation impact is delivered: the memory index publishes the schema, layout, budgets, and lint contract within its caps; the kernel memory section gains its gate and schema clause inside budget; the curator skill and the manual doctor checklist are reconciled; phase 7 reconciles the current-truth feature specs, including the new memory-lint feature spec | §7.1, §16, DM-2, DM-5, AC-F10-2 | Doc diff review; line and byte measurements; phase-7 reconciliation evidence | Documentation and phase 7 |
| DoD-18 | Full acceptance coverage: every §17 criterion is green with no uncovered criterion and no orphan test | §17, NFR-1..NFR-11 | Test-plan coverage matrix all covered; execution evidence in the phase notes | Per phase; roll-up at the final delivery phase |
| DoD-19 | The full gate battery is green at the delivered HEAD (`pnpm check` with a repository-local temporary directory, plus the doc-distribution and prompt/help conformance guards), the backlog M2-S8 markers are updated, and a pull request is open against `main-tools` with the required CI jobs green | NFR-6, NFR-7, NFR-8, AC-NFR8-1, AC-NFR7-1 | Gate logs attached to the change; backlog inspection; PR record | Quality gates and PR creation |

A condition without passing evidence is not done; `dod_check` reopens the owning plan phase rather than waiving a row.

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery**: full lifecycle on a feature branch created from `main-tools`; the PR targets `main-tools` and stays open for human review (merge authority: CEO).
- **Ordering inside the change**: layout and migration first, then the schema and its two renderings, then the invariant with its areas and wiring, then the write-path and boundary-guard reconciliation. The invariant is enabled in the aggregate gate only after the migrated tree measures green (framing rule 1).
- **Adoption**: automatic in this repository — the gate runs for every future change. No configuration key is added and no opt-out exists; a project-level waiver is deliberately not offered, because the failing surfaces are mechanical and cheap to fix, and the advisory class already covers judgment.
- **Communication**: milestone bookkeeping via the backlog M2-S8 progress marker and the milestone status notes; the memory index is the single reader-facing contract and states the gate, the schema, and the budgets in one place.
- **Rollback**: revert-safe — the tree additions are additive, the record migration is a field backfill whose statements and statuses are untouched, and reverting restores the previous format and removes the gate. No state store, event stream, or capsule is touched, so no migration needs to be undone.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

Seeding is structural and bounded:

- **Areas**: create the preferences, guild, and retro archive areas with their placeholder files, and the archive index in its header-only form. No guild folder, no preference record, and no retro note is fabricated — an empty, proved area is the deliverable.
- **Record backfill**: the three delivered lesson records gain the schema's required trust level (assigned from their recorded evidence channel under the published trust table), a shaped evidence link expressing the same evidence they already cite, and nothing else. Their ids, statements, statuses, and bodies are unchanged. A schema backfill is not a semantic rewrite (DEC-12), so supersede-never-rewrite is not violated.
- **Entry points**: the four delivered entry points are measured against the cap and the capture-line date shape; content is edited only where a line violates the date shape or a cap requires the documented split into topic files.
- **Index**: rewritten to publish the schema, layout, budgets, and lint contract while keeping exactly one row per covered path and staying within 200 lines and 25 KB.
- **No content migration**: nothing is copied in from planning areas, no retired record is renumbered, and no id is reused. A pruned or superseded id stays reserved.

## 20. PRIVACY / COMPLIANCE REVIEW

Positive impact at the contract level, on coverage the tree already has. The memory tree — records, entry points, archive notes, and convention files — is already inside the whole-tree privacy guard's scan set, which enumerates every tracked and untracked-not-ignored file rather than a scope class, so a credential in a memory file is caught today. What the tree does not have is a memory-shaped verdict. This change puts the tree under the delivered privacy vocabulary *inside the memory invariant*, so the same recognizer classes and suppression classes that the whole-tree guard applies are rendered as `memory.secret.<recognizer-class>` findings with a record identity, a memory area, a stable per-record contract, and a place in the ordered memory summary — one vocabulary, one tuning surface, no drift, and a privacy result a record's author or reviewer can act on. Findings report the path, the line, and the recognizer class only, never a matched value (NFR-9), so the gate's own output cannot leak what it detected. No personal data flow, no retention change, and no new processing surface is introduced; the trust levels and the quarantine rule for external content remain conventions of the same kernel.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Memory poisoning containment** is unchanged in authority but improved in enforcement: an external-sourced record without a traceable evidence link and a declared trust level now fails the gate instead of landing silently.
- **Credential leakage into durable memory gains a memory-scoped verdict rather than a new scanner**: the tree is already scanned by the whole-tree privacy guard, so the addition is that a hit inside a record, entry point, or archive note is rendered as one memory finding — record identity, memory area, recognizer class — through the same tuned, suppression-aware vocabulary as the repository guard (DEC-4), so one vocabulary means one tuning surface, one suppression behaviour, and no drift between the two verdicts.
- **Findings are redaction-safe**: no matched value is echoed, and the output ceiling bounds how much a broken tree can print.
- **No new trust boundary, credential, network call, or write path** is introduced: the invariant is read-only, offline, state-free, and deterministic over a single injected date (NFR-1, NFR-4).
- **Boundary preservation matters for security too**: keeping the doctor at five checks and the CLI unchanged prevents a second, uncoordinated health surface from becoming an implicit authority.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **One schema authority** must be maintained in lockstep: changing the required spine means changing the machine contract, the human record format, the promotion writer, and the curator rules in one change; a parity test makes the first two disagree loudly. The authority, the disposition table, and the reconciliation direction are recorded in ADR-0011, so a future schema change is a decision-record change first, not a per-consumer edit.
- **Vocabulary ownership**: trust levels and evidence shapes are owned by the capsule contract and consumed here; a new evidence channel or trust level is a capsule-contract change first.
- **Bound ownership**: the 280-character statement bound and the 120-character hint bound are single-sourced constants in the schema contract module, published in the human rendering and imported by the lint and its boundary fixtures, so raising one is one deliberate constant change rather than a hunt for restated numbers (ADR-0011 D6).
- **Budget tuning** is a deliberate change to the published declaration, not an emergent property: raising a cap is a specification change, and the kernel band's tolerance is published so it is not negotiated per failure.
- **Advisory discipline**: the derivable heuristics stay closed at two rules; a third is a design decision with its own false-positive review, because advisory noise costs attention even when it cannot fail a build.
- **Gate runtime** is bounded by the scan contract; if the tree grows past the declared size bound, the bound is re-measured before raising it.
- **Deferred retirement**: the manual doctor checklist retires only when the invariant is distributed to bootstrapped projects (OQ-1), and the archive index stops being append-maintained only when generation lands.

## 23. GLOSSARY

| Term | Definition |
|---|---|
| Canonical record | One durable memory item: one file under a record area, carrying the schema's required keys in YAML frontmatter and an optional rationale body |
| Record schema | The single published field set, closed vocabularies, id grammar, file-name shape, and validity rule that every durable record and every writer conform to |
| Required spine | The ten required keys resolving the backlog's seven conceptual fields (id; kind; scope; provenance as source, writer, and evidence; trust; validity as the creation date; status) |
| Index coverage | The two-direction property that every covered path has exactly one index row and every row resolves to a covered path |
| Covered path | A path that must carry exactly one row in the index that covers it: a record file, an agent entry point, a guild entry point, or the archive index for the memory index, and a dated retro note for the archive index |
| Coverage universe | One of the two path sets coverage is proven over — the memory index's covered paths (U-1) or the archive index's retro notes (U-2); the two are evaluated independently and each finding names its universe |
| Read-when hint | The index row's second column: when a reader should open that path |
| Finding | One classified defect or advisory reported by the memory invariant, under the identity shape `memory.<area>.<condition>` |
| Memory invariant | The repository check that evaluates the memory tree and fails the quality gates on error findings |
| Budget cap | The published line or byte ceiling for the index, an entry point, the archive index, or the kernel memory section |
| Derivable content | Memory that restates something the repository answers in one command; forbidden by the write gate and reported as an advisory |
| Retro archive | The memory tree area holding dated append-only retro notes with an archive index that represents them |
| Guild tree | The memory tree area holding guild-scoped technique and interpretation records, each tagged with its guild |
| Schema backfill | Adding a required field to an existing record without changing its statement, status, or meaning |
| Advisory | A finding that is reported and counted but never changes the check's exit |

## 24. APPENDICES

### Appendix A — Finding-identity register (closed)

Area order is the reporting order. Every rule id is `memory.<area>.<condition>`; no id outside this register may be emitted.

| Area | Rule ids | Severity |
|---|---|---|
| `schema` | `memory.schema.frontmatter-missing`, `…frontmatter-malformed`, `…keys-missing`, `…key-unknown`, `…id-malformed`, `…id-duplicate`, `…file-name-mismatch`, `…value-unknown`, `…statement-too-long`, `…preference-source`, `…guild-mismatch`, `…superseded-by-missing` | error |
| `dating` | `memory.dating.created-malformed`, `…created-future`, `…revalidate-missing`, `…revalidate-malformed`, `…entry-line-date` | error; `memory.dating.revalidate-expired` is warn |
| `provenance` | `memory.provenance.evidence-missing`, `…evidence-shape-unknown`, `…created-by-missing` | error |
| `reference` | `memory.reference.supersedes-dangling`, `…superseded-by-dangling`, `…supersede-asymmetry`, `…contradicts-dangling`, `…link-dangling` | error |
| `index` | `memory.index.record-uncovered`, `…row-unbacked`, `…row-duplicate`, `…row-malformed`, `…hint-missing` | error |
| `budget` | `memory.budget.index-lines`, `…index-bytes`, `…agent-entry-lines`, `…guild-entry-lines`, `…archive-index-lines`, `…kernel-lines` | error; the kernel band above 200 and at or below 220 is warn |
| `derivable` | `memory.derivable.file-listing`, `…command-echo` | warn |
| `secret` | `memory.secret.<recognizer-class>` for each recognizer class of the delivered privacy vocabulary (six secret classes plus the private-literal class), derived at run time from that vocabulary — no id exists without a vocabulary class | error |

### Appendix B — Planning truth and scenario-seed reconciliation

- Canonical scope: backlog story M2-S8 (OSS-tooling planning area); milestone pack M2 records that this story owns no architecture flow and no contract surface.
- Scenario seeds **SC-M2-S8-01** (a record missing its id and evidence fails with one finding per missing field naming the file, exit non-zero — mapped to AC-F4-1, AC-F2-2, AC-F7-1) and **SC-M2-S8-02** (two agents appending records to different files merge with zero conflicts and both records are listed — mapped to AC-F13-1, AC-F13-2, with the seed's `index.data.records` surface reconciled to the invariant's coverage result, because this story ships no index command) are inherited by the change test plan; their content is not restated here.
- Binding PM decisions are recorded in `chg-GH-301-pm-notes.yaml` and mirrored as DEC-1…DEC-4.

### Appendix C — Constraint register (carried into plan and test authoring)

- C-1: one schema authority, two renderings, no fifth variation — the authority and the one-way direction are ADR-0011's (D1), with the concept-key dispositions in D3 (ADR-0011, DEC-5, NFR-10).
- C-2: enforcement is one repository invariant on both gate surfaces; no CLI command, error identity, or doctor area (DEC-3, F-14, NFR-10).
- C-3: the secret area consumes the delivered privacy vocabulary and its suppression classes; no local pattern (DEC-4, AC-F12-1).
- C-4: advisories never gate; only the mechanical areas fail the build (DEC-6, AC-F11-1).
- C-5: the tree is green before the gate is enabled, and the migration changes no statement or status (frame rule 1, DEC-12).
- C-6: every new user-facing doc is registered where the forbidden-literal registry requires it, and carries `ados_distribution` where a marker root requires it (NFR-7, AC-NFR7-1).
- C-7: the invariant is not distributed to bootstrapped projects; the manual checklist is reworded, not deleted (DEC-13, NG-7).
- C-8: PR targets `main-tools`; delivery conventions per the change pm-notes (NFR-8).
- C-9: the GH-302 guard replacement keeps one narrowed negative assertion — a file-name sanction scan over `scripts/`, `tools/`, `packages/` whose only permitted matches are the sanctioned memory modules — alongside the positive presence assertion and the preserved absences (DEC-12, AC-F14-1).
- C-10: index coverage is evaluated over two declared universes — the memory index over its covered paths and the archive index over its retro notes — with the universe named in each finding's detail and no rule identity outside Appendix A (DM-3, AC-F9-2).
- C-11: the schema's authority, spine, closed optional set, dispositions, conditional requirements, and published bounds are ADR-0011's; a delivery detail that would contradict them is resolved by the ADR, not the plan (ADR-0011 D1–D6).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-15 | spec-writer (DeepSeek V4.1 Flash 1017) | Initial specification from ticket #301, backlog M2-S8, the M2 milestone pack scenario seeds, the memory concept set, the GH-302 predecessor spec, and verified repository truth (tree contents and caps, promotion reader and writer, capsule candidate contract, privacy vocabulary and guard scope classes, the negative guard, aggregate gate and CI invariants job) |
| 1.1 | 2026-11-15 | spec-writer (DeepSeek V4.1 Flash 1017) | Readiness iteration-1 revision (findings 2, 4, 6, 8, 9, 10, 11, 12, 17, 20). F-13/AC-F13-1: the zero-conflict claim is scoped to record files and own entry-point namespaces, with the shared index row routed to AC-F13-2's union resolution and the end-of-table append conflict named as the reason for the boundary. F-6/AC-F6-1: an absent `created` is `memory.schema.keys-missing`; dating covers present-but-malformed and future values only. §2.1/GAP-9/§20/§21: the whole-tree privacy guard already scans every tracked `.ai/memory/**` file, and F-12 is re-justified on memory-scoped identities, uniform rendering, and a stable per-record contract. NFR-1/AC-NFR1-1/F-4: determinism is defined for a fixed injected date, with exactly one date read at the edge. F-14/DEC-12/AC-F14-1: the replacement retains one narrowed file-name sanction scan. DM-3/AC-F9-2: the archive-index coverage universe is declared and the two-universe evaluation of the coverage rules named. DM-1/§2.1: the concept-key dispositions are cited from ADR-0011 D3 and the duplicate trust-table claim corrected. DM-1/DM-5: the 280-character statement and 120-character hint bounds are published as single-sourced constants. DM-1/AC-F3-1: `basis` is required on promotion-written records and optional on hand-authored ones. The canonical schema is cited throughout to ADR-0011 as the system-level decision of record (Proposed; owner-ratified at the open-PR gate) |

---

## AUTHORING GUIDELINES

Sources: GitHub issue #301 (owner-authored, verbatim AC intent); backlog story M2-S8; the M2 milestone pack (scenario seeds referenced by name, not restated); `chg-GH-301-pm-notes.yaml` (binding decisions DEC-1…DEC-4, the two in-change risks, the known doc impacts, and the delivery conventions); ADR-0011 (the canonical record schema: authority and one-way direction, required spine, closed optional set, concept-key dispositions, file-name and validity rules, conditional requirements, and the 280/120 published bounds); the memory concept set (architecture, lifecycle, autonomy and visibility, practices); the GH-302 spec for what it delivered and explicitly deferred; readiness iteration 1 for the corrected claims; and repository truth verified for the tree contents and caps, the promotion reader and writer, the capsule candidate contract and vocabularies, the privacy-rule definition set and the whole-tree privacy guard's scan enumeration (every tracked file, `.ai/memory/**` included), the negative guard's exact assertions, and the aggregate-gate and CI-invariants wiring.

Constraint handling: the record-schema drift risk is owned by ADR-0011 and restated in §8.3 DM-1 and DM-6 with the one-way reconciliation direction, the per-concept-key disposition table, and a per-capsule-element disposition table; it is bound by AC-F2-1 and DoD-2, and this specification consumes the ADR rather than re-deciding it. The sanctioned replacement of the GH-302 negative guard is declared in F-14, DEC-12, AC-F14-1, and DoD-15 with its protective intent narrowed by declaration (one sanction scan retained), and is not left to the plan to discover. The distribution-marker and forbidden-literal registration conventions are stated as a delivery convention in §7.1, NFR-7, and Appendix C. Scope statements stay at capability level; the enforcement surface is named once because the PM decision fixes it, and no implementation steps, task logs, or code-level instructions appear.

Two deliberate reconciliations are recorded rather than assumed: the SC-M2-S8-02 seed's index surface is reconciled to the invariant's coverage result because this story ships no index command (Appendix B, DEC-10), and the manual doctor checklist is reworded rather than retired because the invariant is not distributed to bootstrapped projects (DEC-13, OQ-1).

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-301)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] `change.milestone` equals the change pm-notes milestone verbatim ("M2: Ceremonies, measurement, and memory")
- [x] All sections present in order (1–25 + authoring guidelines + validation checklist) with §17.1 Definition of Done
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-, GAP-, NG-, G-)
- [x] Acceptance criteria use Given/When/Then and each references at least one F-/DM-/NFR- ID
- [x] A testable acceptance criterion exists for every named lint area (schema, dating, provenance, dangling references, index coverage, budget caps, derivable content, secret patterns) and for every layout and record-model deliverable
- [x] Ticket acceptance artifacts pinned: missing id/date/evidence fails; unbacked index row and uncovered record fail; budget violations fail; concurrent record creation is conflict-free
- [x] Record-schema drift risk resolved with an explicit reconciliation direction and per-capsule-element disposition, owned by ADR-0011 (cited in the front matter as the system-level decision of record, Proposed and owner-ratified at the open-PR gate)
- [x] Published numeric bounds (statement 280, hint 120) declared in DM-1/DM-5 and single-sourced in the schema contract
- [x] Sanctioned replacement of the GH-302 negative guard declared
- [x] Distribution-marker and forbidden-literal registration recorded as a delivery convention
- [x] Change-specific Definition of Done present and binding every criterion
- [x] NFRs include measurable values; risks include Impact & Probability with residual risk
- [x] No implementation details, task log, or code-level instructions in the body
- [x] No content duplicated from linked docs (seed contents, glossary sources, and concept material referenced, not restated)
- [x] Front matter validates per front_matter_rules
