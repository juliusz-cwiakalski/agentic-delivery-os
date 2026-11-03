# CHANGE IMPLEMENTATION PLAN: GH-219

Plan milestone M1: delivery engine and autonomous dispatch (roadmap and
backlog redefinition). Specification: chg-GH-219-spec.md (F-1 through F-10,
14 acceptance criteria). This is a planning/docs change; no tooling code,
no story tickets, no decision acceptance, no merge of the planning PR
before owner review.

Delivery mode note: after phase 3, the owner redirected this change to an
interactive CEO-driven session (deliver-ticket dispatch stopped; the
parallel-authored spec and test plan from the dispatch run were reviewed
and retained). The remaining phases execute in the interactive session.

## Phase 1: Milestone boundary and status records (F-1, F-10)

- roadmap.md: milestone table row rewrites (M1 delivery engine, M2
  ceremonies/measurement/memory); M0 exit amendment section (concurrent
  pilot, Proposed records stay Proposed, per-engine handover evidence
  never waived); M1 and M2 section rewrites with goals, scope, sequencing,
  and exit criteria; sequencing constraints 1 (daemon behind truth
  engines), 9 (merge stays explicit), 10 (local-first, no LLM in render
  and scheduling paths).
- status.md: amendment section; next-steps item 3 rewritten (M1 milestone
  and 20 issues after merge; dispatch starts under the recorded gate
  change; M1-S9 still respects the per-repo two-clean-weeks rule).

## Phase 2: Backlog and ranking redefinition (F-2 through F-7)

- backlog.md: cross-cutting principle added (self-describing commands,
  key=value contract continuity); M1 epic rewritten to 20 stories
  (S1-S12 retained and extended, S13-S20 new: plan schema, commit
  primitive, session economics, typed blockers, scheduling engine,
  daemon, spend read side, agent integration); closeout expansion folded
  into M1-S12; M2 epic rescoped (M2-S1 retired with a gap note; M2-S2
  deps M1-S18; M2-S3 tier engine; M2-S4 deps M1-S17; M2-S6 deps M1-S19);
  M3-S7 deps updated; reading guide updated (M1 fully specified).
- backlog-ranking.md: reading notes carry the recorded gate amendment;
  full re-rank (ranks 21-40 for M1; downstream ranks shift; dependency
  columns match the backlog exactly).

## Phase 3: Command registry alignment (F-3, F-8)

- cli-command-registry.md: man-page command families updated; M1 table
  retitled and extended (plan, commit, blockers, queue, lanes, daemon,
  spend; merge and brief rows extended; dispatch row = dual-run to
  per-repo handover); M2 table reduced (supervise, ceremony, steer,
  metrics); strangler mapping rewritten so each of the four bash scripts
  names its successor capability and parity point; naming-audit note for
  the provisional M1 family names (ODR-0003 superseding note at
  delivery); plain-language notes (watchdog/daemon/supervise split,
  blockers, plan).

## Phase 4: Operator requirements input (F-9)

- operator-requirements-2026-11.md: sanitized copy of the operator draft
  (production delivery operator voice; no private names, fleet names, or
  repo names; R1-R12 mapped to the new story codes; hard constraints;
  acceptance criteria; dated evidence appendix); README.md indexes the
  new document plus status.md.

## Phase 5: Cross-file consistency (F-2, F-3, F-8)

- user-journeys.md: all milestone attributions updated to the new story
  codes (single-change loop, support steps, fleet cycle, dependency
  planning, iterative order).
- doc/spec/features/feature-status-digest.md and the living concept docs
  (parallel-delivery, containerized-delivery, policy-as-code): queue/lane
  story references moved from the retired M2-S1 to M1-S17. Historical
  records (inception workspace snapshots, prior change folders, planning
  review notes) intentionally untouched.

## Quality gates

- Privacy: whole-file corpus scan over every changed file (zero hits);
  zero em-dashes added; no private references in any committed content.
- Consistency: backlog story set equals the ranking story set (M1-S1
  through M1-S20); dependency columns match file to file; dependency
  graph acyclic (scripted check); explanatory-only mentions of the
  retired M2-S1 code.
- Repo guards: doc distribution guard and inception doc-set consistency
  guard pass; remaining CI jobs validate on the PR.

## Explicitly out of scope

- Creating the M1 milestone or story issues (follow-up change after
  merge).
- Accepting any Proposed decision record (owner formalization).
- Any tooling implementation (the stories planned here deliver it).
- Merging this PR without owner review (explicit owner gate).
