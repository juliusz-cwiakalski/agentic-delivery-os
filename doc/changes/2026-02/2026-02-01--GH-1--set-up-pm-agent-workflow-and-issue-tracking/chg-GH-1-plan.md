---
id: chg-GH-1-set-up-pm-agent-workflow-and-issue-tracking
status: Proposed
created: 2026-02-01T09:18:56Z
last_updated: 2026-02-01T09:18:56Z
owners: [juliusz-cwiakalski]
service: pm-agent
labels: [foundational, planning, workflow]
links:
  change_spec: chg-GH-1-spec.md
summary: This change bootstraps the PM agent workflow by creating the required configuration files and directory structure. It ensures that the PM agent can operate with GitHub issue tracking and has access to basic planning artifacts (backlog, user stories, PRD). The change is foundational—without it, no other changes can be delivered.
version_impact: minor
---

## Context and Goals

This implementation plan addresses the foundational setup required for the PM agent to begin operating within the agentic delivery OS. The PM agent is responsible for selecting and delegating changes, but it cannot start until the basic workflow configuration and planning artifacts are in place.

**Goals**:
- Enable the PM agent to operate with GitHub issue tracking as defined in `pm-instructions.md`.
- Provide the PM agent with a product backlog, MVP user stories, and a minimal PRD to drive prioritization.
- Establish the directory structure required by the unified change convention.
- Create a temporary memory file for the PM agent (to be migrated in GH‑5).
- Ensure all artifacts are placed in the correct location (`doc/changes/2026‑02/2026‑02‑01––GH‑1––set‑up‑pm‑agent‑workflow‑and‑issue‑tracking/`).

**Open questions**:
- OQ‑1: Should `current‑product‑state.md` be added to `.gitignore` to avoid accidental commits?
- OQ‑2: Is the format of `product‑backlog.md` exactly the same as the refined backlog, or should it be simplified?
- OQ‑3: Are there any additional planning artifacts that the PM agent expects beyond the four mentioned files?

**Decision needed**: Consult `@architect` regarding version bump mechanism and CHANGELOG format.

## Scope

### In Scope
- Verifying `doc/planning/pm‑instructions.md`.
- Creating/updating `doc/planning/current‑product‑state.md`.
- Creating `doc/planning/product‑backlog.md` from the refined backlog.
- Creating `doc/planning/mvp‑user‑stories.md` and `doc/planning/mvp‑prd.md` as placeholders.
- Ensuring directories `doc/changes/` and `doc/planning/product‑decisions/` exist.
- Creating the change‑specification artifact for GH‑1 (already done).
- Creating or updating `CHANGELOG.md` to reflect the change.

### Out of Scope
- Modifying the PM agent definition (`@.opencode/agent/pm.md`).
- Changing any other agent definitions or workflows.
- Implementing any other backlog items (GH‑2 through GH‑16).
- Migrating the memory file to `.ai/local/` (GH‑5).
- Adding implementation‑level tasks, code, or file‑path details beyond those needed for clarity.

### Constraints
- The repository already contains a PM agent definition (`@.opencode/agent/pm.md`).
- A GitHub issue (GH‑1) has been created and is open.
- The file `doc/planning/pm‑instructions.md` exists and contains correct GitHub issue tracking configuration.
- A temporary memory file `doc/planning/current‑product‑state.md` exists (will be migrated in GH‑5).
- A comprehensive backlog exists at `doc/planning/tmp/backlog.md` with 14 refined tickets.
- The directories `doc/changes/` and `doc/planning/product‑decisions/` already exist.
- Missing files: `doc/planning/product‑backlog.md`, `doc/planning/mvp‑user‑stories.md`, `doc/planning/mvp‑prd.md`.

### Risks
- **RSK‑1 – Incorrect configuration**: If `pm‑instructions.md` contains wrong settings, the PM agent may fail to interact with GitHub.  
  *Mitigation*: Verify the file against the GitHub repository’s actual settings.  
  *Residual risk*: Low.
- **RSK‑2 – Missing directory permissions**: The agent may lack write permissions to create directories or files.  
  *Mitigation*: Run with appropriate user privileges; check permissions before writing.  
  *Residual risk*: Low.
- **RSK‑3 – Overwriting existing files**: Creating `product‑backlog.md` could overwrite an existing file with valuable content.  
  *Mitigation*: Check for existence and back up any existing file before writing.  
  *Residual risk*: Low.

### Success Metrics
- [F‑1] PM instructions file verified and ready for use.
- [F‑2] Temporary memory file exists and is git‑ignored (or not committed).
- [F‑3] Product backlog file created with initial items sourced from `doc/planning/tmp/backlog.md`.
- [F‑4] MVP user‑stories and PRD placeholder files created (can be minimal).
- [F‑5] Required directories (`doc/changes/`, `doc/planning/product‑decisions/`) confirmed to exist.
- All acceptance criteria from the backlog ticket are satisfied.

## Phases

### Phase 1: Environment & scaffolding

**Goal**: Ensure required directories exist and verify existing files.

**Tasks**:

- [ ] Verify `doc/changes/` directory exists (create if missing).
- [ ] Verify `doc/planning/product‑decisions/` directory exists (create if missing).
- [ ] Check that `doc/planning/pm‑instructions.md` exists and is readable.
- [ ] Check that `doc/planning/tmp/backlog.md` exists and contains 14 refined tickets.
- [ ] Determine if `current‑product‑state.md` should be added to `.gitignore` (resolve OQ‑1).

**Acceptance Criteria**:

- Must: Directories `doc/changes/` and `doc/planning/product‑decisions/` exist after execution.
- Must: `pm‑instructions.md` and `backlog.md` are present and accessible.
- Should: Decision about `.gitignore` recorded in plan revision log.

**Files and modules**:

- `doc/changes/`
- `doc/planning/product‑decisions/`
- `doc/planning/pm‑instructions.md`
- `doc/planning/tmp/backlog.md`
- `.gitignore`

**Tests**:

- Directory existence test: `[ -d doc/changes ] && [ -d doc/planning/product‑decisions ]`
- File existence test: `[ -f doc/planning/pm‑instructions.md ] && [ -f doc/planning/tmp/backlog.md ]`

**Completion signal**: Directories verified, files confirmed.

### Phase 2: Core implementation

**Goal**: Create missing planning artifacts and update temporary memory file.

**Tasks**:

- [ ] Create `doc/planning/product‑backlog.md` by transforming the refined backlog (resolve OQ‑2).
- [ ] Create `doc/planning/mvp‑user‑stories.md` placeholder with minimal content.
- [ ] Create `doc/planning/mvp‑prd.md` placeholder with minimal content.
- [ ] Update `doc/planning/current‑product‑state.md` to reflect the active change (GH‑1) and next steps.

**Acceptance Criteria**:

- Must: `product‑backlog.md` contains all 14 tickets with GitHub issue links, labels, and acceptance criteria.
- Must: `mvp‑user‑stories.md` and `mvp‑prd.md` exist with at least a minimal description (e.g., “MVP user stories will be captured here”).
- Must: `current‑product‑state.md` follows the expected format (active change, status, notes, next steps).
- Should: Placeholder files clearly indicate their temporary nature.

**Files and modules**:

- `doc/planning/product‑backlog.md`
- `doc/planning/mvp‑user‑stories.md`
- `doc/planning/mvp‑prd.md`
- `doc/planning/current‑product‑state.md`

**Tests**:

- Line count test: `wc -l doc/planning/product‑backlog.md` shows at least 14 entries.
- Placeholder content test: `grep -q "MVP" doc/planning/mvp‑user‑stories.md` and `grep -q "PRD" doc/planning/mvp‑prd.md`.
- Memory file format test: `grep -E "active change|status|notes|next steps" doc/planning/current‑product‑state.md`.

**Completion signal**: All four files created/updated and validated.

### Phase 3: Verification

**Goal**: Verify configuration and artifacts meet functional requirements.

**Tasks**:

- [ ] Verify `pm‑instructions.md` content: correct owner, repo, issue URL pattern, workflow‑state mapping.
- [ ] Verify `product‑backlog.md` matches refined backlog priority order and content.
- [ ] Verify placeholder files are present and readable.
- [ ] Verify `current‑product‑state.md` is git‑ignored (if decision from OQ‑1).

**Acceptance Criteria**:

- Must: `pm‑instructions.md` passes validation against GitHub repository settings.
- Must: `product‑backlog.md` preserves priority order and content of refined backlog.
- Must: Placeholder files exist and are not empty.
- Should: `current‑product‑state.md` is excluded from version control (if decided).

**Files and modules**:

- `doc/planning/pm‑instructions.md`
- `doc/planning/product‑backlog.md`
- `doc/planning/mvp‑user‑stories.md`
- `doc/planning/mvp‑prd.md`
- `doc/planning/current‑product‑state.md`
- `.gitignore`

**Tests**:

- Content validation: `grep -q "owner.*juliusz‑cwiakalski" doc/planning/pm‑instructions.md`.
- Priority order test: compare first 5 lines of `product‑backlog.md` with `backlog.md`.
- File non‑empty test: `[ -s doc/planning/mvp‑user‑stories.md ] && [ -s doc/planning/mvp‑prd.md ]`.
- Git ignore test: `git check‑ignore doc/planning/current‑product‑state.md` (if applicable).

**Completion signal**: All verification steps pass.

### Phase 4: Documentation & Spec Synchronization

**Goal**: Ensure spec and plan alignment, update documentation.

**Tasks**:

- [ ] Review spec (this document) for consistency with plan.
- [ ] Update spec status from “Proposed” to “Ready” (or “Implemented” after execution).
- [ ] Resolve any remaining open questions (OQ‑3).
- [ ] Ensure all functional capabilities (F‑1 through F‑5) are addressed in plan.

**Acceptance Criteria**:

- Must: Spec and plan are consistent (no contradictory information).
- Must: Open questions are resolved or deferred with rationale.
- Should: Spec status updated appropriately.

**Files and modules**:

- `chg‑GH‑1‑spec.md`
- `chg‑GH‑1‑plan.md`

**Tests**:

- Consistency check: diff spec summary with plan summary.
- Open questions check: ensure each OQ has a resolution note.

**Completion signal**: Spec updated, open questions resolved.

### Phase 5: Finalize and Release

**Goal**: Apply version impact, update changelog, and mark change as complete.

**Tasks**:

- [ ] Determine version bump mechanism per repo conventions (consult `@architect`).
- [ ] Apply version bump if required (e.g., update version file).
- [ ] Create or update `CHANGELOG.md` with entry for GH‑1 (minor impact).
- [ ] Update spec status to “Implemented” after successful execution.
- [ ] Mark GitHub issue GH‑1 as ready for review.

**Acceptance Criteria**:

- Must: Version impact reflected (if versioning is used).
- Must: `CHANGELOG.md` contains an entry for GH‑1 with summary and version impact.
- Must: Spec status changed to “Implemented”.
- Should: GitHub issue transitioned to appropriate state (e.g., “Ready for Review”).

**Files and modules**:

- `CHANGELOG.md`
- `chg‑GH‑1‑spec.md`
- GitHub issue GH‑1

**Tests**:

- Changelog entry test: `grep -q "GH‑1" CHANGELOG.md`.
- Spec status test: `grep -q "status: Implemented" chg‑GH‑1‑spec.md`.
- GitHub issue state: confirm via `gh issue view GH‑1 --json state`.

**Completion signal**: Changelog updated, spec status updated, GitHub issue moved to review.

## Test Scenarios

**TS‑1 – PM instructions validation**:
- Precondition: `pm‑instructions.md` exists.
- Action: Verify content matches GitHub repository settings.
- Expected: All required fields (owner, repo, issue URL pattern, workflow‑state mapping) are correct.

**TS‑2 – Product backlog creation**:
- Precondition: `backlog.md` exists with 14 refined tickets.
- Action: Create `product‑backlog.md` from source.
- Expected: `product‑backlog.md` contains all 14 tickets with GitHub issue links, labels, and acceptance criteria.

**TS‑3 – MVP placeholder creation**:
- Precondition: No `mvp‑user‑stories.md` or `mvp‑prd.md` files.
- Action: Create placeholder files with minimal content.
- Expected: Both files exist and contain at least a descriptive sentence.

**TS‑4 – Directory structure verification**:
- Precondition: Unknown directory state.
- Action: Ensure `doc/changes/` and `doc/planning/product‑decisions/` exist.
- Expected: Both directories exist (created if missing).

**TS‑5 – Memory file management**:
- Precondition: `current‑product‑state.md` may or may not exist.
- Action: Update file with active change info and decide on git‑ignore.
- Expected: File exists with correct format; optionally added to `.gitignore`.

**TS‑6 – Changelog update**:
- Precondition: `CHANGELOG.md` may or may not exist.
- Action: Add entry for GH‑1 (minor impact).
- Expected: `CHANGELOG.md` contains entry with summary and version impact.

## Artifacts and Links

- **Change specification**: `chg‑GH‑1‑spec.md` (this folder)
- **Refined backlog source**: `doc/planning/tmp/backlog.md`
- **PM instructions**: `doc/planning/pm‑instructions.md`
- **Product backlog**: `doc/planning/product‑backlog.md`
- **MVP user stories**: `doc/planning/mvp‑user‑stories.md`
- **MVP PRD**: `doc/planning/mvp‑prd.md`
- **Temporary memory**: `doc/planning/current‑product‑state.md`
- **Changelog**: `CHANGELOG.md`
- **GitHub issue**: https://github.com/juliusz‑cwiakalski/agentic‑delivery‑os/issues/1

## Plan Revision Log

| Date | Version | Author | Change |
|------|---------|--------|--------|
| 2026‑02‑01T09:18:56Z | 1.0 | @plan‑writer | Initial plan created |

## Execution Log

| Date | Phase | Actor | Outcome | Notes |
|------|-------|-------|---------|-------|
| | | | | |