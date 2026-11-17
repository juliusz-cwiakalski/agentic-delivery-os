# M3 open questions — ANSWERED 2026-11-17

All questions answered by the owner; answers are recorded inline and folded
into the M3 scope (see `README.md`, `backlog.md`, `ranking.md`).

Answer each question by editing this file (keep the ID and append an
`Answer:` line). Questions without an answer default to the proposed default
at planning close.

### OQ-M3-01 — Harness scope
Context: the former plan mentioned opencode and Claude Code surfaces.
Question: is opencode v2.x the only first-class harness in M3, with Claude
Code remaining a generated compatibility artifact?
Proposed default: opencode v2.x first-class; Claude Code stays generated, not
parity-gated.
Answer: All right, so OpenCode is a first-class harness in Milestone 3. CloudCode is only supported on the level of agents, prompts and skills that are just generated from OpenCode. But we don't integrate with CloudCode harness from Jaiship tooling. So for Milestone 3, only open code can be used to deliver tickets. And Claude can only use the agents and skills. 

### OQ-M3-02 — opencode integration mode
Context: opencode v2.x runs as a standalone private server or through its
background service.
Question: must both modes be supported and tested, or is standalone the only
delivery mode with the service mode best-effort?
Proposed default: both supported; standalone is the default delivery mode.
Answer: So here some spike or exploration will be required. I have no strong preferences. We can use either the background service or some APIs, depending on what open code provides. Probably we'll also need some portion of direct database access to, for example, scan and analyze the token usage, so I have no strong preference here. 

### OQ-M3-03 — Own MCP surface
Context: the former plan had a "full MCP" story over our own engines; the
owner directive names "Jira MCP" specifically.
Question: does M3 include the full in-repo MCP surface, or only external
tracker MCP integrations?
Proposed default: external tracker MCP only; our own MCP surface stays
unplanned (IDEA list).
Answer: So for now we only should plan for accessing gyra resources through MCP, and we can postpone exposing our own MCP to later. Why? Because we have CLI command that can just do what MCP would offer, so whatever is already in a command option for CLI, then we can skip in MCP for now. 

### OQ-M3-04 — Adapter order and parity bar
Context: three trackers, one contract.
Question: is the order GitHub (reference) -> GitLab -> Jira correct, and is
"one real end-to-end delivery per adapter combination" enough exit evidence?
Proposed default: yes to both.
Answer: So we need to support GitHub and GitLab for storing code, including merge request and pull request integration for changes. We need to support GitHub issues for managing the backlog and Jira for managing the backlog for projects that use Jira. 

### OQ-M3-05 — GitLab feature depth
Context: pipelines, approvals, threads, and merge queues differ from GitHub.
Question: which GitLab features are in scope for parity (pipelines-as-checks,
squash merge, approvals/threads), and which are declared unsupported?
Proposed default: pipelines-as-checks + squash merge in scope; approvals and
threads parity; merge queues declared unsupported.
Answer: So for GitHub and GitLab, we should support pool requests and merge requests, threaded discussions and resolution of the threads. We need to support checking pipelines, results. Here. I'm not sure if we can model one-on-one pipelines in github and gitlab, but we need to provide easy way for also to our CLI tool to understand and check if the outcome of the pipeline is success or not, and if this is a failure, read job or task in the pipeline. Then to get some basic analytics tools like what's the log, what it contains, what is the, I don't know, some messages, etc. Also, what would be useful is having some information about the timing, tasks in the job, etc. And of course, the squash should be in an option to modify the content of the description of the MR and the title. And then we should offer a way to commit and merge and squash to the main branch with our well-crafted commit message that will be applied to the squash commit. 

### OQ-M3-06 — Jira workflow mapping
Context: Jira transition graphs vary per site.
Question: is a config-driven workflow mapping required (states -> transitions),
and who supplies it (operator config file vs project config)?
Proposed default: config-driven mapping in project configuration, validated at
startup.
Answer: Yes, we should have configurable workflow mapping because each project can have different mapping. And also, what is important is that we should be able to support different issue trackers for the same project. So, for example, there could be a legacy project that is migrating from one instance of Gyra to GitHub maybe. And then we have two trackers, gyro and github, right? And we would have different work item references, and that would make it easy to understand which issue tracker is it. 

### OQ-M3-07 — Telemetry versioning
Context: harness telemetry v2 rows exist (M2-S14).
Question: reuse v2 rows for opencode v2.x extraction, or introduce v3?
Proposed default: extend v2 additively; no new major version unless a field
cannot be expressed.
Answer: Well, for versioning we should just be backward compatible. If we want to stick to the same version, then we can only add fields but not remove. If we change structure, remove some fields, then we should introduce new versions. 

### OQ-M3-08 — Credential sources
Context: adapters must resolve credentials through the credential port.
Question: confirm env-only sources and names per adapter (e.g. GH token,
`GITLAB_TOKEN`, Jira URL/user/token or MCP config), and whether any file-based
credential source is acceptable.
Proposed default: env-only; names documented per adapter; file sources out of
scope.
Answer: for now env only is fine

### OQ-M3-09 — Offline CI for adapters
Context: parity tests must run without network.
Question: is a simulated tracker double required in M3, or can parity tests be
network-gated?
Proposed default: simulated double required; CI runs it offline.
Answer: ok

### OQ-M3-10 — Former M3 leftovers
Context: validators, policy engine, workspace utilities, v1.0 readiness,
memory commands, and the memory compiler moved to the unplanned list
(`IDEA-S1..S6`).
Question: should any of them be pulled into M3?
Proposed default: none; M3 stays integrations-only.
Answer: none
