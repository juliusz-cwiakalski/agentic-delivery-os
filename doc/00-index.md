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
| [Adapter Conformance Suite](spec/features/feature-adapter-conformance.md) | The three provider-agnostic flows, capability-gated skips, coverage gates, `delivery.conformance.v1` artifact, and the scheduled read-only live tier |
| [Status Digest](spec/features/feature-status-digest.md) | The read-only nine-section attention-state delivery digest: closed finding-code registry, grouped ranked findings, evidence states, bounds, and declared gaps |
| [Resident Dispatch Daemon](spec/features/feature-resident-daemon.md) | The mounted daemon lifecycle (prompt-required, composed unconditionally, signal-owned foreground lifetime, real instance pid, brand-derived install identity, durable-state degradation), lock/heartbeat, control protocol v1, reconciliation, the composed lane-supervision seam, external effects and commit crash safety, preemption, watch, polling, and supervisor install |
| [Coordinator Supervision](spec/features/feature-coordinator-supervision.md) | The `coordinator` start/stop/status/tick family composed by the shipped entrypoint over the delivered harness session port, the append-only instance lease with liveness-first atomic claim and the two state-fence rules, the recorded join-or-resume-or-spawn decision, artifact-evidence stuck detection, kill-with-grace, the durable per-epoch restart budget, owner-brief exhaustion escalation with the reserved slot, wake-on-typed-question with the selected live/resume/spawn effect, and the `delivery.coordinator.v1` payload |
| [Brief](spec/features/feature-brief.md) | The read-only one-screen owner render: nine surfaces, two named placeholders, three anchored-action groups, and collector failure as evidence at exit `0` |
| [Typed Blocker and Question Channel](spec/features/feature-blockers.md) | The typed question channel: four question types, audience routing, the layered credential guard, recorded answers and resume projections, and the shared ranking on the list, digest, and brief |
| [Queue Ready](spec/features/feature-queue-ready.md) | The read-only ready set: six tri-state readiness conditions, close classification and ranking, identity resolution, bounds, and evidence model |
| [Scheduling Engine](spec/features/feature-scheduling-engine.md) | The daemon-free one-shot scheduling engine: one folded queue graph, repo-exclusive fence-token leases with stale takeover, per-runner weight classes, producer-before-consumer deploy gating, close-first ranking, the global owner-hold gate, parks that resume on condition, and the bounded `queue`/`lanes` surfaces |
| [Owner-Gate SLA](spec/features/feature-owner-gate-sla.md) | The owner-gate aging and escalation contract: 24 h escalation, 72 h default-on-expiry, the recorded decision ledger, recorded waivers folded into gate kind and `waivedBy`, never-silence, and the render-once `board` surface |
| [Command Audit Ledger](spec/features/feature-audit-ledger.md) | The append-only, keyed-chain invocation record: two additive state kinds, the store-managed chaining key, bounded filtered reads, and claimed agent identity |
| [Retro Evidence Pipeline](spec/features/feature-retro-pipeline.md) | The `retro collect`/`report` family over an independent keyed-chain evidence sidecar: pipeline-truth checks, the no-target success, levels R1-R6, the retro registry, memory-audit trigger home, bounded export, and doctor visibility |
| [Spend Read Side](spec/features/feature-spend.md) | The read-only `spend` fold over closeout-captured telemetry: five-class breakdown, per-phase and per-agent attribution, restarts, resume amplification, bounded output, and the status-digest projection |
| [Doctor](spec/features/feature-doctor.md) | The read-only pre-flight diagnostic: five checks in fixed order, closed verdicts, bounded evidence and hints, `doctor.check.failed`, and stable exit `0`/`1`/`2` |
| [Machine-Readable Plan Schema](spec/features/feature-plan-schema.md) | The `delivery.plan.v1` YAML plan, the `plan validate`/`diff`/`overlap` verdicts, the `lint plan` target, and the legacy markdown transition |
| [Commit Primitive](spec/features/feature-commit-primitive.md) | The `commit` command, default-on atomic record-plus-commit on phase completion, precise staging and safety, the transport seam with a marked template fallback, convergence, and commit telemetry |
| [Projects Host Overview](spec/features/feature-projects.md) | The two-layer state scope, the checkout identity marker and minted project key, the derived host index with bounded maintenance and the collision guard, and the read-only `projects list [--json]` surface with its five-field envelope, exits, handover and daemon projections |
| [CLI Entrypoint and Self-Description](spec/features/feature-cli-entrypoint.md) | The non-installed Bun bin and composition entry, working-name resolution, root/command `--help` and `--version`, the exact prompt-required command set, and fail-closed `fallback.internal` containment |
| [Verify Change and Exit Taxonomy](spec/features/feature-verify-change-and-exit-taxonomy.md) | The `verify` family: ledger verification, the gate battery and deploy-trace verdicts, the delivery-result enum, and the CLI exit taxonomy |
| [Closeout Transaction](spec/features/feature-closeout.md) | The dry-run-by-default twelve-step post-merge transaction, idempotency ledger, provider writes and gaps, authorship-gated review threads with root-author facts, pre-flight capsule validation, production worktree and merged-diff facts, checkout/worktree/branch cleanup, retro coverage, session compaction, change-capsule close, and bounded judgment residue with the `attention` exit and a human `JUDGMENT RESIDUE` section |
| [Change Capsule](spec/features/feature-capsule.md) | The change folder as an append-only memory capsule: event contract and producers, candidate `<id>.yaml` naming and schema, capture bar, evidence links, dedup and contradiction rules, exactly one promotion decision per candidate, routing, confined home writes, and closeout validation/close |
| [Harness Adapters](spec/features/feature-harness-adapters.md) | The typed harness port family, opencode and Claude Code delivery adapters, streaming JSONL handle acquisition with completion-scoped collection, deny-by-default spawn environment, read-only neutral telemetry extraction with a bounded Claude byte read and store-scoped orphan disclosure, harness-store session attribution, and non-gating closeout capture constructed from resolved harness settings |
| [Dispatch Engine](spec/features/feature-dispatch-engine.md) | The typed per-ticket `dispatch` family: one-shot spawn/resume, progress-based watching, artifact-first classification, durable dual-run evidence, checkout-scoped repository identity, the four-condition per-repository handover and reversal in the production composition, the factory-proven daemon lane seam, and the CLI-independent bash fallback |
| [Watchdog and Lane Contracts](spec/features/feature-watchdog-lane-contracts.md) | The check-only `preflight`/`teardown`/`liveness` family, restoration and memory-preservation semantics, and the sourced liveness verdicts with the stalled identity |
| [Session Lifecycle Economics](spec/features/feature-session-lifecycle-economics.md) | Adapter-sourced progress signals, prefill-safe liveness, the durable restart budget, resume economics, the per-delivery amplification view, and the lane configuration branch |
| [Verify Gates](spec/features/feature-verify-gates.md) | The config-declared battery, its cited verdicts, and the appended gate-verification record |
| [Merge and Verify Deploy](spec/features/feature-merge-verify-deploy.md) | The merged transaction: freshness envelope, probe, waivers, one rebase-refresh, verified squash landing, idempotent replay, and the deploy-trace verdict taxonomy |
| [MCP Surface](spec/features/feature-mcp-surface.md) | The minimal read-only MCP server: three branding-projected tools mirroring status, verify-change, and verify-gates, payload parity without envelope or exit-code leakage, and `0`/`1`/`2` lifecycle exits |
| [Measurement Baseline](spec/features/feature-measurement-baseline.md) | The committed bash-era measurement baseline: schema, `MET-` metrics, status semantics, source traceability, window, and comparison protocol |
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
| [Autonomous Batch Delivery](guides/autonomous-batch-delivery.md) | Unattended multi-ticket delivery: `batch-deliver.sh`, `deliver-ticket.sh`, liveness, approvals |
| [Provider Conditions and Parks](guides/provider-conditions-and-parks.md) | Provider pauses: condition kinds, park causes and expiry, fail-loud announcements, configuration pointer |
| [Migrating to Per-Repository Delivery State](guides/migrating-to-per-repository-state.md) | One-step, reversible move of an existing single delivery store into a per-repository project state root |
| [Tracker Credential Provisioning](guides/tracker-credential-provisioning.md) | Provision the truth-read key (`GITHUB_TOKEN`), the explicit `gh` bridge, least privilege, rotation, and the 404 scope check |
| [Tools Convention](guides/tools-convention.md) | Standard for building CLI tools |

## Tools

| Tool | Description |
|------|-------------|
| [zclaude](tools/zclaude.md) | Launch Claude Code with Z.AI GLM Coding Plan |
| [text-to-image](tools/text-to-image.md) | Generate images from text prompts (7 providers) |

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

Additional profile-aware templates are listed in [templates/README.md](templates/README.md), including optional business/product strategy templates and YAML register templates.

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
