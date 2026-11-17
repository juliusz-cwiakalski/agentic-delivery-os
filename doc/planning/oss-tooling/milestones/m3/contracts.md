# M3 contracts: adapter and harness ports (planned)

Each contract below is a proposal refined at story delivery. The lifecycle
contract and result envelope stay unchanged; M3 only makes their sources
pluggable.

## HarnessPort (extended)

- `spawn(request) -> session`: request carries agent, prompt, model profile
  resolution, working directory, mode (standalone|service), and timeout policy.
- `resume(sessionRef, prompt) -> session`
- `telemetry(sessionRef) -> TelemetryRow[]`: versioned; per-seat model,
  tokens, cost, timings.
- `capabilities() -> CapabilitySet`

Typed refusals: `harness.version.unsupported`, `harness.mode.unavailable`,
`harness.telemetry.absent`.

## TrackerPort (primitives)

- `workItem.read(ref)`, `workItem.update(ref, patch)`
- `comment.add(ref, body)`, `transition(ref, state)`
- `review.create(request)`, `review.update(request)`, `review.merge(request)`
- `checks.status(ref)`
- `capabilities() -> CapabilityMatrix`

Typed refusals: `tracker.capability.unsupported`,
`tracker.transport.failed`, `tracker.auth.rejected`,
`tracker.payload.invalid`.

## Conformance

- The parity suite runs every primitive against every adapter (or its
  simulated double) and fails on undeclared differences.
- Trap catalogs extend to tracker errors: rate limits, auth shapes, pagination
  truncation, workflow-state mismatches.
