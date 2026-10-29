---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/harness-telemetry.md
---
# Concept: harness telemetry extraction and persistence

Status: Draft (2026-10-25). Feeds the adapter-contract decision record
(M0-S17). Companion to harness-adapters.md (the extraction capability) and
telemetry-and-events.md (the persistence target).

## Summary

Delivery sessions leave their cost and behavior traces inside harness-local
stores (the opencode session database; Claude Code's local session files).
Harness adapters extract these statistics read-only at capture points,
primarily closeout, and emit them into the local event log as durable,
queryable events. Retrospectives, metrics, and spend then read the event
log, not the harness stores, which are prunable.

A single workspace may run deliveries on multiple harnesses at once (for
example, one provider family through opencode and Anthropic models through
Claude Code, selected per model profile). Telemetry events carry the
harness instance so aggregation is cross-harness by construction.

## Motivation

- The bash-era analyzers proved the value: per-delivery token accounting
  (session trees attributed to work items), windowed per-agent and per-day
  burn reports, and agents-by-model breakdowns are the backbone of cost
  observability and retrospective evidence.
- Harness stores are volatile: session databases get pruned by the admin
  tooling. Statistics not captured at closeout are lost to retrospectives.
- Re-querying harness stores at retro time is slow, schema-dependent, and
  repeated; capturing once at closeout makes the data durable and cheap to
  consume.
- Multi-harness routing (model profiles per harness) means cost and
  behavior evidence lives in several stores; the event log is the one place
  it comes together.

## Design

- Extraction capability per harness adapter (capability-flagged):
  - opencode: read-only access to the session database (SQLite read-only
    mode plus query-only pragma; never writes), session-tree aggregation
    via parent recursion, correlation of tree roots to work-item refs.
  - Claude Code: read-only parsing of local session files (transcripts and
    usage records) with the same attribution model.
  - pi.dev: extraction requirements evaluated in the harness spike.
- Captured statistics (per session, per agent, per model, per day):
  - Token classes: input, output, reasoning, cache read, cache write.
  - Call counts and tool usage (which tools, how often, per agent).
  - Session metadata: tree root, parent chain, work-item correlation,
    harness version, model.
- Capture points: closeout is the primary point (the delivery is complete
  and the numbers are final); session end and phase boundaries are later
  refinements. Events reference the run and work item so they join to
  delivery outcomes, gate results, and phases.
- Event log: statistics land as schema-versioned telemetry events (see
  telemetry-and-events.md); the SpendRecord primitive is their
  typed projection. Retention follows the event log policy (forever
  initially).
- Schema drift discipline (proven in the bash era): pin observed harness
  versions; optional fields degrade with warnings, never hard-fail; bounded
  queries only (indexed filters, no full scans of message tables); the
  analyzer never depends on optional columns.
- Reply contract: extraction is mechanical and produces compact digests
  plus machine output; agents never paste raw tables into context, and
  never query harness stores directly (the escape hatch rules of the
  primitive surface apply).

## Guardrails

- Read-only toward harness stores, always; extraction never mutates or
  locks a live session.
- Events are the durable record; harness stores are transient sources.
  Nothing retro-critical depends on a store still existing.
- Per-harness quirks live in adapters; the event schema is harness-neutral
  so metrics and retrospectives aggregate without per-harness branches.
- Cost figures degrade, never fabricate: missing cost data renders null
  with a warning instead of estimating silently.

## Story mapping

- M1-S11: harness adapters ship with the extraction capability (opencode
  first, Claude Code with its adapter) and closeout captures the events.
- M1-S8: the retro pipeline consumes persisted telemetry events instead of
  re-querying harness stores.
- M2-S6: metrics and spend aggregate the events cross-harness.
- M3: spend records become native per-dispatch joins (SpendRecord typed).

## Open questions

- Capture granularity beyond closeout (phase boundaries, session end) and
  the storage cost of each.
- Whether tool-usage detail belongs in events at full fidelity or as
  pre-aggregated counts per session.
- Claude Code local-file schema stability and the drift-handling contract
  for it.
