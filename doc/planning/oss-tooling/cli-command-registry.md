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

- Deliver: dispatch, verify change, verify gates, merge, verify deploy, closeout
- See: status, queue ready (queue, lanes later), board, brief
- Operate: provider (AI model routing), config, state, lint, phase, db, watchdog, doctor, supervise, repos
- Learn: retro, metrics, spend, policy
- Surfaces: mcp, harness (opencode, Claude Code)
- Maintain: update

### GLOBAL OPTIONS

- `--json` - machine-readable envelope output.
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
| `ados status` | One bounded, ranked digest of the delivery world: six fixed sections — tracker, changes and PRs, CI, lanes or queue, providers, parked work — each with an observed/degraded/unknown/unavailable/not-delivered state and bounded evidence. The lanes-or-queue section reports a declared `not-delivered` gap until M2-S1 establishes the queue/lane engine; it never presents an empty queue and never duplicates `ados queue ready` (M0-S7) | coordinator, operator | M0-S6 | M1-S10 (collector expansion), M2-S4 (shared board state source) |
| `ados queue ready` | Read-only ready-set computation for one ticket: deps, repo free, tier known, owner gate, CI healthy, provider available; ranks close items (merge-ready, review-pending) above new starts | coordinator | M0-S7 | M2-S1 (full queue, lanes, dispatch) |
| `ados verify change` | Verify a delivered change against the 11-phase ledger and classify the delivery result tuple; malformed notes are classified, never a crash | coordinator | M0-S8 | M1-S9 (dual-run evidence consumer) |
| `ados verify gates` | One command evaluating all merge gates for a change, each gate cited in the result | coordinator | M0-S9 | M2-S7 (suite-to-job mapping) |
| `ados lint` | Schema and format conformance for pm-notes and the delivery registry at write time; lands bundled with verify change (M0-S8) | lifecycle agents, coordinator | M0-S10 | M3-S4 (decision records, frontmatter, deploy checklist) |
| `ados phase` | Phase bookkeeping for the 11-phase ledger: `phase list <ref>`, `phase complete <ref> <phase>`, `phase reopen <ref> <phase> <reason>`; the only write path for phase state, schema-validated and idempotent | lifecycle agents | M0-S10 | - |
| `ados db` | Session-database admin: size, list, prune, reboot helpers; dry-run by default | operator, coordinator | M0-S11 | - |
| `ados provider` | The AI provider family (model hosts only; tracker, VCS, and CI providers are adapters, not this family). Delivered subcommands: `resolve` (one chain decision; the only mutating path, persisting parks and announcements), `quota` (non-mutating condition evaluation for one provider or the default chain), and `parks list` (read-only active parks, `--all` for expired and cleared, `--provider` filter). Subscription-first chain resolution with eight skip reasons, UTC peak windows, quota evaluation, named self-expiring parks, and fail-loud announcements; model-profile selection and harness spawn are later stories | engines, coordinator | M0-S13 | - |
| `ados closeout` | One idempotent post-merge transaction: done flip, label sweep, unassign, owed-flip scan, comment resolution, checkout restore, squash-safe branch cleanup; captures harness session telemetry into the event log | coordinator | M0-S14 | M1-S11 (harness telemetry capture) |
The adapters package is not a command. It implements the primitive ports
(concepts/agent-primitive-surface.md) with capability flags and embedded
metadata, verified by the conformance suite
(concepts/adapter-conformance.md). Primitive ports, the credential
port, and the embedded metadata envelope ship in M0-S12; client seeds
with trap catalogs (GitLab, Jira, plus a minimal GitHub read slice so
this repository dogfoods status and verify from M0) ship in M0-S19; the
conformance suite lands in M0-S20; adapter completion is M3-S3 (full
GitHub, Azure on demand).

### M1: Attention and minimal surfaces

| Command | Purpose | Primary user | Delivery | Extended |
|---|---|---|---|---|
| `ados watchdog` | Multi-signal liveness checks: pre-flight refuses non-base or dirty checkout; teardown restores on every exit (checks; it does not run) | coordinator, engines | M1-S1 | - |
| `ados state` | Validated state admin: schema checks at every read/write boundary (delivery registry, retro registry, ceremony artifacts), classification of unknown, repair guidance | engines, coordinator | M1-S2 | M3-S6 (backup, restore, migration) |
| `ados doctor` | Doctor-style checks for repo, tracker, provider, state, CI wiring, each with a fix hint (diagnoses and prescribes) | operator, coordinator | M1-S3 | - |
| `ados merge` | Merge transaction helper: verify gates fresh, squash, verify the merge landed | coordinator | M1-S4 | - |
| `ados verify deploy` | Deploy verification by job trace, never by job status | coordinator | M1-S4 | - |
| `ados board` | Owner-gate SLA mechanics: 24 h stale escalation, 72 h default-on-expiry, aging visible | operator, coordinator | M1-S5 | M2-S4 (full board: lanes, gates, owner asks, parked work, one screen) |
| `ados brief` | Deterministic render-only owner brief from the M0 collectors with explicit placeholders; no LLM in the render path; decision-first layout | operator | M1-S6 | - |
| `ados mcp` | Minimal MCP mirroring the CLI scope over proven engines: status, verify-artifact, gate report | sessions | M1-S7 | M3-S2 (full MCP with batch semantics) |
| `ados retro` | Retrospective evidence pipeline: collection, registry hardening, shape-crash guards, export; home of the periodic memory audit; runs retro levels on demand per concepts/retrospectives.md | coordinator | M1-S8 | - |
| `ados dispatch` | Delivery pilot beside the bash stack on selected tickets with verify-change evidence; spawns sessions through the harness adapter (opencode first, Claude Code next) over an execution-environment descriptor (host now; containerized execution is a parked concept); shell stays authoritative | coordinator | M1-S9 | M2-S1 (programmatic queue, single-flight, preemption) |

### M2: Orchestration and measurement

| Command | Purpose | Primary user | Delivery | Extended |
|---|---|---|---|---|
| `ados queue` | Programmatic delivery queue: dependency graph, ready-set, per-remote single-flight, preemption with named park state | coordinator | M2-S1 | - |
| `ados lanes` | Lane plan with dependency awareness and a build-weight class (heavy builds excluded per runner); two lanes cannot deliver the same repo concurrently | coordinator | M2-S1 | - |
| `ados supervise` | Supervisor service (runs): tri-state status, progress watchdogs, duplicate-supervisor detection, lying-liveness signals | coordinator | M2-S2 | - |
| `ados ceremony` | Ceremony runner: artifact-verified, resumable, compact at boundaries, tiered intake; the built-in set: morning brief, retro evidence pass, sprint rollover, night-watch, testing-session assessment, decision-record mirror sync; ceremonies are declared units, so projects can add their own; retro ceremonies follow concepts/retrospectives.md (levels, triggers, follow-through-first) | coordinator | M2-S3 | - |
| `ados steer` | Queued steering notes delivered at phase boundaries; owner asks batched with measured aging; the first message type of the typed message contract (origin, receipt, TTL), extensible to agent-to-agent messaging (concepts/inter-agent-communication.md) | operator, coordinator | M2-S5 | - |
| `ados metrics` | Delivery metrics: ceremony share, cycle time, CI failure rate, escaped defects | coordinator, operator | M2-S6 | - |
| `ados spend` | Cost observability: per-dispatch tokens/cost/restarts, quota snapshots, burn-rate alarms | operator, coordinator | M2-S6 | - |

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
- `watchdog` versus `supervise`: watchdog checks (pre-flight, teardown,
  liveness probes); supervise runs (the daemon that starts, watches, and
  restarts lanes). Watchdog checks, supervise runs.
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
  `not-delivered` gap until M2-S1, so an empty queue is never implied;
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
| deliver-ticket.sh | `ados dispatch` + `ados verify change` | Dual-run pilot (M1-S9); full handover per repo after two clean weeks of verify-change evidence (M2-S1) |
| per-repo status collector scripts | `ados status` | Parity per collector, tracker included (M0-S6); digest parity only when every collector is verified |
| loop watchdog script | `ados watchdog` | Watchdog checks (M1-S1); loop liveness is not a status collector |
| merge gate battery (manual) | `ados verify gates` + `ados merge` | Gate battery cited per merge (M0-S9, M1-S4) |
| provider resolver hooks (legacy bash) | `ados provider` | Ported provider test battery (M0-S13) |
| manual closeout ceremony | `ados closeout` | Idempotent dual-run (M0-S14) |
| session-database admin prototype | `ados db` | Prune idempotent, no live lock deleted (M0-S11) |
| CI and runner health checks | `ados doctor` | Fix hints per failing check (M1-S3) |
| parallel delivery mechanism | `ados dispatch` + `ados supervise` | Dual-run (M1-S9), full handover (M2-S1/M2-S2) |
| loop lifecycle script | `ados supervise` | Singleton lock and staleness takeover (M2-S2) |
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
  M2. The M0 `--help` notes this so it does not read as a bug.
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

Renames made by this audit (before the M0-S17 lock): `change` to `phase`
(the command manages phases; "change" is the domain noun and collided with
`verify change`), `validate` to `lint` (near-synonym of `verify`; lint is
document conformance, verify is evidence against reality), `workspace` to
`repos` (workspace is the per-change artifact set in ADOS vocabulary; the
command does repository hygiene), `opencode` to `harness` (the command
manages harness integrations generally, not one harness). The remote
connection command was deferred rather than named.
