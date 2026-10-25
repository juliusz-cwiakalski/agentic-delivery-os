# Design concepts

Design-level intentions for the OSS tooling. A concept records the motivation,
design, guardrails, and story mapping for one architectural aspect. Concepts
are not normative specifications; they mature into decision records and
stories.

## Concept lifecycle

| Status | Meaning |
|---|---|
| Draft | Under discussion; content may change on this branch |
| Accepted | Ratified by a decision record (ADR/PDR/TDR); stories may reference it |
| Implemented | Delivered by the mapped stories; the concept doc then describes current behavior |

Transitions: Draft to Accepted happens through the decision-record flow
(most concepts here land in the M0-S17 adapter-contract and naming decision
records). Accepted to Implemented happens through the normal delivery
lifecycle; the concept doc links the delivered work.

## Index

| Concept | Status | One-line summary |
|---|---|---|
| [agent-primitive-surface.md](agent-primitive-surface.md) | Draft | Agents speak ADOS primitives only; adapters translate; policy layer and audited escape hatch guard the boundary |
| [primitive-catalogue.md](primitive-catalogue.md) | Draft | The catalogue of primitives with a Planned, Typed, Delivered lifecycle; the load-bearing set, dependency graph, and change discipline |
| [embedded-metadata.md](embedded-metadata.md) | Draft | Provider artifacts carry versioned ADOS metadata; the adapter writes, parses, and strips it; agents see only the primitive view |
| [adapter-conformance.md](adapter-conformance.md) | Draft | One flow suite in primitives, run against every adapter; mock in CI plus scheduled live runs; green gates adapter changes |
| [naming-and-branding-seam.md](naming-and-branding-seam.md) | Draft | One branding constant derives every name-derived value; command names locked before M0 ends; rename drill rehearsed |
| [telemetry-and-events.md](telemetry-and-events.md) | Draft | Schema-versioned local-first event log; exportable by design; opt-in sink that never gates local function |
| [model-profiles.md](model-profiles.md) | Draft | The AI provider family: agent-to-model profiles in difficulty classes (lite, regular, powerful); coordinator proposes, lifecycle cross-validates, delivery selects |
| [harness-adapters.md](harness-adapters.md) | Draft | Agent runtimes as a provider domain: dispatch delivers through harness adapters (opencode default, Claude Code supported) and the tooling ships as a generated plugin per harness |
| [harness-telemetry.md](harness-telemetry.md) | Draft | Read-only extraction of session statistics from harness stores (tokens by class, calls, tool usage) into the durable event log at closeout; cross-harness by construction |

## Related documents

- Planning docs: [../oss-tooling/README.md](../oss-tooling/README.md)
- Structure decision: [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md)
- Story backlog: [../oss-tooling/backlog.md](../oss-tooling/backlog.md)
