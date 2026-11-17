# M3 — Harness and tracker integrations (planning draft)

Status: **draft for review** (planning PR GH-333). Owner directive 2026-11-17.
Open questions to answer in writing: [open-questions.md](open-questions.md).

## Goal

Jaiship runs delivery against any supported harness and tracker with the same
primitives: opencode v2.x as the first-class harness (with telemetry and
statistics extraction), and GitHub, GitLab, and Jira as first-class trackers
(CLI-first, direct API as the fallback) — so any future project can be
delivered with the tooling as-is.

## Decisions from the answered questions (2026-11-17)

- **opencode is the only delivery harness.** Claude Code remains a generated
  artifact surface (agents, prompts, skills generated from the canonical
  opencode definitions); Jaiship does not integrate with the Claude Code
  harness. Only opencode can deliver tickets in M3.
- **Integration mode is a spike.** Standalone service, background service, or
  direct API — chosen by exploration; direct database access for token/usage
  analytics is explicitly on the table.
- **External MCP only.** Jira access may go through MCP; exposing our own MCP
  surface is postponed because the CLI already offers the equivalent commands.
- **Code hosts: GitHub and GitLab** (PR/MR integration). **Backlog trackers:
  GitHub Issues and Jira** (Jira workflow mapping is configurable per project).
- **Multiple trackers per project are supported** (e.g. a legacy Jira project
  migrating to GitHub): work-item references carry tracker identity.
- **PR/MR depth:** threaded discussions with resolution; pipeline/check
  outcome reading with failure job/task inspection, log messages, and timing
  analytics; squash merge with crafted title/description and a squash commit
  message.
- **Credentials env-only; telemetry additive within a version; simulated
  tracker doubles for offline CI; former M3 leftovers stay unplanned.**

## Exit criteria

- **EC-1 Harness portability.** opencode v2.x is the first-class (and only
  delivery) harness: spawn/attach/resume, per-spawn profile propagation, and
  telemetry (model per seat, tokens, cost, timings) into the state layer with
  a versioned schema. Integration mode is decided by the spike and documented.
- **EC-2 Tracker portability.** One adapter contract covers: GitHub and GitLab
  as code hosts (PR/MR with threaded discussions and resolution,
  checks/pipelines with failure job/log/timing access, squash merge with
  crafted metadata) and GitHub Issues and Jira as backlog trackers
  (read/update, comments, transitions with configurable mapping).
- **EC-3 CLI-first with API fallback.** Each adapter prefers the vendor CLI
  (`gh`, `glab`, Jira MCP) and falls back to direct API; the capability
  matrix is explicit per adapter and per primitive.
- **EC-4 Adapter conformance.** A parity suite proves the same primitive
  behavior across adapters (including error taxonomy and trap catalogs), with
  a simulated tracker double for offline CI, so switching trackers never
  changes the lifecycle contract.
- **EC-5 End-to-end deliveries.** Real deliveries exercised end-to-end:
  GitHub code + GitHub Issues backlog, GitLab code + GitHub Issues backlog,
  GitHub code + Jira backlog, and a project using more than one tracker
  (migration scenario), recorded as evidence.

## Stories

### M3-S1 opencode v2.x harness and telemetry
- Goal: the harness port drives opencode v2.x reliably and reports the facts
  statistics need.
- Tasks: integration-mode spike (standalone service vs background service vs
  direct API; direct database access for token/usage analytics allowed) with
  a recorded decision; spawn adapter (per-spawn model env propagation, session
  resume/attach); telemetry extraction (per-seat model, tokens, cost,
  durations) into the state layer; version detection and compatibility
  window; conformance tests against the harness port.
- AC: a dispatch through the installed harness port runs with the resolved
  profile; telemetry rows land with schema version and per-seat models;
  unsupported versions degrade with a typed refusal.
- Depends on: M1-S11, M2-S14.

### M3-S2 Jira backlog adapter (MCP-first)
- Goal: Jira work items drive the same lifecycle primitives.
- Tasks: Jira MCP integration for reads/writes the lifecycle needs (issue,
  transitions, comments, links); configurable per-project workflow mapping
  (states -> transitions), validated at startup; primitive adapter over the
  existing client seeds with env-only credential port; capability matrix
  (what Jira cannot express); parity scenarios against the GitHub adapter.
- AC: a Jira-tracked work item completes the full lifecycle (claim, phases,
  PR/MR link, done transition) with typed errors for unsupported operations.
- Depends on: M0-S19, M3-S5 (conformance harness).

### M3-S3 GitLab tracker adapter (CLI-first)
- Goal: GitLab merge requests and pipelines behave exactly like GitHub PRs
  and checks.
- Tasks: `glab` CLI adapter with direct API fallback; MR create/update, checks
  from pipelines, merge with squash, approvals/threads; capability matrix;
  parity scenarios.
- AC: a GitLab repository completes an end-to-end delivery with the same
  result classes as GitHub.
- Depends on: M0-S19, M3-S5.

### M3-S4 GitHub adapter completion (code host + backlog)
- Goal: complete the GitHub adapter as the reference implementation for both
  code hosting and backlog management.
- Tasks: full primitive coverage over `gh` CLI with API fallback — PRs with
  threaded discussions and resolution, checks with failure job/log/timing
  access, squash merge with crafted title/description and squash commit
  message, and GitHub Issues backlog primitives (read/update, comments,
  transitions); capture the reference behavior the other adapters are
  parity-tested against.
- AC: parity suite green; reference behavior documented in the adapter
  contract.
- Depends on: M0-S19.

### M3-S5 Adapter conformance and parity suite
- Goal: one contract, provable across adapters.
- Tasks: extend the adapter conformance suite (M0-S20) to the tracker
  primitives; typed error taxonomy and trap catalogs per adapter; a simulated
  tracker for offline tests; a parity matrix gate in CI.
- AC: the suite fails on undeclared behavior differences; new adapters plug in
  without changing the lifecycle.
- Depends on: M0-S20.

### M3-S6 Multi-tracker per project
- Goal: one project can carry more than one tracker (e.g. a legacy Jira
  project migrating to GitHub) without ambiguity.
- Tasks: work-item references carry tracker identity; per-project tracker
  composition in configuration; routing rules for reads/writes per tracker;
  migration-friendly flows (same project, Jira and GitHub Issues side by
  side); history and events record the tracker identity.
- AC: a project with two trackers resolves every work item to exactly one
  tracker; lifecycle operations refuse ambiguity with typed errors.
- Depends on: M3-S2, M3-S4.

## Sequencing

Wave 1: M3-S1 + M3-S4 (reference harness + reference code host/backlog).
Wave 2: M3-S5 (conformance harness). Wave 3: M3-S2 + M3-S3 (Jira, GitLab)
against the conformance suite. Wave 4: M3-S6 (multi-tracker) and the EC-5
evidence deliveries.

## Non-goals

- New provider kinds beyond the matrix (additive later behind the ports).
- Presentation-layer or hosted-service work.
- Tracker federation across projects (parked concept).

## Risks

| Risk | Mitigation |
|---|---|
| CLI flag drift across vendor versions | capability probe + typed refusal + version window |
| Jira workflow variance per site | declared workflow mapping in config |
| Telemetry schema churn | versioned rows, additive changes only |
| Offline CI for tracker tests | simulated adapter in the parity suite |
