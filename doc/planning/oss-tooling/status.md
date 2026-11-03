# OSS tooling status: M0 stories delivered, milestone exit pending

Date: 2026-11-01. Owner-of-record: CEO agent under user-delegated autonomous
authority. Source of truth for scope and order: [backlog.md](backlog.md) and
[backlog-ranking.md](backlog-ranking.md). This file is a status snapshot; the
backlog remains canonical.

## M0 exit amendment and M1 re-planning (2026-11-03)

Recorded with the M1 re-planning (GH-219):

- The dual-run pilot starts now and runs concurrently with M1 planning and
  early M1 stories; those stories do not touch dispatch. Per-engine
  handover still requires its own two-clean-weeks evidence; that constraint
  is never waived.
- The Proposed decision records remain Proposed during M1; owner acceptance
  is formalization tracked in the inception readiness report. The M0
  milestone stays open until the pilot evidence and record acceptance land.
- M1 is redefined as the delivery-engine milestone (bash delivery stack
  replaced; scheduling and waiting leave the coordinator's context); the
  orchestration core formerly known as M2-S1 moved into M1. Scope and order
  live in [backlog.md](backlog.md) and
  [backlog-ranking.md](backlog-ranking.md); the recorded operator input is
  [operator-requirements-2026-11.md](operator-requirements-2026-11.md).

## Story delivery: 20/20 complete

All twenty M0 stories were delivered through the full 11-phase lifecycle and
squash-merged to `main-tools` (PRs #191-#199, #201-#203, #207-#209,
#211-#215, plus maintenance PR #210). Story delivery is not milestone exit.

## Milestone exit: pending

The roadmap's M0 exit criteria (roadmap.md, Milestone 0 section) are:
1. Dual-run pilot: the pilot repository runs status, verify change, provider,
   and closeout beside the bash stack (shell stays authoritative), with zero
   false-success incidents on pilot paths over two weeks.
2. This repository adopts the scaffold (met: all M0 work landed in it).
3. Decision acceptance recorded: ADR-0003 is Accepted; ADR-0005, ADR-0007,
   TDR-0003, TDR-0004, ADR-0008, ADR-0009, ODR-0002, and ODR-0003 are
   Proposed, and the GH-186 register explicitly leaves owner acceptance
   pending (merge does not auto-accept). CEO-agent ratifications recorded at
   PR review (ADR-0007, TDR-0005, TDR-0006) do not substitute for recorded
   owner acceptance of the Proposed set. The full pending set is thirteen
   records: the eight above plus TDR-0005, TDR-0006, TDR-0007, TDR-0008,
   and ADR-0010, as enumerated in the inception readiness report.

Per backlog-ranking.md reading notes and the recorded M0 exit amendment
(above), M1 delivery starts now and runs beside the pilot: stories that do
not touch dispatch are unconstrained, and dispatch handover (M1-S9) still
requires its per-repository two-clean-weeks evidence. The dual-run pilot
remains the critical path for M0 exit.

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

1. **Start the dual-run pilot now** (critical path for M0 exit): run
   status, verify change, provider, and closeout beside the bash stack on
   the pilot paths, accruing the two-week zero-false-success evidence. The
   M0 surfaces exist; the recorded amendment lets the pilot run concurrent
   with M1 delivery that does not touch dispatch.
2. **Owner acceptance pass** (required for exit): record acceptance or
   change requests for the thirteen Proposed decision records (ADR-0005,
   ADR-0007, TDR-0003, TDR-0004, ADR-0008, ADR-0009, ODR-0002, ODR-0003,
   plus TDR-0005, TDR-0006, TDR-0007, TDR-0008, and ADR-0010) per the
   inception readiness report, which links every record. Short review; the
   register links each one.
3. **M1 milestone and tickets** (after GH-219 merges): create the M1
   milestone and its 20 issues from the redefined backlog in ranking
   order. M1 delivery is approved to start under the recorded gate
   amendment; stories are dispatched in ranking order, with dispatch
   handover (M1-S9) still respecting the per-repo two-clean-weeks rule.
4. **Memory consolidation pass** (housekeeping): run the consolidation
   curator over `.ai/memory` to promote the CEO's M0 captures into
   `lessons/` with proper ids and rebuild the index.
5. **Parked owner-gated follow-ups** (from M0 PRs): privacy hashed-literal
   population via the stdin authoring mode; `test-` marker residual
   confirmation; pnpm 12.x bump retry; business decisions D11-D14 at M4.
6. **M3-S4 follow-up pool** (fold into that ticket at creation): anchored
   header-exemption patterns; named failure on git listing failures;
   exit-literal scan Bun/Deno blind spots; AppErrorCode branded type;
   cyclic-payload fixture; decision-index validator (new from the TDR
   collision class).
7. **Delivery-infra hardening tickets** (small, schedule freely):
   tracker-poll retry/backoff tuning in deliver-ticket; review-thread
   resolution helper; perf-test noise pattern (best-of-n) applied to the
   remaining timing-sensitive suites.
