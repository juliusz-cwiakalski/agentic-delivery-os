---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/decisions/00-index.md
ados_distribution: project-generated
---
# Decision Records Index

All decision records for this repository, ordered by type and number.

| ID | Type | Title | Status | Date | Owners |
|----|------|-------|--------|------|--------|
| ADR-0001 | ADR | Decision-Making Framework Refactor | Proposed | 2026-06-24 | Juliusz Ćwiąkalski |
| ADR-0002 | ADR | Readiness Gate (Definition of Ready) for Pre-Delivery Artifact Critique | Accepted | 2026-06-28 | Juliusz Ćwiąkalski |
| ADR-0003 | ADR | OSS Tooling Monorepo Structure | Accepted | 2026-10-24 | Juliusz Ćwiąkalski |
| ADR-0004 | ADR | WorkItem Activity Timestamp (`updatedAt`) as an Additive v1 Contract Extension | Proposed | 2026-10-31 | Juliusz Ćwiąkalski |
| ADR-0005 | ADR | Runtime-API Confinement for Provider Client Subpaths | Proposed | 2026-10-31 | Juliusz Ćwiąkalski |
| ADR-0006 | ADR | WorkItem Custom-Field Mapping and Comment-Omission Representation (v1) | Proposed | 2026-10-31 | Juliusz Ćwiąkalski |
| [ADR-0007](ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) | ADR | Provider Engine v1: Placement, Fail-Loud Availability, Parks, and Cost Policy | Proposed | 2026-10-31 | Juliusz Ćwiąkalski |
| [ADR-0008](ADR-0008-harness-adapter-contract.md) | ADR | Harness Adapter Contract | Accepted | 2026-10-31 | Juliusz Ćwiąkalski |
| [ADR-0009](ADR-0009-release-model-v1.md) | ADR | Release Model v1 | Proposed | 2026-10-31 | Juliusz Ćwiąkalski |
| [ADR-0010](ADR-0010-session-admin-port-mutating-contract.md) | ADR | Separate Mutating `SessionAdminPort` from the Read-Only `SessionStore` (ADR-0003 Reconciliation) | Proposed | 2026-10-31 | Juliusz Ćwiąkalski |
| [ADR-0011](ADR-0011-canonical-memory-record-schema.md) | ADR | One Canonical Agent-Memory Record Schema — Required Spine, Closed Optional Set, Dispositions, and a One-Way Reconciliation Direction | Proposed | 2026-11-15 | Juliusz Ćwiąkalski |
| [ADR-0012](ADR-0012-provider-side-merge-landing-path.md) | ADR | Provider-Side Landing Is the Lifecycle Merge Path — One Mechanism, Exact-Head Guards, and Typed Sync-Required Outcomes | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [ADR-0013](ADR-0013-zone-aware-peak-windows-iana-zone-resolution.md) | ADR | Zone-Aware Peak Windows — IANA Zone Names Resolved at the Composition Edge | Proposed | 2026-11-19 | Juliusz Ćwiąkalski |
| [ADR-0014](ADR-0014-credential-strategies-store-ownership.md) | ADR | Credential Strategies — Store-Ownership Resolution Behind an Unchanged Port, Without Harness-Owned OAuth | Proposed | 2026-11-23 | Juliusz Ćwiąkalski |
| ODR-0001 | ODR | Classify doc/templates/*.yaml register templates as redistributable | Accepted | 2026-06-25 | Juliusz Ćwiąkalski |
| [ODR-0004](ODR-0004-flat-record-set-rename-projects-to-repos.md) | ODR | Flat Record Set Command Rename (`projects` → `repos`) — Scoped ODR-0003 Supersession | Proposed | 2026-11-14 | Juliusz Ćwiąkalski |
| [ODR-0005](ODR-0005-closeout-milestone-synchronization.md) | ODR | Milestone Synchronization in `closeout --apply` — Attachment Verification and Exit-Review-Gated Closure | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [ODR-0006](ODR-0006-delivery-vocabulary.md) | ODR | Delivery Vocabulary — Product, Repository, Main Checkout, Worktree, Lane, Work Item, Clone Identity, Product Key | Proposed | 2026-11-24 | Juliusz Ćwiąkalski |
| PDR-0001 | PDR | Tribal Knowledge Extraction Taxonomy | Accepted | 2026-06-27 | Juliusz Ćwiąkalski |
| PDR-0002 | PDR | Mode-Aware Spec-Coverage Resolution for Autonomous Delivery | Proposed | 2026-07-02 | Juliusz Ćwiąkalski |
| [PDR-0003](PDR-0003-owner-gate-sla-default-map.md) | PDR | Owner-Gate SLA Initial Default Map | Proposed | 2026-11-06 | Juliusz Ćwiąkalski |
| [PDR-0004](PDR-0004-memory-practices-concept-repo-internal.md) | PDR | Meta-Learning Reference Stays Repo-Internal — Not Part of the Bootstrap Install Surface | Proposed | 2026-11-14 | Juliusz Ćwiąkalski |
| [PDR-0005](PDR-0005-milestone-first-planning-and-delivery.md) | PDR | Milestone-First Planning and Delivery — Tracker-Attached Scope Before Work Starts | Proposed | 2026-11-14 | Juliusz Ćwiąkalski |
| [PDR-0006](PDR-0006-per-project-provider-policy-repository-config-layers.md) | PDR | Per-Project Provider Overrides — The Repository-Owned Configuration Layers Are the Mechanism | Proposed | 2026-11-19 | Juliusz Ćwiąkalski |
| TDR-0001 | TDR | @bootstrapper Inception Sub-Mode Prompt Structure | Proposed | 2026-06-27 | Juliusz Ćwiąkalski |
| TDR-0002 | TDR | Pre-Iteration Hook Contract — Lifecycle, Failure Semantics, Distribution, and Testability | Accepted | 2026-07-16 | Juliusz Ćwiąkalski |
| [TDR-0003](TDR-0003-config-parser-schema-and-acquisition.md) | TDR | Config Parser, Schema, and Acquisition | Proposed | 2026-10-30 | Juliusz Ćwiąkalski |
| [TDR-0004](TDR-0004-state-storage-engine.md) | TDR | State Storage Engine | Proposed | 2026-10-30 | Juliusz Ćwiąkalski |
| [TDR-0006](TDR-0006-privacy-and-no-cloud-guard-mechanics.md) | TDR | Privacy and No-Cloud Guard Mechanics | Proposed | 2026-10-31 | Juliusz Ćwiąkalski |
| [TDR-0005](TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) | TDR | Delivery Result Enum and CLI Exit Taxonomy | Proposed | 2026-10-31 | Juliusz Ćwiąkalski |
| [TDR-0007](TDR-0007-license-gate-compound-spdx-expression-evaluation.md) | TDR | License Gate Compound SPDX Expression Evaluation | Proposed | 2026-10-31 | Juliusz Ćwiąkalski |
| [TDR-0008](TDR-0008-additive-adapter-contract-extensions-closeout-v1.md) | TDR | Additive Adapter-Contract Extensions for Closeout v1 (`DeliveryRequest.headSha` and `resolve-delivery-thread`) | Proposed | 2026-11-01 | Juliusz Ćwiąkalski |
| [TDR-0009](TDR-0009-retro-evidence-sidecar-keyed-chain-construction.md) | TDR | Retro Evidence Sidecar — Keyed-Chain Construction, Distinct Chaining Key, and Claimed Collector Identity | Proposed | 2026-11-06 | Juliusz Ćwiąkalski |
| [TDR-0010](TDR-0010-dispatch-session-classification-token-projection.md) | TDR | Dispatch-Session Classification Token Projection (TDR-0005 Addendum) | Proposed | 2026-11-07 | Juliusz Ćwiąkalski |
| [TDR-0011](TDR-0011-spend-resume-amplification-v0-formula.md) | TDR | Spend v0 Resume Amplification — Run-Identity Ratio, Latest-Run Progress, and Named Re-Pay Events | Proposed | 2026-11-07 | Juliusz Ćwiąkalski |
| [TDR-0012](TDR-0012-blockers-credential-guard-pattern-deferral.md) | TDR | Blockers Credential Guard Boundary — Registered Values and Name-Shape Only; Pattern Layer Deferred | Proposed | 2026-11-06 | Juliusz Ćwiąkalski |
| [TDR-0013](TDR-0013-agent-session-commit-guard-reversal.md) | TDR | Agent-Session Commit Guard Reversal — Remove the Delivery-Session Refusal and Retire `commit.session.context-refused` | Proposed | 2026-11-07 | Juliusz Ćwiąkalski |
| [TDR-0014](TDR-0014-commit-effect-crash-safety-message-independent-identity.md) | TDR | Commit External-Effect Crash Safety — Message-Independent Identity, Effect Owner, and Check-Before-Reapply | Proposed | 2026-11-07 | Juliusz Ćwiąkalski |
| [TDR-0015](TDR-0015-dispatch-handover-gate-operational-semantics.md) | TDR | Dispatch Handover Gate — Durable Operational Semantics | Proposed | 2026-11-08 | Juliusz Ćwiąkalski |
| [TDR-0016](TDR-0016-harness-streaming-spawn-seam.md) | TDR | Additive Harness Streaming Spawn Seam (`HarnessSpawnStarter`) | Proposed | 2026-11-09 | Juliusz Ćwiąkalski |
| [TDR-0017](TDR-0017-coordinator-supervision-architecture.md) | TDR | Coordinator Supervision Architecture — Separate Supervised Process, Shared Supervisor Regime, Injected Process-Lifecycle Port, Recorded Lifecycle Decisions, Predicate-Bound Wakes | Proposed | 2026-11-07 | Juliusz Ćwiąkalski |
| [TDR-0018](TDR-0018-coordinator-artifact-evidence-and-brief-escalation.md) | TDR | Coordinator Artifact-Evidence Stuck Detection and Owner-Brief Exhaustion Escalation | Proposed | 2026-11-07 | Juliusz Ćwiąkalski |
| [TDR-0019](TDR-0019-dispatch-admission-credential-preflight.md) | TDR | Dispatch Admission Credential Preflight — Pre-Session Refusal, Named Source, Documentation-Only Bridge | Proposed | 2026-11-10 | Juliusz Ćwiąkalski |
| [TDR-0020](TDR-0020-dispatch-divergence-recording-and-resolution.md) | TDR | Dispatch Divergence Recording and Resolution — Delivered-Evidence Divergence (TDR-0015 Amendment) and Local-Evidence-Only Resolve | Proposed | 2026-11-10 | Juliusz Ćwiąkalski |
| [TDR-0021](TDR-0021-additive-optional-harness-environment-marker.md) | TDR | Additive Optional Marker on Declared Harness Environment Variables | Proposed | 2026-11-09 | Juliusz Ćwiąkalski |
| [TDR-0022](TDR-0022-multi-repository-workstation-state-scope.md) | TDR | Multi-Repository Workstation State Scope — Host Root and Project Root Layout, Marker-Minted Project Identity, One App-Tier Policy, and Per-Command Reference-Page Roots | Proposed | 2026-11-11 | Juliusz Ćwiąkalski |
| [TDR-0023](TDR-0023-daemon-lifecycle-mount-and-degradation-composition.md) | TDR | Daemon Lifecycle Mount and Degradation Composition — Entry-Path Re-entry, Signal-Owned Foreground Lifetime, Real Instance Pid, Brand-Derived Install Identity, Durable-State Degradation | Proposed | 2026-11-11 | Juliusz Ćwiąkalski |
| [TDR-0024](TDR-0024-dispatch-attempt-read-side-and-local-evidence-resolve.md) | TDR | Dispatch Attempt Read Side and Local-Evidence Resolve — Closed-Taxonomy Reuse, Empty-History Success, Record-Bounded Projection Cardinality, Unconditional Evidence Mode, One Exact Divergence Count, and Twice-Enforced Repository Scope | Proposed | 2026-11-11 | Juliusz Ćwiąkalski |
| [TDR-0025](TDR-0025-public-event-taxonomy-v1-subscribe-surface.md) | TDR | Public Event Taxonomy v1 for the Daemon Subscribe Surface — Contract-Governed Kind Sets, Per-Lane Sequence Ordering, Preserved Overflow-to-Repoll, Version Pinned by Per-Topic Tests | Proposed | 2026-11-11 | Juliusz Ćwiąkalski |
| [TDR-0026](TDR-0026-queue-lifecycle-removal-single-flight.md) | TDR | Queue Lifecycle Completion — Append-Only Removal Kind with Latest-Record Presence, Admission-Time Per-Ref Single-Flight over Repository-Exclusive Lease Truth, Narrowed Same-Holder Renewal, Non-Cascading Removal, and Tracker-Delivery-State Staleness | Proposed | 2026-11-12 | Juliusz Ćwiąkalski |
| [TDR-0027](TDR-0027-command-failure-envelope-detail-slot.md) | TDR | Command Failure Envelope Detail Slot — One Additive Optional Command-Declared `detail` Object at the Failure-Envelope Root (`detail.holder`), the Shared Six-Field `CommandResultError` Unchanged, `error.detail` Rejected | Proposed | 2026-11-12 | Juliusz Ćwiąkalski |
| [TDR-0028](TDR-0028-no-nomination-classified-admission-refusal.md) | TDR | No-Nomination Dispatch Admission — Classified Refusal Reusing the Provider-Profile Resolve Identities | Proposed | 2026-11-13 | Juliusz Ćwiąkalski |
| [TDR-0029](TDR-0029-event-taxonomy-v2-peak-pause-kinds.md) | TDR | Event Taxonomy v2 — Peak-Pause Kinds Under a New Declared Version with Additive v1 Compatibility | Proposed | 2026-11-13 | Juliusz Ćwiąkalski |
| [TDR-0030](TDR-0030-park-preservation-failure-classification.md) | TDR | Park-Time Session-State Preservation Failure — Park Proceeds with a Named Classification and Budget-Governed Recovery | Proposed | 2026-11-13 | Juliusz Ćwiąkalski |
| [TDR-0031](TDR-0031-engine-first-evaluation-surfaces.md) | TDR | Engine-First Delivery Operations — Evaluation Surfaces, Accrual, and Reversibility | Proposed | 2026-11-17 | Juliusz Ćwiąkalski |
| [TDR-0032](TDR-0032-github-adapter-cli-first-provider-transport.md) | TDR | GitHub Adapter CLI-First Transport — One `ProviderTransport` over `gh api` with a Probe-Gated API Fallback | Proposed | 2026-11-17 | Juliusz Ćwiąkalski |
| [TDR-0033](TDR-0033-github-adapter-completion-contract-extensions.md) | TDR | GitHub Adapter Completion Contract Extensions — `merge-delivery-request`, Pipeline-Job Timings, and a Bounded Log-Excerpt Read | Proposed | 2026-11-17 | Juliusz Ćwiąkalski |
| [TDR-0034](TDR-0034-review-thread-discussion-bodies-bounded-adapter-read.md) | TDR | Review-Thread Discussion Bodies — A Bounded Adapter-Local Read with the Core Contract Left Body-Free | Proposed | 2026-11-17 | Juliusz Ćwiąkalski |
| [TDR-0035](TDR-0035-github-issues-transition-mapping-injected-workflow-map.md) | TDR | GitHub Issues Transition Mapping — The Core `WorkflowMap` as Injected, Seeded Construction Data | Proposed | 2026-11-17 | Juliusz Ćwiąkalski |
| [TDR-0036](TDR-0036-cross-adapter-parity-matrix-declared-difference-register.md) | TDR | Cross-Adapter Parity Matrix, Declared-Difference Register, and the Parity Gate | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0037](TDR-0037-tracker-error-taxonomy-delivered-identities.md) | TDR | Tracker Error Taxonomy — Parity Assertion over Delivered Identities, Not a New Closed Identity Set | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0038](TDR-0038-simulated-stateful-tracker-double-declared-effects.md) | TDR | Simulated Stateful Tracker Double — A Runtime-Neutral In-Memory Tenant with Declared Effects | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0039](TDR-0039-registration-only-adapter-extensibility-proof.md) | TDR | Registration-Only Adapter Extensibility — Five Supplied Items, a Provider-Name-Free Core, and a Synthetic Registration Proof | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0040](TDR-0040-harness-seat-spawn-cardinality-and-seat-resolution.md) | TDR | Harness Seat–Spawn Cardinality and Seat Resolution — One Spawn Binds Exactly One Seat (Agent Identity → `--agent`, Resolved Model → `--model`, N Seats ⇒ N Spawns), No Configuration-Document Carrier, and Seat/Resolved-Model Telemetry Identity Beside the Harness-Reported Agent and Model | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0041](TDR-0041-harness-dispatch-outcome-envelope-detail.md) | TDR | Harness Dispatch-Outcome Disclosure on the Failure-Envelope `detail` Slot — One Declared `harness` Member (`kind`, `observedVersion`, `versionVerdict`, `mode`) on the Four Pre-Session Harness Refusals, Additive Within `delivery.result.v1` | Proposed | 2026-11-17 | Juliusz Ćwiąkalski |
| [TDR-0042](TDR-0042-opencode-integration-mode.md) | TDR | opencode Integration Mode — One Declared Default Selected Never Inferred | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0043](TDR-0043-opencode-harness-adapter-contract.md) | TDR | opencode Harness Adapter Contract — Version Window, Mode, Propagation Reference, and Observed-Store Telemetry | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0044](TDR-0044-install-lifecycle-composed-command-family.md) | TDR | Install Lifecycle Surface — One Composed `install` Family Inside the Prompt-Required Composition | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0045](TDR-0045-self-contained-binary-build-identity.md) | TDR | Self-Contained Artifact and Build Identity — `bun --compile` with `--define`-Injected Identity, Commit in the Delivered Build Slot | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0046](TDR-0046-install-target-stability-and-dev-build-exclusion.md) | TDR | Install-Target Stability Rule and Dev-Build Exclusion | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0047](TDR-0047-installed-binary-state-format-compatibility-check.md) | TDR | Installed-Binary ↔ State-Format Compatibility Check — One Delivered Identifier, Read-Only, Never Blocking | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0048](TDR-0048-upgrade-rollback-uninstall-purge-boundaries.md) | TDR | Upgrade, Rollback, Uninstall and Purge Boundaries | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0049](TDR-0049-dispatch-owned-durable-lane-record.md) | TDR | Dispatch-Owned Durable Lane Record — A Distinct `dispatch.lane` Kind, Acquisition-Time and Terminal Appends, and a Latest-Wins Per-Ref Resume Read | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0050](TDR-0050-dispatch-atomic-admission-verdicts.md) | TDR | Atomic Dispatch Admission — The Verdict Decided Inside the Claim, Declared Queue Verdicts, No Dispatch Renewal, and Repository Exclusivity Untouched | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0051](TDR-0051-harness-terminate-operation.md) | TDR | Harness `terminate` Operation — Capability-Gated Process-Tree Termination with TERM→KILL Inside the Declared Grace and an Exact-Identity Reap | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0052](TDR-0052-in-process-bounded-restart-loop.md) | TDR | In-Process Bounded Restart Loop — Clean Exit Terminal, Stall-Only Restart, One Attempt Record per Terminal Dispatch, and the Delivered `lane.restart-budget` Bound | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0053](TDR-0053-total-derivation-ladder-and-corroboration.md) | TDR | Total Derivation Ladder and Arm-Aware Corroboration — Tracker-Done `merged` First, Artifact `partial`, and the Subsumed Exit-0-No-Artifact `failed` Arm | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0054](TDR-0054-dispatch-spawn-identity-title-and-prompt.md) | TDR | Dispatch Spawn Identity — the `pm` Agent Through the Binding Seam, a Deterministic `ticket-<REF>` Title, and the Lifecycle Prompt as Data | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0055](TDR-0055-phase-truth-registry-fold-mirror.md) | TDR | One Phase Truth Source — Ledger Fold Authority, Fold-Written Mirror, and Detected Divergence | Proposed | 2026-11-18 | Juliusz Ćwiąkalski |
| [TDR-0056](TDR-0056-loop-supervision-as-a-profile-of-the-coordinator-engine.md) | TDR | Loop Supervision as a Profile over the Coordinator Supervision Engine | Proposed | 2026-11-19 | Juliusz Ćwiąkalski |
| [TDR-0057](TDR-0057-durable-loop-stop-as-a-state-ledger-record.md) | TDR | The Durable Loop Stop Is a State-Ledger Record, Not a File | Proposed | 2026-11-19 | Juliusz Ćwiąkalski |
| [TDR-0058](TDR-0058-dispatch-session-output-artifacts-and-transcript-read-seam.md) | TDR | Dispatch Session-Output Artifacts and the Transcript Read Seam — A Bounded Per-Ref Sidecar Family and an Adapter-Owned Read Kept Outside the Closed Operation Set | Proposed | 2026-11-19 | Juliusz Ćwiąkalski |
| [TDR-0059](TDR-0059-budget-ceilings-park-before-spend-injected-spend-totals.md) | TDR | Budget Ceilings — A Pure Evaluator over an Injected Spend-Totals Port, Park on the Sliding Window, Terminal Refusal on the Ticket | Proposed | 2026-11-19 | Juliusz Ćwiąkalski |
| [TDR-0060](TDR-0060-provider-simulate-fixture-and-zero-write-simulation.md) | TDR | `provider simulate` — One Strict Fixture, the Real Pure Engine, and a Zero-Write Guarantee | Proposed | 2026-11-19 | Juliusz Ćwiąkalski |
| [TDR-0061](TDR-0061-legacy-provider-profile-and-hook-migration.md) | TDR | Legacy Provider Migration — A Bounded Declarative Reader, a Validated Proposal, and Typed Refusals | Proposed | 2026-11-19 | Juliusz Ćwiąkalski |
| [TDR-0062](TDR-0062-watch-observation-freshness-and-stale-condition.md) | TDR | Watch Observation Freshness — A Per-Target Bound, a Watch-Only `watch-stale` Condition, and Evidence-Bounded Parks | Proposed | 2026-11-19 | Juliusz Ćwiąkalski |
| [TDR-0063](TDR-0063-provider-family-mounting-27th-prompt-required.md) | TDR | Provider Family Mounting — The Twenty-Eighth and Last Prompt-Required Family, Appended After `loop` | Proposed | 2026-11-19 | Juliusz Ćwiąkalski |
| [TDR-0064](TDR-0064-provider-budget-work-item-ref-source.md) | TDR | Provider Budget Work-Item Ref — A Fact From the Local Delivery Context, Never a Flag, Never a Silent Clear | Proposed | 2026-11-19 | Juliusz Ćwiąkalski |
| [TDR-0071](TDR-0071-merge-change-branch-and-resolved-head-authority.md) | TDR | Change-Branch Resolution from the Change Record and the Delivery Request's Head as the Verified Head | Proposed | 2026-11-20 | Juliusz Ćwiąkalski |
| [TDR-0072](TDR-0072-required-check-authority-and-gate-membership.md) | TDR | Required-Check Authority and Gate Membership — The Shipped Default Enforces the Repository-Declared Expected Job Set on the Resolved Head | Proposed | 2026-11-20 | Juliusz Ćwiąkalski |
| [TDR-0073](TDR-0073-refusal-diagnostics-and-emitted-identity-totality.md) | TDR | Refusal Diagnostics and Emitted-Identity Totality — Named Causes, Three Additive Rows, Row-Level `retryable`, and a Runtime Family Declaration | Proposed | 2026-11-20 | Juliusz Ćwiąkalski |
| [TDR-0074](TDR-0074-project-groups-document-operator-local-overlay.md) | TDR | The Project-Groups Document Is an Operator-Local Overlay — The Ceremony Mirror's Cross-Checkout Target Set Is Declaration-Only | Proposed | 2026-11-21 | Juliusz Ćwiąkalski |
| [TDR-0075](TDR-0075-watch-stale-as-profile-eligibility-blocker.md) | TDR | A Stale Watch Observation Is a Profile-Eligibility Blocker — A Narrowed `watch-stale` Boundary at Zero Acquisition Cost | Proposed | 2026-11-22 | Juliusz Ćwiąkalski |
| [TDR-0076](TDR-0076-engine-ensure-push-first-remote-write.md) | TDR | The Engine-Side Ensure-Push Is the Dispatch Engine's First Remote-Write Act — One Bounded Fast-Forward Push of the Change Branch Before `pr-open` Derives | Proposed | 2026-11-23 | Juliusz Ćwiąkalski |
| [TDR-0077](TDR-0077-dispatch-owned-window-watch.md) | TDR | A Lane Is Watched by the Composition That Owns It: The Dispatch Run Path Supplies the Profile-Window Watch for the Lanes It Starts | Proposed | 2026-11-26 | Juliusz Ćwiąkalski |
| [TDR-0078](TDR-0078-lease-heartbeat-amends-tdr-0050.md) | TDR | A Dispatch Lane Keeps Its Repository Lease Live Through the Run and the Park: The Holding Invocation Renews at a Derived Cadence (TDR-0050 DC-3 Amended) | Proposed | 2026-11-26 | Juliusz Ćwiąkalski |

Decisions TDR-0044 … TDR-0048 are the binding design of change GH-346; their owner
acceptance is that change's pull-request review, and their status moves from
`Proposed` there rather than in the delivery commits.

Decisions TDR-0049 … TDR-0054 are the binding design of change GH-347; their owner
acceptance is that change's pull-request review, and their status moves from
`Proposed` there rather than in the delivery commits.

Decisions ADR-0012, TDR-0055, and ODR-0005 are the binding design of change GH-349;
their owner acceptance is that change's pull-request review, and their status moves
from `Proposed` there rather than in the delivery commits.

Decision TDR-0058 (the dispatch session-output record) is the binding design of
change GH-354; its owner acceptance is that change's pull-request review, and its
status moves from `Proposed` there rather than in the delivery commits.

Decisions TDR-0056 and TDR-0057 are the binding design of change GH-348; their owner
acceptance is that change's pull-request review, and their status moves from
`Proposed` there rather than in the delivery commits.

Decisions ADR-0013, PDR-0006, and TDR-0059 … TDR-0064 are the binding design of
change GH-350; their owner acceptance is that change's pull-request review, and
their status moves from `Proposed` there rather than in the delivery commits.
ADR-0013 is the zone-aware peak-window record (renumbered from ADR-0012 when the
GH-349 merge brought upstream's provider-side landing ADR-0012). TDR-0057 … TDR-0064
were renumbered two places: 0057 … 0062 → 0058 … 0063 when the GH-348 merge brought
its own TDR-0057, then 0058 … 0063 → 0059 … 0064 when the GH-354 merge brought
TDR-0058; TDR-0063 mounts the provider family as the twenty-eighth and last
prompt-required member after GH-348's `loop` (twenty-seventh), and TDR-0064 fixes the
work-item ref the budget gate measures, so the GH-350 specification must carry all of
them before readiness re-review.

Decision TDR-0074 is the binding design of change GH-365's OQ-1; its owner acceptance
is that change's pull-request review, and its status moves from `Proposed` there
rather than in the delivery commits. The project-groups document
(`<repo>/<configDirectoryName>/projects.yaml`, `delivery.projects.groups.v1`) is an
operator-local, git-ignored overlay at its unchanged path and schema, and the ceremony
mirror's cross-checkout target set is declaration-only: it composes from the invoking
checkout's own document, an absent document is the declared empty target set, no
checkout reads another checkout's document, and no tracked template lands in this
change. The three current-truth pages that call the document project-committed are
reconciled in the documentation phase.

Decision TDR-0075 is the binding design of change GH-377's watch-staleness boundary;
its owner acceptance is that change's pull-request review, and its status moves from
`Proposed` there rather than in the delivery commits. It narrows TDR-0062 D2 for
profile selection only: a provider with a declared watch target whose supplied
observation is at or beyond `maxAgeSeconds` is unavailable to profile selection with
the existing watch-only `watch-stale` condition as the blocker, while chain
resolution, the watch read path, the park invariant, and every closed set stay as
delivered, and no fetch, credential read, retained snapshot, cache, timer, or state
write is added.

Decision TDR-0076 is the binding design of change GH-386's DEC-1 (the engine-side
ensure-push); its owner acceptance is that change's pull-request review, and its
status moves from `Proposed` there rather than in the delivery commits. It authorizes
the typed stack's first remote-write operation: at the `pr-open` derivation arm the
engine evaluates the verify-gates parity definition (local checkout head SHA vs the
open delivery request's head SHA, full-hex equality) and, when the local head is
ahead, performs one bounded fast-forward-only push of the change branch to its
configured upstream — fixed argv, literal non-shell child, 60 000 ms injectable
timeout, single attempt, no force variant — before the token derives; a rejected,
failing, or still-unmet push is a typed non-`pr-open` failure through one new
failure-token-mapping row that retains the PR URL, parity evidence rides the bounded
`push:<verdict>` references and an additive optional envelope block, text mode stays
byte-identical, and session-side conventions, the closed vocabularies, and the shell
fallback's behavior are unchanged.

Decisions TDR-0077 and TDR-0078 are the binding design of change GH-413 (peak
pausing for a lane started by dispatch); their owner acceptance is that change's
pull-request review, and their status moves from `Proposed` there rather than in
the delivery commits. TDR-0077 supersedes, for lanes started by `dispatch`, the
statement that without a resident daemon there is no window watcher and no
mid-flight park: a lane is watched by the composition that owns it, the dispatch
run path watches the lane it started at every observation from its first session
to its terminal classification, and a composition that supplies no watch degrades
to the delivered iteration-start gating. It fixes the rule source (the nominated
profile's `peakWindows` branch, read from the nomination stored on the durable
lane record; provider-entry `peak` windows stay admission-only; only a profile
declaring `peakWindows` is pausable and the shipped defaults declare none), the
park end (the effective end of the first open window the delivered decision
returns; overlapping windows yield consecutive exactly-once episodes, never one
merged park), the `lanes` composition-fact read (`peakEnforcement.mode` derives
from the reading composition's own effective configuration: `window-watch` when
automatic pausing is enabled, `iteration-start-gating` when it is disabled; the
one intended change to a no-park payload; `parkClaimed` stays record-derived), and
the operator stop (`dispatch stop <ref>` admits the `peak-window` cause only;
another cause or a missing `--until` is `input.value.rejected` at the grammar
boundary, the missing end reusing the delivered `until-required` reason; a lane is
running only when its newest record is `active`, carries a session identity, and
has no open `peak-window` park, so an already-parked lane is refused and never
parked twice; the command resolves the session identity and the tree root from
the lane record, sends no signal of its own, writes the park only after a
confirmed terminate, and reaches the owning invocation through the durable lane
and park records, the invocation withholding terminal classification for up to
one observation cadence to receive it). A park before the first session is not
part of either record: the specification's DEC-14 is withdrawn, and a dispatch
admitted inside an already-open window is parked at its first observation, a
declared residual of at most one observation cadence. TDR-0078 amends TDR-0050
DC-3 and its restatement in C-4 for the dispatch run path only: the admission
claim still never renews, and the invocation that holds the lease renews it at
most once per renewal cadence, `min(lane.liveness-interval, queue.lease-ttl / 2)`,
through the delivered `renewed` operation, as a no-op unless the lease is this
lane's own same-ref lease and without passing the owner-hold gate, so per-ref
single-flight holds through the run and an hours-long park on every legal
configuration of the two keys.
