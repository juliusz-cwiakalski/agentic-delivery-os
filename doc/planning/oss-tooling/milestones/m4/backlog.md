# M4 — Jaiship-native delivery backlog

Canonical scope for M4. Ticket references are added when the story tickets are
created (after plan approval).

### M4-S1 Installable, versioned binary
- Goal: The tool is a product artifact, not a checkout.
- Tasks: self-contained build; `install`/`upgrade`/`uninstall`/`--version`
  with build identity; compatibility check between installed binary and
  repository state version; documented cadence (install release -> deliver
  iterations -> decide -> re-install); dev builds kept out of the delivery
  path.
- AC: clean-profile install works; delivery runs while the repository is dirty
  or mid-change; upgrade is explicit, reversible, version-reported.
- Depends on: M4-S1a (binary seed, delivered), M3.
- Ticket: GH-346 (milestone M4)

### M4-S2 Jaiship namespace migration
- Goal: One product identity across every surface.
- Tasks: configuration and state directories; environment prefix; package/CLI
  identifiers in docs, guides, prompts; idempotent migration command with
  dry-run and backup; one-release deprecation shims; conformance scan
  forbidding old identifiers.
- AC: fresh install creates only Jaiship paths; migration moves existing
  state; scan fails on new old-namespace identifiers.
- Depends on: none.

### M4-S9 Dispatch parity — one command replaces the delivery lane
- Goal: `dispatch` is a complete typed replacement for the shell lane.
- Tasks: harness spawn; session capture/attach/resume; heartbeat and stuck
  detection; restart budget; eleven result classes; poll exhaustion fallback;
  concurrent admission; resume over a pr-open attempt; status/log queries.
- AC: parity battery green for all eleven classes; two concurrent dispatches
  admit; poll exhaustion never reports success.
- Depends on: M4-S1, M3-S1.
- Ticket: GH-347 (milestone M4)

### M4-S10 CEO loop supervision inside jaiship
- Goal: the outer loop is a jaiship command; the shell loop is not needed.
- Tasks: loop start/stop/status/log/reset over the supervision engine; CEO
  agent spawned through the harness port; restart backoff; durable stop;
  liveness watchdog; single-instance lock.
- AC: parity with the shell loop surface; durable stop across restarts; stuck
  session restarted; one full cycle with primitives only.
- Depends on: M4-S9.
- Ticket: GH-348 (milestone M4)

### M4-S11 Merge, closeout, and queue repair on the primitives
- Goal: merge and cleanup are primitives only.
- Tasks: merge fallback and UNKNOWN recovery; merge-queue rebase; required
  checks; crafted squash metadata; one phase truth source; idempotent
  closeout --apply; queue integrity; regression per named defect.
- AC: merge without a platform CLI; typed sync-required for DIRTY/BEHIND;
  closeout leaves no leftovers; phase sources agree.
- Depends on: M4-S1.
- Ticket: GH-349 (milestone M4)

### M4-S3 Delivery command conformance and repair
- Goal: Every primitive works reliably on the installed binary.
- Tasks: merge (verified ready item, UNKNOWN-mergeability recovery, merge-queue
  rebase); dispatch (concurrency-safe admission, resume semantics, classifier
  robustness against tracker/API flaps); queue (CRUD, plan, claim, park,
  reconcile); closeout (issue close, worktree prune, queue removal, milestone
  synchronization); one phase truth source (registry vs pm-notes artifacts);
  commit primitive (descriptive subjects, PATH-safe commitlint probe).
- AC: conformance battery green on the installed binary; regression tests per
  named defect; two concurrent dispatches without admission failure.
- Depends on: M4-S1, M4-S2.

### M4-S4 Declarative provider policy
- Goal: Quota-aware routing as product configuration, not shell logic.
- Tasks: quota watch targets, peak windows, chains/fallbacks, pacing goals and
  rungs, per-project overrides, budgets and alarms; policy simulation;
  removal of shell-hook dependency from the delivery path.
- AC: policy expressed only in Jaiship config; simulated quota states produce
  the documented routing; soak delivery passes without the shell hook.
- Depends on: M4-S2.
- Ticket: GH-350 (milestone M4)

### M4-S5 Project-scoped queues and parallel projects
- Goal: Multiple projects, isolated queues, one operator.
- Tasks: project definition (named set of repositories); per-project backlog
  view, priorities, queue, pacing overrides; concurrent delivery; project
  identity on every event; history/audit filtering by project or list;
  per-project brief/status.
- AC: two projects deliver in parallel with no queue interference; every event
  is project-attributable; filters return exact sets.
- Depends on: M4-S3, M3-S6.
- Ticket: none yet (follows the flip)

### M4-S6 Delivery history and statistics export
- Goal: A stable machine-readable contract for delivery history.
- Tasks: versioned JSON schema (ticket start/end, phase timings, outcomes,
  spend, durations, planned vs delivered); `history`/`report --json`; schema
  tests; retention rules; contract documentation.
- AC: contract documented and schema-tested; covers planned, in-flight, and
  delivered work; additive-only evolution.
- Depends on: M4-S5.
- Ticket: none yet (follows the flip)

### M4-S7 Agent prompts on Jaiship primitives
- Goal: The agent team drives Jaiship, not shell scripts.
- Tasks: rewrite `pm`, `ceo`, `coder`, `reviewer`, `committer`, `pr-manager`,
  `doc-syncer` prompts around Jaiship commands; remove shell-orchestration
  instructions from the primary path; prompt conformance scan; keep model
  assignment separate.
- AC: no shell-orchestrator imperatives in prompts; scan green; end-to-end
  delivery succeeds with rewritten prompts.
- Depends on: M4-S3, M4-S4.
- Ticket: GH-351 (milestone M4)

### M4-S8 Dogfood window and shell entry-point rewrite
- Goal: Prove it on the installed binary, then make the wrappers thin.
- Tasks: run delivery exclusively through the installed binary for the
  evidence window; publish handover evaluation per repository; rewrite
  `deliver-ticket.sh` and `ceo-loop.sh` as thin wrappers over `jship`; stop
  internal use of the wrappers; update operator docs.
- AC: evidence bar met (>= 20 dispatches or 7 days, 11 result classes, zero
  unresolved divergence, zero fallback); wrappers call `jship` only and are
  unused for internal development.
- Depends on: M4-S1..S7.
- Ticket: GH-352 (milestone M4)
