# Concept: embedded ADOS metadata envelope

Status: Draft (2026-10-25). Feeds the adapter-contract decision record
scheduled in M0-S17.

## Summary

Facts that the provider has no field for (which agent made a comment and
under whose operator authority, delivery linkage, run and fence identifiers)
are carried in versioned ADOS metadata embedded inside provider artifacts.
The adapter writes, parses, and strips the envelope. Agents see only the
primitive view and never the raw carrier.

## Motivation

- Provenance: the gate battery must classify agent-made comments made under
  the operator account. Today that classification is heuristic (account
  identity); embedded metadata makes it structural and reliable.
- Coverage gaps: providers lack fields for ADOS facts. Embedded metadata
  fills the gaps without forcing a union meta-model of all provider features
  into the primitive set.
- Uniform semantics: the same ADOS fact reads the same way on every
  provider, because the adapter normalizes the carrier.

## Design

- Carrier is adapter-chosen, driven by capability flags:
  - HTML comment block (for example `<!-- ados:meta {...} -->`) where the
    provider renders it invisibly (GitHub, GitLab).
  - A custom field where the provider supports one (Jira instances with
    available custom fields).
  - A compact marker block as the fallback where neither works.
- Envelope: `schemaVersion`, `kind`, payload; compact JSON; no secrets, ever
  (the redaction chokepoint and the privacy guard both cover it).
- Write path is adapter-only. Agents construct primitives (for example
  "comment with provenance X"); the adapter serializes the envelope into the
  carrier. On read, the adapter parses and strips, returning the primitive
  view with metadata-derived fields attached. The audited escape hatch
  (agent-primitive-surface.md) is the only raw window.
- Graceful degradation: missing or malformed metadata (a human edited the
  comment, a provider mangled the carrier) falls back to account-based
  heuristics; the flow never fails because metadata is unreadable, but the
  degradation is visible.
- One source of truth per fact: provider-side metadata records provider-side
  facts (provenance, authority, delivery linkage). The local event log
  remains the process ledger. The decision record must state the sync rule
  explicitly so the two never drift.
- Schema evolution: `schemaVersion` on every envelope; adapters read older
  versions forward-compatibly within a documented window.

## Guardrails

- The metadata must stay small and quiet: it renders invisibly or occupies
  an invisible field, and it never displaces human-readable content.
- Agents never write raw carriers; any tooling that edits provider artifacts
  outside the adapter is a policy violation surfaced by status.
- No private identifiers inside metadata that could leak through a public
  provider; the privacy guard scans for this.

## Story mapping

- M0-S12: metadata envelope v1 (comments and provenance) plus capability
  flags for carriers.
- M0-S9: verify gates consumes provenance from metadata with heuristic
  fallback.
- M0-S15: privacy guard extension: no secrets and no private identifiers in
  embedded metadata.

## Open questions

- Retention and cleanup of metadata on artifacts after closeout (strip,
  leave, or tombstone).
- Whether delivery linkage metadata should also mirror into the local event
  log for cross-provider joins.
