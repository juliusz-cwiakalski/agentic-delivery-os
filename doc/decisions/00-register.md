---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/decisions/00-register.md
ados_distribution: project-generated
id: DECISION-REGISTER
status: Current
created: 2026-10-31
last_updated: 2026-10-31
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os decision substrate
links:
  related_changes: ["GH-186"]
  decisions: ["ADR-0003", "ADR-0005", "ADR-0007", "ADR-0008", "ADR-0009", "ODR-0002", "ODR-0003", "TDR-0003", "TDR-0004"]
summary: "A binding projection that maps each M0-S17 foundational topic to the record(s) and anchor(s) that decide it. It carries no decision text."
---

# Foundational Decision Binding Register

> **Role of this document:** a projection, not a decision record. It tells a reader **which record decides a topic** and **where to read it**. It does not restate a decision, carry argument, or replace a record.

## Bindings

| Topic | Binding record(s) | Anchor(s) | Status | Binding note |
|---|---|---|---|---|
| Layout / monorepo structure | [ADR-0003](ADR-0003-oss-monorepo-structure.md) | `DEC-1`, `DEC-2`, `DEC-7` | Accepted | Root `packages/` six-package layout, tier/dependency rules, and coexistence with the legacy layout. |
| Config precedence | [ADR-0003](ADR-0003-oss-monorepo-structure.md) + [TDR-0003](TDR-0003-config-parser-schema-and-acquisition.md) | `DEC-4`; TDR-0003 §Decision | Accepted (ADR-0003); Proposed (TDR-0003) | Layered configuration levels and precedence; parser/schema/acquisition mechanics. |
| Provider adapter contract | [ADR-0003](ADR-0003-oss-monorepo-structure.md) + [ADR-0005](ADR-0005-runtime-confinement-provider-client-subpaths.md) + [ADR-0007](ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) | `DEC-6`; ADR-0005 §Decision; ADR-0007 `DC-1`…`DC-5` | Accepted (ADR-0003); Proposed (ADR-0005, ADR-0007) | Provider-agnostic primitive ports; runtime-API confinement for provider client subpaths; provider-engine placement, fail-loud semantics, parks, and cost policy. |
| Harness adapter contract | [ADR-0008](ADR-0008-harness-adapter-contract.md) | §Decision (`DC-1`…`DC-5`) | Proposed | Harness provider domain, session lifecycle, generated plugin surface, closeout telemetry, configuration dispatch. |
| State schema | [ADR-0003](ADR-0003-oss-monorepo-structure.md) + [TDR-0004](TDR-0004-state-storage-engine.md) | `DEC-5`; TDR-0004 §Decision | Accepted (ADR-0003); Proposed (TDR-0004) | Local-first JSONL plus SQLite indexes; the state storage engine. |
| Release model | [ADR-0003](ADR-0003-oss-monorepo-structure.md) + [ADR-0009](ADR-0009-release-model-v1.md) | `DEC-3` (versioning and release bullets); ADR-0009 §Decision | Accepted (ADR-0003); Proposed (ADR-0009) | The lockstep release direction and its v1 lock; M4-S2 elaborates automation. |
| ID prefix scheme | [ODR-0002](ODR-0002-id-prefix-scheme-and-project-catalog.md) + [id-prefix-catalog.md](../planning/concepts/id-prefix-catalog.md) | ODR-0002 §Decision; catalog §ADOS base registry and §Customization model | Proposed | Adopted base registry and project catalog (per-type decision ranges, `MET-` allocator). |
| Command naming convention | [ODR-0003](ODR-0003-cli-command-naming-v1-lock.md) + [cli-command-registry.md](../planning/oss-tooling/cli-command-registry.md) | ODR-0003 §Decision; registry §Naming audit | Proposed | The prospective v1 command-name lock and its confirmations. |

## Status and acceptance

- Record statuses mirror the linked records. [ADR-0003](ADR-0003-oss-monorepo-structure.md) is `Accepted`; [ADR-0005](ADR-0005-runtime-confinement-provider-client-subpaths.md), [ADR-0007](ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md), [TDR-0003](TDR-0003-config-parser-schema-and-acquisition.md), [TDR-0004](TDR-0004-state-storage-engine.md), [ADR-0008](ADR-0008-harness-adapter-contract.md), [ADR-0009](ADR-0009-release-model-v1.md), [ODR-0002](ODR-0002-id-prefix-scheme-and-project-catalog.md), and [ODR-0003](ODR-0003-cli-command-naming-v1-lock.md) are `Proposed`.
- Owner acceptance of the four records authored in GH-186 (ADR-0008, ADR-0009, ODR-0002, ODR-0003) is **pending at the GH-186 PR review**. Merge does not auto-accept a record.

## Update rule

When a binding record is superseded, replace its row entry with the successor record and anchor. The register never renumbers a record, never restates a decision, and never becomes a second decision store. A topic row is added only when a new foundational topic needs a binding.

## References

- [Decision Records Index](00-index.md) — the record inventory.
- [Decision Records](README.md) — directory overview.
- [Decision-Making Guide](../guides/decision-making.md) — process and rigor.
- [Decision Records Management Guide](../guides/decision-records-management.md) — record-artifact standard.
