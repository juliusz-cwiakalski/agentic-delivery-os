# M3 — Harness and tracker integrations backlog

Canonical scope for M3 (see `README.md` for exit criteria and sequencing).
Ticket references are added when the story tickets are created.

### M3-S1 opencode v2.x harness and telemetry
- Goal: the harness port drives opencode v2.x reliably and reports facts
  statistics need; opencode is the only delivery harness (Claude Code remains
  generated artifacts only).
- Tasks: integration-mode spike (standalone/service/direct API; direct DB
  access for usage analytics allowed) with recorded decision; spawn adapter
  (per-spawn model env propagation, session resume/attach); telemetry
  extraction (per-seat model, tokens, cost, durations); version detection and
  compatibility window; conformance tests.
- AC: dispatch through the installed harness port runs with the resolved
  profile; telemetry rows land with schema version and per-seat models;
  unsupported versions refuse with a typed error.
- Depends on: M1-S11, M2-S14.

### M3-S2 Jira backlog adapter (MCP-first)
- Goal: Jira work items drive the same lifecycle primitives.
- Tasks: Jira MCP integration (issue, transitions, comments, links);
  configurable per-project workflow mapping validated at startup; primitive
  adapter over the existing client seeds; env-only credentials; capability
  matrix; parity scenarios.
- AC: a Jira-tracked work item completes the full lifecycle with typed errors
  for unsupported operations.
- Depends on: M0-S19, M3-S5.

### M3-S3 GitLab code-host adapter (CLI-first)
- Goal: GitLab MRs and pipelines behave exactly like GitHub PRs and checks.
- Tasks: `glab` CLI adapter with API fallback; MR create/update with threaded
  discussions and resolution; pipelines-as-checks with failure job/task
  reading, log messages, and timing analytics; squash merge with crafted
  title/description and squash commit message; capability matrix; parity
  scenarios.
- AC: a GitLab repository completes an end-to-end delivery with the same
  result classes as GitHub.
- Depends on: M0-S19, M3-S5.

### M3-S4 GitHub adapter completion (code host + backlog)
- Goal: complete the GitHub adapter as the reference implementation for code
  hosting and backlog management.
- Tasks: full primitive coverage over `gh` with API fallback — PRs with
  threaded discussions and resolution, checks with failure job/log/timing
  access, squash merge with crafted metadata, GitHub Issues backlog
  primitives; capture reference behavior for parity.
- AC: parity suite green; reference behavior documented.
- Depends on: M0-S19.

### M3-S5 Adapter conformance and parity suite
- Goal: one contract, provable across adapters.
- Tasks: extend the conformance suite (M0-S20) to tracker primitives; error
  taxonomy and trap catalogs per adapter; simulated tracker double for
  offline tests; parity matrix gate in CI.
- AC: suite fails on undeclared behavior differences; new adapters plug in
  without lifecycle changes.
- Depends on: M0-S20.

### M3-S6 Multi-tracker per project
- Goal: one project can carry more than one tracker (migration scenarios)
  without ambiguity.
- Tasks: work-item references carry tracker identity; per-project tracker
  composition; routing rules per tracker; Jira + GitHub Issues side by side;
  tracker identity in events and history.
- AC: every work item resolves to exactly one tracker; ambiguous operations
  refuse with typed errors.
- Depends on: M3-S2, M3-S4.
