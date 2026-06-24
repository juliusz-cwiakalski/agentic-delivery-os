---
change:
  ref: GH-46
  type: refactor
  status: Proposed
  slug: decision-making-framework
  title: "Decision-making refactor: universal kernel, proportional rigor, unified agent, process-first guide"
  owners: ["@cwiakalski"]
  service: delivery-os
  labels: [decision-making, agent-framework, documentation-framework, template, refactor]
  version_impact: none
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal: [decision-record-template, decision-records-management-guide, plan-decision-command, write-decision-command, architect-agent, meeting-organizer-agent, meeting-preparation-guide, feature-decision-records, feature-document-templates, pm-instructions, claude-plugin-build-script]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Generalize ADOS decision-making from an architecture-biased single-ceremony workflow into a **universal decision kernel with adaptive playbooks** — one domain-neutral orchestrator agent, proportional rigor (R0–R3 + emergency), explicit decision rights, a bounded AI-authority model, independent challenge, and a process-first guide — so the right amount of process is applied to each decision by its nature and risk, not its record prefix.

## 1. SUMMARY

This change rebuilds the decision-making subsystem end-to-end while reusing the decision-**record** foundation already generalized to all five types (ADR/PDR/TDR/BDR/ODR). It introduces a universal decision kernel (D0–D14) shared by all significant decisions, four rigor profiles (R0–R3) plus an emergency overlay that scale ceremony to stakes, four-axis decision classification that drives routing, first-class decision rights (DACI-style), and a bounded AI-authority model (AI recommends/facilitates but only autonomously acts within delegated, reversible, bounded R0–R1 with audit + escalation; R2/R3 always require a human final decision). The `@architect` agent is renamed and rewritten into the domain-neutral **`@decision-advisor`** with its baked-in body structure removed (it references the template instead), a lean read-only **`@decision-critic`** is added for independent challenge, and a new `/review-decision` command is added. A new process-first **Decision-Making Guide** supersedes the artifact-centric records-management guide, the template gains rigor-aware optional front matter with proportional-rendering guidance, `/plan-decision` and `/write-decision` are generalized, meeting integration routes durable decisions into the workflow, and every `@architect` reference is swept repo-wide with the Claude Code plugin regenerated. There is no application source code; this is a documentation- and agent-prompt-framework change.

## 2. CONTEXT

### 2.1 Current State Snapshot

ADOS already generalized the decision-**record artifact** to all five types and (via GH-60 / PR #61) gave hard requirements (constraints) a first-class place separate from drivers. The current decision tooling is:

- **One agent, `@architect`**: described in its own prompt as "an elite sparring partner for **system architecture** and **high-stakes technical decision-making**", yet that same prompt states "Decision types: ADR, PDR, TDR, BDR, ODR" and "You DO own the **decision record workflow**". It is the default agent for both `/plan-decision` and `/write-decision`.
- **Two commands**: `/plan-decision` self-describes as an "Interactive **technical-decision** planning session" whose summary block uses architecture-biased field names (`adr.number`, `adr.slug_hint`, `adr.title`) wrapped in a `<technical_decision_planning_summary>` tag; `/write-decision` renders the canonical record and keeps the constraint/driver discipline from GH-60.
- **A baked-in body structure**: both `@architect` and `/write-decision` hard-code the full decision-record section order, duplicating the template — a drift source (this duplication caused GH-60's section-ordering collision).
- **An artifact-centric guide** (`doc/guides/decision-records-management.md`): covers types, naming, lifecycle, front matter, required sections, and governance, but contains no decision **process** narrative — the Archie-style process lives only inside the `/plan-decision` prompt.
- **A rigor-neutral template** (`doc/templates/decision-record-template.md`): every record, from a reversible UI choice to a data-residency strategy, receives the same full ceremony.
- **Meeting integration** (`@meeting-organizer` + meeting guide): summarizes meetings and suggests filing durable decisions as records, delegating to `@architect`; there is no concept of meeting discussion as evidence input, nor of distinct decision modes.
- **A system feature spec** (`feature-decision-records.md`) and **PM instructions** that both reference `@architect`.

### 2.2 Pain Points / Gaps

- **Agent identity contradicts its contract.** `@architect` is framed architecture-only yet its body owns all five types. This is a discovery failure: nothing signals "call me" for a product, pricing, or operating decision. (Research Gap 1.)
- **No proportional rigor.** A reversible UI choice and a data-residency strategy get the same ceremony. Research (Cynefin, one/two-way-door, NASA) is emphatic that method must be tailored to context. (Gap 2.)
- **No process narrative in public docs.** The guide is artifact-centric; the process lives hidden in a command prompt.
- **No decision rights.** Who drives, decides, reviews, and executes is not first-class — the root of GH-46's "clear boundaries on responsibilities" ask.
- **No AI authority model.** Nothing defines when AI may recommend vs. autonomously act vs. must defer to a human (the "AI autonomous decisions with permission" point). (Gap 5.)
- **No independent challenge.** Recommendation and critique come from the same agent; research stresses same-model/same-prompt agents are NOT independent evidence (automation-bias risk). (Gaps 5, 10.)
- **Maintenance liability / drift source.** The agent prompt and command both bake the full body structure in, duplicating the template — the cause of GH-60's numbering collision.
- **GH-60 carryover defects:** the English phrase "non-negotiable" coexists inconsistently with the actual data field `negotiable: yes/no` (in the command, guide, and template); the guide's *Context* description mentions "constraints", conflating *Context* with the *Constraints* section; and per-alternative heading wording drifted across sources. (To be neutralized/dropped/standardized.)

## 3. PROBLEM STATEMENT

Because ADOS generalized only the decision-**record artifact** (never the agent, process narrative, decision rights, AI authority model, or proportional rigor), **a user (engineer, PM, founder, or AI agent) cannot get decision help calibrated to the nature and risk of a decision**: an architecture-biased agent name hides that it owns product/business/operating decisions, a reversible choice and a high-stakes strategy decision receive identical ceremony, nobody is formally designated the decider, AI is neither authorized nor bounded, and recommendation and critique come from the same non-independent source — resulting in over-ceremony for routine choices, under-rigor for high-stakes ones, architecture-biased framing of non-technical decisions, and a drift-prone duplicated body structure.

## 4. GOALS

- **G-1**: Provide a universal, type-neutral decision kernel (D0–D14) shared by all significant decisions, with depth varying by rigor.
- **G-2**: Scale ceremony to stakes via rigor profiles R0–R3 plus an emergency overlay, so routine reversible decisions stay fast and high-stakes ones get evidence + independent challenge.
- **G-3**: Unify to one domain-neutral orchestrator agent (`@decision-advisor`) for all five types, type-aware, with no baked-in body structure; add a lean independent challenger (`@decision-critic`).
- **G-4**: Make decision rights (DACI-style) first-class in both the planning session and the record.
- **G-5**: Define a bounded AI-authority model: AI recommends/facilitates; may autonomously act only within delegated, reversible, bounded R0–R1 with audit + escalation; R2/R3 always require a human final decision; recommendation ≠ decision.
- **G-6**: Deliver a process-first Decision-Making Guide (kernel, rigor, triage, rights, AI authority, per-type nuance matrix, constraints/drivers discipline).
- **G-7**: Integrate meetings: meeting discussion is legitimate evidence input; durable meeting decisions get records; document three decision modes.
- **G-8**: Keep GH-60's constraint/driver discipline and cross-source section-order consistency while removing the drift source (no baked-in structure).
- **G-9**: Dogfood the new process by recording GH-46 itself as ADR-0001.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Discovery clarity | One domain-neutral orchestrator; identity no longer architecture-only; a product/business/operating decision is discoverable as a decision request |
| Proportionality | R0 produces 0 mandatory records; R1 produces a strict proper subset of the R3 output and resolves within ≤ 1 business day; R3 retains full evidence + ≥2 alternatives + independent challenge |
| Drift surface | Body section order has exactly 1 source of truth (the template); agent prompt contains 0 baked-in body structure |
| Backward compatibility | 100% of existing-template records remain valid; legacy planning-summary tag/fields accepted via alias |
| Reference integrity | 0 stale `@architect` references after sweep; Claude plugin regenerated and in sync |
| Dogfood | ADR-0001 exists, recording GH-46's RD-1…RD-14 |

### 4.2 Non-Goals

- **NG-1**: A decision verifier agent + `/verify-decision` + `/decision-retro` (verification/retrospective lifecycle). Deferred (RD-13).
- **NG-2**: JSON schemas + validator/index tools (`validate-decision-record`, `generate-decision-index`). Deferred (RD-13).
- **NG-3**: Eighteen per-domain YAML checklists under a catalog directory. v1 uses a condensed master driver checklist + per-type matrix **in the guide** (RD-14).
- **NG-4**: Structured evidence-ledger YAML. v1 tightens existing prose FACT/ASSUMPTION/UNKNOWN discipline + source references (RD-13).
- **NG-5**: Probabilistic forecasting / Brier-calibration fields.
- **NG-6**: A dedicated `@decision-researcher` (reuse `@external-researcher`).
- **NG-7**: Migrating/backfilling existing records (none exist; new fields are optional).
- **NG-8**: Reordering the decision-record template body sections. GH-60 settled the order; this change **adds** optional front matter + proportional rendering only (RD-3, RD-13).
- **NG-9**: Splitting GH-46 into multiple tickets (RD-5).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Universal decision kernel (D0–D14) | A stable, type-neutral lifecycle shared by all significant decisions; standardizes *what* happens without prescribing identical depth (G-1) |
| F-2 | Proportional rigor profiles (R0–R3) + emergency overlay | Scale method, ceremony, evidence, and output to the decision's conditions so routine stays fast and high-stakes gets rigor (G-2) |
| F-3 | Four-axis decision classification & routing | Route by type / domain tags / archetype / conditions — not collapsed to record prefix — to drive rigor, method, and authority (G-1, G-2) |
| F-4 | First-class decision rights (DACI-style) | Make driver/decider/contributors/reviewers/performers/informed explicit in planning and record (G-4) |
| F-5 | Bounded AI-authority model | Define allowed AI roles, autonomous-action bounds, recommendation≠decision, privacy/provenance (G-5) |
| F-6 | Unified domain-neutral orchestrator agent (`@decision-advisor`) | Rename/rewrite `@architect`; type-aware context; triage→classify→rigor→rights→planning; no baked-in structure; preserves recommendation/decision separation; requests human approval for R2/R3 (G-3, G-8) |
| F-7 | Independent challenge (`@decision-critic` + `/review-decision`) | Read-only challenger independent of the advisor; returns a verdict; addresses automation-bias/same-model non-independence (G-3) |
| F-8 | Process-first Decision-Making Guide | Supersedes the artifact-centric guide; kernel, rigor, triage, rights, AI authority, per-type matrix, constraints/drivers discipline (G-6, G-8) |
| F-9 | Rigor-aware decision-record template (additive) | Optional classification/governance/AI front matter + proportional-rendering guidance; fix GH-60 defects (G-2, G-8) |
| F-10 | Generalized decision commands | `/plan-decision` gains triage→rights and a generic summary tag (with back-compat alias); `/write-decision` renders proportionally, records AI assistance, enforces recommendation≠decision, won't auto-Accept R2/R3 (G-1, G-5) |
| F-11 | Meeting decision integration | `@meeting-organizer` + meeting guide route durable decisions into the workflow; document three decision modes (G-7) |
| F-12 | Repo-wide reference sweep + plugin regeneration | Every `@architect` reference → `@decision-advisor`; update inbound links to renamed guide; regenerate Claude plugin (G-3, G-8) |
| F-13 | Dogfood | Record GH-46 as ADR-0001 via the new process (G-9) |

### 5.1 Capability Details

**F-1 — Universal decision kernel (D0–D14).** Every R1–R3 decision runs this lifecycle; depth varies by rigor profile:
- **D0 Trigger & Triage** — what/why-now, deadline, proposed type, domains, archetype, conditions, rigor, emergency?, already-resolved-by-policy?
- **D1 Decision Charter & Rights** — DACI roles, deadline, escalation authority.
- **D2 Context & Evidence** — repo docs, config, prior decisions, metrics, research, contracts, regulations; maintain FACT/ASSUMPTION/UNKNOWN discipline + source references.
- **D3 Problem Framing & Outcomes** — current state, trigger, root cause vs symptom, decision question, desired outcomes, scope, non-goals, horizon, stakeholders.
- **D4 Constraints & Guardrails** — each constraint as a pass/fail test with source, verification, negotiability (kept distinct from drivers).
- **D5 Drivers & Value Model** — candidate drivers from the master checklist; priority/direction/proxy; optional justified weights.
- **D6 Assumptions, Unknowns & Information Value** — impact-if-false, confidence, validation; ask whether a pilot/spike/experiment or staging can cheaply reduce uncertainty.
- **D7 Alternative Generation** — include ALT-0 baseline; ≥2 substantive alternatives for R2/R3; meaningfully distinct; include build/buy/partner/postpone/experiment/stop where relevant.
- **D8 Feasibility & Constraint Filter** — screen on constraints first; no weighted score rescues an ineligible option.
- **D9 Analysis Method Selection & Evaluation** — choose method by routing (qualitative trade-off, MCDA, cost-benefit, EV, decision tree, scenario, sensitivity, real-options, experiment, threat model, privacy impact, premortem, reference-class forecasting).
- **D10 Adversarial Challenge** — valuable for R2, mandatory for R3; performed independently before the reviewer sees the preferred conclusion where practical.
- **D11 Recommendation & Decision (separated)** — analyst recommendation vs authorized decision; rationale; constraint attestation; accepted-risk exceptions; dissent; confidence justified by evidence (AI-generated confidence is not evidence).
- **D12 Execution & Communication** — high-level implications, accountable performer, rollout stages, guardrails, rollback, dependent changes, communications.
- **D13 Verification & Revisit** — leading/lagging/guardrail metrics, targets, window, review date, invalidation triggers.
- **D14 Retrospective & Calibration** — separate process quality, evidence quality, execution quality, realized outcome, and luck/variance; avoid outcome bias.

**F-2 — Rigor profiles + emergency overlay.**
- **R0 (Routine/Delegated):** local, easily reversible, covered by policy/precedent. No record; optional note/commit/ticket comment. AI may act within explicit delegated bounds.
- **R1 (Lightweight):** low–medium impact, reversible, limited stakeholders, manageable uncertainty, no major legal/security/privacy/financial exposure. Concise brief — problem, constraints, top drivers, baseline + ≥1 option, choice + rationale, owner, revisit trigger. Target cycle: minutes to 1 business day.
- **R2 (Standard):** meaningful trade-off, may be questioned, multi-team, material cost, useful to gather evidence. Full canonical record + evidence + ≥2 alternatives + baseline + roles + method + assumptions/uncertainty + verification + review date. Target cycle: days.
- **R3 (High Assurance):** hard-to-reverse, critical/financial/security/privacy/legal/safety/ethical, org-wide, or deep-uncertainty + large downside. Adds independent reviewer/critic, domain sign-off, source verification, premortem, scenario/sensitivity, explicit dissent, guardrails, rollback, **human final decision**, deadline, escalation, formal review date.
- **Emergency overlay:** immediate action to contain an incident/prevent harm/restore service/meet a deadline. Sequence — declare owner+authority → act to stabilize → record facts/assumptions/actions/timestamps → constraints + stop-conditions → reassess → complete the normal record retrospectively → post-review. **Changes sequencing, not accountability.**

**F-3 — Four-axis classification & routing.** Type (ADR/PDR/TDR/BDR/ODR) × domain tags (strategy, product, UX, pricing, architecture, security, privacy, finance, operations, …) × archetype (selection, design, prioritization, allocation, policy, standard, threshold, forecast_commitment, experiment, go_no_go, exception_waiver, incident_response, negotiated_choice, sunset_reversal) × conditions (Cynefin environment, reversibility, stakes, urgency, uncertainty, blast radius, recurrence, evidence maturity, stakeholder diversity, external obligations). These axes drive rigor, method, and authority; they are not collapsed to a single "type."

**F-4 — Decision rights.** DACI-style roles captured at D1 and surfaced in the record: Driver (coordinates), Decider/Approver (one accountable authority), Contributors (expertise/evidence), Required reviewers/agreers (verify mandatory requirements), Performers (execute), Informed (notified). The guide specifies who typically decides per type and risk; high-stakes decisions may require cross-domain approval based on risk, not prefix.

**F-5 — Bounded AI-authority model.** Allowed AI roles: facilitator, researcher, repository analyst, evidence organizer, option generator, analyst, simulator, critic, record writer, verification monitor. AI may make a final decision **only when all** are true: authority explicitly delegated; decision is R0 or defined R1; boundaries machine-checkable; reversal easy; blast radius limited; audit trail exists; escalation path exists. AI must **not** be sole final authority for R3, legal/regulatory interpretation, material financial commitments, employment/individuals, safety-critical choices, privacy rights, irreversible architecture/strategy, active security risk acceptance, or ethical trade-offs affecting people. Multiple AI agents using the same model+prompt lineage do **not** constitute independent evidence. Provenance metadata records roles used, whether external data was shared, whether citations were verified, and the human decider/reviewers.

**F-6 — `@decision-advisor`.** Domain-neutral orchestrator (renamed from `@architect`; no separate `@architect` retained — architecture depth is the advisor's type-aware context mode that reads specs/contracts/config/source). Type-aware context modes: ADR/TDR → specs/contracts/source; PDR → roadmap/UX; BDR → strategy/ICP/pricing; ODR → runbooks/infra. Runs triage → classify → rigor → rights → planning. **References the template for body structure rather than baking it in.** Preserves recommendation/decision separation; requests human approval for R2/R3.

**F-7 — `@decision-critic` + `/review-decision <ID>`.** Read-only independent challenger: detects framing errors, missing options, violated constraints, fragile assumptions/arbitrary weights, runs a premortem, identifies stakeholder harm, flags unsupported certainty and automation bias. Returns **PASS / PASS_WITH_RISKS / REWORK**. `/review-decision` produces a review artifact/verdict, is read-only by default, and is independent of the advisor (the critic receives problem/evidence/constraints/options and, where practical, not the recommendation initially).

**F-8 — Decision-Making Guide.** New process-first guide (supersedes the records-management guide, which is demoted to a record-artifact reference): (1) When to decide (record-worthiness, R0 escape hatch); (2) the kernel D0–D14; (3) R0–R3 + emergency; (4) four-axis classification → routing; (5) decision rights; (6) AI authority model; (7) per-type nuance matrix (context anchors, typical approver, fitting framework) — condensed, not 18 files; (8) constraints vs drivers discipline (GH-60 fixes); (9) the record artifact (naming/front matter/lifecycle — demoted); (10) agent & command integration.

**F-9 — Rigor-aware template (additive).** Adds **optional** front matter: classification (domains/archetype/environment/rigor/reversibility/stakes/urgency/uncertainty/blast-radius/recurrence), governance (driver/decider/contributors/reviewers/performers/informed), `ai_assistance`, `review_date`/revisit triggers. Adds proportional-rendering guidance (R1 compact subset / R2 standard / R3 full). Fixes GH-60 defects: neutralize "non-negotiable" → use `negotiable: no` consistently; drop "constraints" from the *Context* description; standardize the per-alternative heading wording across all sources. Existing extended-metadata fields remain valid.

**F-10 — Generalized commands.** `/plan-decision`: adds triage → classify → select rigor → assign rights; emits a generic `<decision_planning_summary>` with a back-compat alias for the legacy `<technical_decision_planning_summary>` tag and `adr.*` fields; **keeps** the GH-60 hard-requirements elicitation step. `/write-decision`: consumes the generic summary; renders proportionally (R1/R2/R3); records `ai_assistance`; enforces recommendation≠decision; does **not** mark Accepted without an authorized human decision (especially for R2/R3).

**F-11 — Meeting integration.** `@meeting-organizer` and the meeting guide: route meeting discussion as evidence input to `/plan-decision`; route durable meeting decisions to `/write-decision`; reference `@decision-advisor` (not `@architect`); document three decision modes — (a) interactive AI session, (b) meeting-driven, (c) delegated AI autonomous within R0–R1 bounds.

**F-12 — Reference sweep + plugin regen.** Update every `@architect` reference repo-wide (orchestration, spec/plan writers, coder, bootstrapper, meeting organizer, PM instructions, top-level docs, READMEs, guides, feature specs, templates) to `@decision-advisor`; update inbound links to the renamed guide; regenerate the generated Claude Code plugin via the build script so source and generated output stay in sync.

**F-13 — Dogfood.** Produce ADR-0001 recording GH-46's decisions (RD-1…RD-14) using `/plan-decision` + `/write-decision` against the new process.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Standard decision (R2):
  Requester invokes /plan-decision
    → @decision-advisor triages (record-worthy? R0 escape?) and classifies (4 axes)
    → selects rigor (R2), assigns decision rights (DACI), runs D2–D9
    → emits <decision_planning_summary>
  Requester runs /write-decision
    → renders R2 record, records ai_assistance, keeps recommendation≠decision (Proposed)
  Requester runs /review-decision <ID>
    → @decision-critic independently challenges (D10) → PASS | PASS_WITH_RISKS | REWORK
  Authorized human decides → record advances to Accepted

Flow 2 — Lightweight decision (R1):
  /plan-decision → advisor triages to R1 → concise brief (problem, constraints, top drivers, baseline + ≥1 option, choice+rationale, owner, revisit trigger)
  /write-decision renders the compact R1 subset → resolved within ≤ 1 business day

Flow 3 — Routine (R0):
  No record; optional note/commit/ticket comment; AI may act within delegated bounds

Flow 4 — Emergency overlay:
  Declare owner+authority → act to stabilize → record facts/assumptions/timestamps → set stop-conditions → reassess → complete normal record retrospectively → post-review

Flow 5 — Meeting-driven decision:
  @meeting-organizer summarizes meeting → meeting discussion becomes evidence input to /plan-decision → durable decision → /write-decision
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Universal decision kernel (D0–D14) and rigor profiles R0–R3 + emergency overlay (F-1, F-2).
- Four-axis classification & routing (F-3).
- First-class decision rights (DACI) in planning + record (F-4).
- Bounded AI-authority model (F-5).
- Rename + rewrite `@architect` → `@decision-advisor` (no separate architect retained); new `@decision-critic` (F-6, F-7).
- Process-first Decision-Making Guide; rigor-aware additive template; GH-60 defect fixes (F-8, F-9).
- `/plan-decision` + `/write-decision` generalization; new `/review-decision` (F-7, F-10).
- Meeting integration + three decision modes (F-11).
- Repo-wide reference sweep + Claude plugin regeneration (F-12).
- ADR-0001 dogfood (F-13).

### 7.2 Out of Scope

- [OUT] Decision verifier agent and `/verify-decision`, `/decision-retro` (NG-1).
- [OUT] JSON schemas and validator/index tools (NG-2).
- [OUT] Eighteen per-domain YAML checklists; v1 uses a condensed master checklist + per-type matrix in the guide (NG-3).
- [OUT] Structured evidence-ledger YAML; v1 tightens prose FACT/ASSUMPTION/UNKNOWN discipline (NG-4).
- [OUT] Probabilistic forecasting / Brier calibration fields (NG-5).
- [OUT] Dedicated `@decision-researcher` (NG-6).
- [OUT] Migrating/backfilling records (NG-7).
- [OUT] Reordering the template body sections (NG-8).
- [OUT] Splitting GH-46 into multiple tickets (NG-9).

### 7.3 Deferred / Maybe-Later

- A future "Decision Intelligence" lifecycle ticket could add the verifier/retro commands, JSON schemas, catalog YAML, evidence-ledger YAML, and forecasting fields together (RD-13).
- A future specialist-agent routing layer (security/product/finance/privacy/data reviewers) can plug into the advisor's type-aware context modes once the extension points exist.
- Lightweight vs. standard templates may later split if proportional rendering of one template proves insufficient (see OQ-A).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP endpoints. This change touches agent prompts, commands, Markdown guides, and templates only.

### 8.2 Events / Messages

N/A — no event/message contracts.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Optional `classification` front-matter block | domains, archetype, environment, rigor (R0–R3), reversibility, stakes, urgency, uncertainty, blast radius, recurrence — drives routing & rendering |
| DM-2 | Optional `governance` front-matter block | driver, decider, contributors, reviewers, performers, informed (DACI roles) |
| DM-3 | Optional `ai_assistance` front-matter block | used, roles, external_data_shared, citations_verified, human_decider, reviewers |
| DM-4 | Optional review/revisit metadata | `review_date` plus revisit triggers |
| DM-5 | Generic planning-summary tag | `<decision_planning_summary>` as the new canonical tag, with a back-compat alias accepting the legacy `<technical_decision_planning_summary>` tag and `adr.*` fields |

All additions are **optional**; existing records and existing front matter remain valid.

### 8.4 External Integrations

N/A. (The research basis is local and git-ignored; it is not referenced in deliverables. No external APIs/services are introduced.)

### 8.5 Backward Compatibility

- Existing decision records authored with the current template remain valid; new fields are optional and additive.
- Existing planning summaries using the legacy `<technical_decision_planning_summary>` tag and `adr.*` fields continue to be accepted via an explicit back-compat alias mapping to the generic summary fields (no behavior change for legacy flows).
- The agent rename is documented in a migration note; inbound references are swept so no dangling `@architect` links remain. See NFR-2, NFR-3.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Proportionality — rigor profiles must demonstrably scale ceremony | R0 mandatory record count = 0; R1 required output is a strict proper subset of R3; R1 cycle ≤ 1 business day; R2/R3 retain full evidence + ≥2 alternatives + baseline + review date |
| NFR-2 | Backward compatibility | 100% of existing-template records remain valid; legacy planning-summary tag and `adr.*` fields accepted via alias with 0 behavior change |
| NFR-3 | No architecture-bias leakage | Domain-neutral path emits the generic `<decision_planning_summary>`; 0 `adr.*` required fields in the generic path; type defaults to ADR only when type is genuinely unspecified |
| NFR-4 | Cross-source section-order consistency (GH-60 NFR-1) preserved | Exactly 1 source of truth for body section order (the template); section order identical across the template and the write command's structure definition — 0 mismatches |
| NFR-5 | Git-native, no proprietary runtime | All artifacts are Markdown + YAML front matter; 0 new runtime services; 0 proprietary-binary artifacts |
| NFR-6 | No hidden chain-of-thought | Records capture decision + rationale + assumptions only; 0 stored raw model chain-of-thought/logs in committed records |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A. The subsystem is documentation + agent prompts; no runtime metrics, logs, traces, or alerts are introduced. The `ai_assistance` provenance block (DM-3) provides human-readable auditability of which AI roles were used, whether external data was shared, and whether citations were verified.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Agent rename breaks inbound references / user muscle memory | M | M | Full repo-wide reference sweep; migration note; CI gate that regenerates and verifies the Claude plugin is in sync | L |
| RSK-2 | Removing baked-in structure lets the agent drift from required section order | M | M | Agent references the template; section-order consistency checked across the reduced source set (NFR-4); dogfood ADR-0001 exercises it end-to-end | L |
| RSK-3 | Over-engineering — pulling in deferred machinery (catalogs, schemas, verifier) from the 3.3k-line research basis | M | M | RD-13 explicit defer list enforced as Out-of-Scope; NFR-1 proportionality gate; condensed guide (RD-14) | L |
| RSK-4 | `@decision-critic` independence is illusory (same model/prompt lineage) → false assurance | H | M | Guide states same-model ≠ independent evidence; critic receives problem/evidence/options without the recommendation where practical; recommend a different model or human reviewer for R3 | M |
| RSK-5 | Proportional rendering ambiguity → inconsistent R1 records | L | M | Template carries proportional-rendering guidance; guide defines the explicit R1 subset; one-template approach (OQ-A lean) minimizes drift | L |
| RSK-6 | Backward-compat break for any consumer of the legacy summary tag/fields | L | L | Explicit back-compat alias mapping (DM-5, NFR-2) | L |
| RSK-7 | Recommendation/decision boundary eroded by AI auto-accepting R2/R3 | H | M | `/write-decision` must not mark Accepted without an authorized human decision; `ai_assistance.human_decider` required; reviewer independence (F-7) | M |

## 12. ASSUMPTIONS

- This repository is an engineering-repo; writes to `doc/guides/` and `doc/templates/` are permitted under the profile-aware documentation-safety rules, and no `doc/business/**` content is created.
- No decision records currently exist to migrate/backfill, so new front-matter fields can be optional without remediation.
- Agent and command edits are produced via `@toolsmith` (per repo convention) and the generated Claude Code plugin is kept in sync via the build script; this spec does not prescribe low-level editing mechanics.
- `@external-researcher` continues to fulfill the research role (no dedicated `@decision-researcher` needed in v1).
- The research basis under `.ai/local/decision-process/` is local and git-ignored; its content informs this spec but is not referenced in deliverables.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-60 / PR #61 | Structural/template axis (constraints vs drivers, section order). This change is the agent/process/guide/rigor axis and fixes its carryover defects |
| Depends on | Document-templates feature | Owns the decision-record template that gains optional front matter |
| Depends on | Claude plugin build script | Regenerates the generated plugin after `.opencode/` edits |
| Complementary | GH-57 (Definition of Ready) | Would consume rigor + constraint compliance |
| Complementary | GH-58 (stakeholders/team topology) | Feeds decision-rights role assignment |
| Blocks | Future Decision-Intelligence lifecycle | Verifier/retro, schemas, catalogs, evidence-ledger YAML, forecasting (deferred, RD-13) |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-A | R1 rendering: a separate lite template vs proportional rendering of one template? | Lean: proportional rendering of one template (less drift). Affects F-9/NFR-1. | Lean confirmed (one template); finalize rendering rules during delivery |
| OQ-B | Rename the `/plan-decision` summary tag from `<technical_decision_planning_summary>` to `<decision_planning_summary>`? | Lean: yes, with a back-compat alias for the legacy tag and `adr.*` fields. Affects F-10/DM-5/NFR-3. | Lean confirmed (rename + alias); finalize alias map during delivery |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | One generalized orchestrator agent, not a domain split (RD-1) | Maximizes reuse; type-aware context modes cover domain depth without proliferating agents | 2026-06-24 |
| DEC-2 | Rename `@architect` → `@decision-advisor` (RD-2, RD-10) | Broadening-only leaves the architecture-bias discovery bug intact | 2026-06-24 |
| DEC-3 | Remove baked-in body structure from the agent; reference the template (RD-3) | Eliminates the drift source that caused GH-60's collision; single source of truth | 2026-06-24 |
| DEC-4 | Convert the records guide into a process-first Decision-Making Guide (RD-4) | Moves the decision *process* into public docs, not just the record artifact | 2026-06-24 |
| DEC-5 | Consolidate all decision-making work into GH-46 (RD-5) | Avoids fragmenting a tightly-coupled capability across tickets | 2026-06-24 |
| DEC-6 | Dogfood — record GH-46 as ADR-0001 (RD-6) | Validates the new process on its own delivery | 2026-06-24 |
| DEC-7 | Adopt universal kernel + adaptive playbooks; adopt R0–R3 + emergency overlay (RD-7) | Standardizes what happens while scaling depth to context | 2026-06-24 |
| DEC-8 | Decision rights (DACI) first-class in record + planning (RD-8) | Makes accountability explicit (the GH-46 "clear boundaries" ask) | 2026-06-24 |
| DEC-9 | Bounded AI authority: AI acts only within delegated/reversible/bounded R0–R1 + audit + escalation; R2/R3 require human final decision; recommendation ≠ decision (RD-9) | Keeps a human accountable for material/irreversible decisions; mitigates automation bias | 2026-06-24 |
| DEC-10 | Agent name = `@decision-advisor` (RD-10) | Resolves the prior open question on the orchestrator name | 2026-06-24 |
| DEC-11 | v1 includes lean `@decision-critic` + `/review-decision` (RD-11) | Provides independent challenge as an R3 governance primitive | 2026-06-24 |
| DEC-12 | Meeting integration via `@meeting-organizer` + meeting guide (RD-12) | Routes durable meeting decisions into the workflow; recognizes meeting discussion as evidence | 2026-06-24 |
| DEC-13 | Defer verifier/retro commands, schemas/validators, 18 catalogs, evidence-ledger YAML, forecasting, `@decision-researcher` (RD-13) | Right-sizes v1 for ADOS efficiency; avoids over-engineering | 2026-06-24 |
| DEC-14 | Condensed master driver checklist + per-type matrix live in the guide, not 18 catalog files (RD-14) | Keeps v1 maintainable; catalogs can be added later | 2026-06-24 |
| DEC-15 | OQ-A — proportional rendering of one template (no separate lite template) | Minimizes drift (NFR-1); confirmed lean | 2026-06-24 |
| DEC-16 | OQ-B — rename summary tag to `<decision_planning_summary>` with back-compat alias | Removes architecture bias (NFR-3) while preserving backward compatibility (NFR-2) | 2026-06-24 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Architect agent (→ `@decision-advisor`) | Renamed + rewritten (domain-neutral, type-aware, no baked-in structure) |
| Decision-critic agent | New (read-only independent challenger) |
| `/plan-decision` command | Generalized (triage→rights; generic summary tag + alias) |
| `/write-decision` command | Generalized (proportional rendering, ai_assistance, recommendation≠decision) |
| `/review-decision` command | New (independent review via `@decision-critic`) |
| Decision-Making Guide | New (supersedes records-management guide) |
| Decision-records-management guide | Demoted to record-artifact reference / superseded |
| Decision-record template | Updated (optional front matter, proportional rendering, GH-60 fixes) |
| `@meeting-organizer` agent + meeting guide | Updated (decision integration, three modes, `@decision-advisor` reference) |
| Feature spec: decision records | Updated (agent rename, new capabilities) |
| Feature spec: document templates | Updated (template changes) |
| PM instructions + orchestration/spec/plan/coder/bootstrapper agents + top-level docs | Reference sweep (`@architect` → `@decision-advisor`) |
| Generated Claude Code plugin | Regenerated and kept in sync |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-GH46-1 | **Given** the orchestrator agent, **when** it is invoked for any decision type, **then** it is named `@decision-advisor` (renamed from `@architect`), its identity is domain-neutral, it explicitly owns all five types, and its prompt contains no baked-in body structure (it references the template). | F-6, NFR-3, NFR-4 |
| AC-GH46-2 | **Given** a high-stakes decision, **when** independent challenge is requested, **then** a read-only `@decision-critic` exists, is independent of the advisor, and returns PASS / PASS_WITH_RISKS / REWORK. | F-7 |
| AC-GH46-3 | **Given** a decision request, **when** `/plan-decision` runs, **then** it performs triage, four-axis classification, rigor selection, and decision-rights assignment, and emits a `<decision_planning_summary>` while still accepting the legacy `<technical_decision_planning_summary>` tag and `adr.*` fields via alias. | F-10, DM-5, NFR-2, NFR-3 |
| AC-GH46-4 | **Given** a planning summary, **when** `/write-decision` runs, **then** it renders proportionally (R1/R2/R3), records `ai_assistance`, keeps recommendation separate from decision, and does not mark Accepted for R2/R3 without an authorized human decision. | F-10, DM-3, NFR-1 |
| AC-GH46-5 | **Given** a drafted decision record, **when** `/review-decision <ID>` runs, **then** `@decision-critic` produces an independent review artifact/verdict and modifies nothing. | F-7 |
| AC-GH46-6 | **Given** the documentation set, **when** a reader opens the Decision-Making Guide, **then** it contains the kernel (D0–D14), R0–R3 + emergency overlay, four-axis classification, decision rights, the AI-authority model, a per-type nuance matrix, and constraints/drivers discipline. | F-1, F-2, F-3, F-4, F-5, F-8 |
| AC-GH46-7 | **Given** the decision-record template, **when** a rigorous (R3) record is authored, **then** optional classification/governance/AI front matter and proportional-rendering guidance are present, and all GH-60 wording defects are fixed ("non-negotiable" neutralized to `negotiable: no`; "constraints" removed from the *Context* description; per-alternative heading standardized). | F-9, NFR-4 |
| AC-GH46-8 | **Given** a routine reversible decision, **when** it is triaged, **then** R0 produces no record (optional note only) and R1 produces a strict proper subset of the R3 output resolvable within one business day. | F-2, NFR-1 |
| AC-GH46-9 | **Given** the AI-authority model, **when** an AI-assisted decision is recorded, **then** allowed AI roles and autonomous-action bounds are defined, AI may autonomously decide only within delegated/reversible/bounded R0–R1 with audit + escalation, R2/R3 require a human final decision, and recommendation is distinct from decision. | F-5, NFR-6 |
| AC-GH46-10 | **Given** a meeting that reaches a durable decision, **when** `@meeting-organizer` summarizes it, **then** the discussion is usable as evidence input to `/plan-decision`, durable decisions route to `/write-decision`, the guide references `@decision-advisor`, and three decision modes are documented. | F-11 |
| AC-GH46-11 | **Given** the repository, **when** the reference sweep completes, **then** every `@architect` reference is updated to `@decision-advisor`, inbound links to the renamed guide are updated, and the generated Claude plugin is regenerated and in sync. | F-12, NFR-5 |
| AC-GH46-12 | **Given** the reduced source set after removing baked-in structure, **when** section order is checked, **then** the template remains the single source of truth and the write command's structure definition matches it with zero mismatches (GH-60 NFR-1 preserved). | F-6, F-9, NFR-4 |
| AC-GH46-13 | **Given** the new process, **when** GH-46 is recorded, **then** ADR-0001 exists and captures decisions RD-1…RD-14. | F-13 |
| AC-GH46-14 | **Given** any existing decision record authored with the current template, **when** the change lands, **then** the record remains valid and no proprietary runtime or stored raw chain-of-thought is introduced. | DM-1, DM-2, DM-3, NFR-2, NFR-5, NFR-6 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

Deliver in coherent phases (detailed in the implementation plan): (1) foundational model content — kernel, rigor profiles, classification, rights, AI-authority model captured in the new guide and additive template (including GH-60 defect fixes); (2) agent topology — rename/rewrite `@architect` → `@decision-advisor` and add `@decision-critic`; (3) command generalization — `/plan-decision`, `/write-decision`, new `/review-decision`; (4) meeting integration; (5) repo-wide reference sweep with Claude plugin regeneration and sync verification; (6) dogfood ADR-0001. Merge as one change on a feature branch. Communication: a migration note documents the agent rename and the generic planning-summary tag (with its back-compat alias). Adoption is immediate for new decisions; no migration of historical records is required (none exist).

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. No records exist to migrate. New optional front-matter fields are additive and require no seeding. The only new seeded artifact is ADR-0001 (the dogfood record of GH-46's own decisions).

## 20. PRIVACY / COMPLIANCE REVIEW

The `ai_assistance` provenance block (DM-3) records whether external data was shared and whether citations were verified, supporting privacy/provenance goals. The AI-authority model (F-5) requires classifying data sensitivity and redacting secrets/personal data before external AI processing and forbids persisting sensitive prompts unless authorized. No personal data is collected, stored, or transmitted by this change.

## 21. SECURITY REVIEW HIGHLIGHTS

No new system access, secrets, or network calls are introduced (NFR-5). The relevant security-adjacent control is governance: the bounded AI-authority model (F-5) explicitly excludes AI as sole final authority for security risk acceptance, privacy rights, and safety-critical choices, and `/write-decision` must not auto-accept R2/R3 (RSK-7). `security_impact` is rated **low** because the change codifies decision-governance guardrails in prompts/docs but does not alter any system's access surface.

## 22. MAINTENANCE & OPERATIONS IMPACT

Removing the baked-in body structure reduces the drift surface to one source of truth (the template), lowering long-term maintenance cost (NFR-4). Proportional rigor reduces ceremony overhead for routine decisions (NFR-1). Future decision-lifecycle features (verifier/retro, schemas, catalogs) have a defined home as deferred follow-ups (RD-13). The agent rename requires a one-time reference sweep; thereafter the CI gate that regenerates the Claude plugin also guards reference staleness.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Decision kernel (D0–D14) | The 15-stage, type-neutral decision lifecycle shared by all significant decisions; depth varies by rigor |
| Rigor profile (R0–R3) | Calibrated ceremony level: R0 routine/delegated, R1 lightweight, R2 standard, R3 high assurance |
| Emergency overlay | A re-sequencing of the kernel for incidents/deadlines (act → stabilize → record retrospectively); changes sequencing, not accountability |
| Four-axis classification | Type × domain tags × archetype × conditions, used to drive routing |
| Decision rights (DACI) | Driver, Approver/Decider, Contributors, Informed (+ reviewers, performers) |
| `@decision-advisor` | The renamed/generalized domain-neutral orchestrator agent (formerly `@architect`) |
| `@decision-critic` | A read-only independent challenger returning PASS / PASS_WITH_RISKS / REWORK |
| Archetype | Decision shape (selection, policy, go_no_go, incident_response, …) |
| Blast radius | The scope affected by a decision (local → customers/market) |
| Automation bias | The tendency to over-trust automated/AI output; mitigated by independent challenge |
| Recommendation vs decision | The analyst/AI recommendation is always distinct from the authorized (often human) decision |

## 24. APPENDICES

- **Appendix A — Rigor profiles at a glance:** R0 no record (delegated, reversible, policy-covered); R1 concise brief, ≤ 1 day; R2 full canonical record, days; R3 full record + independent challenge + human final decision + review date.
- **Appendix B — Kernel index:** D0 Triage · D1 Charter & Rights · D2 Context & Evidence · D3 Framing & Outcomes · D4 Constraints · D5 Drivers · D6 Assumptions/Unknowns · D7 Alternatives · D8 Feasibility Filter · D9 Method & Evaluation · D10 Adversarial Challenge · D11 Recommendation & Decision · D12 Execution · D13 Verification & Revisit · D14 Retrospective.
- **Appendix C — AI authority summary:** Allowed roles = facilitator/researcher/analyst/option-generator/critic/recorder/verification-monitor; autonomous only within delegated R0–R1 + machine-checkable bounds + easy reversal + limited blast radius + audit + escalation; never sole authority for R3/legal/financial/employment/safety/privacy/irreversible/security-risk/ethical.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-24 | @spec-writer | Initial specification for GH-46 |

---

## AUTHORING GUIDELINES

- Authored from the GH-46 ticket (authoritative scope), the PM planning summary (authoritative decisions RD-1…RD-14 and OQ-A/OQ-B leans), and the local research basis under `.ai/local/decision-process/` (the ADOS AI-Driven Decision Intelligence Framework + executive conclusion).
- The 3.3k-line research basis was **distilled**, not pasted: the kernel (D0–D14), rigor profiles (R0–R3 + emergency), four-axis model, AI-authority model, agent architecture, and command behavior were summarized tightly as feature requirements.
- Current-state claims (e.g., `@architect`'s architecture-only identity contradicting its all-five-types contract; the baked-in body structure; architecture-biased `adr.*` fields) are grounded in the actual current file contents.
- GH-60 carryover defects were verified against current files ("non-negotiable" wording coexisting with `negotiable: yes/no`; "constraints" in the *Context* description; per-alternative heading drift).
- Kept at the what/why/behavior level — no implementation tasks, file paths, or low-level mechanics (those belong in the plan). Artifact references use logical component names.
- Profile-aware doc safety applied: engineering-repo; changes confined to `doc/guides/` and `doc/templates/` (allowed); no `doc/business/**`.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-46)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-GH46-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated verbatim from linked docs (research basis distilled)
- [x] Front matter validates per front-matter rules
