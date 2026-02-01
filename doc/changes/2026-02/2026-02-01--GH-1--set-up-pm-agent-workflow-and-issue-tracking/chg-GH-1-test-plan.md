---
id: chg-GH-1-test-plan
status: Proposed
created: 2026-02-01T09:23:29Z
last_updated: 2026-02-01T09:23:29Z
owners: [juliusz-cwiakalski]
service: pm-agent
labels: [foundational, planning, workflow]
links:
  change_spec: chg-GH-1-spec.md
  implementation_plan: chg-GH-1-plan.md
  testing_strategy: .ai/rules/testing-strategy.mdc
version_impact: minor
summary: This change bootstraps the PM agent workflow by creating the required configuration files and directory structure. It ensures that the PM agent can operate with GitHub issue tracking and has access to basic planning artifacts (backlog, user stories, PRD). The change is foundational—without it, no other changes can be delivered.
---

# Test Plan - Set up PM agent workflow and issue tracking

## 1. Scope and Objectives

This test plan validates the foundational setup of the PM agent workflow and issue tracking. It ensures that all required configuration files, planning artifacts, and directory structures are correctly created or verified, enabling the PM agent to start operating within the agentic delivery OS.

**Primary Objectives**:
- Verify PM instructions file (`pm-instructions.md`) contains correct GitHub issue tracking configuration.
- Confirm creation of temporary PM agent memory file (`current-product-state.md`) with expected format.
- Validate product backlog creation (`product-backlog.md`) from refined backlog source.
- Ensure MVP documentation placeholders (`mvp-user-stories.md`, `mvp-prd.md`) exist with minimal content.
- Confirm required directories (`doc/changes/`, `doc/planning/product-decisions/`) exist.
- Validate changelog entry and version impact reflection.

**Out of Scope**:
- Testing modifications to PM agent definition (`@.opencode/agent/pm.md`).
- Testing any other agent definitions or workflows.
- Testing implementation of other backlog items (GH-2 through GH-16).
- Performance, security, or load testing (not applicable).

## 2. References

| Document | Location | Purpose |
|----------|----------|---------|
| Change Specification | `chg-GH-1-spec.md` | Defines what and why of change GH‑1 |
| Implementation Plan | `chg-GH-1-plan.md` | Describes how change will be delivered |
| Repository Testing Strategy | `.ai/rules/testing-strategy.mdc` | Defines test types, layers, conventions (MISSING – see Open Questions) |
| PM Instructions | `doc/planning/pm-instructions.md` | GitHub issue tracking configuration |
| Refined Backlog | `doc/planning/tmp/backlog.md` | Source for product backlog |
| GitHub Issue GH‑1 | https://github.com/juliusz‑cwiakalski/agentic‑delivery‑os/issues/1 | Origin of this change |

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| ID | Description | Test Scenario(s) | Coverage Status |
|----|-------------|------------------|-----------------|
| F‑1 | Verify PM instructions file | TC-PMWORKFLOW-001, TC-PMWORKFLOW-002 | Covered |
| AC‑F‑1‑1 | Given the PM instructions file exists, when its content is verified, then it must contain the correct owner, repo, issue URL pattern, and workflow‑state mapping. | TC-PMWORKFLOW-001 | Covered |
| F‑2 | Create temporary PM agent memory file | TC-PMWORKFLOW-003, TC-PMWORKFLOW-004 | Covered |
| AC‑F‑2‑1 | Given the temporary memory file may or may not exist, when the change is applied, then `doc/planning/current‑product‑state.md` must exist and follow the expected format. | TC-PMWORKFLOW-003 | Covered |
| F‑3 | Create product backlog from refined backlog source | TC-PMWORKFLOW-005, TC-PMWORKFLOW-006 | Covered |
| AC‑F‑3‑1 | Given the refined backlog at `doc/planning/tmp/backlog.md`, when the product backlog is created, then `doc/planning/product‑backlog.md` must contain all 14 tickets with their GitHub issue links, labels, and acceptance criteria. | TC-PMWORKFLOW-005 | Covered |
| F‑4 | Create MVP documentation placeholders | TC-PMWORKFLOW-007, TC-PMWORKFLOW-008 | Covered |
| AC‑F‑4‑1 | Given MVP documentation placeholders are needed, when the change is applied, then `doc/planning/mvp‑user‑stories.md` and `doc/planning/mvp‑prd.md` must exist with at least a minimal description. | TC-PMWORKFLOW-007 | Covered |
| F‑5 | Ensure required directory structure | TC-PMWORKFLOW-009 | Covered |
| AC‑F‑5‑1 | Given the required directories, when the change is applied, then `doc/changes/` and `doc/planning/product‑decisions/` must exist (creation only if missing). | TC-PMWORKFLOW-009 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

No interfaces defined for this change.

### 3.3 Non-Functional Coverage (NFR-#)

| ID | Description | Test Scenario(s) | Coverage Status |
|----|-------------|------------------|-----------------|
| NFR‑1 | Maintainability: All created files must follow existing repository conventions (Markdown formatting, line length, etc.). | TC-PMWORKFLOW-010 | Covered |
| NFR‑2 | Consistency: The product backlog must preserve the priority order and content of the refined backlog. | TC-PMWORKFLOW-006 | Covered |
| NFR‑3 | Simplicity: Placeholder files should be minimal and clearly indicate their temporary nature. | TC-PMWORKFLOW-008 | Covered |
| NFR‑4 | Traceability: The change‑specification must reference the originating GitHub issue (GH‑1) and link to the backlog ticket. | TC-PMWORKFLOW-011 | Covered |

## 4. Test Types and Layers

Given the missing repository testing strategy (`.ai/rules/testing-strategy.mdc`), the following test types are inferred from the change nature (configuration/documentation):

| Test Type | Purpose | Applicable Scenarios |
|-----------|---------|----------------------|
| **Manual Verification** | Human review of file content, format, and correctness. | TC-PMWORKFLOW-001, TC-PMWORKFLOW-003, TC-PMWORKFLOW-007, TC-PMWORKFLOW-008, TC-PMWORKFLOW-010, TC-PMWORKFLOW-011 |
| **Scripted Validation** | Automated checks using shell scripts or simple commands. | TC-PMWORKFLOW-002, TC-PMWORKFLOW-004, TC-PMWORKFLOW-005, TC-PMWORKFLOW-006, TC-PMWORKFLOW-009 |
| **Integration** | Validation that the PM agent can correctly interact with the created artifacts. | Not applicable for this change (deferred to later changes). |

**Target Layers / Locations**:
- `doc/planning/` – configuration and planning artifacts
- `doc/changes/` – change specification directory
- `scripts/.tests/` – scripted validation scripts
- `.gitignore` – version control exclusion list

## 5. Test Scenarios

### 5.1 Scenario Index

| TC-ID | Title | Related IDs | Test Type(s) | Automation Level | Priority |
|-------|-------|-------------|--------------|------------------|----------|
| TC-PMWORKFLOW-001 | Verify PM instructions file content | F‑1, AC‑F‑1‑1 | Manual Verification | Manual | High |
| TC-PMWORKFLOW-002 | Validate PM instructions via script | F‑1, AC‑F‑1‑1 | Scripted Validation | Automated | Medium |
| TC-PMWORKFLOW-003 | Verify temporary memory file existence and format | F‑2, AC‑F‑2‑1 | Manual Verification | Manual | High |
| TC-PMWORKFLOW-004 | Check memory file git‑ignore status | F‑2 | Scripted Validation | Automated | Low |
| TC-PMWORKFLOW-005 | Validate product backlog creation | F‑3, AC‑F‑3‑1 | Scripted Validation | Automated | High |
| TC-PMWORKFLOW-006 | Verify backlog consistency with source | F‑3, NFR‑2 | Scripted Validation | Automated | Medium |
| TC-PMWORKFLOW-007 | Verify MVP placeholder files exist | F‑4, AC‑F‑4‑1 | Manual Verification | Manual | Medium |
| TC-PMWORKFLOW-008 | Check placeholder simplicity | F‑4, NFR‑3 | Manual Verification | Manual | Low |
| TC-PMWORKFLOW-009 | Ensure required directories exist | F‑5, AC‑F‑5‑1 | Scripted Validation | Automated | High |
| TC-PMWORKFLOW-010 | Validate file formatting conventions | NFR‑1 | Manual Verification | Manual | Low |
| TC-PMWORKFLOW-011 | Verify traceability links | NFR‑4 | Manual Verification | Manual | Medium |

### 5.2 Scenario Details

#### TC-PMWORKFLOW-001 - Verify PM instructions file content

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F‑1, AC‑F‑1‑1  
**Test Type(s)**: Manual Verification  
**Automation Level**: Manual  
**Target Layer / Location**: `doc/planning/pm-instructions.md`  
**Tags**: @config, @manual

**Preconditions**:
- The file `doc/planning/pm-instructions.md` exists and is readable.

**Steps**:
1. Open `doc/planning/pm-instructions.md` in a text editor or viewer.
2. Locate the GitHub issue tracking configuration section.
3. Verify that the owner field matches `juliusz‑cwiakalski`.
4. Verify that the repository field matches `agentic‑delivery‑os`.
5. Verify that the issue URL pattern follows `https://github.com/juliusz‑cwiakalski/agentic‑delivery‑os/issues/{id}`.
6. Verify that workflow‑state mappings (e.g., `open` → `todo`, `closed` → `done`) are present and correct.

**Expected Outcome**:
- All four verification steps pass; the configuration matches the actual GitHub repository settings.

**Notes / Clarifications**:
- This is a manual review because the configuration is static and unlikely to change frequently. Automation could be added later via a script that compares against a known‑good template.

#### TC-PMWORKFLOW-002 - Validate PM instructions via script

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: Medium  
**Related IDs**: F‑1, AC‑F‑1‑1  
**Test Type(s)**: Scripted Validation  
**Automation Level**: Automated  
**Target Layer / Location**: `scripts/.tests/`  
**Tags**: @config, @script

**Preconditions**:
- The file `doc/planning/pm-instructions.md` exists.
- A validation script is available (e.g., `scripts/.tests/validate-pm-instructions.sh`).

**Steps**:
1. Run the validation script with `doc/planning/pm-instructions.md` as input.
2. Script checks for required fields using `grep` or similar.
3. Script outputs success/failure with descriptive messages.

**Expected Outcome**:
- Script exits with code 0 and reports “All required fields present and correct.”

**Postconditions**:
- Validation result logged for audit.

#### TC-PMWORKFLOW-003 - Verify temporary memory file existence and format

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F‑2, AC‑F‑2‑1  
**Test Type(s)**: Manual Verification  
**Automation Level**: Manual  
**Target Layer / Location**: `doc/planning/current-product-state.md`  
**Tags**: @config, @manual

**Preconditions**:
- The change has been applied (file created/updated).

**Steps**:
1. Confirm that `doc/planning/current-product-state.md` exists.
2. Open the file and inspect its structure.
3. Look for sections: “active change”, “status”, “notes”, “next steps”.
4. Verify that GH‑1 is referenced as the active change.

**Expected Outcome**:
- File exists and follows the expected format with GH‑1 as active change.

**Notes / Clarifications**:
- The file may be git‑ignored; existence check should still succeed.

#### TC-PMWORKFLOW-004 - Check memory file git‑ignore status

**Scenario Type**: Edge Case  
**Impact Level**: Minor  
**Priority**: Low  
**Related IDs**: F‑2  
**Test Type(s)**: Scripted Validation  
**Automation Level**: Automated  
**Target Layer / Location**: `.gitignore`  
**Tags**: @config, @script

**Preconditions**:
- Decision about git‑ignore has been made (see OQ‑1).

**Steps**:
1. If decision is to ignore, run `git check‑ignore doc/planning/current‑product‑state.md`.
2. If decision is not to ignore, skip this test.

**Expected Outcome**:
- If ignore decision is true, command returns 0 (file is ignored). If false, test is skipped.

**Notes / Clarifications**:
- This test ensures the temporary memory file does not pollute version control.

#### TC-PMWORKFLOW-005 - Validate product backlog creation

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F‑3, AC‑F‑3‑1  
**Test Type(s)**: Scripted Validation  
**Automation Level**: Automated  
**Target Layer / Location**: `doc/planning/product-backlog.md`  
**Tags**: @config, @script

**Preconditions**:
- The refined backlog `doc/planning/tmp/backlog.md` exists with 14 tickets.
- The product backlog `doc/planning/product-backlog.md` has been created.

**Steps**:
1. Count lines or entries in `product-backlog.md` to ensure at least 14 tickets.
2. Verify each ticket includes a GitHub issue link (pattern `https://github.com/juliusz‑cwiakalski/agentic‑delivery‑os/issues/[0-9]+`).
3. Verify each ticket includes labels (e.g., `foundational`, `planning`, `workflow`).
4. Verify each ticket includes acceptance criteria (text containing “AC‑”).

**Expected Outcome**:
- All 14 tickets are present with required metadata.

**Postconditions**:
- Log counts and any missing metadata.

#### TC-PMWORKFLOW-006 - Verify backlog consistency with source

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: Medium  
**Related IDs**: F‑3, NFR‑2  
**Test Type(s)**: Scripted Validation  
**Automation Level**: Automated  
**Target Layer / Location**: `doc/planning/product-backlog.md`, `doc/planning/tmp/backlog.md`  
**Tags**: @config, @script

**Preconditions**:
- Both backlog files exist.

**Steps**:
1. Extract the first 5 ticket titles from each file.
2. Compare the sequences; they should match (priority order preserved).
3. Optionally, compute a diff on content (excluding formatting differences).

**Expected Outcome**:
- Priority order is identical; content differences are only formatting.

#### TC-PMWORKFLOW-007 - Verify MVP placeholder files exist

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: Medium  
**Related IDs**: F‑4, AC‑F‑4‑1  
**Test Type(s)**: Manual Verification  
**Automation Level**: Manual  
**Target Layer / Location**: `doc/planning/mvp-user-stories.md`, `doc/planning/mvp-prd.md`  
**Tags**: @config, @manual

**Preconditions**:
- Placeholder files have been created.

**Steps**:
1. Check that `doc/planning/mvp-user-stories.md` exists and is not empty.
2. Check that `doc/planning/mvp-prd.md` exists and is not empty.
3. Read the first line of each file; ensure it contains a descriptive sentence (e.g., “MVP user stories will be captured here”).

**Expected Outcome**:
- Both files exist, are non‑empty, and contain at least a minimal description.

#### TC-PMWORKFLOW-008 - Check placeholder simplicity

**Scenario Type**: Edge Case  
**Impact Level**: Minor  
**Priority**: Low  
**Related IDs**: F‑4, NFR‑3  
**Test Type(s)**: Manual Verification  
**Automation Level**: Manual  
**Target Layer / Location**: `doc/planning/mvp-user-stories.md`, `doc/planning/mvp-prd.md`  
**Tags**: @config, @manual

**Preconditions**:
- Placeholder files exist.

**Steps**:
1. Review the content of each placeholder file.
2. Ensure the content is minimal (no extensive documentation, no implementation details).
3. Confirm that the files clearly indicate they are temporary (e.g., “placeholder”, “to be filled later”).

**Expected Outcome**:
- Files are minimal and explicitly temporary.

#### TC-PMWORKFLOW-009 - Ensure required directories exist

**Scenario Type**: Happy Path  
**Impact Level**: Critical  
**Priority**: High  
**Related IDs**: F‑5, AC‑F‑5‑1  
**Test Type(s)**: Scripted Validation  
**Automation Level**: Automated  
**Target Layer / Location**: `doc/changes/`, `doc/planning/product-decisions/`  
**Tags**: @config, @script

**Preconditions**:
- The change has been applied.

**Steps**:
1. Run `[ -d doc/changes ] && echo “OK” || echo “MISSING”`.
2. Run `[ -d doc/planning/product‑decisions ] && echo “OK” || echo “MISSING”`.

**Expected Outcome**:
- Both commands output “OK”.

#### TC-PMWORKFLOW-010 - Validate file formatting conventions

**Scenario Type**: Happy Path  
**Impact Level**: Minor  
**Priority**: Low  
**Related IDs**: NFR‑1  
**Test Type(s)**: Manual Verification  
**Automation Level**: Manual  
**Target Layer / Location**: All newly created Markdown files  
**Tags**: @config, @manual

**Preconditions**:
- All files have been created.

**Steps**:
1. For each new Markdown file (`product-backlog.md`, `mvp-user-stories.md`, `mvp-prd.md`, `current-product-state.md`), open and review.
2. Check line length (should be ≤ 100 characters where possible).
3. Check Markdown syntax (proper headers, list formatting).
4. Check consistency with existing repository style.

**Expected Outcome**:
- No gross formatting violations; files follow repository conventions.

#### TC-PMWORKFLOW-011 - Verify traceability links

**Scenario Type**: Happy Path  
**Impact Level**: Important  
**Priority**: Medium  
**Related IDs**: NFR‑4  
**Test Type(s)**: Manual Verification  
**Automation Level**: Manual  
**Target Layer / Location**: `chg-GH-1-spec.md`  
**Tags**: @config, @manual

**Preconditions**:
- The change specification exists.

**Steps**:
1. Open `chg-GH-1-spec.md`.
2. Verify that the front matter includes `ref: GH-1`.
3. Verify that the specification references the originating GitHub issue (GH‑1) in the text.
4. Verify that there is a link to the backlog ticket (either in references or context section).

**Expected Outcome**:
- All traceability links are present and correct.

## 6. Environments and Test Data

**Environments**:
- Local development machine (Linux/macOS) with bash shell.
- GitHub repository `juliusz‑cwiakalski/agentic‑delivery‑os` accessible via MCP GitHub server.

**Test Data**:
- Existing file: `doc/planning/pm-instructions.md`.
- Source backlog: `doc/planning/tmp/backlog.md` (14 refined tickets).
- No synthetic data needed.

**Prerequisites**:
- Git repository checked out.
- Read/write permissions in the repository directory.
- Ability to run shell scripts.

## 7. Automation Plan and Implementation Mapping

| TC-ID | Automation Approach | Implementation Location | Owner | Status |
|-------|---------------------|------------------------|-------|--------|
| TC-PMWORKFLOW-001 | Manual (no automation) | N/A | @tester | Manual |
| TC-PMWORKFLOW-002 | Shell script | `scripts/.tests/validate-pm-instructions.sh` | @developer | TODO |
| TC-PMWORKFLOW-003 | Manual (no automation) | N/A | @tester | Manual |
| TC-PMWORKFLOW-004 | Shell script (git check‑ignore) | `scripts/.tests/check-git-ignore.sh` | @developer | TODO |
| TC-PMWORKFLOW-005 | Shell script (entry count, pattern matching) | `scripts/.tests/validate-backlog.sh` | @developer | TODO |
| TC-PMWORKFLOW-006 | Shell script (diff/compare) | `scripts/.tests/compare-backlogs.sh` | @developer | TODO |
| TC-PMWORKFLOW-007 | Manual (no automation) | N/A | @tester | Manual |
| TC-PMWORKFLOW-008 | Manual (no automation) | N/A | @tester | Manual |
| TC-PMWORKFLOW-009 | Shell script (directory check) | `scripts/.tests/check-directories.sh` | @developer | TODO |
| TC-PMWORKFLOW-010 | Manual (no automation) | N/A | @tester | Manual |
| TC-PMWORKFLOW-011 | Manual (no automation) | N/A | @tester | Manual |

**Automation Notes**:
- Scripts should be placed in `scripts/.tests/` and follow naming convention `test-*.sh` or `validate-*.sh`.
- Each script should exit with 0 on success, non‑zero on failure, and provide descriptive output.
- Scripts can be invoked by the delivery agent during plan execution.

## 8. Risks, Assumptions, and Open Questions

**Risks**:
- **RSK‑1 – Missing testing strategy**: The repository testing strategy (`.ai/rules/testing-strategy.mdc`) is absent, making it impossible to align test types and layers with repository conventions. *Mitigation*: Proceed with inferred test types; flag as open question for resolution in a subsequent change.
- **RSK‑2 – Script dependencies**: Validation scripts may depend on specific shell tools (`grep`, `awk`, `diff`) that are not available in all environments. *Mitigation*: Keep scripts simple and document prerequisites.
- **RSK‑3 – False positives**: Manual verification steps rely on human judgement and may miss subtle errors. *Mitigation*: Pair manual checks with scripted validation where possible.

**Assumptions**:
- The repository already contains a PM agent definition (`@.opencode/agent/pm.md`).
- The GitHub repository `juliusz‑cwiakalski/agentic‑delivery‑os` exists and the MCP GitHub server can access it.
- The refined backlog at `doc/planning/tmp/backlog.md` is authoritative and up‑to‑date.
- The temporary memory file will be migrated in GH‑5; its current location is acceptable for now.

**Open Questions**:
- **OQ‑1**: Should `current‑product‑state.md` be added to `.gitignore` to avoid accidental commits? *Resolution pending*.
- **OQ‑2**: Is the format of `product‑backlog.md` exactly the same as the refined backlog, or should it be simplified? *Resolution pending*.
- **OQ‑3**: Are there any additional planning artifacts that the PM agent expects beyond the four mentioned files? *Resolution pending*.
- **OQ‑4**: Repository testing strategy (`.ai/rules/testing-strategy.mdc`) is missing. Who owns its creation and what should it contain? *Resolution pending*.

## 9. Plan Revision Log

| Date | Version | Author | Change |
|------|---------|--------|--------|
| 2026‑02‑01T09:23:29Z | 1.0 | @test‑plan‑writer | Initial test plan created |

## 10. Test Execution Log

| Date | Phase | TC-ID | Actor | Outcome | Notes |
|------|-------|-------|-------|---------|-------|
| | | | | | |

