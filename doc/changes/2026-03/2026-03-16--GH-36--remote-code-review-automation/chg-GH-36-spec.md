---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-03/2026-03-16--GH-36--remote-code-review-automation/chg-GH-36-spec.md
change:
  ref: GH-36
  type: feat
  status: Proposed
  slug: remote-code-review-automation
  title: "Remote code review and review-feedback automation"
  owners: [juliusz-cwiakalski]
  service: delivery-os
  labels: [code-review, automation, multi-platform, developer-experience]
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal: [pr-manager, reviewer, toolsmith]
    external: [gh-cli, glab-cli]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Add two new ADOS workflows — remote code review generation and review-feedback application — enabling agents to review open PRs/MRs against repository-specific rules and to apply accepted feedback from remote review systems back into the local codebase, with first-class support for both GitHub and GitLab.

## 1. SUMMARY

This change introduces two new agents (`code-reviewer`, `review-feedback-applier`) and two new commands (`/review-remote`, `/apply-review-feedback`) that extend ADOS into the remote review domain. The `code-reviewer` agent reads an active PR/MR, analyzes the diff against a repository-local checklist and instructions, produces actionable findings, and can publish them to the remote platform. The `review-feedback-applier` agent reads review comments/threads from a remote PR/MR, classifies which feedback the author accepted, and applies accepted changes locally. Both workflows support GitHub and GitLab from v1, with a platform-neutral core and platform-specific CLI adapters mirroring established `@pr-manager` patterns.

## 2. CONTEXT

### 2.1 Current State Snapshot

- ADOS has a mature local review workflow via `@reviewer` that validates implementation against the change specification and plan. This agent operates entirely within the local repository — it reads git diffs, checks plan status, and appends remediation tasks if needed.
- `@pr-manager` already handles PR/MR creation and update with platform detection (GitHub via `gh`, GitLab via `glab`), `branchPath` sanitization, state persistence under `tmp/pr/<branchPath>/`, and ticket context enrichment via MCP.
- There is no agent or command that reads an existing PR/MR's review comments, analyzes an MR/PR diff against repository-specific review rules, or applies feedback from remote review systems.
- Repository-level customization for reviews does not exist — there are no checklist files or review instruction files in `.ai/`.

### 2.2 Pain Points / Gaps

- **No remote review capability**: When a PR/MR is open, there is no ADOS workflow to analyze it from a reviewer's perspective using repository-specific rules and publish findings.
- **No feedback application**: After human or AI reviewers leave comments on a PR/MR, there is no automated way to classify accepted feedback and apply it locally — authors must manually read threads and implement changes.
- **Review customization gap**: Repositories cannot define code-review checklists or conventions that an automated reviewer would follow.
- **Platform fragmentation risk**: Without a platform-neutral design, supporting multiple Git hosting platforms would require separate agent families.

## 3. PROBLEM STATEMENT

Because ADOS lacks a workflow for reviewing open PRs/MRs against repository-specific rules and for applying accepted review feedback locally, developers cannot leverage AI agents to reduce reviewer cognitive load, enforce consistent review standards across repositories, or automate the application of accepted changes — resulting in slower review cycles, inconsistent review quality, and manual toil when addressing feedback.

## 4. GOALS

- **G-1**: Enable AI-driven review of open PRs/MRs against repository-specific checklists and instructions, producing actionable findings that can be published to the remote platform.
- **G-2**: Enable automated classification and local application of accepted review feedback from remote PR/MR threads.
- **G-3**: Support both GitHub and GitLab platforms from v1 using a platform-neutral core with platform-specific CLI adapters.
- **G-4**: Provide repository-level customization via `.ai/checklists/code-review.md` and `.ai/agent/code-review-instructions.md`.
- **G-5**: Maintain strict separation from the existing `@reviewer` agent — no changes to its behavior or responsibilities.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| New agents functional | 2 agents (`code-reviewer`, `review-feedback-applier`) operational on both GitHub and GitLab |
| New commands functional | 2 commands (`/review-remote`, `/apply-review-feedback`) invocable |
| Platform detection accuracy | Mirrors `@pr-manager` — auto-detects from `git remote get-url origin` |
| Existing reviewer unchanged | Zero modifications to `.opencode/agent/reviewer.md` |
| Review deduplication | Findings are deduplicated against existing PR/MR comments before publishing |
| Feedback classification safety | Ambiguous feedback items are never auto-applied |

### 4.2 Non-Goals

- **NG-1**: Auto-merge, auto-approve, or auto-close PRs/MRs.
- **NG-2**: Auto-commit or auto-push applied changes by default.
- **NG-3**: Azure DevOps implementation (design for future extensibility, but do not implement adapters).
- **NG-4**: Autonomous reviewer conversations — agents do not engage in multi-turn discussions across PR/MR threads.
- **NG-5**: Changing the existing `@reviewer` agent behavior or responsibilities.
- **NG-6**: Automatic creation of work items or tickets from review findings.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | `code-reviewer` agent that analyzes an active PR/MR diff against repository-specific rules | Enables consistent, automated code review using repository conventions |
| F-2 | `review-feedback-applier` agent that classifies and applies accepted review feedback locally | Reduces manual toil when addressing accepted PR/MR feedback |
| F-3 | `/review-remote` command as user-facing entry point for remote code review | Provides a standard ADOS command interface for the review workflow |
| F-4 | `/apply-review-feedback` command as user-facing entry point for feedback application | Provides a standard ADOS command interface for the feedback workflow |
| F-5 | Platform detection mirroring `@pr-manager` patterns (auto-detect from `origin` remote) | Ensures consistent platform behavior across ADOS commands |
| F-6 | Repository-local review configuration via `.ai/agent/code-review-instructions.md` (originally also `.ai/checklists/code-review.md`, consolidated per DEC-14) | Allows each repository to define its own review rules and conventions |
| F-7 | Review draft generation before publishing | Gives users a preview and control over what gets published |
| F-8 | Finding deduplication against existing PR/MR comments | Prevents duplicate review comments across multiple runs |
| F-9 | Feedback acceptance detection via explicit `AI-APPLY` markers and conservative fuzzy matching | Enables reliable classification of which comments the author wants applied |
| F-10 | Pre-flight safety checks (dirty tree, auth, branch state) | Ensures workflows start from a clean, valid state |
| F-11 | Temporary state persistence under `tmp/code-review/<branchPath>/` and `tmp/review-feedback/<branchPath>/` | Follows ADOS `tmp/` conventions for per-branch artifacts |
| F-12 | Documentation updates to `.opencode/README.md` and `AGENTS.md` | Maintains tooling inventory per repo conventions |
| F-13 | Repository-local PR/MR platform instructions via `.ai/agent/pr-instructions.md` (from GH-39) | Extracts hardcoded platform detection and CLI commands from agent prompts into a single config file, mirroring `pm-instructions.md` pattern |
| F-14 | Refactor `@code-reviewer`, `@review-feedback-applier`, and `@pr-manager` to read `pr-instructions.md` (from GH-39) | Agents define WHAT operations to perform; `pr-instructions.md` defines HOW; graceful fallback when absent |
| F-15 | PR/MR platform instructions template at `doc/templates/pr-instructions-template.md` (from GH-39) | Enables other repos to configure PR/MR platform access by copying and customizing the template |
| F-16 | PR/MR platform integration guide at `doc/guides/pr-platform-integration.md` (from GH-39) | Documents supported integration types (GitHub CLI, GitLab CLI, GitHub MCP, Azure DevOps MCP) with setup instructions |
| F-17 | Bootstrapper PR/MR platform interview and artifact generation (from GH-39) | Extends `@bootstrapper` to ask about Git platform and generate `pr-instructions.md` during adoption |

### 5.1 Capability Details

**F-1 — Remote code review agent (`code-reviewer`)**
The agent receives a PR/MR reference (auto-detected or explicit), fetches the diff and metadata from the remote platform, loads repository-local checklist and instructions if present, and produces structured review findings. Each finding includes: severity, file path, line reference, description, and suggested fix. The agent generates a review draft locally before any publishing step. When publishing, inline comments are placed at diff positions where possible, with fallback to review-level comments when position mapping fails.

**F-2 — Review feedback applier agent (`review-feedback-applier`)**
The agent reads all review threads/comments from a PR/MR, classifies each as: explicitly accepted (via `AI-APPLY` marker), implicitly accepted (conservative fuzzy detection of agreement language), explicitly rejected, or ambiguous. Only explicitly and implicitly accepted items are applied. Ambiguous items are listed for manual review. The agent modifies local source files but does not commit or push by default.

**F-5 — Platform detection**
Platform detection follows `@pr-manager` conventions: parse `git remote get-url origin` for `github.com` or `gitlab.com` host patterns. Fallback to `gh auth status` / `glab auth status`. Override via `--github` or `--gitlab` flags. If still unknown, output `NEEDS_INPUT` with rerun suggestion.

**F-6 — Repository-local review configuration**
Two optional files control review behavior:
- `.ai/checklists/code-review.md`: structured checklist of review criteria (e.g., error handling, naming conventions, test coverage, security patterns). Each item is a checkbox with description. The agent evaluates each applicable item against the diff.
- `.ai/agent/code-review-instructions.md`: free-form instructions for the review agent (e.g., "focus on performance in hot paths", "this repo uses Result types for error handling", "ignore formatting — handled by CI"). When these files are absent, the agent uses built-in general-purpose review heuristics.

**F-7 — Review draft generation**
The review draft is a local Markdown file (`review-draft.md`) that shows exactly what would be published: summary comment, inline findings with file/line references, and severity labels. The user can inspect and optionally edit before publishing. Publishing is a separate explicit action within the command flow.

**F-8 — Finding deduplication**
Before publishing, the agent fetches existing review comments on the PR/MR and compares them against new findings by: file path, approximate line range, and semantic similarity of the comment text. Findings that substantially overlap with existing comments are suppressed from publishing. This prevents noise accumulation across multiple review runs.

**F-9 — Feedback acceptance detection**
Three-tier classification:
1. **Explicit acceptance**: Comment contains an `AI-APPLY` marker (case-insensitive, standalone token). Highest confidence — always applied.
2. **Implicit acceptance**: Comment body matches conservative patterns indicating agreement (e.g., "good point, will fix", "agreed", "done"). Applied with slightly lower confidence. The agent documents its reasoning for each implicit classification.
3. **Ambiguous**: Comment does not clearly indicate acceptance or rejection. Never auto-applied — listed in a report for manual resolution.

**F-10 — Pre-flight safety checks**
Both commands verify before proceeding:
- Working tree is clean (`git status --porcelain` is empty). If dirty, STOP with a message advising the user to commit or stash.
- Git repo exists and HEAD is on a branch (not detached).
- Platform CLI tool is available and authenticated.
- Active PR/MR exists for the current branch (or the specified ID resolves).

**F-11 — Temporary state persistence**
Artifacts follow the `@pr-manager` `branchPath` convention:
- `tmp/code-review/<branchPath>/`: `context.json`, `diff.patch`, `comments-snapshot.json`, `review-draft.md`, `findings.json`, `publish-report.json`
- `tmp/review-feedback/<branchPath>/`: `threads-snapshot.json`, `classification-report.md`, `applied-changes.json`, `skipped-items.md`

`branchPath` sanitization: replace non-`[A-Za-z0-9._/-]` with `_`, replace `..` with `__`, trim leading `/`.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Remote code review (happy path)
  User runs /review-remote on a branch with an open PR/MR
  → Command detects platform (GitHub/GitLab) from origin remote
  → Command resolves active PR/MR for current branch
  → Pre-flight checks pass (clean tree, auth, PR/MR exists)
  → Agent fetches diff + metadata + existing comments from remote
  → Agent loads .ai/checklists/code-review.md (if present)
  → Agent loads .ai/agent/code-review-instructions.md (if present)
  → Agent analyzes diff against checklist + instructions + built-in heuristics
  → Agent generates review-draft.md locally
  → Agent deduplicates findings against existing PR/MR comments
  → Agent presents draft to user (dry-run by default)
  → User approves publishing
  → Agent publishes findings to PR/MR (summary + inline comments)
  → Artifacts saved to tmp/code-review/<branchPath>/

Flow 2: Apply review feedback (happy path)
  User runs /apply-review-feedback on a branch with an open PR/MR
  → Command detects platform and resolves PR/MR
  → Pre-flight checks pass (clean tree, auth, PR/MR exists)
  → Agent fetches all review threads/comments from PR/MR
  → Agent classifies each comment: explicit-accept / implicit-accept / rejected / ambiguous
  → Agent generates classification-report.md
  → Agent applies accepted changes to local files
  → Agent generates applied-changes.json and skipped-items.md
  → Agent reports what was applied and what needs manual attention
  → User reviews changes, commits, and pushes manually

Flow 3: Review with no repository-local config
  User runs /review-remote in a repo without .ai/checklists/ or .ai/agent/code-review-instructions.md
  → Agent falls back to built-in general-purpose review heuristics
  → Review proceeds normally with generic rules

Flow 4: Dirty working tree
  User runs /review-remote or /apply-review-feedback with uncommitted changes
  → Pre-flight check detects dirty tree
  → Command STOPS with message advising user to commit or stash
  → No changes made
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- New agent: `code-reviewer` at `.opencode/agent/code-reviewer.md`
- New agent: `review-feedback-applier` at `.opencode/agent/review-feedback-applier.md`
- New command: `/review-remote` at `.opencode/command/review-remote.md`
- New command: `/apply-review-feedback` at `.opencode/command/apply-review-feedback.md`
- Platform-neutral core with GitHub (`gh`) and GitLab (`glab`) adapter support
- Repository-local review configuration files: `.ai/checklists/code-review.md`, `.ai/agent/code-review-instructions.md`
- Temporary state under `tmp/code-review/<branchPath>/` and `tmp/review-feedback/<branchPath>/`
- Pre-flight safety checks (dirty tree, auth, branch state)
- Review draft generation before publishing
- Deduplication of findings against existing PR/MR comments
- Feedback acceptance detection (explicit markers + conservative fuzzy matching)
- Documentation updates: `.opencode/README.md`, `AGENTS.md`

### 7.2 Out of Scope

- [OUT] Auto-merge, auto-approve, or auto-close PRs/MRs
- [OUT] Auto-commit or auto-push applied changes by default
- [OUT] Azure DevOps adapter implementation (design for future, do not implement)
- [OUT] Autonomous reviewer conversations across threads
- [OUT] Changing existing `@reviewer` agent behavior
- [OUT] Automatic creation of work items or tickets from review findings
- [OUT] CI/CD integration or webhook-triggered reviews
- [OUT] Review of draft/WIP PRs/MRs (only open, active reviews)

### 7.3 Deferred / Maybe-Later

- Azure DevOps adapter implementation
- Webhook-triggered automatic reviews on PR/MR creation
- Review feedback threading — responding to specific threads with "applied" confirmation
- Batch review across multiple open PRs/MRs
- Review template marketplace or sharing mechanism
- Integration with ADOS `@reviewer` for combined local+remote review workflows

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no application code; agent prompts and command definitions only.

### 8.2 Events / Messages

N/A

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `.ai/agent/code-review-instructions.md` | Repository-local review guidance (originally `.ai/checklists/code-review.md`, consolidated per DEC-14) |
| DM-2 | `.ai/agent/code-review-instructions.md` | Optional repository-local free-form review instructions |
| DM-3 | `tmp/code-review/<branchPath>/context.json` | Review context: platform, PR/MR ID, branch, base, metadata |
| DM-4 | `tmp/code-review/<branchPath>/findings.json` | Structured review findings with severity, file, line, description, fix |
| DM-5 | `tmp/code-review/<branchPath>/review-draft.md` | Human-readable review draft for preview before publishing |
| DM-6 | `tmp/review-feedback/<branchPath>/classification-report.md` | Feedback classification results: accepted, rejected, ambiguous |
| DM-7 | `tmp/review-feedback/<branchPath>/applied-changes.json` | Log of changes applied from accepted feedback |

### 8.4 External Integrations

| Integration | Purpose | CLI Tool |
|-------------|---------|----------|
| GitHub Pull Requests API | Fetch PR metadata, diff, comments; publish review comments | `gh` |
| GitLab Merge Requests API | Fetch MR metadata, diff, discussions; publish review notes | `glab` |

### 8.5 Backward Compatibility

- **Existing `@reviewer` agent**: Zero changes. The new `code-reviewer` agent operates in a completely separate namespace and workflow.
- **Existing `@pr-manager` agent**: No changes to its behavior. The new agents reuse its patterns (platform detection, branchPath conventions) but do not modify or invoke it.
- **`.ai/` directory**: New optional files added (`.ai/checklists/code-review.md`, `.ai/agent/code-review-instructions.md`). Their absence is explicitly handled as a graceful fallback — no existing behavior is affected.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Platform parity | Both agents produce equivalent behavior on GitHub and GitLab for the same diff content |
| NFR-2 | Review read-only guarantee | The `/review-remote` workflow makes zero modifications to source code files in the working tree |
| NFR-3 | Feedback application safety | The `/apply-review-feedback` workflow never auto-commits and never auto-pushes |
| NFR-4 | Deduplication effectiveness | Re-running `/review-remote` on an unchanged PR/MR produces zero new published comments |
| NFR-5 | Ambiguity safety | Feedback items classified as "ambiguous" are never auto-applied; they appear only in `skipped-items.md` |
| NFR-6 | Graceful degradation | Both agents function correctly when `.ai/checklists/code-review.md` and `.ai/agent/code-review-instructions.md` are absent |
| NFR-7 | State isolation | Review artifacts for different branches are isolated under separate `<branchPath>/` directories |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — agent prompts and command definitions only; no runtime telemetry applicable.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Large scope — 2 agents + 2 commands + config + docs in a single ticket | H | M | Phased delivery plan with independent phases per agent/command. Each phase is independently testable. | Medium — careful phasing limits blast radius |
| RSK-2 | Platform CLI differences between `gh` and `glab` require adapter-specific workarounds | M | M | Mirror `@pr-manager` proven patterns for platform detection and CLI usage. Use JSON output modes where available. Document platform-specific quirks. | Low — `@pr-manager` has already solved this pattern |
| RSK-3 | Diff position mapping for inline comments is unreliable across platforms | M | H | Design fallback: if inline positioning fails, fall back to review-level (top-level) comments with explicit file:line references in text. Document this behavior. | Low — graceful degradation preserves all information |
| RSK-4 | Fuzzy acceptance detection produces false positives, applying unwanted changes | H | M | Conservative classification: only clear acceptance patterns qualify as "implicit accept". Ambiguous items are never applied. Classification report enables human audit before commit. | Low — conservative bias + no auto-commit |
| RSK-5 | Review findings become stale if PR/MR is updated between review and publish | M | L | Timestamp review context; warn user if PR/MR has new commits since review was generated. Do not prevent publishing — let user decide. | Low — warning is sufficient |
| RSK-6 | Review-feedback-applier modifies files incorrectly based on ambiguous comment context | H | M | Agent must read surrounding code context, not just the comment text. Applied changes are local only (no commit/push). User reviews diff before committing. | Low — local-only changes + human review |

## 12. ASSUMPTIONS

- `gh` CLI is installed and authenticated for GitHub repositories (same assumption as `@pr-manager`).
- `glab` CLI is installed and authenticated for GitLab repositories (same assumption as `@pr-manager`).
- Both CLIs support JSON output for PR/MR metadata, comments, and diff retrieval.
- The `branchPath` sanitization convention from `@pr-manager` is stable and reusable.
- `.ai/` directory conventions (optional files, graceful fallback) are consistent across ADOS repositories.
- Inline comment APIs support at least file + line number positioning (platform-specific position formats may differ).
- The `AI-APPLY` marker convention is new and does not conflict with any existing ADOS conventions.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on (pattern) | `@pr-manager` agent | Reuse platform detection, branchPath sanitization, tmp/ conventions, CLI reference patterns. No code dependency — pattern reuse only. |
| Depends on (tool) | `gh` CLI | Required for GitHub PR operations |
| Depends on (tool) | `glab` CLI | Required for GitLab MR operations |
| Internal (update) | `.opencode/README.md` | Must be updated with new agent and command entries |
| Internal (update) | `AGENTS.md` | Must be updated with new agent and command entries |
| Does not affect | `@reviewer` agent | Existing agent is unchanged |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the `code-reviewer` agent support reviewing PRs/MRs that the current user authored, or only others' PRs? | Self-review can be valuable for checklist verification, but might generate noise. | Resolved: support both — the user decides when to invoke |
| OQ-2 | Should `AI-APPLY` markers be case-sensitive? | Case-insensitive is more forgiving but risks false positives with unusual text. | Resolved: case-insensitive, standalone token (not substring) |
| OQ-3 | Should the review draft include a confidence score per finding? | Could help users prioritize, but adds complexity. | Resolved: include high/medium/low confidence per finding — minimal complexity, helps prioritize |
| OQ-4 | What is the maximum number of inline comments the agent should publish per review? | Too many comments create noise; too few miss issues. | Resolved: default cap of 30 inline comments; remaining findings bundled into summary comment |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Platform-neutral from start — GitHub + GitLab both supported in v1 | Original ticket specified "GitLab first" but ADOS convention is platform-neutral. Both `gh` and `glab` are mature CLIs. Designing for both from the start avoids refactoring. | 2026-03-16 |
| DEC-2 | Standard ADOS delivery flow, not "PM must use @toolsmith" | Original ticket required PM to directly invoke @toolsmith for prompt authoring. ADOS convention: @coder handles delivery and delegates to @toolsmith for agent/command file creation (per AGENTS.md). PM orchestrates; @coder executes; @toolsmith specializes. | 2026-03-16 |
| DEC-3 | Separate agents for review and feedback application | Different responsibilities, different safety profiles (read-only vs write), different invocation patterns. Combining would violate single-responsibility. | 2026-03-16 |
| DEC-4 | Reuse `@pr-manager` patterns (platform detection, branchPath, tmp/, CLI reference) | Proven patterns reduce risk and ensure consistency across ADOS commands. | 2026-03-16 |
| DEC-5 | Dirty tree blocks both commands (no auto-commit) | Unlike `@pr-manager` which auto-commits, review workflows need a predictable starting state. Auto-committing before review could change the diff being reviewed. | 2026-03-16 |
| DEC-6 | `AI-APPLY` marker as explicit acceptance mechanism | Provides a deterministic, unambiguous signal that is platform-neutral and greppable. Case-insensitive, standalone token. | 2026-03-16 |
| DEC-7 | Ambiguous feedback is never auto-applied | Conservative safety default. False negatives (missing an accepted comment) are preferable to false positives (applying unwanted changes). | 2026-03-16 |
| DEC-8 | Include high/medium/low confidence per finding | Helps users prioritize review findings without adding schema complexity. Three-level scale is sufficient. | 2026-03-16 |
| DEC-9 | Default cap of 30 inline comments per review | Prevents comment noise on large PRs. Remaining findings are bundled into the summary comment so nothing is lost. | 2026-03-16 |
| DEC-10 | Extract platform access into `.ai/agent/pr-instructions.md` (from GH-39) | Mirrors `pm-instructions.md` pattern. Agent prompts define WHAT to do; `pr-instructions.md` defines HOW. Eliminates hardcoded CLI commands from 3 agents. | 2026-03-16 |
| DEC-11 | Graceful fallback when `pr-instructions.md` absent | Preserves backward compatibility — agents auto-detect from `git remote get-url origin` as before. Zero breaking changes for existing repos. | 2026-03-16 |
| DEC-12 | Operations Reference table as the contract format | A Markdown table mapping operation names to commands is human-readable, agent-parseable, and version-controllable. Simpler than YAML/JSON config. | 2026-03-16 |
| DEC-13 | Merged code-reviewer into unified reviewer agent | Merged code-reviewer into unified reviewer agent. Single agent handles both local (spec/plan compliance) and remote (PR/MR) review modes. code-reviewer.md deleted. | 2026-03-20 |
| DEC-14 | Merged .ai/checklists/code-review.md into .ai/agent/code-review-instructions.md | Single file for all repo-specific review guidance. Eliminates separate checklists directory for code review. | 2026-03-16 |
| DEC-15 | pr-instructions.md is required, not optional | pr-instructions.md is required for remote mode. Agents do not fall back to auto-detection. Deterministic behavior preferred over magic detection. | 2026-03-19 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `.opencode/agent/code-reviewer.md` | New — remote code review agent (superseded: unified into `reviewer.md` per DEC-13) |
| `.opencode/agent/review-feedback-applier.md` | New — review feedback application agent |
| `.opencode/command/review-remote.md` | New — remote review command |
| `.opencode/command/apply-review-feedback.md` | New — feedback application command |
| `.ai/checklists/code-review.md` | New — optional repository-local review checklist |
| `.ai/agent/code-review-instructions.md` | New — optional repository-local review instructions |
| `.opencode/README.md` | Updated — add new agent and command entries |
| `AGENTS.md` | Updated — add new agents and commands to inventory |
| `.ai/agent/pr-instructions.md` | New — repository-local PR/MR platform instructions (from GH-39) |
| `doc/templates/pr-instructions-template.md` | New — template for PR/MR platform instructions (from GH-39) |
| `doc/guides/pr-platform-integration.md` | New — PR/MR platform integration guide (from GH-39) |
| `.opencode/agent/pr-manager.md` | Refactored — reads `pr-instructions.md` (from GH-39) |
| `.opencode/agent/bootstrapper.md` | Updated — PR/MR platform interview and artifact generation (from GH-39) |
| `doc/documentation-handbook.md` | Updated — template index and .ai/agent/ description (from GH-39) |

## 17. ACCEPTANCE CRITERIA

### Remote code review workflow

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** `.opencode/agent/code-reviewer.md` exists, **when** the agent is invoked on a branch with an open GitHub PR, **then** it fetches the PR diff and metadata via `gh` and produces structured findings. | F-1, F-5 |
| AC-F1-2 | **Given** `.opencode/agent/code-reviewer.md` exists, **when** the agent is invoked on a branch with an open GitLab MR, **then** it fetches the MR diff and metadata via `glab` and produces structured findings. | F-1, F-5 |
| AC-F3-1 | **Given** `.opencode/command/review-remote.md` exists, **when** the user runs `/review-remote`, **then** it delegates to the `code-reviewer` agent and accepts optional arguments (platform override, dry-run, publish). | F-3 |
| AC-F6-1 | **Given** `.ai/agent/code-review-instructions.md` exists in the repository (originally `.ai/checklists/code-review.md`, consolidated per DEC-14), **when** the reviewer agent runs, **then** it loads and evaluates the review guidance against the diff. | F-6 |
| AC-F6-2 | **Given** `.ai/checklists/code-review.md` does NOT exist, **when** the `code-reviewer` agent runs, **then** it falls back to built-in general-purpose review heuristics with no errors. | F-6 |
| AC-F6-3 | **Given** `.ai/agent/code-review-instructions.md` exists in the repository, **when** the `code-reviewer` agent runs, **then** it loads and follows the instructions. | F-6 |
| AC-F7-1 | **Given** the `code-reviewer` agent completes analysis, **when** it generates output, **then** a `review-draft.md` file is written to `tmp/code-review/<branchPath>/` before any publishing occurs. | F-7, F-11 |
| AC-F8-1 | **Given** the `code-reviewer` agent runs a second time on an unchanged PR/MR, **when** it compares findings to existing comments, **then** it publishes zero duplicate comments. | F-8, NFR-4 |

### Review feedback application workflow

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** `.opencode/agent/review-feedback-applier.md` exists, **when** the agent is invoked on a branch with an open PR/MR containing review comments, **then** it fetches all threads and classifies each as accepted/rejected/ambiguous. | F-2, F-9 |
| AC-F4-1 | **Given** `.opencode/command/apply-review-feedback.md` exists, **when** the user runs `/apply-review-feedback`, **then** it delegates to the `review-feedback-applier` agent. | F-4 |
| AC-F9-1 | **Given** a review comment containing the `AI-APPLY` marker (case-insensitive), **when** the `review-feedback-applier` classifies it, **then** it is classified as "explicitly accepted" and applied. | F-9 |
| AC-F9-2 | **Given** a review comment with clear agreement language (e.g., "agreed, will fix"), **when** the `review-feedback-applier` classifies it, **then** it is classified as "implicitly accepted" with documented reasoning. | F-9 |
| AC-F9-3 | **Given** a review comment with ambiguous intent, **when** the `review-feedback-applier` classifies it, **then** it is classified as "ambiguous" and listed in `skipped-items.md` without being applied. | F-9, NFR-5 |

### Safety and pre-flight checks

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F10-1 | **Given** the user runs `/review-remote` or `/apply-review-feedback` with a dirty working tree, **when** the pre-flight check runs, **then** the command stops with a message advising to commit or stash. | F-10 |
| AC-F10-2 | **Given** the user runs `/review-remote`, **when** the workflow completes, **then** zero source code files in the working tree have been modified. | F-10, NFR-2 |
| AC-F10-3 | **Given** the user runs `/apply-review-feedback`, **when** the workflow completes, **then** no git commit or push has been made automatically. | F-10, NFR-3 |

### Existing behavior preservation

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | Superseded by DEC-13 (reviewer unification). `reviewer.md` was intentionally modified to include remote review mode capabilities. Local mode behavior is preserved. | G-5 |

### Documentation

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F12-1 | **Given** `.opencode/README.md`, **then** it lists `code-reviewer` and `review-feedback-applier` in the Agents section and `/review-remote` and `/apply-review-feedback` in the Commands section. | F-12 |
| AC-F12-2 | **Given** `AGENTS.md`, **then** it lists both new agents in the agent team and both new commands in the commands table. | F-12 |

### PR/MR platform instructions (from GH-39)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F13-1 | **Given** `.ai/agent/pr-instructions.md` exists, **then** it contains an Operations Reference table mapping all PR/MR operations to concrete CLI commands. | F-13 |
| AC-F14-1 | **Given** `.ai/agent/pr-instructions.md` exists, **when** `@code-reviewer`, `@review-feedback-applier`, or `@pr-manager` runs, **then** it reads `pr-instructions.md` for platform access commands. | F-14 |
| AC-F14-2 | **Given** `.ai/agent/pr-instructions.md` does NOT exist, **when** any of the three agents runs, **then** it stops with an actionable error message directing the user to create `pr-instructions.md` (DEC-15: pr-instructions.md is required, not optional). | F-14 |
| AC-F15-1 | **Given** `doc/templates/pr-instructions-template.md` exists, **then** it includes commented-out examples for GitHub CLI, GitLab CLI, GitHub MCP, and Azure DevOps MCP. | F-15 |
| AC-F16-1 | **Given** `doc/guides/pr-platform-integration.md` exists, **then** it documents all supported integration types with setup instructions and a decision flowchart. | F-16 |
| AC-F17-1 | **Given** `.opencode/agent/bootstrapper.md`, **then** it includes PR/MR platform in interview questions, `pr_instructions` in state schema, and `pr-instructions.md` in artifact generation. | F-17 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery order**: Phase 1 — `code-reviewer` agent + `/review-remote` command; Phase 2 — `review-feedback-applier` agent + `/apply-review-feedback` command; Phase 3 — repository-local config files + documentation updates.
- **Merge strategy**: Single PR containing all phases. Phased commits within the PR for reviewability.
- **Communication**: Update `.opencode/README.md` and `AGENTS.md` to document the new agents and commands.
- **Adoption**: ADOS itself is the first adopter — `.ai/checklists/code-review.md` and `.ai/agent/code-review-instructions.md` can be created for this repository.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no existing data to migrate. All artifacts are new.

## 20. PRIVACY / COMPLIANCE REVIEW

- Review artifacts stored under `tmp/` (git-ignored) may contain PR/MR metadata and code diffs. These are ephemeral working files, not persisted beyond the review session.
- No PII collection or external data transmission beyond normal `gh`/`glab` CLI operations.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Authentication**: Both agents rely on pre-configured CLI tool authentication (`gh auth`, `glab auth`). No additional credentials are stored or managed by the agents.
- **Read-only default**: The `code-reviewer` workflow is strictly read-only with respect to source code. Publishing review comments is an explicit user-approved action.
- **No secret exposure**: Review artifacts under `tmp/` must not contain secrets, tokens, or credentials. Agent prompts must not instruct storage of sensitive data.
- **Comment injection**: Published review comments are generated from diff analysis, not from user-supplied templates, reducing injection risk.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Agent prompt maintenance**: Two new agent prompts to maintain. Changes to `@pr-manager` platform detection patterns should be mirrored in the new agents.
- **CLI compatibility**: Future `gh`/`glab` CLI changes may require adapter updates. Using JSON output modes reduces fragility.
- **Repository config files**: `.ai/checklists/code-review.md` and `.ai/agent/code-review-instructions.md` are human-authored and evolve with the repository's review standards. No automated maintenance required.
- **tmp/ cleanup**: Review artifacts under `tmp/` are ephemeral. No automated cleanup is needed — `tmp/` is git-ignored and can be manually cleared.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| PR | Pull Request — GitHub's mechanism for proposing and reviewing code changes |
| MR | Merge Request — GitLab's mechanism for proposing and reviewing code changes |
| `AI-APPLY` | An explicit marker (case-insensitive standalone token) placed in a review comment to signal that the author accepts the feedback and wants it applied automatically |
| Finding | A single review observation with severity, file reference, description, and suggested fix |
| Classification | The process of categorizing a review comment as accepted, rejected, or ambiguous |
| branchPath | A filesystem-safe representation of a git branch name, following `@pr-manager` sanitization rules |
| Deduplication | The process of comparing new review findings against existing PR/MR comments to suppress duplicates |
| Dry-run | A mode where the review generates a local draft but does not publish any comments to the remote platform |

## 24. APPENDICES

### A. `AI-APPLY` marker specification

The `AI-APPLY` marker is a convention for explicitly accepting review feedback for automated application:

- **Format**: The string `AI-APPLY` (case-insensitive) appearing as a standalone token in a review comment.
- **Standalone**: Must not be a substring of another word. Valid: "AI-APPLY this change", "ai-apply". Invalid: "AI-APPLYED", "NOAI-APPLY".
- **Placement**: Can appear anywhere in the comment text — beginning, middle, or end.
- **Scope**: Applies to the entire comment thread. If placed in a reply, it applies to the parent comment's suggestion.
- **Examples**:
  - "AI-APPLY" (just the marker)
  - "Good catch, AI-APPLY this"
  - "ai-apply — also please update the tests"

### B. Platform adapter contract (informational)

Future platform adapters must implement:
1. **Platform detection**: Determine if the current repo uses this platform.
2. **PR/MR resolution**: Find the active PR/MR for a given branch.
3. **Metadata fetch**: Retrieve title, description, author, reviewers, labels, status.
4. **Diff fetch**: Retrieve the full diff between base and head.
5. **Comments fetch**: Retrieve all review comments/threads with position info.
6. **Publish summary**: Post a top-level review comment.
7. **Publish inline**: Post a comment at a specific file + line position.
8. **Existing comment detection**: List existing comments for deduplication.

### C. Implicit acceptance patterns (informational)

Conservative patterns for fuzzy acceptance detection (not exhaustive):
- "agreed", "good point", "will fix", "done", "fixed", "applied"
- "you're right", "makes sense", "I'll update"
- Combined with proximity to a concrete code suggestion

Patterns that do NOT qualify as acceptance:
- Questions ("should I fix this?")
- Acknowledgments without action intent ("I see", "noted")
- Conditional statements ("if we decide to change this...")

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-16 | spec-writer | Initial specification from planning session and GH-36 ticket context |
| 1.1 | 2026-03-16 | coder | Added GH-39 scope: F-13 through F-17, AC-F13-1 through AC-F17-1, DEC-10 through DEC-12, updated affected components |

---

## AUTHORING GUIDELINES

- Used planning context from the change planning summary and GH-36 ticket body
- Filtered ticket content through ADOS conventions (platform-neutral, standard delivery flow, naming patterns)
- Corrected "GitLab first" to "GitHub + GitLab from v1" per ADOS platform-neutral convention
- Corrected "PM must use @toolsmith" to standard ADOS delivery flow
- Embedded implementation phases from the ticket treated as input context, not the actual plan
- Acceptance criteria use Given/When/Then format and reference functional capabilities
- NFRs include measurable thresholds
- Risks include Impact & Probability with mitigations
- `@pr-manager` agent studied for pattern reuse (platform detection, branchPath, tmp/ conventions, CLI reference)

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-36)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
