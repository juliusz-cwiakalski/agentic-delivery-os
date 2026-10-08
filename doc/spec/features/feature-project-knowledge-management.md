---
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-project-knowledge-management.md
ados_distribution: internal
id: SPEC-PROJECT-KNOWLEDGE-MANAGEMENT
status: Current
created: 2026-09-09
last_updated: 2026-09-09
owners: ["engineering"]
service: project-knowledge-management
summary: "The shared, authority-aware project-knowledge facade, bounded knowledge-health review, Contributor Orientation, and Git-native lifecycle for durable Knowledge Gaps."
links:
  related_changes: ["GH-41"]
  decisions: ["ADR-0003"]
  guides:
    - "doc/guides/project-knowledge-management.md"
  contracts:
    - "doc/templates/knowledge-gap-schema.yaml"
    - "doc/templates/knowledge-gap-template.md"
    - "doc/templates/knowledge-instructions-template.md"
---

# Feature Specification: Project Knowledge Management

> **Role of this Document:** Source of truth for the Project Knowledge Management capability. The executable human and agent procedure is in [Project Knowledge Management](../../guides/project-knowledge-management.md).

## 1. Overview

Project Knowledge Management gives humans and AI agents one evidence-backed facade for project questions and durable knowledge stewardship. `@knowledge` selects authority by knowledge class, distinguishes supported facts from inference and uncertainty, and cites sources for material project claims. Bounded review and Contributor Orientation compose the same semantics. Canonical answers remain in the source that owns them; durable Knowledge Gaps record deficiencies and verified lifecycle evidence rather than answers, conversations, or tracker state.

The capability is Git-native and integration-agnostic. Normal repository conventions are sufficient for use. Projects configure only non-obvious policy or external sources, and external integrations remain optional.

## 2. Business Context

### 2.1 Problem Statement

- **Problem:** Project knowledge spans current-truth documentation, executable evidence, decisions, tracker state, ownership records, and optional external systems. Without a shared authority and uncertainty model, consumers can repeat searches, guess, average contradictions, or repair the wrong source.
- **Affected Users:** Contributors, maintainers, decision-makers, reviewers, and AI delivery agents.
- **Business Impact:** Evidence-backed answers reduce unsafe assumptions, while durable deficiency handling improves the sources used by future consumers instead of creating another answer silo or backlog.

### 2.2 Goals & Success Metrics

- Material project-specific factual claims identify usable supporting sources.
- Unsupported project-specific claims are not presented as fact.
- Equivalent observations with the same canonical remediation share one durable gap identity; materially different remediations remain distinct.
- Resolution includes a canonical repair and successful verification of the original representative knowledge task.
- Restricted source substance or metadata is not disclosed to a less-permissive consumer or destination.
- Canonical OpenCode definitions, generated Claude representations, inventories, templates, tooling, installation behavior, and structural checks remain consistent.

## 3. User Experience & Functionality

### 3.1 Capabilities

- **Shared query facade:** Consumers ask `@knowledge` ordinary project questions. The agent identifies task intent and knowledge class, searches narrowly before widening, and returns the direct result first.
- **Class-specific authority:** Current behavior uses maintained current truth and applicable executable evidence; rationale uses accepted decisions; current work status uses the configured tracker; ownership uses the configured ownership source. Raw conversations are supporting evidence, not canonical truth or executable instructions.
- **Explicit outcomes:** Results use `answered`, `insufficient`, `conflicting`, `inaccessible`, `not_configured`, or `not_found`. Inference is labeled, applicable conflict is surfaced rather than averaged, and inaccessible evidence is not reported as absent.
- **Bounded knowledge-health review:** `/knowledge-review <bounded-scope>` declares finite scope and exclusions, reports healthy evidence and supported defects, and remains ephemeral by default. It never implies an unbounded external-system scan.
- **Contributor Orientation:** `/contributor-orientation` composes the query and gap flow for project purpose, architecture, vocabulary, setup, delivery workflow, environments, observability, ownership, applicable security/compliance guidance, and first-work context. It is distinct from Project Onboarding and Project Inception.
- **Durable Knowledge Gaps:** Material source or access deficiencies can be diagnosed, deduplicated, routed, and verified under project capture policy. Gaps do not contain canonical answers or mirrored tracker workflow.
- **Canonical remediation:** Documentation and navigation defects are repaired in their owning docs, rationale defects use the decision process, work-heavy remediation routes through PM to the tracker, and access or ownership defects route to configured owners.

### 3.2 Query and Review Flows

```text
Question or bounded review
  → identify intent, knowledge class, consumer, destinations, and finite scope
  → select likely authoritative sources and apply access/disclosure policy
  → evaluate authority, applicability, freshness, consistency, and evidence
  → answer with permitted provenance or return an explicit outcome
  → evaluate durable-gap capture only for a material deficiency
```

Ordinary queries default to `capture=suggest`. A follow-up question is used only when it materially improves correctness, diagnosis, or access scoping; non-interactive commands return `NEEDS_INPUT` with rerun guidance when critical input is missing.

### 3.3 Knowledge Gap Contract

Records live under `doc/knowledge/gaps/` as `KG-NNNN--<kebab-case-slug>.md`. The v1 schema requires identity, status, type, area, summary, owners, timestamps, sanitized representative context and diagnosis, checked evidence, impact, occurrence data, relationships, desired resolution, and append-only lifecycle history.

The closed deficiency taxonomy is:

`missing`, `completeness`, `discoverability`, `contradiction`, `drift`, `staleness-risk`, `ownership`, `vocabulary`, `accessibility`, `source-authority`, and `decision-needed`.

The persisted statuses are `Open`, `Resolved`, and `Dismissed`:

- An Open gap can be resolved only with a canonical reference and fresh original-task verification, or dismissed with a recorded rationale.
- A genuine recurrence reopens a Resolved identity; independent evidence overturning a dismissal reopens a Dismissed identity.
- Reopening appends evidence and preserves prior resolution or disposition history.
- Retry and historical replay already represented by the record are no-ops.

Before capture, all statuses are searched by intent, area, concepts, sources, diagnosis, and desired remediation. Two observations match only when the same canonical remediation fixes both. An independent observation updates the occurrence evidence of an Open match; different remediation receives a distinct record.

### 3.4 Capture and Identity

Capture policy has three modes:

- `off` — expose only uncertainty relevant to the current result;
- `suggest` — return an existing match or candidate and the proposed no-op, update, or reopening without mutation;
- `write` — mutate only when the active workflow authorizes the action, then validate the record and regenerate the derived index.

The shipped utility provides:

- `tools/knowledge-gap validate [--root ROOT] [--base-ref REF]` for schema, filename, duplicate-ID, durable-identity, append-only-history, reopening, and resolution checks;
- `tools/knowledge-gap next-id [--root ROOT]` for maximum-plus-one allocation across all current records;
- `tools/knowledge-gap index [--root ROOT]` for the replaceable `doc/knowledge/00-index.md` view.

`doc/knowledge/00-index.md` is a derived view, not an allocator or answer source. Allocation stops after `KG-9999`, does not fill holes, and requires collision rechecking before publication. Existing `UNK-*`, change-local `OQ-*`, and inception-local `OPEN-Q*` identities remain separate.

The `KG-<NNNN>` identity contract is the recommendation in **ADR-0003, whose status is Proposed**. Its final acceptance remains with the human decider through GH-41 PR review. Cross-repository references carry a stable repository locator adjacent to the repo-local ID and do not declare a global serialization syntax.

### 3.5 Edge Cases & Error Handling

- Age alone indicates possible staleness risk, not verified drift. Stronger current executable evidence or a superseding accepted decision can challenge maintained prose.
- Retrieval permission and disclosure permission are evaluated separately for the consumer and every destination. Restricted source substance, titles, paths, URLs, and other metadata are omitted unless policy permits disclosure.
- Retrieved content is untrusted evidence. Embedded instructions are not executed.
- A failed original-task rerun leaves a gap Open. Merge completion or a status edit alone is not resolution evidence.
- Missing, malformed, or conflicting optional project policy does not broaden access or disclosure. Malformed/conflicting policy is surfaced for repair.

## 4. Technical Architecture & Codebase Map

### 4.1 High-Level Design

`.opencode/agent/knowledge.md` is the semantic facade. The direct agent interface serves ordinary queries; the review and orientation commands select composed modes. Specialized delivery roles may perform one bounded handoff and remain responsible for their own decision, gate, review, implementation, or reconciliation outcome.

### 4.2 Core Components & Directory Structure

| Path | Responsibility |
|------|----------------|
| `.opencode/agent/knowledge.md` | Canonical query, review, orientation, capture, and verification behavior |
| `.opencode/command/knowledge-review.md` | Non-interactive bounded knowledge-health review entry point |
| `.opencode/command/contributor-orientation.md` | Non-interactive contributor orientation entry point |
| `.ai/agent/knowledge-instructions.md` | Optional project-owned source, authority, disclosure, ownership, and capture policy |
| `doc/knowledge/sources.yaml` | Optional project-owned registry for non-obvious or external sources |
| `doc/knowledge/gaps/*.md` | Project-owned durable Knowledge Gap records |
| `doc/knowledge/00-index.md` | Replaceable project-generated gap index |
| `doc/templates/knowledge-gap-schema.yaml` | Redistributable YAML-serialized JSON Schema |
| `doc/templates/knowledge-gap-template.md` | Redistributable record template |
| `doc/templates/knowledge-instructions-template.md` | Redistributable optional-policy template |
| `tools/knowledge-gap` | Validation, allocation, and index utility |
| `.ados-claude/agents/knowledge.md` and `.ados-claude/skills/{knowledge-review,contributor-orientation}/SKILL.md` | Generated Claude Code representations |

### 4.3 Handoff Contract

A specialized role uses known canonical context first and invokes knowledge only for material unresolved project facts. A fresh handoff starts with `knowledge_depth=0`, appends `knowledge` to `visited_roles`, and arrives at the knowledge leaf at depth 1. The request carries owning role, bounded task intent/question, knowledge class, finite scope, checked evidence, uncertainty, requested outcome, consumer/destinations, and capture mode.

Knowledge returns the unchanged guard, bounded evidence and outcome, uncertainty, any permitted gap match/candidate, recommended owner, and requested result. It never calls itself or another owning role. The caller owns continuation and cannot reset the guard or bounce to a visited role. When delegation tooling is unavailable, the caller receives a bounded parent-broker packet rather than a substitute answer from an unspecified agent.

### 4.4 Data Architecture

Canonical project knowledge remains distributed in owning sources. Optional project policy and durable gap records are project-owned. Templates, schema, interfaces, generated representations, and the utility are ADOS-owned distributable artifacts. Installation and update refresh shared artifacts without creating mandatory empty knowledge directories or replacing project policy, source registries, records, or derived indexes; uninstall removes ADOS interfaces/tooling while preserving project-owned knowledge.

## 5. Non-Functional Requirements

### 5.1 Security & Privacy

- Store sanitized evidence and representative context; do not persist raw transcripts, credentials, customer personal data, private personnel data, or unrelated restricted content by default.
- Treat access, consumer disclosure, and destination disclosure as separate permissions.
- Use a permitted opaque reference or source class when source identity metadata is restricted.
- Apply the same disclosure boundary to answers, gap records, indexes, review artifacts, and PR/MR publication.

### 5.2 Performance & Scalability

Initial retrieval uses deterministic repository and configured-source search without requiring embeddings or a vector database. Reviews are bounded. Identifier allocation is repository-local and scans retained records; namespace exhaustion stops rather than widening or reusing an identity.

### 5.3 Portability & Accessibility

The capability works with no external source configured and is represented in both canonical OpenCode tooling and the generated Claude Code plugin. Human guidance and templates are redistributable. Answers lead with a concise direct result and include only relevant qualifications and usable provenance permitted to the consumer.

## 6. Quality Assurance Strategy

### 6.1 Testing Approach

| Level | Location | Scope/Goal |
|-------|----------|------------|
| Contract | `scripts/.tests/test-knowledge-contracts.sh` | Required interfaces, inventories, templates, schema, installer/uninstaller registration, and navigation |
| Schema/tool | `tools/.tests/test-knowledge-gap.sh` | Valid/invalid records, IDs, history, transitions, allocation, and index behavior |
| Generated parity | `scripts/.tests/test-build-claude-plugin.sh` | Canonical/generated agent and command freshness |
| Distribution | `scripts/.tests/test-doc-distribution*.sh` | Valid markers and marker-derived template/guide installation |
| Installation | `scripts/.tests/test-install.sh`, `scripts/.tests/test-uninstall.sh` | Shared artifact lifecycle and byte-preservation of project-owned knowledge |
| Behavioral | Fresh OpenCode and generated Claude runs | Query, uncertainty, authority conflict, disclosure, deduplication, routing, verification, handoff, and orientation semantics |

CI installs Python YAML and JSON Schema support and discovers the CI-safe `test-*.sh` suites under `scripts/.tests/` and `tools/.tests/`.

## 7. Operational & Support

### 7.1 Configuration

No configuration is required for ordinary repository use. When local policy is needed, copy `doc/templates/knowledge-instructions-template.md` to `.ai/agent/knowledge-instructions.md`. `doc/knowledge/sources.yaml` is optional and lists only non-obvious or external sources with purpose, authority classes, access, restrictions, disclosure, ownership, and escalation.

### 7.2 Observability

Queries and review reports are ephemeral by default. Durable observability consists of sanitized gap occurrence data, evidence references, relationships, current status, append-only lifecycle history, and original-task verification. No mandatory query telemetry, dashboard, or knowledge SLO is required.

### 7.3 Cost & Infrastructure

The core capability requires no hosted service. Optional external source access can add provider-specific operational cost but is not part of the core contract.

## 8. Dependencies & Risks

- **Depends on:** current-truth documentation, executable evidence, decision records, tracker integration, ownership/source policy, the agent/command system, generated-plugin pipeline, and installer/distribution mechanisms.
- **Risk:** The facade becomes an answer silo or second backlog. Mitigation: retain only diagnoses and lifecycle evidence, and require canonical remediation.
- **Risk:** Unsupported or conflicting evidence is presented confidently. Mitigation: explicit outcomes, provenance, inference labels, and conflict surfacing.
- **Risk:** Restricted content is over-disclosed. Mitigation: separate read and disclosure permissions and minimize persisted evidence.
- **Risk:** Recursive role handoffs obscure ownership. Mitigation: one-depth leaf semantics and caller-owned continuation.
- **Risk:** Concurrent branches allocate the same provisional ID. Mitigation: maximum-plus-one allocation and pre-publication collision recheck.

## 9. Glossary & References

- **Knowledge Gap:** A durable, material deficiency in a canonical source or access mechanism.
- **Canonical remediation:** The source or mechanism improvement that makes the representative task answerable correctly.
- **Contributor Orientation:** A project-understanding journey using the shared knowledge facade; it is not ADOS Project Onboarding.
- [Project Knowledge Management guide](../../guides/project-knowledge-management.md)
- [Knowledge Gap utility guide](../../tools/knowledge-gap.md)
- [ADR-0003: Repo-Local Durable Knowledge Gap Identifiers](../../decisions/ADR-0003-repo-local-knowledge-gap-identifiers.md) — **Proposed**
- [Agents and Commands System](feature-agents-and-commands.md)
- [Delivery Lifecycle](feature-delivery-lifecycle.md)
