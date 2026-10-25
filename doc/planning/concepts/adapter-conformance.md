# Concept: adapter conformance suites

Status: Draft (2026-10-25). Feeds the adapter-contract decision record
scheduled in M0-S17.

## Summary

One end-to-end flow suite defined once in ADOS primitives, executed against
every adapter we support. Tests talk only in primitives and assert only
observable primitive-level behavior. Conformance green gates every adapter
change, and scheduled live-API runs catch provider drift before it bites a
delivery.

## Motivation

- Provider APIs change without notice. Integration breakage is silent until
  a delivery depends on it. Primitive-level flow tests catch semantic
  breakage regardless of internal implementation.
- Trap knowledge (label replace semantics, merge status codes, squash commit
  reporting, comment omission) already lives as unit tests; a conformance
  suite generalizes that into full-flow guarantees.
- Asserting behavior in primitive terms makes the test suite the executable
  contract of the adapter, independent of the provider SDK.

## Design

- The suite lives in the private testkit package. Each flow is written once
  against the primitive ports and parameterized by adapter. Core flows:
  - Change lifecycle start to closeout (create, plan, transition, comment,
    label, deliver, merge, close out).
  - Comment provenance roundtrip: create a comment via the CLI from a
    specific agent identity, read it back through the tooling, and assert
    the primitive view including metadata-derived fields (see
    embedded-metadata.md) - never the raw carrier.
  - Label semantics: replace and sweep behavior normalized across providers.
  - Transition mapping: every ADOS state maps to the provider state machine
    and back.
  - Delivery request: create, update, review state, squash merge, merge
    status including known quirks.
  - Pipeline reads per pushed commit and deploy verification by job trace.
  - Comment omission and pagination edge cases from the trap catalogs.
- Tiers:
  - Mock and sandbox conformance in CI on every adapter-changing PR: fast,
    deterministic, no external credentials.
  - Scheduled live-API conformance (weekly plus before releases) against
    real tenants to catch API drift.
  - Trap catalogs remain unit-level tests inside each adapter.
- Test tenants: scratch repositories on GitHub and GitLab plus a Jira
  sandbox. Rules: stable artifact prefixes, strict teardown, idempotent
  re-runs, credentials injected via the adapter (or the adapter service),
  never present in agent or test code.
- Gate: an adapter change merges only with conformance green; a scheduled
  live failure opens a tracker ticket automatically.

## Guardrails

- Flows are written once; adapter-specific test code is limited to fixtures
  and environment setup.
- A conformance failure is a blocker, never a warning; waivers require a
  decision record.
- The suite grows with every provider incident: an escaped integration
  defect adds a flow, not a prompt note.

## Story mapping

- M0-S12: conformance suite v1 (change lifecycle, comment roundtrip, label
  semantics) plus test tenants and CI wiring.
- M1-S4: merge, deploy trace, and pipeline flows join the suite.
- M3-S3: full matrix green for GitHub and Azure alongside GitLab and Jira.

## Open questions

- Tenant provisioning automation versus manual sandbox maintenance.
- Cost and rate-budget policy for scheduled live runs.
