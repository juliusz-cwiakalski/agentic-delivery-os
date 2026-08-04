---
change:
  ref: GH-151
  type: refactor
  status: Proposed
  slug: centralize-git-operations
  title: "Centralize git operations: PM owns branch setup, all commits route through @committer"
  owners: ["Juliusz Ćwiąkalski"]
  service: delivery-os
  labels: ["agent-improvement", "git-operations", "conventional-commits", "prompt-governance"]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal: ["agent prompts (spec-writer, test-plan-writer, plan-writer, doc-syncer, reviewer, decision-advisor, pm, readiness-reviewer)", "command prompts (write-spec, write-test-plan, write-plan, sync-docs, write-decision)", "doc/guides/change-lifecycle.md", "AGENTS.md", ".ados-claude plugin", "@committer agent", "@toolsmith agent", "scripts/build-claude-plugin.sh"]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Establish one branch owner (the PM in autonomous mode, commands in manual mode) and one commit path (`@committer`) across the agent/command team, so every delegated artifact agent becomes a pure writer and every commit passes through secret scanning, `tmp/`/`.ai/local/` exclusion, `.gitignore` enforcement, and Conventional Commit derivation.

## 1. SUMMARY

This change refactors the git-operations responsibility model for the agent/command team. Today branch setup and commits are scattered and inconsistent: three artifact agents each independently checkout/create the branch and commit a single file with a hardcoded message, three more agents commit directly, and the PM — the orchestrator that should own branch state — never ensures the branch exists. Six of nine committing agents bypass `@committer` entirely, skipping its secret/credential scan, forbidden-path exclusion, `.gitignore` enforcement, and diff-derived Conventional Commit messages.

The target state is a single principle: **the orchestrator of a phase owns the commit trigger for that phase's output, and all commits route through `@committer`.** In autonomous mode the PM ensures the change branch before its first delegation and triggers `@committer` after each delegated lifecycle phase returns; in manual mode the commands ensure the branch and trigger `/commit`; during delivery `@coder` keeps its existing per-sub-phase `@committer` trigger. Every delegated agent (spec-writer, test-plan-writer, plan-writer, doc-syncer, reviewer, decision-advisor) becomes a pure writer that produces its artifact and returns — zero git operations. No agent prompt other than `@committer` performs a direct `git commit`.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The agent and command prompt definitions under `.opencode/` **are the product**; they implement the 11-phase delivery lifecycle. Prompt quality is production-grade.
- **Three artifact agents carry duplicated git plumbing.** `@spec-writer`, `@test-plan-writer`, and `@plan-writer` each independently implement a `<branch_rules>` / `<commit_rules>` flow: derive the branch from frontmatter, checkout/create it, stage a single file ("stage ONLY this file"), and `git commit` with a hardcoded message. In autonomous mode the PM delegates them sequentially, so spec-writer creates the branch and the other two re-check the same branch (dead logic).
- **Three more agents commit directly.** `@doc-syncer` commits directly and splits into two commits when more than ~10 files change (contracts vs spec). `@reviewer` in local mode stages the plan file and commits directly (its commands `/review` and `/review-deep` already reference `/commit`, so the agent lags the command). `@decision-advisor` stages "ONLY the decision record" and commits directly.
- **The PM does not ensure the branch.** It records the branch in `pm-context.yaml` and already states that commits "MUST go through `@committer`", but it has no branch-ensure step before delegating and does not consistently trigger `@committer` after each delegated phase returns.
- **`@committer` already exists as the specialist.** Its workflow: preflight (assert git repo, abort on in-progress merge/rebase/cherry-pick/revert, reject detached HEAD, require identity, no-op on clean tree); collect (`git add -A`, then unstage anything under `tmp/`/`.ai/local/`, and add missing `.gitignore` entries); safety scan (suspected secrets/credentials → STOP, suspicious large binaries → warn+STOP); message (derive one Conventional Commit type/scope from the staged diff, honor a caller-supplied `<intent>` hint, detect breaking changes); commit (single commit via a temp message file, one post-hook amend); report (SHA + stats).
- **Already-correct delegators** (verified, no change): `@coder` (delegates to `@committer` per delivery plan phase — the delivery exception), `@meeting-organizer`, `@pr-manager` (auto-`@committer` if dirty; `git push` is intrinsic to PR creation), `/run-plan`, `/review`, `/review-deep`, `/check-fix`, `/commit`. Non-committing agents already correct: `@review-feedback-applier` ("Hard rule: No git commit or push"), `@decision-critic`, `@runner` (forbidden destructive git).

### 2.2 Pain Points / Gaps

- **Branch logic duplicated three times** with dead re-check logic in autonomous mode and a canonical-value divergence risk (the same anti-pattern the lifecycle doc warns about for traceability IDs).
- **Six agents commit directly, bypassing `@committer` safety** — no secret/credential scan, no `tmp/`/`.ai/local/` exclusion, no `.gitignore` enforcement, no diff-derived Conventional Commit type/scope, no breaking-change detection.
- **The PM has no "ensure branch" step**; every agent compensates independently.
- **Prompt bloat** — roughly 15–20 lines of git plumbing per artifact agent that is not its core job, and ~50 lines of duplicated non-core logic across the three writers.
- **Inconsistency** — four entry points already delegate to `@committer` while six do not, with no principled reason for the split (historical drift).

## 3. PROBLEM STATEMENT

Because branch setup and commits are duplicated and inconsistent across agents and commands, with six agents committing directly and bypassing `@committer`'s safety scans, the delivery system cannot guarantee a single canonical commit path or a clean, phase-aligned commit history — every change risks secret leakage, junk-path inclusion, and inconsistent Conventional Commit messages, while the orchestrator that should own branch state (the PM) never ensures it.

## 4. GOALS

- **G-1**: One branch owner — the PM ensures the change branch exists and is checked out before delegating (autonomous mode); commands do the same (manual mode); agents never touch branch state.
- **G-2**: One commit path — all commits across all agents and commands route through `@committer`; no direct `git commit` anywhere except inside `@committer` itself.
- **G-3**: Clean commit history — at least one commit per lifecycle phase (the PM triggers `@committer` after each delegated phase returns), more on phase reopen, and granular commits per delivery sub-phase (`@coder` triggers `@committer`, the existing exception).
- **G-4**: Pure artifact agents — every delegated agent (spec-writer, test-plan-writer, plan-writer, doc-syncer, reviewer, decision-advisor) writes its artifact and returns with zero git operations.
- **G-5**: Safety by default — every commit passes through `@committer`'s secret scan, forbidden-path exclusion, `.gitignore` enforcement, and Conventional Commit derivation.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Non-`@committer` agent prompts containing a direct `git commit` operation | 0 (grep-verified) |
| Delegated agent prompts containing any branch/commit instruction | 0 |
| Commits produced per delivered lifecycle phase (autonomous) | ≥ 1 |
| Commits produced per manual artifact command invocation | 1 |
| Commits routed through `@committer` (secret scan applied) | 100% |

### 4.2 Non-Goals

- **NG-1**: Adding a path-scope / staged-subset mode to `@committer` (it stays `git add -A`; the orchestrator guarantees a clean worktree per phase).
- **NG-2**: Changing `@committer`'s own commit logic, message grammar, or safety thresholds.
- **NG-3**: Changing `@coder`, `@meeting-organizer`, or `@pr-manager` commit delegation (already correct).
- **NG-4**: Changing the OpenCode session execution model or the 11-phase lifecycle numbering.
- **NG-5**: Introducing a commit-message schema beyond Conventional Commits.
- **NG-6**: Altering the branch-naming convention (`<type>/<workItemRef>/<slug>`).

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Orchestrator-owned branch ensure | Branch state is owned exactly once per mode (PM autonomous, commands manual), eliminating triplicated logic, dead re-checks, and canonical-value divergence. |
| F-2 | Orchestrator-owned commit trigger | The orchestrator that invokes a delegated agent triggers `@committer` when the agent returns, producing phase-aligned commits without agents self-committing. |
| F-3 | Pure-writer delegated agents | Delegated agents produce their artifact and return; they hold no git operations, shrinking prompts and removing the safety-bypass surface. |
| F-4 | Universal `@committer` routing | All commits — including decision records and the doc-sync reconciliation — go through one safety-scanned, diff-derived commit path. |
| F-5 | Readiness-verdict traceability | The PM commits the readiness-reviewer verdict file so every DoR iteration is recorded in history. |
| F-6 | Toolsmith-mediated prompt edits | All prompt-definition edits are performed by `@toolsmith` per the repo's prompt-governance rule, not hand-edited by `@coder`. |
| F-7 | Responsibility-model documentation | The lifecycle guide documents the branch/commit responsibility model so the convention is durable. |
| F-8 | Generated-plugin freshness | The Claude plugin is regenerated so the generated mirror stays in sync and the freshness guard stays green. |

### 5.1 Capability Details

- **F-1**: In autonomous mode the PM ensures the change branch (checkout if it exists, else create `<<type>>/<<workItemRef>>/<<slug>>`) before its first delegation, and records it in `pm-context.yaml`. In manual mode the artifact commands (`/write-spec`, `/write-test-plan`, `/write-plan`) keep their existing branch-ensure step as a manual safety net. No delegated agent touches branch state. `@coder` and `@pr-manager` continue their intrinsic branch handling unchanged.
- **F-2**: After each delegated lifecycle phase returns (specification, test-planning, delivery-planning, dor-check, system-spec-update, review-fix), the PM triggers `@committer` with a phase-appropriate intent hint. Manual commands trigger `/commit` (`@committer`) after the agent returns. During delivery, `@coder` keeps triggering `@committer` per plan phase. The `no commit` directive, when present, suppresses the trigger.
- **F-3**: `@spec-writer`, `@test-plan-writer`, `@plan-writer`, `@doc-syncer`, `@reviewer` (local mode), and `@decision-advisor` lose all git operations — no branch rules, no staging, no commit steps — and gain a pure-write note that the orchestrator handles branch and commit. This includes removing `@doc-syncer`'s multi-commit split and `@decision-advisor`'s direct-commit path.
- **F-4**: With every commit routed through `@committer`, the system gains universal secret/credential scanning, `tmp/`/`.ai/local/` exclusion, `.gitignore` enforcement, and diff-derived Conventional Commit messages (informed by the caller's intent hint). Decision records and the doc-spec reconciliation each become a single `@committer` commit.
- **F-5**: `@readiness-reviewer` writes its verdict file and returns without committing; the PM triggers `@committer` after the agent returns so each DoR iteration is captured in history for traceability.
- **F-6**: Per `AGENTS.md`, every edit to an agent or command prompt definition is delegated to `@toolsmith` rather than hand-edited. This applies to all prompt changes in this change; the delivery plan routes each modification through `@toolsmith`.
- **F-7**: The lifecycle guide records the responsibility model: who owns the branch per mode, who owns the commit trigger per phase, and the universal "`@committer` is the only commit path" rule. `AGENTS.md` is aligned if its process table or agent descriptions reference commit behavior.
- **F-8**: After all `.opencode/` prompt changes, the `.ados-claude/` mirror is regenerated by the build script and committed alongside the source changes; the CI freshness guard stays green.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Autonomous delivery (PM orchestrates)
  PM ensure branch → delegate @spec-writer (writes spec, returns) → PM triggers
  @committer → delegate @test-plan-writer (writes plan, returns) → @committer →
  delegate @plan-writer → @committer → @readiness-reviewer (writes verdict, returns)
  → @committer → @coder delivery (per sub-phase: coder triggers @committer) →
  @doc-syncer (writes reconciliation, returns) → @committer → @reviewer (local:
  writes review, returns) → @committer

Flow 2 — Manual artifact creation (command orchestrates)
  /write-spec ensure branch → @spec-writer (writes spec, returns) → command
  triggers /commit (@committer)   [same shape for /write-test-plan, /write-plan,
  /sync-docs]

Flow 3 — Standalone decision record
  /write-decision → @decision-advisor (writes record, returns) → command triggers
  /commit (@committer)

Flow 4 — Local review
  /review (or /review-deep) → @reviewer local mode (writes review, returns) →
  command triggers /commit (@committer)   [remote mode unchanged]

Flow 5 — Doc reconciliation
  /sync-docs → @doc-syncer (writes system-spec reconciliation, returns, no split)
  → command triggers /commit (@committer); "no commit" directive skips the trigger

Flow 6 — Readiness verdict
  PM delegates @readiness-reviewer (writes verdict, returns, no commit) → PM
  triggers @committer to commit the verdict
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- PM gains a branch-ensure step before first delegation and a `@committer` trigger after each delegated lifecycle phase returns (F-1, F-2).
- `@spec-writer`, `@test-plan-writer`, `@plan-writer` become pure writers (no branch/commit logic) (F-3).
- `@doc-syncer` becomes a pure writer; the multi-commit split is removed (F-3, F-4).
- `@reviewer` (local mode) becomes a pure writer and aligns with its commands that already reference `/commit` (F-3).
- `@decision-advisor` becomes a pure writer (no direct commit) (F-3).
- `@readiness-reviewer` gains a note that the PM commits the verdict; the PM commits the verdict (F-5).
- Manual commands `/write-spec`, `/write-test-plan`, `/write-plan`, `/sync-docs` keep branch setup and delegate the commit to `/commit`; `/write-decision` gains a `/commit` trigger after `@decision-advisor` returns (F-2, F-4).
- The `no commit` directive is respected by the PM and commands (suppresses the trigger) (F-2).
- All prompt edits performed via `@toolsmith` (F-6).
- `doc/guides/change-lifecycle.md` documents the responsibility model; `AGENTS.md` aligned if needed (F-7).
- `.ados-claude/` regenerated via the plugin build script (F-8).

### 7.2 Out of Scope

- [OUT] A staged-subset / path-scope mode for `@committer` (NG-1).
- [OUT] Changes to `@committer`'s commit logic, message grammar, or safety thresholds (NG-2).
- [OUT] Changes to `@coder`, `@meeting-organizer`, `@pr-manager`, `@review-feedback-applier`, `@decision-critic`, `@runner` commit behavior (NG-3, already correct).
- [OUT] Changes to `/run-plan`, `/review`, `/review-deep`, `/check-fix`, `/commit` (already delegate correctly).
- [OUT] Changing the OpenCode session model or the 11-phase lifecycle numbering (NG-4).
- [OUT] A new commit-message schema (NG-5) or branch-naming change (NG-6).

### 7.3 Deferred / Maybe-Later

- A machine-checkable "commit trigger coverage" assertion across the agent inventory (beyond a grep gate) if drift recurs.
- Collapsing the manual-command branch-ensure step into a shared helper once more than three commands share it.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — this change affects agent/command prompt behavior and local git workflow; it exposes no HTTP surface.

### 8.2 Events / Messages

N/A.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `@committer` `<intent>` hint | An already-supported optional free-text input. After this change it is the standard channel through which the orchestrator conveys phase intent so `@committer` can derive a phase-appropriate Conventional Commit message. Its contract is unchanged (hint only; the staged diff is authoritative). |
| DM-2 | `pm-context.yaml` branch field | Existing field in which the PM records the change branch. After this change the recorded branch is guaranteed to exist and be checked out before the PM's first delegation. No schema change. |

### 8.4 External Integrations

- **git CLI (local)** — unchanged surface; the change redistributes who invokes branch/commit operations, not how git behaves.
- **Plugin build script** (`scripts/build-claude-plugin.sh`) — used to regenerate the `.ados-claude/` mirror after prompt edits; no change to the build tool itself.

### 8.5 Backward Compatibility

- The branch-naming convention is unchanged.
- `@committer`'s behavior, safety scans, and message grammar are unchanged.
- Commit messages shift from hardcoded per-agent strings to diff-derived Conventional Commits informed by an intent hint — an intentional quality improvement, not a contract break.
- Staging shifts from per-agent "stage ONLY this file" to `@committer`'s `git add -A` (with forbidden-path exclusion). This is safe because the orchestrator guarantees a clean worktree between phases; no existing functional contract changes.
- Consumers of commit history (reviewers, the DoR/DoD checks, `@pr-manager`) read the same Conventional Commit stream.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | No direct commit outside `@committer` | 0 agent prompts (excluding `@committer`) contain a direct `git commit` operation (grep-verified) |
| NFR-2 | No branch/commit logic in delegated agents | 0 delegated agent prompts contain branch-checkout, staging, or commit instructions |
| NFR-3 | Phase-aligned commits (autonomous) | ≥ 1 `@committer` commit per delivered lifecycle phase |
| NFR-4 | Manual-invocation commits | Exactly 1 `/commit` (`@committer`) per manual artifact command invocation |
| NFR-5 | `no commit` directive honored | 100% — directive presence suppresses the trigger in PM and commands |
| NFR-6 | Safety coverage | 100% of commits pass `@committer`'s secret scan and forbidden-path exclusion |
| NFR-7 | Plugin freshness | `.ados-claude/` regenerated; CI freshness guard green |
| NFR-8 | Prompt-edit governance | 100% of agent/command prompt edits performed via `@toolsmith` (0 hand-edits by `@coder`) |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- Commit history becomes the primary observability signal: phase-aligned commits (≥1 per lifecycle phase in autonomous mode; 1 per manual invocation) are inspectable via `git log`.
- No new metrics, logs, traces, or alerts are introduced. The grep gates (NFR-1, NFR-2) serve as static drift detection and should be expressible as a repo check where practical.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | `git add -A` stages unintended files if the worktree is dirty between phases | M | L | Orchestrator guarantees a clean worktree per phase; `@committer` still excludes `tmp/`/`.ai/local/` and scans for secrets | L |
| RSK-2 | Commit-message quality regresses when hardcoded strings are replaced by diff-derived messages | M | M | Orchestrators pass a phase-appropriate `<intent>` hint; `@committer` derives type/scope from the diff and ignores contradictory hints | M |
| RSK-3 | The `no commit` directive is ignored, producing a stray commit | M | L | PM and commands check the directive before triggering; documented in the responsibility model | L |
| RSK-4 | An agent is missed in the refactor, leaving a direct-commit path | M | M | Static grep gate (NFR-1) as an acceptance criterion; coverage verified before merge | L |
| RSK-5 | `@toolsmith` handoff overhead for many small prompt edits | L | M | Scope each prompt edit crisply; batch related edits per agent | L |
| RSK-6 | Readiness verdict stops being committed (regression vs. traceability goal) | L | L | PM triggers `@committer` explicitly after `@readiness-reviewer` returns (F-5) | L |

## 12. ASSUMPTIONS

- The PM and commands execute one phase at a time, so the worktree contains only the current phase's changes when `@committer` runs (making `git add -A` safe).
- `@committer`'s existing `<intent>` input is sufficient to produce phase-appropriate Conventional Commit messages when paired with a good hint.
- The already-correct delegators (`@coder`, `@meeting-organizer`, `@pr-manager`) and non-committers need no change (verified against current prompts).
- The branch-naming convention and the 11-phase lifecycle are stable and out of scope.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | `@committer` agent | Provides the single commit path; unchanged by this change |
| Depends on | `@toolsmith` agent | Performs all prompt-definition edits (F-6) |
| Depends on | Plugin build script | Regenerates `.ados-claude/` (F-8) |
| Relates to | `doc/guides/change-lifecycle.md` | Receives the responsibility-model documentation (F-7) |
| Relates to | Autonomous-delivery epics (#95, #117) | A cleaner, auditable commit history strengthens loop reliability |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the responsibility-model table live only in `change-lifecycle.md`, or also be summarized in `AGENTS.md`? | `AGENTS.md` already has a delivery-process table; duplicating the responsibility matrix risks drift. | **RESOLVED**: Document the canonical model in `change-lifecycle.md`; align `AGENTS.md` only where its existing process table or agent descriptions currently imply commit behavior. Single source of truth = the guide. |
| OQ-2 | Should each orchestrator pass an explicit phase-appropriate `<intent>` hint to `@committer`, or rely purely on diff derivation? | Message-quality risk (RSK-2) if hints are absent. | **RESOLVED**: Orchestrators pass an explicit intent hint per phase/invocation (e.g., "add spec for GH-151"); `@committer` still derives type/scope from the diff. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Staging scope = accept `git add -A` (no path-scope mode in `@committer`) | Orchestrator guarantees clean worktree per phase; scoped staging adds complexity for no real safety gain | 2026-08-04 |
| DEC-2 | `@doc-syncer` multi-commit split simplified to one commit | Single `docs(spec): reconcile ...` commit is clean and reviewable; the split was a marginal optimization | 2026-08-04 |
| DEC-3 | All delegated agents are pure writers, including `@decision-advisor` | Uniform principle; the orchestrator (PM/command/coder) owns the commit trigger. This **refines** the ticket's original Decision 3 (which had `@decision-advisor` self-delegating) per the refinement comment | 2026-08-04 |
| DEC-4 | The PM commits the `@readiness-reviewer` verdict | The verdict file is committed for traceability; `@readiness-reviewer` returns without committing | 2026-08-04 |
| DEC-5 | All prompt edits performed via `@toolsmith` | Repo prompt-governance rule; preserves prompt quality and model-format awareness | 2026-08-04 |
| DEC-6 | `change.type = refactor` | Restructures responsibility without adding user-facing capability; matches the branch prefix | 2026-08-04 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `@spec-writer` agent | Updated — pure writer (remove branch/commit logic) |
| `@test-plan-writer` agent | Updated — pure writer (remove branch/commit logic) |
| `@plan-writer` agent | Updated — pure writer (remove branch/commit logic) |
| `@doc-syncer` agent | Updated — pure writer (remove direct commit + multi-commit split) |
| `@reviewer` agent | Updated — pure writer in local mode (remove direct commit; align with commands) |
| `@decision-advisor` agent | Updated — pure writer (remove direct commit) |
| `@pm` agent | Updated — add branch-ensure step; add `@committer` trigger after each delegated phase |
| `@readiness-reviewer` agent | Updated — note that PM commits the verdict |
| `/write-spec` command | Updated — keep branch setup; delegate commit to `/commit` |
| `/write-test-plan` command | Updated — keep branch setup; delegate commit to `/commit` |
| `/write-plan` command | Updated — keep branch setup; delegate commit to `/commit` |
| `/sync-docs` command | Updated — delegate commit to `/commit`; remove multi-commit split |
| `/write-decision` command | Updated — add `/commit` trigger after `@decision-advisor` returns |
| `doc/guides/change-lifecycle.md` | Updated — document the responsibility model |
| `AGENTS.md` | Updated — align if process table/agent descriptions reference commit behavior |
| `.ados-claude/` plugin | Regenerated — mirror the `.opencode/` prompt changes |
| `@coder`, `@meeting-organizer`, `@pr-manager`, `@review-feedback-applier`, `@decision-critic`, `@runner`, `@committer` | **Not modified** (already correct or out of scope) |
| `/run-plan`, `/review`, `/review-deep`, `/check-fix`, `/commit` commands | **Not modified** (already delegate correctly) |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** the spec-writer, test-plan-writer, and plan-writer agents, **when** their prompts are inspected, **then** they contain zero git operations (no branch rules, no staging, no commit steps) and a pure-write note. | F-3, NFR-2 |
| AC-F3-2 | **Given** the doc-syncer agent, **when** its prompt is inspected, **then** it delegates no direct commit and contains no multi-commit split logic. | F-3, F-4 |
| AC-F3-3 | **Given** the reviewer agent in local mode, **when** its prompt is inspected, **then** it performs no direct commit (the command triggers `/commit`). | F-3 |
| AC-F3-4 | **Given** the decision-advisor agent, **when** its prompt is inspected, **then** it performs no direct commit (the orchestrator triggers `@committer`). | F-3, DEC-3 |
| AC-F1-1 | **Given** autonomous mode, **when** the PM begins a change, **then** it ensures the change branch exists and is checked out before its first delegation, and records it in `pm-context.yaml`. | F-1, DM-2 |
| AC-F2-1 | **Given** autonomous mode, **when** each delegated lifecycle phase returns, **then** the PM triggers `@committer` (unless the `no commit` directive is present). | F-2, NFR-3, NFR-5 |
| AC-F2-2 | **Given** the manual commands /write-spec, /write-test-plan, /write-plan, and /sync-docs, **when** their agent returns, **then** each command triggers `/commit` (`@committer`) while keeping branch setup. | F-2, NFR-4 |
| AC-F2-3 | **Given** the /write-decision command, **when** @decision-advisor returns, **then** the command triggers `/commit` (`@committer`). | F-2, F-4 |
| AC-F5-1 | **Given** a dor_check phase, **when** @readiness-reviewer returns, **then** the PM triggers @committer to commit the verdict file. | F-5 |
| AC-F4-1 | **Given** any agent prompt other than @committer, **when** a grep for a direct `git commit` operation is run across the agent inventory, **then** zero matches are returned. | F-4, NFR-1 |
| AC-F7-1 | **Given** the change-lifecycle guide, **when** an operator reads it, **then** it documents the branch/commit responsibility model (branch owner per mode, commit-trigger owner per phase, universal @committer routing). | F-7 |
| AC-F8-1 | **Given** the .opencode/ prompt changes, **when** the plugin build script runs, **then** .ados-claude/ is regenerated and the CI freshness guard is green. | F-8, NFR-7 |
| AC-F6-1 | **Given** the delivery of this change, **when** prompt definitions are edited, **then** every agent/command prompt edit is performed via @toolsmith (no hand-edits by @coder). | F-6, NFR-8 |
| AC-F2-4 | **Given** a test delivery (manual or autonomous), **when** it completes, **then** the feature branch shows a clean, phase-aligned commit history (≥1 commit per phase). | F-2, NFR-3 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered as a single change on branch `refactor/GH-151/centralize-git-operations`.
- Prompt edits are sequenced via `@toolsmith` (pure-writer conversions first, then orchestrator additions, then docs), with the `.ados-claude/` regeneration committed last alongside the source changes.
- A test delivery (manual or autonomous) validates the phase-aligned commit history before merge.
- No coordinated migration is required: the change is internal to the agent/command team and preserves the branch-naming convention and Conventional Commit stream that downstream consumers already read.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no persistent state migration. `pm-context.yaml` (DM-2) and the `@committer` `<intent>` contract (DM-1) are unchanged in schema; only their usage guarantees strengthen.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A — no personal, sensitive, or tenant data is introduced. The change **improves** secret hygiene by routing 100% of commits through `@committer`'s secret/credential scan (previously bypassed by six agents).

## 21. SECURITY REVIEW HIGHLIGHTS

- **Strengthens** secret/credential scanning: every commit now passes `@committer`'s safety scan, closing six direct-commit bypass paths.
- **Strengthens** forbidden-path hygiene: universal `tmp/`/`.ai/local/` exclusion and `.gitignore` enforcement.
- No new subprocess execution surface or shell-mutation channel is introduced; the change redistributes existing git invocations behind one validated specialist.
- No credentials are added, logged, or delegated.

## 22. MAINTENANCE & OPERATIONS IMPACT

- Artifact-agent prompts shrink (removal of ~15–20 lines of git plumbing each), reducing prompt-maintenance surface and token cost.
- There is exactly one commit path to maintain (`@committer`) and one branch-owner rule per mode, eliminating the six divergent commit implementations.
- Commit history becomes more reviewable and auditable (phase-aligned), aiding DoR/DoD checks and PR review.
- The grep gates (NFR-1, NFR-2) provide low-cost drift detection if a future agent re-introduces a direct commit.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Orchestrator | The entity that invokes a delegated agent and owns the commit trigger for that phase's output — the PM (autonomous), a command (manual), or `@coder` (delivery sub-phases) |
| Pure writer | A delegated agent that produces its artifact and returns with zero git operations |
| Branch owner | The single entity per mode that ensures the change branch exists and is checked out before delegation |
| Commit trigger | The act of invoking `@committer` (or `/commit`) to commit a phase's output |
| Intent hint | The optional free-text `<intent>` passed to `@committer` to help derive a phase-appropriate commit message; the staged diff remains authoritative |
| `no commit` directive | A directive that suppresses the commit trigger for a given operation |
| Delivery exception | `@coder` triggering `@committer` per delivery plan sub-phase (retained unchanged) |

## 24. APPENDICES

- **Appendix A — Target responsibility model (the binding refined state):**

| Orchestrator | Owns commit trigger for | Granularity |
|---|---|---|
| `@pm` (autonomous) | Lifecycle phases 2, 3, 4, 5, 7, 8 + decision-advisor when invoked during planning | 1 commit per phase (+1 per reopen) |
| `@coder` (delivery exception) | Delivery plan sub-phases (phase 6 internals) + decision-advisor/designer/editor when invoked during delivery | 1 commit per plan phase |
| Commands (manual) | Single artifact creation (`/write-spec`, `/write-test-plan`, `/write-plan`, `/sync-docs`, `/review`, `/write-decision`) | 1 commit per invocation |
| `@meeting-organizer` | Its own standalone workflow | 1 commit |
| `@pr-manager` | Pre-PR checkpoint | Auto-`@committer` if dirty |

  Branch ownership: autonomous mode → PM ensures before first delegation; manual mode → commands ensure; agents → never touch branch state.

- **Appendix B — `@committer` safety features gained universally:** preflight guards; `git add -A` with `tmp/`/`.ai/local/` exclusion; `.gitignore` enforcement; secret/credential scan (STOP on suspicion); large-binary warning; diff-derived Conventional Commit type/scope with breaking-change detection; single commit with one post-hook amend.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-04 | Juliusz Ćwiąkalski | Initial specification |

---

## AUTHORING GUIDELINES

- Authored from the planning-session context (the work-item summary, the four binding decisions, the refinement comment, scope, risks, and the "already correct" list) plus direct reads of the current agent/command prompts and the `@committer` workflow.
- The **refinement comment is treated as binding and supersedes the ticket's original Decision 3**: `@decision-advisor` is a pure writer (orchestrator commits), not a self-delegator. This is recorded as DEC-3.
- Functional capabilities are expressed at a responsibility/capability boundary (who owns branch, who owns the commit trigger, universal routing) rather than at an implementation level; no file-level code paths, line numbers, or step-by-step edit tasks are included.
- Open questions OQ-1/OQ-2 are recorded as resolved so the plan-writer has durable context; both lean toward the least-drift, highest-quality outcome.
- Backward compatibility is emphasized throughout (branch naming, `@committer` behavior, Conventional Commit stream unchanged) to satisfy the DoR validation checklist.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-151)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
