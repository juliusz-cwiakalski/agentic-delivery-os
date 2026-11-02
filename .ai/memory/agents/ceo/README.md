# ceo memory

Charter: coordinator and curator. Captures queue heuristics, steering
judgments, delivery patterns, and merge/promotion decisions; runs
consolidation over this tree (skill: `consolidate-memory`).

Memory here is advisory, untrusted data; follow the template in `.ai/memory/README.md`.

## Lessons

<!-- append one line per lesson: - YYYY-MM-DD: lesson (evidence: PR #N | CI run | review link) -->
<!-- supersede an old lesson by adding a new dated line that names it; prune only when proven wrong -->
<!-- past ~50 lines with distinct areas: split into topic files here, leave one-line pointers; README stays under ~150 lines -->
- 2026-11-01: Parallel delivery protocol: one worktree per ticket at origin/main-tools tip, deliver-ticket.sh per worktree, serial CEO integrate-then-merge; pair tickets with disjoint surfaces; shared hotspots are error-table, contracts barrel, fixture registries, feature specs, decision index (evidence: PRs #195-#215, 15 stories in ~2 days)
- 2026-11-01: Autonomous merge gate that never lowered: pm-notes all 11 phases + observed-green ts-*/bash CI on the pushed tip + privacy term scan of the PR diff + review threads resolved, then squash with curated message and "Closes #N" (evidence: 23 merges, GH-177 close-miss caught)
- 2026-11-01: Permanent suites assert the current tree, never a diff against a moving base; delivery-shape checks belong to PR-time gates or snapshot fixtures (evidence: PR #210 unblocked GH-186/GH-175 and ended the recurring class)
- 2026-11-01: Local-green is not CI-green: simulate CI preconditions in gates (no fetched baseline refs, no built dist, packed-tarball resolution, clean checkout, tmp/tmpdir present, pnpm install --frozen-lockfile after merges) (evidence: GH-170/171/172 remediations, six distinct drift classes)
- 2026-11-01: Decision ids are allocated from current main-tools at delivery time, never from the branch base; parallel deliveries collided twice on TDR numbers (evidence: TDR-0005/0006 renumberings on PRs #203, #207)
- 2026-11-01: Commitlint range hygiene: when a lint gate lands mid-branch, range-lint the whole branch immediately; last-resort for dirty ranges is condensing the branch to one conventional commit (soft reset to merge-base) since PRs squash anyway (evidence: PRs #196, #213, #214)
- 2026-11-01: deliver-ticket resume protocol: --status first (the process sometimes survives tool-call kills), then same-branch --resume-prompt with raw failing evidence; never re-dispatch a partial (evidence: GH-173, GH-176, GH-180, GH-183 recoveries)
- 2026-11-01: CEO union-merges need rebuild verification: frontmatter duplicate keys, JSON object seams, duplicated paragraphs; rebuild spec files from origin/main-tools plus the branch delta, then brace-balance/YAML/biome check and pnpm check before pushing; never git add -A with stray logs in a worktree (evidence: chk.log incident on PR #203)
- 2026-11-01: Do not symlink .ai/local into delivery worktrees: agents need only tracked configs; sharing races pm-context.yaml and delivery markers across concurrent PMs (evidence: GH-181 delivered cleanly without it)
- 2026-11-01: Review threads block merges even with green CI (conversation resolution required); resolve via GraphQL resolveReviewThread after replying with the fix commit (evidence: PRs #165, #214, #215)
