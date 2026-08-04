---
id: chg-GH-151-centralize-git-operations
status: Updated
created: 2026-08-04T00:00:00Z
last_updated: 2026-08-04T13:05:00Z
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
labels: ["agent-improvement", "git-operations", "conventional-commits", "prompt-governance"]
links:
  change_spec: ./chg-GH-151-spec.md
  test_plan: ./chg-GH-151-test-plan.md
  decisions:
    - ../../decisions/ODR-0001-classify-yaml-register-templates-redistributable.md
summary: >
  Establish one branch owner (PM in autonomous mode, commands in manual mode) and one commit
  path (@committer) across the agent/command team, eliminating six direct-commit bypass paths and
  ensuring universal secret/credential scanning, forbidden-path exclusion, and diff-derived
  Conventional Commit messages.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-151: Centralize git operations: PM owns branch setup, all commits route through @committer

## Context and Goals

This plan delivers the git-operations responsibility refactor defined in [chg-GH-151-spec.md](./chg-GH-151-spec.md) and verified by [chg-GH-151-test-plan.md](./chg-GH-151-test-plan.md). It restructures who owns branch state and commit triggers so that:

- **One branch owner per mode** — the PM ensures the change branch before its first delegation (autonomous mode); artifact commands keep their branch-ensure step (manual mode); delegated agents never touch branch state (G-1, F-1).
- **One commit path** — every commit routes through `@committer`; no agent prompt other than `@committer` performs a direct `git commit` (G-2, G-5, F-4).
- **Pure artifact agents** — the six delegated writers (spec-writer, test-plan-writer, plan-writer, doc-syncer, reviewer-local-mode, decision-advisor) produce their artifact and return with zero git operations (G-4, F-3).
- **Phase-aligned commits** — the PM triggers `@committer` after each delegated lifecycle phase returns; manual commands trigger `/commit` after the agent returns; `@coder` keeps its per-sub-phase trigger (G-3, F-2).
- **Traceable DoR verdict** — the PM commits the `@readiness-reviewer` verdict (F-5, DEC-4).
- **Durable convention** — the responsibility model is documented in `change-lifecycle.md` (F-7); the `.ados-claude/` mirror is regenerated and stays fresh (F-8).

**Binding constraint (F-6, NFR-8, DEC-5):** All edits to `.opencode/agent/*.md` and `.opencode/command/*.md` are performed by `@toolsmith` — never hand-edited by `@coder`. Per `AGENTS.md`: "Delegate to `@toolsmith` … Do not hand-edit agent/command files directly." Every prompt-edit task below is therefore framed as an `@coder` delegation to `@toolsmith`. After each `@toolsmith` edit returns, `@coder` triggers `@committer` with a phase-appropriate intent hint (the delivery exception — `@coder` already delegates to `@committer` correctly, per spec §2.1).

**Resolved open questions carried forward:** OQ-1 (single source of truth = `change-lifecycle.md`; align `AGENTS.md` only where it already implies commit behavior), OQ-2 (orchestrators pass an explicit intent hint per phase). Both resolved in the spec (§14).

**OQ-T1 (from test plan §8.3) — RESOLVED: exact mechanism for the `no commit` directive.** Decision: do **not** introduce a new structured field (no `directives.no_commit`). The existing bare-string `"no commit"` directive already works — `@pm` (autonomous mode) and the five manual commands simply check for the string `"no commit"` and **skip** the `@committer`/`/commit` trigger when present. This keeps the directive format unchanged and avoids a schema migration of `pm-context.yaml`. Phase 2 (task 2.3) and Phase 3 (task 3.6) implement the bare-string check; `@toolsmith` is told the exact check, not asked to design it.

## Scope

### In Scope

- Convert the six delegated writers to pure writers: `@spec-writer`, `@test-plan-writer`, `@plan-writer`, `@doc-syncer`, `@reviewer` (local mode), `@decision-advisor` — remove all branch/commit logic (F-3, F-4).
- Add a branch-ensure step and per-phase `@committer` triggers to `@pm` (autonomous mode) (F-1, F-2).
- Make `@readiness-reviewer` a pure writer of its verdict; PM commits the verdict (F-5, DEC-4).
- Update `/write-spec`, `/write-test-plan`, `/write-plan`, `/sync-docs` to keep branch setup and trigger `/commit`; add a `/commit` trigger to `/write-decision` (F-2, F-4).
- Honor the `no commit` directive in `@pm` and the commands (F-2, NFR-5).
- Document the responsibility model in `doc/guides/change-lifecycle.md`; align `AGENTS.md` only where needed (F-7).
- Regenerate `.ados-claude/` via `scripts/build-claude-plugin.sh` (F-8).
- All prompt edits performed via `@toolsmith` (F-6, NFR-8).

### Out of Scope

- [OUT] A path-scope / staged-subset mode for `@committer` (NG-1).
- [OUT] Changes to `@committer`'s logic, message grammar, or safety thresholds (NG-2).
- [OUT] Changes to `@coder`, `@meeting-organizer`, `@pr-manager`, `@review-feedback-applier`, `@decision-critic`, `@runner` — already correct (NG-3, spec §2.1).
- [OUT] Changes to `/run-plan`, `/review`, `/review-deep`, `/check-fix`, `/commit` — already delegate correctly.
- [OUT] Changes to the 11-phase lifecycle numbering or the OpenCode session model (NG-4).
- [OUT] A new commit-message schema (NG-5) or branch-naming change (NG-6).
- [OUT] Phase-reopen testing (deferred per spec §7.3).

### Constraints

- **Prompt governance:** `.opencode/agent/**` and `.opencode/command/**` edits are `@toolsmith`-only (AGENTS.md, F-6).
- **Clean worktree guarantee:** orchestrators run one phase at a time, so `@committer`'s `git add -A` is safe (spec §12, RSK-1).
- **Backward compatibility:** branch-naming convention, `@committer` behavior, and the Conventional Commit stream are unchanged (spec §8.5).
- **Distributable docs:** edits to `doc/guides/change-lifecycle.md` must keep the `ados_distribution` marker and pass `scripts/.tests/test-doc-distribution.sh` (ODR-0001).
- **No automated test framework** exists for prompt changes; verification is static (grep) + content review + one behavioral test delivery (test plan §4, §7).

### Risks

- **RSK-1** (`git add -A` stages unintended files): mitigated by orchestrator clean-worktree guarantee + `@committer`'s `tmp/`/`.ai/local/` exclusion and secret scan.
- **RSK-2** (commit-message regression without hints): mitigated by orchestrators passing an explicit phase-appropriate intent hint (OQ-2 resolved).
- **RSK-3** (`no commit` directive ignored): mitigated by PM/commands checking the directive before triggering; documented in the responsibility model.
- **RSK-4** (an agent is missed, leaving a direct-commit path): mitigated by the Phase 6 grep gate (NFR-1) as an acceptance criterion.
- **RSK-5** (`@toolsmith` handoff overhead): mitigated by scoping each edit crisply and batching per agent in Phases 1–3.
- **RSK-T1** (grep patterns miss indirect git ops): mitigated by supplementing greps with manual review (test plan §8.1).

### Success Metrics

| Metric | Target | Source |
|--------|--------|--------|
| Non-`@committer` agent prompts with a direct `git commit` | 0 (grep-verified) | NFR-1, AC-F4-1 |
| Delegated agent prompts with branch/commit instructions | 0 | NFR-2 |
| Commits per delivered lifecycle phase (autonomous) | ≥ 1 | NFR-3, AC-F2-4 |
| Commits per manual artifact command invocation | 1 | NFR-4 |
| Commits routed through `@committer` (secret scan applied) | 100% | NFR-6 |
| Prompt edits performed via `@toolsmith` (0 `@coder` hand-edits) | 100% | NFR-8, AC-F6-1 |
| `.ados-claude/` regenerated, CI freshness guard green | pass | NFR-7, AC-F8-1 |

## Phases

> **Delivery model for every phase:** `@coder` delegates each prompt edit to `@toolsmith`; after the edit returns and the phase's grep gates pass, `@coder` triggers `@committer` with the phase's intent hint (the delivery exception — already correct per spec §2.1). Each `@committer` commit is the phase completion signal.

### Phase 1: Convert delegated artifact agents to pure writers

**Goal**: The six delegated writers lose all git operations (branch rules, staging, commit steps, multi-commit split) and gain a pure-write note that the orchestrator handles branch and commit.

**Tasks**:

- [ ] **1.1** Delegate to `@toolsmith`: edit `.opencode/agent/spec-writer.md` — remove `<branch_rules>` / `<commit_rules>`, branch checkout/create, "stage ONLY this file", and the `git commit` step; add a pure-write note (orchestrator owns branch + commit).
- [ ] **1.2** Delegate to `@toolsmith`: edit `.opencode/agent/test-plan-writer.md` — same removals + pure-write note.
- [ ] **1.3** Delegate to `@toolsmith`: edit `.opencode/agent/plan-writer.md` — same removals + pure-write note.
- [ ] **1.4** Delegate to `@toolsmith`: edit `.opencode/agent/doc-syncer.md` — remove the direct commit **and** the multi-commit split logic (DEC-2); add a pure-write note.
- [ ] **1.5** Delegate to `@toolsmith`: edit `.opencode/agent/reviewer.md` — in local mode, remove the direct commit and "stage the plan file" logic; add a note that the command triggers `/commit` (aligning the agent with `/review` and `/review-deep` which already reference `/commit`).
- [ ] **1.6** Delegate to `@toolsmith`: edit `.opencode/agent/decision-advisor.md` — remove the direct commit and "stage ONLY the decision record" logic (DEC-3); add a note that the orchestrator triggers `@committer`.

**Acceptance Criteria**:

- Must: AC-F3-1 (spec/test-plan/plan-writer contain zero git operations + pure-write note).
- Must: AC-F3-2 (doc-syncer: no direct commit, no multi-commit split).
- Must: AC-F3-3 (reviewer local mode: no direct commit).
- Must: AC-F3-4 (decision-advisor: no direct commit, per DEC-3).
- Should: each prompt shrinks by the removed git plumbing (~15–20 lines each), reducing token cost.

**Affected code areas**:

- `.opencode/agent/spec-writer.md` (updated)
- `.opencode/agent/test-plan-writer.md` (updated)
- `.opencode/agent/plan-writer.md` (updated)
- `.opencode/agent/doc-syncer.md` (updated)
- `.opencode/agent/reviewer.md` (updated)
- `.opencode/agent/decision-advisor.md` (updated)

**System docs to update**:

- none (system-spec reconciliation happens in Phase 8)

**Tests**:

- TC-GIT-001: `rg "git checkout|git branch|git add|git commit" .opencode/agent/spec-writer.md` → 0 matches; pure-write note present.
- TC-GIT-002: same grep on `.opencode/agent/test-plan-writer.md` → 0 matches.
- TC-GIT-003: same grep on `.opencode/agent/plan-writer.md` → 0 matches.
- TC-GIT-004: `rg "git commit|split|more than.*files" .opencode/agent/doc-syncer.md` → 0 matches.
- TC-GIT-005: `rg "git commit|stage.*plan file" .opencode/agent/reviewer.md` → 0 matches.
- TC-GIT-006: `rg "git commit|stage.*decision record" .opencode/agent/decision-advisor.md` → 0 matches.

**Completion signal**: `@committer` commit, intent hint: "convert delegated artifact agents to pure writers (GH-151)".

---

### Phase 2: Add orchestrator branch-ensure and per-phase commit triggers (pm, readiness-reviewer)

**Goal**: `@pm` ensures the change branch before its first delegation and triggers `@committer` after each delegated lifecycle phase returns (autonomous mode); `@readiness-reviewer` becomes a pure writer of its verdict; the PM commits the verdict for traceability.

**Tasks**:

- [ ] **2.1** Delegate to `@toolsmith`: edit `.opencode/agent/pm.md` — add a branch-ensure step before the first delegation (checkout if exists, else create `<type>/<workItemRef>/<slug>`); record the branch in `pm-context.yaml` (DM-2).
- [ ] **2.2** Delegate to `@toolsmith`: edit `.opencode/agent/pm.md` — add a `@committer` trigger after each delegated lifecycle phase returns (specification, test-planning, delivery-planning, dor-check, system-spec-update, review-fix), each with a phase-appropriate intent hint (e.g., "add spec for `<ref>`", "add test plan for `<ref>`").
- [ ] **2.3** Delegate to `@toolsmith`: edit `.opencode/agent/pm.md` — add the `no commit` directive check that suppresses the trigger. Per the resolved OQ-T1: check for the existing bare-string `"no commit"` directive (do **not** introduce a new `directives.no_commit` field); if present, skip the `@committer` trigger.
- [ ] **2.4** Delegate to `@toolsmith`: edit `.opencode/agent/pm.md` — add an explicit `@committer` trigger to commit the `@readiness-reviewer` verdict file after dor_check returns (F-5, DEC-4).
- [ ] **2.5** Delegate to `@toolsmith`: edit `.opencode/agent/readiness-reviewer.md` — make it write the verdict and return without committing; add a note that the PM commits the verdict.

**Acceptance Criteria**:

- Must: AC-F1-1 (PM ensures branch + records it before first delegation).
- Must: AC-F2-1 (PM triggers `@committer` after each delegated phase, unless `no commit`).
- Must: AC-F5-1 (PM triggers `@committer` to commit the verdict).
- Must: NFR-5 (`no commit` directive honored).
- Should: intent hints are phase-appropriate so `@committer` derives good Conventional Commit messages (RSK-2 mitigation).

**Affected code areas**:

- `.opencode/agent/pm.md` (updated)
- `.opencode/agent/readiness-reviewer.md` (updated)

**System docs to update**:

- none

**Tests**:

- TC-GIT-007: manual review of `pm.md` — branch-ensure step present before first delegation, correct naming convention, recorded in `pm-context.yaml`.
- TC-GIT-008: manual review of `pm.md` — `@committer` trigger present after each delegated phase returns; `no commit` directive checked; intent hints passed.
- TC-GIT-011: `@readiness-reviewer` is a pure writer; PM triggers `@committer` for the verdict.

**Completion signal**: `@committer` commit, intent hint: "add PM branch-ensure and per-phase @committer triggers (GH-151)".

---

### Phase 3: Route manual command commits through /commit

**Goal**: The five artifact commands keep their branch-ensure step and trigger `/commit` (`@committer`) after the delegated agent returns; `/write-decision` gains a `/commit` trigger.

**Tasks**:

- [ ] **3.1** Delegate to `@toolsmith`: edit `.opencode/command/write-spec.md` — keep branch-ensure; add `/commit` trigger after `@spec-writer` returns (intent hint: "add spec for `<ref>`").
- [ ] **3.2** Delegate to `@toolsmith`: edit `.opencode/command/write-test-plan.md` — keep branch-ensure; add `/commit` trigger after `@test-plan-writer` returns.
- [ ] **3.3** Delegate to `@toolsmith`: edit `.opencode/command/write-plan.md` — keep branch-ensure; add `/commit` trigger after `@plan-writer` returns.
- [ ] **3.4** Delegate to `@toolsmith`: edit `.opencode/command/sync-docs.md` — keep branch-ensure; add `/commit` trigger after `@doc-syncer` returns; remove any multi-commit split (DEC-2).
- [ ] **3.5** Delegate to `@toolsmith`: edit `.opencode/command/write-decision.md` — add `/commit` trigger after `@decision-advisor` returns (intent hint for the decision record).
- [ ] **3.6** Delegate to `@toolsmith`: ensure the bare-string `"no commit"` directive check is present in each of the five commands (per the resolved OQ-T1, consistent with Phase 2 task 2.3): if `"no commit"` is present, skip the `/commit` trigger.

**Acceptance Criteria**:

- Must: AC-F2-2 (`/write-spec`, `/write-test-plan`, `/write-plan`, `/sync-docs` trigger `/commit` while keeping branch setup).
- Must: AC-F2-3 (`/write-decision` triggers `/commit` after `@decision-advisor` returns).
- Must: NFR-4 (exactly 1 `/commit` per manual invocation).

**Affected code areas**:

- `.opencode/command/write-spec.md` (updated)
- `.opencode/command/write-test-plan.md` (updated)
- `.opencode/command/write-plan.md` (updated)
- `.opencode/command/sync-docs.md` (updated)
- `.opencode/command/write-decision.md` (updated)

**System docs to update**:

- none

**Tests**:

- TC-GIT-009: manual review — each of the four artifact commands retains branch-ensure and triggers `/commit` after the agent returns; `no commit` directive checked.
- TC-GIT-010: manual review of `write-decision.md` — `/commit` trigger present after `@decision-advisor` returns; intent hint passed.

**Completion signal**: `@committer` commit, intent hint: "route manual command commits through /commit (GH-151)".

---

### Phase 4: Document the responsibility model (change-lifecycle.md, AGENTS.md alignment)

**Goal**: Make the branch/commit responsibility model durable in `doc/guides/change-lifecycle.md`, with `AGENTS.md` aligned only where its existing process table or agent descriptions currently imply commit behavior (OQ-1 resolved: single source of truth = the guide).

**Tasks**:

- [ ] **4.1** Delegate to `@toolsmith` (or `@editor`): add a "Branch and commit responsibility model" section to `doc/guides/change-lifecycle.md` mirroring spec Appendix A — branch owner per mode (PM autonomous / commands manual / agents never), commit-trigger owner per phase, and the universal "`@committer` is the only commit path" rule.
- [ ] **4.2** Review `AGENTS.md` (delivery-process table + agent descriptions); delegate any alignment edit to `@toolsmith` only where the current text implies commit behavior that the new model changes.
- [ ] **4.3** Verify `change-lifecycle.md` retains its `ados_distribution` marker (redistributable) so `scripts/.tests/test-doc-distribution.sh` stays green.

**Acceptance Criteria**:

- Must: AC-F7-1 (guide documents branch ownership per mode, commit-trigger ownership per phase, universal `@committer` routing).
- Should: `AGENTS.md` has no stale commit-behavior claims that contradict the new model.

**Affected code areas**:

- none (documentation only)

**System docs to update**:

- `doc/guides/change-lifecycle.md` (updated — responsibility-model section)
- `AGENTS.md` (aligned only if needed)

**Tests**:

- TC-GIT-013: `rg "responsibility.*model|branch.*owner|commit.*trigger" doc/guides/change-lifecycle.md` → section present and complete vs. spec Appendix A.
- Doc-distribution guard: `bash scripts/.tests/test-doc-distribution.sh` passes (marker intact).

**Completion signal**: `@committer` commit, intent hint: "document git-operations responsibility model (GH-151)".

---

### Phase 5: Regenerate the Claude plugin and verify freshness

**Goal**: Regenerate the `.ados-claude/` mirror from the `.opencode/` changes so the generated plugin stays in sync and the CI freshness guard is green.

**Tasks**:

- [ ] **5.1** Run `bash scripts/build-claude-plugin.sh` to regenerate `.ados-claude/**` from the updated `.opencode/` source.
- [ ] **5.2** Verify the regenerated files include the source-naming/regeneration-command comments and reflect Phases 1–4 changes.
- [ ] **5.3** Run `bash scripts/.tests/test-doc-distribution.sh` (the CI drift/freshness guard) and confirm it passes.
- [ ] **5.4** `@committer` commit the regenerated `.ados-claude/` alongside the source changes.

**Acceptance Criteria**:

- Must: AC-F8-1 (`.ados-claude/` regenerated; freshness guard green).
- Must: NFR-7.

**Affected code areas**:

- `.ados-claude/**` (regenerated — mirror of Phases 1–4)

**System docs to update**:

- none

**Tests**:

- TC-GIT-014: build script succeeds; `.ados-claude/` regenerated; `test-doc-distribution.sh` passes.

**Completion signal**: `@committer` commit, intent hint: "regenerate Claude plugin from centralized git-operations prompts (GH-151)".

---

### Phase 6: Static verification — grep gates and prompt-governance audit

**Goal**: Statically prove the NFRs hold across the whole inventory before review: zero direct commits outside `@committer`, zero branch/commit logic in delegated agents, zero `@coder` hand-edits of prompts.

**Tasks**:

- [ ] **6.1** Run the scoped ownership gate (TC-GIT-012), scoped to the **six delegated agents only** (`spec-writer`, `test-plan-writer`, `plan-writer`, `doc-syncer`, `reviewer`, `decision-advisor`). Use **structural checks first** (absence of `<branch_rules>`/`<commit_rules>` sections), supplemented by an imperative commit-instruction grep. Do **not** broad-grep `git checkout|git branch` across these agents — `reviewer.md` legitimately contains two remote-mode (`modes="remote"`) checkout instructions (line 161: `git checkout --detach <head_sha>`; line 304: `git checkout <original_branch>`) that must be retained and are out of scope for this change; those live inside `<process>` steps, not inside a `<branch_rules>` section, so the structural check correctly ignores them. Do **not** grep the whole `.opencode/agent/` or `.opencode/command/` trees for `git commit` — legitimate prohibition/guidance text in `pm.md` and `review-feedback-applier.md` (e.g., "Hard rule: No git commit…", "never use @runner for git commit operations") would make a broad grep unachievable.
  - Structural branch-rules absence (must be 0 matches): `rg "<branch_rules>" .opencode/agent/spec-writer.md .opencode/agent/test-plan-writer.md .opencode/agent/plan-writer.md .opencode/agent/doc-syncer.md .opencode/agent/reviewer.md .opencode/agent/decision-advisor.md`
  - Structural commit-rules absence (must be 0 matches): `rg "<commit_rules>" .opencode/agent/spec-writer.md .opencode/agent/test-plan-writer.md .opencode/agent/plan-writer.md .opencode/agent/doc-syncer.md .opencode/agent/reviewer.md .opencode/agent/decision-advisor.md`
  - Imperative commit-instruction patterns (defense-in-depth; must be 0 actionable matches): `rg "Commit with:|git commit -F|create a single commit|Stage ONLY|\.add\(|\.commit\(|git add|git commit" .opencode/agent/spec-writer.md .opencode/agent/test-plan-writer.md .opencode/agent/plan-writer.md .opencode/agent/doc-syncer.md .opencode/agent/reviewer.md .opencode/agent/decision-advisor.md`
  - Allowlist check: if any match appears in the imperative grep, verify it is prohibition/guidance text only (e.g., "never use git commit", "no git commit") and not an actionable commit instruction; any actionable instruction must be removed via `@toolsmith`.
- [ ] **6.2** Run the structural branch-ownership gate (aligned with TC-GIT-012 step 1 and 6.1): `rg "<branch_rules>" .opencode/agent/{spec-writer,test-plan-writer,plan-writer,doc-syncer,reviewer,decision-advisor}.md` → 0 matches. The previous `git checkout|git branch` grep is retired — it false-matched `reviewer.md`'s legitimate remote-mode checkout instructions (out of scope); structural `<branch_rules>` absence is the robust equivalent.
- [ ] **6.3** Re-run TC-GIT-001 through TC-GIT-006 (per-agent pure-writer greps + pure-write notes present).
- [ ] **6.4** Confirm already-correct agents untouched: `@coder`, `@meeting-organizer`, `@pr-manager` still delegate correctly (no new direct commits introduced).
- [ ] **6.5** Audit prompt-governance compliance (TC-GIT-015): every prompt edit in Phases 1–4 was a `@toolsmith` delegation — no `@coder` hand-edits (NFR-8).
- [ ] **6.6** If any drift is found, delegate the fix to `@toolsmith`, then re-run the failing gate and trigger `@committer` with intent hint "fix git-operations drift (GH-151)".

**Acceptance Criteria**:

- Must: AC-F4-1 (zero direct `git commit` outside `@committer`).
- Must: NFR-1, NFR-2.
- Must: NFR-8 (TC-GIT-015 — all edits via `@toolsmith`).

**Affected code areas**:

- none (verification only; drift fixes, if any, route through `@toolsmith`)

**System docs to update**:

- none

**Tests**:

- TC-GIT-001 … TC-GIT-006, TC-GIT-012, TC-GIT-015.

**Completion signal**: clean verification (no commit) — or a `@committer` drift-fix commit if 6.6 applied.

---

### Phase 7: Code review and remediation

**Goal**: Adversarial audit of all changes against the spec and this plan; remediate any FAIL via `@toolsmith` and re-review until PASS.

**Tasks**:

- [ ] **7.1** Run `/review GH-151` (local mode) — `@reviewer` audits Phases 1–5 changes against `chg-GH-151-spec.md` and this plan; the `/review` command triggers `/commit` for the review artifact (the agent itself is now a pure writer).
- [ ] **7.2** If verdict = FAIL: classify each finding; delegate every prompt-fix to `@toolsmith` (never hand-edit); trigger `@committer` per remediation; re-run the relevant Phase 6 grep gates.
- [ ] **7.3** Re-review until `@reviewer` returns PASS.

**Acceptance Criteria**:

- Must: `@reviewer` verdict = PASS (all spec AC satisfied).
- Should: no RSK-4 residue (no missed direct-commit path).

**Affected code areas**:

- depends on review findings (any prompt fix routes through `@toolsmith`)

**System docs to update**:

- none

**Tests**:

- Re-run TC-GIT-012 after any remediation edit.

**Completion signal**: `@reviewer` verdict PASS; `/review` commits the review artifact via `/commit`.

---

### Phase 8: Finalize and release

**Goal**: Reconcile the system spec with the implementation, record the minor version impact, validate the end-to-end behavior with a small test delivery, and confirm the Definition of Done.

**Tasks**:

- [ ] **8.1** Delegate to `@doc-syncer` (now a pure writer) to reconcile `doc/spec/**` with the new git-operations responsibility model; `@coder` triggers `@committer` with intent hint "reconcile system spec for centralized git operations (GH-151)".
- [ ] **8.2** Record the **minor** version impact. _Note: this repo has no semver manifest at root, so the bump is recorded via the system-spec reconciliation and this plan's revision log rather than a VERSION file edit._
- [ ] **8.3** Spec reconciliation check: confirm `doc/spec/**` reflects F-1 … F-8 and the responsibility model; no stale claims about per-agent commits.
- [ ] **8.4** Behavioral validation (TC-GIT-016): run a small test delivery (manual or autonomous, on a throwaway work item) and confirm a clean, phase-aligned Conventional-Commit history (≥1 commit per lifecycle phase; readiness-verdict commit present). _Best-effort: if a full test delivery is impractical pre-merge, validate the manual-command path (`/write-*` → `/commit`) on a scratch branch and record the result._
- [ ] **8.5** Definition of Done: every spec AC (§17) satisfied; every plan task above checked; NFR-1 … NFR-8 green; `.ados-claude/` fresh.

**Acceptance Criteria**:

- Must: AC-F2-4 (test delivery shows clean, phase-aligned commit history) — or a documented best-effort validation per 8.4.
- Must: all spec AC (§17) satisfied; DoD reached.

**Affected code areas**:

- none (release/doco only; `doc/spec/**` reconciliation)

**System docs to update**:

- `doc/spec/**` (updated — git-operations responsibility model reconciled by `@doc-syncer`)

**Tests**:

- TC-GIT-016 (behavioral — phase-aligned commit history).

**Completion signal**: `@committer` commit, intent hint: "finalize GH-151: system-spec reconciliation and minor version impact".

---

## Test Scenarios

Mapped from [chg-GH-151-test-plan.md](./chg-GH-151-test-plan.md) §5.

| TC ID | Scenario | Phases | AC |
|-------|----------|--------|----|
| TC-GIT-001 | spec-writer is a pure writer (no git ops) | 1 | AC-F3-1 |
| TC-GIT-002 | test-plan-writer is a pure writer (no git ops) | 1 | AC-F3-1 |
| TC-GIT-003 | plan-writer is a pure writer (no git ops) | 1 | AC-F3-1 |
| TC-GIT-004 | doc-syncer is a pure writer (no direct commit, no multi-commit split) | 1 | AC-F3-2 |
| TC-GIT-005 | reviewer (local mode) is a pure writer (no direct commit) | 1 | AC-F3-3 |
| TC-GIT-006 | decision-advisor is a pure writer (no direct commit) | 1 | AC-F3-4 |
| TC-GIT-007 | PM ensures branch before first delegation (autonomous) | 2 | AC-F1-1 |
| TC-GIT-008 | PM triggers `@committer` after each delegated phase (autonomous) | 2 | AC-F2-1, NFR-3, NFR-5 |
| TC-GIT-009 | Manual commands trigger `/commit` after the agent returns | 3 | AC-F2-2, NFR-4 |
| TC-GIT-010 | `/write-decision` triggers `/commit` after `@decision-advisor` returns | 3 | AC-F2-3 |
| TC-GIT-011 | PM commits the readiness-reviewer verdict after DoR check | 2 | AC-F5-1 |
| TC-GIT-012 | Structural check across the six delegated agents: no `<branch_rules>`/`<commit_rules>` sections and zero imperative commit instructions (prohibition text allowlisted; reviewer remote-mode checkouts excluded) | 6 | AC-F4-1, NFR-1, NFR-2 |
| TC-GIT-013 | `change-lifecycle.md` documents the responsibility model | 4 | AC-F7-1 |
| TC-GIT-014 | Claude plugin regenerates and freshness guard passes | 5 | AC-F8-1, NFR-7 |
| TC-GIT-015 | All prompt edits performed via `@toolsmith` (no hand-edits) | 1–4, 6 | AC-F6-1, NFR-8 |
| TC-GIT-016 | Test delivery produces a clean, phase-aligned commit history | 8 | AC-F2-4, NFR-3, NFR-6 |

## Artifacts and Links

| Artifact | Location | Type |
|----------|----------|------|
| Change specification | ./chg-GH-151-spec.md | Spec |
| Test plan | ./chg-GH-151-test-plan.md | Test plan |
| Implementation plan | ./chg-GH-151-plan.md | Plan (this file) |
| PM notes | ./chg-GH-151-pm-notes.yaml | PM context |
| Pure-writer agent prompts | `.opencode/agent/{spec-writer,test-plan-writer,plan-writer,doc-syncer,reviewer,decision-advisor}.md` | Updated (Phase 1) |
| Orchestrator prompts | `.opencode/agent/{pm,readiness-reviewer}.md` | Updated (Phase 2) |
| Manual commands | `.opencode/command/{write-spec,write-test-plan,write-plan,sync-docs,write-decision}.md` | Updated (Phase 3) |
| Responsibility-model guide | `doc/guides/change-lifecycle.md` | Updated (Phase 4) |
| Repo guide (alignment) | `AGENTS.md` | Aligned if needed (Phase 4) |
| Generated Claude plugin | `.ados-claude/**` | Regenerated (Phase 5) |
| Plugin build script | `scripts/build-claude-plugin.sh` | Used (Phase 5, unchanged) |
| Doc-distribution guard | `scripts/.tests/test-doc-distribution.sh` | Used (Phases 4, 5) |
| Related decision | `doc/decisions/ODR-0001-classify-yaml-register-templates-redistributable.md` | Reference (doc-distribution) |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-04 | plan-writer | Initial plan — 8 phases; all prompt edits delegated to `@toolsmith`; grep gates + behavioral validation per test plan. |
| 1.1 | 2026-08-04 | plan-writer | DoR iter-2 fix: Phase 6.1 grep narrowed to the six delegated agents + imperative commit-step patterns (mirrors refined TC-GIT-012; avoids false positives on prohibition text in `pm.md`/`review-feedback-applier.md`). Resolved OQ-T1: use the existing bare-string `"no commit"` directive (no new `directives.no_commit` field); PM/commands skip the `@committer`/`/commit` trigger when present. Updated Phase 2 (2.3) and Phase 3 (3.6) accordingly; aligned the TC-GIT-012 scenario row. |
| 1.2 | 2026-08-04 | reviewer feedback (DoR iter) | Phase 6.1 / 6.2: retired the broad `git checkout\|git branch` grep — it false-matched `reviewer.md`'s legitimate remote-mode (`modes="remote"`) checkout instructions (lines 161, 304), which are out of scope. Replaced with a **structural** `<branch_rules>`/`<commit_rules>` section-absence check (robust: those checkouts live in `<process>` steps, not `<branch_rules>`); kept the imperative commit-instruction grep as defense-in-depth with the prohibition-text allowlist. Aligned TC-GIT-012 scenario row. (Mirrors the test plan v1.1 fix; OQ-T3 traceability clarified — `@coder`/`@meeting-organizer`/`@pr-manager` regression is plan task 6.4, not TC-GIT-012.) |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|-------|--------|---------|-----------|--------|-------|
| — | — | — | — | — | Execution not yet started |
