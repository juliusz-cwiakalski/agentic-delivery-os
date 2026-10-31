# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-204
Date: 2026-10-31
Pause Required: no

## Facet Summary

- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Gate Context

- Artifacts read: `chg-GH-204-spec.md`, `chg-GH-204-test-plan.md`, `chg-GH-204-plan.md`, `chg-GH-204-pm-notes.yaml`.
- Source ticket: GitHub issue 204 (owner `juliusz-cwiakalski`, repo `agentic-delivery-os`), body plus both owner comments.
- Repo contracts checked: `doc/spec/**` (notably `feature-agents-and-commands.md`, `feature-claude-plugin-generation.md`, `feature-delivery-lifecycle.md`), `packages/core/src/contracts/pm-notes.ts`, `tests/behaviour/pm-notes-corpus.test.ts`, `scripts/build-claude-plugin.sh`, `scripts/.tests/test-doc-distribution.sh`, `.ai/rules/testing-strategy.md`, `.opencode/README.md`, `.opencode/agent/doc-syncer.md`.
- Existing drafts inspected as the delivery baseline: `AGENTS.md` (modified), `.ai/memory/**` (untracked), `.opencode/skills/consolidate-memory/SKILL.md` (untracked).
- Baseline consistency: `9a70aaf` equals `origin/main-tools` and the merge base of the branch, so TC-MEMORY-003 and TC-MEMORY-011 use the same baseline.
- Prior readiness records: none. This is iteration 1.
- Gate checks run: pm-notes YAML parsed successfully with PyYAML (`variant: full`, 11 phases, required keys present); skill frontmatter currently fails PyYAML (`ScannerError` at the colon-space in the unquoted description, matching the known draft defect); doc-distribution guard passes (81 in-scope docs, no drift); plugin build script reads only `.opencode/agent` and `.opencode/command`, so the new `.opencode/skills` file does not create `.ados-claude` drift; `bun test tests/behaviour/pm-notes-corpus.test.ts` currently cannot start in this worktree because root dependencies are not installed (`yaml` package missing), which is an environment precondition, not an artifact defect.

## Ticket Acceptance Criteria Mapping

| Ticket AC | Spec AC / TC | Result |
|---|---|---|
| AGENTS.md contains the approved kernel section; no other AGENTS.md changes | AC-1 / TC-MEMORY-003 | Partial: TC-003 checks only seven phrases, not R1-R10; R7/R8 are not asserted. See F-6, F-10. |
| `.ai/memory/README.md` exists with index and conventions | AC-2 / TC-MEMORY-004 | Partial: index granularity is contradictory (per record vs per directory). See F-3. |
| Entry points seeded for ceo, pm, coder, fixer; template-only, no fabricated lessons | AC-2, AC-3 / TC-MEMORY-004, TC-MEMORY-005 | Covered, with a false-positive risk in TC-005. See F-17. |
| Skill exists at `.opencode/skills/consolidate-memory/SKILL.md`; name matches folder; description present; under about 150 lines | AC-5, AC-6 / TC-MEMORY-001, TC-MEMORY-002, TC-MEMORY-004 | Covered for parse/inventory/cap; draft currently fails parse and is scheduled for repair. See F-21. |
| `.opencode/README.md` lists the skill | AC-6 / TC-MEMORY-002 | Covered. |
| No changes to `.opencode/agent/**`, `.opencode/command/**`, `doc/guides/**`, `scripts/**`, CI, or plugin build; no manually added license headers | AC-12 / TC-MEMORY-011 | Path part covered; license-header part is not mapped to an AC or TC. See F-13. |
| PR merged to `main-tools`; ticket closed with delivery summary | none | Not traced to a spec AC, TC, or plan lifecycle step. See F-12. |

## Findings

1. [critical] cross_artifact_consistency - `chg-GH-204-spec.md` R4, R7, R10; AC-4; `chg-GH-204-test-plan.md` TC-MEMORY-006.
   Gap: R4 says `consolidate-memory` is the only cross-folder writer; R10 says the index is consolidation-only; R7 and AC-4/TC-006 require a non-seeded agent to add its own index line on first capture. The README draft also says "Write only inside your own folder" and does not carve out the index. These rules cannot both hold.
   Suggested remediation target phase: specification (then test_planning, delivery_planning).
   Suggested fix: choose one contract and encode it everywhere: either allow a narrow self-scoped index-line exception in R4/R10 and state it in the kernel and README, or make consolidation add the index line and change R7/AC-4/TC-006 to a pending-note plus consolidation step.

2. [critical] cross_artifact_consistency - `chg-GH-204-spec.md` R4 vs R9 and AC-7; `.opencode/skills/consolidate-memory/SKILL.md` "Hard rules".
   Gap: R4's "may only demote, mark supersession, move promoted lines, and split" excludes dedup/merge and stale prune, yet R9 and AC-7 require both; AC-7 also requires dropping evidence-less entries. The skill "Hard rules" omits cap splits and prune while its steps 2, 3, 4, and 6 require them. "Must not reword" is undefined against dedup merging.
   Suggested remediation target phase: specification (then delivery_planning, test_planning).
   Suggested fix: enumerate the complete permitted cross-folder operation set (mechanical dedup/merge that preserves evidence, demote or drop evidence-less entries, mark supersession, prune stale with a recorded reason, move promoted lines, split an over-cap folder) and define "no substantive rewording"; align the skill hard rule to the same list; add AC-8/TC-008 cases for each operation.

3. [critical] cross_artifact_consistency - `chg-GH-204-spec.md` AC-2 and NFR-2 vs `chg-GH-204-plan.md` Phase 1 (tasks 1.2 and Verify) and `chg-GH-204-test-plan.md` TC-MEMORY-004.
   Gap: The spec says one index line per seeded folder and per record (record means a record file under `lessons/` or `tacit/` per R8). The plan says "one-row-per-folder" and "seeded folders plus record directories"; TC-004 says "per folder and record folder". The draft index lists only directory rows. Delivery cannot satisfy AC-2/NFR-2 and the plan/TC oracle at the same time.
   Suggested remediation target phase: test_planning, delivery_planning (the spec matches the ticket's "one line per record").
   Suggested fix: pin index granularity. Prefer one row per record file plus one row per agent folder; remove or relabel the directory-level rows; update TC-004 and the plan verification to count record files, not directories.

4. [major] cross_artifact_consistency - `chg-GH-204-spec.md` R5 and AC-9 vs `AGENTS.md` "Supersede, never rewrite" and `SKILL.md` step 3; `chg-GH-204-plan.md` tasks 1.1 and 3.2.
   Gap: The spec requires evidence and current repo or spec truth, never recency alone. The kernel draft says "a newer entry replaces an old one's authority"; the skill says "keep the newer as authority". Plan 1.1 adds R5 but does not task rewriting the kernel bullet; plan 3.2 fixes only the skill. The delivered kernel will still carry a recency rule.
   Suggested remediation target phase: delivery_planning (then test_planning).
   Suggested fix: rewrite the kernel and skill conflict rule to evidence-first (newer is a candidate, not authority); add a TC scenario with a newer unsupported claim against an older evidence-backed claim.

5. [major] cross_artifact_consistency - `chg-GH-204-spec.md` R9 vs `SKILL.md` step 5; `chg-GH-204-plan.md` task 3.2.
   Gap: R9 requires facts and decisions to be handed to `@doc-syncer` (`doc/spec`) and `@decision-advisor` (`doc/decisions`). The skill step 5 promotes directly to `doc/spec` and `doc/decisions`. Plan 3.2 says to "confirm" the handoff rather than to replace direct promotion with a handoff proposal.
   Suggested remediation target phase: delivery_planning (then test_planning).
   Suggested fix: task the skill rewrite to emit a handoff proposal naming the owning agent, and never write `doc/spec` or `doc/decisions`; add TC-008/TC-007 assertions for the owning agent and for an unchanged target.

6. [major] test_traceability - `chg-GH-204-test-plan.md` TC-MEMORY-003 vs `chg-GH-204-spec.md` AC-1 and R1-R10.
   Gap: AC-1 requires every R1-R10 rule in the single section. TC-003 checks only seven phrases and omits R2 read policy, R3 two-occurrence/recurrence, R7 tree and seeding, R8 record format, and R9 promotion. It also does not assert R1's "no other AGENTS.md change" beyond the scoped diff.
   Suggested remediation target phase: test_planning (and specification if R1 is narrowed).
   Suggested fix: expand TC-003 into a rule-by-rule checklist, or narrow R1/AC-1 to the rules that must live in the kernel and point to `.ai/memory/README.md` for the rest.

7. [major] test_traceability - `.ai/memory/README.md` "Promoted record format"; `chg-GH-204-test-plan.md` TC-MEMORY-001, TC-MEMORY-007, TC-MEMORY-010.
   Gap: The memory record frontmatter is YAML, but only the skill frontmatter is parsed. The template leaves `statement`, `applies_when`, and `created` unquoted; a colon-space in `statement` or `applies_when` breaks PyYAML, and `created` is parsed as a date under YAML 1.1. No TC validates a real record.
   Suggested remediation target phase: test_planning (and specification for the quoting/dialect rule).
   Suggested fix: define quoting and dialect in R8/README (quote `statement`, `applies_when`, and `created`, or use block scalars); add a parser test on a sample record with a colon-space and a date; make TC-007 and TC-010 create and parse records.

8. [major] ac_quality - `chg-GH-204-spec.md` AC-11 and R8; `chg-GH-204-test-plan.md` TC-MEMORY-010.
   Gap: AC-11 allows "rejected or assigned a new unused id", which is two different behaviors; TC-010 mirrors "rejected or reallocated". No id allocation rule exists. Scanning current `id` values cannot detect reuse of a superseded id after the record is pruned.
   Suggested remediation target phase: specification (then test_planning).
   Suggested fix: pin allocation (for example, a monotonic next free id per prefix and duplicate rejection), require scanning both `id` and `supersedes`, and test a pruned superseded id plus a new record that attempts reuse.

9. [major] test_traceability - `chg-GH-204-spec.md` AC-9; `chg-GH-204-test-plan.md` TC-MEMORY-009.
   Gap: AC-9 explicitly requires a content assertion plus a scenario review. TC-009 is only a content search; there is no scenario where a newer entry conflicts with an older evidence-backed entry and evidence wins.
   Suggested remediation target phase: test_planning.
   Suggested fix: add a conflict scenario to TC-007/TC-009 with a newer unsupported claim and an older evidence-backed claim; assert the evidence-backed claim survives and that recency alone does not decide.

10. [major] plan_coverage - `chg-GH-204-spec.md` R3; `AGENTS.md` new "Agent memory" capture bar; `chg-GH-204-plan.md` task 1.1; `chg-GH-204-test-plan.md` TC-MEMORY-003.
   Gap: R3 requires a repeated workflow with at least two occurrences and a likely recurrence, and says routine success is not memory. The kernel draft says only "a workflow that succeeded repeatedly"; plan 1.1 says "keep R2, R3"; TC-003 greps only "capture bar". The preflight capture-bar resolution is not fully encoded or tested.
   Suggested remediation target phase: delivery_planning (then test_planning).
   Suggested fix: task the kernel rewrite to include the two-occurrence plus likely-recurrence rule and the explicit routine-success exclusion; add those phrases to TC-003.

11. [major] plan_coverage - `chg-GH-204-spec.md` AC-10 and R6; `.ai/memory/README.md` "Capturing" step 3 and Index read-when hints; `chg-GH-204-plan.md` task 1.2.
   Gap: AC-10 requires reviewer independence in the kernel and the README. The README says "Read anyone's folder for context" and its index invites reading "coordinator/curator context"; plan 1.2 does not task adding the reviewer exclusion to the README. This contradicts R6 for `reviewer`, `readiness-reviewer`, and `decision-critic`.
   Suggested remediation target phase: delivery_planning (then test_planning).
   Suggested fix: add the reviewer exclusion to the README read policy and index hints; make TC-009 check both the kernel and the README for the exact three roles and the coder-reasoning bar.

12. [major] spec_completeness - source ticket AC "PR merged to main-tools; ticket closed with delivery summary" vs `chg-GH-204-spec.md` AC-1..AC-14 and `chg-GH-204-plan.md` "Lifecycle Mapping".
   Gap: No spec AC or TC covers merge and closure; plan phase 11 says PM does not merge and stops at PR creation. The ticket's final acceptance criterion is untraced.
   Suggested remediation target phase: specification (then delivery_planning).
   Suggested fix: add a DoD or closure criterion (owner or CEO merges to `main-tools`; PM closes the ticket with the delivery summary) and map it in the plan lifecycle; state explicitly that PM does not merge.

13. [major] spec_completeness - source ticket AC "no manually added license headers"; `chg-GH-204-spec.md` Constraints; `chg-GH-204-test-plan.md` AC-12/TC-MEMORY-011.
   Gap: The constraint is stated but has no AC or TC. The AC-12 path filters do not detect a header added to a new file under `.ai/memory` or `.opencode/skills`; those paths are not in the header-required set, but the prohibition is explicit.
   Suggested remediation target phase: test_planning (and specification if an AC is added).
   Suggested fix: add a header scan for new files (reject the copyright and source header lines) or add an explicit AC-12 clause with a TC step.

14. [minor] system_spec_consistency - `chg-GH-204-plan.md` "Constraints" ("no nested subagent dispatch") vs `AGENTS.md` coder role ("delegates to `@designer`, `@decision-advisor`, `@committer`, `@runner`").
   Gap: The plan constraint conflicts with the coder role and is not recorded as a change decision; it can prevent `@coder` from delegating commits and command runs as the role requires.
   Suggested remediation target phase: delivery_planning.
   Suggested fix: scope the constraint to PM-level dispatch or record an explicit exception; otherwise let `@coder` delegate per `AGENTS.md`.

15. [minor] system_spec_consistency - `chg-GH-204-plan.md` "Lifecycle Mapping" phase 7 ("expected no-op; R11 forbids doc/spec edits") vs `.opencode/agent/doc-syncer.md` feature-spec coverage.
   Gap: The intake determination that this is repo-internal operating documentation and warrants no feature spec is only in a pm-notes note, not in a spec decision. If `@doc-syncer` judges the new skill or the AGENTS.md memory section a new feature area, phase 7 and R11 conflict.
   Suggested remediation target phase: specification (or delivery_planning).
   Suggested fix: record the spec-coverage determination in the spec/pm-notes and define the resolution (no feature spec because this is repo operating documentation; R11 is a hard boundary), so phase 7 is a true no-op.

16. [minor] test_traceability - `chg-GH-204-test-plan.md` TC-MEMORY-013 and section 6.
   Gap: `bun test tests/behaviour/pm-notes-corpus.test.ts` cannot run in a clean worktree without `pnpm install --frozen-lockfile`; the current worktree has no root `node_modules` and the test fails to find `yaml`. The test plan assumes PyYAML only, and plan task 4.2 does not list the dependency install.
   Suggested remediation target phase: test_planning, delivery_planning.
   Suggested fix: add `pnpm install --frozen-lockfile` (or an explicit precondition) to the gate run and record the local environment requirement.

17. [minor] test_traceability - `chg-GH-204-test-plan.md` TC-MEMORY-005 and TC-MEMORY-006.
   Gap: TC-005 uses broad tokens (`review`, `PR #`, `CI run`) that also appear in the seed template comments, so it can produce false positives. TC-006 checks that creation uses the template but does not assert that the template contains the required sections (charter, Lessons, evidence format, cap and split pointer).
   Suggested remediation target phase: test_planning.
   Suggested fix: scope TC-005 to non-comment lesson lines; add template completeness assertions to TC-006.

18. [minor] ac_quality - `chg-GH-204-spec.md` AC-7.
   Gap: AC-7 bundles eight behaviors (dedup, demote/drop, prune, split, index rebuild, just-in-time loading, no-op, report) into one AC. "Avoids loading unrelated records" is not directly observable in a manual dry-run.
   Suggested remediation target phase: specification.
   Suggested fix: split AC-7 into atomic ACs or define the evidence for "not read" (for example, a step log that names only the matching `applies_when` records).

19. [minor] spec_completeness - `chg-GH-204-spec.md` Constraints ("this change introduces no new machine schema") vs R8 and the README record frontmatter.
   Gap: R8 and the README define a new record schema for future lint, while the constraint says no new machine schema. The wording is ambiguous and reads as a contradiction.
   Suggested remediation target phase: specification.
   Suggested fix: reword to "no new runtime or pm-notes machine schema; the memory record frontmatter is documentation-only until future lint".

20. [minor] decision_capture - `chg-GH-204-pm-notes.yaml` `decisions`; source ticket "Delivery plan (lite: owner waived the full 11-phase lifecycle)".
   Gap: The artifacts run the full 11 phases (`variant: full`), but no decision records that the owner superseded the ticket's "waived" statement. A reader sees a ticket/artifact contradiction.
   Suggested remediation target phase: specification (or a pm-notes update).
   Suggested fix: add a dated decision in pm-notes recording the owner's full-lifecycle instruction and the ticket-body supersession.

21. [nit] cross_artifact_consistency - `.opencode/README.md` "Descriptions: frontmatter `description` stays short (usually 3-10 words)" vs `.opencode/skills/consolidate-memory/SKILL.md` description.
   Gap: The draft description is multi-sentence and about 45 words. The spec and TC-001 check parsing and quoting but not the short-description convention.
   Suggested remediation target phase: delivery_planning.
   Suggested fix: shorten the description or record an exception for skill trigger text; note the exception in TC-001 if the convention is waived.

22. [nit] test_traceability - `chg-GH-204-spec.md` R12 vs AC-13.
   Gap: R12 says newly authored artifacts (including spec, test plan, plan, and pm-notes) contain no em or en dash. AC-13 scopes the scan to AGENTS.md added lines and new files under `.ai/memory` and `.opencode/skills`. TC-012 covers the broader list, but the AC is narrower.
   Suggested remediation target phase: specification.
   Suggested fix: align AC-13 with R12 (include the change artifacts) or narrow R12's wording.

23. [nit] plan_coverage - `chg-GH-204-plan.md` Phase 1 vs Phase 2 commit order.
   Gap: Phase 1 commits `.ai/memory/README.md` with index rows that point at seed READMEs not committed until Phase 2. The Phase 1 commit is internally dangling even though the branch is consistent at the end.
   Suggested remediation target phase: delivery_planning.
   Suggested fix: reorder the seeds before the index commit or include the seed files in Phase 1 so each phase commit is self-consistent.

## Finding Counts

- Blocker (critical): 3
- Major: 10
- Minor: 7
- Nit: 3
- Total: 23

## Blocking Findings and Reopened Phases

- F-1 (critical): `specification`
- F-2 (critical): `specification`
- F-3 (critical): `test_planning`, `delivery_planning`
- F-4 through F-13 (major): require artifact revision before a READY re-run; phases by finding: F-4 `delivery_planning`; F-5 `delivery_planning`; F-6 `test_planning`; F-7 `test_planning`; F-8 `specification`; F-9 `test_planning`; F-10 `delivery_planning`; F-11 `delivery_planning`; F-12 `specification`; F-13 `test_planning`.

No finding reopens `delivery`. No human input is required at this gate; all surfaced decisions are change-scoped and can be resolved by the author agents with the PM. The two system-level candidates (nested subagent dispatch and the phase 7 spec-coverage determination) are recorded as minor findings and can be captured in change docs; neither is precedent-setting enough to require a `doc/decisions/**` record at this gate.

## Reviewer Note

This review was read-only for source and change artifacts. The only file written is this readiness record. The reviewer did not modify `AGENTS.md`, `.ai/memory/**`, `.opencode/**`, `scripts/**`, config, or generated plugin output.
