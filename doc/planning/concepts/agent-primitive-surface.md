# Concept: agent primitive surface (provider-agnostic adapters)

Status: Draft (2026-10-25). Feeds the adapter-contract decision record
scheduled in M0-S17.

## Summary

All agents, engines, and surfaces interact with trackers, VCS hosts, and CI
exclusively through ADOS primitives. Adapters translate primitives into
provider APIs. Agents never hold provider dialect: no `gh` commands, no Jira
semantics, no GitLab quirks in any agent-facing prompt or tool.

## Motivation

- Token economics: platform playbooks (tracker instructions, PR instructions,
  trap knowledge) repeat in every tracker-touching session and are re-read
  constantly. Replacing them with a stable primitive reference is a permanent
  reduction, and it removes the retry loops after API misuse, which cost
  more than the instructions themselves.
- Determinism: the most damaging incidents come from agents hand-rolling
  platform calls. Provider quirks (label replace semantics, merge status
  codes, squash commit reporting, comment omission) belong in tested adapter
  code, not in probabilistic prompt knowledge.
- Composition: engines such as closeout, verify gates, board, and ceremony
  are compositions of reads and writes. Without typed ports, every engine
  needs an N-provider matrix; with ports, engines are provider-blind and the
  MCP server exposes one stable tool set.
- Portability: GitLab and Jira first, GitHub and Azure next; every new
  provider is one adapter, not a fleet of prompt edits.

## Alternatives considered

Alternative A: direct provider tooling. Agents call the provider CLIs and
APIs (`gh`, `glab`, Jira APIs) directly, guided by per-provider playbooks in
prompts. Rejected as the default because:

- Every tracker-touching session re-reads provider playbooks; token cost is
  permanent and multiplied per session, per agent.
- Provider knowledge in prompts is probabilistic: the documented incident
  classes (label replace semantics, merge status quirks, squash commit
  reporting, comment omission) are exactly the kind of knowledge an LLM
  misapplies under delivery pressure, and each misuse costs a correction
  loop.
- Without ports, every composed engine (closeout, gates, board, ceremony)
  needs an N-provider matrix, so composition either does not happen or
  forks per provider.
- Per-provider skills and playbooks drift independently: the zoo-of-skills
  problem, where behavior differs per provider and per prompt revision.

Where direct use remains legitimate: humans at a terminal, the bash delivery
stack until its retirement, and the audited escape hatch. The escape hatch is
the controlled valve for the residual cases; it is never the default path in
agent prompts.

Alternative B: a universal tracker/VCS meta-model. Model every provider
feature (custom fields, sprints, projects, weight, iterations, check runs)
in one union API. Rejected because it recreates the complexity it removes:
the meta-model churns with every provider feature change, drags provider
concepts back into agent cognition, and still fails on gaps no provider has.

Chosen: a domain-modeled primitive set (the delivery domain verbs only,
catalogued in primitive-catalogue.md) behind typed ports, with capability
flags declaring gaps, embedded metadata filling provider gaps (embedded-
metadata.md), and conformance suites guarding drift (adapter-conformance.md).

## Design

- Primitives model the delivery domain, not platform feature matrices. The
  full set, with ids, invariants, and the Planned, Typed, Delivered
  lifecycle, is catalogued in [primitive-catalogue.md](primitive-catalogue.md).
  The set is derived bottom-up from the engine inventory, not top-down from
  feature lists.
- Primitive port types live in core `./contracts`; adapters implement them;
  the createRuntime composition root wires them (ADR-0003).
- Capability flags: each adapter declares what it supports. Engines degrade
  loudly and visibly (status reports the degradation) instead of failing or
  pretending.
- Policy layer: a role-to-primitive mapping enforced at the port boundary
  (for example: the lifecycle agent may transition tickets; the coder may
  not write the tracker; the raw escape hatch is capability-gated). The
  policy cannot be prompt-bypassed because it is not in the prompt.
- Escape hatch: an explicit raw passthrough to the provider exists, is off
  by default, is capability-gated in configuration, and every use is logged
  and surfaced by status as a degradation. Provider-specific power remains
  available to humans and to the bash stack until retirement.
- One primitive surface: MCP tools and any adapter service expose the same
  contract. No second API.
- Deployment modes:
  - In-process adapter library (default): zero-install, wired by
    createRuntime; the policy layer still applies.
  - Long-running containerized adapter service (isolation upgrade): holds
    authentication internally so tokens never enter agent context; grants
    per-role access; reached over a local socket with a token locally and
    mutual TLS for remote use. Same primitive contract and same policy layer
    as in-process mode. Intended for fleet and shared-host deployments and
    later the hosted relay.

## Guardrails

- Avoid the lowest-common-denominator trap by modeling the delivery domain,
  never by building a union meta-model of provider features. Gaps are filled
  by embedded metadata (see embedded-metadata.md), not by provider leakage.
- Avoid silent escape hatches: audited, off by default, surfaced as
  degradation.
- The policy layer exists for every deployment mode; containerization is an
  isolation upgrade, not the security model itself.

## Story mapping

- M0-S3: primitive port types in core contracts.
- M0-S12: primitive ports v1 with capability flags; GitLab, Jira, and a
  minimal GitHub read slice behind them.
- M1-S7: MCP mirrors proven primitives.
- M3-S1: opencode permission profiles align with the policy layer.
- M3-S3: adapter completion (full GitHub, Azure on demand).
- M0-S17: adapter-contract decision record.

New story candidates (not yet in the backlog): adapter policy layer v1
(role-to-primitive mapping with tests); containerized adapter service.

## Open questions

- The unified primitive term for PR/MR (keep `pr`, or a domain term such as
  delivery request); lock with the command-name lock in M0-S17.
- Minimum capability floor an adapter must meet to be supported at all.
