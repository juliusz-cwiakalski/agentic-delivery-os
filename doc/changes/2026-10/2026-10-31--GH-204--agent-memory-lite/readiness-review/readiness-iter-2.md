# Readiness Review Iteration 2

Verdict: READY
Work Item: GH-204
Date: 2026-10-31
Pause Required: no

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Gate Context

- Artifacts read: `chg-GH-204-spec.md` v1.1 (143 lines), `chg-GH-204-test-plan.md` v1.1 (201 lines, TC-MEMORY-001..015), `chg-GH-204-plan.md` v1.1 (202 lines, 4 coder phases), `chg-GH-204-pm-notes.yaml`, and `readiness-review/readiness-iter-1.md`.
- Source ticket: GitHub issue 204, body plus both owner comments. Owner comment 2026-10-31 confirms the seed set, the `.ai/memory/agents/<agent>/README.md` shape, own-README-at-start plus just-in-time index, `.gitkeep` placeholders, and squash merge into `main-tools`.
- Repo contracts checked: `doc/spec/features/feature-agents-and-commands.md`, `doc/spec/features/feature-claude-plugin-generation.md`, `doc/spec/features/feature-delivery-lifecycle.md`, `doc/guides/definition-of-ready.md`, `.ai/rules/testing-strategy.md`, `.opencode/README.md`, `.opencode/agent/doc-syncer.md`, `scripts/build-claude-plugin.sh`, `scripts/.tests/test-doc-distribution.sh`, `tests/behaviour/pm-notes-corpus-support.ts`, `packages/core/src/contracts/pm-notes.ts`.
- Read-only checks run at this gate: pm-notes YAML parses (PyYAML, `variant: full`, all 11 phases present, required keys present); zero U+2013/U+2014 in the four change artifacts; `git diff -U0 9a70aaf -- AGENTS.md` yields exactly one added hunk inside the new `## Agent memory` section; the plugin build script reads only `.opencode/agent` and `.opencode/command`, so a new `.opencode/skills` file cannot create `.ados-claude` drift; the doc-distribution guard scans `doc/guides`, `doc/templates`, and the standalone docs, not `.ai/memory` or `.opencode/skills`; `testing-strategy.md` explicitly permits docs-only manual verification plus `git diff --check`; corpus membership includes `doc/changes/2026-10/...GH-204.../chg-GH-204-pm-notes.yaml` and the lint checks phase presence, not phase completion.
- Drafts inspected but not adjudicated as final implementation: modified `AGENTS.md`, untracked `.ai/memory/**`, untracked `.opencode/skills/consolidate-memory/SKILL.md`. Per the gate brief, draft incompleteness is delivery work, not a readiness failure.
- Baseline consistency: `9a70aaf` is the cited base in the spec, test plan, plan, and pm-notes; the worktree sits on `feat/GH-204/agent-memory-lite`.

## Iteration 1 Finding Resolution

| ID | Was | Status | Evidence |
|---|---|---|---|
| F-1 | critical | Resolved | R4 and R7 define the first-capture self-folder plus exactly one self-scoped index row; AC-4 and TC-MEMORY-006 assert it; plan 1.4 and 2.6 task it. |
| F-2 | critical | Resolved in normative artifacts | R4 lists the complete curator set (merge, demote/drop, supersede, prune with reason, pointer move, cap split, index rebuild) and "no substantive rewording"; R9 repeats it; plan pinned decisions and 3.3 align. Residual pm-notes log entry only: see F-24, downgraded to minor. |
| F-3 | critical | Resolved | R7, AC-2, NFR-2, TC-MEMORY-004, plan 2.3 and 2.8 all use record-level granularity: one row per agent folder and one row per promoted record file, no `lessons/` or `tacit/` directory rows. |
| F-4 | major | Resolved | R5 states advisory untrusted data, newer is a candidate, evidence and current truth decide; plan 1.2, 1.6, 3.4; AC-9; TC-MEMORY-009 plus the TC-MEMORY-007 conflict scenario. |
| F-5 | major | Resolved | R9 routes facts to `@doc-syncer` and decisions to `@decision-advisor` as a handoff; plan 3.2 forbids writing those targets; AC-8 and TC-MEMORY-008 assert refusal or handoff with unchanged targets. |
| F-6 | major | Resolved | TC-MEMORY-003 is now a rule-by-rule checklist for R1..R10 inside the single section, including R2, R3, R7, R8, R9, plus the scoped one-hunk diff. |
| F-7 | major | Resolved in substance | R8 pins YAML 1.2 core semantics and quoting of `statement`, `applies_when`, and `created`; plan 2.4 and 3.4; AC-11/TC-MEMORY-014 parse a colon-space sample. Residual test precision: see F-27, downgraded to nit. |
| F-8 | major | Resolved | R8 and AC-11 pin monotonic next free id per prefix and year, uniqueness across both directories, never reused after supersession or pruning, and validation over both `id` and `supersedes`; plan 1.5 and 2.5; TC-MEMORY-010. |
| F-9 | major | Resolved | TC-MEMORY-007 adds a newer unsupported claim against an older evidence-backed claim and asserts the evidence-backed claim survives; TC-MEMORY-009 supplies the scenario review. |
| F-10 | major | Resolved | R3 adds the two-occurrence plus likely-recurrence rule and the routine-success exclusion; plan 1.1; TC-MEMORY-003 asserts both. |
| F-11 | major | Resolved | R6 and AC-10 cover the three adversarial roles and the coder-reasoning bar in kernel and README; plan 2.2 tasks the README read policy and index hints; TC-MEMORY-009 checks both surfaces. |
| F-12 | major | Resolved | AC-15, TC-MEMORY-015, plan 4.5 and lifecycle phase 11 cover PM creating but not merging, owner or CEO merging to `main-tools`, and ticket closure with a delivery summary. |
| F-13 | major | Resolved | AC-12 adds the header scan for newly added `.ai/memory/**` and `.opencode/skills/**` files; TC-MEMORY-011 runs it with a negative control. |
| F-14 | minor | Resolved | Plan Constraints now permit `@coder` to delegate to `@committer` and `@runner`, with inline committer discipline only as a fallback; the ban is gone. |
| F-15 | minor | Resolved | Spec Constraints and Documentation impacts record that this is repo operating documentation, that R11 is a hard boundary, and that phase 7 is a true no-op; plan lifecycle repeats it. |
| F-16 | minor | Resolved | TC-MEMORY-013, plan 4.4, and test plan section 6 require `pnpm install --frozen-lockfile` before Bun runs and record the clean-worktree precondition. |
| F-17 | minor | Resolved | TC-MEMORY-005 scans only non-comment lesson lines with a negative control; TC-MEMORY-006 asserts the five template parts (charter, Lessons, evidence format, advisory label, cap and split pointer). |
| F-18 | minor | Resolved | AC-7 is split into AC-7.1..AC-7.6 with observable oracles; AC-7.5 defines the "not read" evidence as a step log naming only matching `applies_when` records; TC-MEMORY-007 covers all six. |
| F-19 | minor | Resolved | The Constraints wording now says no new runtime or pm-notes machine schema, with memory frontmatter documentation-only until future lint. |
| F-20 | minor | Resolved as corrected | Plan line 36 and pm-notes record the corrected attribution: owner approved a lightweight implementation; the ticket body's waived-lifecycle wording is not an owner instruction to skip phases; the all-phase ledger is a CEO operating requirement. No artifact still claims the owner superseded the lifecycle. Residual note hygiene: see F-24. |
| F-21 | nit | Resolved | Plan 3.1 shortens the skill description to one sentence of at most 20 words, keeps it quoted with a colon-space, and keeps `name` equal to the folder; AC-5 and TC-MEMORY-001 assert the parse. The `.opencode/README.md` 3-10 word guidance says "usually", so no contradiction. |
| F-22 | nit | Resolved | AC-13 now scans the change artifacts (spec, test plan, plan, pm-notes), newly added AGENTS.md lines, and all new `.ai/memory` and `.opencode/skills` files; TC-MEMORY-012 matches. The current artifacts already contain zero em or en dashes. |
| F-23 | nit | Resolved | Phase 2 now lands `.ai/memory/README.md`, the four seeds, and both `.gitkeep` files in one commit, and plan 2.8 verifies every index row resolves inside that commit. Residual forward reference only: see F-29. |

## Findings

1. [minor] decision_capture - `chg-GH-204-pm-notes.yaml` decisions entry "Preflight resolution: the write-own kernel rule..." and notes entry "Attribution correction: an earlier F-20 decision..." (residual of F-2 and F-20; downgraded, non-blocking)
   Gap: The earlier preflight decision still records the incomplete curator set (demote, supersede, move promoted lines, cap splits) and now conflicts on paper with the later F-2 resolution and with R4. The retraction note refers to an earlier F-20 decision that is not present in the file, so a reader cannot verify what was retracted.
   Suggested remediation target phase: specification
   Suggested fix: mark the earlier preflight decision as superseded by the F-2 entry (or replace its text with a pointer), and make the retraction note self-contained or remove it.

2. [minor] system_spec_consistency - `doc/spec/features/feature-agents-and-commands.md` "Edge Cases & Error Handling" bullet "Adding a new tool requires updating the inventory" vs spec R11/AC-1 (new finding)
   Gap: The system spec says adding a new tool requires updating the inventory in `.opencode/README.md` and `AGENTS.md`. This change adds the `consolidate-memory` skill and updates only `.opencode/README.md`, while AC-1 forbids any other AGENTS.md change. `AGENTS.md` "Extending the system" itself says skills require updating `.opencode/README.md`, so the deliverable is defensible, but the artifact set does not record the reconciliation and a phase 7 reviewer could read it as drift.
   Suggested remediation target phase: specification
   Suggested fix: add one sentence to spec Constraints or Documentation impacts: the AGENTS.md inventory covers the agent team and commands, skill inventory lives in `.opencode/README.md`, so R11 is not in conflict and phase 7 stays a no-op. Do not edit `doc/spec`.

3. [minor] plan_coverage - `chg-GH-204-plan.md` Phase 3 task 3.5 and `chg-GH-204-test-plan.md` TC-MEMORY-002 (new finding)
   Gap: `.opencode/README.md` currently has only Layout, Conventions, Agents, and Commands sections. "Add one skills inventory line" and "locate the skills line" do not say that a `## Skills` section must be created, so the coder could add an orphan line and TC-MEMORY-002 could have nothing to locate.
   Suggested remediation target phase: delivery_planning (with a test_planning echo)
   Suggested fix: task 3.5 should say "add a `## Skills` section containing exactly one entry"; the TC-MEMORY-002 oracle should say "exactly one added line in that section, zero agent or command line changed".

4. [nit] test_traceability - `chg-GH-204-test-plan.md` TC-MEMORY-014 vs spec R8 (residual of F-7)
   Gap: R8 requires YAML 1.2 core semantics, but TC-MEMORY-014 validates with PyYAML (YAML 1.1) and hedges "where the parser allows, the values follow YAML 1.2 core semantics". The quoted-scalar assertions still force the intended behavior, but the 1.2 clause itself is not tested.
   Suggested remediation target phase: test_planning
   Suggested fix: parse with the repo `yaml` parser in 1.2 core mode as the pm-notes parser does, or restate the record rule as quoted scalars that parse identically under 1.1 and 1.2 and drop the 1.2 claim.

5. [nit] plan_coverage - `chg-GH-204-plan.md` Phase 2 task 2.6 (new finding)
   Gap: The task says "Keep the first-capture template complete", but `.ai/memory/README.md` currently has no agent entry-point template block (no charter/Lessons/evidence skeleton). The enumerated parts make the intent recoverable, so this is wording only.
   Suggested remediation target phase: delivery_planning
   Suggested fix: reword to "Add the first-capture template with charter, Lessons section, evidence format, advisory label, cap and split pointer".

6. [nit] cross_artifact_consistency - `chg-GH-204-plan.md` Phase 1 vs Phase 2 (residual of F-23)
   Gap: The Phase 1 kernel section points at `.ai/memory/agents/<agent>/README.md` and `.ai/memory/README.md`, which land in Phase 2. The branch is consistent at the end of the PR; only a phase-1 bisect sees dangling references.
   Suggested remediation target phase: delivery_planning
   Suggested fix: accept as intentional for a single-PR docs change, or move seed creation into Phase 1 if per-commit bisectability is required.

7. [nit] spec_completeness - source ticket "Delivery plan" and owner comment vs AC-15/TC-MEMORY-015 (new finding)
   Gap: The ticket asks for completion through a squash merge into `main-tools`; AC-15 and TC-MEMORY-015 check merge base, actor, and closure but not the merge method.
   Suggested remediation target phase: specification (or a test_planning echo)
   Suggested fix: add "squash merge" to the phase 11 lifecycle note and the TC-MEMORY-015 oracle, or record that the repository platform default applies.

## Finding Counts

- Blocker (critical): 0
- Major: 0
- Minor: 3
- Nit: 4
- Total: 7

## Gate Outcome

- All ten DoR facets pass. No pause flag exists and no human input is required at this gate.
- No finding reopens `delivery`. The residual minors and nits are advisory: they can be folded into the next authoring pass for the named phase, but they do not block delivery, and no phase is reopened by this verdict.
- The three iteration 1 blockers (F-1 write exception, F-2 curator operation set, F-3 index granularity) are resolved in the normative artifacts, and the remaining issues are log and task-wording hygiene.

## Reviewer Note

This review was read-only for source and change artifacts. The only file written is this readiness record. The reviewer did not modify `AGENTS.md`, `.ai/memory/**`, `.opencode/**`, `scripts/**`, config, or generated plugin output.
