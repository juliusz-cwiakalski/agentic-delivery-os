---
change:
  ref: GH-60
  type: docs
  status: Proposed
  slug: decision-records-hard-requirements
  title: "Decision records: distinguish hard requirements (constraints) from drivers"
  owners: ["@cwiakalski"]
  service: delivery-os
  labels: [decision-records, documentation-framework, template]
  version_impact: none
  audience: internal
  security_impact: none
  risk_level: low
  dependencies:
    internal: [decision-record-template, decision-records-management-guide, plan-decision-command, write-decision-command, architect-agent]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Give hard requirements (binary, non-negotiable constraints) a first-class place in decision records — separate from continuous decision drivers — so that an alternative can no longer "win" on driver scores while silently violating a constraint.

## 1. SUMMARY

This change introduces a dedicated **"Constraints (Hard Requirements)"** section into the decision-record framework, placed between *Problem Framing* and *Decision Drivers*. Each alternative must explicitly evaluate its compliance against the documented constraints, and the *Decision* section must explicitly attest compliance (or document an accepted-risk exception for constraints marked negotiable). The `/plan-decision` and `/write-decision` commands, the architect agent's baked-in body structure, the decision-record template, and the management guide are updated consistently so the new section applies uniformly across all five decision types (ADR/PDR/TDR/BDR/ODR). There is no source code; this is a documentation- and agent-prompt-framework change.

## 2. CONTEXT

### 2.1 Current State Snapshot

The decision-record framework today consists of:

- A **decision-record template** whose body is ordered: Context → Problem Framing → Decision Drivers → Mental Models & Techniques → Alternatives Considered → Decision → Trade-offs & Consequences → … → References.
- A **decision-records management guide** whose §6 "Required Sections" mirrors that order (Context, Problem Framing, Decision Drivers, Alternatives Considered, …).
- A **`/plan-decision` command** that elicits context, problem framing, and *decision drivers* in a single conceptual step, then shapes alternatives and emits a `<technical_decision_planning_summary>` with a `decision_drivers:` list.
- A **`/write-decision` command** that renders the decision record from the planning summary using a baked-in `<decision_structure>` and an embedded template.
- An **`@architect` agent** that owns the decision workflow and hardcodes the same body-section order in its prompt.

In all of these, **hard requirements have no first-class home**. They are implicitly folded into the prose of *Context* (which mentions "relevant constraints") or silently absorbed into *Decision Drivers*.

### 2.2 Pain Points / Gaps

- **Conflation of two distinct concepts.** Decision drivers are *continuous preferences* the decision optimizes for (tradeable; used to rank alternatives). Hard requirements (constraints) are *binary gates* (pass/fail; they eliminate alternatives rather than rank them). The current framework collapses both under a single "Decision Drivers" section.
- **Silent constraint violation risk.** Because hard requirements have no first-class slot, an alternative can accumulate the highest driver score while quietly failing a non-negotiable constraint, and nothing in the record surfaces this.
- **Inconsistent capture across the pipeline.** `/plan-decision` elicits drivers but not constraints as a distinct factor class, so constraints never reach the planning summary and therefore cannot be rendered by `/write-decision`.
- **Multi-source duplication.** The body-section order is baked into four separate artifacts (template, guide §6, `/write-decision` structure, `@architect` prompt). Any structural change must propagate to all four or they drift.

## 3. PROBLEM STATEMENT

Because the decision-record framework treats hard requirements and decision drivers as a single concept, an author producing a decision record cannot reliably surface non-negotiable constraints, resulting in decisions where an alternative may be selected on driver scores while silently violating a binary gate the decision actually depended on.

## 4. GOALS

- **G-1**: Add a dedicated, first-class **"Constraints (Hard Requirements)"** section to the decision-record template, positioned between *Problem Framing* and *Decision Drivers*.
- **G-2**: Require each alternative to explicitly evaluate its compliance against the documented constraints.
- **G-3**: Require the *Decision* section to explicitly attest constraint compliance — or document an accepted-risk exception, permitted only for constraints marked `negotiable: yes`.
- **G-4**: Update `/plan-decision` to elicit hard requirements as a distinct step, separate from drivers, including driver/constraint overlap detection that warns and requires categorization.
- **G-5**: Update `/write-decision` to render the new Constraints section from the planning summary, in the correct ordinal position.
- **G-6**: Apply the change consistently and uniformly across all five decision types (ADR, PDR, TDR, BDR, ODR) and across all four artifacts that bake in the body structure.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Authoritative sources defining decision-record body structure that include the Constraints section in the correct ordinal position | 4 / 4 (template, guide §6, write-decision, architect) |
| Decision types to which the Constraints section applies uniformly | 5 / 5 (ADR, PDR, TDR, BDR, ODR) |
| Existing decision records requiring migration / breaking changes | 0 |
| Source-code or build-pipeline files changed | 0 |

### 4.2 Non-Goals

- **NG-1**: Migration of existing decision records (none exist; the template change is backward-compatible).
- **NG-2**: Changes to unrelated decision-record sections (Context, Verification Criteria, Confidence Rating, Lifecycle, References, etc.).
- **NG-3**: Changes to the change-spec template's own acceptance-criteria handling.
- **NG-4**: A new front-matter field for constraints in v1 — constraints live in the body only.
- **NG-5**: Authoring separate standalone example decision records; template inline guidance plus guide examples must be complete enough on their own.
- **NG-6**: Changes to how `@spec-writer` or `@plan-writer` operate — they do not bake in the decision-record body structure.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | First-class "Constraints (Hard Requirements)" section in the decision-record template | Gives binary gates a dedicated home so they cannot be silently folded into drivers or buried in Context prose |
| F-2 | Per-alternative constraint-compliance evaluation | Forces an explicit pass/fail check for every alternative against every non-trivial constraint, eliminating silent violations |
| F-3 | Decision-section compliance attestation with accepted-risk exception path | Makes the final decision explicitly accountable to the constraints; permits controlled, documented exceptions only for negotiable constraints |
| F-4 | Hard-requirements elicitation as a distinct planning step | Separates constraint capture from driver capture at the source so the two factor classes never merge |
| F-5 | Driver/constraint overlap detection in planning | Prevents the same factor from living in both buckets, which would reintroduce the conflation this change removes |
| F-6 | Constraints rendering in the decision-record writer | Propagates the captured constraints into the canonical record in the correct position |
| F-7 | Uniform application across all five decision types | Ensures the discipline is not type-specific (constraints apply to architecture, product, technical, business, and operational decisions alike) |
| F-8 | Synchronized body structure across all authoring artifacts | Prevents drift between the template, guide, writer, and architect so authors always see one consistent structure |

### 5.1 Capability Details

**F-1 — Constraints section.** A new top-level section named "Constraints (Hard Requirements)" appears in the decision-record body immediately after *Problem Framing (Clarified)* and immediately before *Decision Drivers*. Each constraint is recorded as a structured entry (see DM-1) and assigned a compact identifier (see DM-3). The section may legitimately be empty when a decision genuinely has no hard requirements; emptiness must be a conscious author choice, not an omission.

**F-2 — Per-alternative compliance evaluation.** The *Alternatives Considered* section must, for every alternative, include an explicit evaluation of its compliance with the documented constraints (not only pros/cons against drivers). The author selects the presentation format based on a documented readability heuristic: **prose** (1–2 sentences per alternative) when all alternatives satisfy the constraints or only one or two violations need explanation; a **matrix** (constraints × alternatives) when ≥3 constraints have mixed compliance or prose would exceed ~3 sentences per alternative. The default when unsure is the **matrix**. Table-stakes constraints that every alternative satisfies receive a brief acknowledgment rather than per-alternative listing.

**F-3 — Decision-section attestation.** The *Decision* section must explicitly attest that the chosen alternative satisfies every constraint, or, for any constraint it does not satisfy, document an accepted-risk exception. An exception is permitted *only* for constraints marked `negotiable: yes`. A non-negotiable constraint (`negotiable: no`) that the chosen alternative violates is, by definition, disqualifying and must not be waved through.

**F-4 — Planning elicitation step.** `/plan-decision` gains a dedicated step that elicits hard requirements as a distinct factor class, performed separately from the decision-driver step. The captured hard requirements flow into a `hard_requirements:` field in the planning summary (see DM-2), kept separate from `decision_drivers:`.

**F-5 — Overlap detection.** During planning, when the same factor is captured as both a driver and a constraint, the command warns and requires the author to categorize it into exactly one bucket before proceeding. This is a soft warning that surfaces the conflict and asks for a decision; it is not a hard block that halts the session.

**F-6 — Writer rendering.** `/write-decision` reads the `hard_requirements:` from the planning summary and renders the Constraints section in the body at the position defined by F-1, in the exact section order produced by the template and the architect agent.

**F-7 — Cross-type uniformity.** The Constraints section and its rules apply identically regardless of the decision type prefix (ADR/PDR/TDR/BDR/ODR). No type opts out of constraints, and no type adds type-only constraint behavior in this change.

**F-8 — Multi-source synchronization.** The body-section order — including the new Constraints section — is kept identical across the four artifacts that bake it in: the decision-record template, the management guide §6, the `/write-decision` structure/embedded template, and the `@architect` agent prompt. Section-order consistency is treated as an explicit acceptance criterion (NFR-1).

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Planning a decision (hard requirements now first-class):
  Author runs /plan-decision
    → number resolved, context + problem framing clarified
    → [NEW] hard-requirements elicitation step (distinct from drivers)
    → overlap detection: if a factor is both a driver and a constraint,
        warn and require categorization into one bucket (soft warn)
    → decision drivers confirmed (separate, now unconflated)
    → alternatives shaped, each tagged against constraints
    → planning summary emitted with hard_requirements: (distinct from decision_drivers:)
    → hand off to /write-decision

Flow 2 — Writing the decision record:
  Author runs /write-decision <number>
    → planning summary consumed (incl. hard_requirements:)
    → decision record rendered with section order:
        Context → Problem Framing → Constraints (Hard Requirements)
        → Decision Drivers → Mental Models → Alternatives (each with
        compliance evaluation) → Decision (with compliance attestation
        or accepted-risk exception) → … → References
    → file written, staged, committed
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Decision-record template: new Constraints section between *Problem Framing* and *Decision Drivers*; per-alternative compliance evaluation in *Alternatives*; compliance attestation in *Decision*.
- Management guide §6 Required Sections: list the new section in the correct ordinal position; adjust §9 Agent Integration if needed.
- `/plan-decision`: new hard-requirements elicitation step; driver/constraint overlap detection; new `hard_requirements:` field in the planning summary.
- `/write-decision`: render the Constraints section in the correct position; require compliance attestation in Alternatives and Decision; update embedded template and structure.
- `@architect` agent prompt: update its baked-in decision-record body structure to include the Constraints section in the same position.
- Uniform application across ADR/PDR/TDR/BDR/ODR.

### 7.2 Out of Scope

- [OUT] Migrating, rewriting, or republishing existing decision records (none exist).
- [OUT] A new front-matter field for constraints (v1 keeps constraints in the body).
- [OUT] Changes to Context, Verification Criteria, Confidence Rating, Lifecycle, References, or other unrelated decision-record sections.
- [OUT] Changes to the change-spec template's acceptance-criteria structure.
- [OUT] Standalone example decision records as separate deliverables.
- [OUT] Any source-code, build, or CI/runtime change.

### 7.3 Deferred / Maybe-Later

- **D-1**: An optional front-matter field (e.g., a constraints count or index) to make constraints machine-queryable across the decision corpus. Deferred to a future change once a real querying need exists.
- **D-2**: A definition-of-ready (DoR) gate that automatically checks constraint compliance during change intake (see dependency GH-57).
- **D-3**: Constraint interactions / conditional constraints. v1 treats every constraint as an independent gate. Real decisions may have constraints that are individually passable but jointly infeasible (e.g., "≤4h downtime" + "zero data loss" may be jointly impossible for some migration), or conditional ("C-2 applies only if C-1 holds"). A future change could extend DM-1 with a `depends_on` or `joint_feasibility` field.
- **D-4**: Inverse problem — soft constraints hidden as drivers. This change fixes "constraint folded into driver"; it does not fix the inverse (a driver that is secretly a soft constraint, e.g., "minimize cost" treated as a driver when there is actually a hard budget ceiling). The `/plan-decision` overlap detection partially catches this only when both are explicitly captured. A future change could prompt authors during driver elicitation: "Is this actually a hard ceiling in disguise?".

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface; this is a documentation/agent-prompt framework change.

### 8.2 Events / Messages

N/A — no event/message contracts.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Constraint entry | A single hard-requirement record with fields: **ID**, **Statement**, **Source**, **Verification**, **Negotiable**. Source ∈ {regulatory, contractual, prior decision, AC, internal standard}. Verification ∈ {test, audit, code review, architect sign-off, demonstration} (not limited to automated checks). Negotiable ∈ {yes, no}. |
| DM-2 | Planning-summary field | A `hard_requirements:` list added to the `<technical_decision_planning_summary>`, distinct and separate from the existing `decision_drivers:` list. |
| DM-3 | Constraint identifier scheme | Compact per-record identifiers `C-1`, `C-2`, … used to cross-reference constraints from the Alternatives and Decision sections. |

### 8.4 External Integrations

N/A — no external APIs or services are affected.

### 8.5 Backward Compatibility

Fully backward-compatible. The change only *adds* a section and tightens authoring expectations; a decision record authored under the prior structure remains structurally valid (see NG-1, NFR-2). No existing decision record requires migration (and none exist today). There is no downstream code that programmatically parses decision-record structure, so the structural addition carries no parser/contract risk.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Maintainability — section-order consistency across every authoritative source that bakes in the decision-record body structure | The Constraints section appears in the **identical ordinal position in 4 / 4** sources (template, guide §6, write-decision structure/embedded template, architect agent body structure) |
| NFR-2 | Backward compatibility — existing decision records remain structurally valid | **100%** of existing records valid; **0** records require migration (currently **0** exist) |
| NFR-3 | Uniformity — the Constraints section applies to every decision type | **5 / 5** types (ADR, PDR, TDR, BDR, ODR) |
| NFR-4 | Performance / build impact — no runtime or build-pipeline behavior change | **0** source-code changes; **0** CI/build configuration changes |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — no code, no runtime. No new metrics, logs, traces, or alerts.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The body-section order is baked into four separate artifacts; an inconsistent update causes drift (e.g., writer omits the new section while the template includes it) | M | M | Treat section-order consistency as an explicit acceptance criterion (NFR-1, AC-GH60-8/9/12); single coordinated review pass across all four artifacts before merge | Low |
| RSK-2 | No downstream code parses decision-record structure, so a structural change could be assumed safe and ship with a subtle inconsistency | L | L | Verify by diffing the section order across all four sources as part of review; no runtime/parser dependency to regress | Low |
| RSK-3 | Backward-incompatible accidental edit (e.g., renumbering/reordering existing sections) | L | L | Change is strictly additive (new section + tightened authoring rules); existing sections and their order are preserved (NG-2, NFR-2) | Low |
| RSK-4 | Authors over-apply constraints (ceremony burden) or still conflate drivers and constraints after the change, weakening adoption | M | M | Overlap detection in `/plan-decision` forces categorization; template guidance permits a brief acknowledgment for table-stakes constraints and an empty section when no hard requirements genuinely exist; default-to-matrix rule keeps prose/matrix balanced (RD-4) | Low |

## 12. ASSUMPTIONS

- The decision-record body-section order is currently identical across the four artifacts named in F-8; this change updates all four rather than reconciling pre-existing drift.
- `.opencode/` artifacts (commands and the architect agent) are tuned through the toolsmith agent per AGENTS.md; the implementation plan will route those edits accordingly, while the documentation artifacts (template, guide) follow the normal documentation flow.
- No tool currently consumes the `<technical_decision_planning_summary>` for any purpose other than `/write-decision`, so adding a `hard_requirements:` field is additive and safe.
- All five decision types share a single decision-record template and a single body structure (no per-type structural variants exist today).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Related (not blocking) | GH-46 — decision-making ownership/role | Complementary axis (who decides); this change is orthogonal (how decisions are recorded) |
| Related (not blocking) | GH-57 — definition-of-ready gate checking constraint compliance | Complementary; a DoR gate would naturally consume the constraints this change makes first-class |
| Blocks | None | — |

No blocking dependencies. This change can proceed independently.

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | None open at time of authoring | All five planning open questions (RD-1 … RD-5) plus six additional detail decisions were resolved in the planning session and are recorded in §15 | Resolved |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 (RD-1) | The Constraints section is placed **between Problem Framing and Decision Drivers** | Binary gates are evaluated before scoring (screen, then rank); mirrors MCDA screening-then-scoring and Kepner-Tregoe Musts-before-Wants discipline | 2026-06-24 |
| DEC-2 (RD-2) | Section name is **"Constraints (Hard Requirements)"** | Explicit term pairing prevents relapse into the single-"drivers" conflation that motivated the change | 2026-06-24 |
| DEC-3 (RD-3) | Each constraint carries a **`negotiable`** field; each alternative must include an explicit **compliance evaluation**; the Decision section must **attest compliance** or document an **accepted-risk exception** (only for constraints marked `negotiable: yes`) | Makes non-negotiable gates first-class and disqualifying; the exception path keeps genuinely negotiable constraints workable while remaining explicit | 2026-06-24 |
| DEC-4 (RD-4) | Compliance-evaluation **format is chosen by the author** (prose vs matrix) via a readability heuristic; **default to matrix when unsure**; table-stakes constraints (all alternatives satisfy them) get a brief acknowledgment rather than per-alternative listing | Balances rigor with readability; avoids forcing a matrix when every alternative complies, while avoiding unbounded prose when many constraints are mixed | 2026-06-24 |
| DEC-5 (RD-5) | `/plan-decision` **warns** when the same factor appears as both driver and constraint and **requires categorization** into one bucket before proceeding (soft warning, not a hard block) | Prevents the same factor occupying both buckets (which would reintroduce conflation) while preserving author flexibility | 2026-06-24 |
| DEC-6 | Constraint identifiers use **`C-1`, `C-2`, …** per decision record | Compact cross-reference from Alternatives and Decision back to the Constraints section | 2026-06-24 |
| DEC-7 | Constraint entry fields are **ID, Statement, Source, Verification, Negotiable**; Source ∈ {regulatory, contractual, prior decision, AC, internal standard}; Verification ∈ {test, audit, code review, architect sign-off, demonstration} (not limited to automated checks) | Captures provenance and how compliance is checked; explicitly allows non-automated verification so non-code constraints (e.g., regulatory) are first-class | 2026-06-24 |
| DEC-8 | **No new front-matter field in v1**; constraints live in the body | Body-only keeps the change strictly additive and backward-compatible, avoiding schema/tooling changes (see NG-4, D-1) | 2026-06-24 |
| DEC-9 | Scope includes **`.opencode/agent/architect.md`** because it bakes in the body-section order; `@spec-writer` and `@plan-writer` do **not** bake it in and are therefore out of scope | An agent audit found the architect hardcodes section order, so it must be updated alongside the template and commands to satisfy NFR-1 | 2026-06-24 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Decision Record Template (`doc/templates`) | Updated — new Constraints section; per-alternative compliance evaluation; Decision compliance attestation |
| Decision Records Management Guide (`doc/guides`) | Updated — §6 Required Sections lists the new section; §9 Agent Integration reviewed |
| `plan-decision` command (`.opencode/command`) | Updated — new hard-requirements elicitation step; overlap detection; `hard_requirements:` summary field *(tuned via `@toolsmith`)* |
| `write-decision` command (`.opencode/command`) | Updated — render Constraints section; attestation rules; embedded template/structure *(tuned via `@toolsmith`)* |
| `architect` agent (`.opencode/agent`) | Updated — baked-in decision-record body structure includes Constraints section *(tuned via `@toolsmith`)* |
| Change Spec Template | Not affected (NG-3) |
| Source code / build / CI | Not affected (NFR-4) |

> Per `AGENTS.md`, the `.opencode/` artifacts are modified through the `@toolsmith` agent; the documentation artifacts follow the normal documentation flow. This routing is a delivery concern and will be reflected in the implementation plan.

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-GH60-1 | **Given** the decision-record template body structure, **when** a decision record is authored, **then** a "Constraints (Hard Requirements)" section exists positioned immediately after *Problem Framing* and immediately before *Decision Drivers*. | F-1, NFR-1 |
| AC-GH60-2 | **Given** the Constraints section, **when** a constraint is documented, **then** it is recorded with fields **ID, Statement, Source, Verification, and Negotiable**. | DM-1, F-1 |
| AC-GH60-3 | **Given** the *Alternatives* section in the template, **when** an alternative is described, **then** it includes an explicit constraint-compliance evaluation (prose or matrix form) with the readability heuristic documented (default to matrix when unsure). | F-2, DM-3 |
| AC-GH60-4 | **Given** the *Decision* section in the template, **when** the decision is stated, **then** it explicitly attests constraint compliance or documents an accepted-risk exception limited to constraints marked `negotiable: yes`. | F-3 |
| AC-GH60-5 | **Given** the `plan-decision` session flow, **when** the author reaches the factor-elicitation phase, **then** hard requirements are elicited as a distinct step separate from decision drivers. | F-4 |
| AC-GH60-6 | **Given** the `plan-decision` command, **when** the same factor is captured as both a driver and a constraint, **then** the command warns and requires the author to categorize it into one bucket before proceeding (soft warning, not a hard block). | F-5 |
| AC-GH60-7 | **Given** the `<technical_decision_planning_summary>`, **when** it is emitted, **then** it includes a `hard_requirements` field distinct and separate from `decision_drivers`. | DM-2, F-4 |
| AC-GH60-8 | **Given** the `write-decision` command, **when** it renders a decision record from the planning summary, **then** it produces the Constraints section and the resulting section order matches the template exactly. | F-6, NFR-1 |
| AC-GH60-9 | **Given** the decision-records-management guide, **when** its §6 Required Sections list is read, **then** the Constraints (Hard Requirements) section is listed in the correct ordinal position. | F-8 |
| AC-GH60-10 | **Given** any of the five decision types (ADR, PDR, TDR, BDR, ODR), **when** a decision record is produced, **then** the Constraints section and its rules apply uniformly. | F-7, NFR-3 |
| AC-GH60-11 | **Given** a decision record authored under the prior structure, **when** it is evaluated against the updated template, **then** it remains structurally valid without modification (backward-compatible). | NFR-2 |
| AC-GH60-12 | **Given** the `architect` agent prompt, **when** it bakes in the decision-record body structure, **then** that structure includes the Constraints section in the same ordinal position as the template and commands. | F-8, NFR-1 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Single coordinated change across five artifacts (two documentation, three `.opencode`). All edits land together in one branch/PR to keep section order consistent across sources during the transition.
- The `.opencode/` artifacts are tuned via `@toolsmith`; the documentation artifacts via the normal documentation flow; the implementation plan sequences these so the final merged state is internally consistent.
- No runtime rollout, feature flags, or staged exposure — the change takes effect for the next decision record authored after merge.
- Communication: note the new Constraints section and the prose/matrix heuristic in the management guide so authors adopt the discipline going forward.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no existing decision records to migrate; no seeding required. (See NG-1, NFR-2.)

## 20. PRIVACY / COMPLIANCE REVIEW

N/A — no personal data, no data flows. Note: the change *improves* the framework's ability to record compliance/regulatory constraints as first-class entries (constraint Source ∈ {regulatory, contractual, …}), but introduces no new privacy or compliance obligations.

## 21. SECURITY REVIEW HIGHLIGHTS

None. The change touches documentation and agent-prompt text only; it introduces no authentication, authorization, input-handling, or secret-handling changes. The agent-prompt edits are additive structural guidance and do not alter the agents' filesystem/git safety constraints.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Low ongoing burden: authors must populate the Constraints section when authoring new decision records. When a decision genuinely has no hard requirements, the section is explicitly marked empty (a conscious choice).
- The four baked-in body-structure sources must be kept in sync on any future section-order change; this change establishes section-order consistency (NFR-1) as a reviewable invariant going forward.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Hard requirement (constraint) | A binary, pass/fail gate that *eliminates* alternatives rather than ranking them. Disqualifying when `negotiable: no`. |
| Decision driver | A continuous preference the decision *optimizes for*; tradeable and used to rank/score alternatives. |
| Negotiable constraint | A hard requirement whose violation may be accepted via a documented accepted-risk exception (still surfaced explicitly, never silently waived). |
| Table-stakes constraint | A constraint every alternative satisfies; receives a brief acknowledgment rather than per-alternative compliance listing. |
| MCDA | Multi-Criteria Decision Analysis — a discipline that separates *screening criteria* (must-pass) from *scoring criteria* (rank), the conceptual basis for separating constraints from drivers. |
| Accepted-risk exception | A documented, in-record statement that the chosen alternative violates a `negotiable: yes` constraint and that the risk is consciously accepted. |

## 24. APPENDICES

**Appendix A — Theoretical basis.** This change reflects established decision-analysis practice that separates must-pass screening from want-based scoring: Kepner-Tregoe Musts vs. Wants; MCDA screening criteria vs. scoring criteria; RFP mandatory requirements vs. evaluation criteria. The current template inherits a common simplification that collapses both into "Decision Drivers".

**Appendix B — Illustrative constraint entry shape.** A single constraint is recorded with five fields (values illustrative only):

- **ID:** C-1
- **Statement:** <the non-negotiable requirement, stated as a pass/fail test>
- **Source:** one of regulatory | contractual | prior decision | AC | internal standard
- **Verification:** one of test | audit | code review | architect sign-off | demonstration
- **Negotiable:** yes | no

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-24 | @spec-writer | Initial specification authored from GH-60 planning session (RD-1 … RD-5 + additional locked details) |

---

## AUTHORING GUIDELINES

- Authored from the GH-60 planning summary and PM notes (`chg-GH-60-pm-notes.yaml`) as authoritative sources; the GitHub issue is auth-gated (HTTP 404 on fetch) so the planning artifacts were treated as the single source of truth.
- Resolved planning decisions RD-1 … RD-5 plus six additional locked details were lifted verbatim in intent into §15 Decision Log (DEC-1 … DEC-9) rather than re-decided.
- Component names are used in the body in preference to raw paths to keep the spec at the "what changes" level; §16 names the affected artifacts with their impact and notes the `@toolsmith` routing for `.opencode/` files (a delivery concern deferred to the implementation plan).
- No implementation tasks, line-number edits, or commit/git instructions are included; those belong in the implementation plan.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-60)
- [x] `owners` has at least one entry (`@cwiakalski`)
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (G-, NG-, F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-GH60-, D-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values (4/4, 5/5, 100%, 0)
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths as edit instructions, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
