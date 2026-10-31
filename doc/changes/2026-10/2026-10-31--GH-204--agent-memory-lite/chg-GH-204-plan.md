---
id: chg-GH-204-agent-memory-lite
status: Proposed
created: 2026-10-31T12:40:00Z
last_updated: 2026-10-31T13:12:00Z
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

Deliver the practices-now track of the ADOS memory model as text and skill content only. Source of truth is
`chg-GH-204-spec.md` (R1..R12, AC-1..AC-14); evidence is `chg-GH-204-test-plan.md` (TC-MEMORY-001..013).
Baseline for diffs is `9a70aaf`; `d1a8b7a` and `8a485e5` add the spec and test plan. Branch
`feat/GH-204/agent-memory-lite`, PR base `main-tools`. Intentional drafts already exist (modified `AGENTS.md`,
untracked `.ai/memory/**` and `.opencode/skills/**`): refine in place, do not restart or switch worktrees.
No blocking open questions.

### Pinned execution decisions

- Seeds: exactly `ceo`, `pm`, `coder`, `fixer`; other agents self-create on first capture from the template in
  `.ai/memory/README.md`. `lessons/.gitkeep` and `tacit/.gitkeep` ship now.
- Own `agents/<agent>/README.md` is the only always-read file; index and topic files load just-in-time.
- `consolidate-memory` is the only cross-folder writer (demote, supersede, move promoted lines, cap splits),
  reports every edit, and never rewords another agent's content.
- `reviewer`, `readiness-reviewer`, `decision-critic` keep no episodic memory and do not read coder reasoning;
  `committer`, `pr-manager`, `runner` keep none.
- Conflicts resolve by evidence and current repo or spec truth, never recency alone; no conflict-free claim
  anywhere. Promoted ids are unique across `lessons/` and `tacit/` and never reused.
- Facts go to `@doc-syncer` (`doc/spec`), decisions to `@decision-advisor` (`doc/decisions`); the skill never
  edits those unilaterally.
- `@toolsmith` refines `SKILL.md` before `@coder`; coder validates and integrates it and does not rewrite it
  unless it contradicts the spec, logging any correction.

## Scope

**In scope**: `AGENTS.md` memory section only (R1..R10); `.ai/memory/README.md` index, conventions, record
format, template (R7, R8); four seeds plus two `.gitkeep` files (AC-2, AC-3); `SKILL.md` refinement and one
`.opencode/README.md` skills entry (R9, AC-5, AC-6); content, parser, diff, and dry-run validation.

**Out of scope**: agent and command prompts, runtime config, security policy, `scripts/**`, CI, generated
`.ados-claude/**` (R11, NG-1, NG-7); memory lint, `ados memory`, compiler, `events.jsonl`, guild, preferences,
retro trees (NG-2, NG-3); new redistributable docs, `doc/guides/**`, `doc/spec` updates, decision records,
pm-notes schema or corpus changes (R11, NG-4, NG-5); new scripts or committed fixtures.

**Constraints**: content only, zero runtime behavior (NFR-3); no em or en dash in new lines (R12); caps 150
lines for seeds and skill, 200 for the index (NFR-1); one Conventional Commit per phase with explicit path
staging, no nested subagent dispatch, nothing written to `.ai/local/`; `@coder` must not mark PM-owned
lifecycle phases complete.

**Risks**: RSK-1 noise growth (capture bar, two-occurrence rule, caps); RSK-2 shared-surface conflicts (no
conflict-free claim, consolidation-only writes); RSK-3 reviewer contamination (exclusions, advisory label,
JIT loading); RSK-5 colon-space YAML breakage (quoted description, parser check, already failing in the
draft); RSK-6 scope creep (forbidden path diff in Phase 4).

**Success metrics**: AC-1..AC-14 satisfied, TC-MEMORY-001..013 evidenced, existing gates green with no new
exclusions.

## Phases

### Phase 1: Kernel section and tree index

**Goal**: Every rule in one section; the README is index, conventions, template, and routing.
**Files**: `AGENTS.md` (section only), `.ai/memory/README.md`.

- [ ] **1.1** Extend "Agent memory" with the curator exception (R4), advisory trust and evidence-over-recency
  (R5), reviewer independence plus the coder-reasoning bar (R6), id uniqueness and supersede semantics (R8),
  and the no-conflict-free claim (R10); keep R2, R3, R7; confirm zero hunks outside the section via
  `git diff -U0 9a70aaf -- AGENTS.md`.
- [ ] **1.2** Rewrite `.ai/memory/README.md`: layout, capture bar, first-capture template, concurrency and
  conflict reality, record format, id allocation, promotion routing with owning agents, caps, and a
  one-row-per-folder index with read-when hints.
- [ ] **1.3** Keep the template copy-pasteable and the index at or under 200 lines.

**Verify**: AC-1, AC-9, AC-10, NFR-1, NFR-2 via the TC-MEMORY-003 phrase grep, the scoped diff, and an index
row count equal to seeded folders plus record directories.
**Commit**: `docs(GH-204): add agent memory kernel rules and tree index`

---

### Phase 2: Seeds and promoted trees

**Goal**: Four honest seed entry points plus visible record directories.
**Files**: `.ai/memory/agents/{ceo,pm,coder,fixer}/README.md`, `.ai/memory/{lessons,tacit}/.gitkeep`.

- [ ] **2.1** Refine each seed in place: charter, capture instructions, template and index pointer, evidence
  format, supersede note, cap and split note, advisory label, one-line pointer pattern.
- [ ] **2.2** Confirm zero dated lessons and zero invented evidence (AC-3), 150 lines or fewer per file, empty
  `.gitkeep` files, no fifth agent folder, and one index row per seed and record directory.

**Verify**: AC-2, AC-3, NFR-1 via TC-MEMORY-004 and TC-MEMORY-005 commands plus a tree file listing.
**Commit**: `docs(GH-204): seed agent memory entry points and record trees`

---

### Phase 3: Skill and inventory

**Goal**: Integrate the `@toolsmith`-refined skill within the curator mandate and inventory it.
**Files**: `.opencode/skills/consolidate-memory/SKILL.md`, `.opencode/README.md`.

- [ ] **3.1** Validate the refined skill against R9 and AC-5: quoted `description` with a colon-space, `name`
  equal to `consolidate-memory`, real YAML parse succeeds. Do not reword refined content unless it contradicts
  the spec; log any correction.
- [ ] **3.2** Confirm the steps cover inventory, evidence validation, dedup, supersede, stale prune, promotion,
  caps, index rebuild, the cross-folder report, the fact and decision handoff, and the owner-only policy and
  security block; replace recency-based conflict wording with evidence and current-truth resolution (R5, AC-9)
  while keeping supersession mechanics unchanged.
- [ ] **3.3** Add a `## Skills` section to `.opencode/README.md` listing `consolidate-memory` at
  `.opencode/skills/consolidate-memory/SKILL.md` with a one-line purpose; change no agent or command line.

**Verify**: AC-5, AC-6, AC-8 prerequisites and the 150 line cap via TC-MEMORY-001 parser, TC-MEMORY-002
inventory diff, TC-MEMORY-009 text search, and TC-MEMORY-010 id rule review.
**Commit**: `docs(GH-204): add consolidate-memory skill and inventory entry`

---

### Phase 4: Integration and scoped validation

**Goal**: Prove the text and skill obey every AC without touching forbidden paths or the real seeds.
**Files**: none expected; in-scope fixes only, each logged.

- [ ] **4.1** Run static content and diff checks (TC-MEMORY-002, 003, 004, 005, 009, 011, 012), parse skill
  frontmatter with PyYAML `safe_load` including the non-vacuity control (TC-MEMORY-001), and log each result.
- [ ] **4.2** Run disposable `mktemp -d` dry-runs for the missing-agent path, consolidation scenarios, curator
  limits, and id reuse; hash the real seeds before and after (TC-MEMORY-006, 007, 008, 010). Run the pm-notes
  corpus test, doc-distribution guard, plugin drift check, and `git diff --check` (TC-MEMORY-013); report to PM.
- [ ] **4.3** Confirm the forbidden path diff and dash scan are clean; fix only in-scope findings, never by
  adding exclusions or regenerating `.ados-claude/**`.

**Verify**: AC-4, AC-7, AC-8, AC-11, AC-12, AC-13, AC-14 evidence in the execution log, seed hash unchanged,
no dry-run artifact inside the repository.
**Commit**: `docs(GH-204): validate agent memory artifacts` if something changed, otherwise record a no-op.

## Test Scenarios

| TC ID | Scenario | Phases | AC |
|---|---|---|---|
| TC-MEMORY-001 | Skill frontmatter parses | 3, 4 | AC-5, NFR-2 |
| TC-MEMORY-002 | Skill inventoried, no other line changed | 3, 4 | AC-6 |
| TC-MEMORY-003 | Kernel covers all rules with scoped diff | 1, 4 | AC-1 |
| TC-MEMORY-004 | Tree shape, index coverage, caps | 2, 4 | AC-2, NFR-1, NFR-2 |
| TC-MEMORY-005 | Seeds not fabricated | 2, 4 | AC-3 |
| TC-MEMORY-006 | Missing-agent first-capture dry-run | 2, 4 | AC-4 |
| TC-MEMORY-007 | Consolidation dry-run scenarios | 4 | AC-7 |
| TC-MEMORY-008 | Curator limits negative dry-run | 3, 4 | AC-8 |
| TC-MEMORY-009 | Conflict truth and reviewer independence | 1, 3, 4 | AC-9, AC-10 |
| TC-MEMORY-010 | Ids unique and never reused | 3, 4 | AC-11 |
| TC-MEMORY-011 | Forbidden paths unchanged | 4 | AC-12 |
| TC-MEMORY-012 | No em or en dashes | 4 | AC-13 |
| TC-MEMORY-013 | Existing gates stay green | 4, PM 9 | AC-14 |

## Lifecycle Mapping

| Phase | Owner | Note |
|---|---|---|
| 5 DoR | PM with `@readiness-reviewer` | coder does not mark complete |
| 6 Delivery | `@coder` | phases 1 to 4, one commit each |
| 7 System spec update | PM with `@doc-syncer` | expected no-op; R11 forbids `doc/spec` edits |
| 8 Review and fix | PM with `@reviewer` | coder remediates only on request |
| 9 Quality gates | PM with `@runner` | final AC-14 evidence |
| 10 DoD | PM | verifies all AC and plan tasks |
| 11 PR | PM with `@pr-manager` | base `main-tools`, PM does not merge |

## Artifacts and Links

- `AGENTS.md` (updated): kernel section.
- `.ai/memory/README.md` (new): index, conventions, record format, template.
- `.ai/memory/agents/{ceo,pm,coder,fixer}/README.md` (new): seed entry points.
- `.ai/memory/{lessons,tacit}/.gitkeep` (new): record directories.
- `.opencode/skills/consolidate-memory/SKILL.md` (new): consolidation skill.
- `.opencode/README.md` (updated): skills inventory entry.
- `./chg-GH-204-spec.md` and `./chg-GH-204-test-plan.md`: source and evidence.

## Plan Revision Log

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-10-31 | plan-writer | Initial plan for AC-1..AC-14. |

## Execution Log

| Phase | Status | Started | Completed | Commit | Notes |
|---|---|---|---|---|---|
| 1 | Pending | - | - | - | - |
| 2 | Pending | - | - | - | - |
| 3 | Pending | - | - | - | - |
| 4 | Pending | - | - | - | - |
| 5..11 | PM-owned | - | - | - | not marked by coder |
