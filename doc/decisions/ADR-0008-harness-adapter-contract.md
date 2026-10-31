---
id: ADR-0008
decision_type: adr
status: Proposed
created: 2026-10-31
decision_date: null
last_updated: 2026-10-31
summary: "Harnesses are a provider domain behind the same primitive port surface as trackers, VCS, and CI: HarnessInstance with capability flags, HarnessSession lifecycle (spawn, deliver, resume/steer, collect, classify, harness-agnostic liveness), a one-way sync-verified HarnessPluginSurface, and closeout telemetry extraction; dispatch selects a harness by configuration, capability gaps are declared, and no harness-specific logic lives in engines."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os harness adapters
decision_scope: repo
review_date: null
classification:
  domains: [architecture, ai/ml, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: hard
  stakes: high
  urgency: high
  uncertainty: medium
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-186)"
  decider: "Juliusz Ćwiąkalski (human; acceptance pending at GH-186 PR review)"
  contributors:
    - "@spec-writer (GH-186 spec §5.1 F-2)"
    - "@decision-advisor (analysis and record)"
  reviewers:
    - "@reviewer"
    - "Owner (human acceptance)"
  performers:
    - "@coder (M1-S11 implementation)"
  informed:
    - "M1-S11 harness adapters"
    - "M2-S6 metrics"
    - "M3-S1 harness plugin surfaces"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "M1-S11 cannot express a harness lifecycle (spawn, delivery, resume/steer, collection, classification, liveness) behind the declared session surface without a harness-specific branch in an engine: revisit the port boundary rather than patching the engine."
  - "A second harness cannot declare its capabilities without a port change: revisit the capability-flag model."
  - "The generated harness plugin surface drifts from the canonical source and sync verification cannot detect it: revisit the one-way generation contract."
links:
  related_changes: ["GH-186"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/planning/concepts/harness-adapters.md"
    - "doc/planning/concepts/agent-primitive-surface.md"
    - "doc/spec/features/feature-adapter-ports.md"
  contracts: []
  diagrams: []
  decisions: ["ADR-0003", "ADR-0005", "ADR-0007"]
  experiments: []
  metrics: []
  roadmap_items: ["M1-S11", "M3-S1"]
---

# ADR-0008: Harness Adapter Contract

## Context

- **FACT:** The adapter substrate treats trackers, VCS, and CI as provider domains behind one typed primitive port surface in `@delivery-os/core/contracts`; adapters implement behind those ports and never invent a parallel surface (`feature-adapter-ports.md`, ADR-0003 DEC-6).
- **FACT:** Harnesses (the agent runtimes that execute delivery work) are the remaining provider domain. `doc/planning/concepts/harness-adapters.md` schedules harness primitive ports for M1-S11 and records that dispatch becomes harness-agnostic there; `agent-primitive-surface.md` lists the harness adapter-contract decision as the M0-S17 topic.
- **FACT:** Harness-specific code currently has no durable contract. Without one, each engine that spawns or steers an agent would embed runtime-specific assumptions (opencode, Claude Code), breaking the runtime-neutral core and the provider-agnostic dispatch the concept already requires.
- **FACT:** `doc/planning/oss-tooling/cli-command-registry.md` resolves the deferred `opencode` command rename to `harness`, because the command manages harness integrations generally rather than one runtime.
- **Why now:** The harness surface is consumed by M1-S11 (ports and two delivery adapters), M2-S6 (telemetry extraction), and M3-S1 (plugin surfaces). A contract chosen before those consumers exist is cheap to state and expensive to retrofit after engines embed harness assumptions.
- **Scope of this record:** the port boundary and lifecycle contract only. It does not select a runtime, a transport, or an implementation pattern; those are M1-S11 delivery decisions.

## Problem Framing (Clarified)

The core problem is placement and lifecycle, not runtime selection: where does harness behaviour live so that engines stay harness-agnostic, and what must a harness expose so that spawn, delivery, steering, collection, classification, liveness, and closeout telemetry are uniform across runtimes?

Two failure modes motivate the contract:

1. **Engine-level runtime coupling.** If an engine knows how to spawn or steer one runtime, every engine re-learns it and the runtime-neutral tier erodes.
2. **Implied parity.** If a harness does not declare a capability, consumers assume it supports every operation or silently skip it; both are unsafe.

Desired outcomes: one harness port surface parallel to trackers/VCS/CI; capability gaps declared rather than implied; a session lifecycle that engines drive without runtime branches; a generated plugin surface kept in sync one-way; and closeout telemetry extracted through the same contract.

## Constraints (Hard Requirements)

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | Harness logic lives behind adapters; no engine contains a runtime-specific branch, import, or literal. | ADR-0003 DEC-2 runtime-neutral core; harness-adapters concept | dependency-cruiser boundaries + code review | no |
| C-2 | A harness declares its supported operations, lifecycle capabilities, and liveness method; an unlisted capability is an explicit gap, never implied parity. | feature-adapter-ports capability model | contract/type tests; adapter conformance review | no |
| C-3 | Dispatch selects a harness by configuration, not by a hardcoded runtime name in an engine. | agent-primitive-surface concept; config layer | config-resolution test; dispatch review | no |
| C-4 | The generated plugin surface is produced one-way from the canonical source and verified for drift; hand edits are rejected. | AGENTS.md generated-plugin rule; ADR-0003 DEC-8 naming/regeneration discipline | sync check in CI | no |
| C-5 | Closeout telemetry is extracted through the harness contract and never by engine-side scraping of a runtime's private files. | harness-telemetry concept; M2-S6 scope | telemetry contract review; no private-file reads in engines | no |

> **Table stakes:** all alternatives keep the runtime-neutral core and the existing tracker/VCS/CI ports unchanged; acknowledged once rather than per alternative.

## Decision Drivers

1. **Runtime neutrality of engines** — the strongest constraint: engines must not learn runtime names or file layouts.
2. **Uniform lifecycle across harnesses** — spawn, deliver, resume/steer, collect, classify, and liveness behave the same shape for every runtime.
3. **Explicit capability gaps** — consumers can reason about unsupported operations instead of guessing.
4. **Generated-surface integrity** — the plugin surface cannot drift from the canonical source.
5. **Telemetry reuse** — closeout evidence is extracted once, through the contract, for M2-S6.
6. **Precedent consistency** — harnesses join the same provider-domain pattern as trackers, VCS, and CI.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-186).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance pending at GH-186 PR review. The record remains `Proposed` until then; the AI does not accept it.
- **Contributors:** `@spec-writer` (GH-186 §5.1 F-2), the harness-adapters and agent-primitive-surface concepts.
- **Required reviewers:** `@reviewer`; the owner for acceptance.
- **Performers:** `@coder` in M1-S11 (ports, opencode and Claude Code delivery adapters, telemetry extraction).
- **Informed:** M2-S6, M3-S1, and adapter contributors.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| Harnesses are a provider domain that should reuse the primitive port pattern. | FACT | `harness-adapters.md`; `agent-primitive-surface.md` | A separate harness mechanism would be invented, duplicating the adapter substrate. | High |
| The adapter contract already models capability declarations and explicit gap records. | FACT | `feature-adapter-ports.md` | The capability model would need a new concept rather than reuse. | High |
| M1-S11 is the delivery home for harness ports and two runtimes. | FACT | `agent-primitive-surface.md` story map | The boundary might be designed against the wrong consumers. | High |
| The generated plugin surface can be produced one-way and sync-verified. | FACT | AGENTS.md generated-plugin rule; `feature-claude-plugin-generation.md` | Hand maintenance and drift would become the norm. | High |
| A single session surface can cover resume/steer and liveness across runtimes. | ASSUMPTION | Harness concepts; no implementation yet | M1-S11 might need a runtime-specific extension; revisit trigger recorded. | Medium |
| Closeout telemetry is available through the harness rather than only in runtime-private storage. | ASSUMPTION | `harness-telemetry.md` | M2-S6 could require a documented fallback; the contract still forbids engine-side scraping. | Medium |

## Mental Models & Techniques Used

- **Ports and adapters:** the engine depends on an abstract harness port; each runtime is an adapter behind it.
- **Capability declaration over implied parity:** an unlisted operation is a gap, matching the existing adapter contract.
- **One-way generation:** the canonical source is the only editable surface; generated output is verified, never hand-edited.
- **Inversion:** design from the runtime that lacks a capability — the contract must degrade explicitly, not silently.
- **Second-order thinking:** the contract is shared by spawn, telemetry, and plugin surfaces; choosing it before those consumers exist prevents divergent assumptions.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 engine-neutral | C-2 declared gaps | C-3 config dispatch | C-4 one-way surface | C-5 contract telemetry |
|----------|:---:|:---:|:---:|:---:|:---:|
| ALT-0 no contract | ❌ | ❌ | ❌ | ❌ | ❌ |
| ALT-1 provider-domain ports + session lifecycle + generated surface (selected) | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 harness logic inside each engine | ❌ | ❌ | ✅ | ✅ | ❌ |
| ALT-3 one runtime-specific interface per harness | ✅ | ✅ | ❌ | ❌ | ✅ |

Legend: ✅ passes · ❌ fails.

### Alternative 0 — Do Nothing

- **Eligibility:** Not eligible (fails C-1, C-2, C-3, C-5).
- **Summary:** Leave harness handling to each engine as it is needed.
- **Pros:** No contract work now.
- **Cons:** Engines embed runtime assumptions; capability gaps become silent skips; telemetry is scraped per engine.
- **Why rejected:** It is the defect class the concept schedules M1-S11 to eliminate.

### Alternative 1 — Provider-Domain Ports with a Session Lifecycle and Generated Surface (selected)

- **Eligibility:** Eligible.
- **Summary:** `HarnessInstance` (identity + capability flags), `HarnessSession` (spawn, deliver, resume/steer, collect, classify, harness-agnostic liveness), `HarnessPluginSurface` generated one-way from the canonical source and sync-verified, and closeout telemetry extraction through the contract; dispatch selects a harness by configuration.
- **Constraint compliance:** Passes C-1…C-5.
- **Pros:** One uniform shape; engines stay neutral; gaps are explicit; telemetry is reused.
- **Cons:** One more port family and one more generated-surface check to maintain.
- **Why chosen:** It is the only alternative that satisfies every constraint and reuses the established adapter pattern.

### Alternative 2 — Harness Logic Inside Each Engine

- **Eligibility:** Not eligible (fails C-1, C-2, C-5).
- **Summary:** Each engine spawns and steers its runtime directly.
- **Pros:** Fastest local implementation.
- **Cons:** Runtime coupling spreads; gaps are invisible; telemetry is duplicated.
- **Why rejected:** Directly violates runtime neutrality and the adapter boundary.

### Alternative 3 — One Runtime-Specific Interface per Harness

- **Eligibility:** Not eligible (fails C-3, C-4).
- **Summary:** Expose a different harness interface per runtime and let dispatch choose by name.
- **Pros:** Each runtime can expose exactly its own features.
- **Cons:** Dispatch hardcodes runtimes; engines learn runtime names; the generated surface cannot be uniform.
- **Why rejected:** It reproduces the coupling under a different name.

## Decision

- **Recommendation:** Alternative 1.
- **Authorized Decision:** pending — the owner accepts or adjusts at GH-186 PR review. Until then the record is `Proposed` and grants no authority.

### DC-1 — Harness as a provider domain

Harnesses are a provider domain behind the same primitive port surface as trackers, VCS, and CI. `HarnessInstance` identifies a configured harness and carries capability flags for the operations it supports. An unlisted capability is an explicit gap record, never an implied parity claim, mirroring the adapter capability declaration.

### DC-2 — Session lifecycle

`HarnessSession` is the lifecycle surface engines drive: **spawn** a session, **deliver** work to it, **resume/steer** an existing session, **collect** results, **classify** the outcome, and report **harness-agnostic liveness**. Resume, steering, and liveness are part of the contract, not runtime extensions; an engine never branches on a runtime name.

### DC-3 — Generated plugin surface

`HarnessPluginSurface` is generated one-way from the canonical source and sync-verified. Hand edits to generated output are rejected. This reuses the repository's generated-plugin discipline rather than introducing a second generation mechanism.

### DC-4 — Closeout telemetry extraction

Closeout telemetry is extracted through the harness contract, so M2-S6 consumes one shaped evidence stream instead of scraping runtime-private files. Engine code never reads a runtime's private storage to derive telemetry.

### DC-5 — Configuration-based dispatch

Dispatch selects a harness by configuration (the layered configuration catalog), not by a hardcoded runtime name. Capability gaps are declared by the selected harness and surfaced to the caller; no engine decides which runtime to use.

- **Decider:** Owner (Juliusz Ćwiąkalski) — acceptance pending at GH-186 PR review.
- **Conditions for revisit:** see `revisit_triggers`; the most important is an M1-S11 finding that the single session surface cannot express a required lifecycle step.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-5: harness logic is behind adapters (C-1); capabilities and gaps are declared (C-2); dispatch is configuration-driven (C-3); the plugin surface is one-way and sync-verified (C-4); and closeout telemetry is extracted through the contract (C-5). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- Engines stay runtime-neutral; a new harness is added behind the ports.
- Capability gaps are inspectable instead of silently skipped.
- Spawn, steering, collection, classification, and liveness share one shape.
- Telemetry is extracted once and reused by M2-S6.

### Negative Outcomes

- One more port family and generated-surface check to maintain.
- A runtime with an unusual lifecycle may need a declared capability extension rather than an ad-hoc branch.
- The contract must be implemented before M1-S11 can consume it.

### Unresolved Questions

- [ ] Confirm that one session surface covers resume/steer and liveness for both M1-S11 runtimes (owner: M1-S11 delivery).
- [ ] Confirm the closeout telemetry shape M2-S6 will consume (owner: M2-S6 delivery).

## Implementation Plan

1. M1-S11 implements `HarnessInstance`/`HarnessSession` behind the core contracts for the opencode and Claude Code delivery adapters, with declared capability gaps.
2. Dispatch resolves a harness from configuration; no engine gains a runtime branch.
3. The harness plugin surface is generated from the canonical source and added to the sync check.
4. Closeout telemetry is exposed through the contract and consumed by M2-S6.
5. Doc-sync reconciles `feature-adapter-ports.md` with a pointer to this record and the M1-S11 implementation.

## Verification Criteria

- Metric: engine-level harness-specific branches — Target: 0 — Window: M1-S11 CI and review.
- Metric: declared capability gaps for every unsupported operation — Target: 100% — Window: M1-S11 conformance tests.
- Metric: generated plugin surface drift — Target: 0 — Window: CI sync check.
- Metric: telemetry reads from runtime-private storage inside engines — Target: 0 — Window: M2-S6 review.

## Confidence Rating

**Medium–high.** Placement, capability declaration, and one-way generation follow delivered patterns (ADR-0003, the adapter contract, the generated-plugin rule). The medium component is whether a single session surface expresses resume/steer and liveness for both planned runtimes; that is bounded by the M1-S11 revisit trigger, not by analysis.

## References

- [GH-186 change specification](../changes/2026-10/2026-10-31--GH-186--decision-records-measurement-baseline/chg-GH-186-spec.md) — §5.1 F-2 (record set and one-line decision).
- [Harness adapters concept](../planning/concepts/harness-adapters.md) — provider-domain harness seam and M1-S11 story mapping.
- [Agent primitive surface concept](../planning/concepts/agent-primitive-surface.md) — M0-S17 adapter-contract decision and harness stories.
- [Harness telemetry concept](../planning/concepts/harness-telemetry.md) — closeout evidence extraction.
- [Adapter ports feature spec](../spec/features/feature-adapter-ports.md) — capability/gap declaration and primitive ports.
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — DEC-6 provider-agnostic ports; runtime-neutral core.
- [ADR-0007](ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) — pure-core/injected-I/O placement precedent.
- [ADR-0005](ADR-0005-runtime-confinement-provider-client-subpaths.md) — reviewed I/O-subpath allowance precedent.
