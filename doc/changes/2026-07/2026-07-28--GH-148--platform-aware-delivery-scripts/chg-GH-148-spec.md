---
change:
  ref: GH-148
  type: feat
  status: Proposed
  slug: platform-aware-delivery-scripts
  title: "Make delivery scripts platform-aware (GitHub + GitLab) and harden GH-146 hook infrastructure"
  owners: ["Juliusz Ćwiąkalski"]
  service: delivery-os
  labels: ["autonomous-delivery", "gitlab", "platform-abstraction", "hardening"]
  version_impact: minor
  audience: mixed
  security_impact: low
  risk_level: medium
  dependencies:
    internal: ["scripts/deliver-ticket.sh", "scripts/batch-deliver.sh", "scripts/ceo-loop.sh", "scripts/.tests/test-hook-regression.sh", "doc/spec/features/feature-autonomous-delivery.md", "doc/guides/delivery-modes.md", "doc/guides/autonomous-batch-delivery.md"]
    external: ["gh CLI", "glab CLI", "GitLab REST API (merge-request merge-status)"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the autonomous-delivery scripts (`deliver-ticket.sh`, `batch-deliver.sh`, `ceo-loop.sh`) work identically on GitHub and GitLab through runtime platform detection and a tracker/MR abstraction, so GitLab deliveries report accurate results and populated PR URLs, Mode B can merge GitLab MRs, and three non-blocking GH-146 hardening follow-ups are closed — all without changing any existing platform-agnostic invariant or GitHub behavior.

## 1. SUMMARY

This change adds a platform-aware layer to the autonomous-delivery bash scripts. Today every tracker/MR interaction is hard-coded to the GitHub CLI (`gh`), GitHub JSON field shapes, the GitHub label taxonomy, and GitHub PR concepts; on a GitLab project the wrapper still runs (the PM agent self-corrects to `glab` via project config) but its **post-delivery verification layer is blind** — it cannot see GitLab issues or MRs, so every GitLab delivery degrades to `result=finished` with `pr_url=` empty and misleading "Could not fetch issue state" warnings. This change introduces one-time platform detection (with an environment override), a tracker/MR dispatch seam replacing the GitHub-only wrapper, a JSON normalization shim that presents a common schema regardless of source CLI, platform-correct PM prompt building, full `batch-deliver.sh` GitLab support (list / CI-gate / merge), configurable blocked-label and merge-strategy knobs, GitLab merge-status polling, and a one-line robustness fix to the liveness `find`. It also closes three CritiqueGrid follow-up items from GH-146: a deterministic property/fuzz test for the V1 hook parser, macOS-portability handling for the lifecycle test, and hook-failure tuning guidance in the delivery-modes guide.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The autonomous-delivery neighborhood is delivered as deterministic bash scripts wrapping AI agents (see `doc/spec/features/feature-autonomous-delivery.md`): `deliver-ticket.sh` (per-ticket engine, single-flight + JOIN), `batch-deliver.sh` (Mode B sequential batch with rebase-before-merge + green-gate + squash-merge), and `ceo-loop.sh` (Mode A outer process).
- `deliver-ticket.sh` does **not** merge (F-2). It runs the PM, then classifies the result via `classify_result`, which queries the tracker with the `gh` CLI wrapper (`_gh`). Result classification produces `merged | blocked | pr-open | failed | unknown`; emitted summaries can also carry control/outcome values (`finished`, `max-restarts`) on OWN/JOIN paths.
- `pr_url_for` resolves the PR web URL that populates `pr_url=` in the delivery summary consumed by the CEO (Mode A) and `batch-deliver.sh` (Mode B).
- `build_delivery_prompt` emits the per-iteration PM instruction, which today contains literal `gh issue view`, `gh pr list`, `gh pr view`, and `gh issue edit` commands.
- `require_cmd gh` runs unconditionally at startup in both `deliver-ticket.sh` and `batch-deliver.sh`.
- The liveness watchdog, single-flight + JOIN logic, branch resolution (`resolve_branch`, git-based), the resume mechanism (`--resume-prompt`), the delivering marker, and the pre-iteration hooks (GH-146) are all platform-agnostic and must not change.
- GH-146 delivered an opt-in pre-iteration hook with a strictly validated `ADOS_HOOK_ENV_V1` data-only return protocol; its CritiqueGrid review shipped-with-findings and recorded three non-blocking follow-ups (CG-SEC-003, CG-SRE-002, and the spec's tuning OQ).

### 2.2 Pain Points / Gaps

- **Blind verification layer on GitLab.** Because `classify_result` and `pr_url_for` call `gh` against a GitLab project for which `gh` is unauthenticated, every GitLab delivery returns `unknown`/`failed`/`finished` with `pr_url=` empty. Evidence: 8/8 deliveries on a real GitLab project (`family-finance-control-tower`) exhibited identical symptoms across two sessions, including repeated "Could not fetch issue state (network/rate-limit?)" warnings that misdiagnose "wrong platform CLI" as a network/rate-limit problem.
- **The CEO cannot trust the summary on GitLab.** `pr-open` is never returned, so the CEO cannot distinguish "MR created, awaiting review" from "PM gave up/crashed" and must manually reconcile every delivery via `glab mr list`, parsing the MR number out of the PM's free-text last message.
- **`batch-deliver.sh` Mode B is entirely unusable on GitLab.** Issue/PR listing, CI-status gating, and the merge command are all GitHub-only (`gh pr merge N --squash --delete-branch`).
- **The PM prompt contradicts the project config.** The prompt instructs the PM to use `gh` while the project's own config (`.ai/agent/pm-instructions.md`, `pr-instructions.md`) documents a GitLab project — wasting PM turns on platform discovery and risking literal `gh` execution on a cold session.
- **No platform abstraction seam.** The `_gh` wrapper is a hard `gh` alias with no dispatch, no `_glab`/`_tracker`/`_mr`, and no JSON normalization despite `gh --json` and `glab --output json` returning materially different field shapes (state enum casing, `.number` vs `.iid`, `.url` vs `.web_url`, `.headRefName` vs `.source_branch`, `.mergedAt` vs `.merged_at`, review/merge-status fields, and CI-check command differences).
- **Hard-coded taxonomy and merge style.** The blocked label (`human-input-needed`) and merge strategy (`--squash`) are fixed; GitLab projects may use a different label taxonomy and non-squash merge policy.
- **GitLab merge-status staleness.** GitLab recomputes `detailed_merge_status` asynchronously; a stale `conflict` can persist while `merge_status: can_be_merged` and `has_conflicts: false` (observed on MR !97), blocking `glab mr merge` with `405 Method Not Allowed` until a no-op push forces recompute. GitHub has no equivalent pattern.
- **`find` liveness log noise.** The worktree-activity `find` exits non-zero on permission-denied subdirectories (e.g. root-owned mounts), producing alarming `✗ exited with 1` log lines through the process substitution even though liveness detection still functions.
- **GH-146 single-track parser review.** The `ADOS_HOOK_ENV_V1` parser is the most security-critical path; a UTF-8 false-match defect (CG-SEC-001) survived six review iterations, so the single review track is a residual risk (CG-SEC-003).
- **Linux-only lifecycle test.** The GH-146 20-trial lifecycle matrix relies on `/proc/${pid}/stat`, `pgrep -g`, `pkill -g`, so it does not validate macOS despite production shipping BSD fallbacks (CG-SRE-002).
- **Untuned hook-failure defaults.** `ADOS_HOOK_MAX_FAILURES=5` / `ADOS_HOOK_RETRY_SECONDS=60` are initial values with no documented guidance for revisiting against production telemetry (GH-146 spec OQ-1).

## 3. PROBLEM STATEMENT

Because the autonomous-delivery scripts query the tracker exclusively through the GitHub CLI, an operator running ADOS against a GitLab project cannot get an accurate delivery result, a populated PR URL, or a working Mode B merge — every GitLab delivery degrades to an unverifiable `finished` summary that forces manual reconciliation and erodes trust in the autonomous loop, while three recorded GH-146 hardening gaps remain open.

## 4. GOALS

- **G-1**: Make `deliver-ticket.sh`, `batch-deliver.sh`, and `ceo-loop.sh` behave identically on GitHub and GitLab with platform auto-detection and zero per-project customization for the common case.
- **G-2**: Enable GitLab delivery summaries to report an accurate `result` (`pr-open`/`merged`/`blocked`) and a populated `pr_url`, and to stop emitting false "Could not fetch issue state" warnings.
- **G-3**: Make `batch-deliver.sh` Mode B capable of listing, CI-gating, and merging GitLab MRs.
- **G-4**: Keep all existing GitHub behavior unchanged when the platform is GitHub (zero regression).
- **G-5**: Make the blocked label and merge strategy configurable while preserving current defaults for backward compatibility.
- **G-6**: Close the three GH-146 CritiqueGrid follow-ups (parser property test, macOS lifecycle portability, hook-failure tuning documentation).
- **G-7**: Preserve every existing platform-agnostic invariant and contract — liveness, single-flight + JOIN, branch resolution, resume, hooks, result-domain, and no-merge behavior — adding no new result values.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| GitLab deliveries returning an accurate `result` (not `unknown`/`finished`) | 100% when the issue/MR is queryable |
| GitLab summaries with populated `pr_url` | 100% when an open MR exists |
| False "Could not fetch issue state" warnings on GitLab | 0 when the issue exists |
| GitHub regression | 0 behavior changes / failing tests when `PLATFORM=github` |
| GH-146 follow-ups closed | 3/3 (CG-SEC-003, CG-SRE-002, tuning OQ) |

### 4.2 Non-Goals

- **NG-1**: Adding Jira, Bitbucket, or any tracker other than GitHub and GitLab.
- **NG-2**: Changing the liveness watchdog, single-flight/JOIN logic, branch resolution, the resume mechanism, or the delivering marker (all platform-agnostic already).
- **NG-3**: Changing PM agent behavior or prompt definitions — the PM already uses `glab` correctly via project config; the gap is only the wrapper's verification layer and prompt builder.
- **NG-4**: Changing the OpenCode session execution model, the AI-vs-script split, or the 11-phase lifecycle.
- **NG-5**: Adding new delivery `result` values or changing consumer (CEO prompt, `batch-deliver.sh`) exit-code contracts.
- **NG-6**: Re-tuning the `ADOS_HOOK_MAX_FAILURES`/`ADOS_HOOK_RETRY_SECONDS` defaults themselves — only documenting when/how to revisit them.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Platform auto-detection with override | Determines GitHub vs GitLab once at startup so all downstream seams select the correct CLI without per-project configuration; provides an explicit escape hatch for ambiguous remotes. |
| F-2 | Conditional CLI dependency | Replaces the unconditional `require_cmd gh` with detection-first dependency so a GitLab-only machine is not hard-blocked on a missing/unauth'd `gh`. |
| F-3 | Tracker/MR dispatch seam | Replaces the GitHub-only `_gh` alias with a dispatch that routes issue and PR/MR operations to the matching CLI across all affected scripts, localizing the single abstraction point. |
| F-4 | JSON normalization shim | Presents a common schema regardless of the divergent `gh --json` vs `glab --output json` field shapes so classification/URL logic is platform-agnostic. |
| F-5 | Platform-aware result classification & PR URL | Makes GitLab deliveries report `pr-open`/`merged`/`blocked` with a populated `pr_url` and eliminates false "Could not fetch issue state" warnings. |
| F-6 | Platform-aware PM prompt builder | Stops the prompt from emitting GitHub-specific commands on a GitLab project so the prompt no longer contradicts the project config. |
| F-7 | batch-deliver.sh full GitLab support | Makes Mode B (list / CI-gate / merge) function on GitLab, including platform-correct merge-flag mapping and configurable strategy. |
| F-8 | Configurable blocked label | Lets the blocked-detection label match a project's taxonomy instead of the fixed GitHub default. |
| F-9 | Configurable merge strategy | Lets Mode B honor a project's non-squash merge policy while defaulting to squash for backward compatibility. |
| F-10 | GitLab merge-status polling & stale-conflict recovery | Handles GitLab's asynchronous `detailed_merge_status` recompute so a merge is not attempted while status is stale and a `conflict` contradicts `can_be_merged`. |
| F-11 | find liveness robustness | Stops the liveness `find` from aborting/warning on permission-denied subdirectories. |
| F-12 | V1 parser property/fuzz test (CG-SEC-003) | Adds deterministic, randomized byte-sequence coverage of the hook parser to defend against subtle regressions surviving a single review track. |
| F-13 | macOS lifecycle test portability (CG-SRE-002) | Makes the hook lifecycle test either run on macOS or explicitly document its Linux-only test platform. |
| F-14 | Hook-failure tuning documentation (GH-146 OQ-1) | Documents when and how to revisit the hook-failure cap/interval defaults against production telemetry. |

### 5.1 Capability Details

- **F-1**: A one-time detection runs before any `require_cmd`. Resolution order: an explicit environment override first, then the configured git remote URL (origin), then a `glab auth status` fallback, defaulting to GitHub when nothing is detectable. The resolved platform is stored once in a single global and read by every dependent seam. Detection is platform-neutral with respect to liveness and single-flight, which never observe it.
- **F-2**: After detection, the matching CLI is required. A GitLab-only machine therefore requires `glab` (not `gh`); a GitHub machine still requires `gh`. The dependency set (git, jq, setsid, opencode) is otherwise unchanged.
- **F-3**: A single dispatch surface routes issue operations and PR/MR operations to the correct CLI. Because `gh` and `glab` subcommand surfaces are not identical, callers consume platform-correct flags; the dispatch is the seam, not a naive name swap. The same dispatch is used in `deliver-ticket.sh` and `batch-deliver.sh`. (`ceo-loop.sh` does not itself call the tracker; it delegates to `deliver-ticket.sh` for delivery and to the CEO agent for merges, so its change is limited to sharing detection where relevant.)
- **F-4**: The shim encapsulates the full CLI call plus jq normalization and returns a common JSON schema (DM-1) consumed by classification and URL resolution. Key divergences normalized: issue state enum casing (`OPEN`/`CLOSED` vs `opened`/`closed`), PR/MR number (`.number` vs `.iid`), PR/MR URL (`.url` vs `.web_url`), head branch (`.headRefName` vs `.source_branch`), merged-at (`.mergedAt` vs `.merged_at`), review/merge status, and CI-check representation.
- **F-5**: `classify_result` and `pr_url_for` consume the normalized schema. On GitLab, a queryable open MR yields `pr-open` plus the MR web URL; a closed issue with a merged MR yields `merged`; the configured blocked label yields `blocked`. A genuine tracker error (auth/rate-limit/network) still degrades gracefully without burning a restart slot — the difference is it no longer misfires on a healthy GitLab project.
- **F-6**: `build_delivery_prompt` no longer emits literal GitHub commands unconditionally. It is either platform-correct (emitting the detected platform's CLI) or platform-neutral (deferring to the project's own configured CLI per existing config files). This removes the prompt/config contradiction.
- **F-7**: All `batch-deliver.sh` tracker interactions route through the dispatch. The Mode B merge command maps platform-appropriately (e.g. `gh pr merge N --squash --delete-branch` maps to `glab mr merge N --squash --remove-source-branch`, adjusted by the configured strategy). CI-status gating uses the platform-correct CI surface.
- **F-8**: The blocked-detection label is read from a configurable variable, defaulting to the existing GitHub value so GitHub behavior is unchanged.
- **F-9**: Mode B's merge strategy is read from a configurable variable (`squash` | `merge` | `rebase`), defaulting to `squash`. It maps to the platform-appropriate flags.
- **F-10**: Before attempting a GitLab merge, the wrapper polls the MR's `detailed_merge_status` until `mergeable` (bounded timeout and interval). On a stale-conflict contradiction (`conflict` while `can_be_merged`/no real conflicts), a no-op push forces recompute, then polling resumes.
- **F-11**: The worktree-activity `find` no longer propagates a non-zero exit from permission-denied subdirectories, removing the alarming `✗` log noise. Liveness detection is unchanged.
- **F-12**: A deterministic, fast property/fuzz test generates random valid and invalid byte sequences and verifies the parser accepts/rejects them against the documented `LC_ALL=C` grammar. It is seeded and bounded — a self-contained test, not a long-running external fuzzer.
- **F-13**: The GH-116 lifecycle matrix either gains a macOS-portable reaper check, or the test/spec/CI docs explicitly record the lifecycle test as Linux-only. Either outcome closes the portability observation.
- **F-14**: The delivery-modes guide gains explicit guidance that the hook-failure cap/interval are initial values to be revisited against production telemetry, including the trade-offs (too-tight cap exits the supervisor on a flaky hook; too-loose delays failure surfacing).

## 6. USER & SYSTEM FLOWS

```
Flow 1 — GitLab delivery verification (deliver-ticket.sh)
  detect platform → gitlab → require glab → PM runs (creates MR) → classify_result via
  _glab + normalized schema → result=pr-open, pr_url=<MR web URL> (no false warning)

Flow 2 — Mode B GitLab merge (batch-deliver.sh)
  human approves ticket → batch resolves MR (iid) → poll detailed_merge_status→mergeable
  (stale-conflict → no-op push → re-poll) → glab mr merge N --<strategy> --remove-source-branch

Flow 3 — GitHub regression path
  detect platform → github → require gh → all existing gh paths preserved unchanged

Flow 4 — Escape hatch
  ADOS_PLATFORM=gitlab on a GitHub remote (or vice-versa) → forces that platform's behavior
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- One-time platform detection with environment override and sensible default (F-1).
- Detection-first conditional CLI dependency (F-2).
- A tracker/MR dispatch seam replacing the `_gh` alias across affected scripts (F-3).
- A JSON normalization shim and a common schema (F-4).
- Platform-aware `classify_result` and `pr_url_for` (F-5).
- Platform-aware/neutral `build_delivery_prompt` (F-6).
- Full `batch-deliver.sh` GitLab support: list, CI-gate, merge (F-7).
- Configurable blocked label and merge strategy (F-8, F-9).
- GitLab merge-status polling and stale-conflict recovery (F-10).
- `find` liveness robustness fix (F-11).
- V1 parser property/fuzz test (F-12), macOS lifecycle portability (F-13), and hook-failure tuning documentation (F-14).
- New configuration variables: `ADOS_PLATFORM`, `ADOS_BLOCKED_LABEL`, `ADOS_MERGE_STRATEGY`.

### 7.2 Out of Scope

- [OUT] Jira, Bitbucket, or any non-GitHub/GitLab tracker support (NG-1).
- [OUT] Changes to liveness, single-flight + JOIN, branch resolution, resume, or the delivering marker (NG-2).
- [OUT] Changes to PM/CEO agent prompt definitions or the OpenCode session model (NG-3, NG-4).
- [OUT] New delivery `result` values or changed consumer exit-code contracts (NG-5).
- [OUT] Re-tuning the hook-failure default values themselves — only documenting when to revisit them (NG-6).
- [OUT] A GitLab CI runner / pipeline integration beyond what Mode B's green-gate needs to observe.
- [OUT] Migrating the existing `to_issue_number` ref-stripping logic (it already strips any `PREFIX-` prefix).

### 7.3 Deferred / Maybe-Later

- Per-project platform config file (beyond `git remote` detection + env override) if operators need project-scoped overrides independent of the environment.
- A shared, sourced library module for the tracker abstraction if a third script begins needing it.
- A macOS CI lane that actually executes the lifecycle matrix (vs. documenting it Linux-only under F-13).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — the scripts do not expose HTTP endpoints. GitLab's merge-status REST surface is consumed read-only/polling (see §8.4).

### 8.2 Events / Messages

N/A.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Normalized tracker/PR schema | An internal, in-memory common JSON shape produced by the normalization shim (F-4) and consumed by classification/URL logic. Fields include normalized `state`, labels, PR/MR identifier, web URL, head branch, and merged-at. It is not persisted and does not change any existing state file. |

### 8.4 External Integrations

- **`gh` CLI** (GitHub) — existing; unchanged behavior when platform is GitHub.
- **`glab` CLI** (GitLab) — issue view/list, MR list/view/merge, and CI-status queries; required when platform is GitLab.
- **GitLab REST API** (`GET /projects/:id/merge_requests/:iid` for `detailed_merge_status`, and an empty/no-op commit push to force recompute) — consumed only by the merge-status poll (F-10), typically through `glab api`.

### 8.5 Backward Compatibility

- Defaults preserve existing behavior: platform defaults to GitHub when undetectable; blocked label defaults to `human-input-needed`; merge strategy defaults to `squash`.
- The `result`-value domain is unchanged; GitLab deliveries move from `unknown`/`finished` to the correct existing value (`pr-open`/`merged`/`blocked`).
- Consumer contracts (CEO prompt `failed` branch, `batch-deliver.sh` exit-code-based classification) are unchanged.
- No new hook protocol, result enum, or persistent state format is introduced.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | GitHub regression | 0 behavior changes / 0 failing existing tests when `PLATFORM=github` |
| NFR-2 | Platform-detection latency | One-time at startup; typical well under 2s (remote read + optional auth probe) |
| NFR-3 | Result-domain stability | No new `result` values; the existing set is used for GitLab identically to GitHub |
| NFR-4 | Parser property test determinism & speed | Seeded/bounded; completes in well under 10s; no external long-running fuzzer |
| NFR-5 | Default preservation | `ADOS_PLATFORM` auto-detect→`github`; `ADOS_BLOCKED_LABEL`→`human-input-needed`; `ADOS_MERGE_STRATEGY`→`squash` |
| NFR-6 | GitLab merge-status poll bound | Timeout ≤ 60s; poll interval ≤ 5s |
| NFR-7 | find robustness | Liveness `find` never emits a non-zero-exit error on permission-denied subdirectories |
| NFR-8 | No-merge preservation | `deliver-ticket.sh` still never merges on either platform |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- The false "Could not fetch issue state (network/rate-limit?)" warning must not fire on a healthy GitLab project; a genuine tracker error remains a logged warning that degrades to `unknown` without consuming a restart slot (unchanged semantics, platform-correct cause).
- The platform detection result should be observable in startup logging so an operator can confirm which platform was selected (and that an override took effect).
- The GitLab merge-status poll should log the wait/recompute path so a stale-conflict recovery is diagnosable.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | `gh`/`glab` subcommand surfaces differ enough that some operations need different flags/API calls, not just a CLI name swap | H | M | Normalize at the shim; call sites use platform-correct flags; cover both paths with tests | M |
| RSK-2 | GitLab's async `detailed_merge_status` staleness (stale `conflict` while mergeable) blocks merges | M | H (observed on MR !97) | Poll to `mergeable`; no-op-push recompute on contradiction (F-10) | L |
| RSK-3 | Changing `classify_result` returns breaks consumers (`batch-deliver.sh`, CEO) | H | L | Same result-domain; GitHub unchanged; only GitLab moves unknown→correct; regression tests | L |
| RSK-4 | Parser property test must be deterministic and fast, not a minutes-long fuzzer | M | M | Fixed seed + bounded iteration count; self-contained test (NFR-4) | L |
| RSK-5 | GitLab CI-status gating differs from `gh pr checks` (`glab ci list` / pipelines) | M | M | Platform-correct CI gate; "no CI configured" positive confirmation (F-7) | M |
| RSK-6 | Platform misdetection on an ambiguous/unconfigured remote | M | L | `ADOS_PLATFORM` override escape hatch (F-1); safe GitHub default | L |
| RSK-7 | Configurable blocked label/merge strategy changes GitHub default if misconfigured | M | L | Defaults preserve current values; documented (F-8/F-9) | L |

## 12. ASSUMPTIONS

- The configured git remote (`origin`) is a reliable platform signal in practice; the environment override exists for exceptions.
- `glab` and `gh` CLIs are independently authenticatable for their respective platforms.
- `to_issue_number` (stripping `PREFIX-`) is sufficient for both `GH-` and `GL-` refs, since both CLIs accept the bare issue/MR number/iid.
- The PM agent already performs the actual delivery work (branch, MR, issue edits) correctly on GitLab via project config; only the wrapper verification/prompt layers are in scope.
- The single-flight, liveness, branch-resolution, resume, and hook machinery are already correct and platform-agnostic (evidence: they functioned across the 8 GitLab deliveries despite the verification gap).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Existing autonomous-delivery scripts | `deliver-ticket.sh`, `batch-deliver.sh`, `ceo-loop.sh` (the code under change) |
| Depends on | 11-phase delivery lifecycle | Both modes wrap it; unchanged |
| Depends on | `gh` CLI (GitHub) / `glab` CLI (GitLab) | Required per detected platform |
| Depends on | GitLab REST API | `detailed_merge_status` for merge-status polling (F-10) |
| Depends on | GH-146 hook infrastructure | F-12/F-13/F-14 harden it; must not regress it |
| Relates to | Epic #95 (autonomous-loop reliability) | Loop reliability epic this strengthens |
| Relates to | Epic #117 (loop-tooling productization) | Tooling productization epic this advances |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | How should the GitLab green-gate determine CI status — `glab ci list` / pipelines, a "no CI configured" positive confirmation, or both? | GitLab projects may have no CI at all (mirroring `batch-deliver.sh`'s no-checks path). The CI surface differs from `gh pr checks`. | Decision needed: consult `@decision-advisor` |
| OQ-2 | Should `build_delivery_prompt` be platform-correct (emit the detected CLI's commands) or platform-neutral (defer to the project's configured CLI)? | The CEO retrospective recommends the neutral form for robustness (defers to already-correct config). | Decision needed: consult `@decision-advisor` |
| OQ-3 | Should `ceo-loop.sh` independently know the platform, or always rely on `deliver-ticket.sh`/the CEO agent? | `ceo-loop.sh` does not call the tracker today; its CEO prompt is merge-authority-focused. Determining whether detection should be shared at the loop level vs. per-script. | Decision needed: consult `@decision-advisor` |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Default merge strategy remains `squash`; `ADOS_MERGE_STRATEGY` makes it configurable | Zero regression for existing GitHub users; honors non-squash GitLab projects | 2026-07-28 |
| DEC-2 | Default blocked label remains `human-input-needed`; `ADOS_BLOCKED_LABEL` makes it configurable | Backward compatibility with GitHub taxonomy | 2026-07-28 |
| DEC-3 | Platform defaults to GitHub when undetectable | Preserves existing behavior for ambiguous/unconfigured remotes | 2026-07-28 |
| DEC-4 | Scope limited to GitHub + GitLab; no other trackers | Planning non-goal (NG-1) | 2026-07-28 |
| DEC-5 | F-13 is satisfied by either a macOS-portable reaper check OR explicit Linux-only test-platform documentation | Both outcomes close CG-SRE-002; defers the stronger option to the plan | 2026-07-28 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `deliver-ticket.sh` | Updated — platform detection, conditional CLI dependency, tracker/MR dispatch, JSON normalization, platform-aware classification/URL, platform-aware prompt, `find` robustness |
| `batch-deliver.sh` | Updated — dispatch routing for list/CI-gate/merge, configurable strategy, GitLab merge-status polling |
| `ceo-loop.sh` | Updated (minimal) — share platform detection where relevant; no tracker calls introduced |
| Delivery scripts tests | Updated/New — platform-detection, dispatch, normalization, GitLab classification/URL, merge-status polling, parser property test, macOS portability |
| `doc/guides/delivery-modes.md` | Updated — hook-failure tuning guidance (F-14); new configuration variables |
| `doc/spec/features/feature-autonomous-delivery.md` | Updated (via doc-sync) — platform-aware verification; new config variables |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** a GitLab project with an open MR for the delivered branch, **when** `deliver-ticket.sh` classifies the result, **then** it returns `pr-open` (not `unknown`/`failed`). | F-5, F-4 |
| AC-F5-2 | **Given** a GitLab delivery with an open MR, **when** the delivery summary is printed, **then** `pr_url=` is populated with the GitLab MR web URL. | F-5, DM-1 |
| AC-F5-3 | **Given** a GitLab project where the issue exists and is queryable, **when** `deliver-ticket.sh` classifies, **then** no "Could not fetch issue state (network/rate-limit?)" warning is emitted. | F-5, F-3 |
| AC-F5-4 | **Given** a GitLab issue is closed and its MR is merged, **when** the result is classified, **then** it returns `merged`. | F-5, F-4 |
| AC-F5-5 | **Given** the configured blocked label is present on a GitLab issue, **when** the result is classified, **then** it returns `blocked`. | F-5, F-8 |
| AC-F2-1 | **Given** a GitLab-only machine with `glab` installed and no `gh`, **when** `deliver-ticket.sh` starts, **then** `require_cmd` requires `glab` (not `gh`) and does not abort. | F-2, F-1 |
| AC-F6-1 | **Given** the detected platform is GitLab, **when** `build_delivery_prompt` constructs the PM instruction, **then** it emits no literal `gh` commands. | F-6 |
| AC-F7-1 | **Given** a GitLab project with a human-approved MR, **when** `batch-deliver.sh` runs the approved flow, **then** it can list the MR, observe CI status, and merge it (Mode B works on GitLab). | F-7, F-10 |
| AC-F1-1 | **Given** a GitLab remote, **when** `ADOS_PLATFORM=github` is set, **then** GitHub behavior is forced (escape hatch). | F-1 |
| AC-F1-2 | **Given** a GitHub remote, **when** `ADOS_PLATFORM=gitlab` is set, **then** GitLab behavior is forced (escape hatch). | F-1 |
| AC-F11-1 | **Given** a repo with permission-restricted subdirectories, **when** the liveness `find` runs, **then** no `exited with 1` error is logged. | F-11, NFR-7 |
| AC-F3-1 | **Given** `PLATFORM=github`, **when** the scripts run, **then** all existing `gh` paths are preserved with no behavior change (no regression). | F-3, F-4, NFR-1 |
| AC-F9-1 | **Given** `ADOS_MERGE_STRATEGY` is unset, **when** Mode B merges, **then** it uses `squash`; **and given** it is set to `merge`/`rebase`, **then** the corresponding platform-appropriate flags are used. | F-9, NFR-5 |
| AC-F8-1 | **Given** `ADOS_BLOCKED_LABEL` is unset, **when** blocked detection runs, **then** it matches `human-input-needed`; **and given** it is set to a custom value, **then** that value is matched instead. | F-8, NFR-5 |
| AC-F10-1 | **Given** a GitLab MR whose `detailed_merge_status` is not yet `mergeable`, **when** a merge is attempted, **then** the wrapper polls until `mergeable` (≤60s, ≤5s interval) before merging; **and given** a stale-conflict contradiction, **then** a no-op push forces recompute before re-polling. | F-10, NFR-6 |
| AC-F12-1 | **Given** the parser property/fuzz test, **when** it generates random valid/invalid byte sequences, **then** it verifies acceptance/rejection against the `LC_ALL=C` grammar deterministically and quickly (no long-running fuzzer). | F-12, NFR-4 |
| AC-F13-1 | **Given** the GH-146 lifecycle test, **when** run on macOS, **then** it either runs portably via a macOS reaper check, or the test/spec/CI docs explicitly state it is Linux-only. | F-13 |
| AC-F14-1 | **Given** the delivery-modes guide, **when** an operator consults hook tuning, **then** it documents that `ADOS_HOOK_MAX_FAILURES`/`ADOS_HOOK_RETRY_SECONDS` are initial values to revisit against production telemetry, with the trade-offs. | F-14 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Single change delivered behind the platform-detection layer; defaults keep GitHub identical, so no coordinated migration is required for existing users.
- Operators of GitLab projects gain correct behavior automatically on detection; the `ADOS_PLATFORM` override is available for edge cases.
- New configuration variables are additive (documented in the delivery-modes guide and `--help` environment sections).
- System spec is reconciled via the standard doc-sync phase to record platform-aware verification and the new variables.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no persistent state migration. The normalized schema (DM-1) is in-memory and transient. Existing repo-local state files (`.pid`, session mappings, delivering marker) are unchanged.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A — no personal/sensitive/tenant data is introduced. Tracker queries read issue/MR metadata already accessible to the authenticated operator CLI. No new data is collected, stored, or transmitted beyond the platform CLIs the operator already uses.

## 21. SECURITY REVIEW HIGHLIGHTS

- No new subprocess execution surface or parent-shell mutation channel is introduced; platform detection reads the git remote and the platform CLIs the operator already runs.
- The parser property test (F-12) **strengthens** the security-critical `ADOS_HOOK_ENV_V1` parser by adding randomized coverage beyond the single review track (CG-SEC-003).
- No credentials are added, logged, or delegated by this change; existing hook credential-delegation semantics are untouched.
- GitLab merge-status polling is read-only except for an empty/no-op commit push on a stale-conflict contradiction (a safe, reviewable side effect on the delivery branch).

## 22. MAINTENANCE & OPERATIONS IMPACT

- Two CLIs (`gh`, `glab`) now form the supported matrix; operators must have the one matching their platform authenticated. This is the existing reality on GitLab (the PM already uses `glab`); the change makes the wrapper honest about it.
- New configuration variables are documented and default-safe; no operational runbook change required beyond awareness.
- The parser property test adds a small, fast test to the suite (bounded; NFR-4).
- Hook-failure tuning is now documented (F-14) so operators know when to revisit the defaults.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Platform | The tracker/forge hosting the project: GitHub or GitLab |
| Tracker | Issue-tracking surface (`gh issue` / `glab issue`) |
| MR | Merge Request (GitLab equivalent of a GitHub PR) |
| `detailed_merge_status` | GitLab's asynchronously-computed MR mergeability status |
| Dispatch seam | The platform-aware routing of issue/PR-MR operations to the correct CLI |
| Normalization shim | The layer returning a common JSON schema from divergent CLI outputs |
| Mode A / Mode B | Autonomous CEO loop / manual batch delivery |
| CG-* | CritiqueGrid finding IDs from the GH-146 review |

## 24. APPENDICES

- **Appendix A — Evidence base:** CEO retrospective `2026-07-28-deliver-ticket-sh-gitlab-incompatibility.md` (8/8 GitLab deliveries; concrete current-state seams; field-shape divergence table).
- **Appendix B — GH-146 CritiqueGrid follow-ups:** CG-SEC-003 (single-track parser review), CG-SRE-002 (Linux-only lifecycle matrix), and the GH-146 spec tuning OQ-1.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-28 | Juliusz Ćwiąkalski | Initial specification |

---

## AUTHORING GUIDELINES

- Authored from the planning-session context (work-item summary, scope A1–A10 / B1–B3, the 18 acceptance criteria, risks, configuration variables, and "what already works" list) plus direct reads of the current scripts (`deliver-ticket.sh`, `batch-deliver.sh`, `ceo-loop.sh`), the GH-146 hook regression tests, the GH-146 CritiqueGrid review, the CEO GitLab-incompatibility retrospective, the autonomous-delivery system spec, and the bash coding rules.
- Functional capabilities are deliberately grouped at a capability boundary (not an implementation step) so a downstream plan-writer can phase them; no code paths, line numbers, or step-by-step implementation directives are included.
- Open questions (OQ-1..3) capture decisions that need `@decision-advisor` input (GitLab CI green-gate semantics, prompt platform-correctness vs neutrality, and loop-level platform awareness).
- Defaults and backward compatibility are emphasized throughout to satisfy the zero-GitHub-regression goal (G-4) and the DoR validation checklist.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-148)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
