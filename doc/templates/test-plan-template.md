---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/test-plan-template.md
ados_distribution: redistributable
id: chg-<workItemRef>-test-plan          # e.g., chg-GH-456-test-plan
status: Proposed                         # Proposed | Updated
created: <YYYY-MM-DD>
last_updated: <YYYY-MM-DD>
owners: [<team-or-person>]
service: <primary-service>
labels: [<from-spec>]
version_impact: <from-spec>
summary: "<from-spec>"
links:
  change_spec: <relative-path>           # e.g., ./chg-GH-456-spec.md
  implementation_plan: <relative-path>   # e.g., ./chg-GH-456-plan.md (if exists)
  testing_strategy: .ai/rules/testing-strategy.md
---

<!-- TEMPLATE INSTRUCTIONS
1. Copy this file to the change folder: doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/chg-<workItemRef>-test-plan.md
2. Replace all <...> placeholders with actual values
3. Remove these instructions before finalizing
4. Derive all requirements from the change spec — do not invent
5. For business/product strategy work, you may reference `doc/templates/business-validation-plan-template.md`
-->

# Test Plan - <Change Title>

## 1. Scope and Objectives

<!-- 2-5 sentences describing:
     - Core behavior to protect
     - Data or security integrity risks
     - Regressions that motivated this plan -->

### 1.1 In Scope

<!-- List what is explicitly covered -->

### 1.2 Out of Scope & Known Gaps

<!-- List excluded areas so agents/testers don't cover them -->

## 2. References

<!-- Links to change spec, plan, relevant specs, contracts, decision records -->

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

<!-- Map each AC-# to test scenario(s):
| AC ID | Description | TC ID(s) | Status |
|-------|-------------|----------|--------|
-->

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

<!-- Map interface elements to test scenarios -->

### 3.3 Non-Functional Coverage (NFR-#)

<!-- Map NFRs to test scenarios or explain why not covered -->

## 4. Test Types and Layers

<!-- Describe which layers apply and framework/directory for each:
- **Unit tests:** Framework, root directory, pattern
- **Integration tests:** Framework, root directory
- **E2E tests:** Framework, root directory
- **Non-functional:** Types, tools
-->

## 5. Test Scenarios

### 5.1 Scenario Index

<!-- Table of all scenarios:
| TC ID | Title | Type | Level | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
-->

### 5.2 Scenario Details

<!-- For each scenario:

#### TC-<FEATURE>-<NNN> - <Short Title>

**Scenario Type**: Happy Path | Edge Case | Negative | Corner Case | Regression
**Impact Level**: Critical | Important | Minor
**Priority**: High | Medium | Low
**Related IDs**: F-#, AC-#, API-#, EVT-#, DM-#, NFR-#
**Test Type(s)**: Unit | Integration | Contract | E2E | Manual | Performance
**Automation Level**: Automated | Manual | Semi-automated
**Target Layer / Location**: <module/directory>
**Tags**: @backend, @ui, @api, @perf

**Preconditions**:
- ...

**Steps**:
1. ...

**Expected Outcome**:
- ...
-->

## 6. Environments and Test Data

<!-- Describe:
- Required environments (local-dev, test, staging)
- Test data generation and cleanup
- Isolation strategy -->

## 7. Automation Plan and Implementation Mapping

<!-- For each TC, specify:
- Test file to create or update
- Execution command
- Mocking requirements
- Implementation status: To Implement | Existing – Update | Existing – No Change | Manual Only -->

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

<!-- Testing-related risks and mitigations -->

### 8.2 Assumptions

<!-- Assumptions for test implementation -->

### 8.3 Open Questions

<!-- Unresolved questions with blocking status and owner -->

## 9. Plan Revision Log

<!-- Table format:
| Version | Date | Author | Changes |
|---------|------|--------|---------|
-->

## 10. Test Execution Log

<!-- Populated during execution:
| TC ID | Run Date | Result | Notes |
|-------|----------|--------|-------|
-->
