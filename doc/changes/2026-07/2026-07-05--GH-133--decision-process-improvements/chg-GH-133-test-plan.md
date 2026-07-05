---
id: chg-GH-133-test-plan
status: Proposed
created: 2026-07-05
last_updated: 2026-07-05
owners: [juliusz-cwiakalski]
service: delivery-os
labels: [change, priority:medium, docs, decision-system]
version_impact: "documentation / templates / agent-prompt change only — no application code; no runtime version impact"
summary: "Improve decision taxonomy (ADR/TDR boundary), decision-record template usability (tiered proportional rendering, no duplicate metadata), and technical-selection evidence with safe @external-researcher delegation."
links:
  change_spec: ./chg-GH-133-spec.md
  implementation_plan: ./chg-GH-133-plan.md
  ticket: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/133
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Improve decision taxonomy, template usability, and technical-selection evidence

## 1. Scope and Objectives

This change is a **documentation / template / agent-prompt** change — there is no application source code. Per `.ai/rules/testing-strategy.md`, the relevant test layers are **static/diff checks** (always), **content checks** (docs/templates: structural assertions, grep verification, manual traceability, Markdown/YAML review), and the two **automated shell guards** that protect repo invariants (`test-doc-distribution.sh` for the `ados_distribution` marker set, and `test-build-claude-plugin.sh` / the CI `.ados-claude/` drift check for the generated-plugin sync). Behavioral agent-prompt claims (delegation, labels, R1-default-local) are verified by a recorded demonstration run, not unit tests.

The core behaviors to protect:

- The decision taxonomy stays at five top-level prefixes; ADR vs TDR is disambiguated by a concrete boundary + tie-breaker, and specialized concerns route to `classification.domains` rather than new prefixes.
- The decision-record template is the single source of truth for the record body; it must render **proportionally** (R1 strict subset of R3), carry **no duplicate metadata** for new records, and separate **Recommendation** from **Authorized Decision**.
- Technical-selection evidence is bounded and evidence-grade (not a blind scorecard), with security controls (canonical source, as-of date + revisit trigger, data-minimization in delegation).
- `@decision-advisor` never uses the network directly; it delegates external evidence to `@external-researcher`, preserves FACT/ASSUMPTION/TO-CONFIRM labels, and defaults to local evidence for R1.
- Backward compatibility: the 6 pre-existing decision records are grandfathered (no migration), and the GH-63 relationship is documented.
- Repo invariants are preserved: `ados_distribution` markers stay valid; `.ados-claude/` is regenerated from `.opencode/`.

### 1.1 In Scope

- `doc/guides/decision-making.md`
- `doc/guides/decision-records-management.md`
- `doc/templates/decision-record-template.md`
- `.opencode/agent/decision-advisor.md`
- `.opencode/agent/external-researcher.md` (if behavior summary changes)
- `.opencode/README.md` (if agent behavior summary changes)
- `.ados-claude/**` (regenerated artifacts)
- The 6 grandfathered decision records (verifying they are **not** migrated)
- All 23 acceptance criteria from ticket GH-133

### 1.2 Out of Scope & Known Gaps

- No JSON schema / validator / CLI gate is built (that is GH-63 scope, which is **disregarded** per the owner directive — GH-133 defines the new front-matter contract; GH-63 must rebase if revived). There is therefore **no machine-enforced front-matter validation**; template conformance for new records is verified structurally and by manual review.
- No migration / rewrite pass over the 6 existing decision records.
- No change to `src/**`, `tools/**`, or `scripts/**` logic (only doc/template/agent-prompt edits + regenerated plugin). The two shell guards are **executed** as regression checks, not modified.
- Behavioral agent claims that depend on a live model run (FACT/ASSUMPTION discipline, delegation actually firing on a dependency-selection trigger) cannot be fully automated; they are verified by a recorded demonstration run (semi-automated).

## 2. References

- **Ticket** — [GH-133](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/133) (canonical source of the 23 acceptance criteria; the change spec is not yet authored — see Open Question OQ-1).
- **Change spec** — `./chg-GH-133-spec.md` (pending; this plan derives ACs directly from the ticket. The spec, when authored, must reconcile against this plan's AC mapping.)
- **Implementation plan** — `./chg-GH-133-plan.md` (pending).
- **PM notes** — `./chg-GH-133-pm-notes.yaml` (phased-commit plan, grandfathering decision, GH-63 disregard directive, tiered-model collapse decision).
- **Testing strategy** — `.ai/rules/testing-strategy.md` (canonical; docs/templates → static/diff + content checks; scripts → `scripts/.tests/test-*.sh`).
- **Decision process guide** — `doc/guides/decision-making.md`.
- **Decision record artifact guide** — `doc/guides/decision-records-management.md`.
- **Decision record template** — `doc/templates/decision-record-template.md` (single source of truth for the record body).
- **Agent prompts** — `.opencode/agent/decision-advisor.md`, `.opencode/agent/external-researcher.md`.
- **Repo rules** — `AGENTS.md` (doc-distribution marker rule; generated-plugin rule; license-header exclusion for `doc/changes/`).
- **Drift guards** — `scripts/.tests/test-doc-distribution.sh`, `scripts/.tests/test-build-claude-plugin.sh`, `.github/workflows/ci.yml` (`.ados-claude/` staleness gate).
- **Grandfathered records** — `doc/decisions/ADR-0001-*`, `ADR-0002-*`, `PDR-0001-*`, `PDR-0002-*`, `ODR-0001-*`, `TDR-0001-*`.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

The ticket defines 23 acceptance criteria (no formal `F-#`/`AC-#` numbering exists yet — they are referenced as `AC-01`…`AC-23` below, in ticket order). Every AC is mapped to one or more test scenarios; none are TODO.

| AC ID | Description (abbreviated) | TC ID(s) | Status |
|-------|---------------------------|----------|--------|
| AC-01 | ADR vs TDR boundary + rule-of-thumb + tie-breaker (prefer ADR when `reversibility=hard` or `blast_radius≥team`) | TC-DEC-001 | Covered |
| AC-02 | Specialized concerns (security/privacy/legal/data/AI/vendor/procurement/ML/UX) are `classification.domains`, not new types; ML + vendor/procurement + UX examples | TC-DEC-002 | Covered |
| AC-03 | Overlap guidance for pricing, infrastructure, data retention, security/privacy | TC-DEC-003 | Covered |
| AC-04 | Type-selection helper near the top of the template | TC-TPL-001 | Covered |
| AC-05 | Top-level `decision_area` + `reversibility` removed for new records; `classification.reversibility` canonical; no other duplicate fields without one-line justification | TC-TPL-002 | Covered |
| AC-06 | Tiered-default applicability model (rigor drives section set; type/archetype toggles enumerated add-ons; no full 2D matrix) | TC-TPL-003 | Covered |
| AC-07 | R1 required-section set unchanged or smaller than current | TC-TPL-004 | Covered |
| AC-08 | Recommendation separated from Authorized Decision | TC-TPL-005 | Covered |
| AC-09 | Decision rights, evidence/assumptions/unknowns, eligibility-first alternatives, rollback/reversal, structured post-decision review surfaced | TC-TPL-006 | Covered |
| AC-10 | Worked R1/R2/R3 rendering examples in template | TC-TPL-007 | Covered |
| AC-11 | Technical-selection evidence pack for framework/library/tool/vendor; bounded (top-N candidates, ~10 signal fields) | TC-EVI-001 | Covered |
| AC-12 | Canonical-source verification, as-of date + revisit trigger, delegation data-minimization; wire `ai_assistance.external_data_shared` | TC-EVI-002 | Covered |
| AC-13 | Warn against blind numeric scorecard; license compatibility is a human/R3 step | TC-EVI-003 | Covered |
| AC-14 | `@decision-advisor` delegates external evidence to `@external-researcher` (no direct network); recorded run demonstrates it on a dependency-selection trigger | TC-ADV-001, TC-ADV-004 | Covered |
| AC-15 | `@decision-advisor` preserves FACT/ASSUMPTION/TO-CONFIRM labels; refuses to invent maturity/adoption metrics | TC-ADV-002 | Covered |
| AC-16 | `@decision-advisor` defaults to local evidence + ASSUMPTION labels for R1; delegates only on explicit decider request | TC-ADV-003 | Covered |
| AC-17 | `@external-researcher` can produce a compact dependency-selection evidence pack (source links/confidence) OR existing prompt verified sufficient | TC-RES-001 | Covered |
| AC-18 | Pre-GH-133 records retain front-matter shape (grandfathered); template documents the policy | TC-COMPAT-001 | Covered |
| AC-19 | Relationship to unmerged GH-63 documented (GH-133 defines new contract; GH-63 rebases if revived) | TC-COMPAT-002 | Covered |
| AC-20 | R1 trigger renders a record omitting all R3-only sections (golden-output diff or worked example) | TC-TPL-008 | Covered |
| AC-21 | `.ados-claude/` regenerated when `.opencode/` changes | TC-GATES-001 | Covered |
| AC-22 | Changed redistributable docs keep valid `ados_distribution` | TC-GATES-002 | Covered |
| AC-23 | Relevant quality checks pass (doc distribution + generated-plugin drift) | TC-GATES-001, TC-GATES-002, TC-GATES-003 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No APIs or events are touched. The "interfaces" here are the **data-model front-matter blocks** already defined in the template (`DM-#` ids below are the template's own additive-block labels) and the **agent prompt contracts**.

| Interface ID | Element | TC ID(s) | Status |
|--------------|---------|----------|--------|
| DM-1 | `classification:` block (domains / archetype / conditions incl. `reversibility`, `blast_radius`) — the canonical location for `reversibility` after dedup | TC-TPL-002, TC-TPL-003, TC-DEC-002 | Covered |
| DM-2 | `governance:` block (DACI decision rights) | TC-TPL-006 | Covered |
| DM-3 | `ai_assistance:` block — incl. `external_data_shared` wired to the data-minimization rule | TC-EVI-002 | Covered |
| DM-4 | `revisit_triggers:` — incl. "dependency security advisory published" | TC-EVI-002 | Covered |
| DM-5 (new) | Removed top-level keys `decision_area` + `reversibility` for new records (negative interface — must not exist in the new-record skeleton) | TC-TPL-002 | Covered |
| AGT-1 | `@decision-advisor` prompt contract: no-network + delegation + label discipline + R1-default-local | TC-ADV-001..004 | Covered |
| AGT-2 | `@external-researcher` prompt contract: dependency-selection evidence pack capability | TC-RES-001 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

The ticket does not assign formal `NFR-#` ids. Non-functional concerns are encoded as ACs and non-goals; they are verified via the scenarios below rather than a separate NFR suite.

| Concern (informal) | How verified | TC ID(s) | Status |
|--------------------|--------------|----------|--------|
| Taxonomy stability (no new top-level prefixes) | Structural: exactly five prefixes ADR/PDR/TDR/BDR/ODR remain | TC-DEC-002 | Covered |
| Proportionality (R1 ≤ R3; R1 cycle ≤ 1 business day) | Structural: R1 section set is a subset; R1 omits R3-only sections | TC-TPL-004, TC-TPL-008 | Covered |
| Backward compatibility (no migration) | Diff: grandfathered records unchanged | TC-COMPAT-001 | Covered |
| Repo invariant: doc distribution | `test-doc-distribution.sh` | TC-GATES-002 | Covered |
| Repo invariant: generated-plugin sync | `test-build-claude-plugin.sh` + CI drift check | TC-GATES-001 | Covered |
| No direct network from `@decision-advisor` | Structural + behavioral | TC-ADV-001, TC-ADV-004 | Covered |

## 4. Test Types and Layers

Per `.ai/rules/testing-strategy.md`, this change maps to **static/diff checks** and **content checks** for `doc/**` + templates + `.opencode/**`, plus the two relevant automated shell guards. There is **no unit/integration/E2E** layer for this change (no app code) — those columns are marked N/A below.

| Layer | Applies? | Location / Mechanism |
|-------|----------|----------------------|
| Static/diff | Yes (always) | `git diff --check`; changed-file path/naming review |
| Content (structural) | Yes | `rg`/`grep` assertions over the changed docs/template/agent prompts |
| Content (manual) | Yes | Manual traceability vs AC; Markdown rendering; YAML front-matter syntax; link/path review |
| Automated shell guard — doc distribution | Yes | `bash scripts/.tests/test-doc-distribution.sh` |
| Automated shell guard — plugin build | Yes | `bash scripts/.tests/test-build-claude-plugin.sh` (and CI `.ados-claude/` staleness gate) |
| Unit / Integration / E2E | N/A | No application code in this change |
| Behavioral agent verification | Yes (semi-automated) | Recorded demonstration run (transcript) for delegation + label claims |

**Conventions** (from testing strategy):

- Prefer narrow, changed-module checks first.
- For docs/template-only changes with no matching automated test: require manual verification + `git diff --check`, and record evidence in this plan's execution log.
- `rg` is the repo-preferred search tool (see `AGENTS.md`); all `grep` checks below should be run with `rg` unless noted.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-DEC-001 | ADR vs TDR boundary, rule-of-thumb, tie-breaker | Regression | Important | High | AC-01 |
| TC-DEC-002 | Specialized concerns are `classification.domains` (ML/vendor/UX examples) | Regression | Important | High | AC-02 |
| TC-DEC-003 | Overlap guidance (pricing/infrastructure/data retention/security) | Regression | Important | Medium | AC-03 |
| TC-TPL-001 | Type-selection helper near top of template | Happy Path | Important | High | AC-04 |
| TC-TPL-002 | No duplicate metadata for new records | Corner Case | Critical | High | AC-05 |
| TC-TPL-003 | Tiered-default applicability (no 2D matrix) | Corner Case | Critical | High | AC-06 |
| TC-TPL-004 | R1 required-section set unchanged/smaller | Regression | Critical | High | AC-07 |
| TC-TPL-005 | Recommendation separated from Authorized Decision | Happy Path | Important | High | AC-08 |
| TC-TPL-006 | Decision rights / evidence-unknowns / eligibility-first / rollback / retro surfaced | Happy Path | Important | High | AC-09 |
| TC-TPL-007 | Worked R1/R2/R3 rendering examples present | Happy Path | Important | Medium | AC-10 |
| TC-TPL-008 | R1 render omits all R3-only sections | Corner Case | Critical | High | AC-20 |
| TC-EVI-001 | Bounded technical-selection evidence pack | Happy Path | Important | High | AC-11 |
| TC-EVI-002 | Security controls: canonical source, as-of date, data-minimization | Corner Case | Critical | High | AC-12 |
| TC-EVI-003 | Scorecard warning + license-as-human-step | Regression | Important | Medium | AC-13 |
| TC-ADV-001 | `@decision-advisor` delegates to `@external-researcher` (no network) | Regression | Critical | High | AC-14 |
| TC-ADV-002 | FACT/ASSUMPTION/TO-CONFIRM labels; no invented metrics | Regression | Important | High | AC-15 |
| TC-ADV-003 | R1 default-local rule | Corner Case | Important | High | AC-16 |
| TC-ADV-004 | Recorded delegation run on a dependency-selection trigger | Happy Path | Important | Medium | AC-14 |
| TC-RES-001 | `@external-researcher` evidence-pack capability | Happy Path | Important | Medium | AC-17 |
| TC-COMPAT-001 | Grandfathered records unchanged + policy documented | Regression | Critical | High | AC-18 |
| TC-COMPAT-002 | GH-63 relationship documented | Regression | Important | Medium | AC-19 |
| TC-GATES-001 | `.ados-claude/` regenerated (no plugin drift) | Regression | Critical | High | AC-21, AC-23 |
| TC-GATES-002 | Changed redistributable docs keep valid `ados_distribution` | Regression | Critical | High | AC-22, AC-23 |
| TC-GATES-003 | `git diff --check` clean + relevant shell guards pass | Regression | Critical | High | AC-23 |

### 5.2 Scenario Details

#### TC-DEC-001 - ADR vs TDR boundary, rule-of-thumb, tie-breaker

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-01
**Test Type(s)**: Manual (content), Semi-automated (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/decision-making.md`, `doc/guides/decision-records-management.md`
**Tags**: @docs, @decision-system

**Preconditions**:

- Taxonomy phase commit landed (phase 1 of the phased plan).

**Steps**:

1. Confirm both ADR and TDR scope descriptions exist with the ticket's anchor lists (boundaries/integration patterns/APIs/events for ADR; library/framework/tool/build-test-lint/pattern/migration/algorithm for TDR).
2. Confirm the rule-of-thumb questions are present verbatim or equivalent: "Will this constrain future system design across components or teams?" → ADR; "Is this mainly how we implement within an already-decided design?" → TDR.
3. `rg -n "tie-breaker|tie breaker" doc/guides/decision-making.md doc/guides/decision-records-management.md` and confirm the tie-breaker rule is present: **prefer ADR when `reversibility=hard` OR `blast_radius>=team` (≥ team); otherwise TDR**, and that it states `classification.conditions` (not the prefix alone) breaks the tie.
4. `rg -n "reversibility=hard|blast_radius|blast radius" doc/guides/` and confirm the tie-breaker context.

**Expected Outcome**:

- ADR/TDR boundary section, both rule-of-thumb questions, and the tie-breaker rule (with the `reversibility=hard` / `blast_radius≥team` triggers) are all present and mutually consistent across the process guide and the management guide.
- No contradiction (e.g., the management guide must not state a different tie-breaker).

**Acceptance threshold**: all four checks pass; the tie-breaker language is literally present (falsifiable).

---

#### TC-DEC-002 - Specialized concerns are `classification.domains`

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-02, DM-1
**Test Type(s)**: Manual (content), Semi-automated (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/decision-making.md`, `doc/guides/decision-records-management.md`
**Tags**: @docs, @decision-system

**Preconditions**:

- Taxonomy phase commit landed.

**Steps**:

1. Confirm a statement that specialized concerns (security, privacy, compliance, data, finance, legal, AI, UX, vendor, procurement) are **usually `classification.domains`, not new top-level record types**.
2. Confirm the three required overlap examples exist:
   - ML model selection → domain tag `ai/ml` (or `ai`) + `archetype: selection`; **no new type**.
   - vendor / procurement → domain tag `vendor` / `procurement`; **no new type**.
   - UX pattern library → domain tag `ux`; **no new type**.
3. `rg -n "classification.domains|classification\.domains|domains:" doc/guides/decision-making.md` and confirm domains is positioned as the extension mechanism.
4. Confirm the five top-level prefixes (ADR/PDR/TDR/BDR/ODR) are still the complete set — `rg -n "ADR|PDR|TDR|BDR|ODR" doc/guides/decision-records-management.md` shows no sixth prefix introduced.

**Expected Outcome**:

- The "domains, not new types" rule is stated; all three examples (ML, vendor/procurement, UX) are present; exactly five top-level prefixes remain.

**Acceptance threshold**: literal presence of the three examples + the "no new type" framing.

---

#### TC-DEC-003 - Overlap guidance (pricing / infrastructure / data retention / security-privacy)

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-03
**Test Type(s)**: Manual (content), Semi-automated (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/guides/decision-making.md`
**Tags**: @docs, @decision-system

**Preconditions**:

- Taxonomy phase commit landed.

**Steps**:

1. Confirm overlap rules exist for the four required pairs:
   - **pricing**: PDR if packaging/value proposition; BDR if revenue model/contracts/commercial policy.
   - **infrastructure**: ADR if system-shaping; ODR if operating an existing system.
   - **data retention**: BDR/ODR/ADR depending on primary driver.
   - **security/privacy/legal/data/AI/vendor**: usually domain tags plus the primary owning type.
2. `rg -n "pricing|infrastructure|data retention|retention" doc/guides/decision-making.md` and confirm the routing rules.

**Expected Outcome**:

- All four overlap rules present and routing to existing prefixes only.

**Acceptance threshold**: each of the four categories has an explicit routing rule.

---

#### TC-TPL-001 - Type-selection helper near top of template

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-04
**Test Type(s)**: Manual (content)
**Automation Level**: Manual
**Target Layer / Location**: `doc/templates/decision-record-template.md`
**Tags**: @docs, @template

**Preconditions**:

- Template phase commit landed (phase 2).

**Steps**:

1. Open `doc/templates/decision-record-template.md`.
2. Confirm a compact **type-selection helper** appears near the top (after the front-matter `---` and before/within the first body sections) — e.g., a short decision tree or table mapping the rule-of-thumb + tie-breaker to ADR/PDR/TDR/BDR/ODR.
3. Confirm it references the tie-breaker rule consistent with TC-DEC-001.

**Expected Outcome**:

- A type-selection helper block is present in the top region of the template and is consistent with the taxonomy guidance.

**Acceptance threshold**: helper block exists before the first body section (`## Context` or equivalent).

---

#### TC-TPL-002 - No duplicate metadata for new records

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-05, DM-1, DM-5
**Test Type(s)**: Semi-automated (structural), Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/decision-record-template.md`
**Tags**: @docs, @template

**Preconditions**:

- Template phase commit landed.

**Steps**:

1. In the template's **front-matter skeleton** (the `---` block presented as the new-record template), confirm there is **no top-level `decision_area:` key** and **no top-level `reversibility:` key**.
2. Confirm `reversibility` appears **only** under `classification:` (canonical location).
3. Confirm any other field that duplicates a `classification:` field either is removed or carries an inline **one-line justification** comment.
4. Verify the change does **not** alter the 6 grandfathered records' front matter (covered in TC-COMPAT-001) — i.e., dedup applies to **new** records only, and the template states this.
5. Structural check (run against the new-record skeleton region only — beware the grandfathering-policy prose may legitimately *mention* these field names):
   - `rg -n "^decision_area:" doc/templates/decision-record-template.md` → must return **zero** matches that are live skeleton keys (matches only acceptable inside a clearly-marked grandfathering note / quote).
   - `rg -n "^reversibility:" doc/templates/decision-record-template.md` → must return **zero** matches outside the `classification:` block.

**Expected Outcome**:

- The new-record skeleton has no top-level `decision_area` or `reversibility`; `classification.reversibility` is canonical; grandfathered records are untouched; the template documents the dedup policy.

**Acceptance threshold**: grep assertions return no live-skeleton matches; manual review confirms canonical placement.

---

#### TC-TPL-003 - Tiered-default applicability (no 2D matrix)

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-06, DM-1
**Test Type(s)**: Manual (content)
**Automation Level**: Manual
**Target Layer / Location**: `doc/templates/decision-record-template.md`
**Tags**: @docs, @template

**Preconditions**:

- Template phase commit landed.

**Steps**:

1. Confirm the template's proportional-rendering guidance is expressed as a **tiered default**:
   - **Rigor (R1/R2/R3) drives the section set** (primary axis).
   - **Type/archetype toggles a small, enumerated set of optional add-ons** (e.g., "Technical-Selection Evidence" only when `archetype=selection`; "Communication Plan" only when `governance.informed` non-empty).
2. Confirm there is **no full 2D type×rigor matrix** (the collapsed design per the R1 red-team finding + pm-notes decision).
3. Confirm each body section is annotated with its rigor applicability (R1/R2/R3, R2/R3, or R3-expanded).

**Expected Outcome**:

- Tiered-default model present; no 2D matrix; sections annotated by rigor.

**Acceptance threshold**: manual review confirms the enumerated add-on list is small and there is no matrix.

---

#### TC-TPL-004 - R1 required-section set unchanged or smaller

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-07
**Test Type(s)**: Manual (content)
**Automation Level**: Manual
**Target Layer / Location**: `doc/templates/decision-record-template.md`
**Tags**: @docs, @template

**Preconditions**:

- Baseline (pre-change) R1 section set captured from the current template's PROPORTIONAL RENDERING note: Context, Problem Framing, Constraints (Hard Requirements), Decision Drivers, Mental Models & Techniques, Alternatives Considered (baseline + ≥1 option), Decision, owner, revisit trigger.

**Steps**:

1. Extract the new R1 required-section set from the updated template.
2. Diff the new R1 set against the baseline.
3. Confirm the new set is a **subset of, or equal to**, the baseline (no new mandatory section added at R1).

**Expected Outcome**:

- `new_R1_set ⊆ baseline_R1_set`. If equal, acceptable; if smaller, acceptable; if larger, **FAIL**.

**Acceptance threshold**: set comparison proves non-growth (R1 protection).

---

#### TC-TPL-005 - Recommendation separated from Authorized Decision

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-08
**Test Type(s)**: Manual (content), Semi-automated (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/decision-record-template.md`
**Tags**: @docs, @template

**Preconditions**:

- Template phase commit landed.

**Steps**:

1. Confirm the template renders **two distinct** surfaces:
   - A **Recommendation** surface (analyst/AI recommendation, assumptions + risks).
   - An **Authorized Decision** surface (the authorized — often human — decision; constraint-compliance attestation lives here).
2. Confirm the separation is consistent with the guide's "Recommendation ≠ decision" rule (decision-making.md §6).
3. `rg -n "Recommendation|Authorized Decision" doc/templates/decision-record-template.md` and confirm both headings/anchors exist and are distinct.

**Expected Outcome**:

- Recommendation and Authorized Decision are separate, distinguishable sections.

**Acceptance threshold**: both surfaces present and not merged.

---

#### TC-TPL-006 - Decision rights, evidence/unknowns, eligibility-first alternatives, rollback, structured retro

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-09, DM-2
**Test Type(s)**: Manual (content), Semi-automated (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/decision-record-template.md`
**Tags**: @docs, @template

**Preconditions**:

- Template phase commit landed.

**Steps**:

1. Confirm each of the following is present or surfaced in the template body:
   - **Decision Rights** body section aligned with the `governance:` front matter (DACI).
   - **Evidence, Assumptions & Unknowns** section placed **before** Alternatives.
   - **Eligibility-first alternatives**: each alternative leads with an explicit constraint-compliance evaluation (Eligible / Not eligible / Eligible-with-accepted-risk-exception → constraint compliance → driver fit → pros/cons → why rejected/chosen). Matrix default for complex cases; prose for simple.
   - **Rollback / reversal guidance** for hard-to-reverse decisions (mandatory for ADR/ODR with `reversibility=hard` + R3).
   - **Structured post-decision review / retrospective** (separating process/evidence/execution/outcome/luck).
2. `rg -n "Decision Rights|Evidence, Assumptions|Eligible|Rollback|Reversal|Retrospective" doc/templates/decision-record-template.md`.

**Expected Outcome**:

- All five surfaces present and ordered as specified.

**Acceptance threshold**: literal presence of each surface; Evidence/Assumptions/Unknowns precedes Alternatives.

---

#### TC-TPL-007 - Worked R1/R2/R3 rendering examples

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-10
**Test Type(s)**: Manual (content)
**Automation Level**: Manual
**Target Layer / Location**: `doc/templates/decision-record-template.md`
**Tags**: @docs, @template

**Preconditions**:

- Template phase commit landed.

**Steps**:

1. Confirm the template includes **worked rendering examples** for R1, R2, and R3 (concrete rendered records, not just rules).
2. Confirm the R1 example is a strict subset of the R3 example (no R3-only sections leak into R1).

**Expected Outcome**:

- Three worked examples present (R1 compact, R2 standard, R3 full); R1 ⊂ R3.

**Acceptance threshold**: all three examples present and R1 example contains no R3-only section.

---

#### TC-TPL-008 - R1 render omits all R3-only sections

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-20
**Test Type(s)**: Manual (content), Semi-automated (golden-output diff)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/decision-record-template.md` (and/or a committed golden output)
**Tags**: @docs, @template

**Preconditions**:

- Template phase commit landed; R1/R3 worked examples or a golden-output fixture is available.

**Steps**:

1. Identify the R3-only section set: full Implementation Plan, Verification Criteria, Confidence Rating, Lessons Learned, Examples (per the current template's proportional-rendering note; reconcile with the updated template).
2. Render an R1 record (worked example or golden output) and confirm **none** of the R3-only sections appear.
3. If a golden-output fixture is committed, run a diff against the R1 example to prove the omission.

**Expected Outcome**:

- The R1 render contains zero R3-only sections; the omission is demonstrated by a worked example or a golden-output diff.

**Acceptance threshold**: diff/grep shows no R3-only section headings in the R1 render.

---

#### TC-EVI-001 - Bounded technical-selection evidence pack

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-11
**Test Type(s)**: Manual (content), Semi-automated (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/decision-record-template.md`, `doc/guides/decision-making.md`
**Tags**: @docs, @decision-system, @evidence

**Preconditions**:

- Evidence-pack phase commit landed (phase 3).

**Steps**:

1. Confirm a **technical-selection evidence pack** is defined for TDR/ADR with `archetype: selection` (framework/library/tool/vendor).
2. Confirm the pack is **bounded**: top-N candidates (default 3) and a **fixed signal set of ~10 highest-signal fields** (not exhaustive). Verify the documented set includes at least: license compatibility, project age/maturity, latest release date + cadence (3/6/12mo), active contributors / commit activity (12mo), issue/PR responsiveness / bus factor, security advisories + vulnerability handling, GitHub stars (with weak-signal caveat) / downloads, known production users / docs quality, migration/upgrade guidance + SemVer discipline, integration fit / hiring-market familiarity, lock-in/migration cost.
3. `rg -n "top-3|top-N|evidence pack|signal" doc/templates/decision-record-template.md doc/guides/decision-making.md`.

**Expected Outcome**:

- A bounded pack (top-N + ~10 fixed signals) is documented; the high-signal fields are present; the stars-weak-signal caveat is stated.

**Acceptance threshold**: bounded cap stated (default 3 candidates + fixed signal set); ≥10 signal fields listed.

---

#### TC-EVI-002 - Security controls: canonical source, as-of date, data-minimization

**Scenario Type**: Corner Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-12, DM-3, DM-4
**Test Type(s)**: Manual (content), Semi-automated (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/decision-record-template.md`, `doc/guides/decision-making.md`
**Tags**: @docs, @security, @evidence

**Preconditions**:

- Evidence-pack phase commit landed.

**Steps**:

1. Confirm **canonical-source verification** is required (cite official registry/repo URL; flag when canonicality cannot be verified).
2. Confirm the evidence pack carries an **as-of date** and a **revisit trigger**; confirm `revisit_triggers` includes "dependency security advisory published".
3. Confirm **data-minimization in delegation**: send research question + public identifiers only; no internal architecture details, secrets, or proprietary context.
4. Confirm `ai_assistance.external_data_shared` is **wired to** the data-minimization rule (i.e., the template/guide states that sharing external data sets this flag).
5. `rg -n "canonical|as-of|as of|revisit_trigger|external_data_shared|data minimization|minimization" doc/templates/decision-record-template.md doc/guides/decision-making.md`.

**Expected Outcome**:

- All three security controls present; `external_data_shared` wired to the data-minimization rule; revisit trigger includes the security-advisory condition.

**Acceptance threshold**: literal presence of all three controls + the wiring statement.

---

#### TC-EVI-003 - Scorecard warning + license-as-human-step

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-13
**Test Type(s)**: Manual (content), Semi-automated (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/templates/decision-record-template.md`, `doc/guides/decision-making.md`
**Tags**: @docs, @evidence

**Preconditions**:

- Evidence-pack phase commit landed.

**Steps**:

1. Confirm an explicit **warning against converting signals to a blind numeric scorecard** unless D9 deliberately uses MCDA.
2. Confirm the guidance states **license compatibility is a human / R3 step** (license string is a FACT; compatibility determination is not automated).
3. `rg -n "scorecard|MCDA|license" doc/templates/decision-record-template.md doc/guides/decision-making.md`.

**Expected Outcome**:

- Both statements present and unambiguous.

**Acceptance threshold**: literal presence of the scorecard warning and the license-as-human-step statement.

---

#### TC-ADV-001 - `@decision-advisor` delegates to `@external-researcher` (no network)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-14, AGT-1
**Test Type(s)**: Semi-automated (structural grep), Manual (prompt review)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/decision-advisor.md`
**Tags**: @agent, @security

**Preconditions**:

- Advisor-delegation phase commit landed (phase 4).

**Steps**:

1. Confirm the agent prompt retains the **no-direct-network** rule (the existing "Do NOT use the network." line must still be present).
2. Confirm a **delegation rule** is added: when external facts materially affect the recommendation, delegate targeted external fact gathering to `@external-researcher`; request compact evidence packs for technical dependency selections.
3. `rg -n "network|external-researcher|@external-researcher|delegate|evidence pack" .opencode/agent/decision-advisor.md`.
4. Confirm the tooling/safety section still disables network/bash-for-fetch.

**Expected Outcome**:

- `@decision-advisor` still does not use the network directly; delegation to `@external-researcher` is now an explicit, prompt-level rule.

**Acceptance threshold**: "Do NOT use the network" preserved AND a delegation-to-`@external-researcher` rule present.

---

#### TC-ADV-002 - FACT/ASSUMPTION/TO-CONFIRM labels; no invented metrics

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-15, AGT-1
**Test Type(s)**: Semi-automated (structural grep), Manual (prompt review)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/decision-advisor.md`
**Tags**: @agent

**Preconditions**:

- Advisor-delegation phase commit landed.

**Steps**:

1. Confirm the prompt requires treating external findings as **evidence inputs** with **FACT / ASSUMPTION / TO-CONFIRM** labels (these labels already exist for D2; confirm they extend to delegated external findings).
2. Confirm an explicit rule: **never invent maturity/adoption metrics**.
3. `rg -n "FACT|ASSUMPTION|TO CONFIRM|TO-CONFIRM|invent|maturity|adoption" .opencode/agent/decision-advisor.md`.

**Expected Outcome**:

- Labels applied to external findings; no-invented-metrics rule present.

**Acceptance threshold**: both rules present in the prompt.

---

#### TC-ADV-003 - R1 default-local rule

**Scenario Type**: Corner Case
**Impact Level**: Important
**Priority**: High
**Related IDs**: AC-16, AGT-1
**Test Type(s)**: Semi-automated (structural grep), Manual (prompt review)
**Automation Level**: Semi-automated
**Target Layer / Location**: `.opencode/agent/decision-advisor.md`
**Tags**: @agent

**Preconditions**:

- Advisor-delegation phase commit landed.

**Steps**:

1. Confirm the prompt states the **R1 default-local rule**: for R1, default to **local evidence + ASSUMPTION labels**; delegate to `@external-researcher` **only** when the decider explicitly requests external evidence.
2. Confirm the rationale references preserving the R1 ≤1 business-day SLO.
3. `rg -n "R1|default|local evidence|ASSUMPTION|1 business day|SLO" .opencode/agent/decision-advisor.md`.

**Expected Outcome**:

- R1 default-local rule present with the SLO rationale.

**Acceptance threshold**: literal presence of the rule + the explicit-delegate-only condition.

---

#### TC-ADV-004 - Recorded delegation run on a dependency-selection trigger

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-14, AGT-1
**Test Type(s)**: Manual (behavioral demonstration)
**Automation Level**: Manual
**Target Layer / Location**: `@decision-advisor` live run (transcript recorded in this plan's execution log)
**Tags**: @agent, @behavioral

**Preconditions**:

- All source changes landed; `.ados-claude/` regenerated; an `@external-researcher` MCP backend is available (or the run is staged in a repo with the configured MCP servers).

**Steps**:

1. Trigger `@decision-advisor` with a dependency-selection decision (e.g., "select a state-management library for the dashboard; R2; archetype: selection").
2. Observe whether the advisor **delegates** a compact evidence pack request to `@external-researcher` rather than fetching directly or fabricating metrics.
3. Capture the run transcript (status report + any delegation message + returned evidence pack with source links + confidence notes).
4. Confirm external findings are labeled FACT / ASSUMPTION / TO-CONFIRM and that no maturity/adoption metric is invented.

**Expected Outcome**:

- A recorded run shows delegation to `@external-researcher` on the dependency-selection trigger; no direct network use; labels preserved; no invented metrics.

**Acceptance threshold**: transcript attached to the execution log demonstrates delegation (AC-14 "recorded run" clause). If MCP backends are unavailable in the run environment, document the gap in §8 and verify the prompt contract structurally (TC-ADV-001..003) as a fallback — the behavioral run then becomes a follow-up.

---

#### TC-RES-001 - `@external-researcher` evidence-pack capability

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-17, AGT-2
**Test Type(s)**: Manual (prompt review / behavioral verification)
**Automation Level**: Manual
**Target Layer / Location**: `.opencode/agent/external-researcher.md`
**Tags**: @agent

**Preconditions**:

- Evidence-pack phase commit landed (phase 3) — the researcher may or may not need changes; the AC allows "existing prompt behavior verified as sufficient."

**Steps**:

1. Review `.opencode/agent/external-researcher.md` and confirm it can produce a **consistent dependency-selection evidence pack** using the documented MCP routing (context7 → deepwiki → perplexity → web-search), with **source links** and **confidence notes**.
2. Confirm it treats external content as **untrusted** and reports uncertainty clearly (these rules already exist; confirm they are preserved).
3. If the researcher prompt was changed, confirm the MCP routing + untrusted-content rules are intact.
4. Optionally exercise the researcher with a sample dependency query and confirm the output shape matches the bounded pack (top-N, ~10 signals, as-of date).

**Expected Outcome**:

- `@external-researcher` can emit the bounded evidence pack with provenance + confidence, OR the existing prompt is documented as sufficient and unchanged (with the rationale recorded).

**Acceptance threshold**: capability present (literal in prompt) and consistent with the bounded-pack contract from TC-EVI-001.

---

#### TC-COMPAT-001 - Grandfathered records unchanged + policy documented

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-18
**Test Type(s)**: Automated (git diff), Manual (content)
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/decisions/` (6 records), `doc/templates/decision-record-template.md`
**Tags**: @docs, @compat

**Preconditions**:

- Branch `feat/GH-133/decision-process-improvements` contains all commits for the change.

**Steps**:

1. `git diff main...HEAD --name-only -- doc/decisions/` and confirm the 6 grandfathered records are **not** in the changed set:
   - `doc/decisions/ADR-0001-decision-making-framework.md`
   - `doc/decisions/ADR-0002-readiness-gate-definition-of-ready.md`
   - `doc/decisions/PDR-0001-tribal-knowledge-extraction-taxonomy.md`
   - `doc/decisions/PDR-0002-mode-aware-spec-coverage-resolution.md`
   - `doc/decisions/ODR-0001-classify-yaml-register-templates-redistributable.md`
   - `doc/decisions/TDR-0001-bootstrapper-inception-submode-prompt-structure.md`
2. Confirm the template **documents the grandfathering policy** (pre-GH-133 records retain their front-matter shape; new records use the simplified set; no migration pass).
3. `rg -n "grandfather|GH-133|pre-GH-133|migration" doc/templates/decision-record-template.md`.

**Expected Outcome**:

- Zero of the 6 records appear in the branch diff; the template states the grandfathering policy.

**Acceptance threshold**: `git diff main...HEAD --name-only -- doc/decisions/` returns none of the 6 filenames; policy text present.

---

#### TC-COMPAT-002 - GH-63 relationship documented

**Scenario Type**: Regression
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-19
**Test Type(s)**: Manual (content), Semi-automated (structural grep)
**Automation Level**: Semi-automated
**Target Layer / Location**: change spec (when authored) and/or `doc/guides/decision-records-management.md`, pm-notes
**Tags**: @docs, @compat

**Preconditions**:

- The change documents its relationship to GH-63.

**Steps**:

1. Confirm a statement exists that **GH-63 was never merged to main** (no validator/schema/CLI/CI gate exists on `main`).
2. Confirm a statement that **GH-133 defines the new front-matter contract** and that **GH-63 must rebase onto GH-133's simplified front matter if revived**.
3. `rg -n "GH-63|machine-enforceable|rebase" doc/changes/2026-07/2026-07-05--GH-133--decision-process-improvements/ doc/guides/decision-records-management.md`.

**Expected Outcome**:

- The GH-63 relationship (never-merged + GH-133-is-authority + rebase-if-revived) is documented in the change artifacts.

**Acceptance threshold**: literal presence of the three-part statement. Note: this is a content obligation on the change spec/plan; if the spec is not yet authored, the statement must appear there (see OQ-1).

---

#### TC-GATES-001 - `.ados-claude/` regenerated (no plugin drift)

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-21, AC-23
**Test Type(s)**: Automated (shell guard + CI drift check)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-build-claude-plugin.sh`, `.github/workflows/ci.yml`, `.ados-claude/**`
**Tags**: @ci, @plugin

**Preconditions**:

- `.opencode/**` source changes are committed.

**Steps**:

1. `bash scripts/.tests/test-build-claude-plugin.sh` → must pass.
2. Regenerate and verify no drift:
   - `./scripts/build-claude-plugin.sh`
   - `git add -A .ados-claude/ && git diff --cached --exit-code .ados-claude/` → must report **no changes** (the generated output matches the committed output).
3. Confirm `.ados-claude/**` mirrors `.opencode/**` for any changed agent prompt (the generated files include the source-file + regeneration-command comments).
4. Confirm the CI `.ados-claude/` staleness gate would pass (it re-runs `build-claude-plugin.sh` and fails on any unstaged diff).

**Expected Outcome**:

- Generated plugin is current; `test-build-claude-plugin.sh` passes; `git diff --exit-code .ados-claude/` is clean.

**Acceptance threshold**: all three checks pass (exit 0); the changed `.opencode/agent/*.md` files have corresponding regenerated `.ados-claude/` artifacts committed together.

---

#### TC-GATES-002 - Changed redistributable docs keep valid `ados_distribution`

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-22, AC-23
**Test Type(s)**: Automated (shell guard)
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-doc-distribution.sh`
**Tags**: @ci, @docs

**Preconditions**:

- Doc/template changes committed.

**Steps**:

1. `bash scripts/.tests/test-doc-distribution.sh` → must pass (exit 0).
2. For each changed file in the DM-2 scan set (`doc/guides/*.md`, `doc/templates/**/*.md`, `doc/templates/**/*.yaml`, plus the standalone docs), confirm the `ados_distribution` marker is present and one of `{redistributable, internal, project-generated}`.
3. Specifically confirm the changed decision docs retain `ados_distribution: redistributable` (as they currently have):
   - `doc/guides/decision-making.md`
   - `doc/guides/decision-records-management.md`
   - `doc/templates/decision-record-template.md`

**Expected Outcome**:

- No missing-marker, no invalid-enum, no redistributable-not-installed, no internal-installed, no derived-set drift.

**Acceptance threshold**: `test-doc-distribution.sh` exits 0; each changed in-scope doc has a valid marker.

---

#### TC-GATES-003 - `git diff --check` clean + relevant shell guards pass

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-23
**Test Type(s)**: Automated (static/diff + shell)
**Automation Level**: Automated
**Target Layer / Location**: repo root, `scripts/.tests/`
**Tags**: @ci

**Preconditions**:

- All change commits landed on the branch.

**Steps**:

1. `git diff --check main...HEAD` → must be clean (no whitespace errors / conflict markers).
2. Run the two guards relevant to this change:
   - `bash scripts/.tests/test-doc-distribution.sh`
   - `bash scripts/.tests/test-build-claude-plugin.sh`
3. Confirm no license header was added to `doc/changes/**` artifacts (headers are excluded there per `AGENTS.md`; only `scripts/add-header-location.sh` manages headers on its configured paths).

**Expected Outcome**:

- `git diff --check` clean; both guards pass; change artifacts under `doc/changes/` carry no license header.

**Acceptance threshold**: all checks exit 0.

## 6. Environments and Test Data

- **Environment**: local developer checkout on branch `feat/GH-133/decision-process-improvements`; bash ≥ 4 (required by `test-doc-distribution.sh` for `shopt globstar`).
- **No test-data generation**: this is a docs/template/prompt change. "Test data" is the changed files themselves plus the 6 grandfathered records used as the backward-compat fixture.
- **Golden output (optional)**: a committed R1 rendered example or golden-output fixture may be added under the change folder to prove TC-TPL-008; if added, it is the only generated artifact.
- **Behavioral run (TC-ADV-004)**: requires an environment with the configured `@external-researcher` MCP servers (context7/deepwiki/perplexity/web-search). If unavailable, the run is deferred and the prompt-contract checks (TC-ADV-001..003) are the fallback gate (see OQ-2).
- **Isolation**: all checks run against the working tree / branch diff vs `main`; the doc-distribution guard creates and cleans up its own sandbox via `install.sh --local`.

## 7. Automation Plan and Implementation Mapping

| TC ID | Test file / mechanism | Execution command | Implementation status |
|-------|----------------------|-------------------|------------------------|
| TC-DEC-001 | Manual + `rg` assertions | `rg -n "tie-breaker\|reversibility=hard\|blast_radius" doc/guides/` | Manual Only |
| TC-DEC-002 | Manual + `rg` assertions | `rg -n "classification.domains\|ai/ml\|vendor\|procurement\|ux" doc/guides/` | Manual Only |
| TC-DEC-003 | Manual + `rg` assertions | `rg -n "pricing\|infrastructure\|data retention" doc/guides/decision-making.md` | Manual Only |
| TC-TPL-001 | Manual review | n/a | Manual Only |
| TC-TPL-002 | `rg` skeleton assertions + manual | `rg -n "^decision_area:\|^reversibility:" doc/templates/decision-record-template.md` | Semi-automated (new `rg` checks; no new test script) |
| TC-TPL-003 | Manual review | n/a | Manual Only |
| TC-TPL-004 | Set-diff (manual) | compare new vs baseline R1 set | Manual Only |
| TC-TPL-005 | `rg` + manual | `rg -n "Recommendation\|Authorized Decision" doc/templates/decision-record-template.md` | Manual Only |
| TC-TPL-006 | `rg` + manual | `rg -n "Decision Rights\|Evidence, Assumptions\|Eligible\|Rollback\|Retrospective" doc/templates/decision-record-template.md` | Manual Only |
| TC-TPL-007 | Manual review | n/a | Manual Only |
| TC-TPL-008 | Golden-output diff / manual | diff R1 example vs R3-only section set | Semi-automated if golden output committed |
| TC-EVI-001 | `rg` + manual | `rg -n "top-3\|top-N\|evidence pack\|signal" doc/templates/ doc/guides/` | Manual Only |
| TC-EVI-002 | `rg` + manual | `rg -n "canonical\|as-of\|revisit_trigger\|external_data_shared\|minimization" doc/templates/ doc/guides/` | Manual Only |
| TC-EVI-003 | `rg` + manual | `rg -n "scorecard\|MCDA\|license" doc/templates/ doc/guides/` | Manual Only |
| TC-ADV-001 | `rg` + manual | `rg -n "network\|external-researcher\|delegate" .opencode/agent/decision-advisor.md` | Manual Only |
| TC-ADV-002 | `rg` + manual | `rg -n "FACT\|ASSUMPTION\|TO CONFIRM\|invent\|maturity" .opencode/agent/decision-advisor.md` | Manual Only |
| TC-ADV-003 | `rg` + manual | `rg -n "R1\|default\|local evidence\|SLO" .opencode/agent/decision-advisor.md` | Manual Only |
| TC-ADV-004 | Recorded run (transcript) | trigger `@decision-advisor` dependency-selection | Manual Only (deferred if no MCP) |
| TC-RES-001 | Prompt review / optional run | review `.opencode/agent/external-researcher.md` | Manual Only |
| TC-COMPAT-001 | `git diff` + `rg` | `git diff main...HEAD --name-only -- doc/decisions/` | Automated (existing git) |
| TC-COMPAT-002 | `rg` + manual | `rg -n "GH-63\|machine-enforceable\|rebase" doc/changes/2026-07/2026-07-05--GH-133--decision-process-improvements/ doc/guides/decision-records-management.md` | Manual Only |
| TC-GATES-001 | Existing shell guard + CI | `bash scripts/.tests/test-build-claude-plugin.sh` && `./scripts/build-claude-plugin.sh` && `git diff --exit-code .ados-claude/` | Existing – No Change (guards unchanged) |
| TC-GATES-002 | Existing shell guard | `bash scripts/.tests/test-doc-distribution.sh` | Existing – No Change (guard unchanged) |
| TC-GATES-003 | `git diff --check` + guards | `git diff --check main...HEAD` | Existing – No Change |

**Net new automation**: none required. Per testing-strategy fallback, docs/template-only changes rely on manual verification + `git diff --check` + the two existing repo guards. No new `test-*.sh` script is introduced by this change (that would be GH-63 scope, out of scope here).

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

- **R-1 (Medium) — Prose-mention vs live-skeleton ambiguity in TC-TPL-002.** The grandfathering-policy note may legitimately *mention* `decision_area`/`reversibility` in prose, which can produce false positives in a naive `rg "^decision_area:"`. *Mitigation*: scope the grep to the front-matter skeleton block and review matches manually; treat grandfathering-note mentions as acceptable.
- **R-2 (Medium) — R1-protection regression (AC-07).** A new mandatory section slipping into the R1 set would break proportionality and the R1 SLO. *Mitigation*: TC-TPL-004 performs an explicit set-diff against the captured baseline.
- **R-3 (Medium) — Behavioral claims not fully automatable (AC-14).** Delegation actually firing depends on a live model + MCP backends. *Mitigation*: TC-ADV-001..003 verify the prompt contract structurally; TC-ADV-004 is the behavioral confirmation and may be deferred (OQ-2).
- **R-4 (Low) — Drift between process guide and management guide.** Two docs carry taxonomy content; they could diverge. *Mitigation*: TC-DEC-001 explicitly cross-checks both.
- **R-5 (Low) — Generated-plugin staleness if `.opencode/` edits are committed without regen.** *Mitigation*: TC-GATES-001 + CI gate enforce it.

### 8.2 Assumptions

- **A-1**: The 23 ACs enumerated from the ticket are the complete, authoritative acceptance set; the (pending) change spec will mirror them, not add new ones.
- **A-2**: The phased-commit plan (1 taxonomy, 2 template, 3 evidence-pack + researcher, 4 advisor delegation + plugin regen) is followed, so each scenario's "preconditions" (phase landed) are well-defined.
- **A-3**: The two repo guards (`test-doc-distribution.sh`, `test-build-claude-plugin.sh`) are not modified by this change — they are executed as regression checks.
- **A-4**: The baseline R1 section set is the one currently documented in the template's PROPORTIONAL RENDERING note (captured in TC-TPL-004).

### 8.3 Open Questions

- **OQ-1 (Blocking for DoR) — Change spec not yet authored.** This test plan was derived directly from ticket GH-133 because `chg-GH-133-spec.md` does not yet exist (the `test_planning` phase started before `specification` per the pm-notes). *Owner*: `@spec-writer`. *Resolution required*: author the spec and reconcile its AC list against this plan's AC-01…AC-23 mapping; confirm no divergence before the DoR gate.
- **OQ-2 (Non-blocking) — Behavioral delegation run environment.** TC-ADV-004 requires configured `@external-researcher` MCP servers. If the run environment lacks them, the behavioral run is deferred and the structural prompt-contract checks stand as the gate. *Owner*: `@coder` / runner. *Resolution*: confirm MCP availability at execution time; if absent, record the deferral in the execution log and schedule a follow-up run.
- **OQ-3 (Non-blocking) — Worked-example / golden-output fixture location.** AC-20 allows "a golden-output diff or worked example." Confirm whether the worked R1 example lives inside the template (preferred, simplest) or as a separate committed fixture under the change folder. *Owner*: `@coder`.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-05 | @test-plan-writer | Initial test plan. Derived AC-01…AC-23 directly from ticket GH-133 (spec not yet authored — see OQ-1). 24 scenarios across DEC/TPL/EVI/ADV/RES/COMPAT/GATES; all 23 ACs covered. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
| _(populated during delivery/quality-gates phases)_ | | | |
