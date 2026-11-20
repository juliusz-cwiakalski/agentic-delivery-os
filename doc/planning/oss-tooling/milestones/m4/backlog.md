# M4 — Jaiship-native delivery backlog

Canonical scope for M4. Ticket references are added when the story tickets are
created (after plan approval).

### M4-S1 Installable, versioned binary — **delivered (GH-346)**
- Goal: The tool is a product artifact, not a checkout.
- Delivered: the additive `build:binary` artifact with a compile-time build
  identity and the corrected compiled re-entry path; the composed `install`
  family (`install`, `status`, `rollback`, `uninstall`, `purge`) owning the
  artifact, its single rollback slot, the `install.record.v1` record, and the
  managed `PATH` block; the admission/dev-build gates; the read-only
  state-format compatibility check; the always-printed purge residual set and
  the four zero-write dry-runs; the guarded shell installer and the reporting
  shell uninstaller; and the documented cadence, upgrade, rollback, and
  removal story.
- Surfaces now owned by the family: the binary, the slot, the record, and the
  managed `PATH` block; the shell installers keep repository artifacts and the
  legacy launcher step.
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
- Ticket: GH-365 (milestone M4)

### M4-S9 Dispatch core parity — durable lane, resume, admission, classifier
- Goal: `dispatch` is a complete typed replacement for the shell lane.
- Tasks: harness spawn; session capture/attach/resume; heartbeat and stuck
  detection; restart budget; eleven result classes; poll exhaustion fallback;
  concurrent admission; resume over a pr-open attempt; status/log queries.
- AC: parity battery green for all eleven classes; two concurrent dispatches
  admit; poll exhaustion never reports success.
- Depends on: M4-S1, M3-S1.
- Ticket: GH-347 (milestone M4)

### M4-S12 Dispatch operator surface
- Goal: per-ref inspection without the shell lane.
- Tasks: per-ref status (delivering, pid, session, stale); bounded per-ref log;
  is-delivering query; last-message from the persisted transcript; persist
  harness output per ref.
- AC: the four queries answer for live, finished, and absent refs; the log is
  bounded; last-message is the PM's final message; no shell script is read.
- Depends on: M4-S9.
- Ticket: GH-354 (milestone M4)

### M4-S10 CEO loop supervision inside jaiship — **delivered (GH-348)**
- Goal: the outer loop is a jaiship command; the shell loop is not needed.
- Delivered: the `loop start|stop|status|log|reset` family as a composition
  profile over the delivered supervision engine under the identity `loop-main`;
  the CEO spawn through the harness port (`--agent ceo`, resolved seat model,
  deterministic `ceo-loop-<stamp>` title); the bounded restart policy with the
  declared backoff schedule and a durable readable reason; the identity-scoped
  durable `loop.stop` and its `reset`; the two-signal stuck verdict with the
  read-only delivery corroborator over the delivered lane records; the bounded
  operational log; the single-instance rule with session re-find; and the
  offline parity battery with its published proof boundary. Design:
  TDR-0056 (the profile boundary) and TDR-0057 (the durable stop home).
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
- Ticket: GH-366 (milestone M4, residual scope)
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

### M4-S4 Declarative provider policy — **delivered (GH-350)**
- Goal: Quota-aware routing as product configuration, not shell logic.
- Tasks: quota watch targets, peak windows, chains/fallbacks, pacing goals and
  rungs, per-project overrides, budgets and alarms; policy simulation;
  removal of shell-hook dependency from the delivery path.
- Delivered: the zone-aware engine and profile policy on one bounded expiry
  derivation; the typed `provider.budgets` ceilings with one ref-scoped spend
  read and the parked-versus-failed split; watch freshness with
  `maxAgeSeconds` and `watch-stale`; the `provider simulate` offline replay and
  the `provider migrate legacy` compatibility import; and the mount of the
  family as the twenty-eighth prompt-required family — provider policy now
  lives only in the tool's configuration, with the pre-iteration hook off the
  delivery path.
- AC: policy expressed only in Jaiship config; simulated quota states produce
  the documented routing; soak delivery passes without the shell hook.
- Depends on: M4-S2.
- Ticket: GH-350 (milestone M4)

### M4-S5 Project-scoped queues and parallel projects
- Goal: Multiple projects, isolated queues, one operator.
- Tasks: project definition (named set of repositories; a project may have
  several repositories and a work item may produce several repository tracks);
  per-project backlog view, priorities, queue, pacing overrides; concurrent
  delivery; project identity on every event; history/audit filtering by project
  or list; per-project brief/status; nullable project and runner attribution on
  records that can carry them.
- AC: two projects deliver in parallel with no queue interference; every event
  is project-attributable; filters return exact sets.
- Depends on: M4-S3, M3-S6.
- Ticket: GH-367 (milestone M4)

### M4-S6 Delivery history and statistics export
- Goal: A stable machine-readable contract for delivery history.
- Tasks: versioned JSON schema (ticket start/end, phase timings, outcomes,
  spend, durations, planned vs delivered, wait reasons with cause, provider and
  model per session, CI run id/attempt/timestamps); `history`/`report --json`;
  planned and observed events stored separately; schema tests; retention rules
  that are configured rather than silent; additively extensible fields;
  contract documentation.
- AC: contract documented and schema-tested; covers planned, in-flight, and
  delivered work; additive-only evolution.
- Depends on: M4-S5.
- Ticket: GH-368 (milestone M4)

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

### M4-S13 Runner identity and execution topology
- Goal: delivery activity is attributable to a stable runner identity.
- Tasks: stable runner id created at install (not hostname or path); lifecycle
  and health with last-seen; attribute sessions, queue claims, lane records,
  provider parks, and spend to runner and project; `runners list|show --json`;
  nullable attribution, never invented.
- AC: two runners on one host have distinct ids; sessions and spend carry
  runner and project attribution; restart preserves the id; health and
  last-seen are reported; no machine name is used as identity.
- Depends on: M4-S5, M3-S1.
- Ticket: GH-358 (milestone M4)

### M4-S14 Artifact reference model (binaries out of Git)
- Goal: delivery evidence can be referenced and browsed without bloating Git.
- Tasks: artifact reference record (id, kind, media type, size, content hash,
  storage uri, producer, iteration, work item, session, CI run, question);
  storage adapter boundary (local now, S3-compatible later); `artifacts
  list|show|add --json`; retention metadata; a guard test against committed
  binaries.
- AC: a reference resolves through the storage adapter or fails typed; context
  links are present; no binary is committed; filters by work item, kind, and
  time range.
- Depends on: M4-S6.
- Ticket: GH-359 (milestone M4)

### M4-S15 Human question inbox completion
- Goal: a cross-project, restart-safe question inbox with real answer
  hand-back.
- Tasks: blocking versus non-blocking, urgency and impact, answered/deferred/
  superseded history, correlation to project/work item/session, survival across
  restarts and offline periods, answer resumes the waiting dispatch,
  `blockers list --json` filters.
- AC: a question survives a restart and stays answerable; an answer resumes the
  work or is recorded as consumed; cross-project listing returns exact sets;
  deferred and superseded are distinguishable; nothing is silently dropped.
- Depends on: M4-S9, M4-S5.
- Ticket: GH-360 (milestone M4)
