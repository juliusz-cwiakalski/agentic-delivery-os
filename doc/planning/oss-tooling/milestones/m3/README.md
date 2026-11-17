# M3 — Jaiship-native delivery (planning draft)

Status: **draft for review** (planning PR; iterate until the shape is approved).
Owner directive: 2026-11-17. Planning ticket: GH-333.

## Goal

The installed Jaiship binary performs all delivery for this repository and for
every managed project — with no coupling to the source tree, no shell
orchestrator in the delivery path, and models used only where judgment is
required. New iterations are delivered by the installed binary; the source
repository is built and re-installed only at explicit, decided points.

## Problem statement

1. The running tool executes from the repository checkout: every repository
   change changes the tool under the operator's feet, and development breakage
   surfaces as delivery failure.
2. Day-to-day delivery still relies on shell orchestrators
   (`deliver-ticket.sh`, `ceo-loop.sh`) that duplicate lifecycle knowledge the
   typed engine already owns, and whose coordination turns consume the most
   expensive model seats.
3. Product identity is mid-rename (delivery-os -> Jaiship): configuration
   directories, environment prefixes, package names, docs, and prompts still
   carry the old namespace.
4. Command reliability gaps observed in operation: merge primitive failure,
   dispatch admission race, resume short-circuit, phase artifact/registry
   divergence, commit primitive subject and probe defects, serial-merge
   conflicts.
5. Provider policy (quota-aware pacing, peaks, chains) lives in workstation
   shell configuration rather than declarative product configuration.
6. Multi-project operation — separate backlogs, queues, and priorities per
   project, with project-scoped history — is not yet a first-class surface.
7. Machine-readable delivery history and statistics for external consumers is
   not yet a documented contract.

## Exit criteria (milestone DoD — verified on the installed binary)

- **EC-1 Installed-binary delivery.** A versioned, self-contained Jaiship
  install performs all delivery. Repository edits have zero effect on the
  running tool until an explicit upgrade. Install, upgrade, rollback, and
  version identity are documented and tested on a clean profile.
- **EC-2 Namespace migration.** No `delivery-os` identifiers remain in the
  product surface: binary name, configuration directories
  (`~/.jaiship`, `<repo>/.jaiship`), state directories, environment prefix,
  package/CLI names in docs and prompts. A conformance scan prevents
  reintroduction; an idempotent migration moves existing installations.
- **EC-3 Command conformance.** `merge`, `dispatch` (admission concurrency and
  resume correctness included), `queue` (add/list/plan/claim/park/reconcile),
  `closeout`, `phase`, `commit`, `status`/`brief`, and `history` pass a
  documented conformance battery on the installed binary. Every named defect
  in the problem statement has a regression test.
- **EC-4 Declarative provider policy.** Quota watch targets, peak windows,
  chains, fallbacks, pacing goals (intensify subscription usage when quota
  would otherwise go unused before reset; judgment seats on subscription;
  execution seats on pay-per-token; exhausted -> pay-only), per-project
  overrides, and spend budgets/alarms are expressed purely in Jaiship
  configuration. Delivery requires no shell hook.
- **EC-5 Project-scoped queues.** A project is a named set of repositories with
  its own backlog, priorities, queue, and pacing overrides. Projects deliver
  in parallel with isolated queues. Every event carries project identity and
  history/audit filters by project or list of projects.
- **EC-6 History and statistics export.** A versioned, machine-readable
  contract exposes ticket lifecycle (start/end, phase timings), outcomes,
  spend, and durations for planned, in-flight, and delivered work, via CLI/JSON
  output suitable for external consumers. Additive-only schema evolution.
- **EC-7 Agents on Jaiship primitives.** Agent prompts call Jaiship commands
  only; no shell-orchestration imperatives remain in the primary delivery
  path. A prompt conformance scan prevents regression.
- **EC-8 Dogfood window and shell retirement.** Delivery runs exclusively
  through the installed binary for the evidence window (>= 20 dispatches or 7
  days, all 11 result classes, zero unresolved divergence, zero shell
  fallback). Handover evaluation reports per-repository status. The shell
  orchestrators are retired (removed, or explicitly retained with a recorded
  rationale).

## Stories

### M3-S1 Installable, versioned binary
- Goal: The tool is a product artifact, not a checkout.
- Tasks: self-contained build; `install`/`upgrade`/`uninstall`/`--version`
  with build identity; compatibility check between installed binary and
  repository state version; documented cadence (install release -> deliver
  iterations -> decide -> re-install); dev builds kept out of the delivery
  path.
- AC: clean-profile install works; delivery runs while the repository is
  dirty or mid-change; upgrade is explicit, reversible, and version-reported.
- Depends on: M4-S1a (binary seed; re-home or extend).

### M3-S2 Jaiship namespace migration
- Goal: One product identity across every surface.
- Tasks: configuration and state directories; environment prefix; package/CLI
  identifiers in docs, guides, and prompts; idempotent migration command with
  dry-run and backup; one-release deprecation shims for old names; conformance
  scan forbidding old identifiers in product surfaces.
- AC: fresh install creates only Jaiship paths; migration moves existing
  state; scan fails on new old-namespace identifiers.
- Depends on: none.

### M3-S3 Delivery command conformance and repair
- Goal: Every primitive works reliably on the installed binary.
- Tasks: merge (verified ready item, UNKNOWN-mergeability recovery, merge-queue
  rebase); dispatch (concurrency-safe admission, resume semantics, classifier
  robustness against tracker/API flaps); queue (CRUD, plan, claim, park,
  reconcile); closeout (issue close, worktree prune, queue removal, milestone
  synchronization); one phase truth source (registry vs pm-notes artifacts);
  commit primitive (descriptive subjects, PATH-safe commitlint probe).
- AC: conformance battery green on the installed binary; regression tests per
  named defect; two concurrent dispatches without admission failure.
- Depends on: M3-S1, M3-S2.

### M3-S4 Declarative provider policy
- Goal: Quota-aware routing as product configuration, not shell logic.
- Tasks: quota watch targets (subscription usage endpoints), peak windows,
  chains/fallbacks, pacing goals and rungs, per-project overrides, spend
  budgets and alarms; policy simulation/dry-run; removal of shell-hook
  dependency from the delivery path (workstation hook remains optional for
  interactive shells).
- AC: policy expressed only in Jaiship config; simulated quota states produce
  the documented routing; soak delivery passes without the shell hook.
- Depends on: M3-S2.

### M3-S5 Project-scoped queues and parallel projects
- Goal: Multiple projects, isolated queues, one operator.
- Tasks: project definition (named set of repositories); per-project backlog
  view, priorities, queue, and pacing overrides; concurrent project delivery;
  project identity on every event; history/audit filtering by project or
  project list; per-project brief/status.
- AC: two projects deliver in parallel with no queue interference; every event
  is project-attributable; filters return exact sets.
- Depends on: M3-S3.

### M3-S6 Delivery history and statistics export
- Goal: A stable machine-readable contract for delivery history.
- Tasks: versioned JSON schema (ticket start/end, phase timings, outcomes,
  spend, durations, planned vs delivered); `history`/`report --json` command;
  schema tests; retention rules; documentation of the contract.
- AC: contract documented and schema-tested; covers planned, in-flight, and
  delivered work; additive-only evolution.
- Depends on: M3-S5.

### M3-S7 Agent prompts on Jaiship primitives
- Goal: The agent team drives Jaiship, not shell scripts.
- Tasks: rewrite `pm`, `ceo`, `coder`, `reviewer`, `committer`, `pr-manager`,
  `doc-syncer` prompts around Jaiship commands; remove shell-orchestration
  instructions from the primary path; prompt conformance scan; keep model
  assignment separate from behavior.
- AC: no shell-orchestrator imperatives in prompts; scan green; end-to-end
  delivery succeeds with the rewritten prompts.
- Depends on: M3-S3, M3-S4.

### M3-S8 Dogfood window and shell retirement
- Goal: Prove it, then retire the old path.
- Tasks: run delivery exclusively through the installed binary for the
  evidence window; publish handover evaluation per repository; retire the
  shell orchestrators (or record an explicit retention rationale); close the
  migration and update operator docs.
- AC: evidence bar met (>= 20 dispatches or 7 days, 11 result classes, zero
  unresolved divergence, zero fallback); handover per-repo status; retirement
  executed or justified in writing.
- Depends on: M3-S1..S7.

## Sequencing

- Wave 1: M3-S1 + M3-S2 (foundations).
- Wave 2: M3-S3 + M3-S4 (the merge/dispatch/commit repairs inside S3 may
  start as independent tickets during Wave 1; provider policy follows the
  namespace migration).
- Wave 3: M3-S5 + M3-S6 (multi-project, then the history contract built on
  project-scoped events).
- Wave 4: M3-S7 + M3-S8 (agents, then the dogfood window and retirement).

## Non-goals

- Presentation-layer, hosted-service, billing, or multi-tenant work. External
  consumers use the documented export contract only.
- GitHub repository rename (product namespace is independent of the
  repository name).
- Removing the shell path before the evidence bar; the retirement decision
  belongs to M3-S8.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Rename churn across docs/tests/prompts | One mechanical change + conformance scan |
| Installed-vs-source confusion | Build identity in every envelope; documented PATH precedence; dev builds isolated |
| State migration breakage | Idempotent migration, dry-run, backup |
| Quota API instability | Conservative pacing fallback, cached decisions |
| Command-hardening scope creep | Bounded regression tests per named defect; no redesign |
| Multi-project state scoping complexity | Build on per-repository state scoping; project layer additive |

## Decisions recorded (owner directive 2026-11-17)

- **D1.** M2 is finalized first (S16 #293 stays in M2); M3 delivery starts after
  M2 closes.
- **D2.** Rename depth: everything moves to the Jaiship identity — package
  scope, environment prefix, configuration and state directories, docs and
  prompts (M3-S2). The GitHub repository name is unchanged: product identity is
  independent of the repository name.
- **D3.** Shell retirement happens at M3 exit (M3-S8) once the evidence bar is
  met; the shell orchestrators stay documented fallbacks until then.
- **D4.** History/statistics are delivered as CLI/JSON output and files with a
  versioned contract; no embedded server or presentation layer lives in this
  repository.

## Open questions (owner input requested)

- **Q1. Install channel.** Proposed default: local install from a built
  artifact (single self-contained binary, explicit upgrade command); an
  additional package-manager channel can follow once the local model is
  proven. Confirm or override.
- **Q2. Project model.** Proposed default: a project owns tracker issues plus
  queue and pacing state; per-project planning documents are optional and
  referenced, not required. Confirm or override.
