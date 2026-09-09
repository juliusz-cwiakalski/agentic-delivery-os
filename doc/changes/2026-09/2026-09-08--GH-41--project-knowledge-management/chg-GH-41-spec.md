---
change:
  ref: GH-41
  type: feat
  status: Proposed
  slug: project-knowledge-management
  title: "Project Knowledge Management capability and @knowledge agent"
  owners: ["Juliusz Ćwiąkalski"]
  service: project-knowledge-management
  labels: [change, planning, "priority:high"]
  version_impact: minor
  audience: mixed
  security_impact: medium
  risk_level: high
  dependencies:
    internal: [delivery-lifecycle, documentation-system, agent-and-command-system, decision-making, bootstrapper, review-and-readiness, installer-and-distribution]
    external: ["GitHub Issues", "optional configured project knowledge systems"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Establish a trustworthy project-knowledge facade and stewardship process that gives humans and AI agents evidence-backed answers, exposes uncertainty, and turns durable knowledge defects into verified improvements of canonical sources.

## 1. SUMMARY

GH-41 introduces Project Knowledge Management as a cross-cutting ADOS capability, with `@knowledge` as the shared query and stewardship facade for humans and AI agents. The capability applies knowledge-class-specific authority, provenance, uncertainty, access, and contradiction rules; manages durable Knowledge Gaps without becoming an answer store or second backlog; and integrates bounded knowledge handling into delivery, decisions, review, inception, documentation reconciliation, contributor orientation, distribution, and multi-tool use.

The initial delivery remains Git-native and integration-agnostic. External systems are optional configured sources, while canonical resolution always occurs in the source that owns the relevant knowledge.

## 2. CONTEXT

### 2.1 Current State Snapshot

- ADOS already stores durable change and decision artifacts in Git, maintains current system truth through Documentation Reconciliation, and exposes a documentation index to humans and agents.
- The documentation handbook distinguishes current truth from raw evidence and defines safe repository profiles; this repository has no profile, so the `engineering-repo` fallback applies and business documentation remains disabled.
- The agent and command system has one canonical source and generated Claude Code representations, with installer and distribution safeguards for adopting projects.
- Project Inception creates baseline project knowledge, while the delivery lifecycle, readiness review, code review, decision process, and Documentation Reconciliation consume or update portions of it.
- Existing `OPEN-Q`, `OQ-`, and project-specific `UNK-*` identifiers have narrower phase-, change-, or unknown-specific meanings.
- ADR-0003 is a Proposed R2 recommendation for repo-local `KG-<NNNN>` identifiers. Final human acceptance is reserved for GH-41 PR review. GH-140 remains the governing dependency for broader prefix-catalogue mechanics.

### 2.2 Pain Points / Gaps

- Project knowledge is distributed across maintained documentation, executable evidence, decisions, tracker history, and optional external sources without a common query and authority model.
- Humans and AI agents can repeat searches, rely on stale prose, average conflicting claims, or guess when evidence is insufficient.
- Missing, incomplete, inaccessible, ownerless, contradictory, drifted, or hard-to-find knowledge is not handled through one durable stewardship lifecycle.
- New-contributor questions and agent uncertainty often remain ephemeral instead of improving future self-service.
- Existing change-scoped reconciliation does not provide steady-state discovery, cross-source review, gap deduplication, or resolution verification.
- External source access failures can be misclassified as absent knowledge, and raw or restricted material can be over-promoted or copied unsafely.

## 3. PROBLEM STATEMENT

Because ADOS lacks a shared, authority-aware way to query and steward project knowledge across its configured sources, human and AI knowledge consumers cannot reliably distinguish established fact from inference, conflict, access failure, or absence, resulting in unsafe guessing, repeated friction, documentation drift, and durable deficiencies that remain unresolved or are repaired in the wrong place.

## 4. GOALS

- **G-1**: Give humans and AI agents one consistent project-knowledge experience with concise answers and provenance.
- **G-2**: Make fact, inference, uncertainty, contradiction, and retrieval outcome explicit instead of allowing unsupported project claims.
- **G-3**: Make source authority depend on the knowledge class and preserve the distinction between canonical truth, supporting evidence, raw evidence, and historical material.
- **G-4**: Detect, deduplicate, route, and verify durable Knowledge Gaps while keeping canonical knowledge in its owning source.
- **G-5**: Detect contradiction, verified drift, staleness risk, discoverability, vocabulary, ownership, source-authority, and accessibility problems using evidence rather than document age alone.
- **G-6**: Integrate bounded knowledge handling into relevant ADOS roles without recursive delegation or replacement of their existing responsibilities.
- **G-7**: Provide contributor orientation through the same knowledge semantics used for ordinary human and agent queries.
- **G-8**: Preserve ADOS portability, documentation safety, generated-tool parity, installer/update behavior, and tracker-agnostic operation.
- **G-9**: Prove the capability against ten representative ADOS dogfood scenarios.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Ticket acceptance coverage | 17 of 17 GH-41 acceptance criteria have explicit Given/When/Then coverage and verification evidence before PR creation |
| Dogfood scenario completion | 10 of 10 scenarios in Appendix A pass, with retained evidence |
| Unsupported project-specific facts in evaluated answers | 0 |
| Project-specific factual claims with usable provenance in evaluated answers | 100% |
| Duplicate durable gaps for observations with the same canonical remediation | 0 across the dogfood set |
| Resolved gaps lacking original-gap verification and canonical-resolution reference | 0 |
| Existing `UNK-*`, `OQ-*`, or `OPEN-Q*` identifiers renumbered, redefined, or silently aliased | 0 |
| New durable identifier prefixes introduced by GH-41 beyond the proposed `KG` namespace | 0 |
| Raw transcripts, secrets, or restricted source content persisted by default | 0 |
| Canonical/generated tool drift or distributable-document drift | 0 at quality-gate completion |

### 4.2 Non-Goals

- **NG-1**: Build a general vector database, embedding platform, or mandatory external search service.
- **NG-2**: Build a Teams, Slack, Confluence, Jira, Google Drive, or other vendor-specific bot or adapter as a prerequisite.
- **NG-3**: Create a centralized answer file, FAQ silo, assistant-memory store, or copy of all project knowledge.
- **NG-4**: Persist every question, search, source hit, review run, or raw conversation in Git.
- **NG-5**: Replace tracker work state, Project Inception, Documentation Reconciliation, the decision process, or existing open-question mechanisms.
- **NG-6**: Prove staleness from age alone or automatically rewrite disputed canonical knowledge without review.
- **NG-7**: Deliver GH-140's broader identifier-catalogue normalization.
- **NG-8**: Solve organization-wide knowledge management beyond a configured project's scope.
- **NG-9**: Introduce mandatory query telemetry, dashboards, knowledge SLOs, or periodic review cadence.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Shared project-knowledge facade | Humans and AI agents need one semantic contract for asking project questions and receiving evidence-backed answers. |
| F-2 | Knowledge-class-specific authority and provenance | A global source ranking cannot safely resolve behavior, rationale, ownership, work status, and procedures alike. |
| F-3 | Explicit uncertainty and retrieval outcomes | Consumers must know whether evidence is sufficient, inferred, conflicting, inaccessible, not configured, or not found. |
| F-4 | Configurable project source and stewardship policy | Adopting projects need to declare source existence, authority, access, restrictions, ownership, escalation, and capture behavior without vendor assumptions. |
| F-5 | Durable Knowledge Gap model and lifecycle | Material knowledge-health defects need concise, stable, evidence-linked records that remain distinct from answers and backlog items. |
| F-6 | Canonical-remediation deduplication | Different questions may expose one defect, while similar wording may represent different defects. |
| F-7 | Evidence-based knowledge-health review | Bounded reviews must distinguish contradiction, drift, staleness risk, discoverability, ownership, vocabulary, source-authority, and accessibility problems. |
| F-8 | Canonical remediation, routing, and verified resolution | A gap is closed only when the owning source or access mechanism is improved and the original deficiency is retested. |
| F-9 | Bounded ADOS lifecycle integration | Delivery roles need a non-recursive way to query or surface material uncertainty while retaining their own authority. |
| F-10 | Contributor Orientation | New contributors need guided orientation that composes the same knowledge capability rather than creating another onboarding store. |
| F-11 | Portable distribution and navigation | The capability must remain available and consistent across supported tools and adopting projects. |
| F-12 | Scoped durable Knowledge Gap identity | Broad gaps need stable repo-local references while existing narrow identifier spaces remain unchanged and GH-140 remains authoritative for the broader catalogue. |
| F-13 | ADOS dogfood verification | Real repository scenarios are required to expose prompt, contract, navigation, integration, and stewardship defects before release. |

### 5.1 Capability Details

**F-1 — Shared project-knowledge facade.** `@knowledge` accepts ordinary project questions, identifies the consumer's task intent and knowledge class, searches narrowly before widening, and returns the direct answer first. A follow-up is asked only when it materially improves correctness, diagnosis, or access scoping. Expert users can query the agent directly; distinct review and contributor-orientation interfaces compose it rather than duplicating its reasoning model.

**F-2 — Knowledge-class-specific authority and provenance.** Authority is selected per knowledge class. Current behavior favors maintained current truth and stronger executable evidence; rationale favors accepted decisions; current work status favors the tracker; ownership favors the configured ownership source; and raw conversations remain evidence rather than instructions or canonical truth. Material project-specific claims identify their supporting sources.

**F-3 — Explicit uncertainty and retrieval outcomes.** Answers distinguish established facts from labeled inferences and unknowns. Retrieval outcomes include at least `answered`, `insufficient`, `conflicting`, `inaccessible`, `not_configured`, and `not_found`. Applicable conflicts are surfaced, not averaged. A source's age is a screening signal only.

**F-4 — Configurable project source and stewardship policy.** Project configuration can define scope, non-obvious or external source existence, authority classes, access method, sensitivity or restrictions, ownership and escalation, and gap capture policy. Standard repository sources require no exhaustive registry. Capture supports `off`, `suggest`, and `write` semantics, with `suggest` as the safe default for ordinary queries and writes allowed only when an active workflow authorizes them.

**F-5 — Durable Knowledge Gap model and lifecycle.** A gap records a material deficiency, representative sanitized context, diagnosis, evidence checked, impact, occurrence information, relationships, desired canonical resolution, status, and verification. Supported types are missing, completeness, discoverability, contradiction, drift, staleness-risk, ownership, vocabulary, accessibility, source-authority, and decision-needed. Persisted statuses are Open, Resolved, and Dismissed; tracker workflow states are not mirrored.

**F-6 — Canonical-remediation deduplication.** Before persistence, open and retained resolved/dismissed gaps are searched by intent, area, concepts, sources, and diagnosis. Two observations match when the same canonical remediation would fix both. A matched gap aggregates independent occurrence/context evidence; retries within one interaction do not count as new occurrences.

**F-7 — Evidence-based knowledge-health review.** Review is explicitly bounded by a supplied or confirmed scope. It reports healthy evidence, existing matches, candidates, contradictions, likely drift, staleness risk, discoverability and ownership issues, and recommended routing. The report is ephemeral by default; only accepted, deduplicated gaps become durable. Current-truth labels can be challenged by stronger current contracts, configuration, tests, implementation evidence, or superseding decisions.

**F-8 — Canonical remediation, routing, and verified resolution.** Documentation and navigation defects are corrected in their owning documentation; rationale gaps use the decision process; work-heavy remediation is routed through PM to the tracker; ownership and access defects go to their configured owners; and behavior discrepancies are reconciled through normal change delivery. Resolution requires evidence that the representative knowledge task now succeeds and that misleading alternatives, navigation, access, and privacy concerns are addressed.

**F-9 — Bounded ADOS lifecycle integration.** PM may query project knowledge before escalating factual questions and routes work-heavy remediation to the tracker. Readiness considers only relevant material gaps. Review surfaces durable contradictions. Decision-needed gaps route to the decision process. Bootstrapper can establish minimal selected configuration and graduate suitable durable inception findings without automatic conversion. Documentation Reconciliation checks related gaps, verifies resolution, and surfaces residual drift. Delegations return bounded evidence and cannot call themselves or bounce indefinitely.

**F-10 — Contributor Orientation.** Orientation covers project purpose, architecture, vocabulary, setup, delivery workflow, environments, observability, ownership, applicable security/compliance guidance, and the contributor's first work context according to available evidence. Questions flow through normal gap semantics. The term “Project Onboarding” remains reserved for ADOS adoption/inception.

**F-11 — Portable distribution and navigation.** The human-executable and agent-executable process guidance, templates, configuration guidance, inventories, installer/update behavior, generated Claude representation, documentation navigation, and distribution classification remain mutually consistent. Updating ADOS in an adopting project preserves project-specific knowledge configuration and gap records.

**F-12 — Scoped durable Knowledge Gap identity.** Subject to human acceptance of ADR-0003, broad durable gaps use repo-local uppercase `KG-` identifiers with a four-digit monotonic body, one committed-record allocator across all statuses, no reuse, and repository context for cross-repository references. `UNK-*`, change-local `OQ-*`, and inception `OPEN-Q*` retain their current meanings and identities. No identifiers are added for queries, signals, sources, findings, reviews, or orientation sessions.

**F-13 — ADOS dogfood verification.** Ten scenarios exercise direct answers, discoverability, missing knowledge, deduplication, distinct diagnoses, authority conflicts, drift/staleness judgment, tracker and decision routing, resolution verification, AI-agent uncertainty, and contributor orientation. Discovered implementation defects are remediated before completion, and retained evidence links each scenario to its acceptance result.

## 6. USER & SYSTEM FLOWS

**Flow 1 — Query and answer**

```text
Consumer asks a project question
  → facade identifies intent and knowledge class
  → expected authoritative sources are selected and searched narrowly
  → evidence is evaluated for authority, applicability, freshness, consistency, and access
  → direct answer with provenance is returned, or uncertainty/conflict/access limitation is stated
  → durable-gap evaluation occurs only when a material deficiency is present
```

**Flow 2 — Signal to durable gap**

```text
Knowledge signal appears
  → intent, affected area, evidence, impact, and diagnosis are distilled and sanitized
  → retained gaps are searched
  → same-canonical-remediation test matches an existing gap or permits a new one
  → capture policy decides whether to do nothing, suggest a candidate, or persist an authorized record
```

**Flow 3 — Remediation and resolution**

```text
Open gap is triaged
  → canonical owner/process is selected
  → trivial repair, normal change, decision, tracker work, or access/ownership action occurs
  → representative query or equivalent task is rerun
  → successful evidence and canonical resolution are recorded
  → gap becomes Resolved; otherwise it remains Open
```

**Flow 4 — Bounded review**

```text
Consumer requests review of a bounded area
  → applicable sources and known gaps are assessed
  → report separates verified health, conflicts, drift, staleness risk, and other candidates
  → report stays ephemeral by default
  → accepted durable candidates follow normal deduplication and capture policy
```

**Flow 5 — Lifecycle handoff**

```text
ADOS role encounters material uncertainty
  → role uses known canonical context or obtains bounded evidence from @knowledge
  → safe non-blocking work continues where possible
  → unresolved material uncertainty is surfaced
  → specialized owner receives a bounded handoff
  → recursion guard ends repeated delegation
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- A redistributable, human- and agent-executable Project Knowledge Management process and shared terminology.
- `@knowledge` query behavior, a bounded knowledge-review interface, and a contributor-orientation interface.
- Project configuration for scope, source authority and access, restrictions, ownership/escalation, and gap capture.
- An optional registry for external or non-obvious sources only.
- Knowledge Gap schema, taxonomy, lifecycle, identity, derived index convention, deduplication, routing, and resolution verification.
- Evidence-based drift, staleness-risk, contradiction, discoverability, vocabulary, ownership, source-authority, and accessibility handling.
- Bounded integration with PM, readiness, review, decision making, bootstrapper, Documentation Reconciliation, and other consumers that materially require project knowledge.
- Tool inventory, generated Claude representation, installer/update preservation, documentation navigation, distribution classification, and relevant system truth.
- Automated/static checks for machine-checkable schema, ID, inventory, generated representation, installation, update, and distribution contracts where current ADOS validation supports them.
- Ten ADOS dogfood scenarios and remediation of defects they expose.

### 7.2 Out of Scope

- [OUT] General-purpose RAG, vector search, embeddings, semantic indexing, or mandatory query telemetry.
- [OUT] Vendor-specific external adapters, chat bots, or external platform deployments.
- [OUT] An answer catalogue, raw transcript archive, assistant memory, or duplicate current-truth repository.
- [OUT] A replacement backlog or mirrored tracker workflow.
- [OUT] Automatic correction of disputed canonical artifacts outside authorized review and delivery.
- [OUT] Organization-wide or cross-project knowledge governance beyond configured repository scope.
- [OUT] Framework-wide prefix normalization, catalogue schema, and qualified-ID serialization owned by GH-140.
- [OUT] Migration, renumbering, redefinition, or silent aliasing of `UNK-*`, `OQ-*`, `OPEN-Q*`, or other live IDs.
- [OUT] A universal periodic review cadence, dashboard, ownership SLA, or knowledge SLO.
- [OUT] Business documentation, because the missing profile activates engineering-repository safety.

### 7.3 Deferred / Maybe-Later

- Semantic or embedding-assisted retrieval when deterministic search proves insufficient at scale.
- Optional Teams, Slack, Confluence, Jira, Google Drive, or other adapters.
- Cross-repository qualification syntax and catalogue metadata after GH-140 settles the general convention.
- Automated source-dependency freshness graphs and change-triggered verification.
- Knowledge-health dashboards, telemetry storage, SLOs, and domain-specific review cadences.
- A standalone external service or richer orientation experience if use evidence warrants it.
- Prospective namespace expansion before `KG-9999`, coordinated with GH-140.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. GH-41 introduces no REST or HTTP endpoint contract.

### 8.2 Events / Messages

| ID | Message | Contract |
|----|---------|----------|
| EVT-1 | Knowledge query result | Returns a direct answer when supported, source provenance for project-specific claims, and only relevant qualifications; otherwise states the applicable uncertainty or retrieval outcome. |
| EVT-2 | Knowledge Gap candidate | Returns an existing-gap match or a concise proposed diagnosis with sanitized evidence, representative context, canonical resolution home, and recommended route; it is not automatically durable. |
| EVT-3 | Knowledge review report | Returns bounded scope, sources assessed, verified healthy observations, retained-gap matches, candidates by diagnosis, conflicts, and recommended actions; ephemeral by default. |
| EVT-4 | Specialized-role handoff | Carries a bounded question, evidence, unresolved uncertainty, and requested outcome to PM, decision, reconciliation, research, or another owning role; repeated recursive handoff is prohibited. |
| EVT-5 | Resolution verification result | States whether the original gap is now resolved, cites the canonical repair and verification evidence, and identifies residual deficiencies without treating merge completion alone as proof. |

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Knowledge Source | A configured or conventionally known project source with purpose, authority classes, access method, and applicable restrictions; standard repository content need not be exhaustively registered. |
| DM-2 | Knowledge Gap | A durable knowledge-health defect with stable ID, status, type, area, concise summary, owners, timestamps, sanitized evidence, representative context, occurrence data, relationships, and resolution data. |
| DM-3 | Gap Type | Closed v1 set: missing, completeness, discoverability, contradiction, drift, staleness-risk, ownership, vocabulary, accessibility, source-authority, decision-needed. |
| DM-4 | Gap Status | Closed set: Open, Resolved, Dismissed. It deliberately excludes tracker workflow states. |
| DM-5 | Resolution | Canonical source or mechanism repaired, verification time, verification notes, and related change/decision/work references; it never stores the canonical answer as a substitute. |
| DM-6 | Retrieval Outcome | Closed minimum set: answered, insufficient, conflicting, inaccessible, not_configured, not_found. |
| DM-7 | Gap Capture Policy | Project policy with `off`, `suggest`, and `write` behavior; ordinary query default is `suggest`. |
| DM-8 | Knowledge Gap Identity | Proposed repo-local `KG-<NNNN>` identity governed by ADR-0003 and subject to final human acceptance; repository context accompanies cross-repository references. |
| DM-9 | Gap Registry View | A compact derived view of gap records across all statuses; it is not an independently edited allocator or answer source. |

### 8.4 External Integrations

- GitHub Issues is used for GH-41 governance and may receive work-heavy remediation through PM; tracker status remains authoritative in the tracker.
- Other issue trackers may fulfill the same routing role through project configuration.
- External documentation, chat, drive, ownership, and operational systems are optional sources. Their adapters preserve identity, ACLs, sensitivity, authority, and provenance semantics.
- Public external factual research remains the responsibility of the external-research role; research becomes project truth only through normal synthesis, decision, and documentation processes.
- Core query, gap, review, and resolution behavior must operate when no external source is configured.

### 8.5 Backward Compatibility

- Existing ADOS query, delivery, decision, review, inception, and Documentation Reconciliation responsibilities remain valid; the knowledge capability composes with rather than replaces them.
- Existing `UNK-*`, `OQ-*`, and `OPEN-Q*` identifiers, meanings, allocators, and lifecycles remain unchanged.
- Existing projects without knowledge-specific configuration continue to operate using standard repository conventions and safe capture defaults.
- Updating an adopting project preserves repository-specific source configuration and durable gap records.
- Canonical tool definitions remain the source for generated tool representations; supported-tool behavior must remain equivalent.
- ADR-0003 remains Proposed until the repository owner accepts it through GH-41 PR review; no specification statement converts it to Accepted.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Provenance integrity | 100% of project-specific factual claims in the ten dogfood answer outputs identify supporting source(s). |
| NFR-2 | No fabrication | 0 unsupported project-specific claims are presented as fact across the ten dogfood scenarios. |
| NFR-3 | Query restraint | At most 1 follow-up question is asked before each initial dogfood answer or uncertainty result unless the consumer explicitly continues clarification. |
| NFR-4 | Data minimization | 0 raw transcripts, secrets, credentials, customer personal data, private personnel data, or unrelated restricted content are persisted by default. |
| NFR-5 | Identifier compatibility | 0 existing `UNK-*`, `OQ-*`, `OPEN-Q*`, or other live identifiers are renumbered, redefined, or silently aliased; 0 new durable prefixes beyond `KG` are introduced. |
| NFR-6 | Deduplication correctness | 100% of same-remediation dogfood observations map to one gap; 100% of different-remediation observations remain distinct. |
| NFR-7 | Resolution integrity | 100% of Resolved dogfood gaps include canonical-resolution reference and verification against the original gap statement. |
| NFR-8 | Review boundedness | 100% of knowledge reviews declare a finite scope before evaluation; 0 full external-system scans occur implicitly. |
| NFR-9 | Recursion safety | Maximum knowledge delegation depth is 1 per owning-role handoff; 0 self-delegations or repeated role-to-role bounce loops occur in dogfood scenarios. |
| NFR-10 | Multi-tool consistency | 100% of canonical knowledge interfaces represented in supported generated tooling are current at quality-gate completion. |
| NFR-11 | Distribution integrity | 100% of new or changed distributable documents carry a valid distribution class and pass current distribution/install checks. |
| NFR-12 | Dogfood quality | 10 of 10 Appendix A scenarios pass after remediation, with 0 unresolved severity-high defects attributable to GH-41. |
| NFR-13 | Access control | 0 restricted-source excerpts are copied into a more permissive repository during dogfood; all inaccessible outcomes preserve the distinction from missing knowledge. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- Query telemetry is optional and is not a prerequisite for v1.
- Ordinary questions and retrieval operations are ephemeral by default and receive no durable identifier.
- Durable observability comes from concise gap records, occurrence and last-observed information, source references, tracker/decision/change relationships, and resolution verification.
- Bounded review reports are ephemeral by default; only accepted and deduplicated gaps persist.
- Dogfood evidence records scenario outcome, relevant source provenance, candidate/match behavior, routing, and verification without retaining full conversations.
- If a project elects to measure knowledge health later, useful signals include answerability, canonical-source answerability, escalation rate, repeated underlying gaps, gap age, reopened gaps, contradictions, verified drift, and discoverability issues. No v1 success claim depends on unavailable telemetry.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The facade becomes an answer silo or second backlog. | H | M | Enforce canonical-resolution links, three gap statuses, tracker references without mirrored workflow, and no long-form resolved answers. | L |
| RSK-2 | Confident but unsupported answers cause unsafe project actions. | H | M | Require provenance, explicit retrieval outcomes, labeled inference, conflict surfacing, and no-fabrication dogfood checks. | M |
| RSK-3 | Restricted or malicious external content is copied or obeyed. | H | M | Preserve ACLs, minimize persisted evidence, treat retrieved content as evidence rather than instructions, and test inaccessible/untrusted-source behavior. | M |
| RSK-4 | Gap volume becomes noisy through one-record-per-question behavior. | M | M | Default to suggest mode, require materiality, apply the same-canonical-remediation test, and keep raw questions ephemeral. | L |
| RSK-5 | Weak age signals cause false drift findings. | M | M | Separate staleness risk from verified drift and require stronger corroborating evidence before asserting incorrectness. | L |
| RSK-6 | Broad integrations cause recursive agent loops or degraded lifecycle ownership. | H | M | Limit integrations to bounded query/signal handoffs, cap delegation depth, and preserve specialized role boundaries. | L |
| RSK-7 | Proposed `KG` rules conflict with GH-140's later general standard. | M | M | Scope identity to ADR-0003, preserve all live IDs, carry repository context, and defer catalogue schema and serialization to GH-140. | M |
| RSK-8 | Tool, installer, or documentation variants drift. | H | M | Preserve canonical/generated source discipline and require inventory, update-preservation, distribution, and dogfood gates. | L |
| RSK-9 | The large cross-cutting scope lands inconsistently. | H | M | Keep one coherent acceptance boundary, explicit role contracts, full 17-criterion traceability, ten scenarios, readiness review, and post-delivery reconciliation. | M |
| RSK-10 | Orientation is confused with ADOS Project Onboarding. | M | L | Use Contributor Orientation terminology and compose the same facade without introducing a separate knowledge architecture. | L |

## 12. ASSUMPTIONS

- ADR-0003's Proposed `KG-<NNNN>` recommendation is sufficient for planning and testing, while final authority remains with the human PR reviewer.
- GH-140 will preserve already-live identifiers or provide an explicit compatibility path rather than requiring silent renumbering.
- Deterministic repository search and configured source access are sufficient for the initial capability; embeddings are not required.
- Standard ADOS repository areas can be understood conventionally without enumerating every document in a source registry.
- Existing generated-tool and distribution checks can validate parity and installation behavior for the new capability.
- The absence of a documentation profile continues to mean engineering-repository safety with business docs disabled.
- Ten representative scenarios can validate the initial semantic contract without introducing mandatory production telemetry.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-140 | Governs the future framework-wide prefix catalogue and qualification format; it is a compatibility dependency, not a blocker for the scoped ADR-0003 proposal. |
| Depends on | ADR-0003 | Proposed R2 identity contract for broad durable Knowledge Gaps; human acceptance occurs at GH-41 PR review. |
| Depends on | Documentation system and profiles | Provides current-truth/raw-evidence semantics, navigation, distribution classification, and engineering-repository safety. |
| Depends on | Agent/command and generated-tool system | Provides canonical tool definition, inventory, supported-tool generation, and consistency checks. |
| Depends on | Delivery, decision, readiness, review, inception, and reconciliation processes | Provide bounded consumers and canonical remediation routes. |
| Depends on | Tracker integration | Owns delivery work status when remediation requires tracked work. |
| Optional | Configured external project sources | Extend retrieval but are not required for core operation. |
| Related | GH-49 | Future CLI/MCP workflows may extend link and orphan checks without blocking this capability. |
| Related | GH-33 | Inception tribal-knowledge extraction may supply signals; it does not duplicate steady-state stewardship. |
| Supersedes direction | GH-13 | Future chat access should consume this generic capability rather than establish a siloed ADOS answer bot. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | What machine-readable prefix-catalogue schema and qualified cross-repository serialization will GH-140 accept? | GH-41 requires only a stable repository-locator plus repo-local-ID semantic pair; exact shared serialization remains outside scope. | Decision needed: consult `@decision-advisor`; non-blocking and owned by GH-140. |
| OQ-2 | What prospective body-width or exhaustion rule should apply near `KG-9999`? | ADR-0003 forbids wraparound, reuse, or silent widening and requires existing four-digit IDs to remain valid. | Decision needed: consult `@decision-advisor`; deferred until capacity warrants coordination with GH-140. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Use GH-41 for the expanded first-class Project Knowledge Management capability. | The original knowledge-linking intent naturally contains the broader facade and stewardship capability, avoiding a duplicate work item. | 2026-09-08 |
| DEC-2 | Deliver the guide, facade, gap contract, bounded integrations, distribution, and dogfood as one coherent change. | Splitting these contracts would leave unusable or contradictory partial behavior; external adapters, RAG, and telemetry remain independent future work. | 2026-09-08 |
| DEC-3 | Make Project Knowledge Management a cross-cutting steady-state capability rather than a replacement for existing processes. | It observes and improves the knowledge used by delivery and inception while preserving specialized ownership. | 2026-09-08 |
| DEC-4 | Combine retrieval and stewardship in `@knowledge` for v1. | Query failures are the strongest natural signals of knowledge health, and a single semantic contract avoids divergent agents. | 2026-09-08 |
| DEC-5 | Keep canonical knowledge in its owning source and retain gaps only as diagnoses and resolution history. | This prevents an answer silo and ensures future consumers use maintained truth. | 2026-09-08 |
| DEC-6 | Use direct `@knowledge` query, bounded knowledge review, and Contributor Orientation as the minimal interfaces. | Direct query is sufficient for ordinary use; review and orientation are distinct composed workflows with user-discovery value. | 2026-09-08 |
| DEC-7 | Apply authority per knowledge class and distinguish drift from staleness risk. | Authority cannot be reduced to recency, and age alone is not evidence that content is wrong. | 2026-09-08 |
| DEC-8 | Default ordinary query capture to suggestion rather than mutation. | Consumers should not receive surprising repository changes merely for asking a question. | 2026-09-08 |
| DEC-9 | Treat GH-140 as governing but non-blocking and scope GH-41 to the needed Knowledge Gap namespace. | GH-41 can remain compatible without delivering unrelated catalogue normalization. | 2026-09-08 |
| DEC-10 | Proceed with ADR-0003's Proposed repo-local `KG-<NNNN>` contract for specification and testing, pending human PR acceptance. | The R2 recommendation defines a complete local identity boundary while retaining the required human decision right. | 2026-09-08 |
| DEC-11 | Preserve `UNK-*`, `OQ-*`, and `OPEN-Q*` as distinct mechanisms. | They represent narrower unknown, change-local, and inception-local concepts and must not be silently redefined. | 2026-09-08 |
| DEC-12 | Treat external systems as optional adapters and missing-profile behavior as engineering-repository safe. | The open-source capability must remain portable, ACL-preserving, and free of unconfigured business-document writes. | 2026-09-08 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Project Knowledge Management process | New |
| Knowledge agent and minimal query/review/orientation interfaces | New |
| Project-specific agent instructions and optional source registry | New |
| Knowledge Gap template, records, and derived registry view | New |
| PM and delivery lifecycle | Updated with bounded query and remediation routing |
| Readiness and local review | Updated with relevant-gap and contradiction handling |
| Decision-making process | Updated with decision-needed gap routing and post-decision reconciliation |
| Bootstrapper and Project Inception | Updated with optional minimal setup and selective durable-gap graduation |
| Documentation Reconciliation | Updated with related-gap detection, verification, and knowledge-area awareness |
| Documentation handbook, process navigation, indexes, and glossary | Updated |
| Canonical agent/command inventory and generated Claude tooling | Updated |
| Installer, updater, distribution, and validation safeguards | Updated |
| Current system specification | Updated with enduring capability behavior |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F11-1 | **Given** a human or agent without the delivery brief, **when** they use the redistributable Project Knowledge Management guidance, **then** they can execute the capability's terms, authority model, query workflow, gap taxonomy/lifecycle, remediation, verification, security, and Contributor Orientation behavior. | F-1, F-5, F-7, F-8, F-10, F-11 |
| AC-F8-1 | **Given** an answerable query or remediated gap, **when** knowledge is answered, captured, routed, or resolved, **then** canonical knowledge remains in its owning source and the gap contains neither an answer-store substitute nor mirrored tracker workflow state. | F-5, F-8, DM-2, DM-4, DM-5 |
| AC-F1-1 | **Given** the canonical tool inventory and supported generated tool, **when** a straightforward repository question is submitted to `@knowledge`, **then** the agent is discoverable in both environments and returns a direct answer with cited evidence. | F-1, F-11, EVT-1, NFR-1, NFR-10 |
| AC-F3-1 | **Given** facts, inferences, conflicting evidence, partial evidence, inaccessible sources, unconfigured sources, and absent results, **when** `@knowledge` evaluates them, **then** it labels their status using the appropriate uncertainty or retrieval outcome and invents no unsupported project fact. | F-2, F-3, DM-6, NFR-2 |
| AC-F4-1 | **Given** an adopting project with repository and optional external sources, **when** project knowledge policy is configured, **then** source existence, authority class, access method, restrictions, ownership/escalation, and `off|suggest|write` capture behavior are expressible without hard-coded vendor semantics or exhaustive registration of standard documentation. | F-4, DM-1, DM-7 |
| AC-F5-1 | **Given** any supported durable deficiency, **when** a Knowledge Gap candidate or record is produced, **then** its minimal schema represents the required evidence, context, lifecycle, and one of the eleven v1 deficiency types. | F-5, DM-2, DM-3, DM-4 |
| AC-F6-1 | **Given** repeated observations, retries, and similarly worded but materially different problems, **when** gap capture is evaluated, **then** the same-canonical-remediation test aggregates only independent observations of the same defect, stores no raw transcript, and a Resolved result is permitted only after verification against the original gap statement. | F-6, F-8, DM-5, NFR-4, NFR-6, NFR-7 |
| AC-F8-2 | **Given** a durable gap whose remediation is trivial or work-heavy, **when** it is triaged, **then** trivial remediation updates the proper canonical artifact or mechanism while work-heavy remediation is linked to tracker work routed through PM without tracker-state mirroring. | F-8, F-9, EVT-4, DM-4 |
| AC-F7-1 | **Given** conflicting, old, or supposedly current evidence, **when** query or review evaluates it, **then** applicable contradictions are surfaced rather than averaged, age alone produces no drift claim, and stronger current executable or superseding-decision evidence can challenge current-truth prose. | F-2, F-7, DM-3 |
| AC-F12-1 | **Given** GH-140 remains open and ADR-0003 is Proposed, **when** GH-41 uses durable gap identity, **then** only the scoped `KG-<NNNN>` namespace is proposed, existing `UNK-*`, `OQ-*`, and `OPEN-Q*` IDs remain stable and distinct, no unnecessary ID spaces are added, and final ADR acceptance remains a human PR decision. | F-12, DM-8, NFR-5 |
| AC-F9-1 | **Given** PM, readiness, review, decision, bootstrapper, Documentation Reconciliation, or another delivery role encounters material knowledge uncertainty, **when** it invokes or surfaces the knowledge flow, **then** the handoff is bounded, safe non-blocking work may continue, ownership remains with the specialized role, and no self-delegation or recursive bounce occurs. | F-9, EVT-4, NFR-9 |
| AC-F10-1 | **Given** a new contributor needs project orientation, **when** Contributor Orientation is invoked, **then** it composes `@knowledge`, covers the applicable orientation topics from authoritative evidence, feeds durable deficiencies into the normal gap flow, and does not create a separate Project Onboarding knowledge system. | F-1, F-10 |
| AC-F4-2 | **Given** an optional external source with ACLs or untrusted content, **when** its evidence is retrieved, **then** access controls and provenance are preserved, inaccessible is distinct from missing, and retrieved content is treated as evidence rather than executable instruction. | F-2, F-3, F-4, DM-6, NFR-13 |
| AC-F11-2 | **Given** all capability artifacts and tooling representations, **when** documentation, installation, update, generation, inventory, navigation, and distribution checks run, **then** profile safety and frontmatter/distribution contracts pass, generated representations match their canonical source, and adopting-project configuration and gaps are preserved. | F-11, NFR-10, NFR-11 |
| AC-F11-3 | **Given** machine-checkable Knowledge Gap schema, identity, inventory, generated-tool, installation, update, and distribution rules, **when** repository validation runs, **then** each supported rule is covered by automated or static validation and all applicable checks pass. | F-5, F-11, F-12, NFR-5, NFR-10, NFR-11 |
| AC-F13-1 | **Given** the ten scenarios in Appendix A, **when** ADOS dogfoods the delivered capability, **then** all ten pass with evidence, discovered implementation defects are remediated, deduplication and tracker/decision routing are demonstrated, and at least one resolved gap points to repaired canonical truth verified against its original statement. | F-13, EVT-5, NFR-6, NFR-7, NFR-12 |
| AC-F13-2 | **Given** delivery and dogfood remediation are complete, **when** readiness, code/documentation review, quality gates, plan completion, and Definition of Done are evaluated before PR creation, **then** each gate passes and all 17 ticket acceptance criteria are evidenced as complete. | F-11, F-13, NFR-12 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Deliver one coherent capability boundary so the process guidance, agent semantics, gap contract, integrations, tooling parity, distribution, and dogfood evidence agree at release.
- Keep ordinary query capture in safe suggestion mode unless a project explicitly selects another policy or an authorized stewardship workflow permits writes.
- Existing adopting projects remain operational without knowledge-specific configuration; optional configuration can be added when external/non-obvious sources or local authority overrides exist.
- Preserve project-specific configuration and durable gaps during ADOS updates.
- Complete all ten dogfood scenarios and remediate defects before final readiness, review, and quality-gate completion.
- Present ADR-0003 for final human acceptance during GH-41 PR review. If it is not accepted, reopen specification and dependent artifacts before merge.
- Communicate the capability through the standard documentation index, process map, agent/command inventories, and contributor guidance.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

- No bulk migration or seeding is required.
- Existing `UNK-*`, `OQ-*`, and `OPEN-Q*` records are not converted, renumbered, redefined, or silently aliased.
- Existing questions, conversations, and tracker history are not backfilled as Knowledge Gaps.
- A project creates only the minimal knowledge artifacts it needs; empty registries and gap trees are not mandatory.
- A qualifying existing unknown or inception/change question may be linked to a new broad gap only after normal materiality and deduplication review.

## 20. PRIVACY / COMPLIANCE REVIEW

- Persist only sanitized context needed to diagnose and resolve a durable gap.
- Do not persist secrets, credentials, customer personal data, sensitive personnel data, unrelated private conversation content, or full chat transcripts by default.
- Preserve source ACLs and sensitivity boundaries; a restricted source may be referenced without copying restricted substance into a more permissive repository.
- Do not store questioner identity unless required by an authorized ownership/workflow need and allowed by project policy.
- External adapter compliance remains the adopting project's responsibility, but adapters must preserve the core minimization, provenance, and access semantics.
- The open-source ADOS examples and dogfood evidence contain no company-private material.

## 21. SECURITY REVIEW HIGHLIGHTS

- Retrieved repository and external content is evidence, not an instruction source, unless explicitly configured as trusted project instructions.
- Prompt-injection text, requests to change task scope, and embedded instructions in evidence are ignored and may be reported as source-quality concerns.
- Access failure is reported honestly and does not trigger an automatic missing-knowledge classification.
- Capture policy prevents surprising repository mutation from a simple query.
- Write-capable stewardship remains subject to normal repository branch, review, and authorization boundaries.
- Bounded source selection avoids implicit broad external scans and unnecessary disclosure.
- Cross-repository references include repository context so repo-local IDs are not treated as globally unique.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Knowledge stewardship becomes continuous/reactive, change-coupled, and optionally periodic; no universal cadence is imposed.
- Owners triage material gaps to documentation, decisions, tracker work, ownership, or access processes and verify closure.
- Documentation Reconciliation checks whether a change resolves or creates relevant gaps and whether dependent current truth remains consistent.
- Resolved and Dismissed gaps are retained for allocation and historical traceability without becoming an answer archive.
- The compact registry view remains derived from records to avoid dual maintenance.
- High-severity contradictions involving security, compliance, production operations, financial behavior, or destructive procedures require prompt escalation to the owning process.
- Maintainers keep process guidance, canonical tooling, generated tooling, inventories, installer/update behavior, and system specs synchronized.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Knowledge Consumer | A human or AI agent attempting to understand or act on project knowledge. |
| Knowledge Query | A request for project-specific information; ephemeral and unnumbered by default. |
| Query Intent | The underlying task or purpose that determines what answer and sources are useful. |
| Knowledge Source | A repository or external location from which project knowledge can be retrieved. |
| Canonical Source | The source authoritative for a particular knowledge class. |
| Supporting Source | Evidence that clarifies or contextualizes but does not override canonical truth by default. |
| Raw Evidence | Unsynthesized evidence such as tickets, comments, meetings, or chat; not current truth by itself. |
| Knowledge Signal | An observation that a durable Knowledge Gap may exist. |
| Knowledge Gap | A durable, actionable defect in reliable project knowledge for a legitimate consumer. |
| Knowledge Drift | Evidence-supported mismatch between maintained knowledge and the current truth it claims to describe. |
| Staleness Risk | A reason to reverify knowledge that has not yet been proven wrong. |
| Contradiction | Materially incompatible applicable claims from two or more sources. |
| Discoverability Gap | Reliable knowledge exists but a reasonable consumer cannot find or identify it through expected paths. |
| Knowledge Resolution | A verified improvement to the proper canonical source, navigation, ownership, or access mechanism. |
| Knowledge Stewardship | Ongoing diagnosis, deduplication, triage, routing, resolution, verification, and learning from gaps. |
| Knowledge Health | The completeness, currency, consistency, discoverability, authority, and accessibility of project knowledge. |
| Contributor Orientation | A human-focused journey composed over Project Knowledge Management; distinct from ADOS Project Onboarding/Inception. |
| Same canonical remediation | The deduplication test: observations are one gap when the same owning-source repair would resolve both. |

## 24. APPENDICES

### Appendix A — Ten ADOS Dogfood Scenarios

| # | Scenario | Expected evidence and outcome | Acceptance coverage |
|---|----------|-------------------------------|--------------------|
| 1 | Direct answer: “How do I run repository tests?” | Returns the authoritative repository guidance directly with provenance; no gap is proposed. | AC-F1-1, AC-F3-1 |
| 2 | Discoverability: an existing ADOS process guide is correct but absent from expected navigation or terminology. | Returns the answer, proposes or matches a discoverability gap, and routes resolution to navigation rather than duplicate FAQ content. | AC-F6-1, AC-F7-1, AC-F13-1 |
| 3 | Missing procedure: no authoritative ADOS source establishes a required project-specific workflow. | Does not fabricate; asks at most one useful intent question; proposes a missing/completeness gap and routes material work through PM. | AC-F3-1, AC-F8-2 |
| 4 | Deduplication: two differently worded agent/contributor observations require the same canonical guide repair, while a retry occurs in one interaction. | Matches one gap, aggregates only the independent observation, and does not count the retry or create a duplicate. | AC-F6-1, AC-F13-1 |
| 5 | Distinct diagnosis: similar “How do I access X?” questions reveal missing guidance in one case and permission failure in another. | Keeps separate diagnoses and does not misclassify inaccessible evidence as missing. | AC-F3-1, AC-F4-2, AC-F6-1 |
| 6 | Authority conflict: an accepted decision conflicts with old raw discussion, while two maintained current-truth sources also expose an unresolved material conflict. | Accepted rationale outranks raw history where applicable; unresolved maintained-source conflict is explicit and routes to its owner or decision process without averaging. | AC-F7-1, AC-F9-1 |
| 7 | Drift versus age: current ADOS behavior or a canonical contract contradicts maintained prose, while another old guide still verifies correctly. | Evidence-backed mismatch becomes drift; old-but-correct guidance is not declared stale from age alone. | AC-F7-1, AC-F13-1 |
| 8 | Work-heavy remediation and verified closure: a gap requires normal tracked delivery, after which canonical guidance and navigation are repaired. | PM owns tracker routing without status mirroring; representative query succeeds; gap becomes Resolved with canonical and change references. | AC-F8-1, AC-F8-2, AC-F13-1 |
| 9 | AI-agent uncertainty and decision routing: a delivery agent cannot establish an ownership/behavior rule, and the missing answer is an unresolved decision. | Agent does not invent a convention, continues only safe non-blocking work, produces a bounded handoff to the decision process, and avoids recursion. | AC-F9-1, AC-F12-1 |
| 10 | Contributor Orientation with configured but inaccessible source. | Orientation composes `@knowledge`, answers available topics, labels the inaccessible topic without copying restricted content, and feeds only a material durable deficiency into normal gap handling. | AC-F4-1, AC-F4-2, AC-F10-1, AC-F13-1 |

### Appendix B — GH-41 Ticket Acceptance Traceability

| Ticket AC # | Specification criterion |
|-------------|-------------------------|
| 1 | AC-F11-1 |
| 2 | AC-F8-1 |
| 3 | AC-F1-1 |
| 4 | AC-F3-1 |
| 5 | AC-F4-1 |
| 6 | AC-F5-1 |
| 7 | AC-F6-1 |
| 8 | AC-F8-2 |
| 9 | AC-F7-1 |
| 10 | AC-F12-1 |
| 11 | AC-F9-1 |
| 12 | AC-F10-1 |
| 13 | AC-F4-2 |
| 14 | AC-F11-2 |
| 15 | AC-F11-3 |
| 16 | AC-F13-1 |
| 17 | AC-F13-2 |

### Appendix C — Source Basis

- GH-41 ticket, “Project Knowledge Management capability and @knowledge agent.”
- Project Knowledge Management delivery brief dated 2026-09-07.
- GH-41 PM notes and planning decisions through 2026-09-09.
- ADR-0003, “Repo-Local Durable Knowledge Gap Identifiers,” Proposed/R2.
- Current ADOS specifications for delivery lifecycle, agents and commands, Claude plugin generation, documentation profiles and distribution, bootstrapper, decision making, review, and external research.
- Current Documentation Handbook, documentation index, repository instructions, and change-specification template.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-09-09 | `@spec-writer` | Initial Proposed specification for GH-41. |

---

## AUTHORING GUIDELINES

- Authored from the GH-41 ticket, the complete planning brief, PM notes, ADR-0003, and relevant current ADOS specifications and documentation conventions.
- The ticket's 17 acceptance criteria are preserved one-to-one in Appendix B and expressed as testable Given/When/Then criteria.
- The ten dogfood scenarios consolidate the planning brief's required behaviors into real ADOS contexts without adding product requirements beyond the ticket and brief.
- Missing general catalogue and namespace-exhaustion decisions remain non-blocking open questions owned by GH-140.
- No implementation tasks, code-level instructions, or merge-request template content is included.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef`
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, EVT-, DM-, NFR-, RSK-, DEC-, OQ-)
- [x] Acceptance criteria reference at least one F-/EVT-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details, code-level paths, or step-by-step implementation tasks
- [x] Front matter validates per front-matter rules
- [x] All 17 ticket acceptance criteria have explicit traceability
- [x] All ten dogfood scenarios have acceptance-criterion traceability
- [x] `UNK-*`, `OQ-*`, and `OPEN-Q*` semantics are preserved
