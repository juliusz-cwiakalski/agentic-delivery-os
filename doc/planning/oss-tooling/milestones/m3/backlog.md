# M3 — Harness and tracker integrations backlog

Canonical scope for M3 (see `README.md` for exit criteria and sequencing).
Ticket references are added when the story tickets are created.

### M3-S1 opencode v2.x harness and telemetry
- Goal: the harness port drives opencode v2.x reliably and reports facts
  statistics need.
- Tasks: spawn adapter (standalone/service, per-spawn model env propagation,
  session resume/attach); telemetry extraction (per-seat model, tokens, cost,
  durations) into the state layer; version detection and compatibility window;
  conformance tests.
- AC: dispatch through the installed harness port runs with the resolved
  profile; telemetry rows land with schema version and per-seat models;
  unsupported versions refuse with a typed error.
- Depends on: M1-S11, M2-S14.

### M3-S2 Jira tracker adapter (MCP-first)
- Goal: Jira work items drive the same lifecycle primitives.
- Tasks: Jira MCP integration (issue, transitions, comments, links); primitive
  adapter over the existing client seeds; capability matrix; parity
  scenarios.
- AC: a Jira-tracked work item completes the full lifecycle with typed errors
  for unsupported operations.
- Depends on: M0-S19, M3-S5.

### M3-S3 GitLab tracker adapter (CLI-first)
- Goal: GitLab MRs and pipelines behave exactly like GitHub PRs and checks.
- Tasks: `glab` CLI adapter with API fallback; MR create/update, pipeline
  checks, squash merge, approvals/threads; capability matrix; parity
  scenarios.
- AC: a GitLab repository completes an end-to-end delivery with the same
  result classes as GitHub.
- Depends on: M0-S19, M3-S5.

### M3-S4 GitHub tracker adapter completion
- Goal: complete the GitHub adapter as the reference implementation.
- Tasks: full primitive coverage over `gh` with API fallback (PRs, checks,
  threads, merge-queue interactions); capture reference behavior for parity.
- AC: parity suite green; reference behavior documented.
- Depends on: M0-S19.

### M3-S5 Adapter conformance and parity suite
- Goal: one contract, provable across adapters.
- Tasks: extend the conformance suite (M0-S20) to tracker primitives; error
  taxonomy and trap catalogs per adapter; simulated tracker for offline
  tests; parity matrix gate in CI.
- AC: suite fails on undeclared behavior differences; new adapters plug in
  without lifecycle changes.
- Depends on: M0-S20.
