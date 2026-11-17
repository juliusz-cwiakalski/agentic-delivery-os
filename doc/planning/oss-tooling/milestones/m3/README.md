# M3 — Harness and tracker integrations (planning draft)

Status: **draft for review** (planning PR GH-333). Owner directive 2026-11-17.
Open questions to answer in writing: [open-questions.md](open-questions.md).

## Goal

Jaiship runs delivery against any supported harness and tracker with the same
primitives: opencode v2.x as the first-class harness (with telemetry and
statistics extraction), and GitHub, GitLab, and Jira as first-class trackers
(CLI-first, direct API as the fallback) — so any future project can be
delivered with the tooling as-is.

## Exit criteria

- **EC-1 Harness portability.** The dispatch harness port supports opencode
  v2.x (standalone and background-service modes), propagates the resolved
  model profile per spawn, and extracts telemetry (model per seat, tokens,
  cost, timings) into the state layer with a versioned schema.
- **EC-2 Tracker portability.** The tracker primitives (work-item read/update,
  comments, transitions, PR/MR create/update, pipeline/check status, merge)
  work against GitHub, GitLab, and Jira through one adapter contract.
- **EC-3 CLI-first with API fallback.** Each adapter prefers the vendor CLI
  (`gh`, `glab`, Jira MCP) and falls back to the direct API; the capability
  matrix is explicit per adapter and per primitive.
- **EC-4 Adapter conformance.** A parity suite proves the same primitive
  behavior across adapters (including error taxonomy and trap catalogs), so
  switching trackers never changes the lifecycle contract.
- **EC-5 End-to-end deliveries.** At least one real delivery per adapter
  combination exercised end-to-end (GitHub + opencode, GitLab + opencode,
  Jira-tracked work item + opencode), recorded as evidence.

## Stories

### M3-S1 opencode v2.x harness and telemetry
- Goal: the harness port drives opencode v2.x reliably and reports the facts
  statistics need.
- Tasks: spawn adapter (standalone/service modes, per-spawn model env
  propagation, session resume/attach); telemetry extraction (per-seat model,
  tokens, cost, durations) into the state layer; version detection and
  compatibility window; conformance tests against the harness port.
- AC: a dispatch through the installed harness port runs with the resolved
  profile; telemetry rows land with schema version and per-seat models;
  unsupported versions degrade with a typed refusal.
- Depends on: M1-S11, M2-S14.

### M3-S2 Jira tracker adapter (MCP-first)
- Goal: Jira work items drive the same lifecycle primitives.
- Tasks: Jira MCP integration for reads/writes the lifecycle needs (issue,
  transitions, comments, links); primitive adapter over the existing client
  seeds with credential port; capability matrix (what Jira cannot express);
  parity scenarios against the GitHub adapter.
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

### M3-S4 GitHub tracker adapter completion
- Goal: complete the GitHub adapter as the reference implementation.
- Tasks: full primitive coverage over `gh` CLI with API fallback (PRs,
  checks, threads, merge queue interactions, releases if needed); capture the
  reference behavior the other adapters are parity-tested against.
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

## Sequencing

Wave 1: M3-S1 + M3-S4 (reference harness + reference tracker). Wave 2: M3-S5
(conformance harness). Wave 3: M3-S2 + M3-S3 (Jira, GitLab) against the
conformance suite. Wave 4: EC-5 evidence deliveries.

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
