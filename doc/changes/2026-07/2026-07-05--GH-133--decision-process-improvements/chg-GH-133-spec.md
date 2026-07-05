---
change:
  ref: GH-133
  type: feat
  status: Proposed
  slug: decision-process-improvements
  title: "Improve decision taxonomy, template usability, and technical-selection evidence"
  owners: ["@juliusz-cwiakalski"]
  service: decision-making
  labels: [decision-making, documentation, template, agents, evidence]
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal: [decision-advisor, external-researcher, decision-critic, decision-record-template, build-claude-plugin]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Sharpen the ADOS decision subsystem so records are easier to classify, lighter to render by default, and better evidenced for technical selections — without exploding the type taxonomy, breaking existing records, or giving the advisor direct network access.

## 1. SUMMARY

This change improves the decision-making guidance, the decision-record template, and the two decision-supporting agents (`@decision-advisor`, `@external-researcher`). It clarifies the ADR/TDR boundary with a tie-breaker rule, makes `classification.domains` the primary extension mechanism, reworks the template around a tiered-default applicability model (rigor drives the section set; type/archetype toggles small add-ons), removes duplicated front-matter metadata, splits recommendation from authorized decision, adds an eligibility-first alternatives format, and introduces a bounded technical-selection evidence pack plus an `@decision-advisor` → `@external-researcher` delegation path with explicit security controls. It is delivered as one ticket with phased commits.

## 2. CONTEXT

### 2.1 Current State Snapshot

ADOS has a mature decision subsystem composed of:

- **Process guide** — the Decision-Making Guide carries the universal kernel (D0–D14), rigor profiles (R0–R3 + emergency overlay), four-axis classification, DACI decision rights, the bounded AI-authority model, the per-type nuance matrix, and the constraints/drivers discipline.
- **Record-artifact guide** — Decision Records Management defines naming, front matter, required sections, lifecycle, and governance for five types (ADR, PDR, TDR, BDR, ODR).
- **Template** — a single template that is the source of truth for the record body structure and the optional `classification`/`governance`/`ai_assistance`/`revisit_triggers` front-matter blocks. It supports proportional rendering by rigor (R1 compact subset, R2 standard, R3 full).
- **Agents** — `@decision-advisor` orchestrates all five types (triage → classify → rigor → rights → D0–D14) and **never uses the network directly**; `@external-researcher` gathers external evidence via MCP routing (context7 → deepwiki → perplexity → web-search) and treats all external content as untrusted.
- **Six existing records** — ADR-0001, ADR-0002, PDR-0001, PDR-0002, ODR-0001, TDR-0001 already exist with the current front-matter shape.
- **Red-team R1 review** of this change returned PASS_WITH_RISKS with three must-fix items: GH-63 coupling, backward compatibility, and AC sharpening — all folded into scope below.

### 2.2 Pain Points / Gaps

- **Blurry ADR vs TDR boundary.** Both can involve technology choices, but they should route different ownership and evidence. No explicit rule of thumb or tie-breaker exists in the docs.
- **Unclear type-vs-domain split.** The docs do not clearly state when to use a top-level type versus `classification.domains` for specialized concerns (security, privacy, legal, data, AI, vendor, procurement, ML, UX).
- **Template is heavyweight by default.** Despite proportional-rendering guidance, the template structure nudges all decisions toward full-record ceremony, threatening the R1 lightweight goal.
- **Recommendation conflated with decision.** The template body does not cleanly separate the analyst/AI recommendation from the authorized (often human) decision, even though the process guide mandates this separation.
- **Overlapping front-matter metadata.** `reversibility` appears both at the top level and under `classification`; `decision_area` duplicates `decision_type` + `classification.domains`.
- **No technical-selection evidence guidance.** Framework/library/tool/vendor selections routinely underweight maintenance, adoption, license, and security risks. There is no bounded evidence pack, no canonical-source/as-of-date discipline, and no delegation path for gathering external facts.
- **Advisor cannot gather external facts.** `@decision-advisor` correctly avoids direct network use but has no sanctioned delegation target for external evidence that materially affects a recommendation.
- **R1 rendering fragility.** A full 2D applicability matrix (rigor × type) would likely cause LLM agents to over-emit sections, defeating the R1 lightweight goal.

## 3. PROBLEM STATEMENT

Because the decision docs blur the ADR/TDR boundary, omit a domains-first extension story, and present a template that is heavyweight by default with overlapping metadata and no clean recommendation/decision split, teams and agents cannot consistently classify, proportionally render, or evidentially support technical-selection decisions — resulting in miscategorized records, ceremony overload on lightweight choices, and dependency selections that underweight maintenance, adoption, license, and security risk.

## 4. GOALS

- **G-1**: Clarify the ADR vs TDR boundary with a rule of thumb, a tie-breaker rule, and concrete overlap examples.
- **G-2**: Establish `classification.domains` as the primary extension mechanism for specialized concerns, keeping the five top-level types stable.
- **G-3**: Rebuild the template around a tiered-default applicability model so rigor drives the section set and type/archetype toggles only small enumerated add-ons — never a full 2D matrix.
- **G-4**: De-duplicate template front matter and make `classification.reversibility` canonical.
- **G-5**: Cleanly separate recommendation from authorized decision in the rendered record.
- **G-6**: Strengthen alternatives, evidence, decision rights, rollback, communication, and retrospective treatment in the template body.
- **G-7**: Add a bounded technical-selection evidence pack with explicit security controls.
- **G-8**: Wire `@decision-advisor` to delegate targeted external fact gathering to `@external-researcher`, preserving the no-direct-network safety model and the R1 SLO.
- **G-9**: Preserve backward compatibility for existing records and document the relationship to the unmerged GH-63 machine-enforceability work.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| R1 required-section set size | ≤ current set (no growth) |
| Front-matter duplicate fields (new records) | 0 un-justified duplicates |
| Technical-selection signal set | bounded to top-3 candidates × ~10 highest-signal fields |
| R1 cycle-time impact | preserved ≤ 1 business day (delegation off by default at R1) |
| Affected redistributable docs with valid `ados_distribution` | 100% |
| Generated-plugin drift after `.opencode/` change | 0 (regenerated) |
| Grandfathered records migrated | 0 (grandfather only) |

### 4.2 Non-Goals

- **NG-1**: Do not add many new top-level decision prefixes.
- **NG-2**: Do not merge ADR and TDR into a single type.
- **NG-3**: Do not give `@decision-advisor` direct network access.
- **NG-4**: Do not turn dependency-health metrics into mandatory fields for every decision type.
- **NG-5**: Do not require full R2/R3 records for routine R0/R1 decisions.
- **NG-6**: Do not migrate existing decision records (grandfather only).
- **NG-7**: Do not build a JSON schema, validator, index tool, or CI gate (GH-63 scope, if revived).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | ADR/TDR taxonomy clarity with tie-breaker | Boundary drives ownership, reviewers, lifetime, and evidence routing; ambiguity today causes miscategorization |
| F-2 | Domains-first extension mechanism | `classification.domains` is the right place for specialized concerns; new top-level types would cause taxonomy fatigue |
| F-3 | Tiered-default template applicability | Rigor must drive the section set; a 2D matrix would cause agents to over-emit and bloat R1 records |
| F-4 | Front-matter de-duplication | Duplicate fields (top-level + `classification` reversibility; `decision_area` vs type/domains) create drift and ambiguity |
| F-5 | Recommendation vs authorized decision split | The process guide mandates this; the template body must render it cleanly |
| F-6 | Eligibility-first alternatives | Constraint compliance must precede driver-based ranking; today it is under-surfaced |
| F-7 | Evidence/Assumptions/Unknowns surfacing | Separating FACT/ASSUMPTION/TO-CONFIRM and impact-if-false improves calibration and revisit discipline |
| F-8 | Decision rights, rollback, communication, retro body sections | Governance, reversal guidance, and structured post-decision review are process requirements lacking first-class template sections |
| F-9 | Worked R1/R2/R3 rendering examples | Concrete beats abstract rules for LLM rendering determinism |
| F-10 | Bounded technical-selection evidence pack | Dependency selections underweight maintenance/adoption/license/security; a bounded pack forces the high-signal facts |
| F-11 | Evidence security controls | Canonical-source verification, as-of date + revisit triggers, and delegation data-minimization protect integrity and confidentiality |
| F-12 | Advisor → researcher delegation | External facts materially affect some recommendations; a sanctioned delegation path preserves the no-direct-network model |
| F-13 | R1 default-local + label discipline | R1 must stay fast and local; external delegation only when the decider opts in; never invent metrics |
| F-14 | Backward compatibility + GH-63 relationship | Existing records must keep working; future machine-enforceability must build on the new front-matter contract |

### 5.1 Capability Details

**F-1 (Taxonomy clarity).** Decision docs define when each type applies: ADR for system-shaping decisions (service/module boundaries, integration patterns, API/event/contract shape, architecture-defining topology, cross-system quality attributes, durable constraints); TDR for implementation/tooling within an established architecture (library/framework/tool selection, build/test/lint tooling, implementation patterns, migration techniques, non-architecture-defining algorithm/data-structure choices). A rule of thumb routes each case ("Will this constrain future system design across components or teams?" → ADR; "Is this mainly how we implement within an already-decided design?" → TDR). A tie-breaker prefers ADR when `reversibility=hard` or `blast_radius≥team`; otherwise TDR. The tie is broken by `classification.conditions`, not by the prefix alone. Type controls ownership/routing; rigor is controlled by risk/stakes, not prefix.

**F-2 (Domains-first).** Specialized concerns (security, privacy, compliance, data, finance, legal, AI, UX, vendor, procurement) are usually `classification.domains` plus the primary owning type — not new top-level types. The docs include explicit overlap examples for ML model selection (`domain: ai/ml` + `archetype: selection`), vendor/procurement, and UX pattern libraries, plus common-overlap guidance for pricing (PDR vs BDR), infrastructure (ADR vs ODR), and data retention (BDR/ODR/ADR by primary driver).

**F-3 (Tiered-default applicability).** The template marks each section by rigor applicability (R1/R2/R3, R2/R3, R3-expanded). Rigor is the primary axis and drives the section set; type/archetype toggles a small, enumerated set of optional add-ons (e.g., Technical-Selection Evidence only when `archetype=selection`; Communication Plan only when `governance.informed` is non-empty). No full 2D matrix. The R1 required-section set is unchanged or smaller than today.

**F-4 (Front-matter cleanup).** For new records, the top-level `reversibility` is removed and `classification.reversibility` becomes the canonical location; `decision_area` is removed (redundant with `decision_type` + `classification.domains`). No other duplicate fields remain without a one-line justification.

**F-5 (Recommendation vs decision).** The template renders the analyst/AI recommendation separately from the authorized decision. R2/R3 records stay `Proposed` with `decision_date: null` until an authorized human decides; AI never auto-Accepts them.

**F-6 (Eligibility-first alternatives).** Alternatives follow an eligibility-first structure: Eligible / Not eligible / Eligible-with-accepted-risk-exception → constraint compliance → driver fit → pros/cons → why rejected/chosen. Default to matrix form for complex cases, prose for simple ones.

**F-7 (Evidence/Assumptions/Unknowns).** A surfaced Evidence, Assumptions & Unknowns section precedes alternatives and maintains FACT / ASSUMPTION / TO-CONFIRM labels, source references, impact-if-false, and confidence — before driver-based ranking begins.

**F-8 (Body sections).** The template surfaces a Decision Rights body section aligned with the `governance` front matter, rollback/reversal guidance (mandatory for ADR/ODR with `reversibility=hard` + R3), an optional Communication Plan (PDR/BDR/ODR with stakeholder impact), and a structured retrospective that separates process, evidence, execution, outcome, and luck/variance. Method guidance is provided by archetype (selection, policy, go/no-go, architecture design, product prioritization, incident/operations).

**F-9 (Worked examples).** The template includes concrete worked renderings for R1, R2, and R3 triggers, including a golden output that demonstrates an R1 record omitting all R3-only sections.

**F-10 (Evidence pack).** For TDR/ADR with `archetype: selection`, a bounded evidence pack gathers the highest-signal fields: license string (as FACT; compatibility is a human/R3 step), project age/maturity, latest release date and release cadence (3/6/12 months), active contributors and commit activity (12 months), issue/PR responsiveness and bus factor, security advisories and vulnerability handling, GitHub stars (weak-signal caveat) and download/usage signals, known production users and community/docs quality, migration/upgrade guidance and SemVer discipline, integration fit and team/hiring-market familiarity, and lock-in/migration cost. The pack is bounded to top-N candidates (default 3) and a fixed ~10-field signal set to avoid token/cycle-time blowup. These are evidence signals, not blind scorecard items; conversion to a numeric scorecard is allowed only when D9 deliberately selects MCDA.

**F-11 (Security controls).** Evidence guidance requires: canonical-source verification (cite official registry/repo URL; flag when canonicality cannot be verified); as-of date plus a revisit trigger (the pack carries an as-of date; `revisit_triggers` includes "dependency security advisory published"); and delegation data-minimization (send research question + public identifiers only; no internal architecture details, secrets, or proprietary context). `ai_assistance.external_data_shared` is wired to this rule.

**F-12 (Delegation).** `@decision-advisor` still does not use the network directly. It delegates targeted external fact gathering to `@external-researcher` when external facts materially affect the decision, requests compact evidence packs for technical dependency selections, treats external findings as evidence inputs (FACT/ASSUMPTION/TO-CONFIRM labels), and never invents maturity/adoption metrics.

**F-13 (R1 default-local).** For R1, `@decision-advisor` defaults to local evidence + ASSUMPTION labels and delegates only when the decider explicitly requests external evidence — preserving the R1 ≤ 1 business day SLO.

**F-14 (Backward compat).** Six existing records (ADR-0001, ADR-0002, PDR-0001, PDR-0002, ODR-0001, TDR-0001) retain their current front-matter shape; no migration pass. The template documents the grandfathering policy. GH-63 (machine-enforceable decision records) was never merged to `main`; GH-133 defines the new front-matter contract, and if GH-63 is revived it must rebase onto GH-133's simplified front matter.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Classify a technology decision
  Trigger → advisor asks "constrains future system design across components/teams?"
    → Yes, AND (reversibility=hard OR blast_radius≥team) → ADR
    → No, "implement within an already-decided design?" → TDR
    → Ambiguous → tie-breaker via classification.conditions → ADR or TDR
    → specialized concern (security/ML/vendor/UX) → domain tag + owning type (no new type)
  → pick rigor (R0–R3) → render sections per tiered-default model

Flow 2 — Technical dependency selection (R2/R3)
  advisor identifies archetype=selection → requests bounded evidence pack from @external-researcher
    → researcher routes context7 → deepwiki → perplexity → web-search
    → returns evidence pack: canonical sources, as-of date, confidence notes, untrusted-content caveats
    → advisor labels findings FACT / ASSUMPTION / TO-CONFIRM (never invents metrics)
    → eligibility-first filter → driver ranking → recommendation (separate from authorized decision)
    → revisit_triggers include "dependency security advisory published"

Flow 3 — R1 lightweight decision
  trigger → R1 rigor → advisor defaults to LOCAL evidence + ASSUMPTION labels
    → delegates externally ONLY if decider explicitly opts in
    → renders compact subset only; omits all R3-only sections
    → resolves ≤ 1 business day

Flow 4 — Backward compatibility
  existing record opened → retains current front-matter shape (grandfathered)
  new record created → uses simplified front-matter set (no top-level reversibility/decision_area)
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- ADR/TDR boundary clarification, rule of thumb, tie-breaker, and overlap examples across pricing, infrastructure, data retention, and security/privacy/legal/data/AI/vendor/procurement/ML/UX.
- Establishing `classification.domains` as the primary extension mechanism (no new top-level types).
- Template rebuild: tiered-default applicability model, front-matter de-duplication, type-selection helper, recommendation/decision split, eligibility-first alternatives, evidence/assumptions/unknowns, decision rights, rollback, communication plan, structured retrospective, method-by-archetype guidance, and worked R1/R2/R3 examples.
- Technical-selection evidence pack guidance with a bounded field set and security controls.
- `@decision-advisor` delegation to `@external-researcher`, R1 default-local rule, and label discipline.
- `@external-researcher` dependency-selection evidence pack capability (or verification that existing behavior suffices).
- Backward-compatibility grandfathering policy and GH-63 relationship documentation.
- Regeneration of generated plugin artifacts from changed agent definitions, and `ados_distribution` hygiene on changed redistributable docs.

### 7.2 Out of Scope

- [OUT] Adding new top-level decision type prefixes.
- [OUT] Merging ADR and TDR.
- [OUT] Granting `@decision-advisor` direct network access.
- [OUT] A JSON schema, validator, index tool, or CI gate for decision records (GH-63).
- [OUT] Migrating the six existing decision records to the new front-matter shape.
- [OUT] Mandatory dependency-health metrics for non-selection decision types.
- [OUT] Rebuilding GH-63's TypeScript CLI (owner will rebuild it later against the new contract).
- [OUT] Numeric scorecard tooling beyond the existing D9 method guidance.

### 7.3 Deferred / Maybe-Later

- Machine-enforceable decision-record quality (GH-63), rebased onto GH-133's simplified front matter.
- Auto-generation of `doc/decisions/00-index.md`.
- Cross-model independence defaults beyond the existing §6 guidance.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — this change concerns documentation, templates, and agent prompts. No REST/HTTP endpoints are introduced or modified.

### 8.2 Events / Messages

N/A — no event/message contracts are introduced or modified.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Removed front-matter keys (new records) | Top-level `reversibility` and `decision_area` are removed from the template for new records |
| DM-2 | Canonical reversibility | `classification.reversibility` is the single canonical location for reversibility |
| DM-3 | Tiered applicability markers | Section-level rigor applicability tags (R1/R2/R3, R2/R3, R3-expanded) replace any matrix model |
| DM-4 | New/surfaced body sections | Decision Rights, Evidence/Assumptions/Unknowns, Recommendation (separate), Authorized Decision, Rollback/Reversal, Communication Plan (optional), Structured Retrospective |
| DM-5 | Evidence pack structure | Bounded pack: top-N candidates (default 3) × ~10 signal fields, each with canonical source link, as-of date, confidence note; license recorded as FACT string |
| DM-6 | `ai_assistance.external_data_shared` | Wired to the delegation data-minimization rule (question + public identifiers only) |
| DM-7 | `revisit_triggers` | Extended guidance to include "dependency security advisory published" for selection archetypes |

### 8.4 External Integrations

The change formalizes a delegation path to `@external-researcher`, which routes to external MCP servers (context7, deepwiki, perplexity, web-search). No new external integrations are added; existing MCP routing is reused under stricter data-minimization rules (public identifiers only; no internal architecture details, secrets, or proprietary context).

### 8.5 Backward Compatibility

- **Grandfathered records:** ADR-0001, ADR-0002, PDR-0001, PDR-0002, ODR-0001, TDR-0001 retain their existing front-matter shape. No migration pass; the template documents the grandfathering policy.
- **New records** use the simplified front-matter set (no top-level `reversibility`/`decision_area`).
- **R1 protection:** the R1 required-section set is unchanged or smaller; no existing R1-renderable record is invalidated.
- **No runtime code change** to application behavior; the product (agent prompts + docs) changes but no breaking contract is introduced for existing records or existing agent callers.
- **GH-63 coupling:** GH-133 defines the new front-matter contract; if GH-63 is revived it must rebase onto GH-133.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | R1 required-section set does not grow | Section count ≤ current R1 set (≤ 8 sections) |
| NFR-2 | Evidence pack is bounded | ≤ 3 candidates × ≤ ~10 highest-signal fields per candidate |
| NFR-3 | R1 cycle time preserved | ≤ 1 business day; external delegation off by default at R1 |
| NFR-4 | Template rendering determinism | Rigor is the single primary axis; ≤ a small enumerated set of type/archetype add-ons; no full 2D matrix |
| NFR-5 | Backward compatibility | 0 of the 6 existing records migrated; all retain current front-matter shape |
| NFR-6 | Distribution & generation integrity | 100% of changed redistributable docs have valid `ados_distribution`; 0 generated-plugin drift after `.opencode/` changes |
| NFR-7 | Front-matter cleanliness | 0 un-justified duplicate fields in the template for new records |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A at runtime. The change introduces documentation-level "as-of date + revisit trigger" and confidence-note conventions inside decision records (evidence provenance), but no metrics, logs, traces, or alerts are added to a running system. Observed quality signals (template adoption, R1 lightness) are evaluated via the review and quality-gate phases of the delivery process, not via runtime telemetry.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Template complexity degrades R1 rendering | H | M | Tiered-default model (rigor drives section set); worked R1/R2/R3 examples; golden-output diff; NFR-1 guards section count | L |
| RSK-2 | Agent rendering inconsistency (over-emission) | M | M | Concrete worked examples instead of abstract rules; enumerated add-ons instead of 2D matrix | L |
| RSK-3 | Scope size destabilizes the change | M | M | One ticket delivered as phased commits (taxonomy → template → evidence-pack/researcher → advisor/plugin) | L |
| RSK-4 | Evidence pack token/cycle-time blowup | M | M | Bounded pack (≤3 candidates × ~10 fields); R1 stays local by default | L |
| RSK-5 | Data leakage in delegation to researcher | H | L | Data-minimization rule (question + public identifiers only); `ai_assistance.external_data_shared` wired; researcher treats content as untrusted | L |
| RSK-6 | Misclassification of ADR vs TDR persists | M | M | Rule of thumb + tie-breaker + overlap examples; tie broken by `classification.conditions` | L |
| RSK-7 | Signals misused as a blind numeric scorecard | M | M | Explicit warning; scorecard allowed only when D9 selects MCDA; license compatibility remains a human/R3 step | L |
| RSK-8 | Future GH-63 work conflicts with new front-matter contract | M | L | Relationship documented; GH-133 named as the contract GH-63 must rebase onto | L |

## 12. ASSUMPTIONS

- The five existing top-level types (ADR, PDR, TDR, BDR, ODR) remain valid and stable.
- The six existing records can be grandfathered without migration; their front-matter shape will not be re-validated against the new contract.
- GH-63 will remain unmerged on `main` and, if revived, will rebase onto GH-133's simplified front matter.
- `@external-researcher`'s existing MCP routing (context7 → deepwiki → perplexity → web-search) is sufficient to produce compact evidence packs, possibly with light prompt additions.
- LLM agents render concrete worked examples more reliably than abstract matrix rules.
- Reviewers accept that license-compatibility determination is a human/R3 step, not a machine conclusion.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Decision-Making Guide / Records Management Guide / Template | These are the artifacts being improved |
| Depends on | `@decision-advisor`, `@external-researcher` prompts | Behavior changes land in `.opencode/` |
| Depends on | `build-claude-plugin` step | Regenerates `.ados-claude/**` from `.opencode/**` |
| Blocks | GH-63 (if revived) | Must rebase onto GH-133's new front-matter contract |
| Blocks | Future machine-enforceable decision quality | Awaits GH-63 rebase |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the type-selection helper live in the template, the Records Management guide, or both? | Avoids duplication of the routing rule; both could reference a single source. | Decision needed: consult `@decision-advisor` |
| OQ-2 | Is ~10 signal fields the right bound, or should it be archetype-specific (e.g., fewer for tools, more for vendors)? | Token/cycle-time tradeoff vs evidence depth. | Decision needed: consult `@decision-advisor` |
| OQ-3 | Does `@external-researcher` need a new prompt section, or is existing behavior sufficient? | AC allows either; pick the minimal change. | Decision needed: consult `@decision-advisor` |
| OQ-4 | Should the Communication Plan default-on for BDR, or stay opt-in? | Affects template default section set. | Decision needed: consult `@decision-advisor` |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Keep five top-level types; use `classification.domains` for specialization | New types would cause taxonomy fatigue; the domains axis already exists | 2026-07-05 |
| DEC-2 | Collapse 2D applicability to tiered-default (rigor primary; type/archetype add-ons) | LLMs over-emit under full matrices; defeats R1 lightness | 2026-07-05 |
| DEC-3 | Grandfather the 6 existing records; no migration | Avoids churn/risk; records are durable artifacts | 2026-07-05 |
| DEC-4 | GH-63 is disregarded; GH-133 defines the new front-matter contract | GH-63 never merged to `main`; no coordination needed; rebases later | 2026-07-05 |
| DEC-5 | Advisor delegates to researcher; never networks directly | Preserves the existing safety model while enabling external evidence | 2026-07-05 |
| DEC-6 | R1 defaults to local evidence + ASSUMPTION labels | Preserves R1 ≤ 1 business day SLO | 2026-07-05 |
| DEC-7 | License compatibility is a human/R3 step, not a machine conclusion | Compatibility determination requires judgment; license recorded as FACT string only | 2026-07-05 |
| DEC-8 | Deliver as one ticket with phased commits | Keeps the contract coherent while bounding risk per commit | 2026-07-05 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Decision-Making Guide | Updated — ADR/TDR clarification, tie-breaker, overlap examples, domains-first extension, tiered applicability guidance |
| Decision Records Management Guide | Updated — type-table refresh, overlap guidance, backward-compat/grandfathering note |
| Decision Record Template | Updated — front-matter cleanup, tiered applicability markers, type-selection helper, new/surfaced body sections, worked examples |
| `@decision-advisor` agent | Updated — researcher delegation, R1 default-local rule, evidence-pack request guidance, label discipline |
| `@external-researcher` agent | Updated or verified — dependency-selection evidence pack capability |
| Agent inventory / README summary | Updated if agent behavior summary changes |
| Generated Claude Code plugin | Regenerated from `.opencode/**` |
| Decision-instructions (project-local) | Reviewed for consistency (no required change) |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a technology decision, **when** it is classified, **then** the docs apply a clear ADR vs TDR boundary with rule-of-thumb examples and a tie-breaker that prefers ADR when `reversibility=hard` or `blast_radius≥team`. | F-1 |
| AC-F2-1 | **Given** a specialized concern (security/privacy/legal/data/AI/vendor/procurement/ML/UX), **when** it is routed, **then** the docs state it is usually a `classification.domains` tag plus the owning type (not a new top-level type), with ML, vendor/procurement, and UX overlap examples. | F-2 |
| AC-F1-2 | **Given** a borderline case, **when** the docs are consulted, **then** common overlap guidance exists for pricing, infrastructure, data retention, and security/privacy decisions. | F-1, F-2 |
| AC-F3-1 | **Given** a new decision record, **when** the template is opened, **then** a compact type-selection helper appears near the top. | F-3 |
| AC-F4-1 | **Given** the template for new records, **when** front matter is inspected, **then** top-level `decision_area` and `reversibility` are removed and `classification.reversibility` is canonical, with no other duplicate fields without a one-line justification. | F-4, DM-1, DM-2, NFR-7 |
| AC-F3-2 | **Given** template section rendering, **when** applicability is determined, **then** a tiered-default model applies (rigor drives the section set; type/archetype toggles a small enumerated set of add-ons) with no full 2D matrix. | F-3, DM-3, NFR-4 |
| AC-F3-3 | **Given** the R1 profile, **when** its required sections are counted, **then** the set is unchanged or smaller than the current R1 set. | F-3, NFR-1 |
| AC-F5-1 | **Given** an R2/R3 record, **when** it is rendered, **then** Recommendation is separated from the Authorized Decision and the record stays `Proposed` until an authorized human decides. | F-5, DM-4 |
| AC-F8-1 | **Given** the template body, **when** governance and lifecycle sections are reviewed, **then** decision rights, evidence/assumptions/unknowns, eligibility-first alternatives, rollback/reversal guidance, and structured post-decision review are surfaced. | F-6, F-7, F-8, DM-4 |
| AC-F9-1 | **Given** the template, **when** a contributor needs proportional-rendering guidance, **then** worked R1/R2/R3 rendering examples are present. | F-9 |
| AC-F10-1 | **Given** a framework/library/tool/vendor selection, **when** evidence is gathered, **then** technical-selection evidence guidance exists with a bounded pack (top-N candidates, ~10 signal fields). | F-10, DM-5, NFR-2 |
| AC-F11-1 | **Given** external evidence, **when** it is cited, **then** the guidance requires canonical-source verification, an as-of date plus revisit trigger, and delegation data-minimization rules. | F-11, DM-5, DM-6, DM-7 |
| AC-F10-2 | **Given** the evidence guidance, **when** scoring is considered, **then** it warns against converting signals to a blind numeric scorecard and states license compatibility is a human/R3 step. | F-10, F-11 |
| AC-F12-1 | **Given** a dependency-selection trigger, **when** external facts materially affect the recommendation, **then** `@decision-advisor` delegates to `@external-researcher` instead of using the network directly (demonstrable on a recorded run). | F-12 |
| AC-F12-2 | **Given** external findings, **when** `@decision-advisor` incorporates them, **then** it preserves FACT / ASSUMPTION / TO CONFIRM labels and refuses to invent maturity/adoption metrics. | F-12, F-13 |
| AC-F13-1 | **Given** an R1 decision, **when** no explicit external-evidence request is made, **then** `@decision-advisor` defaults to local evidence + ASSUMPTION labels and delegates only when the decider requests external evidence. | F-13, NFR-3 |
| AC-F12-3 | **Given** a dependency-selection research request, **when** `@external-researcher` is invoked, **then** it produces a compact evidence pack with source links and confidence notes, or existing prompt behavior is verified as sufficient. | F-12 |
| AC-F14-1 | **Given** records created before GH-133, **when** they are opened, **then** they retain their existing front-matter shape (grandfathered) and the template documents this policy. | F-14, NFR-5 |
| AC-F14-2 | **Given** the GH-63 relationship, **when** the change is documented, **then** it states GH-133 defines the new contract and GH-63 must rebase if revived. | F-14 |
| AC-F9-2 | **Given** an R1 trigger, **when** the record is rendered, **then** it omits all R3-only sections, demonstrated by a golden-output diff or worked example. | F-9, NFR-1 |
| AC-DM6-1 | **Given** `.opencode/` agent changes, **when** the build step runs, **then** `.ados-claude/**` is regenerated. | DM-6, NFR-6 |
| AC-NFR6-1 | **Given** changed redistributable docs, **when** distribution is checked, **then** each keeps valid `ados_distribution` front matter. | NFR-6 |
| AC-NFR6-2 | **Given** the change set, **when** quality gates run, **then** relevant checks pass including doc-distribution and generated-plugin drift checks. | NFR-6 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

Deliver as **one ticket with phased commits** within a single PR/branch:

1. **Taxonomy** — ADR/TDR clarification, tie-breaker, overlap examples, domains-first extension across the Decision-Making and Records Management guides.
2. **Template** — front-matter cleanup, tiered-default applicability, type-selection helper, new/surfaced body sections, worked examples.
3. **Evidence pack + researcher** — bounded technical-selection pack guidance and security controls; `@external-researcher` capability addition or verification.
4. **Advisor delegation + plugin regen** — `@decision-advisor` delegation and R1 default-local rules; regenerate `.ados-claude/**`; `ados_distribution` hygiene.

No feature flags or runtime rollout: this is documentation + prompt content. Adoption is immediate on merge. Communication to adopters flows through the normal guide/version notes; the grandfathering policy ensures no breaking change for existing records.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

No data migration. The six existing decision records are grandfathered and retain their current front-matter shape. New records use the simplified front-matter set from the updated template. No seeding is required.

## 20. PRIVACY / COMPLIANCE REVIEW

The change **strengthens** privacy posture via the delegation data-minimization rule: external research requests carry the research question and public identifiers only — no internal architecture details, secrets, or proprietary context. `ai_assistance.external_data_shared` is wired to this rule so records disclose when external data was shared. No personal data is processed, stored, or transmitted by this change. No regulatory obligations are triggered.

## 21. SECURITY REVIEW HIGHLIGHTS

- **No new attack surface.** No network access is granted to `@decision-advisor`; delegation to `@external-researcher` reuses existing, sandboxed MCP routing.
- **Data minimization.** Delegation sends public identifiers only; the researcher already treats all external content as untrusted and ignores injected instructions.
- **Evidence integrity.** Canonical-source verification and as-of-date/revisit-trigger discipline reduce the risk of acting on stale or spoofed dependency metadata.
- **No secrets handling change.** No secrets, credentials, or tokens are introduced or rotated.
- **Security impact: low** (net improvement via added controls).

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Ongoing cost:** low. The tiered-default model and worked examples are designed to keep agent rendering stable; the bounded evidence pack caps per-decision token/cycle cost.
- **Grandfathering:** the six existing records require no ongoing maintenance beyond their existing lifecycle.
- **Plugin sync:** any future `.opencode/` change to the two agents must be followed by a plugin regeneration (existing CI drift guard enforces this).
- **Adopter impact:** redistributable docs/guides change; adopters who copy the template should adopt the simplified front matter for new records but need not migrate existing ones.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| ADR / PDR / TDR / BDR / ODR | Architecture / Product / Technical / Business / Operational Decision Record |
| Rigor profile (R0–R3) | Amount of process scaled to stakes: R0 no record, R1 lightweight, R2 standard, R3 high assurance |
| Tiered-default applicability | Rigor drives the section set; type/archetype toggles a small enumerated set of add-ons |
| `classification.domains` | The extension axis for specialized concerns (security, privacy, ML, vendor, UX, …) |
| Archetype | Decision shape (selection, design, policy, go/no-go, …) that toggles optional template add-ons |
| Tie-breaker rule | When ADR vs TDR is ambiguous: prefer ADR if `reversibility=hard` or `blast_radius≥team`, else TDR; conditions break the tie |
| Evidence pack | Bounded set of high-signal fields for technical selections (≤3 candidates × ~10 fields) |
| Eligibility-first alternatives | Order alternatives by constraint compliance before driver-based ranking |
| Grandfathering | Existing records retain their front-matter shape without migration |
| DACI | Driver / Approver / Contributors / Informed decision-rights model |

## 24. APPENDICES

### Appendix A — Evidence pack signal fields (bounded set)

License string (FACT; compatibility is human/R3), project age/maturity, latest release date, release cadence (3/6/12 months), active contributors (12 months), commit activity (12 months), issue/PR responsiveness + bus factor, security advisories + vulnerability handling, GitHub stars (weak-signal caveat) + downloads/usage, known production users + community/docs quality, migration/upgrade guidance + SemVer discipline, integration fit + hiring-market familiarity, lock-in/migration cost. Select ~10 highest-signal fields per candidate; do not exceed the bound.

### Appendix B — Phase map (high-level)

1. Taxonomy (guides) → 2. Template → 3. Evidence pack + researcher → 4. Advisor delegation + plugin regen. Each phase is a discrete commit within the single branch.

### Appendix C — GH-63 relationship

GH-63 (machine-enforceable decision records) was never merged to `main`. GH-133 defines the new front-matter contract. If GH-63 is revived, it must rebase onto GH-133's simplified front matter; no coordination is required in this change.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-05 | @juliusz-cwiakalski via spec-writer | Initial specification from GH-133, incorporating red-team R1 must-fix items (GH-63 coupling, backward compatibility, AC sharpening) |

---

## AUTHORING GUIDELINES

- Authored from the GH-133 ticket body (problem, goals, scope, 24 ACs, non-goals, reasoning, R1 notes) plus current-state review of the Decision-Making Guide, Decision Records Management Guide, the Decision Record Template, and the `@decision-advisor` / `@external-researcher` agent prompts, and the project-local decision instructions.
- Red-team R1 (PASS_WITH_RISKS) must-fix items were folded in: GH-63 coupling (§7.2/Appendix C/DEC-4), backward compatibility (§8.5/DEC-3/AC-F14-1), and AC sharpening (all ACs are concrete and falsifiable).
- Ship-with-findings folded into scope: tiered applicability, security controls, evidence-pack cap, tie-breaker rule, worked examples, R1 protection, R1 default-local delegation, and license-as-human-step.
- IDs are stable and traceable: F- (capabilities), DM- (data model), NFR- (non-functional), RSK- (risks), OQ- (open questions), DEC- (decisions), AC- (acceptance criteria). Every AC references at least one F-/DM-/NFR- ID and uses Given/When/Then.
- Scope is intentionally documentation/template/agent-prompt level; no code file paths or step-by-step implementation tasks are included. Where `@decision-advisor` and `@external-researcher` prompts are concerned, consultation is captured as OQs where a judgment is still open.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-133)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, OQ-, DEC-, AC-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no code-level file paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (referenced, not copied)
- [x] Front matter validates per front_matter_rules
