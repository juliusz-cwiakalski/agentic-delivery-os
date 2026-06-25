---
change:
  ref: GH-63
  type: feat
  status: Proposed
  slug: machine-enforceable-decision-records
  title: "Machine-enforceable decision-record quality (JSON schemas, validator, index tool, CI gate)"
  owners: ["@cwiakalski"]
  service: delivery-os
  labels: [decision-records, tooling, ci, json-schema, validation]
  version_impact: none
  audience: internal
  security_impact: none
  risk_level: medium
  dependencies:
    internal: [decision-record-front-matter, decision-record-template, decision-making-guide, decision-records-management-guide, feature-decision-records, tools-convention, bash-rules, ci-workflow, add-header-location-script, decision-advisor-agent, plan-decision-command, write-decision-command]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the decision-record quality invariants that GH-46 established — single source of truth for body structure, rigor-aware required fields, lifecycle validity, constraint/driver discipline — **machine-enforceable instead of prompt-only**, by defining JSON Schemas for the landed front matter and planning summaries, a stdlib-only validator CLI that turns the framework's rules into actionable failures, a deterministic index generator with a health report, a read-only `/decision-index` command, and a CI gate that blocks drift at PR time — without introducing a heavy runtime, a secret, or a network call.

## 1. SUMMARY

This change adds the missing machine-enforceable layer for decision-record quality that GH-46 (PR #62) deliberately deferred. It introduces two JSON Schema (draft 2020-12) documents under a new `schemas/` directory — one for the **landed GH-46 front-matter structure** (the nested `classification`/`governance`/`ai_assistance`/`links` blocks actually present in the template and the ADR-0001 dogfood record), and one for the `<decision_planning_summary>` plus its legacy alias blocks. It delivers two PATH-able CLI tools in `tools/` (no `.sh` extension): `validate-decision-record`, which enforces rigor-aware required fields, lifecycle transitions, and the expressible §28.3 negative cases with actionable errors, and `generate-decision-index`, which regenerates `doc/decisions/00-index.md` deterministically and emits a health report (overdue reviews, missing deciders, missing metrics, and a future-field-aware waiver dimension). It adds a read-only `/decision-index` command, and a **new** CI job (alongside the existing `verify-claude-build` job) that runs both tools on PRs touching `doc/decisions/` or `schemas/` and fails the build on validation or index drift. The validator runs on **stdlib only** (bash + python3 and/or jq) — no `jsonschema` pip dependency — so it works in the stock CI runtime. The declarative `*.schema.json` files remain the source of truth for documentation/IDE/tooling; the validator imperatively encodes the same rules, and a schema-vs-validator coverage check keeps them in sync.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **Decision invariants are prompt-enforced and grep-verified, not machine-enforceable.** GH-46 established "single source of truth for body structure", "R2/R3 require a decider + independent review", "no auto-Accept", "constraint/driver overlap resolved", "non-negotiable constraint violations disqualify the chosen option", and "section-order consistency" — but they live in agent prompts and guides, with only ad-hoc grep checks.
- **No schema, no validator.** There is no `schemas/` directory and no validator; front-matter quality can drift silently between PRs.
- **No generated index.** `doc/decisions/00-index.md` exists but is **hand-maintained**; there is no tool that regenerates it, so it can fall out of sync, and there is no health view (overdue reviews, missing deciders/metrics, open/expired waivers).
- **Exactly one live record exists** — `ADR-0001` (the GH-46 dogfood) — plus `README.md` and the hand-maintained `00-index.md`. ADR-0001 is the concrete front matter the schema must validate; it uses the GH-46-landed **nested** structure (`classification{}`, `governance{}`, `ai_assistance{}`, `revisit_triggers[]`, `links{}`).
- **Planning summaries are transient.** The `<decision_planning_summary>` (generic) and the legacy `<technical_decision_planning_summary>` / `adr.*` alias blocks are `/plan-decision` outputs consumed by `/write-decision`; **zero live instances persist under `doc/`**.
- **CI has one job.** `.github/workflows/ci.yml` runs a single job, `verify-claude-build` (regenerates the Claude plugin and fails if stale). There is no decision-record gate.
- **Runtime is constrained.** `python3` (3.14.4) and `jq` (1.8.1) are available; `shellcheck` is **not** installed, and CI's `ubuntu-latest` `python3` lacks the `jsonschema` package. The ticket explicitly says to "avoid a heavy runtime" and stay Git-native.

### 2.2 Pain Points / Gaps

- **Quality rules are unenforced.** Nothing rejects an invalid `decision_type`, an impossible lifecycle transition (e.g., Accepted → Proposed), an Accepted record missing `decision_date`, or an Accepted R2/R3 record missing a decider — until a human happens to notice.
- **No discoverable/auditable corpus.** Without a generated index and health report, the decision directory cannot be scanned for overdue reviews or governance gaps.
- **Two encodings of one structure (drift risk).** The front matter is defined prose-only in the template + guide + feature spec; a schema would make it a single machine-readable contract — but a declarative schema and an imperative validator can themselves drift if not coupled.
- **Research-vs-landed mismatch.** The local research basis (§17) sketches a **flat** front matter (`driver`, `decider`, `decision_domains`, `rigor_profile`, `specs` at the top level), whereas GH-46 **landed a nested** structure (`governance.driver`, `classification.rigor`, `links.spec`). A schema authored from the flat sketch would reject the actual dogfood record.
- **§28.3 spans more than this ticket can own.** The ticket's negative-case list (research §28.3) includes cases that require sibling machinery (evidence-ledger verification, body-content recommendation/decision separation, immutable-rationale snapshot/diff) explicitly listed as non-goals. The list must be split into what is expressible against landed artifacts now versus what is deferred to siblings.

## 3. PROBLEM STATEMENT

Because GH-46's decision-record invariants are enforced only by prompts and ad-hoc greps, **a maintainer (engineer, AI agent, or reviewer) cannot catch a malformed decision record at PR time**, the single dogfood record and the hand-maintained index can silently drift from the standard, and the directory provides no auditable health view — leaving the foundation that downstream decision follow-ups (catalogs, evidence ledger, verification/retro) need as prompt-only rather than data-driven and CI-gated.

## 4. GOALS

- **G-1**: Define machine-readable JSON Schemas for the landed GH-46 decision-record front matter and for the planning summaries (generic + legacy alias), as the declarative source of truth for docs/IDE/tooling.
- **G-2**: Deliver `validate-decision-record` — a stdlib-only CLI that enforces rigor-aware required fields, lifecycle validity, and every §28.3 negative case expressible against landed artifacts, with **actionable** errors.
- **G-3**: Deliver `generate-decision-index` — a deterministic index generator that regenerates `doc/decisions/00-index.md` and reports overdue reviews, missing deciders, missing metrics, and a future-field-aware waiver dimension.
- **G-4**: Provide `/decision-index` as a read-only command invocable by `@decision-advisor` or directly.
- **G-5**: Add a CI gate (a new job alongside `verify-claude-build`) that runs both tools on PRs touching `doc/decisions/` or `schemas/` and blocks merge on validation or index drift.
- **G-6**: Preserve backward compatibility — existing un-classified records validate (classification optional; default rigor R2), and migration is a non-destructive warning linter, never a destructive rewrite.
- **G-7**: Keep the runtime Git-native and dependency-light — no proprietary runtime, no `jsonschema` pip install, no network calls, no secrets.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Decision-record invariants enforced by machine (schema + validator + CI) | All in-scope §28.3 cases blocked at PR time |
| Live records rejected after migration | 0 (ADR-0001 and un-classified records remain valid) |
| Validator runtime dependencies (non-stdlib) | 0 pip installs; works on stock CI `python3` |
| Index determinism | Byte-stable output for the same input set |
| CI jobs touched | 1 new job added; `verify-claude-build` preserved unchanged in role |
| Declarative↔imperative coverage | Every schema rule asserted by ≥1 validator test; 0 uncovered rules |

### 4.2 Non-Goals

- **NG-1**: Domain decision-driver catalogs/checklists (sibling ticket "Domain decision-driver checklists" — reuses this schema; owns catalog content).
- **NG-2**: Structured evidence ledger + R3 source verification (sibling ticket GH-65 "Structured evidence ledger + R3 source verification" — owns the "R3 without evidence verification" negative case).
- **NG-3**: Decision verification & retrospective lifecycle agents/commands (sibling ticket "Decision verification & retrospective lifecycle" / GH-64 — owns recommendation/decision body separation and immutable-rationale change detection; consumes this index).
- **NG-4**: A custom runtime or language ecosystem — stay Git-native (Markdown/YAML/JSON + a bash/CLI validator per `doc/guides/tools-convention.md`).
- **NG-5**: Enforcing the decision-record body-section **order** programmatically beyond what is already grep-checked today (the template remains the single source of truth; the validator focuses on front matter + cross-field rules + the expressible planning-summary structure).
- **NG-6**: A waiver/expiry front-matter field. No such field is landed today; "expired waiver" detection is therefore future-field-aware (deferred until a sibling lands the field — see SD-2 / Appendix A).
- **NG-7**: Migrating/backfilling historical records destructively (additive only; warnings, never rewrites).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Front-matter JSON Schema (`schemas/decision-record-frontmatter.schema.json`) | A single machine-readable contract for the landed GH-46 nested front matter; declarative source of truth for docs/IDE/tooling (G-1, SD-1) |
| F-2 | Planning-summary JSON Schema (`schemas/decision-planning-summary.schema.json`) | Validates the generic `<decision_planning_summary>` and the legacy `<technical_decision_planning_summary>` / `adr.*` alias blocks (G-1) |
| F-3 | `validate-decision-record` CLI | Enforces rigor-aware required fields, lifecycle validity, and every expressible §28.3 negative case with actionable errors; stdlib-only (G-2, SD-2, SD-4) |
| F-4 | `generate-decision-index` CLI | Regenerates `doc/decisions/00-index.md` deterministically and emits a health report (overdue reviews, missing deciders/metrics, future-field-aware waivers) (G-3) |
| F-5 | `/decision-index` command | Read-only invocation surface for the index, runnable by `@decision-advisor` or directly (G-4) |
| F-6 | CI gate | New job alongside `verify-claude-build` running both tools on PRs touching `doc/decisions/` or `schemas/`; blocks merge on validation/index drift (G-5) |
| F-7 | Backward-compatible migration linter | Non-destructive warnings; default rigor R2 when `classification` absent; never rewrites existing records (G-6) |

### 5.1 Capability Details

**F-1 — Front-matter JSON Schema.** A JSON Schema (draft 2020-12) at `schemas/decision-record-frontmatter.schema.json` documenting the **landed GH-46 nested structure** (per SD-1, **not** the flat §17 research sketch). It enumerates every field with its type, required-ness, and valid values/enums (see the schema-fields table in §8.3 / DM-1). It validates the ADR-0001 dogfood record and the template. Required top-level scalars: `id`, `decision_type`, `status`, `created`, `decision_date`, `last_updated`, `summary`, `owners` (≥1), `service`. Optional top-level scalars: `decision_area`, `decision_scope`, `reversibility`, `review_date`, `business_impact`, `customer_impact`. Optional nested blocks: `classification{}`, `governance{}`, `ai_assistance{}`, `revisit_triggers[]`, `links{}`.

**F-2 — Planning-summary JSON Schema.** A JSON Schema (draft 2020-12) at `schemas/decision-planning-summary.schema.json` validating the `<decision_planning_summary>` generic block plus the legacy `<technical_decision_planning_summary>` tag and `adr.*` field alias (per GH-46's back-compat alias). It is the declarative contract for the transient `/plan-decision` → `/write-decision` handoff. Because zero live instances persist under `doc/`, its correctness is proven by **synthetic fixtures committed under `tools/.tests/`**, not by a CI pass over live docs (SD-3).

**F-3 — `validate-decision-record`.** A PATH-able CLI in `tools/` (no `.sh` extension) following `doc/guides/tools-convention.md` and `.ai/rules/bash.md`. It enforces: (a) front-matter structural validity (all DM-1 rules); (b) rigor-aware required fields — `decision_date` non-null when `status=Accepted`; `governance.decider` present when `status=Accepted` AND `classification.rigor ∈ {R2, R3}`; `governance.reviewers` non-empty when `status=Accepted` AND `classification.rigor = R3` (acceptance-gated, mirroring the decider rule — ADR-0001 is Proposed R3 with empty reviewers and legitimately passes); (c) lifecycle validity — only permitted transitions and `supersedes`/`superseded_by` consistency; (d) planning-summary structure (generic + legacy alias) including `hard_requirements ∩ decision_drivers = ∅` and best-effort non-negotiable-constraint violation detection against the chosen option; (e) a documented **heuristic** that an Accepted record's body contains a non-empty `## Verification Criteria`. Every failure emits an **actionable** message naming the record, the offending field, and the violated rule, and returns a non-zero exit code. Runs on **stdlib only** — bash + python3 and/or jq, no `jsonschema` dependency (SD-4). Supports `--help`, `--version`, `--dry-run`, and semantic exit codes. Validated by tests at `tools/.tests/test-validate-decision-record.sh` with positive and negative fixtures.

**F-4 — `generate-decision-index`.** A PATH-able CLI in `tools/` (no `.sh` extension) that reads front matter across `doc/decisions/*.md` and emits a deterministic Markdown index plus a health subsection. The index replaces the current hand-maintained `00-index.md` (columns: ID, Type, Title, Status, Date, Owners). The health report flags: **overdue reviews** (`review_date` in the past or past `last_updated` + a configured horizon), **missing deciders** (Accepted R2/R3 without `governance.decider`), **missing metrics** (records lacking `links.metrics`/verification criteria where expected), and a **future-field-aware waiver dimension** (reports open/expired temporary waivers **only where** a waiver/expiry field exists — none today, so this dimension is defined but currently empty). Output is **byte-stable** for the same input set (sorted, stable formatting). Supports `--help`, `--version`, `--dry-run`, semantic exit codes, and a testable main guard; tested at `tools/.tests/test-generate-decision-index.sh`.

**F-5 — `/decision-index` command.** A thin command that invokes `generate-decision-index` and is **read-only with respect to records** (it regenerates the index artifact only; it never mutates decision records). It is invocable by `@decision-advisor` (e.g., after authoring/reviewing a decision) or directly by a user/agent. Authored/tuned via the normal `.opencode/` flow.

**F-6 — CI gate.** A **new** job in `.github/workflows/ci.yml` (alongside the preserved `verify-claude-build` job) gated on PRs touching `doc/decisions/` or `schemas/` (and the tools themselves). It runs `validate-decision-record` over `doc/decisions/*.md` plus schema self-validity, and runs `generate-decision-index` as an **index-drift check** (regenerate `00-index.md` and fail if it differs from the committed copy). Failures block merge. Per SD-3, the planning-summary validator is **not** CI-gated over live docs (its correctness is proven by synthetic fixtures in `tools/.tests/`).

**F-7 — Backward-compatible migration linter.** Mode of `validate-decision-record` (or a dedicated lint mode) that treats un-classified records as rigor **R2** by default, treats all optional blocks as absent-allowed, and emits **warnings rather than errors / rewrites** for legacy shapes (research §30.4). Existing records are never rewritten; new fields are recommended when a record is next superseded or materially reviewed.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Local validation before commit:
  Author (or @decision-advisor) authors/edits doc/decisions/<TYPE>-<n>-<slug>.md
    → runs `tools/validate-decision-record <file>` (or whole dir)
    → validator reports actionable errors (field, rule, remediation)
    → author fixes; re-runs until exit 0; commits

Flow 2 — Index regeneration (read-only):
  @decision-advisor (after /write-decision or /review-decision) or a user runs
    /decision-index   →   generate-decision-index reads doc/decisions/*.md
    → regenerates 00-index.md (deterministic) + health report
    → records are NOT mutated; only the index artifact changes

Flow 3 — CI gate on PR:
  PR touches doc/decisions/ or schemas/ (or the tools)
    → new CI job runs validate-decision-record (front matter + cross-field)
       over doc/decisions/*.md + schema self-validity
    → runs generate-decision-index drift check on 00-index.md
    → any validation failure OR index drift → build fails, merge blocked
    → verify-claude-build job runs unchanged alongside

Flow 4 — Planning-summary validation (on demand, not CI-gated):
  /plan-decision emits <decision_planning_summary> (or legacy alias) → /write-decision
    → validate-decision-record can validate the summary on demand (by command or directly)
    → correctness proven by synthetic fixtures under tools/.tests/ (SD-3); not run over live docs in CI
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- `schemas/decision-record-frontmatter.schema.json` documenting the landed GH-46 nested structure (SD-1), validated against ADR-0001 + the template (F-1).
- `schemas/decision-planning-summary.schema.json` for the generic + legacy alias blocks (F-2).
- `tools/validate-decision-record` (no `.sh`) implementing rigor-aware required fields, lifecycle validity, and the **in-scope §28.3 negative cases** (F-3). In-scope §28.3 cases:
  - invalid `decision_type`; invalid `status`;
  - impossible lifecycle transition (e.g., Accepted → Proposed) and `supersedes`/`superseded_by` inconsistency;
  - missing `owners`; missing `governance.decider` when `status=Accepted` AND `classification.rigor ∈ {R2,R3}`; missing `decision_date` when `status=Accepted`;
  - `classification.rigor = R3` without `governance.reviewers` (acceptance-gated: only when `status=Accepted`);
  - same factor as both a constraint and a driver (`planning-summary hard_requirements ∩ decision_drivers ≠ ∅`);
  - non-negotiable-constraint violation in the chosen option (planning-summary, **best-effort** using available compliance data);
  - accepted decision without verification criteria (**best-effort body-section presence heuristic** — `## Verification Criteria` non-empty for Accepted records; documented as a heuristic, not a structural guarantee).
- `tools/generate-decision-index` (no `.sh`) regenerating `doc/decisions/00-index.md` deterministically + health report (F-4).
- `/decision-index` command, read-only w.r.t. records (F-5).
- A **new** CI job (alongside `verify-claude-build`) running both tools on PRs touching `doc/decisions/` or `schemas/` (F-6).
- Backward-compatible migration linter: default rigor R2 when classification absent; warnings, never rewrites (F-7).
- Tests under `tools/.tests/` with positive/negative + synthetic planning-summary fixtures.

### 7.2 Out of Scope

- [OUT] Domain decision-driver catalogs/checklists (NG-1).
- [OUT] Structured evidence ledger and R3 source verification (NG-2 / GH-65).
- [OUT] Verifier/retrospective lifecycle agents/commands (NG-3 / GH-64).
- [OUT] A custom runtime/language ecosystem (NG-4).
- [OUT] Enforcing body-section **order** beyond today's grep checks (NG-5).
- [OUT] A waiver/expiry front-matter field (NG-6) — "expired waiver" detection is future-field-aware.
- [OUT] Destructive migration/backfill of historical records (NG-7).

### 7.3 Deferred / Maybe-Later

- **D-1 (§28.3 deferred — "recommendation copied into final decision without authority")**: body-content recommendation/decision separation; owned by sibling GH-64.
- **D-2 (§28.3 deferred — "R3 without evidence verification")**: requires the evidence ledger; owned by sibling GH-65.
- **D-3 (§28.3 deferred — "expired waiver")**: requires a landed waiver/expiry field; deferred until a sibling (likely GH-65) introduces it.
- **D-4 (§28.3 deferred — "modification of immutable accepted rationale without supersession")**: requires snapshot/diff machinery; owned by sibling GH-64.
- **D-5**: A future `--strict` mode that promotes best-effort heuristics (verification-criteria presence, non-negotiable-violation) to hard errors once downstream machinery lands.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface. The deliverables are JSON Schemas, two `tools/` CLIs, one `.opencode/` command, and a CI job.

### 8.2 Events / Messages

N/A — no event/message contracts.

### 8.3 Data Model Impact

The primary data-model artifact is the **schema-fields table** (DM-1), which is the canonical, machine-readable field model for the landed GH-46 front matter (per SD-1).

**DM-1 — Front-matter field model (nested, GH-46-landed).**

| Field | Type | Required | Valid values / notes |
|-------|------|----------|----------------------|
| `id` | string | yes | Pattern `<TYPE>-<zeroPad4>`; `<TYPE>` ∈ {ADR,PDR,TDR,BDR,ODR}; matches filename |
| `decision_type` | enum | yes | `adr` \| `pdr` \| `tdr` \| `bdr` \| `odr` |
| `status` | enum | yes | `Proposed` \| `Under Review` \| `Accepted` \| `Deprecated` \| `Superseded` |
| `created` | date | yes | `YYYY-MM-DD` |
| `decision_date` | date \| null | yes (field); non-null when `status=Accepted` | `YYYY-MM-DD` or `null` pre-acceptance |
| `last_updated` | date | yes | `YYYY-MM-DD` |
| `summary` | string | yes | One-line summary |
| `owners` | array<string> | yes | minItems 1 |
| `service` | string | yes | Primary impacted service/domain |
| `decision_area` | enum \| null | optional | `architecture` \| `product` \| `business` \| `operations` \| `mixed` |
| `decision_scope` | enum \| null | optional | `repo` \| `product-line` \| `org` |
| `reversibility` | enum \| null | optional | `easy` \| `moderate` \| `hard` |
| `review_date` | date \| null | optional | `YYYY-MM-DD` |
| `business_impact` | string \| null | optional | Short impact statement |
| `customer_impact` | string \| null | optional | Short impact statement |
| `classification` | object | optional | If absent → default rigor R2 (DM-4) |
| `classification.domains` | array<string> | optional | e.g., `[architecture, security]` |
| `classification.archetype` | enum \| null | optional | selection \| design \| prioritization \| allocation \| policy \| standard \| threshold \| forecast_commitment \| experiment \| go_no_go \| exception_waiver \| incident_response \| negotiated_choice \| sunset_reversal |
| `classification.environment` | enum \| null | optional | `clear` \| `complicated` \| `complex` \| `chaotic` |
| `classification.rigor` | enum \| null | optional | `R0` \| `R1` \| `R2` \| `R3` (drives rigor-aware required fields) |
| `classification.reversibility` | enum \| null | optional | `easy` \| `moderate` \| `hard` |
| `classification.stakes` | enum \| null | optional | `low` \| `medium` \| `high` |
| `classification.urgency` | enum \| null | optional | `low` \| `medium` \| `high` |
| `classification.uncertainty` | enum \| null | optional | `low` \| `medium` \| `high` |
| `classification.blast_radius` | enum \| null | optional | `local` \| `team` \| `org` \| `customers` \| `market` |
| `classification.recurrence` | enum \| null | optional | `one-off` \| `recurring` |
| `governance` | object | optional | DACI decision rights |
| `governance.driver` | string \| null | optional | Coordinator |
| `governance.decider` | string \| null | required when `status=Accepted` AND `classification.rigor ∈ {R2,R3}` | Accountable authority |
| `governance.contributors` | array<string> | optional | Expertise/evidence providers |
| `governance.reviewers` | array<string> | required non-empty when `status=Accepted` AND `classification.rigor = R3` (acceptance-gated, like `decider`) | Required reviewers/agreers |
| `governance.performers` | array<string> | optional | Executors |
| `governance.informed` | array<string> | optional | Notified parties |
| `ai_assistance` | object | optional | Provenance; recommendation ≠ decision |
| `ai_assistance.used` | boolean | optional | AI used? |
| `ai_assistance.roles` | array<string> | optional | e.g., `[analyst, record-writer]` |
| `ai_assistance.external_data_shared` | boolean | optional | Data sent to external AI? |
| `ai_assistance.citations_verified` | boolean | optional | AI citations checked? |
| `ai_assistance.human_decider` | string \| null | optional | Authorized human decider |
| `ai_assistance.reviewers` | array<string> | optional | Human reviewers of AI output |
| `revisit_triggers` | array<string> | optional | Conditions to reopen |
| `links` | object | optional | All members are arrays; all optional |
| `links.related_changes` | array<string> | optional | workItemRef identifiers |
| `links.supersedes` | array<string> | optional | Decision IDs this record replaces |
| `links.superseded_by` | array<string> | optional | Decision IDs replacing this record |
| `links.spec` | array<string> | optional | Related spec paths |
| `links.contracts` | array<string> | optional | Related contract paths |
| `links.diagrams` | array<string> | optional | Related diagram paths |
| `links.decisions` | array<string> | optional | Related decision record IDs |
| `links.experiments` | array<string> | optional | Experiment IDs/docs |
| `links.metrics` | array<string> | optional | Metric IDs/docs (index "missing metrics" uses this) |
| `links.roadmap_items` | array<string> | optional | Roadmap item IDs/docs |

> Note: SD-1 — this nested model (as present in ADR-0001 and the template) is authoritative. The research §17 **flat** sketch (top-level `driver`/`decider`/`decision_domains`/`rigor_profile`/`specs`) is **not** adopted.

**DM-2 — Planning-summary field model.** The generic `<decision_planning_summary>` block plus the legacy `<technical_decision_planning_summary>` tag and `adr.*` field alias (per GH-46 back-compat). Carries the GH-60 `hard_requirements:` list distinct from `decision_drivers:`, plus decision identity (id, type, title, slug) and the classification/governance/AI-assistance inputs that `/write-decision` renders. Validated by synthetic fixtures under `tools/.tests/` (SD-3).

| ID | Element | Description |
|----|---------|-------------|
| DM-3 | Index output model | Columns for `00-index.md` (ID, Type, Title, Status, Date, Owners) + a deterministic **Health** subsection: overdue reviews, missing deciders, missing metrics, future-field-aware waivers |
| DM-4 | Default-rigor rule | When `classification` is absent → `classification.rigor` is treated as **R2** for validation purposes (DM-1, NFR-2); existing records never rejected for being un-classified |

### 8.4 External Integrations

N/A — no external APIs/services. Tools read local files only.

### 8.5 Backward Compatibility

- **Additive only.** The schemas and validator enforce rules against the *landed* GH-46 structure; all optional blocks may be absent. ADR-0001 and any un-classified record remain valid (classification optional; default rigor R2 — DM-4).
- **Planning-summary alias preserved.** The legacy `<technical_decision_planning_summary>` tag and `adr.*` fields remain accepted via the GH-46 alias mapping (no behavior change for legacy `/plan-decision` → `/write-decision` flows).
- **Non-destructive migration (§30.4).** The migration linter warns on legacy shapes; it never rewrites records. New fields are recommended when a record is next superseded or materially reviewed.
- **CI is additive.** The new gate runs alongside the existing `verify-claude-build` job; the existing job's role is unchanged.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Git-native, no proprietary runtime, no network calls, no secrets (ADR-0001 C-4) | 0 network calls; 0 secrets; 0 new runtime services; 0 proprietary-binary artifacts |
| NFR-2 | Backward compatibility | 100% of existing records valid; 0 destructive rewrites; legacy summary tag/fields accepted via alias; default rigor R2 when classification absent |
| NFR-3 | License headers via `scripts/add-header-location.sh` ONLY | 0 hand-added headers (AGENTS.md rule); `tools/` qualifies for the script |
| NFR-4 | Tools follow `doc/guides/tools-convention.md` + `.ai/rules/bash.md` | No `.sh` extension; `--help`/`--version`/`--dry-run`; semantic exit codes; testable main guard; embedded test framework; tests under `tools/.tests/` |
| NFR-5 | Deterministic index output | Byte-stable for the same input set (sorted, stable formatting) |
| NFR-6 | CI gate fails the build on validation/index drift; runs on PRs touching `doc/decisions/` or `schemas/` | 1 new job added; `verify-claude-build` preserved; any failure blocks merge |
| NFR-7 | Declarative↔imperative consistency | Validator tests assert **every** schema rule; schema-vs-validator coverage check passes; 0 uncovered rules |
| NFR-8 | Actionable validation errors | Every failure names the record + field + violated rule; non-zero exit on any failure |
| NFR-9 | Dependency-light runtime | Works on stock CI `python3` with **no** `jsonschema` pip install; `shellcheck` absence tolerated (not installed) |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — no runtime metrics/logs/traces/alerts. Observability here is **structural**: the generated index + health report (DM-3) provide a human/agent-readable view of corpus health (overdue reviews, missing deciders, missing metrics), and every validation failure is an actionable, scannable error (NFR-8). Validator/index logs use a stable context tag per `.ai/rules/bash.md` so CI output is scannable.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Declarative schema ↔ imperative validator drift (two encodings of one rule set) | M | M | NFR-7 — validator tests assert every schema rule + a schema-vs-validator coverage check; schema is docs/IDE SoT, validator is CI SoT | L |
| RSK-2 | Backward-compat break — validator rejects ADR-0001 or legacy planning summaries | M | L | ADR-0001 + template are validation fixtures; classification optional; default rigor R2 (DM-4); alias mapping (NFR-2) | L |
| RSK-3 | §28.3 "fails each negative case" vs deferred siblings — expectation gap | M | M | SD-2 explicit in-scope/deferred split; Appendix A disposition table with owning sibling (GH-64/GH-65); AC-GH63-7 asserts deferred cases are documented | L |
| RSK-4 | CI runtime lacks `jsonschema` (and `shellcheck` is absent) → validator can't depend on them | M | H | SD-4 stdlib-only validator (bash + python3/jq); no pip dep; tolerate `shellcheck` absence (NFR-9) | L |
| RSK-5 | Index non-determinism / false-positive drift breaks CI | M | M | NFR-5 deterministic output (sorted, stable); CI drift check compares byte-stable regeneration | L |
| RSK-6 | Best-effort heuristics (verification-criteria presence; non-negotiable-violation) create a false sense of enforcement | M | M | Documented explicitly as heuristics, not structural guarantees; conservative (warn/limited-scope); future `--strict` mode (D-5) deferred until machinery lands | M |
| RSK-7 | Path-filtered CI gate misses a change that should re-trigger (e.g., schema/tool change affecting records) | L | L | Gate keys on `doc/decisions/`, `schemas/`, and the tools themselves; conservative triggers | L |
| RSK-8 | Research-vs-landed mismatch (flat §17 vs nested GH-46) leads to a schema that rejects real records | M | M | SD-1 — schema derived from ADR-0001 + template (nested), not §17; AC-GH63-2 asserts nested model | L |

## 12. ASSUMPTIONS

- This is an engineering-repo; writes to `schemas/`, `tools/`, `tools/.tests/`, `.github/workflows/`, and `doc/decisions/00-index.md` are permitted under the profile-aware documentation-safety rules; no `doc/business/**` content is created.
- ADR-0001 and the decision-record template faithfully represent the landed GH-46 nested front-matter structure and are therefore the authoritative fixtures for the schema (SD-1).
- `python3` (≥ stdlib YAML-via-fallback/jq) and `jq` are available in CI; `shellcheck` and `jsonschema` are not, and the validator must not depend on either (NFR-9).
- Zero live `<decision_planning_summary>` instances persist under `doc/` (they are transient `/plan-decision` outputs), so the planning-summary validator's correctness is proven by synthetic fixtures rather than a CI pass over live docs (SD-3).
- `.opencode/` artifacts (`/decision-index`) are tuned via `@toolsmith` per AGENTS.md; this spec does not prescribe low-level editing mechanics.
- The local research basis under `.ai/local/decision-process/` is git-ignored; its §17 sketch is **superseded** by the landed nested structure (SD-1), and §28.3/§30 are used only as the negative-case and migration-linter basis.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-46 (merged, PR #62) | The landed nested front matter this change schemas and validates |
| Depends on | Decision-record template + feature-decision-records spec | Authoritative field model (SD-1) |
| Depends on | `doc/guides/tools-convention.md` + `.ai/rules/bash.md` | CLI conventions the new tools must follow |
| Depends on | `scripts/add-header-location.sh` | Sole permitted license-header mechanism (NFR-3) |
| Complementary | GH-57 (Definition of Ready, open) | A validator is the natural DoR enforcement point for decision records referenced by a change |
| Blocks (soft) | Sibling: "Domain decision-driver checklists" (GH-66) | Reuses this schema infra; owns catalog content |
| Blocks (soft) | Sibling: "Structured evidence ledger + R3 source verification" (GH-65) | Reuses this schema; owns "R3 evidence verification" + (likely) waiver/expiry field (D-2/D-3) |
| Consumed by | Sibling: "Decision verification & retrospective lifecycle" (GH-64) | Its overdue-review discovery comes from this ticket's index; owns rec/decision body separation (D-1) and immutable-rationale diff (D-4) |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Add a minimal waiver/expiry field now (to make "expired waiver" enforceable) or wait for GH-65? | §28.3 lists "expired waiver" but no field is landed; SD-2 defers it. The index waiver dimension is future-field-aware either way. | Decision needed: consult `@decision-advisor` — lean = wait for GH-65; revisit if a waiver need arises sooner |
| OQ-2 | Should `/plan-decision` or `/write-decision` invoke the planning-summary validator inline, or keep it on-demand only? | SD-3 makes the planning-summary validator non-CI-gated. | Decision needed: consult `@decision-advisor` — lean = on-demand + invokable by command; finalize command integration during delivery |

## 15. DECISION LOG

### Scope Decisions (PM-resolved: SD-1 … SD-4)

| ID | Decision | Rationale |
|----|----------|-----------|
| SD-1 | Schema source of truth = **GH-46-landed nested structure** (not the flat §17 research sketch) | The schema must validate the structure actually present in ADR-0001 and the template (`classification{}`, `governance{}`, `ai_assistance{}`, `revisit_triggers[]`, `links{}`); the §17 flat sketch (`driver`/`decider`/`decision_domains`/`rigor_profile`/`specs` at top level) would reject the dogfood record. Every field enumerated in DM-1. |
| SD-2 | **Split §28.3** into IN-SCOPE (10 cases expressible against landed artifacts), one HEURISTIC (verification-criteria presence), and DEFERRED (4 cases needing sibling machinery) | Resolves the tension between the AC "fails each negative case from §28.3" and the non-goals/out-of-scope that preclude the sibling machinery. Full disposition in Appendix A; deferred cases carry rationale + owning sibling (GH-64/GH-65). |
| SD-3 | **Planning-summary validation domain** — the `decision-planning-summary.schema.json` validates the generic + legacy alias blocks via **synthetic fixtures** under `tools/.tests/`; the CI gate runs **only** the front-matter validator over `doc/decisions/*.md` + schemas | Zero live planning-summary instances persist under `doc/`; the summary is a transient `/plan-decision` output. Keeping it out of CI avoids gating on artifacts that don't live in the repo, while fixture tests prove correctness. |
| SD-4 | **Runtime = stdlib-only, no `jsonschema` pip dependency** | CI `ubuntu-latest` `python3` lacks `jsonschema`; the ticket says "avoid a heavy runtime". The `*.schema.json` files (draft 2020-12) are the declarative SoT for docs/IDE/tooling; the validator encodes the same rules imperatively (bash + python3/jq). Drift is mitigated by NFR-7 (tests + coverage check). |

### Decision Log

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 (SD-1) | Adopt the GH-46-landed nested front-matter model for the schema | Validates the real dogfood record + template; rejects the flat §17 sketch | 2026-06-25 |
| DEC-2 (SD-2) | Split §28.3 into in-scope / heuristic / deferred | Satisfies "fails each negative case" for cases expressible against landed artifacts; defers the rest to owning siblings | 2026-06-25 |
| DEC-3 (SD-3) | Planning-summary validator proven by synthetic fixtures; not CI-gated over live docs | No live instances persist; keeps CI on repo-resident artifacts | 2026-06-25 |
| DEC-4 (SD-4) | Stdlib-only validator; declarative schema + imperative validator coupled by coverage check | Works in stock CI; avoids a heavy runtime; mitigates drift via NFR-7 | 2026-06-25 |
| DEC-5 | JSON Schema (draft 2020-12) for both schema files; bash + python3-stdlib/jq validator | Git-native, no proprietary runtime (NFR-1, NG-4) | 2026-06-25 |
| DEC-6 | New CI job **added alongside** `verify-claude-build` (not replacing it) | Preserves the existing plugin-idempotency gate; adds the decision-record gate | 2026-06-25 |
| DEC-7 | `generate-decision-index` regenerates the existing hand-maintained `00-index.md` deterministically; drift = CI failure | Makes the index a generated, auditable artifact (replaces hand-maintenance) | 2026-06-25 |
| DEC-8 | Default rigor **R2** when `classification` is absent | Un-classified records remain valid; additive only (DM-4, NFR-2) | 2026-06-25 |
| DEC-9 | `/decision-index` is read-only w.r.t. records; invokable by `@decision-advisor` or directly | Index/health view must never mutate decision records | 2026-06-25 |
| DEC-10 | Verification-criteria presence + non-negotiable-violation checks are **best-effort heuristics**, documented as such | Not structural guarantees without body-content/diff machinery (owned by GH-64) | 2026-06-25 |
| DEC-11 | "Expired waiver" detection is **future-field-aware**; deferred until a sibling (GH-65) lands a waiver/expiry field | No waiver/expiry field is landed today (NG-6) | 2026-06-25 |
| DEC-12 | The R3-reviewer rule is **acceptance-gated**: `governance.reviewers` is required non-empty only when `status=Accepted` AND `classification.rigor=R3` (mirroring the `decider` rule) | ADR-0001 is `Proposed` R3 with empty `reviewers: []` and must pass (AC-1/AC-4); review happens during Under Review→Accepted, so requiring reviewers at Proposed is wrong. §28.3 "R3 without review" = an Accepted R3 lacking reviewers. Resolves OQ-GH63-1. | 2026-06-25 |
| DEC-13 | Best-effort heuristics (verification-criteria presence; non-negotiable-violation) emit **non-blocking warnings (exit 0)**, never fail the build | A check that fails the build would be a structural guarantee, contradicting DEC-10 ("heuristic, not a structural guarantee"). Hard rules fail (non-zero); heuristics warn. Resolves OQ-GH63-3. | 2026-06-25 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `schemas/` directory | New — `decision-record-frontmatter.schema.json`, `decision-planning-summary.schema.json` |
| `tools/validate-decision-record` | New — stdlib-only validator CLI (front matter + cross-field + planning-summary) |
| `tools/generate-decision-index` | New — deterministic index generator + health report |
| `tools/.tests/test-validate-decision-record.sh` (+ fixtures) | New — positive/negative + synthetic planning-summary fixtures |
| `tools/.tests/test-generate-decision-index.sh` | New — determinism + health-report tests |
| `/decision-index` command (`.opencode/command`) | New — read-only index invocation *(tuned via `@toolsmith`)* |
| `.github/workflows/ci.yml` | Updated — new decision-record gate job; `verify-claude-build` preserved |
| `doc/decisions/00-index.md` | Becomes generated (deterministic) rather than hand-maintained |
| `doc/tools/<tool-name>.md` (per tool) | New — user guides per `tools-convention.md` |
| `doc/decisions/README.md` / `decision-records-management.md` | Updated — point to schemas/validator/index and the generated index |
| `doc/spec/features/feature-decision-records.md` | Updated — record the machine-enforcement layer (F-1..F-7) |

> Per `AGENTS.md`, `.opencode/` artifacts are modified through `@toolsmith`; license headers are applied only via `scripts/add-header-location.sh` (NFR-3). `tools/` scripts qualify for the header script.

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-GH63-1 | **Given** the new `schemas/` directory, **when** `decision-record-frontmatter.schema.json` is validated against the ADR-0001 dogfood record and the decision-record template, **then** both pass validation and the schemas exist for both front matter and planning summary. | F-1, F-2, NFR-2 |
| AC-GH63-2 | **Given** the front-matter schema, **when** its field model (DM-1) is read, **then** it documents the **landed GH-46 nested** structure (`classification{}`, `governance{}`, `ai_assistance{}`, `revisit_triggers[]`, `links{}`) and **not** the flat §17 research sketch. | SD-1, DEC-1, DM-1, F-1 |
| AC-GH63-3 | **Given** a `<decision_planning_summary>` block and a legacy `<technical_decision_planning_summary>`/`adr.*` block, **when** validated against the planning-summary schema, **then** both are accepted via the GH-46 alias mapping. | F-2, DM-2, NFR-2 |
| AC-GH63-4 | **Given** valid fixtures (ADR-0001, the template, and valid synthetic records), **when** `tools/validate-decision-record` runs, **then** it exits 0 and reports no errors. | F-3, NFR-2 |
| AC-GH63-5 | **Given** each IN-SCOPE §28.3 negative case (invalid decision_type; invalid status; impossible lifecycle transition incl. supersedes/superseded_by inconsistency; missing owners; missing decider for Accepted R2/R3; missing decision_date for Accepted; Accepted R3 without governance.reviewers (acceptance-gated); same factor as both constraint and driver; non-negotiable-constraint violation in the chosen option), **when** `tools/validate-decision-record` runs against a fixture exhibiting that case, **then** it fails with an actionable error naming the record, field, and violated rule. | F-3, NFR-8, SD-2, Appendix A, DEC-12 |
| AC-GH63-6 | **Given** an Accepted decision record whose body lacks a non-empty `## Verification Criteria`, **when** the validator runs, **then** it **warns** (non-blocking, exit 0) via the documented best-effort heuristic (clearly labeled as a heuristic, not a structural guarantee — per DEC-13, heuristics never fail the build). | F-3, DEC-10, DEC-13, RSK-6 |
| AC-GH63-7 | **Given** the §28.3 negative-case disposition (Appendix A), **when** the DEFERRED cases are read, **then** each (recommendation/decision separation → GH-64; R3 evidence verification → GH-65; expired waiver → future field / GH-65; immutable-rationale modification → GH-64) lists a rationale and the owning sibling ticket. | SD-2, DEC-2, Appendix A |
| AC-GH63-8 | **Given** CI's stock `ubuntu-latest` `python3` (no `jsonschema`) and no `shellcheck`, **when** `tools/validate-decision-record` runs, **then** it executes successfully using stdlib only — 0 pip installs and no dependency on `shellcheck`. | SD-4, DEC-4, F-3, NFR-9 |
| AC-GH63-9 | **Given** `tools/generate-decision-index`, **when** run twice against the same `doc/decisions/*.md` input set, **then** it produces byte-identical `00-index.md` output (deterministic). | F-4, DM-3, NFR-5 |
| AC-GH63-10 | **Given** `tools/generate-decision-index`, **when** it scans the corpus, **then** the health report flags overdue reviews, missing deciders (Accepted R2/R3 without `governance.decider`), missing metrics, and reports the future-field-aware waiver dimension (empty today). | F-4, DM-3, DEC-11 |
| AC-GH63-11 | **Given** the `/decision-index` command, **when** invoked by `@decision-advisor` or directly, **then** it regenerates the index and health report and does **not** mutate any decision record (read-only w.r.t. records). | F-5, DEC-9, NFR-1 |
| AC-GH63-12 | **Given** a PR that touches `doc/decisions/` or `schemas/`, **when** CI runs, **then** a **new** gate job executes both `validate-decision-record` and the `generate-decision-index` drift check, failures block merge, and the existing `verify-claude-build` job is preserved unchanged. | F-6, DEC-6, NFR-6 |
| AC-GH63-13 | **Given** the CI gate, **when** it runs, **then** it executes the front-matter validator over `doc/decisions/*.md` + schemas and the index drift check, and does **not** run the planning-summary validator over live docs (its correctness is proven by synthetic fixtures under `tools/.tests/`). | SD-3, DEC-3, F-6 |
| AC-GH63-14 | **Given** an un-classified decision record (no `classification` block), **when** the validator runs, **then** it treats rigor as default R2 and the record remains valid; the migration linter emits warnings and never rewrites the record. | F-7, DM-4, NFR-2 |
| AC-GH63-15 | **Given** the declarative `*.schema.json` files and the imperative validator, **when** the test suite runs, **then** every schema rule is asserted by at least one validator test and the schema-vs-validator coverage check reports 0 uncovered rules. | NFR-7, F-1, F-3 |
| AC-GH63-16 | **Given** the new tools, **when** inspected, **then** each follows `doc/guides/tools-convention.md` + `.ai/rules/bash.md`: no `.sh` extension; `--help`/`--version`/`--dry-run`; semantic exit codes; testable main guard; embedded test framework. | F-3, F-4, NFR-4 |
| AC-GH63-17 | **Given** the test suites, **when** run via `bash tools/.tests/test-validate-decision-record.sh` and `bash tools/.tests/test-generate-decision-index.sh`, **then** both pass. | F-3, F-4, NFR-4 |
| AC-GH63-18 | **Given** the new `tools/` scripts, **when** headers are applied, **then** license headers come exclusively from `scripts/add-header-location.sh` (tools qualify) and none are hand-added. | NFR-3 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

Deliver in coherent phases (detailed in the implementation plan): (1) author the two `*.schema.json` files from ADR-0001 + the template (SD-1) and the planning-summary alias model; (2) build `validate-decision-record` (stdlib-only) with the in-scope §28.3 rules + heuristics, plus positive/negative and synthetic planning-summary fixtures; (3) build `generate-decision-index` (deterministic) + its health report and tests; (4) add the `/decision-index` command (read-only) via `@toolsmith`; (5) add the new CI gate job alongside `verify-claude-build` with `doc/decisions/` and `schemas/` path filters, including the index drift check; (6) regenerate `doc/decisions/00-index.md` so it is in sync at merge; (7) apply license headers via `scripts/add-header-location.sh` only; (8) update the feature spec, `decision-records-management.md`, and `doc/decisions/README.md` to point at the schemas/validator/index. Merge as one change on the feature branch. Adoption is immediate for new/edited decision records; no destructive migration is performed (warnings only). Communication: note that `00-index.md` is now generated and that PRs touching `doc/decisions/` or `schemas/` are gated.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

Non-destructive. No records are rewritten. The migration linter warns on legacy shapes and recommends new fields when a record is next superseded or materially reviewed (research §30.4). `doc/decisions/00-index.md` is regenerated to be byte-consistent with the new generator at merge (it currently lists only ADR-0001). Default rigor R2 applies to un-classified records (DM-4).

## 20. PRIVACY / COMPLIANCE REVIEW

N/A for data flows. The tools read local Markdown/YAML/JSON only — no personal data is collected, stored, or transmitted, and no network calls are made (NFR-1). The validator/index do not surface secrets; the `ai_assistance` provenance block remains author-controlled. The change **strengthens** the framework's ability to record compliance/regulatory constraints (per GH-60) by making the records that carry them machine-checkable, but introduces no new privacy or compliance obligations.

## 21. SECURITY REVIEW HIGHLIGHTS

No new authentication, authorization, input-handling beyond local-file parsing, or secret-handling surfaces are introduced. Tools are read-only w.r.t. decision records (the index regenerates only `00-index.md`); they perform no network calls and use no secrets (NFR-1). CI additions run trusted, repo-local tooling on path-filtered changes. `security_impact` is rated **none** because the change codifies decision-record quality gates over local files and does not alter any system's access surface. Input-parsing hygiene (front-matter extraction) follows `.ai/rules/bash.md` (quote expansions, validate paths, no `eval`).

## 22. MAINTENANCE & OPERATIONS IMPACT

- The decision corpus becomes self-checking: malformed records fail at PR time, reducing review burden and silent drift.
- `00-index.md` moves from hand-maintained to generated, lowering ongoing maintenance and guaranteeing it stays current.
- The declarative schema is the documentation/IDE SoT; the imperative validator is the CI SoT; NFR-7's coverage check keeps them coupled so future field additions update both together.
- Future decision-lifecycle siblings (GH-64 verification/retro, GH-65 evidence ledger, GH-66 catalogs) have a stable schema/validator/index foundation to extend, and clear ownership of the deferred §28.3 cases (Appendix A).
- New tools carry their own docs (`doc/tools/<tool-name>.md`) and tests per `tools-convention.md`, so maintenance cost is localized and versioned independently.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| JSON Schema (draft 2020-12) | Declarative vocabulary for validating JSON/YAML structures; the declarative SoT for the front matter and planning summaries here |
| Rigor-aware required fields | Fields required only at a given `classification.rigor` (e.g., `governance.decider` for Accepted R2/R3; `governance.reviewers` for R3) |
| Default rigor R2 | When `classification` is absent, a record is treated as R2 for validation (DM-4) — never rejected for being un-classified |
| Index drift | A committed `00-index.md` that differs from what `generate-decision-index` would produce; a CI failure |
| Future-field-aware | A health/validator dimension defined now but currently empty because its backing field (e.g., waiver/expiry) is not yet landed |
| Best-effort heuristic | A check implemented from available data and clearly documented as not a structural guarantee (e.g., verification-criteria presence) |
| Landed nested structure | The GH-46 front-matter shape actually present in ADR-0001/template (nested `classification`/`governance`/`ai_assistance`/`links`), as opposed to the flat §17 research sketch |
| §28.3 negative cases | The validator rejection list from the research basis (Appendix A) |

## 24. APPENDICES

### Appendix A — §28.3 negative-case disposition (SD-2)

| # | §28.3 case | Disposition | Owner / AC |
|---|------------|-------------|------------|
| 1 | invalid record type | IN-SCOPE | F-3 / AC-GH63-5 |
| 2 | invalid status | IN-SCOPE | F-3 / AC-GH63-5 |
| 3 | impossible lifecycle transition (incl. supersedes/superseded_by consistency) | IN-SCOPE | F-3 / AC-GH63-5 |
| 4 | missing owner | IN-SCOPE | F-3 / AC-GH63-5 |
| 5 | missing decider for accepted R2/R3 | IN-SCOPE | F-3 / AC-GH63-5 |
| 6 | missing decision date for Accepted | IN-SCOPE | F-3 / AC-GH63-5 |
| 7 | recommendation copied into final decision without authority | DEFERRED | GH-64 (body-content rec/decision separation) |
| 8 | same factor as both constraint and driver | IN-SCOPE | F-3 / AC-GH63-5 |
| 9 | non-negotiable-constraint violation in chosen option | IN-SCOPE (best-effort) | F-3 / AC-GH63-5 |
| 10 | R3 without review (Accepted R3 without `governance.reviewers`) | IN-SCOPE | F-3 / AC-GH63-5 / DEC-12 |
| 11 | R3 without evidence verification | DEFERRED | GH-65 (evidence ledger / source verification) |
| 12 | accepted decision without verification criteria | IN-SCOPE (heuristic) | F-3 / AC-GH63-6 |
| 13 | expired waiver | DEFERRED | Future field (likely GH-65); no waiver/expiry field landed yet |
| 14 | modification of immutable accepted rationale without supersession | DEFERRED | GH-64 (needs snapshot/diff machinery) |

> Totals: **10 IN-SCOPE** (incl. 1 best-effort), **1 IN-SCOPE heuristic**, **4 DEFERRED** (each with rationale + owning sibling). This satisfies the ticket AC "fails each negative case from §28.3" for every case expressible against landed artifacts; the four deferred cases require sibling machinery explicitly listed as out-of-scope/non-goals.

### Appendix B — Runtime & CI constraints (verified against current repo)

- `python3` 3.14.4 and `jq` 1.8.1 are available; `shellcheck` is **not** installed → validator must not depend on `shellcheck` and must run on stdlib (SD-4, NFR-9).
- `schemas/` does **not** exist yet → created by this change.
- `doc/decisions/` today contains exactly one record (ADR-0001), the hand-maintained `00-index.md`, and `README.md`.
- `.github/workflows/ci.yml` has exactly one job (`verify-claude-build`); the decision-record gate is a **new** job, not a replacement (DEC-6).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-25 | @spec-writer | Initial specification for GH-63 authored from the GitHub issue (authoritative scope) and PM scope decisions SD-1 … SD-4 |

---

## AUTHORING GUIDELINES

- Authored from the GitHub issue GH-63 (authoritative scope: goals, non-goals, in/out-of-scope, and the 8-item acceptance checklist) and the PM-provided scope decisions SD-1 … SD-4 (authoritative resolutions of the ticket's internal tensions). No requirements were invented beyond the ticket; PM decisions were encoded faithfully in §15 and Appendix A.
- The landed front-matter structure was grounded in the actual current files — `doc/decisions/ADR-0001-decision-making-framework.md` (the dogfood record) and `doc/templates/decision-record-template.md` — **not** the research §17 flat sketch (per SD-1). Every field in DM-1 was verified against those files.
- The §28.3 negative-case list was read verbatim from `.ai/local/decision-process/ados-ai-driven-decision-intelligence-framework-spec.md` §28.3 and dispositioned against what is expressible on landed artifacts (Appendix A), with deferred cases mapped to their owning sibling tickets (GH-64/GH-65) per SD-2.
- Environment claims (python3 3.14.4, jq 1.8.1, no `shellcheck`, no `schemas/`, exactly one live record, CI has one job) were verified against the repo, not assumed.
- Kept at the what/why/behavior level — no implementation tasks, file-level edit instructions, or commit/git steps (those belong in the implementation plan). Artifact references use logical component names except where the ticket or convention fixes a concrete path (e.g., `schemas/...schema.json`, `tools/validate-decision-record`).
- Profile-aware doc safety applied: engineering-repo; writes confined to `schemas/`, `tools/`, `tools/.tests/`, `.github/workflows/`, `doc/decisions/`, `doc/tools/`, and feature/guide doc updates; no `doc/business/**`.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-63)
- [x] `owners` has at least one entry (`@cwiakalski`)
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (G-, NG-, F-, DM-, NFR-, RSK-, DEC-, SD-, OQ-, D-, AC-GH63-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR-/SD- ID and use Given/When/Then
- [x] NFRs include measurable values (0 pip installs, 100% records valid, 0 rewrites, byte-stable, 0 uncovered rules)
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths as edit instructions, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
- [x] PM scope decisions SD-1 … SD-4 encoded; §28.3 split fully documented (Appendix A)
