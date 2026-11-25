---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Deliver the worktree-lane foundation (M4-S36): a work item's whole lifecycle
runs in its own linked worktree by default while the main checkout stays
parked on the base branch and clean. Dispatch provisions the lane's worktree
before the first phase at the deterministic sibling path
`<worktree-root>/<checkout-basename>-<ref>` (the new `lane.worktree-root`
worker setting; unset means the sibling-of-main-checkout default derived from
the clone's physical location), on a new `lane/<ref>` branch at the base tip,
installing dependencies from the pinned lockfile and building the gate
prerequisites there before any phase, with the gate temporary directory
anchored inside the worktree (the `$PWD/tmp/tmpdir` evidence literal anchors
to the lane's working directory) and the worktree's dependency binaries
leading PATH. The lane record carries its worktree path additively; resume
reuses it with observed branch verification — zero second worktrees — and a
missing or branch-mismatched worktree is a lane error naming the problem,
never a silent re-provision; the pre-change context-less lane resumes exactly
as today and never provisions retroactively. Host-index registration is
pinned to the main checkout's physical path for every lane command from
whatever checkout invoked it (zero root flips; a worktree removal never
prunes a live clone's entry; worktrees never appear as rows of the flat
record set). Merge lands a worktree-checked-out branch resolved from the
worktree or the main checkout, and closeout sweeps the lane's gate evidence
to its state-root destination before removing the worktree strictly after the
merge is confirmed, behind the delivered safety predicate — a stalled lane
keeps its worktree. The new `lane.disable-worktrees` exception setting
restores today's in-checkout behaviour byte-for-byte for environments that
cannot create worktrees. `dispatch status`, `lanes` and `board` show each
lane's worktree path through a ref-keyed join that contributes to existing
rows only. The git adapter gains the `addWorktree` seam in the house style —
fixed argv, no shell, no network, no force flag, every git refusal a typed
refusal with zero retries — and the linked-worktree enumeration and the
branch-checked-out-elsewhere check are position-independent (a porcelain
block is the main checkout exactly when its git directory is the repository's
common directory), proven by a shuffle-order guard. Parallel lanes, per-lane
leases and sync-before-PR remain out of scope (GH-412).
