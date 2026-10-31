---
id: chg-GH-204-agent-memory-lite
status: Updated
created: 2026-10-31T12:40:00Z
last_updated: 2026-10-31
owners: [engineering]
service: repo operating documentation
labels: [change, planning, documentation]
links:
  change_spec: ./chg-GH-204-spec.md
  test_plan: ./chg-GH-204-test-plan.md
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
summary: >
  Deliver the committed agent memory lite layer: one AGENTS.md kernel section, the
  .ai/memory tree with four seeded entry points, and the consolidate-memory skill,
  with no prompt, runtime, script, CI, or generated plugin changes.
version_impact: minor
---

# IMPLEMENTATION PLAN - GH-204: Agent memory lite

## Context and Goals

Deliver the practices-now track of the ADOS memory model as text and skill content only. Source of truth is `chg-GH-204-spec.md` (R1..R12, AC-1..AC-15 including AC-7.1..AC-7.6); evidence is `chg-GH-204-test-plan.md` (TC-MEMORY-001..015). Baseline for diffs is `9a70aaf`; branch `feat/GH-204/agent-memory-lite`, PR base `main-tools`. Intentional drafts already exist (modified `AGENTS.md`, untracked `.ai/memory/**` and `.opencode/skills/**`): refine in place, do not restart or switch worktrees. No blocking open questions.

### Pinned execution decisions

- Seeds: exactly `ceo`, `pm`, `coder`, `fixer`; other agents self-create on first capture from the README template. `lessons/.gitkeep` and `tacit/.gitkeep` ship now.
- Own `agents/<agent>/README.md` is the only always-read file; index and topic files load just-in-time.
- `consolidate-memory` is the only cross-folder writer, with the complete operation set: mechanical duplicate merge preserving evidence and substance; demote or drop evidence-less entries; mark supersession; prune stale entries with a recorded reason; move promoted lines to one-line pointers; split an over-cap folder; rebuild the index. It reports every cross-folder edit and never substantively rewords content.
- First-capture exception: an unseeded agent may create its own README and append exactly one index row for its own folder, once; every other folder, record row, and later index edit belongs to the curator.
- `reviewer`, `readiness-reviewer`, `decision-critic` keep no episodic memory and do not read coder reasoning or another agent's episodic memory; `committer`, `pr-manager`, `runner` keep none.
- Memory is advisory untrusted data; a newer entry is a candidate, not authority. Conflicts resolve by evidence and current repo or spec truth, never recency alone. No text claims conflict-free memory.
- Promoted ids use the monotonic next free id per prefix and year, unique across `lessons/` and `tacit/`, never reused; validation scans both `id` and `supersedes`, and duplicates are rejected, never reallocated.
- Facts go to `@doc-syncer` (`doc/spec`), decisions to `@decision-advisor` (`doc/decisions`) as a handoff proposal; the skill never writes those targets. Policies and security rules remain owner-only.
- Lifecycle pins: the owner approved a lightweight implementation of this ticket; the ticket body's waived-lifecycle wording is not an owner instruction to skip phases. Running all 11 phases with a complete pm-notes ledger is a CEO operating requirement for merge verification, not a new owner directive (F-20). This is repo operating documentation, so phase 7 is a true no-op and R11 is a hard boundary (F-15). PM creates the PR and does not merge; the owner or CEO merges to `main-tools` and closes the ticket (F-12, AC-15).
- `@toolsmith` refines `SKILL.md` before `@coder`; coder validates and integrates it and does not rewrite it unless it contradicts the spec, logging any correction.

## Scope

**In scope**: `AGENTS.md` memory section only (R1..R10); `.ai/memory/README.md` index, conventions, record format, template (R7, R8); four seeds plus two `.gitkeep` files (AC-2, AC-3); `SKILL.md` refinement and one `.opencode/README.md` skills entry (R9, AC-5, AC-6); content, parser, diff, and dry-run validation (AC-1..AC-15).

**Out of scope**: agent and command prompts, runtime config, security policy, `scripts/**`, CI, generated `.ados-claude/**` (R11, NG-1, NG-7); memory lint, `ados memory`, compiler, `events.jsonl`, guild, preferences, retro trees (NG-2, NG-3); new redistributable docs, `doc/guides/**`, `doc/spec` updates, decision records, pm-notes schema or corpus changes (R11, NG-4, NG-5); new scripts or committed fixtures.

**Constraints**: content only, zero runtime behavior (NFR-3); no em or en dash in new lines (R12); caps 150 lines for seeds and skill, 200 for the index (NFR-1); one Conventional Commit per phase with explicit path staging; nothing written to `.ai/local/`. `@coder` may delegate to `@committer` and `@runner` per `AGENTS.md`; inline committer discipline is the fallback when nested dispatch is unavailable, not a ban (F-14). `@coder` must not mark PM-owned lifecycle phases complete.

**Risks**: RSK-1 noise growth (capture bar, two-occurrence rule, caps); RSK-2 shared-surface conflicts (no conflict-free claim, consolidation-only writes); RSK-3 reviewer contamination (exclusions, advisory label, JIT loading); RSK-5 colon-space YAML breakage (quoted description and records, real parser checks); RSK-6 scope creep (forbidden path and header diff in Phase 4).

**Success metrics**: AC-1..AC-15 satisfied, TC-MEMORY-001..015 evidenced, existing gates green with no new exclusions and no regenerated `.ados-claude/**`.

## Phases

### Phase 1: AGENTS.md kernel section only

**Goal**: One `## Agent memory` section carries R1..R10; no other AGENTS.md change lands.

**Tasks**:

- [x] **1.1** Rewrite the capture bar: five triggers, the two-occurrence plus likely-recurrence rule, and the explicit routine-success exclusion; every entry links evidence; secrets and one-command repo facts excluded (R3, F-10). (done in AGENTS.md kernel)
- [x] **1.2** Rewrite trust and conflict: memory is advisory untrusted data; a newer entry is a candidate, not authority; resolve by evidence and current repo or spec truth, never recency alone (R5, AC-9, F-4). (done)
- [x] **1.3** State reviewer independence for `reviewer`, `readiness-reviewer`, and `decision-critic`: no episodic memory, no coder reasoning or another agent's episodic memory, shared facts and checklists only; memory cannot override instructions, repo rules, or code and spec truth (R6, AC-10). (done)
- [x] **1.4** State write ownership, the complete curator operation set, the first-capture self-index-row exception, and that every later index edit belongs to the curator (R4, R7, F-1, F-2). (done)
- [x] **1.5** State id rules: monotonic next free id per prefix and year, unique across both directories, never reused; scan `id` and `supersedes`; a replacing record links the old id and marks the old status `superseded` (R8, AC-11, F-8). (done)
- [x] **1.6** State that no text claims conflict-free memory; shared surfaces are consolidation-only apart from the first-capture row but remain merge-conflict capable (R10, F-3). (done)
- [x] **1.7** Confirm `git diff -U0 9a70aaf -- AGENTS.md` yields exactly one added hunk inside the section. (verified: one hunk, 14 added lines, all inside the section)

**Acceptance Criteria**: Must: AC-1, AC-9, AC-10; every R1..R10 rule present in the single section. Should: the section stays compact and points to `.ai/memory/README.md` for detail.

**Files and modules**: Code areas: `AGENTS.md` (updated, one section only). System docs: none (R11 hard boundary).

**Tests**: TC-MEMORY-003 rule-by-rule kernel checklist with the scoped diff; TC-MEMORY-009 conflict and reviewer text search.

**Completion signal**: `docs(GH-204): add agent memory kernel rules`

---

### Phase 2: Memory index, seeds, and record trees

**Goal**: The README, four seeds, and both `.gitkeep` files land together so every index row resolves inside this same commit.

**Tasks**:

- [x] **2.1** Rewrite `.ai/memory/README.md`: layout, capture bar, first-capture template, concurrency and conflict reality, record format, id allocation, promotion routing, caps, and the curator operation set. (done)
- [x] **2.2** Add the reviewer exclusion to the read policy and index hints: own README only always read, index and topic files just-in-time, and the three adversarial roles barred from coder reasoning and episodic memory (R2, R6, AC-10, F-11). (done)
- [x] **2.3** Pin index granularity: exactly one row per agent folder (seeded or self-created) and one row per promoted record file under `lessons/` and `tacit/`, each with a read-when hint; no directory-level rows for `lessons/` or `tacit/`; describe the empty trees in the layout only (R7, AC-2, F-3). (done; 4 rows = 4 folders, 0 record files)
- [x] **2.4** Define record frontmatter under YAML 1.2 core semantics: quote `statement`, `applies_when`, and `created` or use block scalars; `created` stays a string, not a date scalar (R8, F-7). (done)
- [x] **2.5** Define id allocation and validation: monotonic next free per prefix and year, unique across both directories, duplicate or reused ids rejected and never reallocated, scan `id` and `supersedes`, replacement links the old id and sets the old status to `superseded` (R8, AC-11, F-8). (done)
- [x] **2.6** Keep the first-capture template complete: charter, Lessons section, evidence format, advisory label, cap and split pointer; an unseeded agent creates its own README and appends exactly one own-folder row on first capture only (R4, R7, AC-4, F-1). (done in README first-capture section)
- [x] **2.7** Refine the four seeds in place: charter and capture instructions only, zero dated lessons and zero invented evidence, 150 lines or fewer each; keep both `.gitkeep` files empty and add no fifth agent folder (AC-2, AC-3, NFR-1). (done; 12-13 lines each, zero dated lines)
- [x] **2.8** Confirm every index row added in this commit points at a file committed in this commit; count rows from agent folders and record files, not directories. (verified: 4 rows, 4 folders, 0 record files, no dangling rows)

**Acceptance Criteria**: Must: AC-2, AC-3, AC-4, AC-10, NFR-1, NFR-2. Should: the README stays copy-pasteable and under 200 lines.

**Files and modules**: Code areas: `.ai/memory/README.md`, `.ai/memory/agents/{ceo,pm,coder,fixer}/README.md`, `.ai/memory/{lessons,tacit}/.gitkeep` (all new or updated). System docs: none (R11 hard boundary).

**Tests**: TC-MEMORY-004 tree and index granularity; TC-MEMORY-005 seed honesty; TC-MEMORY-006 template completeness; index coverage equals agent folders plus record files.

**Completion signal**: `docs(GH-204): add memory index, seeds, and record trees`

---

### Phase 3: Consolidation skill and inventory

**Goal**: The skill obeys R9 and the curator mandate, and `.opencode/README.md` inventories it.

**Tasks**:

- [x] **3.1** Shorten the `description` to one concise sentence of at most 20 words while keeping trigger keywords in the body; keep it a quoted scalar containing a colon-space; keep `name` equal to `consolidate-memory`; prove a real YAML parse succeeds (R9, AC-5, F-21). (validated: 15 words, quoted, PyYAML parse ok, non-vacuity ScannerError)
- [x] **3.2** Replace direct fact and decision promotion with a handoff proposal naming `@doc-syncer` for `doc/spec` and `@decision-advisor` for `doc/decisions`; the skill never writes those targets, and policies and security rules stay owner-only (R9, AC-8, F-5). (validated present in routing table and hard rules)
- [x] **3.3** Align the hard rules with the complete operation set: dedup merge preserving evidence and substance, demote or drop evidence-less entries with a reason, supersede, stale prune with a reason, move promoted lines to pointers, cap splits, and index rebuild; no substantive rewording; report every cross-folder edit (R4, R9, F-2). (validated present)
- [x] **3.4** Replace recency-as-authority wording with evidence and current-truth resolution; make record creation use the quoted YAML 1.2 form and verify a real parse (R5, R8, F-4, F-7). (validated: conflict section, record frontmatter section)
- [x] **3.5** Add one skills inventory line to `.opencode/README.md` for `.opencode/skills/consolidate-memory/SKILL.md`; change no agent or command inventory line (AC-6). (done: Skills section appended, no other diff)

**Acceptance Criteria**: Must: AC-5, AC-6, AC-8, R9, NFR-1. Should: the skill stays at or under 150 lines and follows the short-description convention.

**Files and modules**: Code areas: `.opencode/skills/consolidate-memory/SKILL.md` (updated), `.opencode/README.md` (one entry). System docs: none (R11 hard boundary; no `doc/spec` feature update).

**Tests**: TC-MEMORY-001 parser plus non-vacuity; TC-MEMORY-002 inventory diff; TC-MEMORY-008 curator limits prerequisites; TC-MEMORY-014 record template parse.

**Completion signal**: `docs(GH-204): add consolidate-memory skill and inventory entry`

---

### Phase 4: Integration and scoped validation

**Goal**: Prove the delivered text and skill satisfy every AC without touching forbidden paths or the real seeds.

**Tasks**:

- [x] **4.1** Run static content and diff checks: TC-MEMORY-003 rule-by-rule kernel checklist; TC-MEMORY-004 tree and index; TC-MEMORY-005 seed honesty; TC-MEMORY-009 conflict truth and reviewer independence in both the kernel and README; TC-MEMORY-011 forbidden paths plus the license-header scan; TC-MEMORY-012 dash scan. (all PASS: kernel 26/26, index 4/4, seeds 0 dated, forbidden paths none, header scan clean, dash scan clean)
- [x] **4.2** Run parsers: TC-MEMORY-001 skill frontmatter with non-vacuity, and TC-MEMORY-014 promoted record with a colon-space and a quoted `created` string under YAML 1.2 core. (PASS: PyYAML safe_load, name and 15-word quoted description, non-vacuity ScannerError, created stays str)
- [x] **4.3** Run disposable `mktemp -d` dry-runs: TC-MEMORY-006 missing-agent path and template completeness; TC-MEMORY-007 AC-7.1..AC-7.6 plus the conflict scenario where a newer unsupported claim loses to an older evidence-backed claim; TC-MEMORY-008 curator limits; TC-MEMORY-010 id reuse. Hash the real seeds before and after. (all PASS; seed hash 19e298171658acb6e225f625fa7b4ca2754117f80f99941d0170cc57fa791998 before and after; temp cleaned)
- [x] **4.4** Run gates with the install precondition: `pnpm install --frozen-lockfile` first, then `bun test tests/behaviour/pm-notes-corpus.test.ts`, the doc-distribution guard, the plugin drift check, and `git diff --check` (TC-MEMORY-013, F-16). (PASS: install and build ok; corpus 17/17; distribution OK; plugin drift none; diff check clean)
- [ ] **4.5** Capture AC-15 lifecycle evidence at phase 11: PM creates the PR to `main-tools` and does not merge; the owner or CEO merges and the ticket closes with a delivery summary (TC-MEMORY-015). (deferred: PM-owned at phase 11, not coder evidence)
- [x] **4.6** Fix only in-scope findings, never by adding exclusions or regenerating `.ados-claude/**`; report results to PM. (one in-scope fix: advisory label added to the README first-capture template; no exclusions, no plugin regeneration)

**Acceptance Criteria**: Must: AC-4 and AC-7..AC-15 evidenced; forbidden path, header, and dash checks clean. Should: seed hash unchanged and no dry-run artifact left inside the repository.

**Files and modules**: Code areas: none expected; in-scope fixes only, each logged. System docs: none (phase 7 is a true no-op; R11 hard boundary).

**Tests**: TC-MEMORY-001..015, with AC-15 recorded in the execution log.

**Completion signal**: `docs(GH-204): validate agent memory artifacts` if something changed, otherwise record a no-op with the evidence.

## Test Scenarios

| TC ID | Scenario | Phases | AC |
|---|---|---|---|
| TC-MEMORY-001 | Skill frontmatter parses | 3, 4 | AC-5, NFR-2 |
| TC-MEMORY-002 | Skill inventoried, no other line changed | 3, 4 | AC-6 |
| TC-MEMORY-003 | Kernel covers R1..R10 rule by rule with scoped diff | 1, 4 | AC-1 |
| TC-MEMORY-004 | Tree shape, index granularity, caps | 2, 4 | AC-2, NFR-1, NFR-2 |
| TC-MEMORY-005 | Seeds not fabricated | 2, 4 | AC-3 |
| TC-MEMORY-006 | Missing-agent path and template completeness | 2, 4 | AC-4 |
| TC-MEMORY-007 | Consolidation dry-run, AC-7.1..AC-7.6, conflict scenario | 4 | AC-7, AC-7.1..AC-7.6, AC-9 |
| TC-MEMORY-008 | Curator limits negative dry-run | 3, 4 | AC-8 |
| TC-MEMORY-009 | Conflict truth and reviewer independence | 1, 2, 3, 4 | AC-9, AC-10 |
| TC-MEMORY-010 | Ids unique across lessons and tacit, never reused | 2, 3, 4 | AC-11 |
| TC-MEMORY-011 | Forbidden paths unchanged and no added headers | 4 | AC-12 |
| TC-MEMORY-012 | No em or en dashes | 4 | AC-13 |
| TC-MEMORY-013 | Existing gates stay green with root deps installed | 4, PM 9 | AC-14 |
| TC-MEMORY-014 | Promoted record frontmatter parses under YAML 1.2 core | 2, 3, 4 | AC-11, NFR-2 |
| TC-MEMORY-015 | Merge and closure lifecycle evidence | PM 11 | AC-15 |

## Lifecycle Mapping

| Phase | Owner | Note |
|---|---|---|
| 5 DoR | PM with `@readiness-reviewer` | coder does not mark complete |
| 6 Delivery | `@coder` | phases 1 to 4, one commit each; may delegate commits and runs per AGENTS.md |
| 7 System spec update | PM with `@doc-syncer` | true no-op; this is repo operating documentation and R11 forbids `doc/spec` edits |
| 8 Review and fix | PM with `@reviewer` | coder remediates only on request |
| 9 Quality gates | PM with `@runner` | final AC-14 evidence |
| 10 DoD | PM | verifies all AC and plan tasks |
| 11 PR and closure | PM with `@pr-manager` | base `main-tools`; PM creates the PR and does not merge; owner or CEO merges and closes the ticket (AC-15) |

## Artifacts and Links

- `AGENTS.md` (updated): kernel section.
- `.ai/memory/README.md` (new): index, conventions, record format, template.
- `.ai/memory/agents/{ceo,pm,coder,fixer}/README.md` (new): seed entry points.
- `.ai/memory/{lessons,tacit}/.gitkeep` (new): record trees.
- `.opencode/skills/consolidate-memory/SKILL.md` (new): consolidation skill.
- `.opencode/README.md` (updated): skills inventory entry.
- `./chg-GH-204-spec.md`, `./chg-GH-204-test-plan.md`, and `./readiness-review/readiness-iter-1.md`: source, evidence, and finding resolution.

## Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-31 | plan-writer | Initial plan for AC-1..AC-14. |
| 1.1 | 2026-10-31 | plan-writer | Resolved delivery_planning findings F-1, F-2, F-3, F-4, F-5, F-6, F-7, F-8, F-9, F-10, F-11, F-12, F-13, F-14, F-15, F-16, F-17, F-20, F-21, F-23: self-consistent phase order, kernel and README rule coverage, complete curator set, handoff promotion, short skill description, rule-by-rule and record-parse validation, record-level index granularity, id allocation, header scan, install precondition, lifecycle pins, nested dispatch correction, and 15/15 TC traceability. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| 1 | Complete | 2026-10-31 | 2026-10-31 | phase 1 commit: docs(GH-204): add agent memory kernel rules | Kernel covers R1..R10; scoped diff one hunk; dash scan clean. |
| 2 | Complete | 2026-10-31 | 2026-10-31 | phase 2 commit: docs(GH-204): add memory index, seeds, and record trees | README 150 lines, seeds 12-13 lines, both .gitkeep empty, index coverage 4/4. |
| 3 | Complete | 2026-10-31 | 2026-10-31 | phase 3 commit: docs(GH-204): add consolidate-memory skill and inventory entry | Skill 135 lines, description 15 words, parse ok; one Skills section in README. |
| 4 | Complete (4.5 PM-owned) | 2026-10-31 | 2026-10-31 | phase 4 commit: docs(GH-204): validate agent memory artifacts | Static, parser, dry-run, and gate checks pass; seed hash unchanged; 4.5 deferred to phase 11; build needed before the Bun corpus test. |
| 5..11 | PM-owned | - | - | - | not marked by coder; AC-15 evidence added at phase 11 |
