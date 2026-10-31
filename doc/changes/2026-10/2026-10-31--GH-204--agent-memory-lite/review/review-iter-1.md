# Code Review Iteration 1 - GH-204

Verdict: PASS
Work Item: GH-204
Branch: feat/GH-204/agent-memory-lite
Base: 9a70aaf
Reviewed HEAD: 9b3d8bb
Mode: local
Date: 2026-10-31
Iteration: 1

## Verdict Summary

PASS. The delivered change matches the spec (AC-1 through AC-14) and the plan. The
AGENTS.md kernel is exactly one section with no other change; the `.ai/memory` tree,
four seed entry points, index, and `consolidate-memory` skill are present and correct;
the forbidden-path, license-header, dash, YAML-parse, and existing-gate checks all pass.
AC-15 merge and closure is intentionally pending at phase 11 and is not a review failure.
No blocker or major finding was found. One minor traceability item and two informational
notes are recorded below; none require remediation before phase 9.

## Dimension Verdicts

- A. Spec and plan compliance: PASS
- B. Content quality and safety: PASS

## Finding Counts

- Blocker (schema critical): 0
- Major (schema high): 0
- Minor (schema medium): 1
- Info (schema low/info): 2
- Total: 3

## Spec Compliance

| AC | Result | Evidence |
|---|---|---|
| AC-1 kernel covers R1..R10, one scoped hunk | PASS | `git diff -U0 9a70aaf..HEAD -- AGENTS.md` shows one hunk `@@ -136,0 +137,14 @@`, additions only, all inside `## Agent memory`; exactly one such heading |
| AC-2 tree shape and index granularity | PASS | README, four seed READMEs, `lessons/.gitkeep`, `tacit/.gitkeep`; 4 index rows = 4 agent folders, 0 record files, zero directory rows |
| AC-3 seeds not fabricated | PASS | Seeds are 12 to 13 lines, charter plus comment-only Lessons template, no dated entries or invented evidence |
| AC-4 missing-agent path | PASS | First-capture template present with charter, Lessons, evidence format, advisory label, cap/split pointer |
| AC-5 skill frontmatter parses | PASS | PyYAML `safe_load`: name equals `consolidate-memory`, description is a quoted scalar with a colon-space, 15 words |
| AC-6 skill inventoried | PASS | `.opencode/README.md` adds one `## Skills` section with one entry; additions only, no agent or command line changed |
| AC-7 and AC-7.1..AC-7.6 consolidation scenarios | PASS | Skill steps and curator operation set cover merge, demote/drop, supersede, prune with reason, cap split, index rebuild, read-when log, clean-tree no-op; dry-run evidence recorded at plan 4.3 |
| AC-8 curator limits | PASS | Skill hard rules and routing forbid paraphrasing, writing doc/spec or doc/decisions, and policy changes; handoffs to @doc-syncer and @decision-advisor |
| AC-9 conflict and truth rules | PASS | Kernel and README say evidence and current repo/spec truth decide, newer is a candidate; "never claim conflict-free" present in all three surfaces |
| AC-10 reviewer independence | PASS | Kernel and README and skill name reviewer, readiness-reviewer, decision-critic; no episodic memory; advisory untrusted data |
| AC-11 ids unique and never reused | PASS | Monotonic next free per prefix and year, unique across both trees, scan `id` and `supersedes`, reject never reallocate; see F-3 nuance |
| AC-12 forbidden paths and headers | PASS | `git diff --name-status` limits modified files to AGENTS.md and .opencode/README.md; added files only under .ai/memory, .opencode/skills, and the change folder; no copyright or source header line in new memory/skill files |
| AC-13 no em or en dashes | PASS | Scan of added files, added diff lines, and change artifacts returns zero U+2013/U+2014 |
| AC-14 gates stay green | PASS | pm-notes corpus 17/17, doc-distribution 81/81 no drift, plugin build no `.ados-claude` drift, `git diff --check` clean |
| AC-15 merge and closure | PENDING | Phase 11 lifecycle: PM creates PR to `main-tools`, owner or CEO merges, ticket closed; pm-notes `pr_creation` is null by design at this phase |

## Plan Task Audit

- Checked tasks: 25 of 26 in the plan (`- [x]`).
- Open tasks: only 4.5, explicitly deferred to PM-owned phase 11 (AC-15 evidence).
- DONE_BUT_UNCHECKED: none.
- CHECKED_BUT_MISSING: none found; checked tasks 1.7, 2.8, 3.5, and 4.1 through 4.6 are corroborated by the diff and the gate runs above.
- Plan Status: COMPLETE for coder phases 1 through 4; 4.5 is PM-owned.

## Checks Executed

| Check | Result |
|---|---|
| `git diff --name-only 9a70aaf..HEAD` and forbidden-prefix filter | PASS, no forbidden path |
| `git diff -U0 9a70aaf..HEAD -- AGENTS.md` | PASS, one hunk, 14 added lines, additions only |
| `.opencode/README.md` diff | PASS, additions only, no agent/command line touched |
| PyYAML parse of SKILL.md frontmatter plus non-vacuity | PASS, name and quoted 15-word description; unquoted colon-space raises ScannerError |
| PyYAML parse of the README record template | PASS, `statement`, `applies_when`, `created` stay strings |
| Index coverage script | PASS, 4 rows for 4 folders, 0 record files, no stale rows |
| Seed honesty scan | PASS, comments only, no dated lesson or invented evidence |
| Em/en dash scan on new files, added lines, and change artifacts | PASS, zero matches |
| License/source header scan on new memory and skill files | PASS, none; `source: "review_verdict"` is a record-frontmatter example field, not a header |
| `bun test tests/behaviour/pm-notes-corpus.test.ts` | PASS, 17 pass, 0 fail |
| `bash scripts/.tests/test-doc-distribution.sh` | PASS, 81 in-scope docs, no drift |
| `./scripts/build-claude-plugin.sh --verbose` plus staged diff | PASS, no `.ados-claude` drift; worktree restored clean |
| `git diff --check 9a70aaf..HEAD` | PASS, clean |

## Findings

### F-1 [minor] Test plan execution log is not populated after delivery

Location: `doc/changes/2026-10/2026-10-31--GH-204--agent-memory-lite/chg-GH-204-test-plan.md:201`

The test plan's section 10 still reads `001..015 | Not run | Populated at delivery`, while
the plan's Phase 4 execution log records every check as PASS. The delivery evidence exists,
but a reader who opens only the test plan sees "Not run", which is a traceability
inconsistency for the DoD gate.

Suggestion: populate the test plan execution log from the Phase 4 results, or add a note
that the plan Phase 4 log is the authoritative evidence until AC-15 lands. Suggested
remediation owner: Phase 4 (validation), with a test_planning echo.

### F-2 [info] Kernel defers R7 seeding detail to the README

Location: `AGENTS.md:145`

The kernel section names the tree root, the per-agent README, the index, `lessons/`, and
`tacit/`, and it states the first-capture self-index-row rule. It does not literally name
the four seeded agents (`ceo`, `pm`, `coder`, `fixer`) or restate "one row per agent folder
and one row per promoted record file"; those live in `.ai/memory/README.md`, which the
kernel points to. This is consistent with AC-1's rule framing and with the README owning
tree detail, so no action is required. It is noted because TC-MEMORY-003 phrases R7 as
"tree and seeding", and the seeding list is only observable in the README.

Suggestion: optional. Either add a short clause to the kernel naming the hot-path seeds, or
leave as is and treat the README as the authoritative tree shape.

### F-3 [info] Id-reuse wording and the scan mechanism cover superseded-then-pruned ids

Location: `.ai/memory/README.md:99`

The README says ids are "never reused, including after supersession or pruning" and that
validation over `id` and `supersedes` makes "a pruned superseded id" unreusable. That is
true when a superseded record is later pruned, because the superseding record retains the
old id in `supersedes`. A record deleted directly by prune or drop with no surviving
`supersedes` reference is not tracked by that scan. The skill's "supersede over delete for
anything that once held authority" rule mitigates this in practice, so no action is
required. It is noted so the intent is explicit before future memory lint.

Suggestion: optional. State that any directly pruned id is recorded in the curator report
(or a tombstone), or narrow the wording to superseded ids.

## Residual Readiness Items

The readiness iteration 2 report left three minor and four nit advisory items that were
explicitly non-blocking. They are not folded into the artifacts (plan task 3.5 wording,
TC-MEMORY-014 YAML 1.2 hedge, the squash-merge note in AC-15/TC-MEMORY-015, and the
forward reference from phase 1 to phase 2). They remain advisory and do not affect this
PASS. They can be folded into a later authoring pass if the owner wants them closed.

## Next Step

PROCEED. No remediation is required before phase 9. F-1 is an optional traceability fix
owned by Phase 4; F-2 and F-3 are informational. AC-15 remains the phase 11 lifecycle item.

## Reviewer Independence

This review was read-only for source and change artifacts. The reviewer did not load coder
reasoning or any agent's episodic memory, and used only the spec, test plan, plan, ticket,
current repo truth, and the checks above. The only files written are this record and the
companion YAML. No source, prompt, config, script, CI, or generated plugin file was changed.
