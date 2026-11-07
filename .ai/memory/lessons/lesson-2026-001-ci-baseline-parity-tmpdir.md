---
id: "lesson-2026-001"
kind: "lesson"
scope: "repo"
statement: "The ci-baseline-parity check (git clone --local hardlink assertion) fails when TMPDIR sits on a different filesystem from the checkout; run local gates with a repo-local TMPDIR (TMPDIR=$PWD/tmp/tmpdir with tmp/tmpdir present), not the host /tmp."
evidence: "PR #244 pm-notes (environmental quirk note); PR #245 pm-notes (plain pnpm check failed only in ci-baseline-parity, passes with repo-local TMPDIR); PR #246 pm-notes; PR #248 pm-notes (same finding fourth lane in a row)"
source: "merged_pr"
created_by: "consolidate-memory"
created: "2026-11-06"
status: "candidate"
supersedes: []
applies_when: "any agent runs pnpm check or bun test locally in a worktree or checkout of this repo"
---
Four independent M1 lanes (GH-221, GH-226, GH-222, GH-229) each rediscovered this and recorded it in pm-notes before it was promoted. Canonical local gate: ensure tmp/tmpdir exists, then TMPDIR=$PWD/tmp/tmpdir pnpm check.
