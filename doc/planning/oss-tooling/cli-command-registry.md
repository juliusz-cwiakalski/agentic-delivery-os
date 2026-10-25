# ados(1) command registry and man page v0

The command surface of the open-source tooling. Working name `ados` until
the naming freeze (see [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md));
command names are locked before M0 ends via a decision record or the
man-page v1 acceptance. Story references point into
[backlog.md](backlog.md); usage flows live in
[user-journeys.md](user-journeys.md).

---

## ados(1): man page v0

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

### COMMAND FAMILIES

`ados --help` groups commands into families so the daily loop reads in
order:

- Deliver: dispatch, verify change, verify gates, merge, verify deploy, closeout
- See: status, queue ready (queue, lanes later), board, brief
- Operate: provider, config, state, validate, change, db, watchdog, doctor, supervise, workspace
- Learn: retro, metrics, spend, policy
- Surfaces: mcp, opencode
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
`ados config debug` shows the source of every key. Secrets are environment
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

Delivery: the story that first ships the command. Extended: stories that
grow it later.

### M0: Trust substrate

| Command | Purpose | Delivery | Extended |
|---|---|---|---|
| `ados config` | Inspect and debug configuration; per-key provenance (which layer, file, line) | M0-S4 | - |
| `ados status` | One bounded, ranked digest of the delivery world: tracker, changes and PRs, CI, lanes or queue, providers, parked work | M0-S6 | M1-S10 (collector expansion), M2-S4 (shared board state source) |
| `ados queue ready` | Read-only ready-set computation for one ticket: deps, repo free, tier known, owner gate, CI healthy, provider available; ranks close items (merge-ready, review-pending) above new starts | M0-S7 | M2-S1 (full queue, lanes, dispatch) |
| `ados verify change` | Verify a delivered change against the 11-phase ledger and classify the delivery result tuple; malformed notes are classified, never a crash | M0-S8 | M1-S9 (dual-run evidence consumer) |
| `ados verify gates` | One command evaluating all merge gates for a change, each gate cited in the result | M0-S9 | M2-S7 (suite-to-job mapping) |
| `ados validate` | Schema validation for pm-notes and the delivery registry at write time; lands bundled with verify change (M0-S8) | M0-S10 | M3-S4 (decision records, frontmatter, deploy checklist) |
| `ados change` | Phase bookkeeping for the 11-phase ledger: `change list`, `change phase complete`, `change phase reopen` with a required reason; the only write path for phase state, schema-validated and idempotent; used by the coordinating agent and every lifecycle agent | M0-S10 | - |
| `ados db` | Session-database admin (help text says so): size, list, prune, reboot helpers; dry-run by default | M0-S11 | - |
| `ados provider` | The one chain resolver for every AI spawn: provider chain, quota, peak windows, named self-expiring parks, fail-loud announcements | M0-S13 | - |
| `ados closeout` | One idempotent post-merge transaction: done flip, label sweep, unassign, owed-flip scan, comment resolution, checkout restore, squash-safe branch cleanup | M0-S14 | - |
| adapters library | GitLab and Jira client libraries plus a minimal GitHub read slice (PRs, pipelines, issues) so this repository dogfoods status and verify from M0; adapters implement the primitive ports with capability flags, embedded metadata, and the conformance suite (concepts: agent-primitive-surface, embedded-metadata, adapter-conformance); the full GitHub adapter lands M3-S3 (not a user command; the adapters package) | M0-S12 | M3-S3 (GitHub, Azure) |

### M1: Attention and minimal surfaces

| Command | Purpose | Delivery | Extended |
|---|---|---|---|
| `ados watchdog` | Multi-signal liveness checks: pre-flight refuses non-base or dirty checkout; teardown restores on every exit (checks; it does not run) | M1-S1 | - |
| `ados state` | Validated state admin: schema checks at every read/write boundary (delivery registry, retro registry, ceremony artifacts), classification of unknown, repair guidance | M1-S2 | M3-S6 (backup, restore, migration) |
| `ados doctor` | Doctor-style checks for repo, tracker, provider, state, CI wiring, each with a fix hint (diagnoses and prescribes) | M1-S3 | - |
| `ados merge` | Merge transaction helper: verify gates fresh, squash, verify the merge landed | M1-S4 | - |
| `ados verify deploy` | Deploy verification by job trace, never by job status | M1-S4 | - |
| `ados board` | Owner-gate SLA mechanics: 24 h stale escalation, 72 h default-on-expiry, aging visible | M1-S5 | M2-S4 (full board: lanes, gates, owner asks, parked work, one screen) |
| `ados brief` | Deterministic render-only owner brief from the M0 collectors with explicit placeholders; no LLM in the render path; decision-first layout | M1-S6 | - |
| `ados mcp` | Minimal MCP mirroring the CLI scope over proven engines: status, verify-artifact, gate report | M1-S7 | M3-S2 (full MCP with batch semantics) |
| `ados retro` | Retrospective evidence pipeline: collection, registry hardening, shape-crash guards, export; home of the periodic memory audit | M1-S8 | - |
| `ados dispatch` | Delivery pilot beside the bash stack on selected tickets with verify-change evidence; shell stays authoritative | M1-S9 | M2-S1 (programmatic queue, single-flight, preemption) |

### M2: Orchestration and measurement

| Command | Purpose | Delivery | Extended |
|---|---|---|---|
| `ados queue` | Programmatic delivery queue: dependency graph, ready-set, per-remote single-flight, preemption with named park state | M2-S1 | - |
| `ados lanes` | Lane plan with dependency awareness and a build-weight class (heavy builds excluded per runner); two lanes cannot deliver the same repo concurrently | M2-S1 | - |
| `ados supervise` | Supervisor service (runs): tri-state status, progress watchdogs, duplicate-supervisor detection, lying-liveness signals | M2-S2 | - |
| `ados ceremony` | Ceremony runner: artifact-verified, resumable, compact at boundaries, tiered intake; enumerated set: morning brief, retro evidence pass, sprint rollover, night-watch, testing-session assessment, decision-record mirror sync | M2-S3 | - |
| `ados steer` | Queued steering notes delivered at phase boundaries; owner asks batched with measured aging | M2-S5 | - |
| `ados metrics` | Delivery metrics: ceremony share, cycle time, CI failure rate, escaped defects | M2-S6 | - |
| `ados spend` | Cost observability: per-dispatch tokens/cost/restarts, quota snapshots, burn-rate alarms | M2-S6 | - |

### M3: Surfaces, adapters, validators

| Command | Purpose | Delivery | Extended |
|---|---|---|---|
| `ados opencode` | Native opencode commands/agents over the CLI core; same behavior cross-surface | M3-S1 | - |
| `ados policy` | Mechanical enforcement of rules at the point of action; prose rules without a check are flagged | M3-S5 | - |
| `ados workspace` | Clone, branch, and worktree hygiene with safety rails; never touches repos with live deliveries | M3-S6 | - |

### M4: Public release readiness

| Command | Purpose | Delivery | Extended |
|---|---|---|---|
| `ados update` | Self-update to pinned tagged releases (the stable install source) | M4-S2 | - |
| `ados cloud connect` | Opt-in relay agent mode for hosted integrations; off by default, local function never depends on it | M4-S6 | - |

---

## Foundation stories without a user command

These build the substrate every command consumes; they are delivered in M0
unless noted.

| Story | What it delivers |
|---|---|
| M0-S1 | Six-package monorepo, pnpm + Bun, CI fast loop, publish guard |
| M0-S2 | Branding seam (working name ados), forbidden-literal test, legacy env/config adapter, telemetry schema |
| M0-S3 | CommandResult envelope and the internal error table |
| M0-S5 | Local-first state layer behind an implementation-neutral abstraction |
| M0-S15 | Privacy and no-cloud guards in CI |
| M0-S16 | Interim mitigations (docs and config only) |
| M0-S17 | Decision records and the measurement baseline; command-name lock |
| M0-S18 | License registry under doc/legal/ plus the CI license gate |
| M4-S1 | Naming freeze and rename drill |
| M4-S4 | Merge the tooling branch to the default branch |
| M4-S5 | Bash stack retirement with deprecation notices |

---

## Strangler mapping (current stack to new commands)

The bash stack keeps running until each replacement passes parity. Parity is
per-collector or per-engine, never per-digest. Stays-bash rows are
deliberate: those scripts retire at M3-S7 or M4-S5 without a replacement.

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
| repo sync and branch utilities | `ados workspace` | Safety rails on live-delivery repos (M3-S6) |
| metrics collector | `ados metrics` | Thresholds and windows (M2-S6) |
| memory audit | `ados retro` | Folded into the retro pass (M1-S8) |
| workspace-specific scripts | stays bash | Retire with deprecation notice, no replacement |

---

## Deferred or out of scope

- `ados schedule` (cron/systemd plumbing): absorbed into `ados ceremony`
  (M2-S3) and `ados supervise` (M2-S2). No separate command.
- Minor utilities (spec-coverage, merge-stats report, session manager):
  candidates for a later `ados metrics` extension or post-M4; not in
  M0-M4.
- `ados ticket` (backlog creation and refinement as a command): the
  coordinating agent and tracker cover it today; revisit after M2.
- Hosted-only commands (inbox, relay admin, fleet supervision): proprietary,
  never committed in this repository.
- `ados queue ready` ships in M0 before its parent `ados queue` exists in
  M2. The M0 `--help` notes this so it does not read as a bug.
