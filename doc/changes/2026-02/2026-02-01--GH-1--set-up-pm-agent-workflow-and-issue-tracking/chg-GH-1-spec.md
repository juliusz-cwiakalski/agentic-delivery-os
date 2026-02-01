---
change:
  ref: GH-1
  type: feat
   status: Implemented
  slug: set-up-pm-agent-workflow-and-issue-tracking
  title: "Set up PM agent workflow and issue tracking"
  owners: [juliusz-cwiakalski]
  service: pm-agent
  labels: [foundational, planning, workflow]
  version_impact: minor
  audience: internal
  security_impact: none
  risk_level: low
  dependencies:
    internal: []
    external: []
---

# CHANGE SPECIFICATION

**PURPOSE**: This document defines the what and why of change GH‑1, serving as the single source of truth for all downstream artifacts (plan, test plan). It captures the foundational workflow setup for the PM agent, enabling the agentic delivery OS to start delivering changes.

## 1. SUMMARY

This change bootstraps the PM agent workflow by creating the required configuration files and directory structure. It ensures that the PM agent can operate with GitHub issue tracking and has access to basic planning artifacts (backlog, user stories, PRD). The change is foundational—without it, no other changes can be delivered.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The repository already contains a PM agent definition (`@.opencode/agent/pm.md`).
- A GitHub issue (GH‑1) has been created and is open.
- The file `doc/planning/pm-instructions.md` exists and contains correct GitHub issue tracking configuration.
- A temporary memory file `doc/planning/current-product-state.md` exists (will be migrated in GH‑5).
- A comprehensive backlog exists at `doc/planning/tmp/backlog.md` with 14 refined tickets.
- The directories `doc/changes/` and `doc/planning/product-decisions/` already exist.
- Missing files: `doc/planning/product-backlog.md`, `doc/planning/mvp-user-stories.md`, `doc/planning/mvp-prd.md`.

### 2.2 Pain Points / Gaps

- The agentic delivery OS cannot start delivering changes because the PM agent lacks the required repository‑specific configuration and planning artifacts.
- Without a product backlog and MVP documentation, the PM agent has no input for selecting and prioritizing work.
- The absence of a unified change‑specification folder for GH‑1 prevents downstream agents (`@plan‑writer`, `@test‑plan‑writer`) from creating their artifacts.

## 3. PROBLEM STATEMENT

The agentic delivery OS cannot start delivering changes until the PM agent is configured with GitHub issue tracking and the basic workflow artifacts exist.

## 4. GOALS

- Enable the PM agent to operate with GitHub issue tracking as defined in `pm‑instructions.md`.
- Provide the PM agent with a product backlog, MVP user stories, and a minimal PRD to drive prioritization.
- Establish the directory structure required by the unified change convention.
- Create a temporary memory file for the PM agent (to be migrated in GH‑5).
- Ensure all artifacts are placed in the correct location (`doc/changes/2026‑02/2026‑02‑01––GH‑1––set‑up‑pm‑agent‑workflow‑and‑issue‑tracking/`).

### 4.1 Success Metrics / KPIs

- [F‑1] PM instructions file verified and ready for use.
- [F‑2] Temporary memory file exists and is git‑ignored (or not committed).
- [F‑3] Product backlog file created with initial items sourced from `doc/planning/tmp/backlog.md`.
- [F‑4] MVP user‑stories and PRD placeholder files created (can be minimal).
- [F‑5] Required directories (`doc/changes/`, `doc/planning/product‑decisions/`) confirmed to exist.
- All acceptance criteria from the backlog ticket are satisfied.

### 4.2 Non-Goals

- Modifying the PM agent definition (`@.opencode/agent/pm.md`).
- Changing existing workflows or agent coordination patterns.
- Implementing any other backlog items beyond GH‑1.
- Migrating the memory file to `.ai/local/` (this is deferred to GH‑5).
- Adding implementation‑level details (code, file paths, step‑by‑step tasks).

## 5. FUNCTIONAL CAPABILITIES

**F‑1 – Verify PM instructions file**  
Rationale: The PM agent must have a correct configuration for GitHub issue tracking. The file already exists; we need to confirm its content matches the required format and contains the mapping of workflow states to GitHub labels.

**F‑2 – Create temporary PM agent memory file**  
Rationale: The PM agent needs a local working memory file (`doc/planning/current‑product‑state.md`) to track active changes, notes, and next steps. This file is temporary and will be migrated in GH‑5.

**F‑3 – Create product backlog from refined backlog source**  
Rationale: The PM agent uses `doc/planning/product‑backlog.md` as a primary input for prioritization. The refined backlog at `doc/planning/tmp/backlog.md` (14 tickets) must be transformed into the canonical backlog format.

**F‑4 – Create MVP documentation placeholders**  
Rationale: The PM agent expects `doc/planning/mvp‑user‑stories.md` and `doc/planning/mvp‑prd.md` to exist, even if they are minimal placeholders. This unblocks the agent’s discovery rules.

**F‑5 – Ensure required directory structure**  
Rationale: The unified change convention requires `doc/changes/` (with month subfolders) and `doc/planning/product‑decisions/`. These directories must exist before any change artifacts can be created.

### 5.1 Capability Details

- **F‑1**: Verification includes checking that the file contains the correct owner/repo, issue URL pattern, workflow‑state mapping, and labeling conventions.
- **F‑2**: The memory file should follow the format used in the existing `current‑product‑state.md` (active change, status, notes, next steps). It must be git‑ignored (or not committed) to avoid polluting the repository with ephemeral state.
- **F‑3**: The product backlog should list tickets in priority order, include GitHub issue links, labels, and acceptance criteria. It may be a direct copy of the refined backlog with minor formatting adjustments.
- **F‑4**: Placeholder files can contain a single sentence describing their purpose (e.g., “MVP user stories will be captured here”). They are intended to be replaced later.
- **F‑5**: If a directory is missing, it must be created; otherwise, no action is needed.

## 6. USER & SYSTEM FLOWS

**PM Agent Startup Flow**:
1. PM agent reads `pm‑instructions.md` to configure GitHub issue tracking.
2. PM agent checks for `product‑backlog.md`, `mvp‑user‑stories.md`, `mvp‑prd.md` to understand product context.
3. PM agent loads memory from `current‑product‑state.md` (or later `.ai/local/pm‑context.yaml`).
4. PM agent queries GitHub issues with label `change` and selects the highest‑priority open issue (GH‑1).
5. PM agent delegates to `@change‑spec‑writer` with the `workItemRef` (GH‑1).

**Change Artifact Creation Flow**:
1. `@change‑spec‑writer` creates the specification in the appropriate `doc/changes/YYYY‑MM/YYYY‑MM‑DD––GH‑1––…/` folder.
2. `@plan‑writer` reads the spec and creates the plan.
3. `@test‑plan‑writer` reads the spec and creates the test plan.
4. `@delivery‑agent` executes the plan.

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Verifying `doc/planning/pm‑instructions.md`.
- Creating/updating `doc/planning/current‑product‑state.md`.
- Creating `doc/planning/product‑backlog.md` from the refined backlog.
- Creating `doc/planning/mvp‑user‑stories.md` and `doc/planning/mvp‑prd.md` as placeholders.
- Ensuring directories `doc/changes/` and `doc/planning/product‑decisions/` exist.
- Creating the change‑specification artifact for GH‑1 (this document).

### 7.2 Out of Scope

- [OUT] Modifying the PM agent definition (`@.opencode/agent/pm.md`).
- [OUT] Changing any other agent definitions or workflows.
- [OUT] Implementing any other backlog items (GH‑2 through GH‑16).
- [OUT] Migrating the memory file to `.ai/local/` (GH‑5).
- [OUT] Adding implementation‑level tasks, code, or file‑path details.

### 7.3 Deferred / Maybe-Later

- Migration of PM agent memory to `.ai/local/pm‑context.yaml` (GH‑5).
- Enhancement of MVP documentation with real content (future changes).
- Addition of quality gates, automation, or review improvements.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None.

### 8.2 Events / Messages

None.

### 8.3 Data Model Impact

No persistent data model changes.

### 8.4 External Integrations

**GitHub Issues** – The PM agent will interact with GitHub via the MCP GitHub server. The configuration in `pm‑instructions.md` defines the owner (`juliusz‑cwiakalski`), repository (`agentic‑delivery‑os`), and label mappings.

### 8.5 Backward Compatibility

This change introduces no backward incompatibilities; it is purely additive.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

**NFR‑1 – Maintainability**: All created files must follow existing repository conventions (Markdown formatting, line length, etc.).  
**NFR‑2 – Consistency**: The product backlog must preserve the priority order and content of the refined backlog.  
**NFR‑3 – Simplicity**: Placeholder files should be minimal and clearly indicate their temporary nature.  
**NFR‑4 – Traceability**: The change‑specification must reference the originating GitHub issue (GH‑1) and link to the backlog ticket.

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

None.

## 11. RISKS & MITIGATIONS

**RSK‑1 – Incorrect configuration**: If `pm‑instructions.md` contains wrong settings, the PM agent may fail to interact with GitHub.  
*Mitigation*: Verify the file against the GitHub repository’s actual settings.  
*Residual risk*: Low.

**RSK‑2 – Missing directory permissions**: The agent may lack write permissions to create directories or files.  
*Mitigation*: Run with appropriate user privileges; check permissions before writing.  
*Residual risk*: Low.

**RSK‑3 – Overwriting existing files**: Creating `product‑backlog.md` could overwrite an existing file with valuable content.  
*Mitigation*: Check for existence and back up any existing file before writing.  
*Residual risk*: Low.

## 12. ASSUMPTIONS

- The repository is already configured with OpenCode and the PM agent definition is present.
- The GitHub repository `juliusz‑cwiakalski/agentic‑delivery‑os` exists and the MCP GitHub server can access it.
- The refined backlog at `doc/planning/tmp/backlog.md` is authoritative and up‑to‑date.
- The temporary memory file will be migrated in GH‑5; its current location is acceptable for now.

## 13. DEPENDENCIES

None.

## 14. OPEN QUESTIONS

**OQ‑1**: Should `current‑product‑state.md` be added to `.gitignore` to avoid accidental commits?  
**OQ‑2**: Is the format of `product‑backlog.md` exactly the same as the refined backlog, or should it be simplified?  
**OQ‑3**: Are there any additional planning artifacts that the PM agent expects beyond the four mentioned files?

## 15. DECISION LOG

**DEC‑1**: Use the existing `pm‑instructions.md` file as the source of truth for GitHub issue tracking configuration.  
**DEC‑2**: Keep `current‑product‑state.md` in `doc/planning/` for now; migration to `.ai/local/` will happen in GH‑5.  
**DEC‑3**: Create placeholder MVP files with minimal content to satisfy discovery rules.  
**DEC‑4**: Follow the unified change convention for folder naming (`YYYY‑MM‑DD––GH‑1––set‑up‑pm‑agent‑workflow‑and‑issue‑tracking`).

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

- `doc/planning/pm‑instructions.md` (verification only)
- `doc/planning/current‑product‑state.md` (creation/update)
- `doc/planning/product‑backlog.md` (new)
- `doc/planning/mvp‑user‑stories.md` (new)
- `doc/planning/mvp‑prd.md` (new)
- `doc/changes/2026‑02/2026‑02‑01––GH‑1––set‑up‑pm‑agent‑workflow‑and‑issue‑tracking/` (new)
- `doc/changes/` and `doc/planning/product‑decisions/` (existence check)

## 17. ACCEPTANCE CRITERIA

**AC‑F‑1‑1**: Given the PM instructions file exists, when its content is verified, then it must contain the correct owner, repo, issue URL pattern, and workflow‑state mapping.  
**AC‑F‑2‑1**: Given the temporary memory file may or may not exist, when the change is applied, then `doc/planning/current‑product‑state.md` must exist and follow the expected format.  
**AC‑F‑3‑1**: Given the refined backlog at `doc/planning/tmp/backlog.md`, when the product backlog is created, then `doc/planning/product‑backlog.md` must contain all 14 tickets with their GitHub issue links, labels, and acceptance criteria.  
**AC‑F‑4‑1**: Given MVP documentation placeholders are needed, when the change is applied, then `doc/planning/mvp‑user‑stories.md` and `doc/planning/mvp‑prd.md` must exist with at least a minimal description.  
**AC‑F‑5‑1**: Given the required directories, when the change is applied, then `doc/changes/` and `doc/planning/product‑decisions/` must exist (creation only if missing).

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

1. Create the change‑specification (this document).
2. Delegate to `@plan‑writer` to produce a delivery plan.
3. Delegate to `@test‑plan‑writer` to produce a test plan.
4. Execute the plan (create/verify files, ensure directories).
5. Verify that all acceptance criteria are satisfied.
6. Mark GH‑1 as ready for review.

No phased rollout or feature flags are needed.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

Seeding of `product‑backlog.md` from the refined backlog is a one‑time copy/transformation. No migration of existing data.

## 20. PRIVACY / COMPLIANCE REVIEW

No personal data or regulated data is involved.

## 21. SECURITY REVIEW HIGHLIGHTS

No security‑sensitive operations; all files are plain Markdown configuration.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The new files will need to be updated as the product evolves (backlog, MVP docs).
- The temporary memory file will be moved in GH‑5, requiring updates to any scripts that read it.
- No ongoing operational burden.

## 23. GLOSSARY

- **PM agent**: Product Manager agent, responsible for selecting and delegating changes.
- **Unified change convention**: The standard folder and file naming scheme for change artifacts (`doc/changes/YYYY‑MM/YYYY‑MM‑DD––{workItemRef}––{slug}/`).
- **workItemRef**: Canonical identifier for a change (e.g., `GH‑1`).
- **Refined backlog**: The detailed backlog stored in `doc/planning/tmp/backlog.md`.

## 24. APPENDICES

None.

## 25. DOCUMENT HISTORY

| Date | Version | Author | Change |
|------|---------|--------|--------|
| 2026‑02‑01 | 1.0 | @change‑spec‑writer | Initial specification |

---

## AUTHORING GUIDELINES

- This spec must remain technology‑neutral; no implementation tasks or file‑paths beyond those needed for clarity.
- All functional capabilities must have a unique `F‑` ID.
- Acceptance Criteria must follow Given/When/Then format and reference at least one `F‑`, `API‑`, `EVT‑`, `DM‑`, or `NFR‑` ID.
- Risks must include Impact & Probability (H/M/L) and mitigation.
- Open Questions must be prefixed with `OQ‑`.

## VALIDATION CHECKLIST

- [ ] Front matter conforms to the required schema.
- [ ] All sections from the template are present and in the correct order.
- [ ] No implementation‑level details (code, step‑by‑step tasks).
- [ ] IDs are unique within their category (`F‑`, `API‑`, `EVT‑`, `DM‑`, `NFR‑`, `AC‑`, `DEC‑`, `RSK‑`, `OQ‑`).
- [ ] Acceptance Criteria reference at least one other ID.
- [ ] NFRs include measurable values where applicable.
- [ ] Risks include Impact & Probability and mitigation.
- [ ] Out‑of‑scope items start with `[OUT]`.
- [ ] All planning‑session context has been incorporated; missing information is captured as Open Questions.