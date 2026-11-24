---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/00-index.md
ados_distribution: redistributable
---
# Documentation Index

> Landing page for this repository's documentation. For humans and AI agents.

## Start Here

| Document | Description |
|----------|-------------|
| [ADOS Processes Map](guides/ados-processes.md) | Canonical map of ADOS's six processes — start here for the big picture |
| [Overview](overview/) | North star, roadmap, architecture, glossary |
| [System Spec](spec/) | Current truth — feature specs, API descriptions, NFRs |
| [Milestone Governance](spec/features/feature-milestone-governance.md) | The milestone-first operating rule: attachment at creation, intake verification, the ordered issue-event check and its write-free sweep, the exit-review-gated closure executed by closeout's `milestone-sync` step, and the planning-corpus mirror |
| [Adapter Conformance Suite](spec/features/feature-adapter-conformance.md) | The three provider-agnostic flows over the ten closed operations in fifteen steps, capability-gated skips, coverage gates, the closed seven-member assertion-family union beside the unchanged six-family trap vocabulary, the declared cross-adapter parity matrix of thirty cells with its six-dimension basis and adjudicated difference register, the parity gate's nine clause ids, the simulated stateful double, the registration-only participation proof, the `delivery.conformance.v1` artifact, the scheduled read-only live tier, and the harness conformance registry with its six-scenario floor plus four extension scenarios |
| [Adapter Reference Behavior](spec/features/feature-adapter-reference-behavior.md) | The closed adapter contract as current truth and the parity bar every other adapter is compared against: per-operation preferred/fallback transports, failure identities, absence semantics, the bounded discussion and log-excerpt evidence reads and their caps, the CLI probe and composition selection value, and the mechanism-scoped GitHub transition mapping |
| [Status Digest](spec/features/feature-status-digest.md) | The read-only nine-section attention-state delivery digest: closed finding-code registry, grouped ranked findings, evidence states, bounds, and declared gaps |
| [Resident Dispatch Daemon](spec/features/feature-resident-daemon.md) | The mounted daemon lifecycle (prompt-required, composed unconditionally, signal-owned foreground lifetime, real instance pid, brand-derived install identity, durable-state degradation), lock/heartbeat, control protocol v1, reconciliation, the composed lane-supervision seam, external effects and commit crash safety, preemption, watch, polling, and supervisor install |
| [Coordinator Supervision](spec/features/feature-coordinator-supervision.md) | The `coordinator` start/stop/status/tick family composed by the shipped entrypoint over the delivered harness session port, the append-only instance lease with liveness-first atomic claim and the two state-fence rules, the recorded join-or-resume-or-spawn decision, artifact-evidence stuck detection, kill-with-grace, the durable per-epoch restart budget, owner-brief exhaustion escalation with the reserved slot, wake-on-typed-question with the selected live/resume/spawn effect, and the `delivery.coordinator.v1` payload |
| [Loop Supervision](spec/features/feature-loop-supervision.md) | The typed Mode A outer loop as a composition profile over the delivered supervision engine under `loop-main` (TDR-0056) with its durable stop as a state-ledger record (TDR-0057): the five-verb `loop` family, the shell-parity status keys with their source table, the engine-reuse boundary, the CEO spawn identity and deterministic title, the two-signal stuck verdict with the delivery corroborator's evidence-class and fold tables, the restart-reason compromise, the declared backoff schedule, the durable `loop.stop` and `reset`, the bounded operational log, session re-find, the two additive record kinds, and the published nine-proven / six-not-proven boundary |
| [`loop` command reference](planning/oss-tooling/milestones/m4/commands/loop.md) | The `loop` reference page the help entry points at: the five verbs and flags, the exit vocabulary, the status keys, the log bounds, the durable-stop workflow, and the divergences from `ceo-loop.sh` |
| [Brief](spec/features/feature-brief.md) | The read-only one-screen owner render: ten surfaces, two named placeholders, three anchored-action groups, the spend citation, and collector failure as evidence at exit `0` |
| [Typed Blocker and Question Channel](spec/features/feature-blockers.md) | The typed question channel: four question types, audience routing, the layered credential guard, recorded answers and resume projections, and the shared ranking on the list, digest, and brief |
| [Queue Ready](spec/features/feature-queue-ready.md) | The read-only ready set: six tri-state readiness conditions, close classification and ranking, identity resolution, bounds, and evidence model |
| [Scheduling Engine](spec/features/feature-scheduling-engine.md) | The daemon-free one-shot scheduling engine: one folded queue graph with append-only reason-bearing removal and its ledger-position presence rule, editable dependency edges, bounded tracker-truth reconcile, repo-exclusive fence-token leases with stale takeover, the dispatch claim's in-claim per-ref verdict with the no-renewal rule beside the sibling `queue claim` renewal, per-runner weight classes, producer-before-consumer deploy gating, close-first ranking, the global owner-hold gate, parks that resume on condition, seven proof-backed integrity properties, and the bounded `queue`/`lanes` surfaces |
| [Owner-Gate SLA](spec/features/feature-owner-gate-sla.md) | The owner-gate aging and escalation contract: 24 h escalation, 72 h default-on-expiry, the recorded decision ledger, recorded waivers folded into gate kind and `waivedBy`, never-silence, and the board's `GATES` section |
| [Board](spec/features/feature-board.md) | The fleet board: lanes, gates, owner asks, actions, and parked work from the shared `delivery.status-facts.v1` source and the repository's action registry, repository selection over the managed set under the 128-repository cap, the preserved gate SLA, bounds, exit projection, and the 21st prompt-required mount |
| [Command Audit Ledger](spec/features/feature-audit-ledger.md) | The append-only, keyed-chain invocation record: two additive state kinds, the store-managed chaining key, bounded filtered reads, and claimed agent identity |
| [Retro Action Registry](spec/features/feature-retro-action-registry.md) | The retro follow-through memory: the five-field filing contract plus verification artifact, derived aging with nudges and escalation, explicit two-plane closure, the fixed WIP limit of three, the board `ACTIONS` surface, the `retro action file\|close\|list` verb group, and the follow-through producers behind the ceremony pass and the retro report fold |
| [Retro Evidence Pipeline](spec/features/feature-retro-pipeline.md) | The `retro collect`/`report` family over an independent keyed-chain evidence sidecar: pipeline-truth checks, the no-target success, levels R1-R6, the retro registry, memory-audit trigger home, bounded export, and doctor visibility |
| [Spend Read Side](spec/features/feature-spend.md) | The read-only `spend` fold over the delivered closeout capture and the v2 per-step and session-baseline telemetry families: five-class breakdown, per-phase and per-agent attribution, restarts, resume amplification, v2 cost totals, breakdowns, timing summaries, the reconciliation disclosure, bounded output, and the status-digest projection |
| [Harness Telemetry v2](spec/features/feature-telemetry-v2.md) | Per-step token/calls/cost ingest beside the stream drain, five-dimension attribution from economics and audit identity, session-close baseline capture, additive schema-versioned step and baseline families, the captured row's additive seat, resolved-model, store-sourced duration, and observed-axis-absence facts, and the declared reading bases |
| [Doctor](spec/features/feature-doctor.md) | The read-only pre-flight diagnostic: five checks in fixed order, closed verdicts, bounded evidence and hints, `doctor.check.failed`, and stable exit `0`/`1`/`2` |
| [Machine-Readable Plan Schema](spec/features/feature-plan-schema.md) | The `delivery.plan.v1` YAML plan, the `plan validate`/`diff`/`overlap` verdicts, the `lint plan` target, and the legacy markdown transition |
| [Commit Primitive](spec/features/feature-commit-primitive.md) | The `commit` command, default-on atomic record-plus-commit on phase completion, precise staging and safety, the transport seam with a marked template fallback, convergence, and commit telemetry |
| [Repositories and the Host Overview](spec/features/feature-projects.md) | The two-layer state scope, the checkout identity marker and minted project key, the derived host index with bounded maintenance and the collision guard, the read-only `repos list [--json]` flat record set with its `repos.v1` payload, exits, handover and daemon projections, and the `projects list --flat` byte-compatible alias |
| [Project Groups](spec/features/feature-project-groups.md) | The configuration-only group membership document (`delivery.projects.groups.v1`), its load-time validation and classified identities, the optional declared-members-only workspace discovery root, the `projects list` group surface with the closed health vocabulary, the one aggregation clause with partial results, and the group-scoped `queue list --project` / `status --project` reads |
| [Event Taxonomy v2 and Reference Surface](spec/features/feature-event-taxonomy.md) | The published six-topic subscribe taxonomy (two snapshot topics plus four event topics, the peak-pause kinds `stop`/`parked`/`resumed`/`park-edge` under taxonomy v2 with every v1 kind and payload byte-identical and v1 retired), the eight-field event envelope with per-topic lane/ref rules, per-`(topic, lane)` process-scoped sequence with gap-to-repoll, overflow stamped `repoll`, the unknown-topic refusal, every declared kind with a producer, and the mounted `events list` / `events describe <topic>` reference family |
| [Provider Peak Pausing](spec/features/feature-peak-pausing.md) | Provider-aware peak pausing: the provider profile nominated at dispatch admission on lane and attempt records, per-profile peak-window rule data, the daemon's bounded-grace in-flight parking with preservation classification, classification-routed window-end resume, taxonomy v2 episode events, the window-scoped zero-spend evidence, the status/brief/lanes park surfaces, and the composition-fact peak-enforcement read with the declared degradation to iteration-start gating when no composition supplies the watch |
| [CLI Entrypoint and Self-Description](spec/features/feature-cli-entrypoint.md) | The two executables (`delivery-os` compatibility alias and `jaiship`) over one shared launcher composition, working-name resolution, root/command `--help`, `--version`, and `--print-install-path`, the build-time identity and compiled re-entry path, the twenty-eight-family prompt-required set with `provider` last, and fail-closed `fallback.internal` containment |
| [Verify Change and Exit Taxonomy](spec/features/feature-verify-change-and-exit-taxonomy.md) | The `verify` family: ledger verification, the gate battery and deploy-trace verdicts, the delivery-result enum, and the CLI exit taxonomy |
| [Closeout Transaction](spec/features/feature-closeout.md) | The dry-run-by-default thirteen-step post-merge transaction, idempotency ledger, provider writes and gaps, authorship-gated review threads with root-author facts, pre-flight capsule validation, production worktree and merged-diff facts, checkout/worktree/branch cleanup, retro coverage, union-attributed session compaction, exit-review-gated milestone synchronization through one bounded attached-set read and one read-back-verified `close-milestone` write, seat-attributed telemetry capture, change-capsule close, the automatic `landed` queue removal with its fail-open `queueRemoval` block, and bounded judgment residue with the `attention` exit and a human `JUDGMENT RESIDUE` section |
| [Change Capsule](spec/features/feature-capsule.md) | The change folder as an append-only memory capsule: event contract and producers, candidate `<id>.yaml` naming and schema, capture bar, evidence links, dedup and contradiction rules, exactly one promotion decision per candidate, routing, confined home writes, and closeout validation/close |
| [Memory Records, Layout, and Lint](spec/features/feature-memory-lint.md) | The committed `.ai/memory/` store and its repository invariant: the canonical layout, one typed-record schema with single-sourced bounds, eight lint areas with the closed `memory.<area>.<condition>` register, both-direction index coverage over two universes, budget caps, advisory derivable heuristics, privacy-vocabulary secret findings, and aggregate/CI wiring |
| [Harness Adapters](spec/features/feature-harness-adapters.md) | The typed harness port family with the optional capability-gated `terminate` operation, opencode and Claude Code delivery adapters, streaming JSONL handle acquisition with completion-scoped collection, the fresh-spawn title and built lifecycle prompt, the optional per-step ingest sink with session-close baseline capture, the pinned supported-version window and probe grammar with typed refusals, the declared integration mode, per-spawn caller-supplied agent identity and single-seat binding mapped onto the honoured surface, deny-by-default spawn environment, read-only neutral telemetry extraction over the observed store contract with seat, resolved-model, duration, and observed-axis-absence facts, union session attribution for closeout, and non-gating closeout capture constructed from resolved harness settings |
| [Dispatch Engine](spec/features/feature-dispatch-engine.md) | The typed per-ticket `dispatch` family: the dispatch-owned durable `dispatch.lane` record with recorded-attempt resume, the atomic per-ref admission verdict decided inside the claim with a bounded fence wait, the pre-lease supported-version window and integration-mode admission with the declared `detail.harness` evidence, spawn or resume with the `pm` agent identity, the `ticket-<REF>` title and the built lifecycle prompt, the five-attempt tracker retry ladder, progress-based watching, stall termination and the in-process bounded restart loop, the one total derivation with arm-aware corroboration, the open-pull-request arm's parity precondition with its bounded fast-forward ensure-push act (the typed stack's first remote-write seam, GH-386), durable dual-run evidence, the repository-scoped `dispatch attempts` read side, the four read-only per-ref operator queries (`status`, `log`, `is-delivering`, `last-message`) over the repository-scoped lane view, the per-ref per-stream harness-stdout artifact family and its bounded tail, and the capability-gated transcript read, checkout-scoped repository identity, the four-condition per-repository handover and reversal in the production composition, the factory-proven daemon lane seam, the published parity proof boundary, the offline parity battery, and the CLI-independent bash fallback |
| [Watchdog and Lane Contracts](spec/features/feature-watchdog-lane-contracts.md) | The check-only `preflight`/`teardown`/`liveness` family, restoration and memory-preservation semantics, and the sourced liveness verdicts with the stalled identity |
| [Session Lifecycle Economics](spec/features/feature-session-lifecycle-economics.md) | Adapter-sourced progress signals, prefill-safe liveness, the capability-gated terminate ahead of an in-process restart, the durable restart budget, resume economics, the per-delivery amplification view, the run/session identity and command-audit attribution substrates harness telemetry v2 joins, and the lane configuration branch |
| [Verify Gates](spec/features/feature-verify-gates.md) | The config-declared battery, its cited verdicts and suite breadth, and the appended gate-verification record |
| [Merge and Verify Deploy](spec/features/feature-merge-verify-deploy.md) | The merged transaction: freshness envelope, probe extended to every not-green declared required job with its recorded-or-probe attribution, waivers, the total mergeability refusal taxonomy with its closed sync-required reason pair, one guarded provider-side squash landing with crafted metadata, provider-asserted landing truth, idempotent replay, the retained unused local landing and refresh capabilities, and the deploy-trace verdict taxonomy |
| [MCP Surface](spec/features/feature-mcp-surface.md) | The minimal read-only MCP server: three branding-projected tools mirroring status, verify-change, and verify-gates, payload parity without envelope or exit-code leakage, and `0`/`1`/`2` lifecycle exits |
| [Measurement Baseline](spec/features/feature-measurement-baseline.md) | The committed bash-era measurement baseline: schema, `MET-` metrics, status semantics, source traceability, window, and comparison protocol |
| [Ceremony Runner](spec/features/feature-ceremony-runner.md) | The `ceremony` family and declaration contract: four verbs, six built-ins, artifact-verified execution with resume and compaction, single-window catch-up, project declarations, the tier engine, durable run/step records, the four retro levels, and the two `ceremony.*` identities |
| [Steer](spec/features/feature-steer.md) | The `steer` family and the shared typed message record: filing with drawn defaults and the derived origin block, the batched boundary read point with receipts, `ttl-elapsed` expiry as a classified outcome, the asks batch with the delivered drawn-default join, artifact-ref completion, the three `steering.*` record kinds, the registered-value guard, three exact error identities, and the 23rd prompt-required mount |
| [Metrics Report and Burn-Rate Alarms](spec/features/feature-metrics.md) | The read-only `metrics` report: native ceremony share and cycle time, the CI-failure-rate proxy, the escaped-defects curated floor, the per-dispatch spend block, burn-rate alarms against the project-committed declaration, the comparison view under the committed protocol, classified absence per section, bounds, and the 24th prompt-required mount |
| [Supervise](spec/features/feature-supervise.md) | The operator-facing supervisor battery: the `delivery.supervision.v1` report, artifact-evidence tri-state classification with lying-liveness detection and no process input, watchdog and daemon consumption, the any-cause-gated `liveness-stall` park with its non-null re-entry instant and the additive lane `until`, duplicate-supervision refusal against an actively acting authority, restart-policy composition over the delivered economics with a ref-stable exhaustion question, two error identities, and the 25th prompt-required mount |
| [Installable Artifact and Install Lifecycle](spec/features/feature-install-lifecycle.md) | The self-contained `build:binary` artifact and the build identity behind the one-line `--version` token contract, the compiled process edge, the twenty-sixth prompt-required `install` family (`migrate`, `status`, `rollback`, `uninstall`, `purge`) owned by the primary identity only, the linked-worktree and dev-build admission gates, the atomic seven-step replace with its artifact-agreement no-op, the single rollback slot and its pair-inversion precondition, the advisory-on-write and typed-on-report state-format check, the removal matrix with the always-printed residual set, the five dry-runs, the opt-in `PATH` block, the `install migrate` verb with its dry-run, verified backup and manifest, the daemon guard, and the guarded shell launcher step |
| [Documentation Handbook](documentation-handbook.md) | How docs work — structure, conventions, workflow |

## Changing Behavior?

| Document | Description |
|----------|-------------|
| [Changes](changes/) | Proposed and accepted changes (evolution log) |
| [Change Lifecycle Guide](guides/change-lifecycle.md) | 11-phase delivery workflow |
| [Definition of Ready](guides/definition-of-ready.md) | DoR gate (`dor_check`, phase 5) — pre-delivery review of artifacts vs ticket |
| [Change Convention](guides/unified-change-convention-tracker-agnostic-specification.md) | Naming, folders, branches |

## Guides

| Document | Description |
|----------|-------------|
| [Agents & Commands Guide](guides/opencode-agents-and-commands-guide.md) | How to use AI agents and commands |
| [Onboarding Existing Project](guides/onboarding-existing-project.md) | Adopt ADOS in an existing project |
| [Project Inception](guides/project-inception.md) | Manual 8-phase process for running project inception |
| [Claude Code Setup](guides/claude-code-setup.md) | Claude Code CLI provider setup (Anthropic, Z.AI) |
| [Decision Records Management](guides/decision-records-management.md) | Decision record types, lifecycle, governance |
| [Meeting Preparation and Summarization](guides/meeting-preparation-and-summarization.md) | How to prepare, run, document, and follow up on meetings |
| [Delivery Modes](guides/delivery-modes.md) | The two unattended delivery modes (Mode A CEO loop, Mode B manual batch) + behavioral invariants |
| [Engine-first Delivery Operations](guides/engine-first-operations.md) | Daily engine-first routine: the four per-reference inspection queries, reading the handover gate and `repos list` row, per-repository flip and reversal, shell fallback, declared residuals |
| [Milestone Management](guides/milestone-management.md) | The milestone-first operating rule: naming, creation, attachment, entry and exit review, closure, extension, and enforcement |
| [Autonomous Batch Delivery](guides/autonomous-batch-delivery.md) | Unattended multi-ticket delivery: `batch-deliver.sh`, `deliver-ticket.sh`, liveness, approvals |
| [Provider Conditions and Parks](guides/provider-conditions-and-parks.md) | Provider pauses: the declared-zone basis, condition kinds and park causes, expiry semantics, budget ceilings with their parked-versus-failed split and pre-spawn bound, watch freshness, fail-loud announcements, configuration pointer |
| [Ceremony Runner](guides/ceremony-runner.md) | Operator guide: the four verbs, the declaration document and vocabularies, a worked project declaration, notes and windows, dry-run/`--apply`, catch-up, artifacts, and the measurement record |
| [Migrating to Per-Repository Delivery State](guides/migrating-to-per-repository-state.md) | One-step, reversible move of an existing single delivery store into a per-repository project state root |
| [Tracker Credential Provisioning](guides/tracker-credential-provisioning.md) | Provision the declared truth-read reference over the four source styles (default `GITHUB_TOKEN`), the explicit `gh` bridge and the allowlisted token read, least privilege, rotation, and the 404 scope check |
| [Tools Convention](guides/tools-convention.md) | Standard for building CLI tools |

## Tools

| Tool | Description |
|------|-------------|
| [zclaude](tools/zclaude.md) | Launch Claude Code with Z.AI GLM Coding Plan |
| [text-to-image](tools/text-to-image.md) | Generate images from text prompts (7 providers) |

## Quality test specifications

| Document | Description |
|----------|-------------|
| [Namespace Conformance](quality/test-specs/test-spec-namespace-conformance.md) | The two conformance arms, the shim-registry reconciliation, the migration battery, the fixtures and the proof boundary |

## Templates

| Template | Purpose |
|----------|---------|
| [Change Spec](templates/change-spec-template.md) | Change specification |
| [Decision Record](templates/decision-record-template.md) | Decision records (ADR/PDR/TDR/BDR/ODR) |
| [Feature Spec](templates/feature-spec-template.md) | Feature specifications |
| [North Star](templates/north-star-template.md) | Product north star document |
| [Test Spec](templates/test-spec-template.md) | Test specifications |
| [Test Plan](templates/test-plan-template.md) | Per-change test plans |
| [Implementation Plan](templates/implementation-plan-template.md) | Per-change implementation plans |

Additional templates are listed in [templates/README.md](templates/README.md), including the memory bootstrap templates installed at bootstrap Phase 5, optional business/product strategy templates, and YAML register templates.

## Decision Records

| Document | Description |
|----------|-------------|
| [Decision Records](decisions/) | All decision records (ADR/PDR/TDR/BDR/ODR) |
| [Decision Records Index](decisions/00-index.md) | Index of all decisions |
| [Foundational Decision Binding Register](decisions/00-register.md) | Topic-to-record binding map for the foundational monorepo topics |

## For AI Agents

- Agent definitions: `.opencode/agent/*.md`
- Command definitions: `.opencode/command/*.md`
- System bootstrap: `AGENTS.md`
- PM configuration: `.ai/agent/pm-instructions.md`
