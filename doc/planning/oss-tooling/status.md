# OSS tooling status: M0 stories delivered, milestone exit pending
> History pointer: the 2026-11-10 M2 planning snapshot below records the M1 delivery and M2 planning state; this title and the sections below are history, not a live claim.

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
remains the critical path for M0 exit. The M1-S9 half is superseded by the
2026-11-07 M1-S9 handover amendment below.

History pointer: the 2026-11-10 M2 planning snapshot below records the M1 delivery state; the paragraph above is a 2026-11-03 statement kept as history.

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
3. **M1 delivery start**: milestone and 23 tickets created (GH-221
   through GH-243; map below); dispatch in ranking order under the
   recorded gate amendment, with dispatch handover (M1-S9) still
   respecting the per-repo two-clean-weeks rule. M1-S9 handover is now
   governed by the evidence-based clean bar recorded in the 2026-11-07
   amendment below, which supersedes the per-repo rule named here.
   History pointer: see the 2026-11-10 M2 planning snapshot below for the recorded M1 delivery state.
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

## M1 story tickets (created 2026-11-05)

| Story | Ticket | Story | Ticket |
|---|---|---|---|
| M1-S1 | GH-221 | M1-S2 | GH-222 |
| M1-S22 | GH-223 | M1-S3 | GH-224 |
| M1-S4 | GH-225 | M1-S13 | GH-226 |
| M1-S14 | GH-227 | M1-S6 | GH-228 |
| M1-S5 | GH-229 | M1-S16 | GH-230 |
| M1-S7 | GH-231 | M1-S8 | GH-232 |
| M1-S11 | GH-233 | M1-S21 | GH-234 |
| M1-S15 | GH-235 | M1-S19 | GH-236 |
| M1-S17 | GH-237 | M1-S18 | GH-238 |
| M1-S9 | GH-239 | M1-S12 | GH-240 |
| M1-S23 | GH-241 | M1-S20 | GH-242 |
| M1-S10 | GH-243 | | |

## M1 delivery: scheduling engine delivered (2026-11-07)

M1-S17 (GH-237) delivered the daemon-free scheduling engine: the `queue`
family (`ready`, `list`, `plan`, `add`, `prioritize`, `dep`, `claim`,
`release`) and `lanes list|show`, with one folded queue graph, repo-exclusive
fence-token leases and stale takeover, build-weight classes,
producer-before-consumer deploy gating, close-first ranking, and parks that
resume when their condition clears. Mutations land durably without a resident
process and every surface reports the truthful `daemon-unreachable`
degradation marker. The resident daemon and its control protocol (M1-S18),
`dispatch` (M1-S9), and live `--watch` streaming are not delivered by this
story. See [feature-scheduling-engine.md](../../spec/features/feature-scheduling-engine.md)
and the M1 command pages [queue.md](milestones/m1/commands/queue.md) and
[lanes.md](milestones/m1/commands/lanes.md).
History pointer: see the 2026-11-10 M2 planning snapshot below for the recorded M1 delivery state.

## M1-S9 handover amendment: evidence-based clean bar (2026-11-07, CEO-D-073)

Recorded under the owner directive CEO-D-073 (GH-266, 2026-11-07). The
M1-S9 per-repository handover gate is no longer defined by a calendar
window alone. Clean is the conjunction of four conditions: (a) zero
false-success incidents and zero unresolved divergences on the repository's
pilot paths; (b) dispatch evidence exercising every TDR-0005 result class
on real tickets; (c) an exposure floor of at least 20 dispatches or at
least 7 consecutive days, whichever comes first, where that either/or
binds only the floor and never substitutes for class coverage, incident
truth, or corroboration; (d) corroboration, where an engine-claimed
success is never sufficient and a dispatch counts clean only when artifact
and tracker truth agree.

Corroboration is exactly three evidence sources: completed pm-notes phases,
tracker state, and CI on the pushed head. A result token on its own never
counts.

The dated 2026-11-03 per-engine sentence describes the same M1-S9 handover
gate. For that gate its formulation is superseded, not waived: the
replacement bar is stricter on coverage, because it requires all eleven
result classes plus corroboration, and it replaces the calendar-only window
with an exposure floor.

The canonical definition is the M1-S9 entry in [backlog.md](backlog.md);
this section records the amendment and defers to that entry for the
normative wording. Declared residual: the amendment is not yet propagated
to backlog-ranking.md, roadmap.md, cli-command-registry.md,
milestones/m1/commands/dispatch.md, milestones/m1/journeys.md,
user-journeys.md, and milestones/m1/test-scenarios.md, which still carry
the superseded calendar phrasing; operator-requirements-2026-11.md is a
dated historical record and stays as written. A follow-up change refreshes
them.
## M2-S10 delivery snapshot (2026-11-16)

M2-S10 (GH-287) is delivered on `feat/GH-287/retro-action-registry`: the retro
action registry ships its own validated boundary with the additive
`retro.action` and `retro.action-closure` record kinds, the five-field filing
gate with the verification artifact, derived aging on the one pinned basis
(time open since the recorded filing timestamp), explicit two-plane closure with
the both-plane deprioritize/supersede routes, the fixed improvement WIP limit of
three, the board's additive `ACTIONS` section beside the owner asks, and the
registry as the follow-through producer behind the ceremony pass and the retro
report fold. The delivered retro-registry exactly-three declaration, the report's
four top-level keys, and the ceremony declarations are unchanged. The
2026-11-10 snapshot below stays as the dated historical record.

## M2 planning snapshot (2026-11-10)

M1 story delivery is complete at 23 of 23 through the eleven-phase lifecycle
and squash-merged to `main-tools`; that is story delivery, not milestone exit,
and the M0 exit section above and the M1 exit criteria stay as recorded.

M2 enters planning with its story set complete in [backlog.md](backlog.md),
which stays canonical for M2 scope and order: S2–S10 are carried over from the
earlier outline, S11–S17 are added by GH-284 (M2-S11 multi-repository
workstations, M2-S12 evidence inspection and divergence resolution, M2-S13
public event taxonomy, M2-S14 harness telemetry v2, M2-S15 queue lifecycle
completion, M2-S16 engine-first delivery operations, M2-S17 provider-aware peak
pausing), and S1 stays retired into M1 with the gap deliberate. The same change
amends M2-S4 to depend on M2-S11 and M2-S6 to consume M2-S14 telemetry for
per-agent and per-model facts. No M2 ticket has been created yet: the stories
are repository truth first, and ticket creation follows from them.

Two early inputs already carry sequencing context: #268 (commit-message lint
before pull-request creation) slots as an early M2 chore and is scoped in its
own issue, and #280 (the owner hold that outranks provider windows) is the
delivered baseline M2-S16 and M2-S17 build on.

Maintenance convention: each future M2 story delivery updates its backlog entry
(progress markers) and, at meaningful boundaries, this status snapshot and the
milestone pack, so the planning corpus keeps stating the current M2 state
instead of surviving as ticket memory.

## M2 delivery snapshot (2026-11-11)

M2-S11 (multi-repository workstations) was delivered by GH-288. Delivery state
resolves as two layers — the host root plus a
per-repository project root derived from the checkout identity marker — so two
checkouts of different repositories never share phase state, queue entries, or
lane leases for one ref. `projects list [--json]` is the mounted, read-only host
overview, the derived host index is maintained only on store-opening
invocations, the one-step migration is documented in
[the migration guide](../../guides/migrating-to-per-repository-state.md), and the
owner hold stays host-wide. The remaining M2 stories are unaffected by this
delivery and stay planned.

M2-S12 (evidence inspection and divergence resolution) was delivered by GH-289.
`dispatch attempts [--ref <ref>] [--limit <n>]` reads one work item's recorded
attempts newest first as a bounded digest or the `attempts.v1` machine envelope
(sixteen-field projection, total order, ledger/page/human bounds,
repository-scoped isolation with count-only foreign disclosure, empty history as
success, no new error identity), `dispatch dual-run resolve` declares the
unconditional `local-evidence` mode with the subject repository and the exact
repository-scoped divergence counts, and the summary keeps coverage and floor
with its divergence block on the same count rule. The remaining M2 stories are
unaffected and stay planned.

## M2 domain-model amendment (2026-11-11)

Planning state only: this section records the GH-303 amendment to the M2 plan
and claims no M2 delivery and no milestone exit.

1. The domain model is three-level: a repository is one checkout and the
   delivery unit, a project group is a configured group of repositories whose
   membership is declared in configuration, and a workspace is an optional
   discovery root that is never required.
2. The contracts split cleanly: `project-groups.v1` with `data.groups[]` and
   `groupKey` is the group contract, the delivered `projects.v1` payload
   (`data.projects[]`, `projectKey`) stays the flat record set, and the
   planned flat surface is `repos.v1` with `data.repos[]` and `repoKey`. The
   rename rule and its `projects list --flat` alias are recorded once in the
   contracts; M2-S18 owns the rename and retires the alias at the M3 boundary.
3. M2-S18 also owns configuration-only membership, the scoped-read grammar
   `queue list --project <groupKey>` and `status --project <groupKey>`, and the
   superseding decision record.
4. `board --project` stays a repository key; the board is not group-scoped,
   while queue and status are.
5. The command registry splits into one delivered `projects` row (M2-S11,
   shipped in GH-288) and one prospective `repos` row marked Not delivered
   pending the superseding decision record and code change required by
   ODR-0003.
6. M2-S4 depends on M2-S18, so the advisory phrase is removed from the pack
   map row.

## M2 delivery snapshot (2026-11-12)

M2-S13 (public event taxonomy) was delivered by GH-290. The daemon's subscribe
surface publishes event taxonomy v1 over six topics: `queue` and `lanes` keep
their delivered snapshot frames, and `queue.graph`, `dispatch.attempt`,
`phase.state`, and `blockers.state` carry the eight-field change envelope with a
process-scoped `sequence` ordered per `(topic, lane)`. A degraded frame keeps the
delivered `subscriber-overflow` marker and drop behaviour and additively carries
`overflow: "repoll"` and `taxonomyVersion: "v1"`; a subscription for a topic
outside the six is refused with `events.topic-unknown` before any ledger read;
and the generated `events list` / `events describe <topic>` reference surface is
a prompt-required family. Every emitted kind reads an existing durable record;
`queue.graph.remove` is declared with `emitted: false` because no delivered path
removes a queue entry. M2-S15 owns entry removal, M2-S16 and M2-S4 consume the
declared taxonomy, and M2-S17's stop, parked, resumed, and park-edge shapes
arrive as a future taxonomy version. M2 has not exited: the remaining M2 stories
stay planned.

## M2 delivery snapshot (2026-11-12, queue lifecycle)

M2-S15 (queue lifecycle completion) was delivered by GH-292, superseding the
removal attribution in the snapshot above: entry removal is delivered, and
`remove` is now an emitted `queue.graph` kind — all four declared kinds are
emitted, each one `remove` event per applied removal carrying exactly `ref`,
`reason`, `recordedAt` in the removed entry's lane. The delivered surface:
`queue remove <ref> --reason <landed|abandoned|superseded|reconciled>` over the
append-only removal record, where presence is the ledger's append position
(latest `queue.entry` append later than the latest `queue.removal` append) and
no record is ever deleted; automatic `landed` removal inside `closeout --apply`
through the fail-open non-step `queueRemoval` block (`removed`,
`would-remove`, `satisfied`, `skipped` with closed skip reasons), after the
closeout writes inside the held fence; the explicit `queue dep add` /
`queue dep remove` grammar over the preserved two-positional add (`removed`
joins the dependency result vocabulary; an absent edge is a `noop` with zero
appends and zero events); and `queue reconcile [--ref]` against tracker
delivery state (`done`/`canceled` are stale and removed with reason
`reconciled`; open states are retained; a not-found item is retained and
reported `unobserved`; unreadable truth removes nothing and exits on the
provider's own identity; at most 100 examined entries with one bounded read
each). Single-flight is now a per-ref admission policy: the dispatch family
refuses any live same-ref lease regardless of holder with
`queue.single-flight` naming the holder at the failure-envelope root
(`detail.holder`); `queue claim` renews the caller's own holder's same-ref
lease and refuses another holder's same-ref lease with the same identity;
any other-ref live lease refuses the delivered `queue.lease-conflict`; a
lease at or over its TTL keeps the delivered stale takeover; renewal is
narrowed to one (repository, ref, holder). The scheduling engine's per-pass
single-flight is unchanged. M2 has not exited: the remaining M2 stories stay
planned.

## M2 delivery snapshot (2026-11-13)

M2-S14 (harness telemetry v2) was delivered by GH-291. The opencode adapter now
ingests the v2.x.y JSONL stream per step, counting the five token classes,
calls, and per-model cost in harness-reported units and distinguishing a
present-zero from an omitted field; each step is attributed across ticket,
repository, lane, agent role, and model by joining the delivered session
economics identity and the command-audit claimed identity, with an absent
dimension stored as `null` and disclosed rather than defaulted. Stream close
captures one bounded read-only per-session totals query as a
`harness.telemetry.baseline` record, and both new families are additive beside
the delivered closeout capture under the schema-versioned
`delivery.telemetry.storage.v1` identity with re-read migration. Spend keeps the
`delivery.spend.v1` identity and the six v1 keys and adds five v2 keys:
five-dimension breakdowns, cost totals, per-phase timing summaries with
stall/restart intervals, telemetry state, and the DEC-5 reconciliation block
against summed harness session totals at the declared `0.02` tolerance, with one
verdict, excluded sessions disclosed, and no baseline classified as unavailable
rather than `within`. The retro evidence pass and the brief cite the same
figures through the delivered append seam; telemetry absence stays a classified
outcome and never a zero report. The delivery runs from commit `eb739f19`
through the phase-8 documentation commit on `feat/GH-291/telemetry-v2`; M2 has
not exited, and the remaining M2 stories (S2–S10, S16–S19; S15 was delivered by
GH-292 in the snapshot above) are unaffected by this delivery and stay planned.

## M2 delivery snapshot addendum (2026-11-13): M2-S17 delivered by GH-294

M2-S17 (provider-aware peak pausing) was delivered by GH-294. Every delivery now
nominates its provider profile at dispatch admission — the nomination rides the
lane and attempt records (additive fields), the attempt-history read returns it,
and a delivery that cannot nominate is refused before any session with the
resolve identity for its exact shape (`provider.profile.absent` /
`invalid` / `capability-denied` at exit 1, `unavailable` at exit 2 with the
eligibility list), identically on the one-shot path and the composed claim.
Peak-window rules are versioned per-profile data (windows, multipliers, buffers,
and a `graceSeconds` default whose maximum is derived from the smallest declared
buffer), validated fail-closed with UTC-only designations, duplicate-window
refusals, and overlap tolerance. The daemon's window watch parks every in-flight
lane of an opening profile (buffer included) with a bounded-grace stop that
never outlasts the window buffer, a `peak-window` park record naming the
profile, the window end, and the `preserved |
session-state-not-preserved` classification — a preservation failure never
refuses a park and never extends a grace. At the effective window end lanes
resume automatically: preserved lanes through the session resume path on the
same branch, not-preserved lanes through the delivered interrupted-lane
recovery (one restart ordinal, budget- and economics-governed, exhaustion
escalating verbatim); an active owner hold outranks the window and the resume
refuses `queue.precondition.unmet`/`owner-hold` appending nothing. The event
taxonomy moved to the declared v2 — `stop`, `parked`, and `resumed` on
`dispatch.attempt` and `park-edge` on `queue.graph` — with every v1 kind and
payload byte-identical, one stamp constant, and the six-point v1-consumer
compatibility statement. The spend read side gained the window-scoped zero-spend
evidence (`--window-evidence`): a falsifiable billable-call count from the park
timestamp through the window end over the telemetry v2 storage identity, with
telemetry absence always a classified outcome and never a zero. Status and
brief carry the open episodes' park fields from the same collector pass. The
lanes machine read declares peak enforcement truthfully: the mode derives from
whether the running composition actually supplies the peak-pause watch ports
(a composition fact, not daemon reachability — the shipped compositions supply
none, so the machine read reports `iteration-start-gating`), and
`parkClaimed` reads from the durable park records, whatever writer claimed
them; the delivered iteration-start admission gating is unchanged. The
delivery runs on `feat/GH-294/provider-peak-pausing`; M2 has not exited, and
the remaining M2 stories are unaffected by this delivery and stay planned.

## M2 delivery snapshot addendum (2026-11-14): M2-S18 delivered by GH-309

M2-S18 (project groups) was delivered by GH-309 on
`feat/GH-309/project-groups`. `projects list` now renders the configured groups
under `project-groups.v1` — each group with its declared member repositories,
their state, and their health, with `not-yet-supported` mandatory for a member
whose tracker kind has no implemented adapter — while configuration-only
membership never admits an undeclared clone and an optional `workspaceRoot` is
never required. `queue list --project <groupKey>` and `status --project
<groupKey>` scope the delivered reads to one group over per-checkout state, and
one unreadable member yields a classified partial result at exit `0` rather than
a group-scoped store. The flat record set moved to `repos list` under
`repos.v1` (`data.repos[]` with `repoKey`, root, state location, daemon
reachability, and handover state); `projects list --flat` remains the
byte-compatible alias returning the delivered `projects.v1` payload until the
M3 boundary, which is lawful under the superseding ODR-0004 and the rename
rule. The permanent repository vocabulary — the identity marker, the
`<host root>/projects/<key>` container, the host index's `projects[]` and
`projectKey`, and `--project-root` — is unchanged, and no state was migrated.
`board --project` stays a repository key with no group-scoped board claim. The
delivery runs on `feat/GH-309/project-groups`; M2 has not exited, and the
remaining M2 stories (S2–S10, S16, S19) are unaffected by this delivery and stay
planned.

## M2 delivery snapshot addendum (2026-11-14): M2-S20 delivered by GH-313

M2-S20 (milestone-first planning and delivery) was delivered by GH-313 on
`feat/GH-313/milestone-first-planning`. The milestone is now the documented
unit of planning and delivery: `doc/guides/milestone-management.md` states the
operating rule once (naming, creation, attachment, entry review, planned scope,
exit review, closure, extension and reopening, and enforcement), the milestone
pack conventions point at it, and PDR-0005 records the decision. Ticket creation
requires a milestone resolved from the existing set in the tracker instructions
and the `@pm` prompt, intake verifies attachment and records it in pm-notes
before artifact phases, and the `@bootstrapper` guidance carries the rule into
new projects. The change-spec template requires `change.milestone` with its
resolution rule. The issue-event workflow evaluates the ordered contract and
writes only its closed vocabulary: a first flag on `opened` (with one marked
comment only when no marker exists), a restore on `demilestoned` with the
marker, and a removal on attachment; the `backlog-capture` exemption outranks a
milestone and a stale flag, a manual flag removal is respected, and the advisory
sweep reports the unattached population with zero tracker writes and one local
artifact. The M2 planning corpus now mirrors the tracker: M2-S20 has its block,
all 19 M2 story blocks carry their `Ticket:` line, the suggested-order file is
contiguous with the M2 rows in backlog order, and the M2 pack carries the
M2-S20 row and its five scenario seeds. The delivery runs on
`feat/GH-313/milestone-first-planning`; M2 has not exited, and the remaining M2
stories (S2–S10, S16, S19) are unaffected by this delivery and stay planned.

## M2 delivery snapshot addendum (2026-11-15): M2-S19 delivered by GH-310

M2-S19 (cross-repository changes) was delivered by GH-310 on
`feat/GH-310/cross-repository-changes`. One change now declares its member set
in `plan.data.members[]` with closed per-member validation and the `plan
validate` echo, and member-less plan validation, lint, diff, and overlap stay
byte-identical. The queue holds one entry and one lane per member ref
(`<canonicalChangeRef>@<repoKey>`) with per-member dependency edges, per-member
release, and landing removal that retires only the member it observes;
`queue add` returns the delivered payload plus an additive ordered
`data.members[]`, and the member-less payload is read unchanged from a
pre-change golden. `verify gates` reports one shared definition of done as the
distinct `CrossRepositoryVerifyGatesReport` — per-(member, gate) records with a
required `member`, per-member `gates.ci` and `verdict`, landing-ordered
`evidence[]` from injected landing facts, `blockingMembers[]` that is never
truncated, and one `reviewFlow` run over the declared pull-request set — while
the delivered `VerifyGatesReport` keeps its literal `overall: "pass"`, its
member-less records, its failure envelope, and exits 1/2. Closeout reports one
ordered `closeout.data.members[]` entry per member with merge-truth `landed`,
the mode-scoped cleanup and issue-closure columns derived from the member's own
observation and operations, and per-member landing removal; the member-less
closeout data, steps, ledger, and human output are unchanged. The change adds
zero error-table rows and zero domain kinds, every observed surface appends
exactly one gate-verification record and no plan-validation or closeout-plan
write, and the parity, contract, read-only, determinism, and hermetic proofs are
committed suites. The delivery runs on `feat/GH-310/cross-repository-changes`;
M2 has not exited, and the remaining M2 stories (S2–S10, S16) are unaffected by
this delivery and stay planned.

## M2 delivery snapshot addendum (2026-11-15): M2-S7 delivered by GH-300

M2-S7 (suite-to-job mapping in gates) was delivered by GH-300 on
`feat/GH-300/suite-job-mapping-gates`. A repository now declares one versioned
`verify.suite-map` in its project-committed configuration document — `jobs[]`
of `{ job, suites }` plus the `local` set — and `verify gates` reads exactly
that one document through one bounded resolution attempt (at most one existence
probe and at most one content read), never the merged layer tree. A resolved
equality cites the mirrored CI breadth and job on both report types
(`data.suiteBreadth`/`data.mirrorsJob`), a strict narrowing refuses at exit `1`
with `verify.narrowed-scope` — naming the local set in `detail.suiteBreadth` and
the mirror's breadth in the pinned header — and appends neither the verification
record nor the capsule event, an unattributable local breadth or a drifted
mirror refuses `config.value.invalid` with one bounded `cause:` line, and a
present-but-unusable document never becomes undeclared. The policy is live on
both shipped surfaces (the CLI and the shipped MCP `gate-report`), this
repository's own declaration resolves to equality end-to-end, and the five
gates, the record and capsule shapes, the invocation grammar, and the
enumerable source read counts are unchanged. The delivery runs on
`feat/GH-300/suite-job-mapping-gates`; M2 has not exited, and the remaining M2
stories are unaffected by this delivery.

## M2 delivery snapshot addendum (2026-11-16): M2-S4 delivered by GH-297

M2-S4 (board) was delivered by GH-297 on `feat/GH-297/board`. `board` now
renders exactly four sections — lanes, gates, owner asks, and parked work — in
declared order, from the one fact bundle `collectStatusFacts` composes (named
`delivery.status-facts.v1` on the board, status, and brief payloads) plus the
delivered lane/phase fold. Repository selection is repository-keyed: the default
form is the invoking checkout with zero host-index reads, `--project <repoKey>`
narrows to one managed repository, and `--all` unions the host index with the
invoking checkout under the 128-included-repository cap with counted overflow
(`--project` still reaches a key beyond the cap). The delivered 24 h / 72 h
owner-gate SLA, ranking, waiver recording, gate cap, and append-only idempotent
decision record are preserved as the gates section, now scoped per repository;
asks carry computed age and the drawn default over the invocation's post-append
decision set, and parked work carries reason and `until` with the classified
`owner-hold-no-expiry` absence while `provider-quota` stays off the board. The
command is mounted as the 21st prompt-required family with root and family help,
the M2 reference page, and the coverage-inventory row; it joins the read-only
`maintainsIndex` exception set, and its only write is the per-repository decision
append. The run carries `feat/GH-297/board`; M2 has not exited, and the remaining
M2 stories are unaffected by this delivery.


## M2 delivery snapshot addendum (2026-11-16): M2-S5 delivered by GH-298

M2-S5 (steer) was delivered by GH-298 on `feat/GH-298/steer`. The `steer` family
files bounded notes on the shared typed message record (eleven declared keys,
four shared closed vocabularies declared once, the S5 filing subset as a
declared restriction), lands every due note at the boundary read point in one
rank-ordered batch with a complete receipt, records `ttl-elapsed` as a
classified non-applied outcome with the delivery's course unchanged, declines
mid-phase without applying or recording, batches the open owner asks with the
delivered drawn-default join and measured age, completes a landed note against
its proving artifact, and refuses registered credential values on text, ref, and
derived origin paths. Three exact error identities join the `steer` kind with
the closed allowlist widened 56 -> 59 and every count pin moved in one commit.
The family is mounted as the 23rd prompt-required command with root/family help,
the M2 reference page, and the coverage-inventory row. The run carries
`feat/GH-298/steer`; M2 has not exited, and the remaining M2 stories are
unaffected by this delivery.

## M2 delivery snapshot addendum (2026-11-17): M2-S2 delivered by GH-295

M2-S2 (supervise) was delivered by GH-295 on `feat/GH-295/supervise`. The new
`supervise` family runs one operator-invoked battery over the invoking checkout's
single managed repository key and projects the schema-versioned
`delivery.supervision.v1` report: one tri-state entry per lane (ref, heartbeat,
live holder, evidence) and per supervision claim (daemon instance, coordinator
ledger lease, live per-ref lease), the actions the run applied, derived counts,
degradation markers, named truncation, and the run instant. Classification is a
pure artifact-evidence fold over the delivered record kinds: any advancing
artifact inside the observation span reads `progressing` (prefill-safe), the full
corroboration combination (heartbeat age at or beyond the delivered 300,000 ms
stall bound, or a heartbeat trail spanning the window, with a flat artifact
trail) reads `stalled`, and absent evidence reads `unknown` and is never guessed.
A corroborated lane stall is parked through the delivered park machinery with the
new `liveness-stall` cause mapped onto the expiry-carrying `provider-window`
condition type, a non-null `until` at the mapped recheck default, and its
corroborating evidence; the delivered `lanes show` read reports state `parked`,
reason `parked:liveness-stall`, and the additive active-park `until`. A held
session records a safe-boundary park intent without touching the lease and
without signalling. Already-parked stale lanes consult the delivered restart
budget and resume economics once, append the delivered restart record, or land
the terminal exhaustion record plus one typed question; an unevaluable admission
is the declared unavailable outcome. The per-action duplicate-supervision refusal
fires only against a supervision authority actively acting over the target object
(a live daemon's presence refuses nothing, and a park intent is non-claiming);
per-ref double-claims reuse the delivered `queue.single-flight` identity. Two
exact `supervise` identities join the error-table allowlist (63 -> 65) with every
count pin moved (147 -> 149). The family is mounted as the 25th prompt-required
command with root/family help, the M2 reference page, and the coverage-inventory
row. No state record kind, event taxonomy member, daemon/coordinator/queue
mechanism, or production composition changed, and the daemon's composition stays
supervise-only. The run carries `feat/GH-295/supervise`; M2 has not exited, and
the remaining M2 stories are unaffected by this delivery.

## Metrics and spend delivered (GH-299, M2-S6)

GH-299 delivered the `metrics` read-side family through the full lifecycle:
the `delivery.metrics.v1` report (four metric entries with basis, measurement
kind, window, and sample; the per-dispatch block composed from the `spend`
fold; burn-rate alarms against the project-committed `metrics.burn-rate` node;
the comparison view under the committed protocol), the bounded committed
corpus scan behind the CI proxy and the curated escaped-defect floor, the one
`metrics.baseline-unreadable` identity with every Appendix D count pin moved
(147 entries / 146 delivered / 63 allowlist / +113), and the 24th
prompt-required mount with its M2 reference page. The delivered aggregate gate
is green at `TMPDIR=$PWD/tmp/tmpdir pnpm check`.

## Engine-first evaluation surfaces delivered (GH-293, M2-S16)

GH-293 delivered the engine-first evaluation surfaces through the full lifecycle:
the summary reports `cleanDispatches` (identical to `corroboration.satisfied`) and
the trailing `consecutiveCleanDispatches` plus the four ordered `conditions`; the
handover data carries the same four conditions and `reversible` on every
gate-reading outcome, with the single declared exemption (the idempotent revert
noop) and `verdict` on the recorded revert; `repos list` evaluates the gate per
row at read time, bound to the row's own repository identity at the declared
`production` evidence scope, and reports `reversible` plus a `handoverGate`
block (unreadable evidence or an unresolvable identity fails the read as
`repos.state-unavailable` at exit 2 with no row; a truncated read is
`unverifiable` plus `truncation`); and the production merge composition performs
real tracker/check-run/request-detail reads with configuration, branch, base
reference, and owner principal resolved from declared sources, publishing
`MERGE_COMPOSITION_EMITTABLE_CODES` and deriving every failure's kind and exit
from the resolved error-table row (a missing credential is
`config.credential.missing` at exit 1). The shell stack is unchanged and
documented as the fallback; `projects.v1` and `projects list --flat` stay
byte-identical; no repository was flipped and no handover record was inserted by
the change. The `verify deploy` target-resolution stub and the lanes-read profile
blindness remain declared residuals. M2 has not exited.
