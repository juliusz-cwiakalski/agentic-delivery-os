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
| ODR-0001 | ODR | Classify doc/templates/*.yaml register templates as redistributable | Accepted | 2026-06-25 | Juliusz Ćwiąkalski |
| PDR-0001 | PDR | Tribal Knowledge Extraction Taxonomy | Accepted | 2026-06-27 | Juliusz Ćwiąkalski |
| PDR-0002 | PDR | Mode-Aware Spec-Coverage Resolution for Autonomous Delivery | Proposed | 2026-07-02 | Juliusz Ćwiąkalski |
| [PDR-0003](PDR-0003-owner-gate-sla-default-map.md) | PDR | Owner-Gate SLA Initial Default Map | Proposed | 2026-11-06 | Juliusz Ćwiąkalski |
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
