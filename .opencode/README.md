# OpenCode Tooling (Repo)

Repo-local OpenCode agents, commands, and skills.

## Layout (This Repo)

- Agents: `.opencode/agent/*.md`
- Commands: `.opencode/command/*.md`
- Skills: `.opencode/skills/<skill-name>/SKILL.md`

Note: OpenCode upstream docs use `.opencode/agents/` and `.opencode/commands/`. This repo uses singular folders.

## Conventions

- Naming: kebab-case; agent/command name = filename; skill name = folder name.
- Descriptions: frontmatter `description` stays short (usually 3-10 words).
- Commands: accept args via `$ARGUMENTS` and optional `$1`, `$2`, ...
- Commands: prefer `subtask: true` for non-trivial work (avoid polluting main context).
- Context: keep `@path` includes narrow; keep `!` shell injections small and deterministic.
- Repo rules: if a tool runs repo workflows (build/test/docs), follow `AGENTS.md`.
- Consistency: if a new tool overlaps an existing workflow area (change lifecycle, quality gates, docs, UI), match the established patterns unless explicitly diverging.
- Prompt tuning: when updating existing tools, preserve intent and keep diffs minimal.
- Tool suites: when a workflow spans multiple tools, tune them together (contracts, arguments, outputs, delegation).
- Hygiene: update this file whenever you add/rename/remove a tool or materially change its intent.
- PM tracker config: `@pm` reads `.ai/agent/pm-instructions.md` (repo-specific Jira/GitHub workflow).
- PM delegation: `@pm` delegates debugging to `@fixer` and command execution to `@runner`.
- Pre-PR gate (autopilot): `@pm` runs `@reviewer` + `@doc-syncer` before `@pr-manager`.

## Agents

- `architect`: architecture decisions and ADR authoring
- `committer`: create one Conventional Commit
- `delivery-agent`: orchestrate change delivery end-to-end
- `designer`: apply visual design system
- `doc-syncer`: reconcile system docs with change
- `editor`: rewrite/translate content per repo guidelines
- `executor`: execute implementation plan phases
- `fixer`: reproduce and fix failures
- `image-reviewer`: analyze screenshots and visual artifacts
- `plan-writer`: author change implementation plans
- `pm`: orchestrate changes; manage tickets via MCP (reads `.ai/agent/pm-instructions.md`)
- `pr-manager`: create/update PR/MR for branch; enriches description with ticket context via MCP
- `reviewer`: review change vs spec/plan
- `runner`: run commands and capture logs
- `spec-writer`: author change specifications
- `test-plan-writer`: author change test plans
- `toolsmith`: create and tune OpenCode tooling

## Commands

- `/check`: run quality gates (no fixes)
- `/check-fix`: run quality gates and fix failures
- `/commit`: delegate a single Conventional Commit
- `/design`: generate/update visual identity assets
- `/plan-change`: plan a change (prep context)
- `/plan-decision`: plan a technical decision (prep context)
- `/pr`: create/update PR/MR and sync title/description (`tmp/pr/<branch>/description.md`, via `@pr-manager`); fetches ticket context from Jira/GitHub when `workItemRef` is detected
- `/review`: review a change vs spec/plan
- `/review-deep`: deeper review vs spec/plan
- `/run-plan`: execute an implementation plan
- `/sync-docs`: reconcile system specs from a change
- `/write-adr`: write an ADR from planning context
- `/write-plan`: generate an implementation plan
- `/write-spec`: generate a change spec
- `/write-test-plan`: generate a change test plan

---

## Naming Rename Map (2026-01)

Reference for the rename from old to new names. Rationale: shorter names, consistent verb patterns, drop redundant prefixes.

### Agents

| Old Name                       | New Name           | Rationale                                |
| ------------------------------ | ------------------ | ---------------------------------------- |
| `change-delivery-orchestrator` | `delivery-agent`   | Shorter; "orchestrator" implied          |
| `change-reviewer`              | `reviewer`         | Drop redundant `change-` prefix          |
| `change-spec-writer`           | `spec-writer`      | Drop redundant `change-` prefix          |
| `change-test-plan-writer`      | `test-plan-writer` | Drop redundant `change-` prefix          |
| `content-editor`               | `editor`           | Shorter                                  |
| `conventional-committer`       | `committer`        | Shorter                                  |
| `debug-test-fixer`             | `fixer`            | Shorter; "debug/test" implied by context |
| `image-critique-agent`         | `image-reviewer`   | Drop redundant `-agent` suffix           |
| `implementation-plan-writer`   | `plan-writer`      | Shorter; "implementation" implied        |
| `opencode-toolsmith`           | `toolsmith`        | Drop redundant `opencode-` prefix        |
| `plan-executor`                | `executor`         | Shorter                                  |
| `product-manager`              | `pm`               | Shorter; universally understood          |
| `run-logs-runner`              | `runner`           | Cleaner                                  |
| `system-spec-updater`          | `doc-syncer`       | Aligns with `/sync-docs` command         |
| `visual-designer`              | `designer`         | Shorter                                  |
| `architect`                    | `architect`        | _(unchanged)_                            |

### Commands

| Old Name                          | New Name           | Rationale                         |
| --------------------------------- | ------------------ | --------------------------------- |
| `/start-change-planning`          | `/plan-change`     | Shorter; verb-first               |
| `/document-change-spec`           | `/write-spec`      | Shorter; `document-*` verbose     |
| `/document-implementation-plan`   | `/write-plan`      | Consistent `/write-*` family      |
| `/document-change-test-plan`      | `/write-test-plan` | Consistent `/write-*` family      |
| `/execute-plan`                   | `/run-plan`        | Shorter; `run-*` natural CLI verb |
| `/review-change`                  | `/review`          | Shorter; context implies "change" |
| `/review-change-carefully`        | `/review-deep`     | Shorter                           |
| `/update-system-spec-from-change` | `/sync-docs`       | Much shorter                      |
| `/start-technical-decision`       | `/plan-decision`   | Parallel to `/plan-change`        |
| `/document-technical-decision`    | `/write-adr`       | Shorter; ADR is the artifact      |
| `/run-quality-gates`              | `/check`           | Shorter; natural validation verb  |
| `/run-and-fix-quality-gates`      | `/check-fix`       | Shorter; clear intent             |
| `/mr-summary`                     | `/pr`              | Shorter; aligns with common usage |
| `/visual-design`                  | `/design`          | Shorter                           |
| `/commit`                         | `/commit`          | _(unchanged)_                     |

### Naming Principles Applied

1. **Verb-first for commands**: `/plan-*`, `/write-*`, `/run-*`, `/check`, `/review`, `/sync-*`
2. **Short role names for agents**: Drop prefixes (`change-`, `opencode-`) and suffixes (`-agent`)
3. **Consistent families**: `/write-spec`, `/write-plan`, `/write-test-plan`, `/write-adr`
4. **Align command ↔ agent names**: `/run-plan` → `executor`, `/sync-docs` → `doc-syncer`

---

## Refactor Plan (2026-01)

This plan aligns all agents and commands with:

1. **Unified Change Convention** (`doc/guides/unified-change-convention-tracker-agnostic-specification.md`): `workItemRef` identifiers (e.g., `PDEV-123`, `GH-456`), new folder/file naming, tracker-agnostic discovery rules.
2. **Prompting best practices** from `@toolsmith`: XML structure for Claude models, tight constraints, minimal verbosity, proper frontmatter.
3. **New agent/command names**: Update all internal cross-references to use new names.

### Global Changes (Apply to All)

| Issue                                                                            | Fix                                                                                    |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Old agent/command references (`@product-manager`, `/document-change-spec`, etc.) | Replace with new names (`@pm`, `/write-spec`, etc.)                                    |
| Old path conventions (`doc/changes/<groupFolder>/<zeroPad3>-<slug>/`)            | Replace with new convention (`doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/`) |
| Old filename conventions (`chg-<zeroPad3>-spec-<slug>.md`)                       | Replace with new convention (`chg-<workItemRef>-spec.md`)                              |
| Numeric `changeNumber` inputs                                                    | Accept `workItemRef` (e.g., `PDEV-123`, `GH-456`)                                      |
| Verbose Markdown prose in prompts                                                | Tighten to XML structure (for Claude models) or concise Markdown                       |
| Missing `subtask: true` on commands                                              | Add where appropriate to avoid context pollution                                       |

### Agent Refactor Checklist

| Agent              | Priority | Status  | Changes Required                                                                                                                                                                                                                            |
| ------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pm`               | HIGH     | ✅ DONE | Add MCP ticket operations (read/write issues); update discovery to use `workItemRef`; update delegation references to new agent names (`@spec-writer`, `@plan-writer`, `@test-plan-writer`, `@delivery-agent`); remove `CHG-###` references |
| `delivery-agent`   | HIGH     | ✅ DONE | Update all delegation references to new agent names; update path discovery for new folder convention; accept `workItemRef` instead of numeric ID                                                                                            |
| `spec-writer`      | HIGH     | ✅ DONE | Update `<directory_rules>` and `<branch_rules>` for new convention; accept `workItemRef`; update `<front_matter_rules>` to use `workItemRef`; remove slug from filenames                                                                    |
| `plan-writer`      | HIGH     | ✅ DONE | Same as `spec-writer`; update cross-references                                                                                                                                                                                              |
| `test-plan-writer` | HIGH     | ✅ DONE | Same as `spec-writer`; update cross-references                                                                                                                                                                                              |
| `executor`         | HIGH     | ✅ DONE | Update path discovery; update agent references (`@runner`, `@fixer`); accept `workItemRef`                                                                                                                                                  |
| `reviewer`         | MEDIUM   | ✅ DONE | Update path discovery; update agent references                                                                                                                                                                                              |
| `doc-syncer`       | MEDIUM   | ✅ DONE | Update path discovery; accept `workItemRef`                                                                                                                                                                                                 |
| `architect`        | MEDIUM   | ✅ DONE | Update references to new command names (`/write-adr`)                                                                                                                                                                                       |
| `committer`        | LOW      | ✅ DONE | No convention changes; verify agent name in frontmatter                                                                                                                                                                                     |
| `runner`           | LOW      | ✅ DONE | No convention changes; minimal updates                                                                                                                                                                                                      |
| `fixer`            | LOW      | ✅ DONE | No convention changes; update agent references if any                                                                                                                                                                                       |
| `designer`         | LOW      | ✅ DONE | No convention changes; minimal updates                                                                                                                                                                                                      |
| `editor`           | LOW      | ✅ DONE | No convention changes; minimal updates                                                                                                                                                                                                      |
| `image-reviewer`   | LOW      | ✅ DONE | No convention changes; minimal updates                                                                                                                                                                                                      |
| `toolsmith`        | SKIP     | ⏭️ SKIP | Already up to date (this agent defines the conventions)                                                                                                                                                                                     |

### Command Refactor Checklist

| Command            | Priority | Status  | Changes Required                                                                                                                                                         |
| ------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/plan-change`     | HIGH     | ✅ DONE | Update discovery rules for `workItemRef`; update output `<change_planning_summary>` format; remove numeric-only changeNumber support; update references to `/write-spec` |
| `/write-spec`      | HIGH     | ✅ DONE | Update `<directory_rules>`, `<branch_rules>`, `<front_matter_rules>` for new convention; accept `workItemRef`; remove slug from filename                                 |
| `/write-plan`      | HIGH     | ✅ DONE | Same as `/write-spec`                                                                                                                                                    |
| `/write-test-plan` | HIGH     | ✅ DONE | Same as `/write-spec`                                                                                                                                                    |
| `/run-plan`        | HIGH     | ✅ DONE | Update path discovery; accept `workItemRef`; update agent reference (`agent: executor`)                                                                                  |
| `/review`          | MEDIUM   | ✅ DONE | Update path discovery; accept `workItemRef`                                                                                                                              |
| `/review-deep`     | MEDIUM   | ✅ DONE | Same as `/review`                                                                                                                                                        |
| `/sync-docs`       | MEDIUM   | ✅ DONE | Update path discovery; accept `workItemRef`                                                                                                                              |
| `/write-adr`       | MEDIUM   | ✅ DONE | No folder convention changes (ADRs use `doc/adr/`); update command references                                                                                            |
| `/plan-decision`   | MEDIUM   | ✅ DONE | Update command references (`/write-adr`)                                                                                                                                 |
| `/pr`              | LOW      | ⏭️ SKIP | No convention changes needed                                                                                                                                             |
| `/commit`          | LOW      | ✅ DONE | No convention changes; verify agent reference (`agent: committer`)                                                                                                       |
| `/check`           | LOW      | ✅ DONE | Update agent references (`@runner`, `/check-fix`, `@fixer`)                                                                                                              |
| `/check-fix`       | LOW      | ✅ DONE | Update agent references (`@fixer`, `@committer`)                                                                                                                         |
| `/design`          | LOW      | ⏭️ SKIP | No convention changes needed                                                                                                                                             |

### Detailed Refactor Instructions

#### Phase 1: Core Convention Updates (HIGH priority)

For each HIGH-priority agent/command:

1. **Update frontmatter**:
   - Ensure `description` is ≤10 words
   - Update `agent:` reference if command delegates to renamed agent
   - Consider adding `subtask: true` for heavy commands

2. **Update discovery/resolution rules**:
   - Replace: `floor(changeNumber / 100) + "xx"` groupFolder logic
   - With: `YYYY-MM` month grouping
   - Replace: `<changeNumber>-<slug>` folder naming
   - With: `YYYY-MM-DD--<workItemRef>--<slug>` folder naming
   - Add: `workItemRef` parsing (uppercase prefix + hyphen + number, e.g., `PDEV-123`, `GH-456`)

3. **Update filename conventions**:
   - Replace: `chg-<zeroPad3>-spec-<slug>.md`
   - With: `chg-<workItemRef>-spec.md`
   - Same for `-plan.md` and `-test-plan.md`

4. **Update agent cross-references**:
   - `@product-manager` → `@pm`
   - `@change-delivery-orchestrator` → `@delivery-agent`
   - `@change-spec-writer` → `@spec-writer`
   - `@implementation-plan-writer` → `@plan-writer`
   - `@change-test-plan-writer` → `@test-plan-writer`
   - `@plan-executor` → `@executor`
   - `@change-reviewer` → `@reviewer`
   - `@system-spec-updater` → `@doc-syncer`
   - `@run-logs-runner` → `@runner`
   - `@debug-test-fixer` → `@fixer`
   - `@visual-designer` → `@designer`
   - `@content-editor` → `@editor`
   - `@image-critique-agent` → `@image-reviewer`
   - `@conventional-committer` → `@committer`

5. **Update command cross-references**:
   - `/document-change-spec` → `/write-spec`
   - `/document-implementation-plan` → `/write-plan`
   - `/document-change-test-plan` → `/write-test-plan`
   - `/execute-plan` → `/run-plan`
   - `/review-change` → `/review`
   - `/review-change-carefully` → `/review-deep`
   - `/update-system-spec-from-change` → `/sync-docs`
   - `/start-change-planning` → `/plan-change`
   - `/start-technical-decision` → `/plan-decision`
   - `/document-technical-decision` → `/write-adr`
   - `/run-quality-gates` → `/check`
   - `/run-and-fix-quality-gates` → `/check-fix`
   - `/mr-summary` → `/pr`
   - `/visual-design` → `/design`

#### Phase 2: PM Agent MCP Integration

Add to `pm` agent:

- MCP tool usage for Jira: `jira_get_issue`, `jira_create_issue`, `jira_transition_issue`, `jira_add_comment`
- MCP tool usage for GitHub: `gh_get_issue`, `gh_create_issue`, `gh_update_issue`, `gh_add_comment`
- Discovery rule: if no `workItemRef` provided, query tracker via MCP to find active/highest-priority issue
- Status sync: update ticket status at lifecycle milestones

#### Phase 3: Prompt Efficiency Improvements

For all agents/commands:

1. Use XML tags for structure (for Claude models)
2. Remove redundant prose; use bullet points
3. Keep instructions tight; avoid repetition
4. Remove embedded templates that duplicate content
5. Use `<constraints>` blocks for hard rules
6. Use `<process>` blocks for step-by-step flows

### Execution Order

1. `pm` (orchestrator; sets the pattern)
2. `delivery-agent` (main coordinator)
3. `spec-writer` + `/write-spec` (together)
4. `plan-writer` + `/write-plan` (together)
5. `test-plan-writer` + `/write-test-plan` (together)
6. `executor` + `/run-plan` (together)
7. `/plan-change` (standalone command)
8. `reviewer` + `/review` + `/review-deep`
9. `doc-syncer` + `/sync-docs`
10. Remaining LOW-priority items

### Validation After Refactor

- [x] All agents reference only new agent names
- [x] All commands reference only new command names
- [x] All path patterns match new convention (`YYYY-MM/YYYY-MM-DD--workItemRef--slug/`)
- [x] All filename patterns match new convention (`chg-<workItemRef>-spec.md`)
- [x] `workItemRef` format is validated (uppercase prefix + hyphen + digits)
- [x] No references to `CHG-###` or `zeroPad3` numeric-only identifiers
- [ ] `@pm` can read/write tickets via MCP _(MCP integration is documented; runtime testing pending)_
- [x] Discovery rules work for both Jira (`PDEV-123`) and GitHub (`GH-456`) formats
