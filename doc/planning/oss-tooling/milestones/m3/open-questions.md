# M3 open questions (answer in place)

Answer each question by editing this file (keep the ID and append an
`Answer:` line). Questions without an answer default to the proposed default
at planning close.

### OQ-M3-01 — Harness scope
Context: the former plan mentioned opencode and Claude Code surfaces.
Question: is opencode v2.x the only first-class harness in M3, with Claude
Code remaining a generated compatibility artifact?
Proposed default: opencode v2.x first-class; Claude Code stays generated, not
parity-gated.
Answer:

### OQ-M3-02 — opencode integration mode
Context: opencode v2.x runs as a standalone private server or through its
background service.
Question: must both modes be supported and tested, or is standalone the only
delivery mode with the service mode best-effort?
Proposed default: both supported; standalone is the default delivery mode.
Answer:

### OQ-M3-03 — Own MCP surface
Context: the former plan had a "full MCP" story over our own engines; the
owner directive names "Jira MCP" specifically.
Question: does M3 include the full in-repo MCP surface, or only external
tracker MCP integrations?
Proposed default: external tracker MCP only; our own MCP surface stays
unplanned (IDEA list).
Answer:

### OQ-M3-04 — Adapter order and parity bar
Context: three trackers, one contract.
Question: is the order GitHub (reference) -> GitLab -> Jira correct, and is
"one real end-to-end delivery per adapter combination" enough exit evidence?
Proposed default: yes to both.
Answer:

### OQ-M3-05 — GitLab feature depth
Context: pipelines, approvals, threads, and merge queues differ from GitHub.
Question: which GitLab features are in scope for parity (pipelines-as-checks,
squash merge, approvals/threads), and which are declared unsupported?
Proposed default: pipelines-as-checks + squash merge in scope; approvals and
threads parity; merge queues declared unsupported.
Answer:

### OQ-M3-06 — Jira workflow mapping
Context: Jira transition graphs vary per site.
Question: is a config-driven workflow mapping required (states -> transitions),
and who supplies it (operator config file vs project config)?
Proposed default: config-driven mapping in project configuration, validated at
startup.
Answer:

### OQ-M3-07 — Telemetry versioning
Context: harness telemetry v2 rows exist (M2-S14).
Question: reuse v2 rows for opencode v2.x extraction, or introduce v3?
Proposed default: extend v2 additively; no new major version unless a field
cannot be expressed.
Answer:

### OQ-M3-08 — Credential sources
Context: adapters must resolve credentials through the credential port.
Question: confirm env-only sources and names per adapter (e.g. GH token,
`GITLAB_TOKEN`, Jira URL/user/token or MCP config), and whether any file-based
credential source is acceptable.
Proposed default: env-only; names documented per adapter; file sources out of
scope.
Answer:

### OQ-M3-09 — Offline CI for adapters
Context: parity tests must run without network.
Question: is a simulated tracker double required in M3, or can parity tests be
network-gated?
Proposed default: simulated double required; CI runs it offline.
Answer:

### OQ-M3-10 — Former M3 leftovers
Context: validators, policy engine, workspace utilities, v1.0 readiness,
memory commands, and the memory compiler moved to the unplanned list
(`IDEA-S1..S6`).
Question: should any of them be pulled into M3?
Proposed default: none; M3 stays integrations-only.
Answer:
