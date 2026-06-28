---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/implementation-plan-template.md
ados_distribution: redistributable
id: chg-<workItemRef>-<slug>             # e.g., chg-GH-456-units-display
status: Proposed                         # Proposed | Updated
created: <YYYY-MM-DD>T00:00:00Z
last_updated: <YYYY-MM-DD>T00:00:00Z
owners: [<from-spec>]
service: <from-spec>
labels: [<from-spec>]
links:
  change_spec: <relative-path>           # e.g., ./chg-GH-456-spec.md
summary: >
  <from-spec-summary>
version_impact: <from-spec>
---

<!-- TEMPLATE INSTRUCTIONS
1. Copy this file to the change folder: doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/chg-<workItemRef>-plan.md
2. Replace all <...> placeholders with actual values
3. Remove these instructions before finalizing
4. Derive all requirements from the change spec — do not invent
-->

# IMPLEMENTATION PLAN — <workItemRef>: <Change Title>

## Context and Goals

<!-- Summarize what this plan delivers, how it connects to the change spec, and any resolved open questions.
     If there are unresolved questions, list them as "Open questions" bullets. -->

## Scope

### In Scope

<!-- Bullet list of what is included, referencing spec F-# IDs -->

### Out of Scope

<!-- Bullet list of what is excluded -->

### Constraints

<!-- Technical and process constraints -->

### Risks

<!-- Key risks from spec, with mitigation strategy:
- **RSK-#**: Description. Mitigated by...
-->

### Success Metrics

<!-- Key success metrics from spec -->

## Phases

<!-- Each phase follows this format:

### Phase N: <Short Title>

**Goal**: <What this phase achieves>

**Tasks**:

- [ ] **N.1** <Task description>
- [ ] **N.2** <Task description>

**Acceptance Criteria**:

- Must: <Criterion from spec AC-#>
- Should: <Nice-to-have criterion>

**Affected code areas**:

- <file/module/class> (new | updated)

**System docs to update**:

- <doc/spec/** path or system/quality doc> (new | updated)

**Tests**:

- <Validation step or test to run>

**Completion signal**: <Commit message for this phase>

---
-->

### Phase 1: <Title>

**Goal**: <!-- What this phase achieves -->

**Tasks**:

- [ ] **1.1** <!-- Task description -->
- [ ] **1.2** <!-- Task description -->

**Acceptance Criteria**:

- Must: <!-- Criterion -->

**Affected code areas**:

- <!-- file/module/class (new | updated) -->

**System docs to update**:

- <!-- doc/spec/** path or system/quality doc (new | updated) -->

**Tests**:

- <!-- test -->

**Completion signal**: `<type>(workItemRef): <short description>`

---

<!-- Add more phases as needed. Final phase should include:
- Version bump per repo conventions
- Spec reconciliation
-->

## Test Scenarios

<!-- Map test scenarios to phases and acceptance criteria:
| ID | Scenario | Phases | AC |
|----|----------|--------|----|
-->

## Artifacts and Links

<!-- Table of all artifacts created or modified:
| Artifact | Location | Type |
|----------|----------|------|
| Change specification | ./chg-<workItemRef>-spec.md | Spec |
-->

## Plan Revision Log

<!-- Table format:
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | YYYY-MM-DD | plan-writer | Initial plan |
-->

## Execution Log

<!-- Populated during execution:
| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
-->
