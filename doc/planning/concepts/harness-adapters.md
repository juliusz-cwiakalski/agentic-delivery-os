---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/harness-adapters.md
---
# Concept: harness adapters (agent runtimes as a provider domain)

Status: Draft (2026-10-25). Feeds the adapter-contract decision record
scheduled in M0-S17. Companion to agent-primitive-surface.md: harnesses are
a provider domain like trackers, VCS hosts, and CI.

## Summary

Agent harnesses (the runtimes that execute delivery sessions) are behind the
same primitive surface as every other provider. The abstraction is two-fold:

1. Delivery side: dispatch spawns, resumes, supervises, and collects results
   from a delivery session through a harness adapter. Today the bash
   delivery stack does this for one harness (opencode); the adapter makes it
   harness-agnostic.
2. Plugin side: the tooling ships as a plugin for each harness (commands,
   agents, MCP wiring), generated from one canonical source with sync
   verification. Today the repository generates the opencode definitions and
   a Claude Code plugin from the same source and verifies sync in CI.

Supported at the start: opencode (default) and Claude Code. Candidate for
later evaluation: pi.dev (reported as highly extensible; may fit high
customization even better; evaluation spike before any commitment).

## Motivation

- Model access: Claude Code unlocks Anthropic subscription models that
  other harnesses cannot use; supporting it keeps the provider family free
  to route to the best available model per profile
  (model-profiles.md).
- One delivery process, many runtimes: the delivery lifecycle contract
  (phases, ledger, result taxonomy) must not depend on which harness
  executes the session.
- Plugin reach: exposing the tooling inside each harness multiplies every
  engine into every agent session on that harness, without forking
  definitions per harness.
- Single source of truth: agent and command definitions already live in one
  canonical place; per-harness artifacts are generated and verified, never
  hand-edited (the existing plugin generation pattern, generalized).

## Design

- Harness primitives (catalogued in primitive-catalogue.md):
  - HarnessInstance: a configured harness with version and capability flags
    (opencode, claude-code, pi.dev later).
  - HarnessSession: spawn a delivery session, deliver the prompt, resume
    with steering, collect the result, classify premature end; liveness
    signals stay harness-agnostic (session traffic, worktree activity,
    process).
  - HarnessPluginSurface: the per-harness package format for exposing the
    tooling (commands, agents, MCP wiring), generated from the canonical
    source, sync-verified in CI.
  - Harness telemetry extraction: read-only extraction of session
    statistics from each harness's local stores into the event log at
    closeout (tokens by class, calls, tool usage, per agent and model,
    session-tree attribution); see
    [harness-telemetry.md](harness-telemetry.md).
- Dispatch consumes a harness adapter instead of calling a harness
  directly; the harness choice is configuration, not code.
- Capability flags per harness: what the harness supports (headless spawn,
  resume injection, session introspection, permission profiles, plugin
  format) is declared, and degradation is visible, per the primitive
  surface rules.
- The escape hatch rules apply: an agent never scripts a harness's CLI
  directly; raw harness access is audited and off by default.
- Plugin generation is one-way: canonical source in, generated artifacts
  out; hand edits to generated artifacts are a policy violation surfaced by
  verification.

## Guardrails

- The delivery contract is harness-agnostic: result classification, the
  phase ledger, and artifact postconditions are identical regardless of the
  executing harness.
- No harness-specific logic in engines; harness knowledge lives only in
  adapters.
- A new harness is a new adapter plus a plugin generator, not a fork of the
  delivery process.
- pi.dev (and any further harness) enters through an evaluation spike
  against the primitive contract, never by special-casing.

## Story mapping

- M0-S17: the adapter-contract decision record covers harnesses alongside
  providers.
- M1-S11 (new): harness primitive ports, the opencode delivery adapter
  (porting today's bash spawn and liveness handling), the Claude Code
  delivery adapter (headless spawn), dispatch made harness-agnostic, and
  telemetry extraction into the event log at closeout
  (harness-telemetry.md).
- M3-S1: harness surfaces: the plugin side for opencode and Claude Code,
  generated from the canonical source, sync-verified; pi.dev evaluation
  spike.
- Existing seeds: the bash delivery stack (delivery side, opencode only)
  and the generated plugin pipeline (plugin side) are the strangler
  starting points.

## Open questions

- Claude Code delivery parity: which supervision and liveness signals are
  available headless, and what degrades.
- pi.dev evaluation criteria and timing (spike, not commitment).
- Whether the plugin surface for a new harness is always generated from the
  canonical source, or a harness's native format ever becomes canonical
  (default: never).
