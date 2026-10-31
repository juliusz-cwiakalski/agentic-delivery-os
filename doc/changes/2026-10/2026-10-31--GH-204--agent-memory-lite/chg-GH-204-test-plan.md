---
id: chg-GH-204-test-plan
status: Proposed
created: 2026-10-31T13:00:00Z
last_updated: 2026-10-31T13:15:00Z
owners: [engineering]
service: repo operating documentation
labels: [change, planning, documentation]
version_impact: minor
summary: "Verify the committed agent memory layer: one AGENTS.md kernel section, the .ai/memory tree with four seeds, and the consolidate-memory skill, using static content assertions, a real YAML parser, a disposable consolidation dry-run, and existing repository gates."
links:
  change_spec: ./chg-GH-204-spec.md
  implementation_plan: ./chg-GH-204-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - Agent memory lite: committed learning layer

## 1. Scope and Objectives

Prove the delivered text matches AC-1..AC-14: the kernel carries every rule, the tree and index are complete, seeds are honest, the skill frontmatter parses, consolidation obeys its limits in a disposable tree, and no forbidden path changes. Evidence is static content assertions, one real YAML parse, one disposable manual dry-run, and existing gates. No runtime code changes, so no new unit or integration tests are added.

### 1.1 In Scope

- Kernel content plus a scoped diff proving no hunk outside the section (AC-1).
- Tree shape, index coverage, caps, seed honesty, missing-agent path, skill parse and inventory (AC-2..AC-6, NFR-1, NFR-2).
- Consolidation dry-run, curator limits, conflict truth, id uniqueness (AC-7..AC-11).
- Forbidden paths, dash hygiene, existing gates (AC-12..AC-14).

### 1.2 Out of Scope and Known Gaps

- Memory lint, `ados memory`, compiler, `events.jsonl`, preferences or retro trees (NG-2, NG-3); plugin projection of `.opencode/skills` (deferred); new pm-notes schema fields (NG-5); real consolidation over the committed seeds, since the dry-run uses a disposable copy by design.

## 2. References

- Spec: [chg-GH-204-spec.md](./chg-GH-204-spec.md) (AC-1..AC-14, R1..R12); strategy: [.ai/rules/testing-strategy.md](../../../../.ai/rules/testing-strategy.md).
- Artifacts: `AGENTS.md` ("Agent memory"), `.ai/memory/README.md`, the four seed READMEs, the skill, `.opencode/README.md`; gates: `tests/behaviour/pm-notes-corpus.test.ts`, `scripts/.tests/test-doc-distribution.sh`, `.github/workflows/ci.yml` (`verify-claude-build`).

## 3. Coverage Overview

### 3.1 Functional Coverage (AC-#)

| AC | Description | TC IDs | Status |
|---|---|---|---|
| AC-1 | Kernel covers R1..R10, no hunk outside the section | TC-MEMORY-003 | Planned |
| AC-2 | Tree shape and index coverage | TC-MEMORY-004 | Planned |
| AC-3 | Seeds not fabricated | TC-MEMORY-005 | Planned |
| AC-4 | Missing-agent first-capture path | TC-MEMORY-006 | Planned |
| AC-5 | Skill frontmatter parses | TC-MEMORY-001 | Planned |
| AC-6 | Skill inventoried, no other inventory change | TC-MEMORY-002 | Planned |
| AC-7 | Consolidation dry-run scenarios | TC-MEMORY-007 | Planned |
| AC-8 | Curator limits hold | TC-MEMORY-008 | Planned |
| AC-9 | No conflict-free claim, evidence over recency | TC-MEMORY-009 | Planned |
| AC-10 | Reviewer independence and advisory trust | TC-MEMORY-009 | Planned |
| AC-11 | Ids unique and never reused | TC-MEMORY-010 | Planned |
| AC-12 | Forbidden paths unchanged | TC-MEMORY-011 | Planned |
| AC-13 | No em or en dashes | TC-MEMORY-012 | Planned |
| AC-14 | Existing gates stay green | TC-MEMORY-013 | Planned |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

N/A. No product interface, event, data model, or machine schema is added (NFR-3). The only structured artifact is skill frontmatter, covered by TC-MEMORY-001.

### 3.3 Non-Functional Coverage (NFR-#)

- **NFR-1 caps and NFR-2 determinism:** line counts at or under caps, repeated parse, one-to-one index check (TC-MEMORY-001, TC-MEMORY-004).
- **NFR-3 no runtime behavior:** diff path and content review (TC-MEMORY-011).

## 4. Test Types and Layers

- **Static/diff and content:** `git diff --check`, path and scoped-hunk assertions, scoped grep with paired negative controls (TC-MEMORY-002, 003, 005, 009, 011, 012).
- **Parser:** PyYAML `safe_load` on skill frontmatter (TC-MEMORY-001).
- **Disposable manual dry-run:** synthetic `.ai/memory` copy outside the repo, no new scripts (TC-MEMORY-006, 007, 008, 010).
- **Existing gates:** corpus lint, doc distribution, plugin drift (TC-MEMORY-013). No new `bun test` suites and no runtime unit tests are added.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Automation | Priority | AC |
|---|---|---|---|---|---|
| TC-MEMORY-001 | Skill frontmatter parses with a real YAML parser | Parser | Manual command | High | AC-5, NFR-2 |
| TC-MEMORY-002 | Skill inventoried, no other inventory line changed | Content | Manual command | High | AC-6 |
| TC-MEMORY-003 | Kernel covers every preflight rule with a scoped diff | Content | Manual command | Critical | AC-1 |
| TC-MEMORY-004 | Tree shape, index coverage, and caps | Content | Manual command | Critical | AC-2, NFR-1, NFR-2 |
| TC-MEMORY-005 | Seed READMEs are not fabricated | Content | Manual command | High | AC-3 |
| TC-MEMORY-006 | Missing-agent first-capture path in a disposable tree | Dry-run | Manual | High | AC-4 |
| TC-MEMORY-007 | Consolidation dry-run scenarios, seeds uncontaminated | Dry-run | Manual | Critical | AC-7 |
| TC-MEMORY-008 | Curator limits hold in a negative dry-run | Dry-run | Manual | High | AC-8 |
| TC-MEMORY-009 | Conflict truth and reviewer independence text | Content | Manual command | High | AC-9, AC-10 |
| TC-MEMORY-010 | Ids unique across lessons and tacit, never reused | Dry-run | Manual | High | AC-11 |
| TC-MEMORY-011 | Forbidden paths unchanged | Diff | Manual command | Critical | AC-12 |
| TC-MEMORY-012 | No em or en dashes in new artifacts | Unicode | Manual command | High | AC-13 |
| TC-MEMORY-013 | Existing gates stay green | Gate | Manual command | Critical | AC-14 |

### 5.2 Scenario Details

#### TC-MEMORY-001 - Skill frontmatter parses with a real YAML parser (AC-5, NFR-2; Parser; manual command)
- **Fixture and steps**: `.opencode/skills/consolidate-memory/SKILL.md`; extract the first `---` block, `yaml.safe_load` it, read `name` and `description`, inspect the raw `description:` line.
- **Oracle**: parse succeeds; `name == "consolidate-memory"`; `description` is a quoted string containing `": "`. **Non-vacuity**: a temp copy with unquoted `description: Use when: x` raises a scanner error or yields a mapping.

#### TC-MEMORY-002 - Skill inventoried, no other inventory line changed (AC-6; Content; manual command)
- **Fixture and steps**: `.opencode/README.md`; locate the skills line, confirm `consolidate-memory` at `.opencode/skills/consolidate-memory/SKILL.md`, then diff the Agents and Commands sections against the base.
- **Oracle**: exactly one added skills line; zero changed agent or command line. **Non-vacuity**: removing the line from a temp copy fails the same grep.

#### TC-MEMORY-003 - Kernel covers every preflight rule with a scoped diff (AC-1; Content; manual command)
- **Fixture and steps**: `AGENTS.md`, base `9a70aaf`; grep the single `## Agent memory` section for capture bar, curator exception, advisory trust, evidence over recency, reviewer independence, id uniqueness, and no conflict-free claim; run `git diff -U0 9a70aaf -- AGENTS.md`.
- **Oracle**: all seven phrases inside that section; one added hunk only, inside the section. **Non-vacuity**: deleting one rule from a temp copy fails its grep; the diff assertion is inherently scoped.

#### TC-MEMORY-004 - Tree shape, index coverage, and caps (AC-2, NFR-1, NFR-2; Content; manual command)
- **Fixture and steps**: committed tree; list `agents/*/README.md` and both `.gitkeep` files, extract Index rows, count lines in seeds, index, and skill.
- **Oracle**: four agent folders; all six files exist; one index row per folder and record folder, each with a read-when hint and existing path; seeds at or under 150 lines, index 200, skill 150; no fifth folder. **Non-vacuity**: a duplicate or dangling index row fails.

#### TC-MEMORY-005 - Seed READMEs are not fabricated (AC-3; Content; manual command)
- **Fixture and steps**: the four seed READMEs; inspect charter, instructions, and dated lesson lines; search lesson-position evidence tokens (`PR #`, `CI run`, `review`, ISO dates).
- **Oracle**: charter and instructions only; zero dated lessons and zero invented evidence. **Non-vacuity**: an added `- 2026-01-01: lesson (evidence: PR #1)` line fails.

#### TC-MEMORY-006 - Missing-agent first-capture path in a disposable tree (AC-4; Dry-run; manual)
- **Fixture and steps**: `$(mktemp -d)` outside the repo with a copy of `.ai/memory`; create `agents/<agent>/README.md` from the template, add one index line with a read-when hint, diff the tree.
- **Oracle**: creation uses only the template and index; no other folder or file changes. **Non-vacuity**: omitting the index line makes the index coverage check report the missing row.

#### TC-MEMORY-007 - Consolidation dry-run scenarios, seeds uncontaminated (AC-7; Dry-run; manual)
- **Fixture and steps**: synthetic tree with duplicates, an evidence-less entry, a stale contradiction, a README over 150 lines, a stale index line, a matching `applies_when` record, and a clean copy; walk the SKILL steps by hand; hash the real seeds before and after.
- **Oracle**: dedup keeps the oldest date and merges evidence; evidence-less entry demoted or dropped with a note; contradicted entry pruned with a reason; over-cap README split without rewording; index rebuilt with read-when hints and no dangling row; unrelated records not read; clean copy is a no-op; every cross-folder edit reported; seed hash unchanged. **Non-vacuity**: the clean copy must be a no-op, proving the scenarios are not trivially fixed.

#### TC-MEMORY-008 - Curator limits hold in a negative dry-run (AC-8; Dry-run; manual)
- **Fixture and steps**: disposable tree; request a reword of another agent's lesson, an edit of a fact or decision record, and a policy change; capture the report and diff the target.
- **Oracle**: each request refused or handed off, handoff reported, target unchanged. **Non-vacuity**: a permitted demotion in the same tree succeeds, proving the refusal is scoped.

#### TC-MEMORY-009 - Conflict truth and reviewer independence text (AC-9, AC-10; Content; manual command)
- **Fixture and steps**: kernel, `.ai/memory/README.md`, skill; search for conflict-free wording, evidence and current-truth resolution, reviewer exclusions, and the advisory label.
- **Oracle**: zero conflict-free claims; resolution names evidence and current repo or spec truth, not recency alone; `reviewer`, `readiness-reviewer`, and `decision-critic` keep no episodic memory and cannot read coder reasoning; memory is advisory and cannot override instructions, rules, code, or spec. **Non-vacuity**: a temp copy claiming conflict-free memory fails.

#### TC-MEMORY-010 - Ids unique across lessons and tacit, never reused (AC-11; Dry-run; manual)
- **Fixture and steps**: disposable records plus a duplicate-id fixture and a reused superseded id; scan all `id` values, add each fixture, run validation.
- **Oracle**: zero duplicates; duplicate rejected or reallocated; superseded id never reused; replacement links `supersedes` and the old status becomes `superseded`. **Non-vacuity**: a valid unique fixture passes, proving the check is not always rejecting.

#### TC-MEMORY-011 - Forbidden paths unchanged (AC-12; Diff; manual command)
- **Fixture and steps**: base from `git merge-base origin/main-tools HEAD`; `git diff --name-only` the base, filter forbidden prefixes, list modified existing files.
- **Oracle**: zero paths under `.opencode/agent`, `.opencode/command`, runtime config, security policy, `scripts`, CI, `.ados-claude`, `doc/guides`, `doc/spec`; modified existing files limited to `AGENTS.md` and `.opencode/README.md`. **Non-vacuity**: a scratch file under `scripts/` appears in the filtered list.

#### TC-MEMORY-012 - No em or en dashes in new artifacts (AC-13; Unicode; manual command)
- **Fixture and steps**: spec, test plan, plan, pm-notes, new `.ai/memory` files, skill, `.opencode/README.md` added line, AGENTS.md added lines; `grep -nP '[\x{2013}\x{2014}]'` on new files and on `git diff -U0` added lines.
- **Oracle**: zero matches in the listed artifacts. **Non-vacuity**: a fixture line with a literal em dash is reported.

#### TC-MEMORY-013 - Existing gates stay green (AC-14; Gate; manual command)
- **Fixture and steps**: delivered branch with the GH-204 pm-notes; run `bun test tests/behaviour/pm-notes-corpus.test.ts`, `bash scripts/.tests/test-doc-distribution.sh`, `./scripts/build-claude-plugin.sh --verbose` then stage `.ados-claude/` and `git diff --cached --exit-code .ados-claude/`, and `git diff --check`.
- **Oracle**: corpus passes with GH-204 among the members; distribution guard prints OK with no new exclusion; drift exits 0 with no regenerated output; `git diff --check` is clean. **Non-vacuity**: a malformed GH-204 pm-notes copy in a temp corpus fails.

## 6. Environments and Test Data

Local worktree with `python3` plus PyYAML. Dry-runs use `mktemp -d` outside the repo; the committed seeds are read-only and hashed before and after. No fixtures are committed and no new scripts are created. Cleanup removes the temp root and confirms the real seed hash.

## 7. Automation Plan and Implementation Mapping

| TC | Where | Mode | Status |
|---|---|---|---|
| 001, 002, 003, 004, 005, 009, 011, 012 | in place | grep/diff/python one-liners recorded in the execution log | Manual only |
| 006, 007, 008, 010 | disposable temp tree | manual SKILL walkthrough, evidence in the execution log or a review artifact | Manual only |
| 013 | repo | corpus test, distribution guard, plugin drift, `git diff --check` | Existing gates |

No test file is created. Dry-run evidence is the step log, the report excerpt, and the seed hash before and after.

## 8. Risks, Assumptions, and Open Questions

- **Risk**: content greps may match a mention without the rule (paired non-vacuity controls); the manual dry-run may drift from the skill steps (walk the SKILL steps in order).
- **Assumption**: PyYAML is available; GH-204 is inside the corpus boundary and has a valid pm-notes file.
- **Open question** (non-blocking): whether generated plugins should project `.opencode/skills`.

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1 | 2026-10-31 | test-plan-writer | Initial plan for AC-1..AC-14. |

## 10. Test Execution Log

| TC ID | Run Date | Result | Notes |
|---|---|---|---|
| 001..013 | - | Not run | Populated at delivery. |
