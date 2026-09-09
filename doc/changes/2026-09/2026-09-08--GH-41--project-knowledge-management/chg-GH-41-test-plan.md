---
id: chg-GH-41-test-plan
status: Proposed
created: 2026-09-09T03:55:25Z
last_updated: 2026-09-09T03:55:25Z
owners: ["Juliusz Ćwiąkalski"]
service: project-knowledge-management
labels: [change, planning, "priority:high"]
version_impact: minor
summary: "Verification plan for evidence-backed Project Knowledge Management, @knowledge, durable Knowledge Gaps, and ADOS dogfood evidence."
links:
  change_spec: ./chg-GH-41-spec.md
  implementation_plan: null
  testing_strategy: .ai/rules/testing-strategy.md
---

# Test Plan - Project Knowledge Management capability and @knowledge agent

## 1. Scope and Objectives

This plan verifies that `@knowledge` gives humans and agents evidence-backed project answers while making uncertainty, authority, access, and contradictions explicit. It protects the canonical-source, privacy/ACL, durable-gap, identifier, lifecycle, generated-tool, installer, and distribution boundaries. The ten Appendix A dogfood cases are behavioral evaluations: retained answer/report/gap evidence must demonstrate the result, not merely assert that prompts or documents contain prescribed words.

### 1.1 In Scope

- The 17 GH-41 acceptance criteria, all functional capabilities, five event contracts, nine data-model contracts, and all 13 NFRs.
- Real query, review, orientation, capture/deduplication, routing, and resolution behavior in the ten specified ADOS dogfood contexts.
- Static or automated validation where the repository can validate schemas, IDs, inventories, generated artifacts, installation/update preservation, and distribution.

### 1.2 Out of Scope & Known Gaps

- Vendor adapters, RAG/embeddings, telemetry, a mandatory external service, GH-140 catalogue mechanics, and a universal review cadence are excluded by the specification.
- No implementation plan exists at authoring time; exact changed-module test filenames and runner invocation syntax are therefore pending implementation planning.
- Optional external sources are not configured in this repository. Their ACL/untrusted-content behavior is evaluated with sanitized local fixtures or a configured test double; it is not evidence of a live Confluence, Teams, Slack, Jira, or Drive integration.

## 2. References

- [Change specification](./chg-GH-41-spec.md), including Appendix A and all 17 ticket criteria.
- [Delivery brief](../../../../.ai/local/drafts/ados-project-knowledge-management-delivery-brief.md) (planning input; not canonical runtime truth).
- [ADR-0003 — Repo-Local Durable Knowledge Gap Identifiers](../../../decisions/ADR-0003-repo-local-knowledge-gap-identifiers.md) (Proposed; human PR acceptance remains required).
- [Repository testing strategy](../../../../.ai/rules/testing-strategy.md).
- `AGENTS.md`, `.opencode/README.md`, and applicable implementation-time documentation/distribution conventions.

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Ticket criterion coverage | TC ID(s) | Status |
|---|---|---|---|
| AC-F11-1 | Executable redistributable guidance and orientation/security semantics | TC-KNOWLEDGE-001, TC-KNOWLEDGE-022 | Planned |
| AC-F8-1 | Canonical-source remediation; no answer store or tracker-state mirror | TC-KNOWLEDGE-002, TC-KNOWLEDGE-020 | Planned |
| AC-F1-1 | Discoverable canonical/generated `@knowledge` and direct cited answer | TC-KNOWLEDGE-003, TC-KNOWLEDGE-013 | Planned |
| AC-F3-1 | Fact/inference and all applicable retrieval outcomes without fabrication | TC-KNOWLEDGE-004, TC-KNOWLEDGE-015, TC-KNOWLEDGE-017 | Planned |
| AC-F4-1 | Vendor-neutral source policy and `off|suggest|write` capture | TC-KNOWLEDGE-005, TC-KNOWLEDGE-022 | Planned |
| AC-F5-1 | Knowledge Gap schema, lifecycle, and eleven-type taxonomy | TC-KNOWLEDGE-002 | Planned |
| AC-F6-1 | Same-remediation aggregation, retry exclusion, privacy, verified closure | TC-KNOWLEDGE-006, TC-KNOWLEDGE-016, TC-KNOWLEDGE-017 | Planned |
| AC-F8-2 | Canonical trivial remediation and PM tracker routing for work-heavy remediation | TC-KNOWLEDGE-007, TC-KNOWLEDGE-015, TC-KNOWLEDGE-020 | Planned |
| AC-F7-1 | Authority conflict, drift evidence, and age-only restraint | TC-KNOWLEDGE-004, TC-KNOWLEDGE-018, TC-KNOWLEDGE-019 | Planned |
| AC-F12-1 | Proposed scoped `KG-` identity and live-ID preservation | TC-KNOWLEDGE-008, TC-KNOWLEDGE-021 | Planned |
| AC-F9-1 | Bounded, non-recursive specialized-role handoffs | TC-KNOWLEDGE-009, TC-KNOWLEDGE-018, TC-KNOWLEDGE-021 | Planned |
| AC-F10-1 | Contributor Orientation composes the common knowledge flow | TC-KNOWLEDGE-010, TC-KNOWLEDGE-022 | Planned |
| AC-F4-2 | ACL/provenance preservation and untrusted evidence posture | TC-KNOWLEDGE-005, TC-KNOWLEDGE-017, TC-KNOWLEDGE-022 | Planned |
| AC-F11-2 | Profile/distribution, canonical/generated parity, inventory, install/update preservation | TC-KNOWLEDGE-011 | Planned |
| AC-F11-3 | Automated/static coverage for supported machine-checkable rules | TC-KNOWLEDGE-012 | Planned |
| AC-F13-1 | Ten retained-evidence dogfood cases and remediated verified closure | TC-KNOWLEDGE-013–TC-KNOWLEDGE-022 | Planned |
| AC-F13-2 | Pre-PR gates and evidence for all 17 criteria | TC-KNOWLEDGE-023 | Planned |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No REST/HTTP API is specified. `EVT-1` is exercised by TC-KNOWLEDGE-013/015/017; `EVT-2` by TC-KNOWLEDGE-014/016/017; `EVT-3` by TC-KNOWLEDGE-018/019; `EVT-4` by TC-KNOWLEDGE-015/018/021; and `EVT-5` by TC-KNOWLEDGE-020. DM-1 and DM-7 are covered by TC-KNOWLEDGE-005; DM-2 through DM-5 by TC-KNOWLEDGE-002/006/020; DM-6 by TC-KNOWLEDGE-004/015/017; DM-8 and DM-9 by TC-KNOWLEDGE-008/012.

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Verification | TC ID(s) |
|---|---|---|
| NFR-1, NFR-2, NFR-3 | Provenance, no fabrication, at most one follow-up in retained dogfood outputs | TC-KNOWLEDGE-013–TC-KNOWLEDGE-022 |
| NFR-4, NFR-13 | Sanitization, ACL boundary, and inaccessible-not-missing behavior | TC-KNOWLEDGE-005, TC-KNOWLEDGE-016, TC-KNOWLEDGE-017, TC-KNOWLEDGE-022 |
| NFR-5 | KG grammar/allocator and no migration, alias, or extra durable prefix | TC-KNOWLEDGE-008, TC-KNOWLEDGE-012, TC-KNOWLEDGE-021 |
| NFR-6, NFR-7 | Same-remediation deduplication and original-statement closure verification | TC-KNOWLEDGE-006, TC-KNOWLEDGE-016, TC-KNOWLEDGE-020 |
| NFR-8, NFR-9 | Finite review scope and one-depth non-bouncing handoff | TC-KNOWLEDGE-009, TC-KNOWLEDGE-018, TC-KNOWLEDGE-021 |
| NFR-10, NFR-11 | Generated-tool, inventory, distribution, installer/update integrity | TC-KNOWLEDGE-011, TC-KNOWLEDGE-012 |
| NFR-12 | All ten behavioral dogfood cases pass after remediation, no unresolved GH-41 high defect | TC-KNOWLEDGE-013–TC-KNOWLEDGE-023 |

## 4. Test Types and Layers

- **Static/diff and content checks (always):** run `git diff --check`; review changed names/paths, Markdown rendering, links, front matter, AC traceability, and distribution markers, as required by the repository strategy.
- **Automated shell/tool checks:** use the existing narrow `bash tools/.tests/test-<tool-name>.sh` and `bash scripts/.tests/test-<script-name>.sh` conventions for every changed tool/script. Add focused validation only where implementation adds a machine-checkable contract; missing matching tests are an explicit gap.
- **Live runner behavioral evaluation:** `bash`, `git`, OpenCode 1.18.30, and Claude Code 2.1.190 are available in the authoring environment. After delivery, execute the installed canonical and generated knowledge interfaces with deterministic repository fixtures and retain sanitized outputs. Presence of a binary is not proof of model behavior.
- **Model-based manual evaluation:** a reviewer evaluates each retained live answer/report for directness, provenance, authority, inference/uncertainty labels, follow-up count, routing, and safety. This is required for semantic behavior that static prompt/content assertions cannot establish.
- **External integrations:** unconfigured. Simulate configured, inaccessible, and untrusted-source conditions with local sanitized fixtures/configuration. Do not claim a live external integration pass.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Level | Priority | AC Coverage |
|---|---|---|---|---|---|
| TC-KNOWLEDGE-001 | Guidance is executable and complete | Regression | Critical | High | AC-F11-1 |
| TC-KNOWLEDGE-002 | Gap schema and canonical-source lifecycle | Integration | Critical | High | AC-F8-1, AC-F5-1 |
| TC-KNOWLEDGE-003 | Agent inventory and cited direct answer | Integration | Critical | High | AC-F1-1 |
| TC-KNOWLEDGE-004 | Retrieval outcomes and authority semantics | Edge Case | Critical | High | AC-F3-1, AC-F7-1 |
| TC-KNOWLEDGE-005 | Policy, ACL, and capture boundaries | Negative | Critical | High | AC-F4-1, AC-F4-2 |
| TC-KNOWLEDGE-006 | Deduplication and verified resolution rules | Corner Case | Critical | High | AC-F6-1 |
| TC-KNOWLEDGE-007 | Remediation routing preserves ownership | Regression | Important | High | AC-F8-2 |
| TC-KNOWLEDGE-008 | KG identity preserves existing spaces | Regression | Critical | High | AC-F12-1 |
| TC-KNOWLEDGE-009 | Lifecycle handoff is bounded | Negative | Critical | High | AC-F9-1 |
| TC-KNOWLEDGE-010 | Orientation is common-flow composition | Happy Path | Important | High | AC-F10-1 |
| TC-KNOWLEDGE-011 | Distribution, installer, generated parity | Regression | Critical | High | AC-F11-2 |
| TC-KNOWLEDGE-012 | Machine-checkable contracts have checks | Regression | Critical | High | AC-F11-3 |
| TC-KNOWLEDGE-013 | Dogfood 1: direct test guidance | Happy Path | Critical | High | AC-F1-1, AC-F3-1, AC-F13-1 |
| TC-KNOWLEDGE-014 | Dogfood 2: discoverability defect | Edge Case | Important | High | AC-F6-1, AC-F7-1, AC-F13-1 |
| TC-KNOWLEDGE-015 | Dogfood 3: missing procedure | Negative | Critical | High | AC-F3-1, AC-F8-2, AC-F13-1 |
| TC-KNOWLEDGE-016 | Dogfood 4: same-remediation deduplication | Corner Case | Critical | High | AC-F6-1, AC-F13-1 |
| TC-KNOWLEDGE-017 | Dogfood 5: access versus missing | Negative | Critical | High | AC-F3-1, AC-F4-2, AC-F6-1, AC-F13-1 |
| TC-KNOWLEDGE-018 | Dogfood 6: authority conflict | Edge Case | Critical | High | AC-F7-1, AC-F9-1, AC-F13-1 |
| TC-KNOWLEDGE-019 | Dogfood 7: drift versus age | Edge Case | Critical | High | AC-F7-1, AC-F13-1 |
| TC-KNOWLEDGE-020 | Dogfood 8: work route and verified closure | Happy Path | Critical | High | AC-F8-1, AC-F8-2, AC-F13-1 |
| TC-KNOWLEDGE-021 | Dogfood 9: agent uncertainty and decision route | Negative | Critical | High | AC-F9-1, AC-F12-1, AC-F13-1 |
| TC-KNOWLEDGE-022 | Dogfood 10: inaccessible-source orientation | Edge Case | Critical | High | AC-F4-1, AC-F4-2, AC-F10-1, AC-F13-1 |
| TC-KNOWLEDGE-023 | Completion gate evidence | Regression | Critical | High | AC-F13-2 |

### 5.2 Scenario Details

#### TC-KNOWLEDGE-001 - Guidance is executable and complete
**Scenario Type**: Regression  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-1, F-5, F-7, F-8, F-10, F-11, AC-F11-1  
**Test Type(s)**: Manual  
**Automation Level**: Manual  
**Target Layer / Location**: Redistributable knowledge guide, templates, navigation  
**Tags**: @docs @security

**Preconditions**: Delivered guidance and templates are present.
**Steps**:
1. A reviewer follows the guide without the delivery brief for query, authority, gap, remediation, verification, security, and orientation tasks.
2. Record missing or contradictory instructions.
**Expected Outcome**:
- The guide is executable and states the required canonical-source, taxonomy/lifecycle, privacy, and Contributor Orientation semantics.

#### TC-KNOWLEDGE-002 - Gap schema and canonical-source lifecycle
**Scenario Type**: Integration  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-5, F-8, AC-F8-1, AC-F5-1, DM-2, DM-3, DM-4, DM-5  
**Test Type(s)**: Contract, Manual  
**Automation Level**: Semi-automated  
**Target Layer / Location**: Knowledge Gap template, records, derived registry  
**Tags**: @docs @security

**Preconditions**: Sanitized Open, Resolved, and Dismissed fixtures exist.
**Steps**:
1. Validate required evidence/context, all eleven types, and only three statuses.
2. Inspect a resolved fixture and its canonical repair reference.
**Expected Outcome**:
- No gap stores a canonical answer or tracker workflow state; resolution references repaired canonical truth and original-gap verification.

#### TC-KNOWLEDGE-003 - Agent inventory and cited direct answer
**Scenario Type**: Integration  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-1, F-11, AC-F1-1, EVT-1, NFR-1, NFR-10  
**Test Type(s)**: Contract, Manual  
**Automation Level**: Semi-automated  
**Target Layer / Location**: Canonical agent, generated Claude representation, inventories  
**Tags**: @api @docs

**Preconditions**: Canonical and generated tooling are built.
**Steps**:
1. Verify discovery in both inventories.
2. Run a straightforward repository question in each supported live interface.
**Expected Outcome**:
- Both interfaces are discoverable and return an equivalent direct answer with usable source provenance.

#### TC-KNOWLEDGE-004 - Retrieval outcomes and authority semantics
**Scenario Type**: Edge Case  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-2, F-3, F-7, AC-F3-1, AC-F7-1, DM-6, NFR-2  
**Test Type(s)**: Contract, Manual  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `@knowledge` answer and review behavior  
**Tags**: @security @api

**Preconditions**: Fixtures represent answered, insufficient, conflicting, inaccessible, not_configured, and not_found evidence.
**Steps**:
1. Submit one query for each fixture to a live runner.
2. Review retained outputs against the authority and no-fabrication contract.
**Expected Outcome**:
- The applicable outcome is explicit; facts, inference, and conflict are not blended into unsupported fact.

#### TC-KNOWLEDGE-005 - Policy, ACL, and capture boundaries
**Scenario Type**: Negative  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-2, F-3, F-4, AC-F4-1, AC-F4-2, DM-1, DM-7, NFR-4, NFR-13  
**Test Type(s)**: Contract, Manual  
**Automation Level**: Semi-automated  
**Target Layer / Location**: Project configuration and source fixtures  
**Tags**: @security @api

**Preconditions**: Sanitized local fixtures model restricted and untrusted configured sources plus each capture policy.
**Steps**:
1. Evaluate `off`, `suggest`, and authorized `write` behavior.
2. Retrieve inaccessible and instruction-like source content.
**Expected Outcome**:
- Policy is vendor-neutral; ordinary queries default safely, restricted text is not copied, and evidence is never executed as instruction.

#### TC-KNOWLEDGE-006 - Deduplication and verified resolution rules
**Scenario Type**: Corner Case  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-6, F-8, AC-F6-1, DM-5, NFR-4, NFR-6, NFR-7  
**Test Type(s)**: Contract, Manual  
**Automation Level**: Semi-automated  
**Target Layer / Location**: Gap capture, retained records, registry view  
**Tags**: @security

**Preconditions**: Same-remediation, retry, and similar-wording/different-remediation fixtures exist.
**Steps**:
1. Capture observations and inspect occurrence/context changes.
2. Attempt resolution before and after representative-task verification.
**Expected Outcome**:
- Only independent same-remediation observations aggregate; no raw transcript persists; unresolved verification cannot produce Resolved status.

#### TC-KNOWLEDGE-007 - Remediation routing preserves ownership
**Scenario Type**: Regression  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: F-8, F-9, AC-F8-2, EVT-4, DM-4  
**Test Type(s)**: Manual  
**Automation Level**: Manual  
**Target Layer / Location**: Triage and PM handoff guidance  
**Tags**: @docs

**Preconditions**: One trivial documentation and one work-heavy fixture are available.
**Steps**:
1. Triage both fixtures.
2. Inspect the canonical repair route and tracker reference.
**Expected Outcome**:
- Trivial repair targets its owning artifact; work-heavy remediation is bounded to PM/tracker and does not mirror tracker status.

#### TC-KNOWLEDGE-008 - KG identity preserves existing spaces
**Scenario Type**: Regression  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-12, AC-F12-1, DM-8, NFR-5  
**Test Type(s)**: Contract, Manual  
**Automation Level**: Semi-automated  
**Target Layer / Location**: Gap identity validation and ADR-0003 examples  
**Tags**: @docs

**Preconditions**: Fixtures include all statuses and existing `UNK-*`, `OQ-*`, and `OPEN-Q*` values.
**Steps**:
1. Validate uppercase four-digit monotonic KG allocation and no-reuse behavior.
2. Review prefix sweep and cross-repository reference examples.
**Expected Outcome**:
- Only proposed repo-local `KG-` is added; existing IDs remain distinct; external references carry a repository locator; ADR-0003 remains Proposed.

#### TC-KNOWLEDGE-009 - Lifecycle handoff is bounded
**Scenario Type**: Negative  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-9, AC-F9-1, EVT-4, NFR-9  
**Test Type(s)**: Manual  
**Automation Level**: Manual  
**Target Layer / Location**: PM, readiness, review, decision, bootstrapper, and reconciliation contracts  
**Tags**: @api

**Preconditions**: Role-specific uncertainty fixtures are available.
**Steps**:
1. Trigger a material uncertainty from each relevant role contract.
2. Trace delegation depth and returned evidence.
**Expected Outcome**:
- Specialized ownership is retained, safe work continues where possible, and no self-call or role bounce exceeds one owning-role handoff.

#### TC-KNOWLEDGE-010 - Orientation is common-flow composition
**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: F-1, F-10, AC-F10-1  
**Test Type(s)**: Manual  
**Automation Level**: Manual  
**Target Layer / Location**: Contributor Orientation interface  
**Tags**: @docs

**Preconditions**: Orientation interface is delivered.
**Steps**:
1. Request orientation for a new contributor context.
2. Compare answers and a surfaced deficiency with normal knowledge behavior.
**Expected Outcome**:
- Available orientation topics use authoritative evidence and normal gap semantics; no separate Project Onboarding knowledge store is introduced.

#### TC-KNOWLEDGE-011 - Distribution, installer, generated parity
**Scenario Type**: Regression  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-11, AC-F11-2, NFR-10, NFR-11  
**Test Type(s)**: Integration, Manual  
**Automation Level**: Semi-automated  
**Target Layer / Location**: `.opencode`, `.ados-claude`, installer/updater, documentation navigation  
**Tags**: @docs

**Preconditions**: Installation/update sandbox with project-specific knowledge config and gap record.
**Steps**:
1. Build generated tooling and run applicable distribution/install checks.
2. Update the sandbox and inspect preserved project-specific artifacts.
**Expected Outcome**:
- Canonical/generated representations and inventories agree; profile/frontmatter checks pass; update preserves configuration and durable gaps.

#### TC-KNOWLEDGE-012 - Machine-checkable contracts have checks
**Scenario Type**: Regression  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-5, F-11, F-12, AC-F11-3, NFR-5, NFR-10, NFR-11  
**Test Type(s)**: Unit, Integration  
**Automation Level**: Automated  
**Target Layer / Location**: Applicable `tools/.tests/` and `scripts/.tests/` checks  
**Tags**: @docs

**Preconditions**: Implementation identifies supported validators.
**Steps**:
1. Run every applicable narrow test and inject representative invalid schema/ID/inventory/distribution fixtures where supported.
2. Record commands and results.
**Expected Outcome**:
- Each supported machine-checkable rule has automated/static coverage and valid artifacts pass. Unsupported checks are explicitly recorded as a gap, never silently assumed.

#### TC-KNOWLEDGE-013 - Dogfood 1: direct test guidance
**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-1, F-13, AC-F1-1, AC-F3-1, AC-F13-1, EVT-1, NFR-1, NFR-2, NFR-3, NFR-12  
**Test Type(s)**: Manual  
**Automation Level**: Manual  
**Target Layer / Location**: Live canonical and generated knowledge interfaces  
**Tags**: @api

**Preconditions**: Live runner is available and repository test guidance is authoritative.
**Steps**:
1. Ask “How do I run repository tests?” in each supported interface.
2. Retain sanitized output and manually assess it.
**Expected Outcome**:
- A direct evidenced answer is returned with no gap proposal and no unsupported claim.

#### TC-KNOWLEDGE-014 - Dogfood 2: discoverability defect
**Scenario Type**: Edge Case  
**Impact Level**: Important  
**Priority**: High  
**Related IDs**: F-6, F-7, F-13, AC-F6-1, AC-F7-1, AC-F13-1, EVT-2, NFR-12  
**Test Type(s)**: Manual  
**Automation Level**: Manual  
**Target Layer / Location**: Live knowledge query and navigation fixture  
**Tags**: @docs

**Preconditions**: A correct guide is deliberately absent from expected navigation/terminology in an isolated fixture.
**Steps**:
1. Ask the representative task question.
2. Retain answer and candidate/match evidence.
**Expected Outcome**:
- The answer is found; a discoverability gap is proposed or matched; remediation targets navigation rather than duplicate FAQ content.

#### TC-KNOWLEDGE-015 - Dogfood 3: missing procedure
**Scenario Type**: Negative  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-3, F-8, F-13, AC-F3-1, AC-F8-2, AC-F13-1, EVT-1, EVT-4, NFR-2, NFR-3, NFR-12  
**Test Type(s)**: Manual  
**Automation Level**: Manual  
**Target Layer / Location**: Live knowledge query and PM handoff  
**Tags**: @api

**Preconditions**: No authoritative source establishes the required workflow.
**Steps**:
1. Ask the missing-procedure question.
2. Inspect follow-up count, answer, candidate, and route evidence.
**Expected Outcome**:
- No procedure is fabricated; at most one useful follow-up occurs; a missing/completeness candidate routes material work through PM.

#### TC-KNOWLEDGE-016 - Dogfood 4: same-remediation deduplication
**Scenario Type**: Corner Case  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-6, F-13, AC-F6-1, AC-F13-1, EVT-2, NFR-4, NFR-6, NFR-12  
**Test Type(s)**: Manual  
**Automation Level**: Manual  
**Target Layer / Location**: Live capture/deduplication flow  
**Tags**: @security

**Preconditions**: Two independent differently worded observations and a same-interaction retry are prepared.
**Steps**:
1. Submit both observations and then retry one.
2. Inspect retained gap and occurrence evidence.
**Expected Outcome**:
- One gap aggregates only independent observations; retry does not increment or create a duplicate; no raw conversation persists.

#### TC-KNOWLEDGE-017 - Dogfood 5: access versus missing
**Scenario Type**: Negative  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-3, F-4, F-6, F-13, AC-F3-1, AC-F4-2, AC-F6-1, AC-F13-1, EVT-1, EVT-2, DM-6, NFR-4, NFR-13  
**Test Type(s)**: Manual  
**Automation Level**: Manual  
**Target Layer / Location**: Local ACL fixture and live knowledge interface  
**Tags**: @security

**Preconditions**: Similar access questions map respectively to absent guidance and a known inaccessible source.
**Steps**:
1. Execute both questions.
2. Inspect classification, candidate separation, and retained evidence.
**Expected Outcome**:
- Diagnoses remain distinct; inaccessible is not called missing; restricted excerpt is not persisted.

#### TC-KNOWLEDGE-018 - Dogfood 6: authority conflict
**Scenario Type**: Edge Case  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-2, F-7, F-9, F-13, AC-F7-1, AC-F9-1, AC-F13-1, EVT-3, EVT-4, NFR-8, NFR-9, NFR-12  
**Test Type(s)**: Manual  
**Automation Level**: Manual  
**Target Layer / Location**: Live query/review authority fixtures  
**Tags**: @api

**Preconditions**: Accepted decision versus raw history and unresolved maintained-source conflict fixtures exist.
**Steps**:
1. Request the rationale and bounded review.
2. Retain the answer/report and routing evidence.
**Expected Outcome**:
- Accepted rationale wins over raw history; unresolved current conflict is explicit, not averaged, and routes once to its owner/decision process.

#### TC-KNOWLEDGE-019 - Dogfood 7: drift versus age
**Scenario Type**: Edge Case  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-7, F-13, AC-F7-1, AC-F13-1, EVT-3, NFR-8, NFR-12  
**Test Type(s)**: Manual  
**Automation Level**: Manual  
**Target Layer / Location**: Bounded review and executable-evidence fixtures  
**Tags**: @docs

**Preconditions**: One prose/current-contract mismatch and one old-but-verifying guide are available.
**Steps**:
1. Run a finite-scope review.
2. Retain report and cited corroborating evidence.
**Expected Outcome**:
- Strong evidence yields drift; age alone yields no drift claim for the old correct guide.

#### TC-KNOWLEDGE-020 - Dogfood 8: work route and verified closure
**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-5, F-8, F-13, AC-F8-1, AC-F8-2, AC-F13-1, EVT-5, DM-2, DM-4, DM-5, NFR-7, NFR-12  
**Test Type(s)**: Integration, Manual  
**Automation Level**: Semi-automated  
**Target Layer / Location**: Gap, PM route, repaired canonical guidance/navigation  
**Tags**: @docs

**Preconditions**: A work-heavy fixture has a tracked remediation and repaired canonical source.
**Steps**:
1. Route the open gap through PM without copying tracker status.
2. Re-run the original representative query after repair.
**Expected Outcome**:
- The query succeeds from repaired canonical truth; the gap is Resolved only with canonical/change references and original-statement verification evidence.

#### TC-KNOWLEDGE-021 - Dogfood 9: agent uncertainty and decision route
**Scenario Type**: Negative  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-9, F-12, F-13, AC-F9-1, AC-F12-1, AC-F13-1, EVT-4, NFR-5, NFR-9, NFR-12  
**Test Type(s)**: Manual  
**Automation Level**: Manual  
**Target Layer / Location**: Delivery-agent uncertainty handoff  
**Tags**: @api

**Preconditions**: An ownership/behavior question has no established decision.
**Steps**:
1. Invoke the delivery-agent knowledge flow.
2. Trace bounded evidence and subsequent decision route.
**Expected Outcome**:
- The agent does not invent a convention, continues only safe work, creates a decision-needed route without recursive delegation, and does not create an extra identifier space.

#### TC-KNOWLEDGE-022 - Dogfood 10: inaccessible-source orientation
**Scenario Type**: Edge Case  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-1, F-4, F-10, F-13, AC-F4-1, AC-F4-2, AC-F10-1, AC-F13-1, EVT-1, EVT-2, DM-1, DM-7, NFR-1, NFR-13  
**Test Type(s)**: Manual  
**Automation Level**: Manual  
**Target Layer / Location**: Orientation flow with local configured-inaccessible fixture  
**Tags**: @security @docs

**Preconditions**: A local sanitized configured source is inaccessible and other orientation sources are available.
**Steps**:
1. Start Contributor Orientation for the specified first-work context.
2. Retain output and any material gap candidate.
**Expected Outcome**:
- Available topics are answered with provenance; the inaccessible topic is honestly labeled without copied content; only a material deficiency uses normal gap handling.

#### TC-KNOWLEDGE-023 - Completion gate evidence
**Scenario Type**: Regression  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F-11, F-13, AC-F13-2, NFR-12  
**Test Type(s)**: Manual  
**Automation Level**: Manual  
**Target Layer / Location**: Change artifacts, review, quality gates, Definition of Done  
**Tags**: @docs

**Preconditions**: Implementation and dogfood remediation are complete.
**Steps**:
1. Review the AC-to-evidence matrix and ten dogfood records.
2. Run readiness, review, relevant quality checks, and plan-completion assessment.
**Expected Outcome**:
- All 17 criteria have passing evidence; all gates pass; no severity-high GH-41 defect remains unresolved before PR creation.

## 6. Environments and Test Data

- **Repository-local validation:** use a clean worktree, `bash`, `git`, and focused existing shell/tool tests. Retain command and result summaries in the execution log during delivery.
- **Live behavior environment:** use installed OpenCode and Claude Code only after the canonical and generated interfaces exist. Capture sanitized prompt, sources made available, output, model/tool version, and reviewer verdict for each dogfood case.
- **Fixtures:** use synthetic/sanitized repository documents for missing, conflict, drift, old-correct, access, untrusted-content, retry, and lifecycle cases. Never use secrets, real private content, credentials, or raw conversations.
- **Install/update sandbox:** an isolated adopting-project copy includes project-specific knowledge configuration and a durable gap record solely to verify preservation.
- **External systems:** no configured integration is available. Fixture evidence must be labeled simulated; a live-adapter result is N/A, not pass.

## 7. Automation Plan and Implementation Mapping

| TC ID(s) | Planned evidence / location | Execution | Status |
|---|---|---|---|
| TC-KNOWLEDGE-001, 007, 009, 010, 023 | Change artifacts and human-executable workflow review | Manual traceability and Markdown/link review | Manual Only |
| TC-KNOWLEDGE-002, 005, 006, 008, 012 | Focused validator tests in the implementation-selected adjacent `.tests/` directory | Applicable `bash tools/.tests/test-<tool-name>.sh` or `bash scripts/.tests/test-<script-name>.sh` | To Implement |
| TC-KNOWLEDGE-003, 011 | Canonical/generated tooling, inventory, build, installer/update sandbox | Existing build/install/distribution commands identified during implementation | To Implement |
| TC-KNOWLEDGE-004, 013–022 | Retained sanitized live-runner transcripts and reviewer scorecards | OpenCode and generated Claude interface evaluations; model-based manual rubric | To Implement |
| All applicable | Changed files | `git diff --check`, changed-file/path review, Markdown/link/frontmatter review | To Implement |

Automation must assert deterministic contracts and fixture transformations, not claim to prove model reasoning from static prompt text. Each dogfood test requires a live behavioral output plus manual evidence review. If an implementation adds a tool/script without its matching test script, record that as an upstream testing gap and execute targeted manual behavior as required by the testing strategy.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| Risk | Mitigation |
|---|---|
| Static assertions could mask unsafe model behavior. | Require retained live outputs and rubric review for every dogfood case. |
| Nondeterministic model answers may vary. | Fix fixtures/context, retain runner/model version, and evaluate semantic outcome rather than exact wording. |
| External ACL behavior cannot be proven against unconfigured vendors. | Use labeled local fixtures; do not report simulated results as integration passes. |
| Installer/update and generated parity may touch broad infrastructure. | Run narrow applicable checks first, then sandbox update preservation and required broader guards. |

### 8.2 Assumptions

- ADR-0003 is testable as Proposed; no test may treat it as Accepted before human GH-41 PR review.
- Delivery will provide a deterministic, authorized way to invoke canonical and generated knowledge interfaces for behavioral evidence.
- Current repository validation can be extended only for machine-checkable contracts; semantic agent quality remains manual evaluation.

### 8.3 Open Questions

| Question | Owner | Impact |
|---|---|---|
| Which exact runner command and isolation mechanism will delivery expose for repeatable OpenCode and generated Claude dogfood execution? | Implementation plan / delivery | Blocking for automated/semi-automated behavioral execution; manual live evaluation remains required. |
| Which machine-checkable rules will have a tool/script validator versus static review? | Implementation plan | Must be resolved before TC-KNOWLEDGE-012 can pass. |
| What catalogue schema and cross-repository serialization will GH-140 accept? | GH-140 | Non-blocking; test ADR-0003 structured-pair behavior only. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-09-09T03:55:25Z | `@test-plan-writer` | Initial plan from committed spec 309b7a7, delivery brief, Proposed ADR-0003, and repository testing strategy. |

## 10. Test Execution Log

Not executed during planning. Populate during delivery with commands, sanitized behavioral evidence location, reviewer verdict, and result.

| TC ID | Run Date | Result | Notes |
|---|---|---|---|
