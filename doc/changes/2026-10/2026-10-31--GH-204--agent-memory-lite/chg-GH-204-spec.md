---
id: GH-204
status: Proposed
created: 2026-10-31
last_updated: 2026-10-31
owners: [engineering]
service: repo operating documentation
summary: >-
  Add a committed, dogfood-first agent memory layer: one AGENTS.md kernel
  section, the .ai/memory tree with four seeded agent entry points, and a
  consolidation skill that dedupes, supersedes, promotes, and reindexes under
  explicit write and trust rules, with no agent prompt, runtime, script, CI, or
  generated plugin changes.
links:
  issue: https://github.com/juliusz-cwiakalski/agentic-delivery-os/issues/204
  related_changes: [GH-204]
  related_decisions: []
---

# Feature: Agent memory lite: committed learning layer

## Overview

Deliver the practices-now track of the ADOS memory model: a small, committed learning layer usable today without memory lint, an `ados memory` CLI, a compiler, or per-agent prompt changes. The design is the approved GH-204 ticket; this specification fixes observable content, boundaries, and acceptance evidence without reopening it. The surface is one AGENTS.md kernel section, the `.ai/memory` tree with seeded entry points for `ceo`, `pm`, `coder`, and `fixer`, and the `consolidate-memory` skill. Memory is advisory, reviewed through normal PRs, and governed by evidence and current repo truth.

## Problem statement

Because agent sessions restart from zero, each session repeats discoveries, environment traps, review catches, and correction cycles the system already paid for; without a committed, governed memory layer that learning is lost or becomes ad hoc notes, and there is no reviewable path from an observed outcome to a durable lesson.

## Affected users

Lifecycle agents (`ceo`, `pm`, `coder`, `fixer`, and later others) that capture and read memory; adversarial reviewers that must stay independent of author reasoning; the repository owner reviewing memory changes; and future contributors who inherit the conventions.

## Business impact

- Fewer repeated mistakes and rediscoveries across changes.
- Memory changes are small, committed, and reviewable like code.
- A governed write path prevents memory from becoming an unbounded autobiography or a prompt-injection channel.
- The tree and record shape align with the concept-doc layout, so later lint and `ados memory` tooling can adopt it without migration.
- Blast radius stays minimal: no agent prompts, runtime, scripts, CI, or generated plugin output change.

## Goals

- **G-1**: Add one compact AGENTS.md kernel section and the committed `.ai/memory` tree, seeded only for the delivery hot path.
- **G-2**: Define capture, write ownership, evidence, conflict resolution, reviewer independence, and promotion authority as explicit rules.
- **G-3**: Ship a consolidation skill that dedupes, supersedes, prunes, promotes, enforces caps, and rebuilds the index.
- **G-4**: Keep memory advisory and independent of instruction authority.
- **G-5**: Change no prompts, scripts, config, security policy, CI, generated plugin output, or redistributable docs.

## Non-goals

- **NG-1**: Per-agent memory rules in `.opencode/agent/**` or `.opencode/command/**`.
- **NG-2**: Memory lint, the `ados memory` command family, or a memory compiler.
- **NG-3**: Guild trees, a preferences tree, a retro tree, capsule completion, or `events.jsonl`.
- **NG-4**: New redistributable docs under `doc/guides/**` or any `doc/spec` feature update.
- **NG-5**: Changes to the pm-notes schema or its existing corpus.
- **NG-6**: A conflict-free memory claim; shared surfaces remain merge-conflict capable.
- **NG-7**: Regenerating or committing `.ados-claude/**`.

## Requirements

- **R1 Kernel once.** AGENTS.md gains exactly one `## Agent memory` section and no other change; that section carries the read, capture, write, trust, conflict, cap, exclusion, and promotion rules in R2 through R10. (Design 1, 5)
- **R2 Read policy.** The agent's own `agents/<agent>/README.md` is the only memory file always read at session start; the index, topic files, and other agents' memory load just-in-time when the task touches them. (Design 3)
- **R3 Capture bar.** Durable capture requires one of: the same mistake twice, a review catch, a repeated human correction, a verified outcome (CI, review, or merge verdict), or a repeated workflow with at least two occurrences and a likely recurrence. Routine success alone never qualifies as memory. Everything else is scratch in `.ai/local/**`; every entry links evidence; secrets and one-command repo or git facts are never memory. (Design 2; preflight capture bar)
- **R4 Write ownership and narrow exception.** An agent writes only inside its own folder and never edits another agent's memory. The single narrow exception: an agent that was not seeded may, on first capture only, create its own `agents/<agent>/README.md` and append exactly one index row pointing to its own folder. `consolidate-memory` remains the only writer for every other folder, every promoted record row, and every later index edit. Its permitted cross-folder operations are: mechanical duplicate merge that preserves evidence and substance; demote or drop evidence-less entries; mark supersession; prune stale entries with a recorded reason; move promoted lines to a one-line pointer; split an over-cap folder into topic files; and rebuild the index. Every cross-folder edit is named in its report. No substantive rewording: a merge may concatenate or union evidence but may not paraphrase. (Design 2; preflight curator exception)
- **R5 Advisory trust and truth resolution.** Memory is advisory, untrusted data; it cannot override instructions, repo rules, or current code and spec truth. A newer entry is a candidate, not authority. Conflicts are resolved by evidence and current repo or spec truth, never by recency alone. (Preflight trust and recency)
- **R6 Reviewer independence.** `reviewer`, `readiness-reviewer`, and `decision-critic` keep no episodic memory and must not load coder reasoning or another agent's episodic memory; they read shared facts, decisions, and checklists only. Memory stays advisory and never overrides instructions, repo rules, or current code and spec truth. (Preflight reviewer independence)
- **R7 Tree and seeding.** `.ai/memory/README.md` is the index and conventions file. Seed `agents/ceo`, `agents/pm`, `agents/coder`, and `agents/fixer`, each with `README.md`, plus `lessons/.gitkeep` and `tacit/.gitkeep`; seeds contain no fabricated lessons. The index has exactly one row per agent folder, seeded or self-created, and one row per promoted record file under `lessons/` and `tacit/`; there are no directory-level rows for `lessons/` or `tacit/`, and the empty trees are described in the layout, not indexed. Any other agent self-creates `agents/<agent>/README.md` from the template in `.ai/memory/README.md` on first capture only, appending exactly one index row for its own folder with a read-when hint (the R4 exception). (Design 2, 3; preflight template path)
- **R8 Promoted records.** `lessons/` and `tacit/` use one record file per lesson or tacit fragment with the frontmatter defined in `.ai/memory/README.md`, written under YAML 1.2 core schema semantics: `statement`, `applies_when`, and `created` are quoted strings or block scalars, and `created` stays a string, not a date scalar. Ids are a monotonic next free id per prefix and year, unique across both directories and never reused, including after supersession or pruning; duplicate or reused ids are rejected, never silently reallocated. Validation scans both `id` and `supersedes`, so a pruned superseded id cannot be reused. A replacing record links the old id in `supersedes` and sets the old status to `superseded`. (Design 2; preflight id uniqueness)
- **R9 Consolidation skill.** `.opencode/skills/consolidate-memory/SKILL.md` exists, its `name` matches the folder, and its `description` is a quoted YAML scalar because it contains a colon-space; the frontmatter parses with a real YAML parser. `.opencode/README.md` inventories the skill. The skill covers inventory, evidence validation, the R4 operation set (dedup and merge, demote or drop evidence-less entries, supersede, stale prune with reason, promotion, cap splits, index rebuild), and a report naming every cross-folder edit. Facts and decisions are handed to the owning agent (`@doc-syncer` for `doc/spec`, `@decision-advisor` for `doc/decisions`); the skill never edits spec or decision records unilaterally, and policies and security rules remain owner-only. (Design 4; preflight YAML and promotion authority)
- **R10 Conflict reality.** Documentation never claims conflict-free memory; same-role worktrees can edit the same agent folder, and shared surfaces (`lessons/`, `tacit/`, the index) are consolidation-only, apart from the R4 first-capture row, but still merge-conflict capable. Memory changes ride normal PRs and conflicts resolve by R5. (Preflight conflict reality)
- **R11 Blast radius.** No changes to `.opencode/agent/**`, `.opencode/command/**`, runtime configuration, security policy, `scripts/**`, CI, or generated `.ados-claude/**`; no new redistributable docs and no `doc/guides/**` change; no `doc/spec` feature update; the pm-notes document schema and existing corpus are unchanged. (Design 5)
- **R12 Validation and authoring hygiene.** Newly authored artifacts contain no em dash (U+2014) or en dash (U+2013); existing pm-notes corpus lint, doc-distribution checks, and generated-plugin drift checks stay green. (Preflight gates and dashes)

## Acceptance criteria

- **AC-1 Kernel covers the preflight rules.** Given the delivered AGENTS.md, when the Agent memory section is checked against R1 through R10, then every rule is present in that single section, including the capture bar, cross-folder exception, advisory trust, evidence-over-recency, reviewer independence, id uniqueness, and no conflict-free claim; and no AGENTS.md hunk exists outside that section. Check: content assertions plus a scoped diff.
- **AC-2 Tree shape.** Given the repository tree, when checked against R7, then the README, four seed READMEs, `lessons/.gitkeep`, and `tacit/.gitkeep` exist; the index has exactly one row per agent folder (seeded or self-created) and one row per promoted record file under `lessons/` and `tacit/`, each with a read-when hint, with no directory-level rows for `lessons/` or `tacit/`; and no other agent folder exists. Check: file existence and index coverage.
- **AC-3 Seeds are not fabricated (R7).** Given the seed READMEs, when inspected, then each contains a charter and capture instructions only, with zero dated lesson entries or invented evidence. Check: content assertion.
- **AC-4 Missing-agent path works.** Given the README template, when a non-seeded agent follows the first-capture rule in a disposable tree, then it can create its own folder and README from the template and append exactly one index row for its own folder, on first capture only, without editing another folder or any later index row. Check: disposable manual dry run.
- **AC-5 Skill frontmatter parses (R9).** Given SKILL.md, when its frontmatter is parsed with a real YAML parser, then parsing succeeds, `name` equals `consolidate-memory`, and `description` is a quoted scalar containing a colon-space. Check: parser run plus assertions.
- **AC-6 Skill is inventoried (R9).** Given `.opencode/README.md`, when the skills inventory is read, then it lists `consolidate-memory` at the matching path, and no agent or command inventory line changed. Check: content assertion.
- **AC-7 Consolidation dry-run scenarios (R4, R9).** Given a disposable synthetic `.ai/memory` copy with duplicate entries, an evidence-less entry, a stale contradiction, an over-cap README, a stale index line, a matching `applies_when` record, and a clean tree, when consolidation runs, then it satisfies AC-7.1 through AC-7.6 and reports every cross-folder edit. Check: disposable manual dry run; seed tree hash unchanged.
- **AC-7.1 Dedup merge (R4, R9).** Given duplicate entries, when consolidation merges them, then evidence is concatenated or unioned, the merged statement preserves the original substance, and no statement is paraphrased. Check: before/after content comparison.
- **AC-7.2 Evidence-less entry (R4, R9).** Given an entry with no evidence, when consolidation processes it, then the entry is demoted or dropped and the reason is recorded. Check: dry-run assertion.
- **AC-7.3 Stale prune (R4, R9).** Given a stale contradicted entry, when consolidation prunes it, then the recorded reason names the contradiction. Check: dry-run assertion.
- **AC-7.4 Cap split (R4, R9).** Given an over-cap folder, when consolidation splits it into topic files, then content is moved without substantive rewording. Check: before/after content comparison.
- **AC-7.5 Index rebuild and read-when (R4, R9).** Given a stale index line, when consolidation rebuilds the index, then every row has a read-when hint, and the step log names only the records whose `applies_when` matches, which is the evidence that unrelated records were not loaded. Check: index assertion plus step log.
- **AC-7.6 Clean-tree no-op (R4, R9).** Given an already clean tree, when consolidation runs, then it makes no change and the tree hash is unchanged. Check: dry-run assertion.
- **AC-8 Curator limits hold (R4, R9).** Given a disposable tree, when consolidation is asked to paraphrase another agent's lesson, edit a fact or decision record, or change a policy, then it refuses or hands off to the owning agent, reports the handoff, and leaves the target content unchanged; a permitted merge may concatenate or union evidence but not reword. Check: negative dry-run assertions.
- **AC-9 Conflict and truth rules (R5, R10).** Given the kernel and README text, when searched for conflict-free claims and conflict resolution rules, then no text claims conflict-free memory, and resolution uses evidence and current repo or spec truth, not a newer date alone; a newer entry is a candidate, not authority. Check: content assertion plus scenario review.
- **AC-10 Reviewer independence (R6).** Given the kernel and README, when reviewer rules are read, then `reviewer`, `readiness-reviewer`, and `decision-critic` have no episodic memory and are barred from coder reasoning or another agent's episodic memory, and memory is labeled advisory and unable to override instructions, repo rules, or current code and spec truth. Check: content assertion.
- **AC-11 Ids are unique and never reused (R8).** Given records in `lessons/` and `tacit/`, when consolidation validates ids, then allocation is a monotonic next free id per prefix and year, no id appears twice across directories, and a superseded or pruned id is never reused because validation scans both `id` and `supersedes`; a dry-run fixture with a duplicate or reused id is rejected, never silently reallocated. Check: scan plus disposable fixture.
- **AC-12 Forbidden paths unchanged (R11).** Given the delivered diff against the base commit, when paths are checked, then zero changes exist under `.opencode/agent`, `.opencode/command`, runtime config, security policy, `scripts`, CI, `.ados-claude`, `doc/guides`, and `doc/spec`; modified existing files are limited to AGENTS.md (one section) and `.opencode/README.md` (inventory addition); and newly added files under `.ai/memory/**` and `.opencode/skills/**` contain no copyright or source header lines. Check: diff path assertion plus header scan.
- **AC-13 No em or en dashes (R12).** Given the change artifacts (spec, test plan, plan, pm-notes), newly added AGENTS.md lines, and all new files under `.ai/memory` and `.opencode/skills`, when scanned for U+2014 and U+2013, then zero matches occur. Check: Unicode scan.
- **AC-14 Gates stay green (R12).** Given the delivered branch, when existing pm-notes corpus lint, doc-distribution checks, and generated-plugin drift checks run, then all pass with no new exclusions and no regenerated `.ados-claude` output. Check: existing suites and CI gates.
- **AC-15 Merge and closure (ticket).** Given the approved delivery, when the change closes, then the owner or CEO merges the PR to `main-tools` and the ticket is closed with a delivery summary; PM creates the PR and does not merge. Check: PR state plus ticket closure.

## Non-functional requirements

- **NFR-1**: Seed READMEs stay at or under 150 lines each; the index stays at or under 200 lines; the skill stays at or under 150 lines.
- **NFR-2**: Skill frontmatter parses on 100 percent of runs, and index coverage is 100 percent: every agent folder (seeded or self-created) and every promoted record file under `lessons/` and `tacit/` has exactly one row.
- **NFR-3**: This is documentation and skill content only: zero runtime behavior, latency, availability, or storage changes.

## Constraints and scope boundaries

- Repo-internal operating documentation only: no product API, event, data model, or external integration change.
- This change is repo operating documentation, not a new product feature area; no `doc/spec` feature update is required, R11 remains a hard boundary, and phase 7 is a true no-op.
- The pm-notes artifact schema is reused unchanged; this change introduces no new runtime or pm-notes machine schema; the memory record frontmatter is documentation-only until future lint.
- Four seed folders only; all other agents self-create on first capture under the R4 exception.
- Consolidation is the single cross-folder and shared-surface write path, apart from the R4 first-capture row.
- The human owner retains authority over policies and security rules.
- No license headers are added by agents; header tooling remains the only writer.
- PM creates the PR and does not merge; the owner or CEO merges to `main-tools` and the ticket is closed with a delivery summary.

## Risks

| ID | Risk | Impact | Probability | Mitigation | Residual |
|---|---|---|---|---|---|
| RSK-1 | Memory becomes noisy autobiography and grows past caps. | Medium | Medium | Capture bar, two-occurrence rule, caps, consolidation report. | Low |
| RSK-2 | Same-role worktrees or shared surfaces conflict. | Low | Medium | No conflict-free claim, consolidation-only shared writes, evidence-based resolution, normal PR conflicts. | Low |
| RSK-3 | Author reasoning contaminates reviewers or memory acts as instructions. | High | Low | Reviewer exclusions, advisory label, JIT loading, untrusted-data rule. | Low |
| RSK-4 | New agents skip their memory folder or index line. | Low | Medium | Template plus first-capture rule, index coverage check. | Low |
| RSK-5 | A colon-space in the skill description breaks YAML loading. | Medium | Low | Quoted scalar plus real-parser acceptance check. | Low |
| RSK-6 | Scope creeps into prompts, scripts, CI, or generated plugin output. | Medium | Low | Explicit non-goals, forbidden path check, green drift gates. | Low |

## Open questions

None blocking. Deferred follow-ups: automated index coverage lint belongs to the future M2-S8 memory lint, and whether generated plugins should project `.opencode/skills` is a future tooling change; if pursued, decision needed: consult `@decision-advisor`.

## Documentation impacts

- `AGENTS.md`: one new Agent memory section, no other changes.
- `.ai/memory/README.md`: index, conventions, record format, promotion table, and the first-capture template.
- `.ai/memory/agents/{ceo,pm,coder,fixer}/README.md`: seed entry points with no fabricated lessons.
- `.ai/memory/lessons/.gitkeep` and `.ai/memory/tacit/.gitkeep`: visible empty promoted-record trees, described in the layout and not indexed as directories.
- `.opencode/skills/consolidate-memory/SKILL.md`: new consolidation skill.
- `.opencode/README.md`: one skills inventory entry.
- No `doc/spec` feature update because this change is repo operating documentation, not a new product feature area; phase 7 is a true no-op. No `doc/guides` change, no decision record, no generated plugin output, and no new redistributable document.

## Revision log

- v1.1 (2026-10-31): Targeted revision resolving readiness iteration 1 findings F-1, F-2, F-3, F-7, F-8, F-12, F-13, F-15, F-18, F-19, and F-22, and reinforcing R3, R5, R6, and R10.
