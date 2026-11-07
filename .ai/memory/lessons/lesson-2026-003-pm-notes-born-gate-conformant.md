---
id: "lesson-2026-003"
kind: "lesson"
scope: "repo"
statement: "Write pm-notes gate-conformant from creation: full ISO timestamps with time zone (never date-only), worktree \".\", never absolute worktree paths; repairing format mid-lane costs a fix-forward iteration through lint and privacy gates."
evidence: "PR #244 pm-notes retro (date-only timestamps and absolute worktree path required coder repair during finalize); the pm-notes lint and corpus checks shipped in M0 precisely for this defect class (GH-179 delivery)"
source: "merged_pr"
created_by: "consolidate-memory"
created: "2026-11-06"
status: "candidate"
supersedes: []
applies_when: "any agent creates or edits chg-<ref>-pm-notes.yaml"
---
The lint exists because this mistake class recurred in M0; GH-221 recurred against it in M1. Born-conformant beats repaired-later.
