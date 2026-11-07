# GH-240 success-metric evidence (spec §4.1 / DoD-16)

Rows below are backed by executed tests in this change. Rows that need
production or adoption data are marked `not measurable in this change`; the
DoD phase finalises the table. No value is asserted without evidence.

| Metric | Target | Evidence | Verdict |
|---|---|---|---|
| Merged changes closed with a capsule containing events and one decision per candidate | 100 % | `closeout-capsule-close`, `closeout-capsule-decisions`, `closeout-capsule-idempotency` | library-level 100 % |
| Candidates promoted without a capture-bar basis or evidence link | 0 | `closeout-capsule-promotion` (`capture-bar-unmet`, `evidence-missing`) | 0 |
| Human-authored review threads auto-resolved | 0 | `closeout-thread-caps`, `providers/github-closeout-thread-authorship` | 0 |
| Worktree removals outside the declared safety predicate | 0 | `closeout-worktree-refusal` (nine refusal conditions) | 0 |
| Duplicate capsule events / promotion writes / thread resolutions / branch deletions / worktree removals on a re-run | 0 | `closeout-convergence`, `closeout-capsule-idempotency`, `closeout-capsule-close` | 0 |
| `harness.telemetry` records moved into the capsule or duplicated by closeout | 0 | `closeout-telemetry-production`, `harness-closeout-*` | 0 |
| Post-closeout harness-store re-queries required by `spend` | 0 | GAP-C7; `spend` is M1-S19 and not delivered | not measurable in this change |
| Residue items beyond the declared bound or without a kind/location | 0 | `closeout-residue` (50-cap + `+N`, kind/location shape) | 0 |
| Source-file edits, commits, pushes, or remote writes performed by closeout | 0 | `closeout-merged-diff-bounds` (no write/spawn/exec), git-seam scans | 0 |
| Closeouts requiring manual re-grep of the merged diff after adoption | 0 | adoption metric (GAP-C12) | not measurable in this change; manual trial |
