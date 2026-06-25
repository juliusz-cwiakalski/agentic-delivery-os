---
id: chg-GH-63-machine-enforceable-decision-records
status: Proposed
created: 2026-06-25T00:00:00Z
last_updated: 2026-06-25T00:00:00Z
owners: ["@cwiakalski"]
service: delivery-os
labels: [decision-records, tooling, ci, json-schema, validation]
links:
  change_spec: ./chg-GH-63-spec.md
summary: >
  Add the machine-enforceable layer for decision-record quality that GH-46
  deliberately deferred: two JSON Schema (draft 2020-12) documents under a new
  schemas/ directory — one for the landed GH-46 nested front matter, one for the
  planning summaries (generic + legacy alias); two PATH-able, stdlib-only CLI
  tools in tools/ (no .sh) — validate-decision-record (rigor-aware required
  fields, lifecycle validity, every in-scope §28.3 negative case, a documented
  verification-criteria heuristic) and generate-decision-index (deterministic
  00-index.md regeneration + a health report); a read-only /decision-index
  command (via @toolsmith); and a NEW CI job alongside verify-claude-build that
  gates PRs touching doc/decisions/ or schemas/ on validation + index drift. No
  jsonschema pip dependency; runs on stock CI python3 + jq. Version impact: none.
version_impact: none
---

# IMPLEMENTATION PLAN — GH-63: Machine-enforceable decision-record quality (JSON schemas, validator, index tool, CI gate)

## Context and Goals

This plan delivers the change specified in `chg-GH-63-spec.md`: the missing
machine-enforceable layer for the decision-record quality invariants that GH-46
(PR #62) established — "single source of truth for body structure", "R2/R3
require a decider + independent review", "no auto-Accept", "constraint/driver
overlap resolved", "non-negotiable constraint violations disqualify the chosen
option", "section-order consistency" — which today live only in agent prompts
and ad-hoc greps. This change turns them into **schema + validator + CI**, plus a
**generated, auditable** decision index with a health report.

The change is pure tooling + CI + docs — **no application source code, no new
runtime service, no secret, no network call** (NFR-1). It is the schema/discovery
foundation that the decision follow-up siblings build on: GH-64 (verification &
retrospective lifecycle) consumes this index; GH-65 (evidence ledger + R3 source
verification) and GH-66 (domain driver catalogs) reuse this schema.

This change introduces seven capabilities (spec F-1 … F-7), all routed through
**three tracks** per `AGENTS.md`:

- **Schemas + tools track:** `schemas/*.schema.json`; `tools/validate-decision-record`
  and `tools/generate-decision-index` (no `.sh`, per `doc/guides/tools-convention.md`);
  fixtures + tests under `tools/.tests/`.
- **`.opencode/` track (via `@toolsmith`):** the read-only `/decision-index` command;
  `.ados-claude/**` is GENERATED — regenerate via `scripts/build-claude-plugin.sh`,
  never hand-edit.
- **CI + docs track:** a NEW job in `.github/workflows/ci.yml` alongside
  `verify-claude-build`; `doc/decisions/00-index.md` becomes generated;
  `doc/tools/<tool>.md`, `doc/spec/features/feature-decision-records.md`,
  `doc/guides/decision-records-management.md`, `doc/decisions/README.md` updated.

All scope decisions are locked in the spec Decision Log (DEC-1 … DEC-11, encoding
the PM scope decisions **SD-1 … SD-4**) and the §28.3 negative-case disposition is
fixed in **Appendix A** (10 IN-SCOPE incl. 1 best-effort, 1 IN-SCOPE heuristic,
4 DEFERRED with owning siblings GH-64/GH-65). **This plan implements those
decisions; it does not re-decide them.** The two critical invariants are:

- **SD-1 / AC-GH63-2** — the schema is derived from the **GH-46-landed nested**
  structure actually present in `ADR-0001` and the template
  (`classification{}`, `governance{}`, `ai_assistance{}`, `revisit_triggers[]`,
  `links{}`), **not** the flat §17 research sketch (`driver`/`decider`/
  `decision_domains`/`rigor_profile`/`specs` at top level) — the flat sketch would
  reject the real dogfood record.
- **SD-4 / AC-GH63-8** — the validator runs on **stdlib only** (bash + python3
  and/or jq). CI's `ubuntu-latest` `python3` lacks `jsonschema`; `shellcheck` is
  not installed. The `*.schema.json` files are the declarative SoT for
  docs/IDE/tooling; the validator encodes the same rules imperatively, and
  **NFR-7 / AC-GH63-15** keep the two coupled via a schema-vs-validator coverage
  check (0 uncovered rules).

**Implementation note (front-matter parsing).** `python3` 3.14 ships **no** bundled
`yaml` module. The validator and the index generator must therefore extract the
record front matter (the YAML between the leading `---` fences) with a **stdlib-only
parser** — a focused python3 loader for the simple subset this front matter uses
(nested maps, lists, scalars, `null`) or jq-based extraction of known keys. This is
acceptable because the record front matter is a small, well-bounded YAML subset;
the parser's limitation must be documented in both tools. (Phases 2 and 4 own this.)

**Open questions** (delivery-level; both spec OQ-1/OQ-2 carry a recorded lean and
do NOT block delivery — the plan delivers the future-field-aware / on-demand shape
either way):

- **OQ-1 (waiver/expiry field now or wait for GH-65?).** No such field is landed
  today (NG-6). The index waiver dimension is **future-field-aware** regardless.
  Decision needed: consult `@decision-advisor` — lean = **wait for GH-65**; revisit
  only if a waiver need arises sooner. The plan delivers the dimension defined but
  currently empty (DEC-11).
- **OQ-2 (inline vs on-demand planning-summary validation?).** SD-3 makes the
  planning-summary validator **non-CI-gated** (zero live instances persist under
  `doc/`; correctness proven by synthetic fixtures). Decision needed: consult
  `@decision-advisor` — lean = **on-demand + invokable**; finalize command
  integration during delivery. The plan does NOT wire it into `/plan-decision` or
  `/write-decision` in this change (out of scope of GH-63's `.opencode/` work,
  which is limited to the read-only `/decision-index` command).

## Scope

### In Scope

- **F-1** — `schemas/decision-record-frontmatter.schema.json` (draft 2020-12)
  documenting the landed GH-46 nested structure (SD-1, DM-1), validated against
  ADR-0001 + the template.
- **F-2** — `schemas/decision-planning-summary.schema.json` (draft 2020-12) for the
  generic `<decision_planning_summary>` + the legacy
  `<technical_decision_planning_summary>`/`adr.*` alias (DM-2).
- **F-3** — `tools/validate-decision-record` (stdlib-only) enforcing DM-1 structural
  rules, rigor-aware required fields, lifecycle validity, and every **in-scope §28.3
  negative case** (Appendix A), plus the verification-criteria **heuristic**; with
  **actionable** errors; `--help`/`--version`/`--dry-run`, semantic exit codes.
- **F-4** — `tools/generate-decision-index` (deterministic) regenerating
  `doc/decisions/00-index.md` (DM-3 table) + a Health subsection (overdue reviews,
  missing deciders, missing metrics, future-field-aware waivers).
- **F-5** — `/decision-index` command (via `@toolsmith`); read-only w.r.t. records.
- **F-6** — a NEW CI job (alongside `verify-claude-build`) gated on `doc/decisions/`,
  `schemas/`, and the two tools; runs the validator + schema self-validity + index
  drift check; failures block merge.
- **F-7** — backward-compatible migration linter: default rigor **R2** when
  `classification` absent (DM-4); warnings, never rewrites.
- Tests under `tools/.tests/` (positive/negative + synthetic planning-summary
  fixtures) + the schema-vs-validator coverage check (AC-GH63-15).
- Doc updates: tool guides, feature spec, record-artifact guide, decisions README;
  `00-index.md` regenerated to be in sync at merge.

### Out of Scope

- [OUT] Domain decision-driver catalogs/checklists (spec NG-1 / GH-66).
- [OUT] Structured evidence ledger + R3 source verification (spec NG-2 / GH-65).
- [OUT] Verifier/retrospective lifecycle agents/commands (spec NG-3 / GH-64).
- [OUT] A custom runtime/language ecosystem (spec NG-4).
- [OUT] Enforcing the decision-record body-section **order** beyond today's grep
  checks (spec NG-5) — the template remains the single source of truth; the
  validator focuses on front matter + cross-field rules + planning-summary structure.
- [OUT] A waiver/expiry front-matter field (spec NG-6) — "expired waiver" detection
  is future-field-aware (deferred until a sibling — likely GH-65 — lands the field).
- [OUT] Destructive migration/backfill of historical records (spec NG-7) — additive
  only; warnings, never rewrites.
- [OUT] Wiring the planning-summary validator into `/plan-decision` or
  `/write-decision` (OQ-2 lean = on-demand; the `.opencode/` work here is limited to
  the read-only `/decision-index` command).
- [OUT] The four DEFERRED §28.3 cases (Appendix A #7, #11, #13, #14) — each needs
  sibling machinery; documented but NOT enforced by the validator (AC-GH63-7).

### Constraints

- **Stdlib-only runtime (SD-4, NFR-9).** Both tools run on bash + python3 and/or jq.
  **0** `pip install`; **no** `jsonschema` dependency; **no** `shellcheck` dependency
  (it is not installed). CI uses stock `ubuntu-latest` `python3`. No network calls,
  no secrets (NFR-1).
- **No bundled `yaml`.** `python3` 3.14 has no `yaml` module → a stdlib front-matter
  parser (focused subset loader / jq extraction). Documented limitation.
- **Two `tools/` CLIs follow the conventions.** Per `doc/guides/tools-convention.md`
  + `.ai/rules/bash.md`: no `.sh` extension; `chmod +x`; `--help`/`--version`/
  `--dry-run`/`--verbose`; semantic exit codes; testable main guard; embedded test
  framework; mockable wrappers; tests under `tools/.tests/`; docs at
  `doc/tools/<name>.md` (NFR-4, AC-GH63-16).
- **License headers via `scripts/add-header-location.sh` ONLY** (NFR-3, AC-GH63-18).
  AI agents MUST NEVER add headers by hand. `tools/` and `.opencode/command` qualify
  for the script; run it — do not hand-add (per `AGENTS.md`).
- **`.opencode/` edits go through `@toolsmith`** (per `AGENTS.md`). The
  `/decision-index` command is created/tuned via `@toolsmith`. `.ados-claude/**` is
  GENERATED — regenerate via `scripts/build-claude-plugin.sh`, commit source +
  generated together; never hand-edit.
- **CI is additive (DEC-6).** The new gate job runs ALONGSIDE `verify-claude-build`;
  the existing job's role is unchanged (AC-GH63-12).
- **Additive / non-destructive (NFR-2).** `classification` optional; default rigor R2
  when absent (DM-4); ADR-0001 and any un-classified record remain valid; 0 rewrites.
- **Determinism (NFR-5).** Index output is byte-stable for the same input set (sorted,
  stable formatting). Index drift = CI failure.
- **Commit per phase** via `@committer` (Conventional Commits); stage only the files
  belonging to that phase. **Version impact: none** — no version bump.
- **Profile-aware doc safety.** Engineering-repo; writes confined to `schemas/`,
  `tools/`, `tools/.tests/`, `.github/workflows/`, `doc/decisions/`, `doc/tools/`,
  and feature/guide doc updates; no `doc/business/**`.

### Risks

- **RSK-1** (Declarative schema ↔ imperative validator drift; spec M / M): *Delivery
  mitigation* — Phase 3 task 3.5 produces a schema-vs-validator coverage check that
  asserts **every** schema rule is exercised by ≥1 validator test (0 uncovered); the
  schema is the docs/IDE SoT, the validator is the CI SoT (NFR-7, AC-GH63-15).
  Residual L.
- **RSK-2** (Validator rejects ADR-0001 or legacy planning summaries; spec M / L):
  *Delivery mitigation* — ADR-0001 + the template are validation fixtures (Phase 3);
  classification optional; default rigor R2 (DM-4); legacy alias mapping (NFR-2);
  Phase 2 smoke-tests against the real ADR-0001. Residual L.
- **RSK-3** (§28.3 "fails each negative case" vs deferred siblings — expectation gap;
  spec M / M): *Delivery mitigation* — SD-2's explicit in-scope/heuristic/deferred
  split (Appendix A) with owning sibling per deferred case; the validator docs list
  what is enforced vs deferred (task 2.9); AC-GH63-7 asserts the deferred cases are
  documented. Residual L.
- **RSK-4** (CI runtime lacks `jsonschema` and `shellcheck`; spec M / H): *Delivery
  mitigation* — SD-4 stdlib-only validator; Phase 7 confirms no `pip install` and no
  `shellcheck` dependency; the job runs on stock `python3`. Residual L.
- **RSK-5** (Index non-determinism / false-positive drift breaks CI; spec M / M):
  *Delivery mitigation* — NFR-5 deterministic output (sorted, stable formatting);
  Phase 5 determinism test (two runs byte-identical); Phase 7 drift check compares
  byte-stable regeneration. Residual L.
- **RSK-6** (Best-effort heuristics create a false sense of enforcement; spec M / M):
  *Delivery mitigation* — the verification-criteria presence and non-negotiable-
  violation checks are documented explicitly as heuristics, not structural guarantees
  (DEC-10); conservative (warn/limited-scope); future `--strict` (D-5) deferred.
  Residual M.
- **RSK-7** (Path-filtered CI gate misses a change that should re-trigger; spec L / L):
  *Delivery mitigation* — the gate keys on `doc/decisions/**`, `schemas/**`, the two
  tools, and `ci.yml` itself (task 7.1). Residual L.
- **RSK-8** (Flat §17 vs nested GH-46 mismatch → schema rejects real records; spec M
  / M): *Delivery mitigation* — SD-1: schema derived from ADR-0001 + template (nested),
  not §17; Phase 1 task 1.4 cross-checks both fixtures against DM-1; AC-GH63-2 asserts
  the nested model. Residual L.

### Success Metrics

| Metric | Target |
|--------|--------|
| Decision-record invariants enforced by machine (schema + validator + CI) | All in-scope §28.3 cases blocked at PR time |
| Live records rejected after migration | **0** (ADR-0001 and un-classified records remain valid) |
| Validator runtime dependencies (non-stdlib) | **0** pip installs; works on stock CI `python3` |
| Index determinism | Byte-stable output for the same input set |
| CI jobs touched | **1 new** job added; `verify-claude-build` preserved unchanged in role |
| Declarative↔imperative coverage | Every schema rule asserted by ≥1 validator test; **0** uncovered rules |
| License headers hand-added | **0** (all via `scripts/add-header-location.sh`) |

## Phases

### Phase 1: Schemas — declarative source of truth (F-1, F-2)

**Goal**: Establish the two JSON Schema (draft 2020-12) documents encoding the landed
GH-46 nested front-matter model (DM-1, SD-1) and the planning-summary alias model
(DM-2). These are the declarative contracts Phases 2–4 encode imperatively and that
Phase 3 proves the validator covers.

**Tasks**:

- [ ] **1.1** Create the `schemas/` directory at repo root (does not exist today —
  Appendix B).
- [ ] **1.2** Create `schemas/decision-record-frontmatter.schema.json` (draft
  2020-12; `$schema: https://json-schema.org/draft/2020-12/schema`, `$id`, `title`,
  `description` citing SD-1). Encode the **nested** model from `ADR-0001` + the
  template per DM-1 — **not** the flat §17 sketch (AC-GH63-2):
  - Required top-level scalars: `id` (pattern `^(ADR|PDR|TDR|BDR|ODR)-\d{4}$`),
    `decision_type` (enum adr|pdr|tdr|bdr|odr), `status` (enum
    Proposed|Under Review|Accepted|Deprecated|Superseded), `created` (date),
    `decision_date` (date\|null; field required, non-null when status=Accepted — note
    as a documented cross-field rule), `last_updated` (date), `summary` (string),
    `owners` (array<string>, minItems 1), `service` (string).
  - Optional top-level scalars: `decision_area`, `decision_scope`, `reversibility`,
    `review_date`, `business_impact`, `customer_impact` (with their DM-1 enums/types).
  - Optional nested blocks with every field/type/enum from DM-1: `classification{}`
    (domains, archetype, environment, rigor R0–R3, reversibility, stakes, urgency,
    uncertainty, blast_radius, recurrence), `governance{}` (driver, decider,
    contributors, reviewers, performers, informed), `ai_assistance{}` (used, roles,
    external_data_shared, citations_verified, human_decider, reviewers),
    `revisit_triggers[]`, `links{}` (all members arrays).
  - Document cross-field rigor rules in the schema `description`/`$comment`
    (rigor-aware required fields, default R2) so the declarative SoT is self-describing.
- [ ] **1.3** Create `schemas/decision-planning-summary.schema.json` (draft 2020-12)
  validating the generic `<decision_planning_summary>` block AND the legacy
  `<technical_decision_planning_summary>` tag + `adr.*` field alias (GH-46 back-compat,
  DM-2). Carry the GH-60 `hard_requirements:` list **distinct** from
  `decision_drivers:`; `hard_requirements` items carry a `negotiable` (yes\|no) field
  to support the best-effort non-negotiable-violation check. Include decision identity
  (id, type, title, slug) + the classification/governance/ai-assistance inputs.
- [ ] **1.4** **Self-validity + conformance:** verify both files parse as valid JSON
  (`python3 -c "import json; json.load(open('schemas/<file>'))"` and `jq empty
  schemas/<file>` for each). Structurally cross-check the `ADR-0001` front matter and
  the template front matter against the front-matter schema field-by-field against
  DM-1 (full imperative validation lands in Phase 2). Confirm the schema documents the
  **nested** model with the five nested blocks present (AC-GH63-2) and **not** the flat
  §17 keys.

**Acceptance Criteria**:

- Must: AC-GH63-1 (both schemas exist; ADR-0001 + the template conform structurally to
  the front-matter schema).
- Must: AC-GH63-2 (schema documents the landed nested structure, not the flat §17
  sketch).
- Should: AC-GH63-3 (planning-summary schema accepts generic + legacy alias shapes —
  schema side; fixture proof in Phase 3).

**Files and modules**:

- `schemas/decision-record-frontmatter.schema.json` (new)
- `schemas/decision-planning-summary.schema.json` (new)

**Tests**:

- Both `*.schema.json` parse as valid JSON (`jq empty` + `python3 json.load`).
- A manual field-by-field cross-check confirms every ADR-0001/template front-matter key
  is permitted by the schema, and every DM-1 field is enumerated.
- The schema contains the nested `classification`/`governance`/`ai_assistance`/
  `revisit_triggers`/`links` blocks and no top-level flat `decider`/`driver`/
  `decision_domains`/`rigor_profile`/`specs` keys.

**Completion signal**: `feat(GH-63): add decision-record JSON schemas (front matter + planning summary)`

---

### Phase 2: validate-decision-record CLI (F-3, F-7) — stdlib-only

**Goal**: Deliver the stdlib-only validator CLI that enforces DM-1 structural rules,
rigor-aware required fields, lifecycle validity, every in-scope §28.3 negative case,
and the verification-criteria heuristic — with actionable errors. This phase builds
the tool + its user guide and smoke-tests it against the real `ADR-0001`; the
systematic §28.3 fixture suite lands in Phase 3.

**Tasks**:

- [ ] **2.1** Create `tools/validate-decision-record` (no `.sh` extension, `chmod +x`)
  following `doc/guides/tools-convention.md` + `.ai/rules/bash.md`: shebang; strict
  mode (`set -Eeuo pipefail`, `set -o errtrace`, `shopt -s inherit_errexit`,
  `IFS=$'\n\t'`); traps; settings section (`APP_NAME`, `APP_VERSION="1.0.0"`,
  `LOG_TAG="(validate-decision-record)"`, exit-code constants); mockable wrappers
  (`_jq`, `_python3`); leveled logging with the stable context tag; testable main
  guard; `--help`/`--version`/`--dry-run`/`--verbose`; semantic exit codes (0 success,
  1 general, 2 usage, 7 filesystem, …); config dir `~/.ai/validate-decision-record/`.
  (NFR-4, AC-GH63-16)
- [ ] **2.2** Implement a **stdlib-only front-matter parser**: extract the YAML
  between the leading `---` fences and convert to JSON for cross-field checks using
  **python3 stdlib (no `yaml` module — 3.14 ships none) and/or jq**. Use a focused
  loader for the simple subset this front matter uses (nested maps, lists, scalars,
  `null`) or jq-based extraction of known keys. **Document the parser's limitation in
  the tool + its guide.** (SD-4, NFR-9; see Context implementation note.)
- [ ] **2.3** Implement **DM-1 structural rules**: presence of all required top-level
  scalars; enum validity (`decision_type`, `status`); `id` pattern + filename match;
  date formats; `owners` minItems ≥ 1; nested-block field types/enums. (F-3)
- [ ] **2.4** Implement **rigor-aware required fields** (F-3): `decision_date` non-null
  when `status=Accepted`; `governance.decider` present when `status=Accepted` AND
  `classification.rigor ∈ {R2,R3}`; `governance.reviewers` non-empty when
  `status=Accepted` AND `classification.rigor = R3` (acceptance-gated per DEC-12 — ADR-0001
  is Proposed R3 with empty reviewers and must pass). Apply **DM-4 default rigor R2** when `classification` is
  absent (the record stays valid — never rejected for being un-classified; AC-GH63-14).
- [ ] **2.5** Implement **lifecycle validity** (in-scope §28.3 #2, #3): only permitted
  status transitions; `links.supersedes` / `links.superseded_by` mutual consistency
  (no orphaned references; no cycles).
- [ ] **2.6** Implement the remaining **in-scope §28.3 HARD-FAIL negative cases** against front
  matter + planning summary (AC-GH63-5, Appendix A): invalid `decision_type` (#1);
  missing `owners` (#4); planning-summary `hard_requirements ∩ decision_drivers ≠ ∅`
  (#8); R3 without `governance.reviewers` (#10) — acceptance-gated: only an **Accepted**
  R3 with empty reviewers is rejected (DEC-12). Every hard failure emits an
  **actionable** message naming the record, the offending field, and the violated rule,
  and returns a non-zero exit code (NFR-8).
- [ ] **2.7** Implement the **best-effort heuristic WARNINGS** (AC-GH63-6, DEC-10/DEC-13):
  (a) for Accepted records, check the body contains a non-empty `## Verification Criteria`
  section; (b) **non-negotiable-constraint violation in the chosen option** (#9, best-effort
  using available planning-summary compliance data). Both emit **non-blocking warnings
  (exit 0)** — never fail the build — labeled `[WARN]`/`[HEURISTIC]` explicitly as heuristics,
  not structural guarantees (a failing check would contradict DEC-10; future `--strict` is
  D-5, deferred). NOTE: #9 is a WARNING (AC-GH63-6), NOT a hard failure (red-team C1).
- [ ] **2.8** Implement the **backward-compatible migration linter mode** (F-7,
  AC-GH63-14): un-classified records default to R2 and remain valid; legacy shapes emit
  **warnings, never rewrites** (research §30.4). Expose via a mode/flag (e.g., `--lint`
  or auto-detect) so it never destructively edits a record.
- [ ] **2.9** Document the **deferred §28.3 cases** in the tool's `--help` output and
  the user guide (AC-GH63-7): list each deferred case with rationale + owning sibling
  (#7 recommendation/decision separation → GH-64; #11 R3 evidence verification → GH-65;
  #13 expired waiver → future field / GH-65; #14 immutable-rationale modification →
  GH-64), so users know what is **not** enforced.
- [ ] **2.10** Create `doc/tools/validate-decision-record.md` per tools-convention.md
  (Title + version, Overview, Requirements, Installation, Usage Examples, Configuration,
  Troubleshooting, CLI Reference, Changelog). Include the in-scope vs deferred §28.3
  table and the "00-index.md is generated by the sibling tool" cross-reference.
- [ ] **2.11** **Smoke-test against the real corpus:** run
  `tools/validate-decision-record doc/decisions/ADR-0001-decision-making-framework.md`
  → exit 0 (ADR-0001 is R3 Proposed; `governance.decider: null` is allowed
  pre-Accept). Run `--help`, `--version`, `--dry-run` → all behave per convention.
  Confirm **0** `pip install`, **no** `jsonschema`, **no** `shellcheck` dependency
  (AC-GH63-8) and **no** network call (NFR-1).
- [ ] **2.12** Apply the license header via `scripts/add-header-location.sh tools`
  (never hand-add; NFR-3, AC-GH63-18). (Phase 9 re-verifies.)

**Acceptance Criteria**:

- Must: AC-GH63-5 (each in-scope §28.3 case fails with an actionable error — rules
  implemented here; fixture proof in Phase 3).
- Must: AC-GH63-6 (verification-criteria heuristic, labeled as heuristic).
- Must: AC-GH63-7 (deferred cases documented with owning sibling).
- Must: AC-GH63-8 (stdlib-only; 0 pip installs; no shellcheck).
- Must: AC-GH63-14 (un-classified → default R2, valid; linter warns, never rewrites).
- Must: AC-GH63-16 (tools-convention + bash.md compliance).
- Should: AC-GH63-4 (ADR-0001 validates exit 0 — smoke; full positive fixtures in
  Phase 3); AC-GH63-18 (header applied via the script).

**Files and modules**:

- `tools/validate-decision-record` (new)
- `doc/tools/validate-decision-record.md` (new)

**Tests**:

- `tools/validate-decision-record --help` / `--version` / `--dry-run` behave per
  convention.
- `tools/validate-decision-record doc/decisions/ADR-0001-decision-making-framework.md`
  exits 0.
- `rg -n 'jsonschema|import yaml|shellcheck' tools/validate-decision-record` → 0
  matches.

**Completion signal**: `feat(GH-63): add validate-decision-record CLI (stdlib-only)`

---

### Phase 3: Validator fixtures + test suite + coverage check (F-3, F-2, F-7)

**Goal**: Prove the validator's correctness with a positive/negative fixture suite
covering every in-scope §28.3 case + synthetic planning summaries (generic + legacy
alias), and prove the declarative schema and the imperative validator are coupled
(NFR-7 / AC-GH63-15: 0 uncovered rules).

**Tasks**:

- [ ] **3.1** Create `tools/.tests/fixtures/` with **positive** fixtures: a
  synthetic/derivative of `ADR-0001` (valid), the template rendered to a concrete
  record (valid), and ≥1 valid synthetic record per rigor (R1/R2/R3) **including an
  un-classified record** (exercises default R2 — AC-GH63-14).
- [ ] **3.2** Create **negative** fixtures — one per in-scope §28.3 case (AC-GH63-5,
  Appendix A): invalid `decision_type`; invalid `status`; impossible lifecycle
  transition + a `supersedes`/`superseded_by` inconsistency; missing `owners`; missing
  `governance.decider` for an Accepted R2/R3 record; missing `decision_date` for an
  Accepted record; `classification.rigor = R3` without `governance.reviewers`;
  `hard_requirements ∩ decision_drivers ≠ ∅`; a non-negotiable-constraint violation in
  the chosen option.
- [ ] **3.3** Create **synthetic planning-summary fixtures** (AC-GH63-3): a valid
  generic `<decision_planning_summary>` block and a valid legacy
  `<technical_decision_planning_summary>` + `adr.*` alias block — both accepted by the
  validator/schema via the GH-46 alias mapping.
- [ ] **3.4** Create `tools/.tests/test-validate-decision-record.sh` per
  `.ai/rules/bash.md` (embedded test framework; behavior tests driving the tool
  binary): assert positive fixtures exit 0; assert each negative fixture exits non-zero
  with an actionable error containing the offending field + violated rule; assert the
  planning-summary generic + legacy alias are both accepted (AC-GH63-3); assert the
  un-classified record defaults to R2 and stays valid (AC-GH63-14); assert the
  verification-criteria heuristic fires for an Accepted record missing a non-empty
  `## Verification Criteria` (AC-GH63-6).
- [ ] **3.5** **Schema-driven coverage check** (AC-GH63-15, NFR-7, red-team M5): the
  coverage map is **generated from the schema, not hand-maintained**. The check parses
  `schemas/*.schema.json`, extracts the rule set (required keys, enums, patterns, minItems,
  nested `properties`), and asserts each extracted rule is exercised by ≥1 named fixture/TC.
  Emit a `--coverage` summary reporting **0 uncovered rules**. Because the rule list is
  derived from the schema at test time, adding a schema rule without a matching fixture
  fails the check automatically (no silent map drift). If any rule is genuinely N/A, mark
  it explicitly with rationale. (Avoid a tautological self-report — the rule set must come
  from the schema file, not from the validator's own internal list.)
- [ ] **3.6** Run `bash tools/.tests/test-validate-decision-record.sh` → all pass
  (AC-GH63-17).

**Acceptance Criteria**:

- Must: AC-GH63-4 (valid fixtures exit 0).
- Must: AC-GH63-5 (each in-scope negative case fails with an actionable error).
- Must: AC-GH63-3 (planning-summary generic + legacy alias accepted).
- Must: AC-GH63-6 (heuristic fixture fires).
- Must: AC-GH63-14 (un-classified → default R2, valid).
- Must: AC-GH63-15 (coverage check: 0 uncovered rules).
- Must: AC-GH63-17 (suite passes).

**Files and modules**:

- `tools/.tests/test-validate-decision-record.sh` (new)
- `tools/.tests/fixtures/` (new — positive, negative, planning-summary fixtures)

**Tests**:

- The suite itself is the test; the coverage artifact reports 0 uncovered rules.
- `bash tools/.tests/test-validate-decision-record.sh` exits 0.

**Completion signal**: `test(GH-63): add validate-decision-record fixtures and coverage suite`

---

### Phase 4: generate-decision-index CLI (F-4) — deterministic

**Goal**: Deliver the deterministic index generator that reads `doc/decisions/*.md`
front matter and emits a byte-stable `00-index.md` table + a Health subsection, and its
user guide. Smoke-tests determinism against the real corpus; formal proof in Phase 5.

**Tasks**:

- [ ] **4.1** Create `tools/generate-decision-index` (no `.sh`, `chmod +x`) per
  tools-convention + bash.md (same skeleton as the validator: strict mode, traps,
  settings section, mockable wrappers, leveled logging with context tag
  `(generate-decision-index)`, testable main guard, `--help`/`--version`/`--dry-run`/
  `--verbose`, semantic exit codes, config dir `~/.ai/generate-decision-index/`).
  (NFR-4, AC-GH63-16)
- [ ] **4.2** Reuse the **same stdlib-only front-matter parser** as the validator
  (factor it into a sourced helper or a shared extraction step) so both tools parse
  identically — no `yaml` module; jq/python3 stdlib (see Context implementation note).
- [ ] **4.3** Emit the **index table** (DM-3): columns ID, Type, Title, Status, Date,
  Owners; sorted deterministically (by type, then numeric id; fixed column widths /
  stable formatting; fixed trailing-newline convention) so output is **byte-stable** for
  the same input set (NFR-5, AC-GH63-9).
- [ ] **4.4** Emit the Health view, **split committed-vs-advisory per DEC-15** (red-team M1):
  - **Committed `00-index.md` Health (byte-stable, time-INDEPENDENT — written to the file):**
    missing deciders (Accepted R2/R3 without `governance.decider`); missing metrics (records
    lacking `links.metrics` / verification criteria where expected); future-field-aware waiver
    dimension (empty today — DEC-11).
  - **Advisory stdout/`--dry-run` Health (time-DEPENDENT — NEVER written to `00-index.md`):**
    overdue reviews (`review_date` in the past, or past `last_updated` + a named/documented
    horizon constant). Surfaced via `--summary`/default stdout, but excluded from the
    drift-checked committed artifact so calendar time cannot trip the CI gate (AC-GH63-12).
- [ ] **4.5** Implement `--dry-run` (print the generated committed index to stdout without
  writing `00-index.md`), `--summary` (emit the full health report incl. overdue to stdout),
  and a write mode that regenerates `doc/decisions/00-index.md` in place (table +
  time-independent health only) — the only record-adjacent file the tool mutates; it
  **never mutates decision records** (F-4, DEC-9). Preserve the existing license-header
  block at the top of `00-index.md`.
- [ ] **4.6** Create `doc/tools/generate-decision-index.md` per tools-convention.md.
  Note that `00-index.md` becomes a **generated** artifact and document the drift check
  (regenerate, diff, fail on difference — used by Phase 5/7).
- [ ] **4.7** **Smoke-test:** run `tools/generate-decision-index --dry-run
  doc/decisions/` → produces the `ADR-0001` row + an (empty) Health subsection; run
  twice → byte-identical output (AC-GH63-9); `--help`/`--version` work; no network
  calls (NFR-1).
- [ ] **4.8** Apply the license header via `scripts/add-header-location.sh tools`
  (NFR-3, AC-GH63-18).

**Acceptance Criteria**:

- Must: AC-GH63-10 (Health subsection flags overdue reviews / missing deciders /
  missing metrics / future-field-aware waivers).
- Must: AC-GH63-16 (tools-convention + bash.md compliance).
- Should: AC-GH63-9 (determinism smoke — two runs byte-identical; formal proof in
  Phase 5); AC-GH63-18 (header via the script).

**Files and modules**:

- `tools/generate-decision-index` (new)
- `doc/tools/generate-decision-index.md` (new)

**Tests**:

- `--dry-run doc/decisions/` lists the `ADR-0001` row and an empty Health subsection.
- Two consecutive `--dry-run` runs are byte-identical (`cmp`).
- `--help` / `--version` behave per convention.

**Completion signal**: `feat(GH-63): add generate-decision-index CLI (deterministic)`

---

### Phase 5: Index generator tests (F-4) — determinism + health

**Goal**: Formally prove determinism and the health report via a test suite with
health-report fixtures.

**Tasks**:

- [ ] **5.1** Create `tools/.tests/test-generate-decision-index.sh` per `.ai/rules/bash.md`
  (embedded test framework).
- [ ] **5.2** **Determinism test** (AC-GH63-9): run the generator twice against a
  fixture corpus in a temp dir; assert byte-identical output (`cmp`/`diff`).
- [ ] **5.3** **Health-report fixtures** (AC-GH63-10): build a temp fixture corpus
  containing an overdue-review record, a missing-decider Accepted R2/R3 record, a
  missing-metrics record, and (optionally) a synthetic waiver/expiry field to exercise
  the future-field-aware dimension; assert the Health subsection flags each correctly
  and that the waiver dimension is empty for the real corpus.
- [ ] **5.4** **Idempotency test:** regenerating an already-generated index yields no
  diff.
- [ ] **5.5** Run `bash tools/.tests/test-generate-decision-index.sh` → all pass
  (AC-GH63-17).

**Acceptance Criteria**:

- Must: AC-GH63-9 (determinism — byte-identical across runs).
- Must: AC-GH63-10 (health flags — formal fixture proof).
- Must: AC-GH63-17 (suite passes).

**Files and modules**:

- `tools/.tests/test-generate-decision-index.sh` (new)

**Tests**:

- The suite itself (determinism + health + idempotency).

**Completion signal**: `test(GH-63): add generate-decision-index determinism and health suite`

---

### Phase 6: /decision-index command + plugin regeneration (F-5) (`.opencode/` track, via `@toolsmith`)

**Goal**: Provide the read-only `/decision-index` command that wraps
`generate-decision-index`, invocable by `@decision-advisor` or directly, and keep the
generated Claude plugin in sync.

> **Routing note (per `AGENTS.md`)**: This artifact lives under `.opencode/command/`.
> The delivery agent (`@coder`) MUST delegate the edit to **`@toolsmith`** — it
> specializes in model-format-aware command design. Do not hand-edit. `.ados-claude/**`
> is GENERATED — regenerate via `scripts/build-claude-plugin.sh`, never hand-edit.

**Tasks**:

- [ ] **6.1** **Delegate to `@toolsmith`** to create `.opencode/command/decision-index.md`:
  a thin, **read-only w.r.t. records** wrapper that invokes `tools/generate-decision-index`
  (regenerates the index + health report). Document that it mutates **only** `00-index.md`
  and never decision records (F-5, DEC-9, AC-GH63-11). Invocable by `@decision-advisor`
  (e.g., after `/write-decision` or `/review-decision`) or directly.
- [ ] **6.2** Update `.opencode/README.md` inventory to add the `/decision-index` command
  (via `@toolsmith` / documentation track as appropriate).
- [ ] **6.3** Run `scripts/build-claude-plugin.sh` to regenerate `.ados-claude/**` from
  the `.opencode/` source (the new command becomes a skill directory via
  `transform_command_to_skill`). Commit source + generated together. Verify the plugin is
  in sync (generated-header comments name their source + regen command; new
  `decision-index` skill present; 0 stale references).
- [ ] **6.4** Apply license headers via `scripts/add-header-location.sh .opencode/command`
  (NFR-3).

**Acceptance Criteria**:

- Must: AC-GH63-11 (`/decision-index` regenerates the index + health report and does not
  mutate any decision record — read-only w.r.t. records).

**Files and modules**:

- `.opencode/command/decision-index.md` (new — via `@toolsmith`)
- `.opencode/README.md` (updated)
- `.ados-claude/**` (regenerated — DO NOT hand-edit)

**Tests**:

- The command file exists and invokes `generate-decision-index`; it declares read-only
  behavior w.r.t. records.
- `.ados-claude/` is regenerated and in sync (0 stale references); the `decision-index`
  skill is present.

**Completion signal**: `feat(GH-63): add /decision-index command and regenerate Claude plugin`

---

### Phase 7: CI gate — new job alongside verify-claude-build (F-6)

**Goal**: Add the new decision-record CI job, path-filtered, running the validator +
schema self-validity + the index drift check. Preserve `verify-claude-build` unchanged
in role (DEC-6).

**Tasks**:

- [ ] **7.1** Add a new job (e.g., `verify-decision-records`) to
  `.github/workflows/ci.yml` **ALONGSIDE** `verify-claude-build` (do NOT replace —
  DEC-6, NFR-6, AC-GH63-12). Trigger on the same `push` (`branches: [main, feat/**,
  fix/**]`) /   `pull_request` (`branches: [main]`) events, with a `paths` filter on
  `doc/decisions/**`, `schemas/**`, `doc/templates/decision-record-template.md`,
  `doc/spec/features/feature-decision-records.md`, `tools/validate-decision-record`,
  `tools/generate-decision-index`, `tools/.tests/**`, and `.github/workflows/ci.yml`
  (RSK-7; **red-team M4**: include the template + feature spec — they are the structural
  source of truth the schema is derived from (SD-1), so a template edit must re-trigger
  the gate).
- [ ] **7.2** In the job: checkout; `chmod +x` the two tools; run
  `tools/validate-decision-record` over `doc/decisions/*.md` (front matter + cross-field
  rules — AC-GH63-13); fail non-zero on any validation error.
- [ ] **7.3** **Schema self-validity:** assert both `schemas/*.schema.json` parse as
  valid JSON (python3 stdlib / `jq empty`) — fail otherwise.
- [ ] **7.4** **Index drift check** (AC-GH63-12/13): run `tools/generate-decision-index`
  to regenerate `00-index.md` to a temp output, `cmp`/`git diff` against the committed
  copy; fail if it differs (stale index). **Do NOT** run the planning-summary validator
  over live docs (SD-3/DEC-3).
- [ ] **7.5** Confirm `verify-claude-build` is **preserved unchanged** in role; confirm
  the new job uses **only** stock `python3` (no `pip install jsonschema`) and tolerates
  `shellcheck` absence (NFR-9, AC-GH63-8). **Red-team M3:** confirm neither tool performs
  a network call (no automatic version-check — DEC-14); extend the forbidden-dependency
  grep in `tools/.tests/test-validate-decision-record.sh` (TC-GH63-016) to also reject
  `curl`, `wget`, `_check_version`, and `raw.githubusercontent` in the tool sources.
- [ ] **7.6** **Belt-and-suspenders:** run the test suites
  (`bash tools/.tests/test-validate-decision-record.sh`,
  `bash tools/.tests/test-generate-decision-index.sh`) in the job (NFR-4).

**Acceptance Criteria**:

- Must: AC-GH63-12 (a PR touching `doc/decisions/` or `schemas/` runs a new gate job
  executing the validator + the index drift check; failures block merge; `verify-claude-
  build` preserved unchanged).
- Must: AC-GH63-13 (the gate runs the front-matter validator over `doc/decisions/*.md` +
  schemas + the index drift check, and does NOT run the planning-summary validator over
  live docs).

**Files and modules**:

- `.github/workflows/ci.yml` (updated — new job; `verify-claude-build` preserved)

**Tests**:

- The workflow YAML is valid (`python3 -c "import yaml..."` is NOT available — validate
  structurally / via `actionlint` if present, else a YAML-load via a stdlib-free check;
  at minimum confirm `verify-claude-build` is intact and the new job parses).
- On the current corpus (ADR-0001), the validator + drift check would pass; a
  deliberately-staled `00-index.md` would fail the drift check.

**Completion signal**: `ci(GH-63): add decision-record validation and index-drift gate`

---

### Phase 8: Regenerate index + documentation updates (spec reconciliation)

**Goal**: Bring `00-index.md` in sync with the generator at merge, and update the
feature spec, the record-artifact guide, and the decisions README to point at the
schemas/validator/index; note `00-index.md` is now generated. (doc-syncer-equivalent
reconciliation; the role's final-phase spec-reconciliation requirement.)

**Tasks**:

- [ ] **8.1** Run `tools/generate-decision-index doc/decisions/` to regenerate
  `doc/decisions/00-index.md` (currently lists only `ADR-0001`) so it is byte-consistent
  with the generator at merge (DEC-7, spec §19). Preserve the license header. Confirm no
  decision record was mutated — only `00-index.md`, a generated artifact (DEC-9).
- [ ] **8.2** Update `doc/spec/features/feature-decision-records.md`: record the
  machine-enforcement layer (F-1 … F-7) — add `schemas/`, `tools/validate-decision-record`,
  `tools/generate-decision-index`, `/decision-index`, and the CI gate to the Codebase
  Map / Capabilities; note `00-index.md` is now generated; bump `last_updated` and add
  `GH-63` to `links.related_changes`. (Spec reconciliation.)
- [ ] **8.3** Update `doc/guides/decision-records-management.md`: point at `schemas/`,
  `tools/validate-decision-record`, the generated index, and the CI gate; document how to
  run validation locally before commit (Flow 1).
- [ ] **8.4** Update `doc/decisions/README.md`: note `00-index.md` is now **generated**
  (do not hand-edit — regenerate via the tool / `/decision-index`); reference the
  validator and the index generator.
- [ ] **8.5** Cross-link the two new tool guides
  (`doc/tools/validate-decision-record.md`, `doc/tools/generate-decision-index.md`) and
  the `/decision-index` command from `AGENTS.md` Key References / commands table if the
  repo convention lists user-facing tools/commands there (tools qualify).

**Acceptance Criteria**:

- Should: AC-GH63-1/9/12/13 narrative supported (index in sync; docs point at the
  machine-enforcement layer). Spec reconciliation complete.

**Files and modules**:

- `doc/decisions/00-index.md` (regenerated)
- `doc/spec/features/feature-decision-records.md` (updated — spec reconciliation)
- `doc/guides/decision-records-management.md` (updated)
- `doc/decisions/README.md` (updated)
- `AGENTS.md` (Key References / commands table — optional, if convention applies)

**Tests**:

- A fresh `tools/generate-decision-index --dry-run doc/decisions/` matches the committed
  `00-index.md` (the Phase 7 drift check would pass).
- `feature-decision-records.md` references the schemas, validator, index generator,
  `/decision-index`, and the CI gate.

**Completion signal**: `docs(GH-63): regenerate decision index and document machine-enforcement layer`

---

### Phase 9: Verification sweep + finalize

**Goal**: Enforce the critical invariants — stdlib-only, determinism, backward-compat,
no hand-added headers, plugin in sync, declarative↔imperative coverage — confirm
`version_impact: none`, and walk all 18 ACs before review/PR (spec §18).

**Tasks**:

- [ ] **9.1** Run all test suites: `bash tools/.tests/test-validate-decision-record.sh`,
  `bash tools/.tests/test-generate-decision-index.sh`, and `bash scripts/test-all.sh`
  (the aggregator discovers both new suites) → all pass (AC-GH63-17).
- [ ] **9.2** **Stdlib-only confirmation** (AC-GH63-8, NFR-9): grep the two tools for
  any `jsonschema` / `import yaml` / `shellcheck` dependency → **0** matches; confirm no
  `pip install` in `.github/workflows/ci.yml`.
- [ ] **9.3** **Determinism confirmation** (AC-GH63-9): regenerate the index twice →
  byte-identical.
- [ ] **9.4** **Backward-compat confirmation** (AC-GH63-14, NFR-2): an un-classified
  record → default R2, valid; `ADR-0001` valid; **0** rewrites.
- [ ] **9.5** **License-header audit** (AC-GH63-18, NFR-3): confirm headers on
  `tools/validate-decision-record`, `tools/generate-decision-index`, and
  `.opencode/command/decision-index.md` came exclusively from
  `scripts/add-header-location.sh`; **0** hand-added.
- [ ] **9.6** **Plugin-sync confirmation:** `.ados-claude/**` is regenerated and in sync
  (the `verify-claude-build` gate passes); `rg` for stale references = 0.
- [ ] **9.7** **Coverage confirmation** (AC-GH63-15, NFR-7): the schema-vs-validator
  coverage check reports **0 uncovered rules**.
- [ ] **9.8** **Deferred-cases documentation confirmation** (AC-GH63-7): the validator
  docs + guide list each deferred §28.3 case with rationale + owning sibling
  (GH-64/GH-65).
- [ ] **9.9** **Spec reconciliation confirmation:** `feature-decision-records.md`
  reflects F-1 … F-7; confirm `version_impact: none` (no version bump).
- [ ] **9.10** **AC walk:** walk AC-GH63-1 … AC-GH63-18 against the artifacts and mark
  each satisfied (see the Task-to-AC coverage map). Hand off to review (`/review GH-63`).

**Acceptance Criteria**:

- Must: All AC-GH63-1 … AC-GH63-18 satisfied and traceable.
- Must: NFR-1 … NFR-9 satisfied.
- Should: system feature spec reconciled; `version_impact: none` confirmed.

**Files and modules**:

- No edits unless a drift/stale reference is found (then a corrective edit to the
  offending source via its track — schemas/tools, `.opencode/` via `@toolsmith`, or docs).

**Tests**:

- Full suite green (`scripts/test-all.sh` + both `tools/.tests/` suites).
- Final AC/NFR coverage matrix (every AC-GH63-* mapped to ≥ 1 phase task).

**Completion signal**: `docs(GH-63): finalize machine-enforceable decision-record quality`

---

### Phase 10: Code-Review Remediation (iteration 1)

**Goal**: Apply the `@reviewer` (phase 7, iteration 1) findings. The reviewer returned FAIL on
one MAJOR robustness bug + 3 non-blocking improvements. This phase remediates all four and
re-verifies, targeting PASS on iteration 2.

**Tasks**:

- [x] **10.1 (BLOCKING — reviewer #1, major):** Fix `tools/.lib/frontmatter.sh`
  `parse_value()` to handle YAML **flow maps** (`{}` empty → `{}`; `{k: v, ...}` → object),
  OR raise a caught, actionable parse error per the parser's documented contract (no silent
  mis-parse, no undocumented exit code). Make the `.links.*` and `.governance.*` `jq` access
  in `tools/validate-decision-record` `validate_record()` **null-safe**
  (`(.links // {}) | (.superseded_by // []) | length`) so a missing/wrong-typed field can
  never crash the tool. Add a positive fixture (`links: {}` empty-map record → exit 0) and a
  regression test asserting `links: {}` parses cleanly and never yields undocumented exit 5
  or a raw `jq` stack trace.
  *(Flow-map parsing added to `parse_value()` + `_split_flow()` now tracks `{}` nesting;
  parser's documented subset updated. `.links`/`.governance`/`.classification.rigor` access
  routed through new type-safe `_safe_nested_len`/`_safe_nested_str` helpers (`if type=="object"`
  guard — `// {}` alone does NOT protect against wrong-typed values, verified empirically).
  Positive fixture `ADR-9005-empty-links-flow-map.md` added; regression tests
  `test_valid_empty_links_flow_map_exit0` + `test_flow_map_never_crashes` assert exit 0 and
  no `jq:` trace. links:{} was exit 5 + `Cannot index string with string "superseded_by"`
  → now exit 0.)*
- [x] **10.2 (reviewer #2, minor):** Add `_check_date "$json" "$fname" "$id" "decision_date"`
  to `validate_record` (currently `created`/`last_updated`/`review_date` are date-checked but
  `decision_date` is only non-null-checked). Strengthen the **schema-driven coverage check
  (task 3.5)** to require a **rejecting** fixture per `pattern`/`enum` rule (assert the
  validator actually rejects a malformed value), not just fixture presence — closes the
  `decision_date` pattern tautology the red-team M5 / reviewer #2 flagged.
  *(`_check_date decision_date` added; format-violating value now rejected (ADR-9019 exits 1).
  Coverage check gained an enforcement-strength pass: for every pattern/enum rule it REQUIRES
  a `negative/` fixture and PROVES rejection by running the validator binary (positive→exit 0,
  negative→exit≠0) — drift-injection test confirmed it reports ENFORCEMENT_FAILURE. Added
  rejecting fixtures ADR-9019 (decision_date), ADR-9020 (created/last_updated/review_date),
  ADR-9021 (id pattern), ADR-9022 (classification.rigor). Declarative-only enums not in the
  validator's §28.3 scope moved to `na` with rationale (12 N/A). `--coverage` reports
  UNCOVERED:0, ENFORCEMENT_PROVEN:17.)*
- [x] **10.3 (reviewer #3, nit):** Remove the dead `_extract_title()` function from
  `tools/generate-decision-index` (title extraction is done inside the python `_build_rows`).
  *(Removed; confirmed title extraction lives in `_build_rows` python.)*
- [x] **10.4 (reviewer #4, nit):** Route the direct `jq` call in
  `tools/generate-decision-index` `_build_rows` through the `_jq` wrapper (mockability parity
  with the validator).
  *(`jq -nc ...` → `_jq -nc ...` in `_build_rows`; mockability parity with validator + `_render_table`.)*
- [x] **10.5:** Re-run `bash tools/.tests/test-validate-decision-record.sh`,
  `bash tools/.tests/test-generate-decision-index.sh`, `bash scripts/test-all.sh`, the
  `--coverage` summary (still 0 uncovered, now with enforcement-strength checks), and the
  index drift/determinism checks. Confirm ADR-0001 + PDR-0001 still validate clean and
  `00-index.md` is in sync. Confirm 0 new regressions.
  *(ALL GREEN: validate 35/35 (was 29), index 13/13, scripts/test-all all pass; coverage
  UNCOVERED:0 + ENFORCEMENT_PROVEN:17; ADR-0001 + PDR-0001 exit 0; index in sync + byte-identical
  across runs; 0 forbidden deps; headers re-applied via `scripts/add-header-location.sh tools`.)*

**Acceptance Criteria**:

- Must: `links: {}` (and nested flow maps) parse cleanly — never exit 5, never a raw `jq`
  stack trace (NFR-8 actionable errors; AC-GH63-4/AC-GH63-16).
  — **PASSED** (flow-map parser + type-safe nested accessors; `links: {}` now exit 0; tests
  `test_valid_empty_links_flow_map_exit0`, `test_flow_map_never_crashes` green; populated/nested
  flow maps `{k: v, {a: {b: 1}}}` verified to parse to objects.)
- Must: `decision_date` pattern enforced; coverage check asserts rejection, not just presence
  (AC-GH63-15, NFR-7).
  — **PASSED** (`_check_date decision_date` rejects format-violating values; coverage
  enforcement-strength pass PROVES rejection by running the validator; drift-injection test
  confirmed it catches a silently-accepted negative fixture; UNCOVERED:0 + ENFORCEMENT_PROVEN:17.)
- Should: dead code removed; `_jq` used consistently (AC-GH63-16, `.ai/rules/bash.md`).
  — **PASSED** (`_extract_title()` removed; `_build_rows` `jq` → `_jq`.)

**Files and modules**:

- `tools/.lib/frontmatter.sh`, `tools/validate-decision-record`, `tools/generate-decision-index`
- `tools/.tests/fixtures/` (new `links: {}` fixture; malformed `decision_date` fixture if not present)
- `tools/.tests/test-validate-decision-record.sh` (regression test + strengthened coverage assertion)

**Tests**:

- All suites re-green; new regression test for flow-map parsing; coverage check strengthened.

**Completion signal**: `fix(GH-63): review iteration-1 remediation (flow-map parsing, decision_date pattern, coverage strength)`

---

### Phase 11: Red-Team #2 Remediation (post-delivery)

**Goal**: Apply the `@red-team-coordinator` RT2 (SHIP-WITH-CONDITIONS) findings before PR. RT2 found no
Critical/blocking defects; one MAJOR spec↔code drift (an AC gap vs the ticket) + five minor hardening
items. All are small and high-value; address in-phase.

**Tasks**:

- [x] **11.1 (RT2 M1, MAJOR — AC-GH63-10 fidelity):** the ticket AC requires the index to report
  "**missing metrics**" (`links.metrics`), but the shipped `_health_independent` reports "missing
  verification criteria" (a body-section check). Implement the **missing-metrics** dimension in
  `tools/generate-decision-index`: flag **Accepted** records whose `links.metrics` is absent or empty
  (consistent with the acceptance-gated decider/VC rules; Proposed records are not flagged). Keep the
  validator's body-`## Verification Criteria` heuristic (AC-GH63-6) as-is — it is a separate signal.
  Update the index test that asserted "missing VC flagged in committed index" to assert "missing
  metrics flagged" (Accepted record with empty `links.metrics`); add a fixture if needed. Align
  `doc/decisions/00-index.md` (regenerate), the generator header comment, `doc/tools/generate-decision-index.md`,
  `doc/guides/decision-records-management.md`, `doc/decisions/README.md`, and the spec (AC-GH63-10, DM-3,
  DM-1 `links.metrics` note) so spec/code/docs agree on "missing metrics." (Decision: implement, not
  doc-reconcile, because the ticket AC explicitly requires "missing metrics.")
  *(Implemented: `_build_rows` now extracts `links.metrics` → `metrics_len`; `_health_independent` flags
  Accepted + `metrics_len==0` ("missing metrics"); `_render_health_committed` buckets "Missing metrics";
  header/`--help` comments updated; dead `has_vc` index computation removed. Test renamed to
  `test_health_missing_metrics_committed` (ADR-9202 Accepted + empty links.metrics flagged; Proposed
  ADR-9204 NOT flagged; old "Missing verification criteria" asserted absent). Spec AC-GH63-10/DM-3/DM-1
  now say "missing metrics (`links.metrics`)" + note the validator's AC-GH63-6 VC heuristic is distinct.
  `00-index.md` regenerated → Health now reads "Missing metrics". Validator body-VC heuristic untouched.)*
- [x] **11.2 (RT2 m1, minor — NFR-8):** a record with an opening `---` but no closing fence currently
  yields ~9 misleading cascade "required field missing" errors. Detect "opening fence present, closing
  fence absent" in `tools/.lib/frontmatter.sh` / `validate_record` and emit ONE actionable error:
  `"<file>: '---' opened but no closing '---' fence found."` Add a regression fixture + test.
  *(Added `_has_closing_fence` to `tools/.lib/frontmatter.sh`; `validate_record` calls it after the
  opening-fence check and emits one actionable error + early-return. Regression test
  `test_unclosed_frontmatter_one_error_exit1` generates the malformed file at runtime (the header script
  cannot safely process an unclosed front-matter block) and asserts exit 1 + the fence message + 0
  cascade "required field missing" errors. Was 9 cascade errors → now 1 actionable.)*
- [x] **11.3 (RT2 m2, minor):** `id_filename_match` uses unbounded prefix (`ADR-0001` matches
  `ADR-00010`). Tighten to require a boundary: `[[ "$fname" =~ ^${id}(-|\.md$) ]]`. Add a regression
  fixture (`id: ADR-0001` in `ADR-00010-foo.md` → reject).
  *(Tightened to `^${id}(-|\.md$)`; fixture `negative/ADR-00010-filename-prefix-collision.md`
  (`id: ADR-0001`) now rejected; test `test_filename_prefix_collision_rejected` green.)*
- [x] **11.4 (RT2 m3, minor — hardening):** `_check_date` validates format only (`2026-13-45` passes).
  Add `datetime.date.fromisoformat(val)` and fail on `ValueError` (aligns validator with the
  generator's date semantics). Add a rejecting fixture.
  *(After the format regex, `_check_date` runs `datetime.date.fromisoformat`; fixture
  `negative/ADR-9026-invalid-calendar-date.md` (`created: 2026-13-45`) now rejected; test
  `test_invalid_calendar_date_exit1` green; added to coverage-map `top.pattern.created`
  (ENFORCEMENT_PROVEN 17→18).)*
- [x] **11.5 (RT2 m4, minor — determinism defense-in-depth):** pin `LC_ALL=C` in
  `tools/generate-decision-index` `main()` (or prefix the `sort` calls) so byte-stability does not
  depend on runner locale.
  *(`export LC_ALL=C` pinned at the top of `main()`; test `test_determinism_locale_independent` proves
  byte-identical output across pl_PL.UTF-8 and C; this dev env is pl_PL.UTF-8.)*
- [x] **11.6 (RT2 m5, minor — NFR-8):** when an un-classified Accepted record is missing its decider,
  append to the error: `"(rigor defaulted to R2 because no 'classification' block is present — DM-4)"`
  so the R2 obligation is explained at the point of failure.
  *(Decider-missing error appends the DM-4 note when `has_classification == false`; fixture
  `negative/ADR-9027-accepted-unclassified-missing-decider.md` + test
  `test_accepted_unclassified_missing_decider_dm4_note` green; added to coverage-map
  `xrule.decider_when_accepted_r2r3`.)*
- [x] **11.7:** Re-run both suites + `--coverage` + drift/determinism; confirm ADR-0001 + PDR-0001
  still validate clean; confirm `00-index.md` regenerated and in sync; 0 new regressions.
  *(ALL GREEN: validate 39/39 (was 35), index 14/14 (was 13), scripts/test-all 5/5; coverage
  UNCOVERED:0 + ENFORCEMENT_PROVEN:18; ADR-0001 + PDR-0001 exit 0; index in sync (dry-run==committed)
  + byte-identical across runs + locale-independent; `links: {}` still exit 0 (no Phase-10 regression);
  0 forbidden deps; headers re-applied via `scripts/add-header-location.sh tools` (3 new fixtures).)*

**Acceptance Criteria**:

- Must: AC-GH63-10 now reports "missing metrics" (`links.metrics`) per the ticket AC; spec/code/docs agree. — **PASSED** (generator `_health_independent` flags Accepted + empty `links.metrics` as "missing metrics"; `00-index.md` Health reads "Missing metrics"; spec AC-GH63-10/DM-3/DM-1 + 3 user docs aligned; test `test_health_missing_metrics_committed` green.)
- Should: m1–m5 hardening in; suites green; determinism locale-independent. — **PASSED** (11.2 fence→1 error, 11.3 id-boundary, 11.4 calendar validity, 11.5 `LC_ALL=C` byte-identical across pl_PL.UTF-8/C, 11.6 DM-4 note; validate 39/39, index 14/14, scripts/test-all 5/5; UNCOVERED:0, ENFORCEMENT_PROVEN:18.)

**Completion signal**: `fix(GH-63): red-team-2 remediation (missing-metrics dimension, fence/id/date hardening, LC_ALL pin)`

---

## Deviation handling

- **If `@toolsmith` cannot be spawned** (precedent: GH-46/GH-60 delivery, where no
  task/subagent tool was available): apply the **`customize-opencode` skill** discipline
  directly to the `.opencode/command/decision-index.md` edit, and record the substitution
  in the Execution Log. This does **NOT** relax the "never hand-edit `.ados-claude/`"
  rule — that output is always regenerated via `scripts/build-claude-plugin.sh`.
- **If `@doc-syncer` is not spawned:** reconcile `doc/spec/features/*` inline (the spec
  files are normal-documentation track; direct edits are permitted) and note the inline
  reconciliation in the Execution Log (GH-46/GH-60 precedent).
- **If the front-matter YAML subset proves richer than the stdlib parser handles:** keep
  the parser strictly to the subset actually used by the landed records (nested maps,
  lists, scalars, `null`); reject-with-actionable-error on anything outside the subset
  rather than silently mis-parsing. Document the supported subset in both tools.
- **If the build script or headers script is unavailable:** STOP and surface the blocker;
  do not hand-author generated `.ados-claude/**` or hand-add license headers.

## Test Scenarios

| ID | Scenario | Phases | AC |
|----|----------|--------|----|
| TS-1 | Both `schemas/*.schema.json` exist, parse as valid JSON, and the front-matter schema conforms to ADR-0001 + the template | 1 | AC-GH63-1 |
| TS-2 | The front-matter schema documents the landed **nested** model (`classification`/`governance`/`ai_assistance`/`revisit_triggers`/`links`), NOT the flat §17 sketch | 1 | AC-GH63-2 |
| TS-3 | The planning-summary schema accepts both the generic `<decision_planning_summary>` and the legacy `<technical_decision_planning_summary>`/`adr.*` alias | 1, 3 | AC-GH63-3 |
| TS-4 | Valid fixtures (ADR-0001, template-rendered, synthetic per rigor) make `validate-decision-record` exit 0 | 2, 3 | AC-GH63-4 |
| TS-5 | Each in-scope §28.3 negative case fixture fails with an actionable error naming record + field + rule | 2, 3 | AC-GH63-5 |
| TS-6 | An Accepted record lacking a non-empty `## Verification Criteria` triggers the documented best-effort heuristic (labeled as a heuristic) | 2, 3 | AC-GH63-6 |
| TS-7 | The deferred §28.3 cases (#7→GH-64, #11→GH-65, #13→future/GH-65, #14→GH-64) are documented with rationale + owning sibling | 2, 9 | AC-GH63-7 |
| TS-8 | The validator runs on stock CI `python3` with 0 `pip install`, no `jsonschema`, no `shellcheck` | 2, 7, 9 | AC-GH63-8 |
| TS-9 | `generate-decision-index` produces byte-identical output across two runs on the same input set | 4, 5, 9 | AC-GH63-9 |
| TS-10 | The Health subsection flags overdue reviews, missing deciders, missing metrics, and the (empty) future-field-aware waiver dimension | 4, 5 | AC-GH63-10 |
| TS-11 | `/decision-index` regenerates the index + health report and mutates no decision record (read-only w.r.t. records) | 6 | AC-GH63-11 |
| TS-12 | A PR touching `doc/decisions/` or `schemas/` runs a NEW gate job (validator + index drift); failures block merge; `verify-claude-build` preserved | 7 | AC-GH63-12 |
| TS-13 | The CI gate runs the front-matter validator over `doc/decisions/*.md` + schemas + index drift, and NOT the planning-summary validator over live docs | 7 | AC-GH63-13 |
| TS-14 | An un-classified record defaults to R2 and stays valid; the migration linter warns, never rewrites | 2, 3, 9 | AC-GH63-14 |
| TS-15 | Every schema rule is asserted by ≥1 validator test; the coverage check reports 0 uncovered rules | 3, 9 | AC-GH63-15 |
| TS-16 | Both tools follow tools-convention + bash.md (no `.sh`; `--help`/`--version`/`--dry-run`; semantic exit codes; testable main guard; embedded test framework) | 2, 4 | AC-GH63-16 |
| TS-17 | Both test suites pass when run directly and via `scripts/test-all.sh` | 3, 5, 9 | AC-GH63-17 |
| TS-18 | License headers come exclusively from `scripts/add-header-location.sh`; none hand-added | 2, 4, 6, 9 | AC-GH63-18 |

## Task-to-AC coverage

| AC | Covered by tasks |
|----|------------------|
| AC-GH63-1 | 1.2, 1.3, 1.4 |
| AC-GH63-2 | 1.2, 1.4 |
| AC-GH63-3 | 1.3, 3.3, 3.4 |
| AC-GH63-4 | 2.11, 3.1, 3.4, 3.6 |
| AC-GH63-5 | 2.3, 2.4, 2.5, 2.6, 3.2, 3.4, 3.6 |
| AC-GH63-6 | 2.7, 3.4, 3.6 |
| AC-GH63-7 | 2.9, 8.3, 9.8 |
| AC-GH63-8 | 2.1, 2.2, 2.11, 7.5, 9.2 |
| AC-GH63-9 | 4.3, 4.7, 5.2, 9.3 |
| AC-GH63-10 | 4.4, 5.3 |
| AC-GH63-11 | 6.1 |
| AC-GH63-12 | 7.1, 7.4, 7.5 |
| AC-GH63-13 | 7.2, 7.3, 7.4 |
| AC-GH63-14 | 2.4, 2.8, 3.1, 3.4, 9.4 |
| AC-GH63-15 | 3.5, 9.7 |
| AC-GH63-16 | 2.1, 4.1 |
| AC-GH63-17 | 3.6, 5.5, 9.1 |
| AC-GH63-18 | 2.12, 4.8, 6.4, 9.5 |

**Coverage:** 18 / 18 acceptance criteria mapped to ≥ 1 concrete task. Every phase
(1–9) contributes to ≥ 1 AC; the validator (AC-GH63-5) and backward-compat
(AC-GH63-14) are the most distributed (Phases 2–3 / 9 and 2–3 / 9 respectively).

## Artifacts and Links

| Artifact | Location | Type | Track |
|----------|----------|------|-------|
| Change specification | ./chg-GH-63-spec.md | Spec | — |
| Implementation plan (this file) | ./chg-GH-63-plan.md | Plan | — |
| PM notes | ./chg-GH-63-pm-notes.yaml | Planning notes | — |
| Front-matter schema | `schemas/decision-record-frontmatter.schema.json` | New | Schemas |
| Planning-summary schema | `schemas/decision-planning-summary.schema.json` | New | Schemas |
| Validator CLI | `tools/validate-decision-record` | New | Tools |
| Validator tests + fixtures | `tools/.tests/test-validate-decision-record.sh`, `tools/.tests/fixtures/` | New | Tools |
| Index generator CLI | `tools/generate-decision-index` | New | Tools |
| Index generator tests | `tools/.tests/test-generate-decision-index.sh` | New | Tools |
| Validator user guide | `doc/tools/validate-decision-record.md` | New | Documentation |
| Index generator user guide | `doc/tools/generate-decision-index.md` | New | Documentation |
| `/decision-index` command | `.opencode/command/decision-index.md` | New | `.opencode/` (via `@toolsmith`) |
| Generated Claude plugin | `.ados-claude/**` | Regenerated | Generated (`scripts/build-claude-plugin.sh`) |
| CI workflow | `.github/workflows/ci.yml` | Updated (new job) | CI |
| Decision index | `doc/decisions/00-index.md` | Regenerated (now generated) | Documentation |
| Feature spec: decision records | `doc/spec/features/feature-decision-records.md` | Reconciled | Documentation |
| Record-artifact guide | `doc/guides/decision-records-management.md` | Updated | Documentation |
| Decisions README | `doc/decisions/README.md` | Updated | Documentation |
| Related (depends on) | GH-46 / PR #62 — landed nested front matter this change schemas/validates | Related change | — |
| Related (complementary) | GH-57 — Definition of Ready (open) | Related change | — |
| Blocks (soft) | GH-65 — Structured evidence ledger + R3 source verification (reuses schema; owns deferred §28.3 #11/#13) | Related change | — |
| Blocks (soft) | GH-66 — Domain decision-driver checklists (reuses schema infra) | Related change | — |
| Consumed by | GH-64 — Decision verification & retrospective lifecycle (consumes the index; owns deferred §28.3 #7/#14) | Related change | — |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-25 | plan-writer | Initial plan authored from `chg-GH-63-spec.md`; 9 phases across three tracks (schemas/tools, `.opencode/` via `@toolsmith`, CI + docs). AC coverage 1–18; SD-1 nested model, SD-2 §28.3 in-scope/heuristic/deferred split (Appendix A), SD-3 planning-summary-via-fixtures-not-CI, SD-4 stdlib-only. Open questions OQ-1 (waiver field → lean wait for GH-65) and OQ-2 (on-demand planning-summary validation) recorded with leans; neither blocks delivery. Front-matter stdlib-parser implementation note flagged for Phases 2/4. |
| 1.1 | 2026-06-25 | coder | Added Phase 10 (Code-Review Remediation iteration 1) per `@reviewer` findings (1 BLOCKING major + 3 non-blocking). No scope change to F-1..F-7; remediation-only (robustness + coverage-strength + dead-code/mockability nits). Coverage map: declarative-only enums moved to `na` with rationale (not validator-enforced per SD-2/NG-5) — honest reclassification, not a coverage reduction. |
| 1.2 | 2026-06-25 | coder | Added Phase 11 (Red-Team #2 Remediation) per RT2 findings (1 MAJOR + 5 minor). Remediation-only; no scope change to F-1..F-7. 11.1 (M1) replaced the "missing verification criteria" index dimension with "missing metrics" (`links.metrics`) — the ticket AC-GH63-10 literal requirement; validator body-VC heuristic (AC-GH63-6) left as a distinct signal. 11.2–11.6 hardening (unclosed-fence single-error, id/filename boundary, calendar-valid date, `LC_ALL=C` determinism, DM-4 decider note). 4 new fixtures + tests; ENFORCEMENT_PROVEN 17→18. Residual (out of scope here): `.opencode/command/decision-index.md` + `.ados-claude/` mirror still say "missing verification criteria" (`.opencode/` track is `@toolsmith`-owned; would require plugin regen) — flagged for a future `@toolsmith` pass. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| 1 | Complete | 2026-06-25 | 2026-06-25 | 5f35c44 | Schemas (front-matter nested DM-1 + planning-summary generic/legacy alias), draft 2020-12. jq+python parse OK; ADR-0001+template conform (only `source` header attr unknown, allowed via additionalProperties); 0 flat §17 keys. |
| 2 | Complete | 2026-06-25 | 2026-06-25 | a13ace5 | validate-decision-record CLI (stdlib-only); shared parser tools/.lib/frontmatter.sh; rigor-aware (acceptance-gated DEC-12), lifecycle, planning-summary overlap (hard-fail), heuristics (WARN/exit 0), migration lint, --coverage; ADR-0001 exit 0; 0 forbidden deps; headers via script. Incidental: script also added missing headers to tools/test-all.sh + tools/.tests/test-zclaude-unit (idempotent, mandated by task 2.12). |
| 3 | Complete | 2026-06-25 | 2026-06-25 | fa16063 | Fixtures (5 positive, 9 negative, 4 planning-summary) + coverage-map.json (47/47 rules, 0 uncovered, fixture-existence verified) + test-validate-decision-record.sh (28/28 PASS). Validator refinements: coverage_check enhanced (na registry + missing-fixture detection), _TOOLS_DIR typo fix, set -e guard. Stdlib-only verified (0 forbidden deps). |
| 4 | Complete | 2026-06-25 | 2026-06-25 | 5f3151b | generate-decision-index CLI (deterministic); reuses shared frontmatter.sh parser; DM-3 table sorted by type+id (byte-stable); DEC-15 health split verified (missing deciders/VC committed; overdue advisory-only); --dry-run/--summary/write modes; determinism PASS (cmp byte-identical); no forbidden deps; headers via script; doc guide added. |
| 5 | Complete | 2026-06-25 | 2026-06-25 | 7497777 | test-generate-decision-index.sh (13/13 PASS): determinism (byte-identical cmp), DEC-15 split (overdue advisory-only), health fixtures (missing decider/VC flagged, clean unflagged, waiver empty), idempotency (write×2 no-diff, dry-run==committed), table ordering (type+id), flags, byte-stability (no today-timestamp). Fixed _extract_preamble (no-op when file lacks a leading --- fence). Real-corpus determinism PASS. |
| 6 | Complete | 2026-06-25 | 2026-06-25 | 077cf1b | /decision-index command created (customize-opencode skill, sub for @toolsmith); read-only w.r.t. records, mutates only 00-index.md; dry-run/summary/write modes; .opencode/README inventory updated; build-claude-plugin.sh regenerated .ados-claude/skills/decision-index/ (20 skills; header names source+regen; 0 stale refs); headers via script (all 20 skipped — already present). |
| 7 | Complete | 2026-06-25 | 2026-06-25 | 4a69193 | verify-decision-records job added alongside verify-claude-build (preserved unchanged); path-filtered (dorny/paths-filter on decisions/schemas/template/feature-spec/tools/.lib/.tests/ci.yml); runs schema self-validity (jq empty), front-matter validator over doc/decisions/, index drift check (--dry-run vs committed 00-index.md), + both test suites. Stock python3 only (no pip); drift check verified (detects staleness, passes post-regen). TC-GH63-016 forbidden-dep test added (rejects curl/wget/_check_version/raw.githubusercontent/import yaml/jsonschema; comment-excluded; negative-control verified). YAML structurally valid. NOTE: committed 00-index.md not yet regenerated → drift check fails until Phase 8 regenerates it (by design). |
| 8 | Complete | 2026-06-25 | 2026-06-25 | 1445287 | 00-index.md regenerated (ADR-0001 + PDR-0001, empty Health; drift check PASSES); feature-decision-records.md updated (last_updated→2026-06-25, GH-63 in related_changes, machine-enforcement capability + codebase map rows); decision-records-management.md updated (generated-index note + Machine-Enforceable Quality section + local pre-commit Flow 1); decisions/README.md updated (Index+Validation section + tool-guide refs); AGENTS.md cross-linked (/decision-index command + both tool guides in Key References). No records mutated. |
| 9 | Complete | 2026-06-25 | 2026-06-25 | 0917957 | Verification sweep ALL GREEN: 9.1 suites (validate 29/29, index 13/13, scripts 5/5); 9.2 stdlib-only (0 jsonschema/yaml/shellcheck; 0 pip in ci.yml); 9.3 determinism (byte-identical cmp); 9.4 back-compat (ADR-0001 + unclassified-R2 valid, 0 rewrites); 9.5 headers via script on all 3 files; 9.6 plugin in sync (rebuild no-op); 9.7 coverage 0 uncovered; 9.8 deferred cases documented (9 GH-64/GH-65 refs); 9.9 spec reconciled, version_impact: none. AC-GH63-1/5/6/9/10/12/13/14/15/16/17/18 satisfied & traceable. Ready for /review GH-63. |
| 10 | Complete | 2026-06-25 | 2026-06-25 | 8e7e717 | Review iteration-1 remediation ALL GREEN. 10.1 flow-map parsing: `parse_value()` handles `{}`/`{k:v}` (+`_split_flow` tracks `{}`); `.links`/`.governance`/`.classification.rigor` access routed through type-safe `_safe_nested_len`/`_safe_nested_str` (`if type=="object"` guard — `// {}` alone does NOT catch wrong-typed values, proven empirically). links:{} was exit 5 + `Cannot index string "superseded_by"` → now exit 0. 10.2 `_check_date decision_date` added; coverage check gained enforcement-strength pass (REQUIRES a `negative/` fixture per pattern/enum rule + PROVES rejection by running the validator binary); drift-injection test confirmed it flags a silently-accepted negative. New fixtures: ADR-9005 (links:{}), ADR-9019 (decision_date), ADR-9020 (created/last_updated/review_date), ADR-9021 (id pattern), ADR-9022 (rigor enum). 12 declarative-only enums moved to `na` (not in validator §28.3 scope, SD-2/NG-5). `--coverage`: UNCOVERED:0, ENFORCEMENT_PROVEN:17. 10.3 dead `_extract_title()` removed. 10.4 `_build_rows` `jq`→`_jq`. 10.5 suites: validate 35/35 (was 29), index 13/13, scripts/test-all all pass; ADR-0001+PDR-0001 exit 0; index in sync + byte-identical; 0 forbidden deps; headers re-applied via `scripts/add-header-location.sh tools` (also back-filled missing headers on existing fixtures + test-generate-decision-index.sh, consistent with ADR-0001's `source:` convention). |
| 11 | Complete | 2026-06-25 | 2026-06-25 | (this commit) | Red-Team #2 remediation ALL GREEN. 11.1 (M1 MAJOR — AC-GH63-10 fidelity): index now reports "missing metrics" (`links.metrics`) not "missing verification criteria"; `_build_rows` extracts `metrics_len`; `_health_independent` flags Accepted + `metrics_len==0`; `_render_health_committed` "Missing metrics" buckets; header/`--help` updated; dead `has_vc` removed; spec AC-GH63-10/DM-3/DM-1 + 3 user docs + regenerated `00-index.md` aligned (Health reads "Missing metrics"); validator body-VC heuristic (AC-GH63-6) left as distinct signal. 11.2 `_has_closing_fence` (awk counts `---`≥2) in frontmatter.sh → unclosed fence now 1 actionable error (was ~9 cascade); test generates malformed file at runtime (header script cannot process unclosed fence). 11.3 `id_filename_match` tightened to `^${id}(-|\.md$)`. 11.4 `_check_date` adds `datetime.date.fromisoformat` (calendar validity). 11.5 `export LC_ALL=C` pinned in generator `main()` — byte-identical across pl_PL.UTF-8/C. 11.6 decider-missing error appends DM-4 note when un-classified. New fixtures: ADR-00010 (id/filename prefix collision), ADR-9026 (calendar date 2026-13-45), ADR-9027 (un-classified Accepted missing decider) — coverage-map updated (`top.pattern.created`, `xrule.decider_when_accepted_r2r3`); ENFORCEMENT_PROVEN 17→18. Suites: validate 39/39 (was 35), index 14/14 (was 13), scripts/test-all 5/5; UNCOVERED:0; ADR-0001+PDR-0001 exit 0; index in sync + byte-identical; `links:{}` still exit 0 (no Phase-10 regression); 0 forbidden deps; headers via script (3 new fixtures). |
