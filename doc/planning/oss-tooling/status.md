# OSS tooling status: Milestone 0 complete

Date: 2026-11-01. Owner-of-record: CEO agent under user-delegated autonomous
authority. Source of truth for scope and order: [backlog.md](backlog.md) and
[backlog-ranking.md](backlog-ranking.md). This file is a status snapshot; the
backlog remains canonical.

## Milestone 0 (Trust substrate): complete, 20/20

All twenty stories were delivered through the full 11-phase lifecycle and
squash-merged to `main-tools` (PRs #191-#199, #201-#203, #207-#209,
#211-#215, plus maintenance PR #210).

| Story | Delivery | Story | Delivery |
|---|---|---|---|
| S1 scaffold | PR #191 | S11 session-admin port | PR #212 |
| S2 branding seam | PR #192 | S12 primitive/credential ports | PR #196 |
| S3 result contract | PR #193 | S13 provider v1 | PR #202 |
| S4 config layer | PR #194 | S14 closeout v1 | PR #215 |
| S5 state layer | PR #195 | S15 privacy/no-cloud guards | PR #203 |
| S6 status v1 | PR #209 | S16 interim mitigations | PR #197 |
| S7 queue ready | PR #214 | S17 decisions + measurement baseline | PR #207 |
| S8 verify change | PR #201 | S18 license registry | PR #208 |
| S9 verify gates v1 | PR #213 | S19 client seeds + traps | PR #198 |
| S10 lint + phases | PR #199 | S20 conformance suite | PR #211 |

(S9 landed after S19/S10 in ranking order; the table lists story numbers,
delivery order is in the ranking file.)

Key ratified decisions along the way: ADR-0007 provider engine (R2,
fail-closed defaults, owner-confirmed OQ-2/OQ-3), TDR-0005 exit taxonomy
(state-unverified to exit 2; token-level dual-run parity binding), TDR-0006
privacy guard mechanics, TDR-0007 license-gate compound SPDX evaluation.

Delivery process state: parallel worktree protocol proven to four concurrent
deliveries; coding rules in force ([.ai/rules/typescript.md] binding for
packages/tests/scripts-checks, loaded by coder and fixer before editing;
review guidance aligned mechanical-first); permanent test suites assert tree
invariants, never moving-base diffs.

## Proposed next steps (decision for the owner)

1. **M1 kickoff** (recommended): create the M1 milestone and its 12 issues
   from the backlog in ranking order (M1-S1 watchdog/lane contracts first;
   M1-S2 state validation; M1-S3 doctor; M1-S4 merge engine; then S6 brief,
   S5 owner-gate SLA, S7 MCP, S8 retro pipeline, S11 harness adapters,
   S9 dispatch dual-run pilot, S12 capsules, S10 collector expansion as
   filler), and continue the batch-delivery loop.
2. **M0 exit review** (optional, short): S17 was designed to gate M0 exit
   (names and ADRs locked, baseline captured). A one-pass owner review of
   the locked names/ADRs and the baseline, or an explicit CEO-run review
   with a report, before M1 spends against the baseline.
3. **Memory consolidation pass** (housekeeping): run the consolidation
   curator over `.ai/memory` to promote the CEO's M0 captures into
   `lessons/` with proper ids and rebuild the index.
4. **Parked owner-gated follow-ups** (from M0 PRs): privacy hashed-literal
   population via the stdin authoring mode; `test-` marker residual
   confirmation; pnpm 12.x bump retry; business decisions D11-D14 at M4.
5. **M3-S4 follow-up pool** (fold into that ticket at creation): anchored
   header-exemption patterns; named failure on git listing failures;
   exit-literal scan Bun/Deno blind spots; AppErrorCode branded type;
   cyclic-payload fixture; decision-index validator (new from the TDR
   collision class).
6. **Delivery-infra hardening tickets** (small, schedule freely):
   tracker-poll retry/backoff tuning in deliver-ticket; review-thread
   resolution helper; perf-test noise pattern (best-of-n) applied to the
   remaining timing-sensitive suites.
