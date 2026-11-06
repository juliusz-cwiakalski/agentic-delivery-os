---
id: "lesson-2026-002"
kind: "lesson"
scope: "repo"
statement: "The github-mcp server's write tools fail with 'Requires authentication' while its reads work; all tracker writes (labels, comments, transitions) must go through the gh CLI, which is authenticated with repo scope."
evidence: "PR #244 pm-notes (update_issue probe failed, reads OK); PR #245 pm-notes (update_issue 'Requires authentication', sanctioned CLI fallback per pr-instructions); PR #246 pm-notes (blocker recorded, deferred to PR phase via gh CLI)"
source: "merged_pr"
created_by: "consolidate-memory"
created: "2026-11-06"
status: "candidate"
supersedes: []
applies_when: "any agent performs tracker writes against GitHub in this repo"
---
Recorded independently by three lanes (GH-221, GH-226, GH-222). Reads via MCP remain usable; writes do not. Do not block delivery on MCP write auth: route through gh CLI and record the fallback in pm-notes.
