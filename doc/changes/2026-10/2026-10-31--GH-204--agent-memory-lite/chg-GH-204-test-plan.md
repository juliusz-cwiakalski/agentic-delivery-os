---
id: chg-GH-204-test-plan
status: Updated
created: 2026-10-31T13:00:00Z
last_updated: 2026-10-31
owners: [engineering]
service: repo operating documentation
labels: [change, planning, documentation]
version_impact: minor
summary: "Verify the committed agent memory layer: one AGENTS.md kernel section, the .ai/memory tree with four seeds, and the consolidate-memory skill, using rule-by-rule content assertions, real YAML parses, disposable consolidation dry-runs, existing repository gates, and lifecycle evidence."
links:
  change_spec: ./chg-GH-204-spec.md
  implementation_plan: ./chg-GH-204-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - Agent memory lite: committed learning layer

## 1. Scope and Objectives

Prove the delivered text matches AC-1..AC-15 and the AC-7.1..AC-7.6 sub-criteria: the kernel carries every rule from R1 through R10, the tree and index are complete at record granularity, seeds are honest, the skill and a sample record parse with a real YAML parser, consolidation obeys its limits in a disposable tree including an evidence-over-recency conflict, and no forbidden path, header, or dash appears. Evidence is static content assertions, parser runs, disposable manual dry-runs, existing gates, and PR and ticket state at closure. No runtime code changes, so no new unit or integration tests are added.

### 1.1 In Scope

- Kernel content and a scoped diff proving no hunk outside the section (AC-1).
- Tree shape, index granularity, caps, seed honesty, missing-agent path, template completeness, skill parse and inventory (AC-2..AC-6, NFR-1, NFR-2).
- Consolidation dry-run covering AC-7.1..AC-7.6, curator limits, conflict truth, id uniqueness, and record frontmatter parsing (AC-7..AC-11, NFR-2).
- Forbidden paths plus header scan, dash hygiene, existing gates, and merge and closure evidence (AC-12..AC-15, NFR-3).

### 1.2 Out of Scope and Known Gaps

Memory lint, `ados memory`, compiler, `events.jsonl`, preferences or retro trees (NG-2, NG-3); plugin projection of `.opencode/skills` (deferred); new pm-notes schema fields (NG-5); real consolidation over the committed seeds, since the dry-run uses a disposable copy by design. AC-15 is lifecycle evidence produced after PR creation and is recorded in the execution log, not by a repository test.

## 2. References

- Spec: [chg-GH-204-spec.md](./chg-GH-204-spec.md) (AC-1..AC-15, AC-7.1..AC-7.6, R1..R12); plan: [chg-GH-204-plan.md](./chg-GH-204-plan.md); strategy: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md).
- Readiness record: [readiness-iter-1.md](./readiness-review/readiness-iter-1.md) (resolution source for F-3, F-6, F-7, F-9, F-11, F-13, F-16, F-17, F-22).
- Artifacts: `AGENTS.md` ("Agent memory"), `.ai/memory/README.md`, the four seed READMEs, the skill, `.opencode/README.md`; gates: `tests/behaviour/pm-notes-corpus.test.ts`, `scripts/.tests/test-doc-distribution.sh`, `.github/workflows/ci.yml` (`verify-claude-build`).

## 3. Coverage Overview

### 3.1 Functional Coverage (AC-#)

| AC | Description | TC IDs | Status |
|---|---|---|---|
| AC-1 | Kernel covers R1..R10, no hunk outside the section | TC-MEMORY-003 | Planned |
| AC-2 | Tree shape, one index row per agent folder and per record file | TC-MEMORY-004 | Planned |
| AC-3 | Seeds not fabricated | TC-MEMORY-005 | Planned |
| AC-4 | Missing-agent first-capture path | TC-MEMORY-006 | Planned |
| AC-5 | Skill frontmatter parses | TC-MEMORY-001 | Planned |
| AC-6 | Skill inventoried, no other inventory change | TC-MEMORY-002 | Planned |
| AC-7 | Consolidation dry-run scenarios | TC-MEMORY-007 | Planned |
| AC-7.1 | Dedup merge unions evidence, no paraphrase | TC-MEMORY-007 | Planned |
| AC-7.2 | Evidence-less entry demoted or dropped with reason | TC-MEMORY-007 | Planned |
| AC-7.3 | Stale prune reason names the contradiction | TC-MEMORY-007 | Planned |
| AC-7.4 | Cap split moves content without rewording | TC-MEMORY-007 | Planned |
| AC-7.5 | Index rebuild, read-when hints, only matching records read | TC-MEMORY-007 | Planned |
| AC-7.6 | Clean-tree no-op, hash unchanged | TC-MEMORY-007 | Planned |
| AC-8 | Curator limits hold | TC-MEMORY-008 | Planned |
| AC-9 | No conflict-free claim, evidence over recency | TC-MEMORY-009, TC-MEMORY-007 | Planned |
| AC-10 | Reviewer independence and advisory trust | TC-MEMORY-009 | Planned |
| AC-11 | Ids unique and never reused | TC-MEMORY-010, TC-MEMORY-014 | Planned |
| AC-12 | Forbidden paths unchanged, no added headers | TC-MEMORY-011 | Planned |
| AC-13 | No em or en dashes | TC-MEMORY-012 | Planned |
| AC-14 | Existing gates stay green | TC-MEMORY-013 | Planned |
| AC-15 | Owner or CEO merges, ticket closed, PM does not merge | TC-MEMORY-015 | Planned |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

N/A. No product interface, event, data model, or machine schema is added (NFR-3). The only structured artifacts are skill and record frontmatter, covered by TC-MEMORY-001 and TC-MEMORY-014.

### 3.3 Non-Functional Coverage (NFR-#)

- **NFR-1 caps and NFR-2 determinism:** line counts at or under caps, repeated parse, one-to-one index check at record granularity (TC-MEMORY-001, TC-MEMORY-004, TC-MEMORY-014).
- **NFR-3 no runtime behavior:** diff path and content review (TC-MEMORY-011).

## 4. Test Types and Layers

- **Static/diff and content:** `git diff --check`, path and scoped-hunk assertions, scoped grep with paired negative controls (TC-MEMORY-002, 003, 005, 009, 011, 012).
- **Parser:** PyYAML `safe_load` on skill frontmatter and on a sample promoted record (TC-MEMORY-001, TC-MEMORY-014).
- **Disposable manual dry-run:** synthetic `.ai/memory` copy outside the repo, no new scripts (TC-MEMORY-006, 007, 008, 010).
- **Existing gates:** corpus lint, doc distribution, plugin drift (TC-MEMORY-013). No new `bun test` suites and no runtime unit tests are added.
- **Lifecycle evidence:** PR state, merge actor, and ticket closure (TC-MEMORY-015).

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Automation | Priority | AC |
|---|---|---|---|---|---|
| TC-MEMORY-001 | Skill frontmatter parses with a real YAML parser | Parser | Manual command | High | AC-5, NFR-2 |
| TC-MEMORY-002 | Skill inventoried, no other inventory line changed | Content | Manual command | High | AC-6 |
| TC-MEMORY-003 | Kernel covers R1..R10 rule by rule with a scoped diff | Content | Manual command | Critical | AC-1 |
| TC-MEMORY-004 | Tree shape, index granularity, and caps | Content | Manual command | Critical | AC-2, NFR-1, NFR-2 |
| TC-MEMORY-005 | Seed READMEs are not fabricated | Content | Manual command | High | AC-3 |
| TC-MEMORY-006 | Missing-agent first-capture path and template completeness | Dry-run | Manual | High | AC-4 |
| TC-MEMORY-007 | Consolidation dry-run AC-7.1..7.6 plus conflict scenario | Dry-run | Manual | Critical | AC-7, AC-7.1..AC-7.6, AC-9 |
| TC-MEMORY-008 | Curator limits hold in a negative dry-run | Dry-run | Manual | High | AC-8 |
| TC-MEMORY-009 | Conflict truth and reviewer independence text | Content | Manual command | High | AC-9, AC-10 |
| TC-MEMORY-010 | Ids unique across lessons and tacit, never reused | Dry-run | Manual | High | AC-11 |
| TC-MEMORY-011 | Forbidden paths unchanged and no added headers | Diff | Manual command | Critical | AC-12 |
| TC-MEMORY-012 | No em or en dashes in artifacts and new files | Unicode | Manual command | High | AC-13 |
| TC-MEMORY-013 | Existing gates stay green with root deps installed | Gate | Manual command | Critical | AC-14 |
| TC-MEMORY-014 | Promoted record frontmatter parses under YAML 1.2 core | Parser | Manual command | High | AC-11, NFR-2 |
| TC-MEMORY-015 | Merge and closure lifecycle evidence | Lifecycle | Manual | Medium | AC-15 |

### 5.2 Scenario Details

#### TC-MEMORY-001 - Skill frontmatter parses with a real YAML parser (AC-5, NFR-2; Parser; manual command; target: SKILL.md)
- **Fixture and steps**: `.opencode/skills/consolidate-memory/SKILL.md`; extract the first `---` block, `yaml.safe_load` it, read `name` and `description`, inspect the raw `description:` line.
- **Oracle**: parse succeeds; `name == "consolidate-memory"`; `description` is a quoted string containing `": "`. **Non-vacuity**: a temp copy with unquoted `description: Use when: x` raises a scanner error or yields a mapping.

#### TC-MEMORY-002 - Skill inventoried, no other inventory line changed (AC-6; Content; manual command; target: .opencode/README.md)
- **Fixture and steps**: `.opencode/README.md`; locate the skills line, confirm `consolidate-memory` at `.opencode/skills/consolidate-memory/SKILL.md`, then diff the Agents and Commands sections against base `9a70aaf`.
- **Oracle**: exactly one added skills line; zero changed agent or command line. **Non-vacuity**: removing the line from a temp copy fails the same grep.

#### TC-MEMORY-003 - Kernel covers R1..R10 rule by rule with a scoped diff (AC-1; Content; manual command; target: AGENTS.md)
- **Fixture and steps**: `AGENTS.md`; locate the single `## Agent memory` section; assert one checklist item per rule: R1 exactly one section and no other change; R2 own `agents/<agent>/README.md` always read plus just-in-time index and topic files; R3 five capture triggers, the two-occurrence plus likely-recurrence rule, the routine-success exclusion, evidence links, and the secrets exclusion; R4 own-folder ownership plus the cross-folder curator exception; R5 advisory untrusted data and evidence over recency; R6 the three reviewer roles and the coder-reasoning bar; R7 tree and seeding plus the first-capture self-index-row exception; R8 record format, quoted strings, monotonic ids, and `supersedes` scan; R9 promotion handoff to `@doc-syncer` and `@decision-advisor`; R10 no conflict-free claim.
- **Oracle**: every checklist item is present inside that section; `git diff -U0 9a70aaf -- AGENTS.md` yields one added hunk only, inside the section. **Non-vacuity**: deleting one rule fails its assertion; the diff assertion is inherently scoped.

#### TC-MEMORY-004 - Tree shape, index granularity, and caps (AC-2, NFR-1, NFR-2; Content; manual command; target: .ai/memory)
- **Fixture and steps**: committed tree; list `agents/*/README.md`, both `.gitkeep` files, and every record file under `lessons/` and `tacit/`; extract Index rows; count lines in seeds, index, and skill.
- **Oracle**: four agent folders and no fifth; README, four seeds, and both `.gitkeep` files exist; exactly one index row per agent folder and exactly one row per promoted record file, each with a read-when hint and an existing path; zero directory-level rows for `lessons/` or `tacit/`; counts derive from record files, not directories; seeds at or under 150 lines, index 200, skill 150. **Non-vacuity**: an extra record file without a row, or a `lessons/` directory row, fails the coverage count.

#### TC-MEMORY-005 - Seed READMEs are not fabricated (AC-3; Content; manual command; target: four seed READMEs)
- **Fixture and steps**: the four seed READMEs; scan only non-comment lesson lines, ignoring `<!-- ... -->` template comments, for dated entries and evidence tokens (`PR #`, `CI run`, `review`, ISO dates).
- **Oracle**: charter and instructions only; zero dated lesson lines and zero invented evidence outside comments. **Non-vacuity**: an added non-comment `- 2026-01-01: lesson (evidence: PR #1)` line fails.

#### TC-MEMORY-006 - Missing-agent first-capture path and template completeness (AC-4; Dry-run; manual; target: disposable tree)
- **Fixture and steps**: `$(mktemp -d)` outside the repo with a copy of `.ai/memory`; inspect the README template for a charter, a Lessons section, the evidence format, the cap and split pointer, and the advisory label; create `agents/<agent>/README.md` from the template; append exactly one index row with a read-when hint; diff the tree.
- **Oracle**: the template contains all five required parts; creation uses only the template and one index row; no other folder or file changes and no later index row is edited. **Non-vacuity**: omitting the index row fails the coverage check; omitting a template part fails the completeness check.

#### TC-MEMORY-007 - Consolidation dry-run AC-7.1..7.6 plus conflict scenario (AC-7, AC-7.1..AC-7.6, AC-9; Dry-run; manual; target: disposable tree)
- **Fixture and steps**: synthetic tree with duplicates, an evidence-less entry, a stale contradiction, a README over 150 lines, a stale index line, a matching `applies_when` record, a clean copy, and a newer unsupported claim against an older evidence-backed claim; walk the SKILL steps by hand; hash the real seeds before and after.
- **Oracle**: 7.1 merge unions evidence and preserves statement substance without paraphrase; 7.2 evidence-less entry demoted or dropped with a reason; 7.3 prune reason names the contradiction; 7.4 cap split moves content without rewording; 7.5 rebuilt index has read-when hints and the step log names only matching `applies_when` records, proving unrelated records were not read; 7.6 clean copy is a no-op with unchanged hash; the conflict scenario keeps the evidence-backed claim, and recency alone does not decide; every cross-folder edit is reported; seed hash unchanged. **Non-vacuity**: the clean copy must be a no-op, proving the scenarios are not trivially fixed.

#### TC-MEMORY-008 - Curator limits hold in a negative dry-run (AC-8; Dry-run; manual; target: disposable tree)
- **Fixture and steps**: disposable tree; request a reword of another agent's lesson, an edit of a fact or decision record, and a policy change; capture the report and diff the target.
- **Oracle**: each request refused or handed off to `@doc-syncer`, `@decision-advisor`, or the owner, handoff reported, target unchanged; a permitted merge may concatenate or union evidence but not reword. **Non-vacuity**: a permitted demotion in the same tree succeeds, proving the refusal is scoped.

#### TC-MEMORY-009 - Conflict truth and reviewer independence text (AC-9, AC-10; Content; manual command; target: AGENTS.md, .ai/memory/README.md)
- **Fixture and steps**: kernel, `.ai/memory/README.md`, skill; search for conflict-free wording, evidence and current-truth resolution, the exact three reviewer roles, the coder-reasoning bar, and advisory untrusted-data wording; review the TC-MEMORY-007 conflict scenario as the scenario evidence.
- **Oracle**: zero conflict-free claims in kernel and README; resolution names evidence and current repo or spec truth, not recency alone; both kernel and README name `reviewer`, `readiness-reviewer`, and `decision-critic`, bar coder reasoning and another agent's episodic memory, and label memory advisory untrusted data that cannot override instructions, repo rules, code, or spec. **Non-vacuity**: a temp copy claiming conflict-free memory fails.

#### TC-MEMORY-010 - Ids unique across lessons and tacit, never reused (AC-11; Dry-run; manual; target: disposable tree)
- **Fixture and steps**: disposable records plus a duplicate-id fixture and a reused pruned superseded id; scan all `id` and `supersedes` values; run validation; add a record with the monotonic next free id per prefix and year.
- **Oracle**: zero duplicates across both directories; duplicate or reused id rejected, never silently reallocated; allocation is the next free id per prefix and year; a replacement links `supersedes` and the old status becomes `superseded`. **Non-vacuity**: a valid unique fixture passes, proving the check is not always rejecting.

#### TC-MEMORY-011 - Forbidden paths unchanged and no added headers (AC-12; Diff; manual command; target: delivered diff)
- **Fixture and steps**: base `git merge-base origin/main-tools HEAD` (`9a70aaf`); `git diff --name-only` the base, filter forbidden prefixes, list modified existing files; scan newly added files under `.ai/memory/**` and `.opencode/skills/**` for copyright or `source:` header lines.
- **Oracle**: zero paths under `.opencode/agent`, `.opencode/command`, runtime config, security policy, `scripts`, CI, `.ados-claude`, `doc/guides`, `doc/spec`; modified existing files limited to `AGENTS.md` and `.opencode/README.md`; zero copyright or source header line in new memory or skill files. **Non-vacuity**: a scratch file under `scripts/` appears in the filtered list; an injected `# Copyright` line is reported.

#### TC-MEMORY-012 - No em or en dashes in artifacts and new files (AC-13; Unicode; manual command; target: change artifacts plus new files)
- **Fixture and steps**: change artifacts (spec, test plan, plan, pm-notes), newly added AGENTS.md lines, and all new files under `.ai/memory` and `.opencode/skills`; `grep -nP '[\x{2013}\x{2014}]'` on new files and on `git diff -U0` added lines.
- **Oracle**: zero matches in the listed artifacts and added lines. **Non-vacuity**: a fixture line with a literal em dash is reported.

#### TC-MEMORY-013 - Existing gates stay green with root deps installed (AC-14; Gate; manual command; target: repo)
- **Fixture and steps**: install root dependencies with `pnpm install --frozen-lockfile` before any Bun run; run `bun test tests/behaviour/pm-notes-corpus.test.ts`, `bash scripts/.tests/test-doc-distribution.sh`, `./scripts/build-claude-plugin.sh --verbose` then stage `.ados-claude/` and `git diff --cached --exit-code .ados-claude/`, and `git diff --check`.
- **Oracle**: install succeeds first; corpus passes with GH-204 among the members; distribution guard prints OK with no new exclusion; drift exits 0 with no regenerated output; `git diff --check` is clean. **Non-vacuity**: a malformed GH-204 pm-notes copy in a temp corpus fails.

#### TC-MEMORY-014 - Promoted record frontmatter parses under YAML 1.2 core (AC-11, NFR-2; Parser; manual command; target: sample record)
- **Fixture and steps**: build a sample promoted record with a colon-space in `statement` and `applies_when` and a quoted `created` string; parse it with PyYAML `safe_load`; parse the README record template after quoting.
- **Oracle**: parse succeeds; `statement` and `applies_when` retain the colon-space text as strings; `created` stays a string, not a date scalar; where the parser allows, the values follow YAML 1.2 core semantics. **Non-vacuity**: an unquoted colon-space sample fails with a scanner error.

#### TC-MEMORY-015 - Merge and closure lifecycle evidence (AC-15; Lifecycle; manual; target: PR and tracker)
- **Fixture and steps**: open PR on base `main-tools` and the ticket state; inspect the merge actor and the closure comment.
- **Oracle**: PM created the PR and did not merge; the owner or CEO merged to `main-tools`; the ticket is closed with a delivery summary. **Non-vacuity**: a PR created and merged by PM fails the actor assertion. Evidence is captured at phase 11 and pasted into the execution log.

## 6. Environments and Test Data

Local worktree with `python3` plus PyYAML. Root dependencies must be installed with `pnpm install --frozen-lockfile` before the Bun corpus test; a clean worktree has no root `node_modules` and the test cannot find the `yaml` package without it, so the install is a recorded local requirement. Dry-runs use `mktemp -d` outside the repo; the committed seeds are read-only and hashed before and after. No fixtures are committed and no new scripts are created. Cleanup removes the temp root and confirms the real seed hash. AC-15 reads PR and tracker state through the configured platform.

## 7. Automation Plan and Implementation Mapping

| TC | Where | Mode | Status |
|---|---|---|---|
| 001, 002, 003, 004, 005, 009, 011, 012, 014 | in place | grep/diff/python one-liners recorded in the execution log | Manual only |
| 006, 007, 008, 010 | disposable temp tree | manual SKILL walkthrough, step log and report excerpt in the execution log | Manual only |
| 013 | repo | install, corpus test, distribution guard, plugin drift, `git diff --check` | Existing gates |
| 015 | PR and tracker | PR state, merge actor, and closure comment at phase 11 | Manual only |

No test file is created. Dry-run evidence is the step log, the report excerpt, and the seed hash before and after.

## 8. Risks, Assumptions, and Open Questions

- **Risk**: content greps may match a mention without the rule (paired non-vacuity controls); the manual dry-run may drift from the skill steps (walk the SKILL steps in order).
- **Assumption**: PyYAML is available; root dependencies are installable; GH-204 is inside the corpus boundary and has a valid pm-notes file.
- **Open question** (non-blocking): whether generated plugins should project `.opencode/skills`.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1 | 2026-10-31 | test-plan-writer | Initial plan for AC-1..AC-14. |
| 1.1 | 2026-10-31 | test-plan-writer | Resolved readiness iteration 1 findings F-3, F-6, F-7, F-9, F-11, F-13, F-16, F-17, F-22; added AC-7.1..AC-7.6 and AC-15 traceability plus TC-MEMORY-014 and TC-MEMORY-015. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|---|---|---|---|
| 001..015 | - | Not run | Populated at delivery; AC-15 evidence added at phase 11. |
