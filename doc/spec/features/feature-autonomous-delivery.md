---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-autonomous-delivery.md
ados_distribution: internal
id: SPEC-AUTONOMOUS-DELIVERY
status: Current
created: 2026-07-07
last_updated: 2026-07-07
owners: ["engineering"]
service: delivery-os
summary: "The unattended delivery neighborhood of the lifecycle: the two autonomous modes (Mode A — autonomous CEO loop; Mode B — manual batch), the bash delivery scripts (ceo-loop.sh, deliver-ticket.sh, batch-deliver.sh, pm-liveness.sh, opencode-session.sh), the AI-vs-script split, and the behavioral invariants (INV-DM-1..6) that keep unattended delivery converging instead of burning tokens. deliver-ticket.sh no longer merges; liveness is session-message-traffic based."
links:
  related_changes: ["GH-142", "GH-108"]
  guides:
    - "doc/guides/delivery-modes.md"
    - "doc/guides/autonomous-batch-delivery.md"
---

# Feature: Autonomous Delivery

## Overview

Autonomous Delivery is the unattended neighborhood of the delivery lifecycle: it runs the same 11-phase ADOS lifecycle ([feature-delivery-lifecycle.md](feature-delivery-lifecycle.md)) **without a human at the keyboard**, overnight or across a batch of tickets. It is delivered as a set of long-running, deterministic **bash scripts** (`ceo-loop.sh`, `deliver-ticket.sh`, `batch-deliver.sh`, `pm-liveness.sh`, `opencode-session.sh`, `tools/clean-merged-branches`) that wrap the AI agents (the `@ceo` and the PM opencode session) with liveness monitoring, session resilience, single-flight coordination, branch hygiene, and — in Mode B — a human approval gate before merge.

> **Canonical detail lives in the guide.** The full modes table, component-responsibility matrix, mermaid diagrams, recovery semantics, configuration, and troubleshooting are in [doc/guides/delivery-modes.md](../../guides/delivery-modes.md) (the canonical modes guide) and [doc/guides/autonomous-batch-delivery.md](../../guides/autonomous-batch-delivery.md) (canonical for Mode B operations). This spec names the capabilities, invariants, and the merge/liveness contracts; it does not restate the guide tables. Where the two describe the same machinery, they are kept consistent.

## Business Context

### Problem Statement

- **Problem:** Sustained autonomous delivery of an AI agent loop either burns tokens babysitting cheap scripts or orphans work when an agent session dies. Without a deterministic, script-owned substrate, unattended delivery is unsafe.
- **Affected Users:** Solo engineers and small teams who want to wake up to PRs; the AI agent team that must converge instead of churning.
- **Business Impact:** A loop that respawns an expensive AI session on every exit to reconcile a detached cheap script can burn ~20 agent sessions on a single ticket. The fix is structural: the expensive AI never babysits the cheap script.

### Goals & Success Metrics

- **Primary Goal:** Unattended delivery that **converges** — exactly one in-flight delivery per repo working tree, no orphaned sessions, no racing agents, no infinite token burn on a stuck stream.
- **KPIs:** One CEO session alive at a time (Mode A); one PM per ticket at a time; a stuck LLM stream is killed within the stall threshold (default 15 min); `deliver-ticket.sh` never merges (merge authority is `@ceo` in Mode A, `batch-deliver.sh` in Mode B).

## User Experience & Functionality

### Capabilities

- **Two unattended modes (F-1):**
  - **Mode A — Autonomous CEO loop (`ceo-loop.sh`):** a long-running outer script spawns one `@ceo` agent session at a time; the `@ceo` picks the next ticket, calls `deliver-ticket.sh` (foreground, blocking), reads the delivery summary, merges approved + PM-finalized PRs, handles blockers, and loops. The human is uninvolved until they stop the loop.
  - **Mode B — Manual batch (`batch-deliver.sh`):** the human provides an explicit ticket list; the batch script delivers each sequentially. The **human** is the merge authority — they approve via the `approved` label; `batch-deliver.sh` then rebases, waits for green quality gates, and squash-merges.
  - (Manual and Autopilot are the interactive run modes of the same lifecycle and are out of scope for this spec; see [change-lifecycle.md](../../guides/change-lifecycle.md).)
- **Per-ticket engine (F-2, `deliver-ticket.sh`):** the foreground, blocking, single-flight lifecycle runner. It spawns/resumes the PM opencode session, monitors liveness, kill-and-restarts on stall, classifies the result, and returns a delivery summary. It exposes scriptable subcommands so the AI does not burn tokens rediscovering scriptable facts: `--is-delivering [REF]`, `--last-message REF`, and `REF --resume-prompt "<text>"`.
- **No-merge contract (F-3):** `deliver-ticket.sh` **does not merge**. It returns `pr-open` (+ PR URL + PM last-message). The legacy auto-merge-on-`approved`-label path inside the PM is retired. Merge authority is the `@ceo` (Mode A, after PM-finalization verification) or `batch-deliver.sh` (Mode B, after human approval + rebase + green-gate).
- **Session-traffic liveness (F-4, `pm-liveness.sh`):** "liveness" is measured by **opencode session-message traffic** (new assistant/tool messages), not by process-alive. A session with no new message traffic for > `DELIVER_STUCK_MINUTES` (default **15**) is declared stalled and killed-and-resumed. The earlier 30-minute, file-mtime heuristic is retired (worktree activity remains a secondary signal).
- **Mode B merge gate — rebase-before-merge + green-gate wait (F-5):** for a human-approved PR, `batch-deliver.sh` rebases onto the latest `main`, pushes, waits for the PR quality gates to go green, and squash-merges using the **PR title and description as the commit message**. Rebase conflicts are resolved by an AI agent, after which the gates re-run.
- **CEO stuck detection + session resume + durable stop (F-6, `ceo-loop.sh`):** the loop detects a *genuinely stuck* CEO (no session traffic **and** no healthy delivery in progress) and kills+restarts it; it resumes the previous CEO session when its context is under `CEO_RESUME_TOKEN_LIMIT` (default 100000 tokens); the stop/park signal is durable across loop restarts.
- **Branch hygiene (F-7, `tools/clean-merged-branches`):** deletes only branches already squash-merged into the base (verified by ancestry); never deletes unmerged or protected branches.

### Behavioral invariants (INV-DM-1..6)

These are the non-negotiable contract the tooling enforces. Full rationale and edge cases: [delivery-modes.md § Behavioral invariants](../../guides/delivery-modes.md#behavioral-invariants).

| ID | Invariant |
|----|-----------|
| **INV-DM-1** | `deliver-ticket.sh` runs **foreground, never detached** — a caller blocks until merged/blocked/pr-open/failed. The CEO must never `setsid … & disown` it. |
| **INV-DM-2** | `deliver-ticket.sh` is **single-flight + join, per repo working tree** — a live instance for the same ticket is *joined* (wait + classify), never raced with a duplicate PM. SIGTERM/SIGINT is propagated to the PM child (grace period → SIGKILL). |
| **INV-DM-3** | `ceo-loop.sh` detects a **stuck** CEO (no session traffic **and** no healthy delivery in progress) — not a healthy wait. Its primary job is stuck-CEO recovery; "parking while a delivery is in progress" is the CEO blocking on `deliver-ticket.sh`, not the loop's job. |
| **INV-DM-4** | In Mode A the **`@ceo` is the merge authority** — it verifies the PR is approved **and** the PM has finalized all 11 phases (`chg-<ref>-pm-notes.yaml`) before `gh pr merge --squash`. "Merge-not-yield": a ready, approved, finalized PR is merged, not deferred indefinitely. |
| **INV-DM-5** | **Liveness = session-message progress, not process-alive.** A hung LLM stream (process alive, stream silent) is *stalled*, not slow. |
| **INV-DM-6** | **One ticket in flight per repo working tree.** Parallel deliveries in different repos / independent clones are allowed (tracking is keyed on the working tree). |

### User Flows

```
Mode A (autonomous):   scripts/ceo-loop.sh
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
- **PM LLM stream hangs:** the liveness watchdog (INV-DM-5) sees no session traffic for > threshold → kill-and-resume the PM; the session resumes from committed artifacts + pm-notes.
- **Agent hits a forbidden-folder permission prompt:** same detection — no session traffic → stuck → kill+restart (autonomous mode must not block on an unseen prompt).
- **opencode internally detaches its own grandchildren:** the signal trap kills the child's process group; grandchildren opencode itself `setsid`-detached (LLM transport, bash-tool subprocesses) can escape the group kill. Accepted known limitation; a defense-in-depth sweep by session id can be added if orphans are observed.
- **GitHub API rate-limit during classification:** `classify_result` returns `unknown`; the iteration does not burn a restart slot.
- **Rebase conflict during Mode B merge:** an AI agent resolves conflicts, pushes, and the quality gates re-run before the squash-merge.

## Technical Architecture & Codebase Map

### High-Level Design

The guiding principle is the **AI-vs-script split**: the expensive, stateless, judgment-heavy work is AI (pick ticket, review, decide, merge-with-judgement, retrospectives); the cheap, long-running, deterministic work is script (liveness polling, single-flight PID tracking, rebase + green-gate wait, branch hygiene). The loop must never put the expensive thing in charge of babysitting the cheap thing.

### Core Components

| Path | Kind | Responsibility |
|------|------|----------------|
| `scripts/ceo-loop.sh` | Script (outer, Mode A) | Spawn one `@ceo` session at a time; detect stuck CEO; resume previous session under token limit; honor durable stop signal |
| `scripts/deliver-ticket.sh` | Script (per-ticket engine) | Single-flight + join; spawn/resume PM; log-progress liveness watchdog; kill-and-restart on stall; signal propagation; result classification; `--is-delivering` / `--last-message` / `--resume-prompt` subcommands; **does not merge** |
| `scripts/batch-deliver.sh` | Script (Mode B) | Sequential per-ticket delivery; pre-flight skip; rebase-before-merge + green-gate wait for human-approved PRs; squash-merge with PR title/description as commit message |
| `scripts/pm-liveness.sh` | Script | Probe opencode session-message traffic; degrade gracefully to process-alive if the session DB is unavailable |
| `scripts/opencode-session.sh` | Script | Ticket-scoped opencode session manager (entry point for autonomous sessions; sets `delivery_mode: autonomous`) |
| `tools/clean-merged-branches` | Tool (script) | Branch hygiene — delete squash-merged branches only |
| `.opencode/agent/ceo.md` | AI agent | Pick next ticket; merge approved + finalized PRs (INV-DM-4); handle blockers; retrospectives |
| `.ai/local/delivery/<REF>.pid` | Repo-local state | Single-flight PID tracking (git-ignored; keyed on the working tree) |

> **Install inventory.** Registered for install in `scripts/install.sh` (`ADOS_DELIVERY_SCRIPTS`): `opencode-session.sh`, `deliver-ticket.sh`, `batch-deliver.sh`; `ADOS_DELIVERY_TOOLS`: `clean-merged-branches`. (`ceo-loop.sh` and `pm-liveness.sh` are delivery scripts introduced by GH-142; see Gaps.)

### Data Architecture

- **In-progress tracking** lives in repo-local, git-ignored files under `.ai/local/delivery/<REF>.pid` and `.ai/local/opencode-sessions/<REF>.json`. Callers never inspect these directly — they go through the `--is-delivering` / `--last-message` subcommands. Tracking is keyed on the working tree, so independent clones never see each other's deliveries (INV-DM-6).

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Convergence | At most one `@ceo` session and one PM per ticket per repo working tree are alive at a time | Enforced by INV-DM-2/6 |
| NFR-2 | Liveness precision | Liveness is measured by opencode session-message traffic, not process-alive | Stalled stream killed within `DELIVER_STUCK_MINUTES` (default 15) |
| NFR-3 | Merge safety | `deliver-ticket.sh` never merges; merge requires an approval signal + (Mode A) PM finalization or (Mode B) rebase + green-gate | Zero auto-merges from the per-ticket engine |
| NFR-4 | No orphans | All delivery scripts propagate SIGTERM/SIGINT → SIGKILL to their AI children | No orphaned opencode instance after a kill |
| NFR-5 | Durable control | `ceo-loop.sh`'s stop/park signal survives a loop restart; it is not wiped at startup | Stop honored until explicitly cleared |

## Quality Assurance Strategy

### Testing Approach

| Level | Scope | Notes |
|-------|-------|-------|
| Manual | Mode A walk-through | Start `ceo-loop.sh`, kill a stuck CEO, verify single-flight + resume; verify merge-not-yield on an approved finalized PR |
| Manual | Mode B walk-through | Deliver a batch, approve via label, re-run, verify rebase + green-gate + squash-merge |
| Grep | No-merge contract | `deliver-ticket.sh` must not contain a merge code path; guides/spec must state "does not merge" |
| Grep | Liveness wording | Docs must describe session-message-traffic liveness with the 15-minute default, not the retired 30-minute/file-mtime heuristic |

## Operational & Support

### Configuration

All settings are environment variables (CLI flag overrides where noted). Full tables are in [delivery-modes.md § Configuration](../../guides/delivery-modes.md#configuration). Key ones:

| Variable | Default | Description |
|----------|---------|-------------|
| `DELIVER_STUCK_MINUTES` | `15` | Minutes with no PM session traffic before restart (INV-DM-5) |
| `DELIVER_POLL_SECONDS` | `60` | Seconds between liveness checks |
| `DELIVER_MAX_RESTARTS` | `10` | Max PM restart iterations |
| `DELIVER_ALLOW_LGTM_COMMENT` | `false` | Opt-in: exact `lgtm` comment by PR author as a merge signal (Mode B) |
| `CEO_LOOP_STALL_MINUTES` | `15` | Minutes of no session traffic **and** no healthy delivery before a CEO is killed (INV-DM-3/5) |
| `CEO_LOOP_POLL_SECONDS` | `30` | Seconds between CEO stuck checks |
| `CEO_RESUME_TOKEN_LIMIT` | `100000` | Resume the previous CEO session if its context is under this limit |
| `CEO_LOOP_MAX_RESTARTS` | `10` | Max CEO kill+restart iterations |

## Dependencies & Risks

- **Depends on:** the 11-phase delivery lifecycle ([feature-delivery-lifecycle.md](feature-delivery-lifecycle.md)); the documented, stable opencode CLI (`opencode session list`, `opencode run --session`, `opencode db` for token totals).
- **Depends on:** `@pr-manager` producing PR descriptions fit to become the squash commit message (Mode B uses the PR title + description verbatim as the commit message).
- **Risk:** Liveness threshold too low for a legitimately long reasoning step → a healthy session is killed and restarted. Mitigated by the configurable threshold and the secondary worktree-activity signal.
- **Risk:** opencode-detached grandchildren escape the signal trap. Accepted and documented limitation.

## Related Documentation

- **Canonical modes guide:** [doc/guides/delivery-modes.md](../../guides/delivery-modes.md) — modes table, component responsibilities, the AI-vs-script split, INV-DM-1..6, recovery semantics, configuration, troubleshooting.
- **Mode B operations guide:** [doc/guides/autonomous-batch-delivery.md](../../guides/autonomous-batch-delivery.md) — `batch-deliver.sh` / `deliver-ticket.sh` usage, approval workflow, labels.
- **CEO agent prompt:** `.opencode/agent/ceo.md` — autonomous delivery model (merge-not-yield, wait-for-delivery).
- **System bootstrap:** [AGENTS.md](../../../AGENTS.md) — the delivery scripts are referenced under "Using the system".
- **Sibling spec (lifecycle context):** [feature-delivery-lifecycle.md](feature-delivery-lifecycle.md) — the 11-phase lifecycle both modes wrap; phase 7 (`system_spec_update`) is where this spec was first-authored.
- **Sibling spec (verification/release):** [feature-quality-gates-and-pr.md](feature-quality-gates-and-pr.md) — the quality gates and PR workflow that Mode B waits on before merging.
