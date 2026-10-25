# Concept: telemetry and event contract

Status: Draft (2026-10-25). Consolidates the event-log decisions from the
backlog (M0-S2, M0-S5, M1 state work, M4-S6) into one contract.

## Summary

Every command emits schema-versioned events into a local-first, append-only
event log. The schema (delivery.event.v1) is cloud-shippable by design: a
hosted sink can consume it later without migration. Local function never
depends on any sink; the sink is opt-in and off by default.

## Motivation

- Observability without ceremony: metrics, spend, retro evidence, and board
  state all derive from one event stream instead of separate collection
  paths.
- Cost and privacy control: events live locally under the state directory;
  nothing leaves the machine unless the operator opts in.
- Cloud-shippable by design: freezing the schema early means hosted
  consumption later needs no migration and no local change.

## Design

- Schema: delivery.event.v1; every event carries the CommandResult runId so
  events join to command executions and to each other; events are typed
  (command lifecycle, phase transition, park, merge, gate result, spawn
  resolution) with bounded payloads.
- Storage: append-only JSONL plus SQLite indexes inside the state directory
  (single-writer, atomic, schema-guarded per the state layer story).
  Retention starts at forever; configurable policies arrive when usage data
  justifies them.
- Emitters: every command emits through one chokepoint that owns redaction;
  embedded metadata and provider payloads never enter events unredacted.
- Consumers (local): metrics and spend aggregation, retro evidence passes,
  board and status enrichments, park and provider diagnostics.
- Sink (opt-in, M4-S6): an outbound sink pushes the event stream to a
  configured endpoint; off by default; capability-flagged; the local factory
  is fully functional with no sink configured. The hosted product consumes
  the same open format; no local capability depends on it.

## Guardrails

- Schema changes are versioned; breaking changes create a new version with
  a documented read window, never an in-place rewrite.
- No secrets, tokens, or private identifiers in events; the privacy guard
  scans the emitter and the storage.
- The event log is an implementation detail behind the state abstraction;
  consumers never parse JSONL files directly.

## Story mapping

- M0-S2: schema definition and the neutral namespace from the branding
  module.
- M0-S5: storage mechanics (JSONL plus indexes, single-writer, atomic).
- M1: schema v1 frozen so later hosted ingestion never migrates.
- M2-S6: metrics and spend consume the stream.
- M4-S6: opt-in sink hooks and workspace configuration.

## Open questions

- Event retention policy shape (per-level configuration arriving after
  real-world usage data exists).
- Sampling or volume guards for high-frequency spawns.
