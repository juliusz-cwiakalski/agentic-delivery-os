# Product Backlog

**Date**: 2026-02-01  
**Context**: Based on north-star vision (Fractional CTO & AI Agentic Delivery Expert) – focus on repeatable, auditable delivery systems.  
**Goal**: High‑quality ticket definitions with clear problem statements, acceptance criteria, and appropriate labels.

---

<!-- TOC -->
* [Product Backlog](#product-backlog)
  * [Ranked Backlog (Highest Impact First)](#ranked-backlog-highest-impact-first)
    * [GH-1 – Set up PM agent workflow and issue tracking](#gh-1--set-up-pm-agent-workflow-and-issue-tracking)
    * [GH-5 – Improve PM agent configuration and context storage](#gh-5--improve-pm-agent-configuration-and-context-storage)
    * [GH-2 – Implement basic change specification template](#gh-2--implement-basic-change-specification-template)
    * [GH-3 – Create agent coordination protocol documentation](#gh-3--create-agent-coordination-protocol-documentation)
    * [GH-11 – PM: Focus on one story, branch from latest main, don't auto‑start next](#gh-11--pm-focus-on-one-story-branch-from-latest-main-dont-autostart-next)
    * [GH-9 – Automate finalizing approved changes](#gh-9--automate-finalizing-approved-changes)
    * [GH-10 – Optimize PM communication in issue trackers (minimal, relevant comments)](#gh-10--optimize-pm-communication-in-issue-trackers-minimal-relevant-comments)
    * [GH-14 – Implement multi‑model review system for higher quality](#gh-14--implement-multimodel-review-system-for-higher-quality)
    * [GH-16 – Create guidelines and rules for configuring and using MCP servers](#gh-16--create-guidelines-and-rules-for-configuring-and-using-mcp-servers)
    * [GH-7 – Delegate visual feedback to image‑reviewer agent when screenshots are mentioned](#gh-7--delegate-visual-feedback-to-imagereviewer-agent-when-screenshots-are-mentioned)
    * [GH-12 – Create project setup guide for agentic delivery OS](#gh-12--create-project-setup-guide-for-agentic-delivery-os)
    * [GH-13 – Create ChatGPT bot with knowledge of agentic‑delivery‑os](#gh-13--create-chatgpt-bot-with-knowledge-of-agenticdeliveryos)
    * [GH-15 – Import missing agents/commands from FlagshipX](#gh-15--import-missing-agentscommands-from-flagshipx)
    * [GH-4 – Add example change for demonstration](#gh-4--add-example-change-for-demonstration)
<!-- TOC -->

## Legend

**Labels used**:
- `change` – Work that delivers a change (spec → plan → implementation)
- `priority:high` – Must be completed soon; blocks other work
- `priority:medium` – Should be completed in normal sequence
- `priority:low` – Can be deferred; nice‑to-have
- `agent‑improvement` – Improves agent behavior or capabilities
- `documentation` – Creates or improves documentation
- `automation` – Automates manual steps
- `bug` – Fixes incorrect behavior
- `quality` – Improves output quality
- `security` – Addresses security concerns
- `tooling` – Adds or improves tools
- `community` – Helps community/adoption
- `example` – Example/demonstration artifact
- `planning` – Foundational planning work

---

### GH-1 – Set up PM agent workflow and issue tracking
**Labels**: `change`, `priority:high`, `planning`  
**GitHub Issue**: [GH-1](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/1)
**Status**: open  
**Created**: 2026‑01‑28  
**Rank**: 1  
**Impact**: Foundational  
**Leverage**: Critical

**Problem Statement**:  
The agentic delivery OS cannot start delivering changes until the PM agent is configured with GitHub issue tracking and the basic workflow artifacts exist.

**Acceptance Criteria**:
- [ ] `doc/planning/pm-instructions.md` created with GitHub issue tracking configuration
- [ ] `doc/planning/current-product-state.md` created for PM agent memory (temporary; will be migrated in GH-5)
- [ ] `doc/planning/product-backlog.md` created with initial backlog items
- [ ] `doc/planning/mvp-user-stories.md` and `doc/planning/mvp-prd.md` created
- [ ] Directory structure (`doc/changes/`, `doc/planning/product-decisions/`) created

**Implementation Notes**:
- This is the bootstrap change for the entire workflow.
- Follow the unified change convention (workItemRef `GH-1`).
- The PM agent definition (`@.opencode/agent/pm.md`) already exists; this change creates the repository‑specific configuration.

**Dependencies**: None (foundational).

---

### GH-5 – Improve PM agent configuration and context storage
**Labels**: `change`, `priority:high`, `agent‑improvement`  
**GitHub Issue**: [GH-5](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/5)
**Status**: open  
**Created**: 2026‑01‑28  
**Rank**: 2  
**Impact**: High  
**Leverage**: High

**Problem Statement**:  
The PM agent has hardcoded configurations that limit flexibility and violate separation of concerns:
1. Hardcoded backlog files (`product‑backlog.md`, `mvp‑user‑stories.md`, `mvp‑prd.md`) in `<inputs>`.
2. Memory file uses `doc/planning/current‑product‑state.md`, not the unified `.ai/local/` convention.
3. Ticket‑operation instructions are embedded in the agent definition instead of repository‑specific config.
4. Inconsistent agent‑context storage across agents.

**Acceptance Criteria**:
- [ ] Remove hardcoded backlog‑file references from PM agent `<inputs>` section
- [ ] Add configuration in `pm‑instructions.md` (or `.ai/agents/pm.md`) to specify backlog source (files vs tracker query)
- [ ] Update discovery rules to use configured backlog source
- [ ] Change memory file from `doc/planning/current‑product‑state.md` to `.ai/local/pm‑context.yaml` (YAML format)
- [ ] Ensure `.ai/local/pm‑context.yaml` is git‑ignored
- [ ] Update workflow steps that read/write current product state
- [ ] Decide standard location for PM instructions (`.ai/agents/pm‑instructions.md` vs `doc/planning/pm‑instructions.md`)
- [ ] Move repository‑specific ticket‑operation mappings out of the agent definition file
- [ ] Maintain backward compatibility during transition

**Implementation Notes**:
- Reference: unified change convention, current PM agent (`@.opencode/agent/pm.md`).
- YAML format proposal:
  ```yaml
  active_change:
    workItemRef: GH-1
    title: "Set up PM agent workflow"
    status: "planning"
    phase: "planning"
  recently_delivered: []
  next_steps: []
  open_questions: []
  notes: ""
  ```

**Open Questions**:
- Should we keep `doc/planning/pm‑instructions.md` as the authoritative config and symlink/.ai/agents as a convenience?

**Dependencies**: GH-1 (needs PM instructions file).

---

### GH-2 – Implement basic change specification template
**Labels**: `change`, `priority:high`, `documentation`  
**GitHub Issue**: [GH-2](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/2)
**Status**: open  
**Created**: 2026‑01‑28  
**Rank**: 3  
**Impact**: High  
**Leverage**: High

**Problem Statement**:  
Change specifications need a consistent template that follows the unified change convention, ensuring all required sections are present and guidance is clear.

**Acceptance Criteria**:
- [ ] Create `chg‑template‑spec.md` with all required sections
- [ ] Ensure template follows unified change convention
- [ ] Include examples and guidance for each section
- [ ] Document template usage in appropriate documentation

**Implementation Notes**:
- Template should be placed in `doc/changes/templates/` or similar.
- Sections should include: problem statement, goals, scope, out‑of‑scope, acceptance criteria, risks, dependencies.
- Reference: unified change convention guide.

**Dependencies**: None.

---

### GH-3 – Create agent coordination protocol documentation
**Labels**: `change`, `priority:medium`, `documentation`  
**GitHub Issue**: [GH-3](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/3)
**Status**: open  
**Created**: 2026‑01‑28  
**Rank**: 4  
**Impact**: Medium  
**Leverage**: High

**Problem Statement**:  
Specialized agents (PM, delivery, architect, reviewer, etc.) need clear coordination patterns to work together efficiently during change delivery. Lack of documentation leads to ad‑hoc coordination and potential conflicts.

**Acceptance Criteria**:
- [ ] Create `doc/guides/agent‑coordination‑protocol.md`
- [ ] Document communication patterns between agents (delegation, handoff, conflict resolution)
- [ ] Define conflict‑resolution mechanisms
- [ ] Provide examples of multi‑agent coordination

**Implementation Notes**:
- Focus on practical patterns used in the workflow (e.g., PM → spec‑writer → plan‑writer → test‑plan‑writer → delivery‑agent).
- Include decision‑making authority and escalation paths.

**Dependencies**: None.

---

### GH-11 – PM: Focus on one story, branch from latest main, don't auto‑start next
**Labels**: `change`, `priority:medium`, `bug`, `agent‑improvement`  
**GitHub Issue**: [GH-11](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/11)
**Status**: open  
**Created**: 2026‑01‑30  
**Rank**: 5  
**Impact**: Medium  
**Leverage**: Medium

**Problem Statement**:  
The PM agent currently exhibits two problematic behaviors:
1. When a story is ready for review, it automatically starts working on another story in the same conversation.
2. When starting a new change, it branches from the current (previous change) branch instead of the latest `main` branch, potentially carrying unreviewed/unmerged changes.

**Acceptance Criteria**:
- [ ] PM works on exactly one story per conversation.
- [ ] When a story is ready for review (PR created), PM stops and does not start another story automatically.
- [ ] New change branches are always created from the most recent `main` branch (fetch origin/main if needed).
- [ ] If there are uncommitted changes on the current branch, commit/push them before switching to a new change.
- [ ] PM logs the branch‑creation step (source branch = main, new branch = `<type>/<workItemRef>/<slug>`).

**Implementation Notes**:
- Simple fix: improve PM agent prompt to enforce single‑story focus and correct branching.
- Better fix: programmatic flow in `@delivery‑agent` or PM workflow:
  1. If changes on current branch, commit+push.
  2. Fetch origin/main.
  3. Create new branch from origin/main.
- Merge GH-8 into this ticket and close GH-8 as duplicate.

**Dependencies**: None.

---

### GH-9 – Automate finalizing approved changes
**Labels**: `change`, `priority:medium`, `automation`  
**GitHub Issue**: [GH-9](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/9)
**Status**: open  
**Created**: 2026‑01‑29  
**Rank**: 6  
**Impact**: Medium  
**Leverage**: Medium

**Problem Statement**:  
When `@pm` decides a change is ready, it assigns the ticket and MR to a human reviewer. After human approval, the reviewer still must manually merge the MR and close the ticket. This creates unnecessary manual steps.

**Acceptance Criteria**:
- [ ] When a PR/MR is approved by a human reviewer, automatically merge it (using repository rules or automation).
- [ ] After successful merge, automatically transition the associated Jira/GitHub ticket to “Done” (or equivalent).
- [ ] Clean up local feature branches (optional, can be left to Git housekeeping).
- [ ] Log the closure in the change artifacts.

**Implementation Notes**:
- Could use GitHub Actions / GitLab CI with required approvals.
- Need to map PR/MR to ticket (via branch name or PR description containing `workItemRef`).
- Consider safety: only auto‑merge when all required checks pass and at least one human approval exists.

**Open Questions**:
- Should auto‑merge happen immediately after approval, or wait for a time window?
- How to handle multi‑repo changes (one ticket, multiple PRs)?

**Dependencies**: None.

---

### GH-10 – Optimize PM communication in issue trackers (minimal, relevant comments)
**Labels**: `change`, `priority:medium`, `agent‑improvement`  
**GitHub Issue**: [GH-10](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/10)
**Status**: open  
**Created**: 2026‑01‑30  
**Rank**: 7  
**Impact**: Medium  
**Leverage**: Medium

**Problem Statement**:  
The PM agent currently posts lengthy status‑update comments in tickets (e.g., “starting planning”, “delivery begun”). These add noise without value. Humans need only relevant information: open questions, decisions, blockers.

**Acceptance Criteria**:
- [ ] PM agent comments only when:
  - There is an open question for the human.
  - A product/technical decision needs confirmation.
  - A blocker is encountered.
  - The change reaches a major milestone (spec ready, PR created, ready for review).
- [ ] Comments are concise, focused, and easy to reply to.
- [ ] Status‑only updates are omitted (tracker status transition is enough).
- [ ] Prompt is tuned to produce minimal, actionable content.

**Implementation Notes**:
- Review example conversations in Jira/GitHub to create a tuned prompt.
- Inspired by LinkedIn comment on effective AI‑human communication.

**Dependencies**: None.

---

### GH-14 – Implement multi‑model review system for higher quality
**Labels**: `change`, `priority:medium`, `quality`, `review`  
**GitHub Issue**: [GH-14](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/14)
**Status**: open  
**Created**: 2026‑02‑01  
**Rank**: 8  
**Impact**: Medium  
**Leverage**: Low

**Problem Statement**:  
Single‑model code review may miss issues that another model would catch. Using multiple models (with potentially different prompts) could improve review quality, albeit at higher cost.

**Acceptance Criteria**:
- [ ] Design a review orchestration that can run `@reviewer` with different models (e.g., Claude 3.5 Sonnet, GPT‑4, DeepSeek‑Reasoner).
- [ ] Define whether reviews run in parallel or sequence.
- [ ] Merge findings from multiple reviews into a single remediation plan.
- [ ] Measure improvement in defect detection vs. cost increase.
- [ ] Optionally, use cheaper model for first pass, expensive model for final pass.

**Implementation Notes**:
- Majority of tokens are input (code), which is relatively cheap.
- Review should not be where costs are cut.
- Experimentation needed to find optimal model‑routing heuristics.

**Open Questions**:
- Run in parallel or sequence?
- Use different prompts per model?
- How to merge conflicting feedback?

**Dependencies**: None.

---

### GH-16 – Create guidelines and rules for configuring and using MCP servers
**Labels**: `change`, `priority:medium`, `security`, `tooling`  
**GitHub Issue**: [GH-16](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/16)
**Status**: open  
**Created**: 2026‑02‑01  
**Rank**: 9  
**Impact**: Medium  
**Leverage**: Low

**Problem Statement**:  
MCP (Model Context Protocol) servers provide powerful capabilities but introduce security risks. Teams need clear guidelines on how to balance security with usability, choose tested versions, and establish update policies.

**Acceptance Criteria**:
- [ ] Document security assessment for common MCP servers (filesystem, GitHub, Jira, etc.).
- [ ] Define heuristics for version selection (e.g., wait X days after release, prefer stable channels).
- [ ] Create a process for reviewing new MCP servers before adoption.
- [ ] Provide configuration examples with least‑privilege principles.
- [ ] Address the trade‑off between “always latest” (features) and “security”.

**Implementation Notes**:
- Reference: PR #6 discussion comment https://github.com/juliusz-cwiakalski/agentic-delivery-os/pull/6#discussion_r2735172668
- Target audience: teams adopting agentic delivery OS.

**Dependencies**: None.

---

### GH-7 – Delegate visual feedback to image‑reviewer agent when screenshots are mentioned
**Labels**: `change`, `priority:low`, `agent‑improvement`  
**GitHub Issue**: [GH-7](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/7)
**Status**: open  
**Created**: 2026‑01‑29  
**Rank**: 10  
**Impact**: Low  
**Leverage**: Low

**Problem Statement**:  
When human feedback includes references to screenshots, images, or visual issues, the PM agent should automatically delegate to the `@image‑reviewer` agent for analysis instead of trying to interpret visual content itself.

**Acceptance Criteria**:
- [ ] PM agent detects mentions of “screenshot”, “image”, “picture”, “visual”, “UI”, “layout” in feedback comments.
- [ ] PM automatically delegates to `@image‑reviewer` agent with appropriate context (image file path or URL).
- [ ] Image‑reviewer’s findings are incorporated into the remediation plan.
- [ ] If no image is attached but one is referenced, PM asks human to provide the image.

**Implementation Notes**:
- Requires image‑reviewer agent to be available and configured.
- Simple keyword detection is sufficient for first version.

**Dependencies**: `@image‑reviewer` agent must be functional.

---

### GH-12 – Create project setup guide for agentic delivery OS
**Labels**: `change`, `priority:low`, `documentation`  
**GitHub Issue**: [GH-12](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/12)
**Status**: open  
**Created**: 2026‑01‑31  
**Rank**: 11  
**Impact**: Low  
**Leverage**: Medium

**Problem Statement**:  
New users need clear instructions on how to set up the agentic delivery OS in their own environment, including OpenCode configuration, MCP servers, multi‑repo setups, and quality gates tuned for AI‑generated code.

**Acceptance Criteria**:
- [ ] Step‑by‑step guide for local development environment (OpenCode installation, MCP server setup).
- [ ] Instructions for multi‑repo configuration (coordinating changes across repositories).
- [ ] Quality‑gates script tuned for AI‑generated code (what checks to run, thresholds).
- [ ] Common pitfalls and troubleshooting.
- [ ] Example `.gitignore`, `.env.example`, configuration files.

**Implementation Notes**:
- Place guide in `doc/guides/setup‑guide.md`.
- Include both “quick start” and “production‑ready” paths.

**Dependencies**: None.

---

### GH-13 – Create ChatGPT bot with knowledge of agentic‑delivery‑os
**Labels**: `change`, `priority:low`, `tooling`, `community`  
**GitHub Issue**: [GH-13](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/13)
**Status**: open  
**Created**: 2026‑01‑31  
**Rank**: 12  
**Impact**: Low  
**Leverage**: Low

**Problem Statement**:  
Users may want to ask questions about agentic delivery OS without digging through documentation. A ChatGPT bot (custom GPT) trained on the project’s knowledge base could provide instant guidance.

**Acceptance Criteria**:
- [ ] Build a comprehensive knowledge base (markdown files) covering agents, commands, workflows, conventions.
- [ ] Integrate with ChatGPT custom GPT or similar platform.
- [ ] Test bot’s ability to answer common questions and guide users through the workflow.
- [ ] Document how to update the knowledge base when the project evolves.

**Implementation Notes**:
- Knowledge base can be built from existing `doc/` and `.opencode/` files.
- This is an external tool, not part of the core workflow.

**Dependencies**: None.

---

### GH-15 – Import missing agents/commands from FlagshipX
**Labels**: `change`, `priority:low`, `maintenance`  
**GitHub Issue**: [GH-15](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/15)
**Status**: open  
**Created**: 2026‑02‑01  
**Rank**: 13  
**Impact**: Low  
**Leverage**: Low

**Problem Statement**:  
This repository may be missing some agents or commands that exist in the FlagshipX repository. A systematic import ensures we have a complete set of reference tooling.

**Acceptance Criteria**:
- [ ] Identify which agents/commands from FlagshipX are missing in this repo.
- [ ] Import them, ensuring compatibility with existing conventions (e.g., unified change convention).
- [ ] Update documentation to reflect the expanded agent/command set.
- [ ] Verify that imported agents work correctly in the agentic delivery OS context.

**Implementation Notes**:
- May already be partially done; verify current state first.
- Focus on agents that are relevant to the delivery workflow (not UI‑specific ones).

**Open Questions**:
- Which agents/commands are already imported?
- Are there any FlagshipX‑specific dependencies that need adaptation?

**Dependencies**: None.

---

### GH-4 – Add example change for demonstration
**Labels**: `change`, `priority:low`, `documentation`, `example`  
**GitHub Issue**: [GH-4](https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/4)
**Status**: open  
**Created**: 2026‑01‑28  
**Rank**: 14  
**Impact**: Low  
**Leverage**: Low

**Problem Statement**:  
New contributors need a complete, realistic example change to understand the workflow, artifact structure, and agent coordination.

**Acceptance Criteria**:
- [ ] Create a full example change in `doc/changes/examples/`
- [ ] Include complete spec, plan, and test plan
- [ ] Demonstrate all phases of the change lifecycle
- [ ] Show coordination between multiple agents
- [ ] Document lessons learned and best practices

**Implementation Notes**:
- Example should be self‑contained and illustrative (e.g., “add a new command” or “improve a template”).
- Can be used as a training resource.

**Dependencies**: GH-2 (spec template) would help but not required.