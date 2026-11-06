---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/oss-tooling/cli-command-registry.md
---
# ados(1) command registry and man page v1

The command surface of the open-source tooling. Working name `ados` until
the naming freeze (see [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md));
[ODR-0003](../../decisions/ODR-0003-cli-command-naming-v1-lock.md) locks
the command names as the v1 surface. Story references point into
[backlog.md](backlog.md); usage flows live in
[user-journeys.md](user-journeys.md).

> **v1 lock (2026-10-31):** [ODR-0003](../../decisions/ODR-0003-cli-command-naming-v1-lock.md)
> freezes the command names and family names below as the v1 public
> surface. This promotion performs no rename; after M0 a rename requires a
> superseding decision record plus a code change.

---

## ados(1): man page v1 (locked)

### NAME

`ados` - the delivery command-line tool. One command-line surface over one
shared typed core; the same engines are exposed through the MCP server and
the opencode plugin.

### SYNOPSIS

```
ados <command> [options] [args]
ados <command> --help
ados --version
ados --help
```

### DESCRIPTION

`ados` turns a ticket into a reviewed, tested, merged delivery through a
deterministic 11-phase workflow, and manages the surrounding delivery
factory: state, configuration, queues, lanes, supervision, provider
routing, cost observability, and owner-facing briefs and boards.

Every command returns a CommandResult envelope: schemaVersion, runId,
exitCode, timing, and data or error. Errors come from a single internal
error table; exit codes are a projection of that table in the standalone
CLI only. Machine output (--json) is always valid, even on failure.
Output adapts by context: interactive terminals print the full pretty
envelope; scripted or piped invocations print one minified
`{"data":...}` or `{"error":...}` line (schemaVersion, runId, and
timing live in the command audit ledger, M1-S22, not the agent's
context; errors keep runId as the correlation key); `--verbose` forces
the full envelope; the trim activates when M1-S22 lands.

### TERMINOLOGY

Commands are named so each has exactly one meaning in the delivery domain;
near-synonym pairs are rejected at the naming lock.

- `verify`: check evidence against reality. Did the delivery actually
  happen, are the gates actually green, did the deploy actually run.
- `lint`: check documents and artifacts for schema and format conformance.
- `status`: what is happening now, as a bounded digest.
- `state`: the persisted stores, and their administration.

### COMMAND FAMILIES

`ados --help` groups commands into families so the daily loop reads in
order:

- Deliver: dispatch, plan, commit, verify change, verify gates, merge, verify deploy, closeout
- See: status, queue (ready now, full queue and lanes in M1), board, brief, blockers
- Operate: provider (AI model routing), config, state, lint, phase, db, watchdog, doctor, daemon, supervise, repos
- Learn: retro, metrics, spend, policy
- Surfaces: mcp, harness (opencode, Claude Code)
- Maintain: update

### GLOBAL OPTIONS

- `--json` - machine envelope output (context-adaptive; see the
  envelope paragraph above).
- `--verbose` - full envelope in any mode.
- `--pretty[=auto|always|never]` - indentation for `--json` output;
  streams stay line-delimited in every mode.
- `--config <path>` - use an explicit config file instead of discovery.
- `--no-color` - plain output.
- `--help` - command help.
- `--version` - version and build info.

Configuration follows the layered chain (low to high): built-in defaults,
system, user-global, project committed (`.ados/config.yaml`), project local
(`.ados/config.local.yaml`, gitignored), environment (`ADOS_*`), CLI flags.
`ados config` prints the merged configuration for the current context as a
plain JSON object; `ados config debug` adds the source of every key (layer,
file, line) as extended JSON or annotated JSONC. Secrets are environment
only.

### ENVIRONMENT

- `ADOS_*` - typed overrides (for example `ADOS_SERVER__PORT`).
- `ADOS_CONFIG` - explicit config file path.
- `ADOS_STATE_DIR` - state directory override (defaults to the XDG state
  directory under the working name).

### FILES

- `.ados/config.yaml` - project committed configuration.
- `.ados/config.local.yaml` - project local configuration (gitignored).
- `$ADOS_STATE_DIR` - local state (JSONL event log plus SQLite indexes),
  retention starts at forever.

### EXIT STATUS

Projected from the error table: 0 success, 1 user or validation error,
2 platform or provider error. The error table is the source of truth; the
exit code is only the standalone CLI projection.

---

## Command registry (build order)

Primary users: `operator` (the human owner), `coordinator` (the CEO-style
coordinating agent), `lifecycle agents` (the PM-style session and its lane
agents: spec writer, test-plan writer, plan writer, readiness reviewer,
coder, doc syncer, reviewer, runner, fixer, committer, PR manager),
`sessions` (other AI agents via the MCP and opencode surfaces), and
`engines` (internal consumers).

Delivery: the story that first ships the command. Extended: stories that
grow it later.

### M0: Trust substrate

| Command | Purpose | Primary user | Delivery | Extended |
|---|---|---|---|---|
| `ados config` | Two modes. Basic: print the merged configuration evaluated for the current context as a plain JSON object. Debug (`config debug` or `--debug`): per-key provenance (which layer, file, line) as extended JSON, or annotated JSONC with the source as a per-key comment | all users | M0-S4 | - |
| `ados status` | One bounded, ranked digest of the delivery world: six fixed sections (tracker, changes and PRs, CI, lanes or queue, providers, parked work), each with an observed/degraded/unknown/unavailable/not-delivered state and bounded evidence. The lanes-or-queue section reports a declared `not-delivered` gap until M1-S17 establishes the queue/lane engine; it never presents an empty queue and never duplicates `ados queue ready` (M0-S7) | coordinator, operator | M0-S6 | M1-S10 (collector expansion), M2-S4 (shared board state source) |
| `ados queue ready` | Read-only ready-set for one or more candidate refs (1..8): six fixed tri-state conditions (deps satisfied, repo free, tier known, no owner gate, CI healthy, provider available) with bounded evidence and every non-satisfied condition named; associates open pull requests by the repository branch convention and ranks close items (merge-ready, review-pending) above new starts. Reuses the status reads and never runs the provider engine or writes. Specified in [Queue Ready](../../spec/features/feature-queue-ready.md) | coordinator | M0-S7 | M1-S17 (full queue, lanes) |
| `ados verify change` | Verify a delivered change against the 11-phase ledger and classify the delivery result tuple; malformed notes are classified, never a crash | coordinator | M0-S8 | M1-S9 (dual-run evidence consumer) |
| `ados verify gates` | One command evaluating all merge gates for a change, each gate cited in the result (delivered) | coordinator | M0-S9 | M2-S7 (suite-to-job mapping) |
| `ados lint` | Schema and format conformance for pm-notes and the delivery registry at write time; lands bundled with verify change (M0-S8). The plan target (`lint plan`) ships with the delivery plan schema (M1-S13, GH-226) and reports the shared `plan.*` identities plus `lint.document.unreadable` | lifecycle agents, coordinator | M0-S10 | M1-S13 (delivery plan schema; shipped in GH-226), M3-S4 (decision records, frontmatter, deploy checklist) |
| `ados phase` | Phase bookkeeping for the 11-phase ledger: `phase list <ref>`, `phase complete <ref> <phase>`, `phase reopen <ref> <phase> <reason>`; the only write path for phase state, schema-validated and idempotent. A completion lands the ledger transition and the conventional commit atomically by default (`--no-commit` per call; `commit.phaseCommit: false` per project) and converges on re-run over the durable record-plus-commit delta | lifecycle agents | M0-S10 | M1-S14 (record-plus-commit on completion, default on with `--no-commit`; shipped in GH-227) |
| `ados db` | Session-database admin: size, list, prune, reboot helpers; dry-run by default | operator, coordinator | M0-S11 | - |
| `ados provider` | The AI provider family (model hosts only; tracker, VCS, and CI providers are adapters, not this family). Delivered subcommands: `resolve` (one chain decision; the only mutating path, persisting parks and announcements), `quota` (non-mutating condition evaluation for one provider or the default chain), and `parks list` (read-only active parks, `--all` for expired and cleared, `--provider` filter). Subscription-first chain resolution with eight skip reasons, UTC peak windows, quota evaluation, named self-expiring parks, and fail-loud announcements. M1-S21 extends the family: `profile resolve` (selection decision for a spawn: tier structure, per-agent overrides, eligibility chain, pacing rung) and `watch status` (live provider conditions); the spawn wrapper injects the resolved model environment as validated data records | engines, coordinator | M0-S13 | M1-S21 (profiles, watching, auto-switch with revert, pacing) |
| `ados closeout` | One idempotent post-merge transaction, dry-run by default and mutating only with `--apply`: ticket-to-done, lifecycle label sweep, unassign, owed-flip sweep, comment resolution, checkout restore, squash-safe local branch cleanup. Harness session telemetry capture is explicitly deferred to M1-S11 and is not part of this command. | coordinator | M0-S14 | M1-S11 (harness telemetry capture), M1-S12 (capsule promotion, judgment residue, full mechanical sweep) |
The adapters package is not a command. It implements the primitive ports
(concepts/agent-primitive-surface.md) with capability flags and embedded
metadata, verified by the conformance suite
(concepts/adapter-conformance.md). Primitive ports, the credential
port, and the embedded metadata envelope ship in M0-S12; client seeds
with trap catalogs (GitLab, Jira, plus a minimal GitHub read slice so
this repository dogfoods status and verify from M0) ship in M0-S19; the
conformance suite lands in M0-S20; adapter completion is M3-S3 (full
GitHub, Azure on demand).

### M1: Delivery engine and autonomous dispatch

| Command | Purpose | Primary user | Delivery | Extended |
|---|---|---|---|---|
| `ados watchdog` | Multi-signal liveness checks: pre-flight refuses non-base or dirty checkout; teardown restores on every exit (checks; it does not run) | coordinator, engines | M1-S1 | M1-S15 (progress-based liveness signals) |
| `ados state` | Validated state admin: schema checks at every read/write boundary (delivery registry, retro registry, ceremony artifacts), classification of unknown, repair guidance | engines, coordinator | M1-S2 | M3-S6 (backup, restore, migration) |
| `ados doctor` | Doctor-style checks for repo, tracker, provider, state, CI wiring, each with a fix hint (diagnoses and prescribes) | operator, coordinator | M1-S3 | - |
| `ados merge` | Merge transaction helper: verify gates fresh, squash, verify the merge landed; the gate set is config-declared, versioned data; a refusal names the failed gate with inline evidence; the freshness bound covers tracker state as well as CI; owner-gate classification is policy-as-data and every override is a recorded waiver | coordinator | M1-S4 | - |
| `ados verify deploy` | Deploy verification by job trace, never by job status | coordinator | M1-S4 | - |
| `ados plan` | Machine-readable delivery plans: validate (schema: per-phase files/packages/folders scope, done-artifacts, leases, weight class, declared interactions, ceremony tier as data), diff (declared scope versus actual branch diff), overlap (pairwise: run in sequence with overlapping paths named, or parallel); feeds the ready-for-development gate. Shipped in GH-226 (M1-S13); legacy `chg-<ref>-plan.md` remains readable with a classified transition verdict while `chg-<ref>-plan.yaml` is authoritative | lifecycle agents, coordinator | M1-S13 (shipped in GH-226) | - |
| `ados commit` | Commit primitive: computes a conventional commit message from uncommitted files plus change context (ref, phase, plan phase), stages precisely (tracked work with drift disclosed; untracked only inside the declared scope; strays never), runs the deterministic safety pass before any transport, and performs record-plus-commit atomically on phase completion. One constrained model call behind an ordered transport seam (core-owned inference, harness one-shot, marked template fallback), commitlint-aware validation with one retry, and a `commit.telemetry` event per landed commit. Shipped in GH-227 (M1-S14) | lifecycle agents | M1-S14 (shipped in GH-227) | - |
| `ados board` | Owner-gate SLA mechanics: 24 h stale escalation, 72 h default-on-expiry, aging visible | operator, coordinator | M1-S5 | M2-S4 (full board: lanes, gates, owner asks, parked work, one screen) |
| `ados brief` | Delivered in GH-228 (M1-S6): deterministic render-only owner brief from the same collector state as the status digest (one source of truth) with explicit placeholders; no LLM in the render path; decision-first layout; carries ready-to-merge, blocker questions, owner-gate ages as anchored actions. Collector unavailability renders at exit `0` as named surface evidence; only containment identities fail | operator | M1-S6 (delivered in GH-228) | - |
| `ados mcp` | Minimal MCP mirroring the CLI scope over proven engines: status, verify-artifact, gate report | sessions | M1-S7 | M3-S2 (full MCP with batch semantics) |
| `ados retro` | Retrospective evidence pipeline: collection, registry hardening, shape-crash guards, export; home of the periodic memory audit; runs retro levels on demand per concepts/retrospectives.md | coordinator | M1-S8 | - |
| `ados blockers` | Typed blocker and question channel: typed questions (decision-needed with options, spec-ambiguity, credential-missing with variable name only, external-wait) published to the state layer, ranked in digest and brief, answerable as data; answers resume lanes without re-entering delivery sessions; one mechanism, two audiences (owner gates and coordinator) | coordinator, operator | M1-S16 | - |
| `ados queue` | Programmatic delivery queue: dependency graph, ready-set, per-remote single-flight (the only structural lane cap), preemption with named park state, build-weight classes, closing-beats-opening ranking, park/resume that re-checks its condition continuously; one-shot mode computes the next action without the daemon | coordinator | M1-S17 | - |
| `ados lanes` | Lane observation surface: lanes with state (delivering, idle-with-reason, parked, merge-ready, in-review, failed), lease holders, restart counters, resume-amplification signal; `--watch` subscribes to bounded lane events | coordinator | M1-S17 | - |
| `ados daemon` | Resident dispatch daemon: start [--foreground], stop, status [--live], install, uninstall; single-instance enforcement with fence-token takeover, crash-safe state, dispatcher never a lane, prepares and queues merges but never fires them, startup reconciliation with lane classification and durable restart budgets, trust model: the filesystem same-user boundary with a reserved caller-principal seam; absence or failure degrades to the CLI one-shot path; communication contract: state-mediated truth with a local control socket as optimization (wake-now, live streams), every interaction carrying a state-only fallback | coordinator | M1-S18 | M2-S2 (supervision battery over its lanes) |
| `ados spend` | Spend read side v0: per-ticket and per-phase tokens by class, calls, per agent and model from closeout-captured telemetry; resume-amplification metric and restart counts | operator, coordinator | M1-S19 | M2-S6 (burn-rate alarms, quota snapshots, ceremony share) |
| `ados dispatch` | The typed per-ticket dispatch loop (spawn, watch, classify, summarize with the key=value continuity contract) beside the bash stack: spawns sessions through the harness adapter over an execution-environment descriptor with a deny-by-default env allowlist; result `merged` means already-merged detection, never a merge fired by dispatch (constraint 9); dual-run with verify-change evidence, then per-repo handover (new stack authoritative, bash fallback with deprecation pointers) after two clean weeks per repo | coordinator | M1-S9 | - |

### M2: Ceremonies, measurement, and memory

| Command | Purpose | Primary user | Delivery | Extended |
|---|---|---|---|---|
| `ados supervise` | Supervision battery over the daemon's lanes: tri-state status, progress watchdogs, duplicate-supervisor detection, lying-liveness signals by artifact evidence, restart policies | coordinator | M2-S2 | - |
| `ados ceremony` | Ceremony runner: artifact-verified, resumable, compact at boundaries, tiered intake; the ceremony tier engine (per-tier phase sets and escalation triggers as data, consuming M1-S13 plan tiers); the built-in set: morning brief, retro evidence pass, sprint rollover, night-watch, testing-session assessment, decision-record mirror sync; ceremonies are declared units, so projects can add their own; retro ceremonies follow concepts/retrospectives.md (levels, triggers, follow-through-first) | coordinator | M2-S3 | - |
| `ados steer` | Queued steering notes delivered at phase boundaries; owner asks batched with measured aging; the first message type of the typed message contract (origin, receipt, TTL), extensible to agent-to-agent messaging (concepts/inter-agent-communication.md) | operator, coordinator | M2-S5 | - |
| `ados metrics` | Delivery metrics: ceremony share, cycle time, CI failure rate, escaped defects | coordinator, operator | M2-S6 | - |

### M3: Surfaces, adapters, validators

| Command | Purpose | Primary user | Delivery | Extended |
|---|---|---|---|---|
| `ados harness` | Harness integrations: list configured harnesses; install or update the ados plugin for a harness (opencode, Claude Code; pi.dev candidate), generated from the canonical source with sync verification (concepts/harness-adapters.md) | sessions, operator | M3-S1 | - |
| `ados policy` | Policy as code, two jobs: fleet policy check and apply (declared repository policy: branch protection, required checks, merge rules) with exception profiles and timestamped snapshots for rollback and forensics; and a rules register that flags prose rules without a mechanical check (concepts/policy-as-code.md) | operator, coordinator | M3-S5 | - |
| `ados memory` | Memory governance family: lint (schema, provenance, budgets, index coverage), candidates, promote, supersede, conflicts, stale, doctor (full audit), compile (project canonical memory into each harness's native formats) | all agents, coordinator | M3-S8, M3-S9 | `doctor` continues the health-check family; see concepts/memory-architecture.md |
| `ados repos` | Clone, branch, and worktree hygiene with safety rails; never touches repos with live deliveries; worktree-aware (worktree-per-delivery is the parked parallel mode's mechanism) | operator, coordinator | M3-S6 | - |

### M4: Public release readiness

| Command | Purpose | Primary user | Delivery | Extended |
|---|---|---|---|---|
| `ados update` | Self-update to pinned tagged releases (the stable install source) | operator | M4-S2 | - |

---

## Foundation stories without a user command

These build the substrate every command consumes; they are delivered in M0
unless noted.

| Story | What it delivers |
|---|---|
| M0-S1 | Six-package monorepo, pnpm + Bun, CI fast loop, publish guard |
| M0-S2 | Branding seam (working name ados), forbidden-literal test with the legacy adapter allowlist, legacy env/config adapter, telemetry schema |
| M0-S3 | CommandResult envelope and the internal error table |
| M0-S5 | Local-first state layer behind an implementation-neutral abstraction |
| M0-S15 | Privacy and no-cloud guards in CI |
| M0-S16 | Interim mitigations (docs and config only) |
| M0-S17 | Decision records and the measurement baseline; command-name lock |
| M0-S18 | License registry under doc/legal/ plus the CI license gate |
| M4-S1 | Naming freeze and rename drill |
| M4-S4 | Merge the tooling branch to the default branch |
| M4-S5 | Bash stack retirement (compatibility wrappers during the window, then removal) |

---

## Plain-language notes (commands that need a second look)

- `brief`: the owner's one-screen summary, rendered from live collector
  data, never chat. Example: three decisions aging past SLA, two red
  pipelines, one parked lane, one line each.
- `board`: the whole fleet on one screen (lanes, gates, owner asks, parked
  work). Brief is the narrative digest; board is the state grid.
- `ceremony`: the scheduled factory rituals (morning brief render, retro
  pass, sprint rollover, night-watch) run deterministically, with catch-up
  when a scheduled run was missed. The ceremony set is declared, not
  hardcoded: the built-ins ship with the tool and projects declare their
  own.
- `steer`: a note that reaches a running delivery at its next phase
  boundary, with a receipt. How the owner changes course without killing
  the session ("hold the merge until I review").
- `spend`: cost truth from the event log: burn by agent, model, and
  ticket; quota snapshots; alarms that catch silent overnight churn.
- `watchdog` versus `daemon` versus `supervise`: watchdog checks
  (pre-flight, teardown, liveness probes); daemon runs (the resident
  scheduler that starts lanes and drives the queue, M1-S18); supervise
  watches (the supervision battery that detects stuck or lying deliveries
  and applies restart policies over the daemon's lanes, M2-S2). Watchdog
  checks, daemon runs the loop, supervise runs the watch.
- `blockers`: typed questions with answers as data. Blockers publish from
  lanes as typed records (decision-needed, spec-ambiguity,
  credential-missing, external-wait), rank in the digest and brief, and
  resolve with one answer command that resumes the lane without re-entering
  the delivery session. Owner-gate asks render through the same mechanism.
- `plan`: declared scope, not prose. The machine-readable plan says which
  files, packages, and folders each phase touches, what artifact proves
  the phase done, and which leases and weight class it needs. Overlap and
  parallelism are computed from it; nobody reads a diff to guess.
- `doctor`: diagnose and prescribe. One command checks repo, tracker,
  provider, state, and CI wiring, and prints a fix hint for each failing
  check.
- `phase`: the only way to mark a lifecycle phase complete or reopened (a
  reopen requires a reason). It writes the ledger every verification reads.
- `lint`: document conformance (are the pm-notes and decision records
  well-formed). Verify is evidence against reality; lint is schema and
  format.
- `provider`: the AI model routing engine. `resolve` returns one chain
  decision and persists parks and announcements; `quota` inspects conditions
  without writing state; `parks list` reads the park projection. None of
  them sleeps or spawns. Tracker, VCS, and CI providers are adapters, not
  this command.
- `status`: the read-only first-call digest. Six sections in fixed order,
  each with an explicit evidence state; a failed, absent, or unattempted
  read is reported as degraded, unknown, unavailable, or not-delivered,
  never as clear or zero. The queue/lane section is a declared
  `not-delivered` gap until M1-S17, so an empty queue is never implied;
  `queue ready` (M0-S7) remains the separate ready-set command.
- `policy`: policy as code. Declare what repos should enforce (branch
  protection, required checks, merge rules); check reports drift across the
  fleet; apply fixes it with a rollback snapshot first. Also the rules
  register: a written rule without a mechanical check behind it is flagged,
  so prose rules are never mistaken for enforced ones.

---

## Strangler mapping (current stack to new commands)

The bash stack keeps running until each replacement passes parity. Parity is
per-collector or per-engine, never per-digest. Stays-bash rows are
deliberate: those scripts are deprecated during the window and removed at
M3-S7 or M4-S5 without a replacement.

| Current tool | New command | Parity point |
|---|---|---|
| deliver-ticket.sh | `ados dispatch` + `ados verify change` | Dual-run pilot (M1-S9); per-repo handover after two clean weeks of verify-change evidence (M1-S9) |
| per-repo status collector scripts | `ados status` | Parity per collector, tracker included (M0-S6); digest parity only when every collector is verified |
| pm-liveness.sh | `ados watchdog` + `ados daemon` liveness | Watchdog checks (M1-S1); progress-based liveness so prefilling never reads as stalled (M1-S15) |
| merge gate battery (manual) | `ados verify gates` + `ados merge` | Gate battery cited per merge (M0-S9, M1-S4) |
| provider resolver hooks (legacy bash) | `ados provider` | Ported provider test battery (M0-S13) |
| manual closeout ceremony | `ados closeout` | Idempotent dual-run (M0-S14); full mechanical sweep with judgment residue (M1-S12) |
| session-database admin prototype | `ados db` | Prune idempotent, no live lock deleted (M0-S11) |
| CI and runner health checks | `ados doctor` | Fix hints per failing check (M1-S3) |
| batch-deliver.sh | `ados queue` + `ados daemon` | Scheduling engine one-shot mode (M1-S17); continuous operation under the daemon (M1-S18) |
| ceo-loop.sh | `ados daemon` (loop driving) + M1-S23 (coordinator-session supervision) | Loop-driving hands over with the daemon (M1-S18); coordinator supervision (context resume, stuck detection, kill, budget, wake-on-question) is M1-S23 - both are required before the M4-S5 bash retirement |
| ceremony scripts | `ados ceremony` | Ceremony set enumerated (M2-S3) |
| repo sync and branch utilities | `ados repos` | Safety rails on live-delivery repos (M3-S6) |
| metrics collector | `ados metrics` | Thresholds and windows (M2-S6) |
| memory audit | `ados retro` | Folded into the retro pass (M1-S8) |
| workspace-specific scripts | stays bash | Deprecated during the window, then removed; no replacement |

---

## Deferred or out of scope

- `ados schedule` (cron/systemd plumbing): absorbed into `ados ceremony`
  (M2-S3) and `ados supervise` (M2-S2). No separate command.
- Minor utilities (spec-coverage, merge-stats report, session manager):
  candidates for a later `ados metrics` extension or post-M4; not in
  M0-M4.
- `ados ticket` (backlog creation and refinement as a command): the
  lifecycle agents and tracker cover it today; revisit after M2.
- Remote connection command: lands when a remote-service track defines its
  contract. Only the neutral extension hooks are in scope here (M4-S6).
- Hosted-only commands (inbox, relay admin, fleet supervision): proprietary,
  never committed in this repository.
- `ados queue ready` ships in M0 before its parent `ados queue` exists in
  M1. This registry note records the partial family so it does not read as
  a defect; no rendered command-help surface exists or is added in M0.
- Concept-parked surfaces (no commands in M0-M4; see
  [../concepts/README.md](../concepts/README.md)): an agent messaging
  family beyond steer (typed inbox surface; steer M2-S5 is the first
  message type), a containerized execution profile
  (containerized-delivery), a credential sidecar with CLI shims
  (credential-sidecar), and an isolated external-research runner
  (external-research-isolation). Each names its compatibility seams
  under "Compatibility with the current build"; commands are named when
  the concept is scheduled, not before.

## Naming audit (names reviewed and kept, with disambiguating help lines)

- `db` kept: help reads "session-database admin".
- `update` kept: help reads "update the ados binary to a pinned tagged
  release"; it never mutates tickets or branches.
- `provider` kept, scope clarified: this family manages AI model providers
  and routing only; tracker, VCS, and CI providers are adapters. The name
  is confirmed as v1 by ODR-0003.
- `state` kept, distinct from `status` per the TERMINOLOGY section: state
  manages the persisted stores; status reports what is happening now.

Names added by the M1 redefinition (`plan`, `commit`, `blockers`, `daemon`,
`queue`, `lanes`, `spend`) are provisional in this planning document: the
ODR-0003 v1 lock covers the locked surface, and each family's delivery
records the name through the lock's superseding-note path (one record
covering the M1 additions, or per-story notes). Renames of locked names
still require a superseding decision record. The `plan` family shipped in
GH-226 (M1-S13) and the `commit` family in GH-227 (M1-S14) while this note
stands; recording their names through that path remains pending.

Renames made by the original audit (before the M0-S17 lock): `change` to
`phase` (the command manages phases; "change" is the domain noun and
collided with `verify change`), `validate` to `lint` (near-synonym of
`verify`; lint is document conformance, verify is evidence against
reality), `workspace` to `repos` (workspace is the per-change artifact set
in ADOS vocabulary; the command does repository hygiene), `opencode` to
`harness` (the command manages harness integrations generally, not one
harness). The remote connection command was deferred rather than named.
