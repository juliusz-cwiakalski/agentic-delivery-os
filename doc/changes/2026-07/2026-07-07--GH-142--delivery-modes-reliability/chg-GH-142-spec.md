---
workItemRef: GH-142
title: "Delivery Modes guide + autonomous-loop reliability (absorbs #97/#99/#96)"
status: Accepted
created: 2026-07-07
guide: doc/guides/delivery-modes.md
---

# Spec — GH-142

> **The authoritative design is the guide.** `doc/guides/delivery-modes.md`
> (revised, commit `21185d3`) is the design spec for this change. This file
> maps the ticket's acceptance criteria to concrete deliverables, locks scope,
> and records the resolved decisions. Do not re-derive the design here — read
> the guide.

## Problem

Unattended ADOS delivery had an inverted architecture: a short-lived, expensive
AI step (the CEO opencode session) babysat a long-running, cheap, detached
script (`deliver-ticket.sh`), causing ~20 CEO sessions to burn tokens polling
one healthy delivery. The fixes designed in #97/#99/#96 had not been
implemented. Additionally the experimental CEO agent + loop runner (from a
dogfooding project) need to be productized into ADOS as a stable baseline for
#118.

## Goals

1. One canonical, user-facing **Delivery Modes guide** defining Mode A
   (autonomous CEO loop) and Mode B (manual batch), the AI-vs-script split, and
   the six behavioral invariants. (DONE — revised per the 15 PR-review
   comments in commit `21185d3`.)
2. Implement the reliability invariants and the two mode runners in one PR,
   following the guide as the spec.
3. Land the `@ceo` agent prompt and the `ceo-loop.sh` runner in-tree (the
   generic runner from #119 never landed; this ticket lands it).
4. Keep everything upstreamable: `.ai/rules/bash.md` compliance, tests, license
   headers, `.ados-claude/` regeneration.

## Scope

### In scope (code)

| Area | File(s) | Nature |
|---|---|---|
| Loop runner (Mode A outer process) | `scripts/ceo-loop.sh` | Rewrite the experimental seed into the canonical runner: spawn one `@ceo`; **detect a stuck CEO** (no session traffic AND no healthy delivery) and kill+restart; **session-resume optimization** (resume prev session if context < `CEO_RESUME_TOKEN_LIMIT`); durable stop signal; signal propagation. |
| Per-ticket engine | `scripts/deliver-ticket.sh` | **Single-flight + join** per repo (repo-local PID file under `.ai/local/delivery/`); **subcommands** (`--is-delivering`, `--last-message`, `--resume-prompt`); return the **PM last-message + result** on stdout; **session-traffic liveness** (retire the 30-min file-mtime heuristic, default 15 min); confirm/extend signal propagation to the opencode child; **never auto-merge in Mode B**. |
| Liveness helper | `scripts/pm-liveness.sh` (new) | Reads opencode session-message cadence; prints seconds-since-last-message, last step, gap trend; non-zero exit when stalled. Consumed by `deliver-ticket.sh` and `ceo-loop.sh`. |
| Batch runner (Mode B) | `scripts/batch-deliver.sh` | **Rebase-before-merge with green-gate wait**: for a human-approved PR (`approved` label), rebase onto latest `main`, push, wait for PR quality gates green, then squash-merge using PR title/description as the commit message; skip the wait if already on latest `main`; on rebase conflict, delegate conflict resolution to an AI agent then re-run gates. Pending-review parks that ticket only; batch continues. |
| CEO agent prompt | `.opencode/agent/ceo.md` | Rewrite the seed into the canonical prompt: **wait for `deliver-ticket.sh`** and consume its returned last-message; **verify PM finalized all phases** (via `chg-<ref>-pm-notes.yaml`) before merging; **merge-not-yield**; **never detach**; multi-ticket-per-session; resolve PM blockers via `--resume-prompt`. Keep autonomous authority model but defer opt-in gating/threat-model/decision-record to #118. |
| Tests | `scripts/.tests/test-ceo-loop.sh`, `scripts/.tests/test-deliver-ticket.sh` (extend), `scripts/.tests/test-pm-liveness.sh`, `scripts/.tests/test-batch-deliver.sh` (extend) | One test file per invariant/script, following `.ai/rules/bash.md` §11 (embedded framework, mockable wrappers, fixtures). |
| Generated plugin | `.ados-claude/agents/ceo.md` (+ any README/index) | Regenerate via `scripts/build-claude-plugin.sh` after `ceo.md` changes; CI enforces freshness. |
| Agent inventory | `.opencode/README.md` | Register `ceo` if not already listed. |
| Sibling guide consistency | `doc/guides/autonomous-batch-delivery.md` | Review/correct so it does not contradict the revised delivery-modes guide (per review comment #15): align the liveness description (session-traffic 15 min), rebase-before-merge flow, the retired deliver-ticket auto-merge (Mode B merge now owned by batch-deliver), and `clean-merged-branches` "never unmerged" guarantee. |
| PR-description quality (comment #12) | `.opencode/agent/pr-manager.md` (+ `.ai/agent/pr-instructions.md`) | Add a must-rule: `@pr-manager` MUST produce PR descriptions fit to be used **verbatim** as the squash-commit body (the Mode B rebase-before-merge flow sources the commit message from PR title + description). Add a static grep test. (F-6) |

### Out of scope (deferred)

- CEO **opt-in gating / threat model / decision record** (#118 — separate;
  depends on this ticket's reliability baseline).
- Per-call stream timeouts inside opencode itself (out of ADOS's control; #96
  is consume-side mitigation only).
- Changing the CEO's authority/merge model beyond the behavioral rules above.
- Formalizing the pm-notes YAML into a strict, machine-validatable schema (the
  "CEO verifies PM finalization" check stays AI-driven for now; a future ticket
  can script it once pm-notes are schema-strict).
- Per-dogfooding-project cleanup of detached-delivery conventions in
  project-local `.ai/local/**` (each project scrubs its own).

## Acceptance criteria (traceability)

Mapped from ticket #142 AC, refined by the 15 review comments.

### AC-1 — Guide (reviewed + merged first)
- [x] `doc/guides/delivery-modes.md` exists, `redistributable`, transformed
      into a user-facing guide (commit `21185d3`). (Note: ticket AC-1 said
      `status: Draft`; the review-comment-#14 transform flipped it to
      `status: Active` for the delivered final version — human-approved on
      PR #143.)
- [x] Defines Mode A and Mode B; states INV-DM-1..6 as must/must-not.
- [x] Cross-links `autonomous-batch-delivery.md`, `change-lifecycle.md`,
      `ados-processes.md`; ticket refs in frontmatter `references`.
- [x] Human-reviewed (15 comments addressed; resolution summarized on PR #143).
- [ ] Merged (happens at PR merge — this is a "no autonomous merge" change).

### AC-2 — `deliver-ticket.sh` single-flight + join (INV-DM-1/2)
- [ ] Repo-local PID file under `.ai/local/delivery/<REF>.pid`; startup probes
      a live `deliver-ticket.sh` for the same ticket.
- [ ] Live ⇒ JOIN (wait + classify + same exit path); no duplicate, no kill.
      **Per-poll re-validation** of the owner PID identity (cmdline AND
      start-timestamp from the PID file) so an OS-reused PID can't make the
      joiner wait on a stranger (F-4).
- [ ] No live ⇒ OWN (current behavior).
- [ ] Signal propagation: traps forward SIGTERM/SIGINT → SIGKILL to the opencode
      child (extend the existing `_cleanup_child`/`kill_process_tree`).
- [ ] **`deliver-ticket.sh` does NOT merge** (F-2). The legacy auto-merge-on-
      `approved`-label path is retired; the script returns `pr-open` (+ PR URL
      + PM last-message). Merge authority: CEO (Mode A, after INV-DM-4 verify)
      / `batch-deliver.sh` (Mode B, after human `approved` + rebase + green).
- [ ] Default invocation prints a **delivery summary** on stdout (result, PR
      URL, PM last-message); stderr logging unchanged.
- [ ] `scripts/.tests/test-deliver-ticket.sh`: live⇒join, dead⇒own,
      concurrent⇒converge, kill-propagates-to-child, **join-aborts-on-PID-reuse
      (F-4)**, **does-not-auto-merge-Mode-A (F-2)**, stdout-summary.

### AC-3 — `ceo-loop.sh` stuck-detection + durable stop + session resume (INV-DM-3/5, #97)
- [ ] Spawns at most one `@ceo`; **writes its `@ceo` child PID to
      `.ai/local/ceo/ceo.pid` and probes+validates it on startup** so a loop
      restart while a CEO is alive JOINs rather than double-spawns (F-3).
- [ ] detects a **stuck** CEO (no session traffic
      AND no healthy delivery via `deliver-ticket.sh --is-delivering`) and
      kill+restarts.
- [ ] Does NOT kill a CEO blocked on a healthy, progressing delivery.
- [ ] Durable stop signal survives restart; `--reset` clears it.
- [ ] **Session resume**: remembers last CEO session id; resumes it when context
      < `CEO_RESUME_TOKEN_LIMIT` (default 100000), else fresh session.
- [ ] `scripts/.tests/test-ceo-loop.sh`: stuck⇒kill, healthy-delivery⇒no-kill,
      stop-survives-restart, `--reset`⇒clear, resume-under-threshold,
      fresh-over-threshold, **loop-restart-does-not-double-spawn-when-ceo-alive
      (F-3)**.

### AC-4 — `@ceo` behavioral rules (INV-DM-4, #99)
- [ ] `.opencode/agent/ceo.md` contains: wait-for-delivery +
      consume-last-message, verify-PM-finalization-before-merge, merge-not-yield,
      proceed-not-halt, never-detach, multi-ticket-per-session, resolve-blocker
      via `--resume-prompt` — phrased must/must-not.
- [ ] `change-lifecycle.md` final-check references merge-not-yield.

### AC-5 — `pm-liveness.sh` + session-traffic watchdog (INV-DM-5, #96)
- [ ] `scripts/pm-liveness.sh <session_id>` prints seconds-since-last-message,
      last step, gap trend; non-zero exit when stalled.
- [ ] Stalled = no session message for ≥ `CEO_LOOP_STALL_MINUTES` (default 15; at-threshold == stalled, matching the `>=` comparison in `pm-liveness.sh`/`ceo-loop.sh`).
- [ ] `deliver-ticket.sh` and `ceo-loop.sh` consume it; ps-only / file-mtime
      heuristics retired as the primary signal.
- [ ] `scripts/.tests/test-pm-liveness.sh`: healthy, stale, growing-gap
      (fixture logs).

### AC-6 — Mode B rebase-before-merge with green-gate wait
- [ ] In batch mode, a human-approved PR (`approved` label) is rebased onto
      latest `main`, pushed, and merged only after PR quality gates go green.
- [ ] Already-on-latest-main ⇒ skip the wait, merge directly.
- [ ] Rebase conflict ⇒ AI resolves ⇒ push ⇒ gates re-run.
- [ ] Squash-merge uses the PR title + description as the commit message.
- [ ] `scripts/.tests/test-batch-deliver.sh`: approved+green⇒merge,
      approved+conflict⇒ai-then-green⇒merge, not-approved⇒park-and-continue,
      already-on-main⇒direct-merge.

### AC-7 — Tests + rules
- [ ] All new/updated `scripts/.tests/*` pass; no regression in existing tests
      (`bash scripts/test-all.sh` and `bash tools/.tests/...` green).
- [ ] Follows `.ai/rules/bash.md` (strict mode, traps, logging, mockable
      wrappers, dry-run, testability, command-pattern where multi-responsibility).
- [ ] License headers via `scripts/add-header-location.sh` on configured paths
      (scripts/ is NOT in the auto-header set per AGENTS.md — verify; apply only
      where the rules require).
- [ ] `.ados-claude/` regenerated and not stale (CI guard).

## Resolved decisions (from PR #143 review — recorded in chg-GH-142-pm-notes.yaml)

- **OQ-DM-1 → CEO-foreground.** CEO calls `deliver-ticket.sh` (blocking),
  consumes the returned PM last-message, decides next action; may resume the PM
  with `--resume-prompt`. Loop-runner-owns-blocking rejected.
- **OQ-DM-2 → Mode B never auto-merges.** Human approves via `approved` label;
  batch then rebases + waits-for-green + squash-merges (PR title/desc as commit
  msg). No `--auto-merge` flag.
- **OQ-DM-3 → 15-min session-traffic liveness.** Replaces the 30-min
  file-mtime heuristic. `CEO_LOOP_STALL_MINUTES`/`DELIVER_STUCK_MINUTES`
  default 15.
- **OQ-DM-4 → Full scope, one PR.** #142 delivers both modes as a final
  version; absorbs #97/#99/#96 (close on delivery).
- **Loop runner = `ceo-loop.sh`** (consistency with `@ceo`).
- **Loop runner primary job = detect stuck CEO** (not "park during delivery").
- **Session resume = feasible** (confirmed: `opencode session list --format
  json`, `opencode db SELECT tokens_* FROM session`, `opencode run --session`).
- **Repo-local concurrency** — parallel deliveries in different repos/clones
  allowed; PID tracking under `.ai/local/delivery/`.
- **Signal propagation** mandatory in all delivery scripts.
- **CEO verifies PM finalization** before merge (AI-driven; pm-notes).
- **`clean-merged-branches` never removes unmerged branches.**

## Risks & dependencies

- **Risk — `deliver-ticket.sh` is large (842 lines) and already in production
  use (#124).** The single-flight/join and session-traffic changes must not
  regress its existing classification/exit-code contract. Mitigation: extend,
  don't rewrite; keep the mockable-wrapper test seams; run the existing
  `test-deliver-ticket.sh` as a regression gate.
- **Risk — session-traffic liveness depends on opencode's session DB schema
  (`session` table, `tokens_*` + message timestamps).** If the schema or the
  `opencode db`/`opencode session list` CLI surface changes, liveness breaks.
  Mitigation: pin to documented stable CLI; degrade gracefully (warn + fall
  back to file-mtime) if the DB query fails.
- **Risk — `ceo.md` rewrite + `.ados-claude/` regeneration.** The plugin build
  must stay in sync (CI enforces). Mitigation: run
  `scripts/build-claude-plugin.sh` and commit source + generated together.
- **Dependency — `change-lifecycle.md`** gets a merge-not-yield note (AC-4).
- **Dependency — `.opencode/README.md`** agent inventory must list `ceo`.
- **Soft dependency — #119 (generic runner) closed but never landed in-tree;**
  this ticket lands `ceo-loop.sh` as that runner's home.

## Out of scope confirmations

The four OQ-DM and the "no autonomous merge" / "closely guided" posture are
confirmed by review comment #14. The CEO opt-in gating / threat model /
decision record stay in #118.
