---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-autonomous-delivery.md
ados_distribution: internal
id: SPEC-AUTONOMOUS-DELIVERY
status: Current
created: 2026-07-07
last_updated: 2026-11-20
owners: ["engineering"]
service: delivery-os
summary: "The unattended delivery neighborhood of the lifecycle: the two autonomous modes (Mode A — autonomous CEO loop; Mode B — manual batch), the delivery-script set declared by scripts/install.sh (opencode-session.sh, deliver-ticket.sh, lib/dispatch-authority.sh, batch-deliver.sh, ceo-loop.sh, pm-liveness.sh, lint-commit-range.sh), the AI-vs-script split, and the behavioral invariants (INV-DM-1..6) that keep unattended delivery converging instead of burning tokens. Mode A has two equivalent operator surfaces: the typed `jaiship loop start|stop|status|log|reset` family, a composition profile over the delivered supervision engine, and the retained `scripts/ceo-loop.sh` fallback. Liveness is multi-signal: recursive session-tree message traffic (parent_id traversal of the current message store; opencode 1.19.3 keeps messages in message and parts in part, while session_message is a legacy table that is empty on the reference store) PLUS git/worktree activity; a race-free delivering marker tells ceo-loop.sh the CEO is blocked on a delivery, while the typed loop reads the delivered dispatch/daemon lane records as its corroborator. deliver-ticket.sh does not merge. Since GH-148, deliver-ticket.sh and batch-deliver.sh are platform-aware: they auto-detect GitHub vs GitLab (env override > git remote > glab auth > default github) and route tracker/MR operations through a dispatch seam with JSON normalization, so GitLab deliveries report accurate results and populated PR URLs; ceo-loop.sh is unchanged (it delegates delivery and merges, so needs no platform detection)."
links:
  related_changes: ["GH-142", "GH-108", "GH-146", "GH-148", "GH-150", "GH-185", "PDEV-514", "PDEV-516", "GH-180", "GH-242", "GH-239", "GH-280", "GH-286", "GH-288", "GH-268", "GH-313", "GH-293", "GH-348", "GH-354"]
  decisions: ["TDR-0002", "TDR-0056", "TDR-0057"]
  guides:
    - "doc/guides/delivery-modes.md"
    - "doc/guides/autonomous-batch-delivery.md"
    - "doc/guides/zai-peak-hours-hook.md"
---

# Feature: Autonomous Delivery

## Overview

Autonomous Delivery is the unattended neighborhood of the delivery lifecycle: it runs the same 11-phase ADOS lifecycle ([feature-delivery-lifecycle.md](feature-delivery-lifecycle.md)) **without a human at the keyboard**, overnight or across a batch of tickets. Mode A runs as the typed `jaiship loop` family over the delivered supervision engine, with the deterministic bash scripts below as its retained fallback; Mode B runs as `batch-deliver.sh`. The bash set is the one `scripts/install.sh` declares — the `ADOS_DELIVERY_SCRIPTS` set (`opencode-session.sh`, `deliver-ticket.sh`, `lib/dispatch-authority.sh`, `batch-deliver.sh`, `ceo-loop.sh`, `pm-liveness.sh`, `lint-commit-range.sh`) plus `tools/clean-merged-branches` — which wrap the AI agents (the `@ceo` and the PM opencode session) with liveness monitoring, session resilience, single-flight coordination, and branch hygiene, carry the pre-PR commit-range lint the lifecycle runs before PR creation, and — in Mode B — gate the merge on human approval.

> **Canonical detail lives in the guide.** The full modes table, component-responsibility matrix, mermaid diagrams, recovery semantics, configuration, and troubleshooting are in [doc/guides/delivery-modes.md](../../guides/delivery-modes.md) (the canonical modes guide) and [doc/guides/autonomous-batch-delivery.md](../../guides/autonomous-batch-delivery.md) (canonical for Mode B operations). This spec names the capabilities, invariants, and the merge/liveness contracts; it does not restate the guide tables. Where the two describe the same machinery, they are kept consistent.

> **Engine-first operating definition.** The regular delivery path is the typed
> engine: `dispatch <ref>` appends real `pilot` attempt records, the lifecycle
> merge and closeout run through the engine primitives, and the Mode A outer loop
> runs as `jaiship loop` over the delivered supervision engine. The bash entry
> points this page specifies remain the documented, still-executable fallback: they
> keep their five-key delivery-summary tail, their exits, and the delivered
> authoritative-mode deprecation pointer. No repository is flipped by this change;
> a flip is a separate owner act executed with `dispatch handover <repo>` once the
> gate reads eligible, and its reversal is `dispatch handover <repo> --revert`.
>
> The four per-reference inspection queries the shell exposes — `--status`,
> `--log`, `--is-delivering`, and `--last-message` — have typed equivalents:
> `dispatch status <ref>`, `dispatch log <ref> [--tail <n>]`,
> `dispatch is-delivering [<ref>]`, and `dispatch last-message <ref>`. The typed
> forms read none of the shell's files and never write them, so the shell's marker,
> PID, stdout, and last-message files cannot steer a typed answer. The typed `log`
> and the shell's `--log` read different streams: the typed tail is the streaming
> harness's own stdout (for opencode, its JSON event stream), the shell's `--log`
> tails the opencode child's stderr held in `tmp/deliver-ticket/<REF>.log`, and each
> wrapper's own progress lines go to the wrapper's terminal. The shell entry points
> remain the documented, still-executable fallback, and an operator who needs the
> child's stderr or the wrapper's progress lines uses the shell lane or its
> terminal.

> **Planned-scope precondition.** An unattended run assumes the milestone and every ticket attached to it already exist in the tracker, and that intake verified the attachment before delivery. The precondition is owned by the milestone-first operating rule in [milestone-management.md](../../guides/milestone-management.md); this spec does not enforce it and adds no milestone logic to the delivery scripts.

## Business Context

### Problem Statement

- **Problem:** Sustained autonomous delivery of an AI agent loop either burns tokens babysitting cheap scripts or orphans work when an agent session dies. Without a deterministic, script-owned substrate, unattended delivery is unsafe.
- **Affected Users:** Solo engineers and small teams who want to wake up to PRs; the AI agent team that must converge instead of churning.
- **Business Impact:** A loop that respawns an expensive AI session on every exit to reconcile a detached cheap script can burn ~20 agent sessions on a single ticket. The fix is structural: the expensive AI never babysits the cheap script.

### Goals & Success Metrics

- **Primary Goal:** Unattended delivery that **converges** — exactly one in-flight delivery per repo working tree, no orphaned sessions, no racing agents, no infinite token burn on a stuck stream.
- **KPIs:** One CEO session alive at a time (Mode A); one PM per ticket at a time; a stuck LLM stream is killed within the stall threshold (default 10 min); `deliver-ticket.sh` never merges (merge authority is `@ceo` in Mode A, `batch-deliver.sh` in Mode B).

## User Experience & Functionality

### Capabilities

- **Two unattended modes (F-1):**
  - **Mode A — Autonomous CEO loop (`jaiship loop`, or the retained `scripts/ceo-loop.sh`):** a long-running outer supervisor spawns one `@ceo` agent session at a time; the `@ceo` picks the next ticket, calls `deliver-ticket.sh` (foreground, blocking), reads the delivery summary, merges approved + PM-finalized PRs through the `merge` primitive, handles blockers, and loops. Each iteration is a sequence of typed calls: `status` for the digest (including typed questions and ready-to-merge), `blockers answer` for open questions, `verify change`/`phase list` for finalization evidence, `merge <ref>` per ready item, `closeout <ref> --apply`, and `queue plan --next N` for the next pick; `brief` serves the owner-facing view, and `lanes`/`queue` carry lane state. The human is uninvolved until they stop the loop. The typed outer loop is `jaiship loop start|stop|status|log|reset` ([Loop Supervision](feature-loop-supervision.md)); `scripts/ceo-loop.sh` stays present and executable as the documented fallback until the F6 handover.
  - **Mode B — Manual batch (`batch-deliver.sh`):** the human provides an explicit ticket list; the batch script delivers each sequentially. The **human** is the merge authority — they approve via the `approved` label; `batch-deliver.sh` then rebases, waits for green quality gates, and squash-merges.
  - (Manual and Autopilot are the interactive run modes of the same lifecycle and are out of scope for this spec; see [change-lifecycle.md](../../guides/change-lifecycle.md).)
- **Per-ticket engine (F-2, `deliver-ticket.sh`):** the foreground, blocking, single-flight lifecycle runner. It spawns/resumes the PM opencode session, monitors liveness, kill-and-restarts on stall, classifies the result, and returns a delivery summary. It exposes scriptable subcommands so the AI does not burn tokens rediscovering scriptable facts: `--is-delivering [REF]`, `--last-message REF`, and `REF --resume-prompt "<text>"`.
- **Typed per-ref inspection (F-2.1):** the four per-reference queries the shell exposes have typed equivalents on the dispatch family — `dispatch status <ref>`, `dispatch log <ref> [--tail <n>]`, `dispatch is-delivering [<ref>]`, and `dispatch last-message <ref>`, each with the global `--json`. They read the durable `dispatch.lane` record, the per-ref harness-stdout artifact family, and the harness's persisted session transcript, and none reads or writes a shell-owned path (`tmp/deliver-ticket/**`, `.ai/local/delivery/**`, the delivering marker, a PID file, `<REF>.pm.out`, `<REF>.log`, `<REF>.last-message`). The typed tail is the streaming harness's own stdout — for opencode its JSON event stream — while the shell's `--log` tails the opencode child's stderr, and each wrapper's own progress lines go to the wrapper's terminal; the two surfaces answer related but different questions, and neither is a truth source for the other. A one-shot adapter lane (Claude Code) streams nothing, so its `dispatch log` answers `no-log`, meaning no artifact exists for that reference. Contract detail: [Dispatch Engine](feature-dispatch-engine.md); operation routine: [Engine-first Delivery Operations](../../guides/engine-first-operations.md).
- **No-merge contract (F-3):** `deliver-ticket.sh` **does not merge**. It returns `pr-open` (+ PR URL + PM last-message). The legacy auto-merge-on-`approved`-label path inside the PM is retired. Merge authority is the `@ceo` (Mode A, after PM-finalization verification, through the `merge` primitive) or `batch-deliver.sh` (Mode B, after human approval + rebase + green-gate).
- **Session-traffic liveness (F-4, `pm-liveness.sh`):** "liveness" is measured by **opencode session-message traffic** (new assistant/tool messages), not by process-alive — and it is **multi-signal**. The primary signal queries the **current message store** across the **recursive session tree** (traversing `session.parent_id`), so traffic from child sessions (when the PM delegates to `@coder`/`@spec-writer`/…) is counted — a quiet parent with active children is NOT a false stall. On the reference opencode 1.19.3 schema messages live in `message` and parts in `part`; `session_message` is a legacy table that is empty on the reference store and is not the current source. The delivered `scripts/pm-liveness.sh` currently queries `session_message`, so on the reference store its session-tree signal observes no traffic and liveness is carried by the git/worktree signal until the script is reconciled; that script change is an owner follow-up outside this feature change. A session with no tree traffic for ≥ `DELIVER_STUCK_MINUTES` (default **10**) AND no git/worktree activity is declared stalled and killed-and-resumed. Git commits and worktree file mtimes are an always-on **secondary signal**: if EITHER signal shows recent activity, the session is healthy. The earlier 30-minute, file-mtime heuristic is retired.
- **Mode B merge gate — rebase-before-merge + green-gate wait (F-5):** for a human-approved PR, `batch-deliver.sh` rebases onto the latest `main`, pushes, waits for the PR quality gates to go green, and squash-merges using the **PR title and description as the commit message**. Rebase conflicts are resolved by an AI agent, after which the gates re-run.
- **CEO stuck detection + session resume + durable stop (F-6):** both Mode A outer
  supervisors detect a *genuinely stuck* CEO (no session traffic **and** no
  healthy delivery in progress) and restart it; a blocked-but-healthy CEO is
  never killed. The shell path uses a **race-free delivering marker file**
  (written by `deliver-ticket.sh` on its OWN path, before the delivery starts) and
  the `--is-delivering` PID probe; the typed `jaiship loop` path reads the
  delivered `dispatch.lane` and `daemon.lane` records read-only as its
  corroborator and never runs a shell probe. The shell path resumes the previous
  CEO session when its context is under `CEO_RESUME_TOKEN_LIMIT` (default 100000
  tokens); the typed path has no total-context source and starts a fresh session.
  The stop/park signal is durable across loop restarts in both paths: a workspace
  file under the shell, and the identity-scoped `loop.stop` ledger record under
  the typed loop (only an explicit `loop reset` clears it).
- **Branch hygiene (F-7, `tools/clean-merged-branches`):** deletes only branches already squash-merged into the base (verified by ancestry); never deletes unmerged or protected branches.
- **Optional pre-iteration hook (F-8):** both wrapper OWN paths execute an
  opt-in, user-owned executable immediately before every actual OpenCode
  spawn/resume, including watchdog retries. A missing resolved path is a silent
  no-op; JOIN, probe, control-command, and dry-run paths never invoke it or
  create/apply hook-return data. A
  present hook can wait, then exit `0`, to defer a spawn. Hook failures introduce
  no result value: `deliver-ticket.sh` takes its existing `failed`/exit-1 path
  without spawning a PM, while `ceo-loop.sh` uses a separate bounded failure
  counter without spending the stuck-restart budget. The hook return file is
  strictly validated `ADOS_HOOK_ENV_V1` data, never shell code: authorized
  literal set/unset records apply atomically only to the applying wrapper parent
  and its later children. This does not promise any provider/model binding or
  selected model. Canonical activation, lifecycle, protocol, security, and
  setting details are in [delivery-modes.md](../../guides/delivery-modes.md#optional-pre-iteration-hooks).
- **Owner hold outranks provider windows (F-8.1):** the second shipped example
  (`scripts/hooks/pre-opencode-iteration-owner-hold.sh`) keeps deferring every
  spawn/resume for as long as an owner hold exists. The hold has two equivalent
  sources — the brand-derived `DELIVERY_OS_OWNER_HOLD` value (the current
  default brand's name for `<PREFIX>_OWNER_HOLD`) and the host-wide marker at the
  host root (the example reads the fixed default
  `$HOME/.delivery-os-state/owner-hold`) — with environment precedence, a
  fail-closed unreadable marker, a bounded sanitized reason, and the example's
  two settings:
  `DELIVERY_OS_OWNER_HOLD` and `DELIVERY_OS_OWNER_HOLD_POLL_SECONDS` (default
  `300`, accepted `1`–`3600`, no fixed iteration cap). The typed engine and the
  shell example read the same host-wide marker: the engine reads
  `<host root>/owner-hold`, the example reads the fixed default path there, and
  the environment source is the relocation-safe way to hold a host that sets the
  override. There is no marker-path override, existing state is never migrated,
  and the hold never narrows to one project. The typed engine enforces the same fact:
  a held pass emits no next action, `owner-hold` is the first blocking reason
  (`lanes` shows it for gated entries that are not active or stuck parks, which
  keep their park reason), claim (with or without a ref, before selection) and
  dispatch refuse `queue.precondition.unmet` at exit `1`, and the mutating
  park-recovery pass is skipped so a parked lane does not resume at its provider
  window. `status`
  carries the additive evidence-level `providers.evidence.ownerHold` member in
  its digest, and `queue list`, `queue plan`, `lanes`, and `queue watch` report
  the hold on their own production surfaces.
  `doctor`, when
  a `DoctorComposition` is supplied (the command-runtime/test-harness layer; the
  production composer supplies none today), keeps the provider check `ok` with
  the `owner-hold` annotation reason and an appended bounded detail. There is
  **no** new park cause, state record
  kind, seventh queue-ready condition, tenth status section, status reason,
  doctor verdict, doctor summary count, or doctor condition; `queue ready` is
  unchanged and does not report the hold; a mid-flight session is not killed.
- **Platform-aware verification (F-9, GH-148):** `deliver-ticket.sh` and
  `batch-deliver.sh` auto-detect the tracker platform (GitHub or GitLab) once at
  startup — resolution order: `ADOS_PLATFORM` env var, then the `origin` git
  remote URL, then `glab auth status`, defaulting to GitHub. After detection,
  only the matching CLI (`gh` or `glab`) is required (F-2: a GitLab-only machine
  is no longer hard-blocked on `gh`). Issue and PR/MR operations route through a
  single dispatch seam (`_tracker` / `_mr`); a JSON normalization shim presents
  a common schema regardless of the divergent `gh --json` vs `glab --output json`
  field shapes, so `classify_result` and `pr_url_for` are platform-agnostic. When
  the branch-scoped MR lookup is empty, both fall back to a bounded ticket-ref
  lookup that accepts an MR only when the ticket ref appears in its title or its
  source/head branch (`source_branch`/`headRefName`) **as an exact token** (a
  maximal `[A-Za-z0-9-]` run bounded by a non-token character or a string
  boundary), so a prefix ref (`PDEV-5`) never matches a longer ref (`PDEV-514`) —
  an MR matched only on incidental full-text body is never returned or used to
  classify `pr-open`. On
  GitLab this makes deliveries report accurate `pr-open`/`merged`/`blocked`
  results with a populated MR web URL, and eliminates the false "Could not fetch
  issue state" warnings that misdiagnosed "wrong platform CLI" as a
  network/rate-limit problem. `build_delivery_prompt` is platform-neutral (no
  literal `gh` commands) so the PM prompt no longer contradicts a GitLab project
  config. `batch-deliver.sh` Mode B supports GitLab end-to-end (list / CI-gate
  via pipelines / merge), including GitLab merge-status polling with
  stale-conflict no-op-push recovery. The blocked label
  (`ADOS_BLOCKED_LABEL`) and merge strategy (`ADOS_MERGE_STRATEGY`) are
  configurable, preserving the GitHub defaults. `ceo-loop.sh` is **not modified**
  (OQ-3): it does not call the tracker today; it delegates delivery to
  `deliver-ticket.sh` and merges to the `@ceo` agent. All existing GitHub
  behavior is unchanged when the platform is GitHub; the `result`-value domain,
  liveness, single-flight + JOIN, branch resolution, resume, and hook machinery
  are untouched.
- **Resume-sync commit subject (F-10, `deliver-ticket.sh`):** When the
  delivered branch already carries commits, the prompt's resume-sync step
  instructs a sync merge with the delivery base whose subject is a conventional
  header referencing the work item (`chore(<ref>): sync with <base>`), so the
  sync never leaves a plain `Merge remote-tracking branch ...` subject in the
  change's range. Merge authority (F-3) is unchanged: `deliver-ticket.sh` still
  does not merge to the base branch, and conflict handling and the post-merge
  gate re-run behave as before.

### Behavioral invariants (INV-DM-1..6)

These are the non-negotiable contract the tooling enforces. Full rationale and edge cases: [delivery-modes.md § Behavioral invariants](../../guides/delivery-modes.md#behavioral-invariants).

| ID | Invariant |
|----|-----------|
| **INV-DM-1** | `deliver-ticket.sh` runs **foreground, never detached** — a caller blocks until merged/blocked/pr-open/pr-open-unverified/failed/finished/max-restarts/state-unverified/partial/noop-lane-permission/noop-lane-nothing-to-do. The CEO must never `setsid … & disown` it. |
| **INV-DM-2** | `deliver-ticket.sh` is **single-flight + join, per repo working tree** — a live instance for the same ticket is *joined* (wait + classify), never raced with a duplicate PM. SIGTERM/SIGINT is propagated to the PM child (grace period → SIGKILL). |
| **INV-DM-3** | A Mode A outer supervisor detects a **stuck** CEO (no session traffic **and** no healthy delivery in progress) — not a healthy wait. The shell path checks both the `--is-delivering` PID probe **and** the race-free delivering marker file; the typed `jaiship loop` path decides the same two-signal definition from sourced session progress and the delivered `dispatch.lane` / `daemon.lane` corroborator, with an owner-liveness test on the recorded process id only. Its primary job is stuck-CEO recovery; "parking while a delivery is in progress" is the CEO blocking on `deliver-ticket.sh`, not the loop's job. |
| **INV-DM-4** | In Mode A the **`@ceo` is the merge authority** — it verifies the PR is approved **and** the PM has finalized all 11 phases (`chg-<ref>-pm-notes.yaml`) before running `merge <ref>`. `merge` is the lifecycle merge path; the CEO does not use a platform merge command as the primary path. "Merge-not-yield": a ready, approved, finalized PR is merged, not deferred indefinitely. `deliver-ticket.sh` and `ceo-loop.sh` remain retained and executable: the typed engine is the regular delivery path, and for a repository in `dual-run` the scripts stay the documented fallback (`deliver-ticket.sh` the per-ticket script and `ceo-loop.sh` the outer process supervisor); after a per-repository handover they print a deprecation pointer naming `dispatch` and remain executable as fallback. |
| **INV-DM-5** | **Liveness = multi-signal progress, not process-alive.** The session-tree signal (recursive message traffic across the parent + child sessions, read from the current `message`/`part` store on opencode 1.19.3; `session_message` is legacy and empty) is combined with a git/worktree-activity signal; if EITHER shows recent activity the session is healthy. A hung LLM stream (process alive, both signals silent) is *stalled*, not slow. |
| **INV-DM-6** | **One ticket in flight per repo working tree.** Parallel deliveries in different repos / independent clones are allowed (tracking is keyed on the working tree). |

### User Flows

```
Mode A (autonomous):   jaiship loop start --foreground      (or: scripts/ceo-loop.sh)
                         └─ @ceo (per session) ──► deliver-ticket.sh REF (block)
                                                      └─ PM opencode (11 phases)
                         └─ @ceo merges approved + finalized PRs (INV-DM-4)

Mode B (manual batch): scripts/batch-deliver.sh GH-A GH-B GH-C
                         └─ per ticket: deliver-ticket.sh REF (block) → pr-open
                         └─ human: gh issue edit GH-A --add-label approved
                         └─ re-run: batch rebases approved PRs + green-gate + squash-merge

Subcommands:           deliver-ticket.sh --is-delivering [REF]
                       deliver-ticket.sh --last-message REF
                       deliver-ticket.sh REF --resume-prompt "<resolution>"
```

### Edge Cases & Error Handling

- **CEO bash-tool timeout cuts a blocking `deliver-ticket.sh` call:** the PM child keeps running; the next `deliver-ticket.sh REF` call **joins** it (INV-DM-2). No work is lost.
- **PM LLM stream hangs:** the liveness watchdog (INV-DM-5) sees no session traffic for ≥ threshold → kill-and-resume the PM; the session resumes from committed artifacts + pm-notes.
- **Agent hits a forbidden-folder permission prompt:** same detection — no session traffic → stuck → kill+restart (autonomous mode must not block on an unseen prompt).
- **opencode internally detaches its own grandchildren:** the signal trap kills the child's process group; grandchildren opencode itself `setsid`-detached (LLM transport, bash-tool subprocesses) can escape the group kill. Accepted known limitation; a defense-in-depth sweep by session id can be added if orphans are observed.
- **Tracker API rate-limit / network error during classification:** `classify_result` returns `state-unverified` (only after the artifact ladder finds no evidence); the iteration does not burn a restart slot. (Platform-aware since GH-148: on a healthy GitLab project this no longer misfires as a rate-limit — the dispatch seam uses the correct CLI.)
- **Rebase conflict during Mode B merge:** an AI agent resolves conflicts, pushes, and the quality gates re-run before the squash-merge.

## Technical Architecture & Codebase Map

### High-Level Design

The guiding principle is the **AI-vs-script split**: the expensive, stateless, judgment-heavy work is AI (pick ticket, review, decide, merge-with-judgement, retrospectives); the cheap, long-running, deterministic work is script (liveness polling, single-flight PID tracking, rebase + green-gate wait, branch hygiene). The loop must never put the expensive thing in charge of babysitting the cheap thing.

### Core Components

| Path | Kind | Responsibility |
|------|------|----------------|
| `scripts/ceo-loop.sh` | Script (outer, Mode A fallback) | Spawn one `@ceo` session at a time; invoke the optional hook before every spawn/resume; detect stuck CEO; resume previous session under token limit; honor durable stop signal. **Not platform-aware** (OQ-3): delegates delivery to `deliver-ticket.sh` and merges to the `@ceo` agent, so needs no tracker access itself. Retained and executable as the documented fallback; it is not edited by the typed loop |
| `jaiship loop` (`packages/core/src/app/loop-supervisor.ts`, `packages/cli/src/commands/loop.ts`) | Typed command (outer, Mode A) | The typed Mode A operator surface: `start --foreground [--fresh-budget]`, `stop [--mode drain\|immediate]`, `status`, `log [--lines n]`, `reset`. Composes the delivered supervision engine under the identity `loop-main`, spawns the CEO through the harness port (`--agent ceo`, resolved seat model, `ceo-loop-<stamp>` title), decides the two-signal stuck verdict from sourced progress plus the lane corroborator, terminates through the delivered harness `terminate`, records a durable `loop.stop` and a bounded operational log, and reads the six `coordinator.*` keys. It runs no shell probe and invokes no script ([Loop Supervision](feature-loop-supervision.md)) |
| `scripts/deliver-ticket.sh` | Script (per-ticket engine) | Single-flight + join; invoke the optional hook before every PM iteration; spawn/resume PM; log-progress liveness watchdog; kill-and-restart on stall; signal propagation; **platform-aware result classification & PR URL resolution** (F-9); emits a conventional-subject resume-sync merge instruction (F-10); writes the delivering marker on its OWN path; `--is-delivering` / `--last-message` / `--resume-prompt` subcommands; **does not merge** |
| `scripts/lib/dispatch-authority.sh` | Sourced shell library | Reads the derived per-repository dispatch authority document (`dispatch-authority.json`) as a plain file with shell built-ins; absent or malformed means `dual-run`, so a missing typed installation never breaks the fallback. Sourced at startup by `deliver-ticket.sh`, `batch-deliver.sh`, `pm-liveness.sh`, and `ceo-loop.sh` |
| `scripts/lint-commit-range.sh` | Script (pre-PR gate) | Lint the change branch's own merge-base range against the root commitlint configuration; per-commit diagnostics (short and full SHA, rule id, line, bounded excerpt) and a remediation mode; verdicts `PASS` / `FAIL` / `SKIP` / `ERROR`; read-only and offline |
| `scripts/batch-deliver.sh` | Script (Mode B) | Sequential per-ticket delivery; pre-flight skip; rebase-before-merge + green-gate wait for human-approved PRs; **platform-aware Mode B merge** through `.ai/agent/pr-instructions.md` (platform selection with merge-status polling) using the PR title/description as commit message |
| `scripts/pm-liveness.sh` | Script | Probe opencode session-message traffic across the recursive session tree (the current `message`/`part` store on opencode 1.19.3; `session_message` is legacy and empty); combine with git/worktree activity; degrade gracefully to the git/worktree signal if the session DB is unavailable. The delivered script still queries the legacy `session_message` table, so its session-tree signal is empty on the reference store until the script is reconciled; that is an owner follow-up. |
| `scripts/opencode-session.sh` | Script | Ticket-scoped opencode session manager (entry point for autonomous sessions; sets `delivery_mode: autonomous`) |
| `scripts/hooks/pre-opencode-iteration-zai.sh` | Installed inactive example | A generic sleep driver with pluggable condition functions, gated on a `zai-coding-plan/` CEO/PM model. v1 ships two conditions: `howLongToSleepDueToPeakHours` (pure-bash; waits out the 06:00–10:00 UTC peak + buffer) and `howLongToSleepDueToQuotaExhaustion` (opt-in via `ZAI_API_KEY` + `jq` + `curl`; pauses when a Z.AI Coding Plan `TOKENS_LIMIT` window reaches 100%, sleeping until the soonest `nextResetTime`; fails open with one WARN on any error). The driver takes the MAX across conditions and re-evaluates in a loop (capped by `ADOS_ZAI_MAX_SLEEP_LOOPS`, default 24); the condition-function pattern lets other providers build their own hook. Set `ADOS_ZAI_QUOTA_DISABLED=1` to opt out even with a key. Detail: [zai-peak-hours-hook.md](../../guides/zai-peak-hours-hook.md) |
| `scripts/hooks/pre-opencode-iteration-owner-hold.sh` | Installed inactive example | Provider- and model-independent sleep driver whose only default condition, `howLongToSleepDueToOwnerHold`, sleeps while the owner hold is active. It recognises `DELIVERY_OS_OWNER_HOLD` and `DELIVERY_OS_OWNER_HOLD_POLL_SECONDS` (the current default brand's names; default `300`, accepted `1`–`3600`), reads the host-wide owner-hold marker at the fixed default host-root path `$HOME/.delivery-os-state/owner-hold`, takes the MAX across conditions, and applies no fixed iteration cap: the hold is the floor. Detail: [delivery-modes.md](../../guides/delivery-modes.md#owner-hold-versus-provider-window-deferral) |
| `tools/clean-merged-branches` | Tool (script) | Branch hygiene — delete squash-merged branches only |
| `.opencode/agent/ceo.md` | AI agent | Pick next ticket; merge approved + finalized PRs (INV-DM-4); handle blockers; retrospectives |
| `.ai/local/delivery/<REF>.pid` | Repo-local state | Single-flight PID tracking (git-ignored; keyed on the working tree) |

> **Install inventory.** `scripts/install.sh` declares the authoritative install
> set; the lists here mirror it. `ADOS_DELIVERY_SCRIPTS` holds
> `scripts/opencode-session.sh`, `scripts/deliver-ticket.sh`,
> `scripts/lib/dispatch-authority.sh`, `scripts/batch-deliver.sh`,
> `scripts/ceo-loop.sh`, `scripts/pm-liveness.sh`, and
> `scripts/lint-commit-range.sh`; `ADOS_DELIVERY_TOOLS` holds
> `tools/clean-merged-branches`; and `ADOS_HOOK_EXAMPLES` holds the inactive Z.AI
> and owner-hold examples. A local install copies both examples to
> `scripts/hooks/` but does not activate either.
> Local uninstall removes those files and any empty `scripts/hooks/`
> directory.

### Data Architecture

- **In-progress tracking** lives in repo-local, git-ignored files under `.ai/local/delivery/<REF>.pid` and `.ai/local/opencode-sessions/<REF>.json`. A single `.ai/local/delivery/delivering` marker file (INV-DM-3) is written by `deliver-ticket.sh` on its OWN path and read by `ceo-loop.sh` as a race-free "CEO blocked on a delivery" signal. Callers never inspect these directly — they go through the `--is-delivering` / `--last-message` subcommands. Tracking is keyed on the working tree, so independent clones never see each other's deliveries (INV-DM-6). The typed `jaiship loop` path adds no file: its durable session identity, its durable stop, and its restart accounting are state-ledger records under the loop identity, and its delivery corroborator is the delivered dispatch/daemon lane records.

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Convergence | At most one `@ceo` session and one PM per ticket per repo working tree are alive at a time | Enforced by INV-DM-2/6 |
| NFR-2 | Liveness precision | Liveness is measured by opencode session-message traffic (recursive session tree) + git/worktree activity, not process-alive | Stalled stream killed within `DELIVER_STUCK_MINUTES` (default 10) |
| NFR-3 | Merge safety | `deliver-ticket.sh` never merges; merge requires an approval signal + (Mode A) PM finalization or (Mode B) rebase + green-gate | Zero auto-merges from the per-ticket engine |
| NFR-4 | No orphans | All delivery scripts propagate SIGTERM/SIGINT → SIGKILL to their AI children | No orphaned opencode instance after a kill |
| NFR-5 | Durable control | The Mode A stop signal survives a loop restart and is not wiped at startup: the shell loop's workspace marker, and the typed loop's identity-scoped `loop.stop` ledger record, which only an explicit `loop reset` clears | Stop honored until explicitly cleared |
| NFR-6 | Commit-range hygiene | Every commit in a delivered change's range satisfies the root commitlint configuration before PR creation, and a delivery-branch sync carries a conventional subject rather than a plain merge subject | 0 commit-message CI failures per change; pre-PR verdict `PASS` or recorded `SKIP` |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| Manual | Mode A walk-through | Start `ceo-loop.sh`, kill a stuck CEO, verify single-flight + resume; verify merge-not-yield on an approved finalized PR. The typed loop counterpart is the offline parity battery: `jaiship loop` parity, durable stop, single instance, and a stuck-session restart are proven under `tests/conformance/loop/` |
| Manual | Mode A typed-stop walk-through | `jaiship loop start --foreground`; `jaiship loop stop --mode drain`; restart the process and confirm the next start exits 0 with `state=stopped`; `jaiship loop reset` and confirm it runs |
| Manual | Mode B walk-through | Deliver a batch, approve via label, re-run, verify rebase + green-gate + squash-merge |
| Grep | No-merge contract | `deliver-ticket.sh` must not contain a merge code path; guides/spec must state "does not merge" |
| Grep | Liveness wording | Docs must describe multi-signal liveness (recursive session-tree traffic from the current `message`/`part` store + git/worktree) with the 10-minute default, and must not name `session_message` as the current message store; the retired 30-minute/file-mtime heuristic is absent |
| CI guard | Result-tuple doc guard | `scripts/.tests/test-deliver-ticket-result-tuples.sh` derives the canonical `result=<…>` set from `deliver-ticket.sh` and fails when a scanned current-truth enumeration omits a value; `scripts/.tests/test-deliver-ticket-result-tuples-modes.sh` injects each failure mode on a synthetic tree |
| Grep + suite | Resume-sync commit subject | `scripts/.tests/test-deliver-ticket.sh` asserts that the generated prompt's resume-sync instruction carries a conventional subject referencing the work item; the emitted prompt must contain no plain `Merge remote-tracking branch ...` instruction |
| Automated | Pre-PR range lint | `bash scripts/.tests/test-lint-commit-range.sh` — the gate the `quality_gates` phase runs over the change branch's range before PR creation |
| CI guard | Mutation sandbox | `scripts/.tests/test-delivery-mutation-sandbox.sh` breaks the result emission in a temp copy and asserts the harness fails on `TC-DT-SF-12` while the unmutated copy passes and no tracked file changes |

## Operational & Support

### Configuration

All settings are environment variables (CLI flag overrides where noted). Full tables are in [delivery-modes.md § Configuration](../../guides/delivery-modes.md#configuration). Key ones:

| Variable | Default | Description |
|----------|---------|-------------|
| `DELIVER_STUCK_MINUTES` | `10` | Minutes with no PM session traffic AND no git/worktree activity before restart (INV-DM-5) |
| `DELIVER_POLL_SECONDS` | `60` | Seconds between liveness checks |
| `DELIVER_MAX_RESTARTS` | `10` | Max PM restart iterations |
| `DELIVER_ALLOW_LGTM_COMMENT` | `false` | Opt-in: exact `lgtm` comment by PR author as a merge signal (Mode B) |
| `CEO_LOOP_STUCK_MINUTES` | `10` | Minutes of no session traffic **and** no healthy delivery (marker + PID probe) before a CEO is killed (INV-DM-3/5) |
| `CEO_LOOP_POLL_SECONDS` | `30` | Seconds between CEO stuck checks |
| `CEO_RESUME_TOKEN_LIMIT` | `100000` | Resume the previous CEO session if its context is under this limit |
| `CEO_LOOP_MAX_RESTARTS` | `10` | Max CEO kill+restart iterations |
| `ADOS_PRE_ITERATION_HOOK` | `~/.ados/hooks/pre-opencode-iteration` | Optional executable hook path for both wrappers |
| `ADOS_HOOK_SHUTDOWN_GRACE_SECONDS` | `2` | Hook-group SIGTERM-to-SIGKILL teardown grace for both wrappers |
| `ADOS_HOOK_ENV_ALLOWLIST` | empty | Comma-separated additional exact variable names authorized for hook return data; credential delegation is operator risk |
| `ADOS_HOOK_RETRY_SECONDS` | `60` | CEO-only total wait between failed-hook attempts; the stop file is checked in chunks no longer than one second |
| `ADOS_HOOK_MAX_FAILURES` | `5` | CEO-only consecutive hook-failure cap, separate from stuck-restart limits |
| `DELIVERY_OS_OWNER_HOLD` | *(unset)* | Owner-hold environment source (the current default brand's name for the brand-derived `<PREFIX>_OWNER_HOLD`); a non-empty value is the operator reason and activates the hold. The host-wide marker at the host root (`<host root>/owner-hold`, default `$HOME/.delivery-os-state/owner-hold`) is the durable alternative; the environment source wins when both are active |
| `DELIVERY_OS_OWNER_HOLD_POLL_SECONDS` | `300` | Owner-hold example poll interval in seconds, accepted `1`–`3600`; an unset, empty, or whitespace-only value defaults silently and any other invalid value uses `300` with one warning |
| `ADOS_PLATFORM` | *(auto-detect)* | Platform override for `deliver-ticket.sh` / `batch-deliver.sh`: `github` \| `gitlab`. Empty = auto-detect via `ADOS_PLATFORM` env → git remote → `glab auth` → default `github` (F-9, GH-148) |
| `ADOS_BLOCKED_LABEL` | `human-input-needed` | Label that `classify_result` treats as `blocked`, on either platform (F-9) |
| `ADOS_MERGE_STRATEGY` | `squash` | `batch-deliver.sh` Mode B merge strategy: `squash` \| `merge` \| `rebase` — mapped to platform-appropriate flags (F-9) |

`CEO_LOOP_STALL_MINUTES` (default `10`) is the `pm-liveness.sh` probe threshold, not the loop knob; both wrappers export it aligned to their own stuck threshold when invoking the probe.

The table above configures the shell path. The typed `jaiship loop` reads no
environment knob at all: the six shell knobs map onto the delivered
`coordinator.*` configuration keys — `CEO_LOOP_STUCK_MINUTES` →
`coordinator.stuck-window` (600 000 ms), `CEO_LOOP_POLL_SECONDS` →
`coordinator.collection-interval` (30 000 ms), `CEO_LOOP_KILL_GRACE_SECONDS` →
`coordinator.kill-grace` (20 000 ms), `CEO_LOOP_MAX_RESTARTS` →
`coordinator.restart-budget` (10), and `CEO_RESUME_TOKEN_LIMIT` →
`coordinator.resume-context-limit` (100 000) — while `CEO_LOOP_SLEEP_SECONDS` is
replaced by the declared backoff schedule plus the collection interval,
`MAX_ITERATIONS=0` is replaced by the unbounded loop, and
`coordinator.progress-bound` (300 000 ms) has no shell counterpart. No key is
added for the typed loop ([Loop Supervision](feature-loop-supervision.md)).

## Dependencies & Risks

- **Depends on:** the 11-phase delivery lifecycle ([feature-delivery-lifecycle.md](feature-delivery-lifecycle.md)); the documented, stable opencode CLI (`opencode session list`, `opencode run --session`, `opencode db` for token totals).
- **Depends on:** `@pr-manager` producing PR descriptions fit to become the squash commit message (Mode B uses the PR title + description verbatim as the commit message).
- **Risk:** Liveness threshold too low for a legitimately long reasoning step → a healthy session is killed and restarted. Mitigated by the configurable threshold and the secondary worktree-activity signal.
- **Risk:** opencode-detached grandchildren escape the signal trap. Accepted and documented limitation.
- **Risk:** a user-owned hook can block a new session indefinitely. Hooks have no
  execution timeout by design; on normal exit or direct HUP/INT/TERM, the wrapper
  terminates only the tracked hook process group, then escalates after the hook
  shutdown grace. Wrapper-only SIGKILL, host failure, and escaped descendants are
  outside that guarantee.

## Related Documentation

- **Canonical modes guide:** [doc/guides/delivery-modes.md](../../guides/delivery-modes.md) — modes table, component responsibilities, the AI-vs-script split, INV-DM-1..6, recovery semantics, configuration, troubleshooting.
- **Typed Mode A surface:** [Loop Supervision](feature-loop-supervision.md) — the `jaiship loop` family, the engine-reuse boundary, the two-signal verdict and corroborator, the durable stop, and the proof boundary.
- **Planned-scope precondition:** [doc/guides/milestone-management.md](../../guides/milestone-management.md) — the milestone-first operating rule an unattended run assumes.
- **Mode B operations guide:** [doc/guides/autonomous-batch-delivery.md](../../guides/autonomous-batch-delivery.md) — `batch-deliver.sh` / `deliver-ticket.sh` usage, approval workflow, labels.
- **CEO agent prompt:** `.opencode/agent/ceo.md` — autonomous delivery model (merge-not-yield, wait-for-delivery).
- **System bootstrap:** [AGENTS.md](../../../AGENTS.md) — the delivery scripts are referenced under "Using the system".
- **Sibling spec (lifecycle context):** [feature-delivery-lifecycle.md](feature-delivery-lifecycle.md) — the 11-phase lifecycle both modes wrap; phase 7 (`system_spec_update`) is where this spec was first-authored.
- **Sibling spec (verification/release):** [feature-quality-gates-and-pr.md](feature-quality-gates-and-pr.md) — the quality gates and PR workflow that Mode B waits on before merging.
- **Sibling spec (session-database admin):** [feature-session-database-admin.md](feature-session-database-admin.md) — the typed `ados db` surface over the same session store.
- **Hook decision:** [TDR-0002](../../decisions/TDR-0002-pre-iteration-hook-contract-details.md) — lifecycle, failure, distribution, and environment-return contract.
- **Z.AI hook guide:** [doc/guides/zai-peak-hours-hook.md](../../guides/zai-peak-hours-hook.md) — peak-hours + quota-aware behavior, condition-function extensibility, and configuration of the inactive example hook.
- **Enduring test specification:** [test-spec-autonomous-delivery.md](../../quality/test-specs/test-spec-autonomous-delivery.md) — automated coverage of loop and hook behavior; the typed loop's own coverage map is [test-spec-loop-supervision.md](../../quality/test-specs/test-spec-loop-supervision.md).
