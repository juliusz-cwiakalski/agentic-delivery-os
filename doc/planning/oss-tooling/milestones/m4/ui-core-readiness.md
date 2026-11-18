# UI core-readiness assessment

Status: assessment and future-proofing constraints for the delivery work.
Source input: the UI vision and capability inventory (local working document).
Owner of record: CEO agent under user-delegated autonomous authority.

## Purpose and boundary

The commercial UI is not being built here. This document answers one question:
**does the open-source core preserve what a later UI, sidecar, or cloud control
plane must be able to observe and do?** It records gaps, the low-cost
future-proofing that rides the existing delivery work, and what stays out of
scope.

The UI is expected to consume the core through the CLI, machine-readable
streams, and a sidecar adapter that talks to the local service over its socket.
It must not need to scrape files, shell out to scripts, or infer identity from
machine names.

## Assessment against the capability inventory

| Capability | State today | Assessment |
|---|---|---|
| Cross-project portfolio selection | Projects contract exists (`packages/core/src/contracts/projects.ts`); no cross-project read surface | Partial - M4-S5 adds project-scoped views; S13 adds runner attribution |
| Priority order and why | Queue, leases, attempts, and dispatch admission exist; priority-change history is not retained | Partial - record queue plan snapshots and reasons with timestamps |
| Timeline, planned vs actual | Ledger events and phase records carry timestamps; scheduling intent is not persisted separately | Partial - M4-S6 must separate planned from observed |
| Ticket versus repository work | A project maps to a workspace; a work item spanning several repositories is not representable | **Gap** - project model must allow multiple repositories per project |
| Provider, quota, usage over time | `provider resolve|quota|parks|watch` and `spend` exist; telemetry in flight (M3-S1); no retained timeline | Partial - F2 plus retention in M4-S6 |
| Tracker deep links | Adapters own issue identity; no navigable URL projection on work items | **Gap (cheap)** - add an external URL to the work-item projection |
| Issue browser | Tracker read adapters exist | UI-side; no core gap beyond URL and links |
| Sprints and milestones | Milestones used in this repository; no generic iteration mapping | Partial - optional mapping in project config |
| Delivery analytics | Spend, metrics, telemetry (M3-S1) | Partial - retention and correlation in M4-S6 |
| CI run and wait analysis | Platform adapters read checks and pipelines | Partial - store run id, attempt, timestamps, conclusion |
| Question inbox | `blockers list|answer` exists; cross-project durability unverified | Partial - M4-S15 |
| Artifact library | No delivery-evidence references | **Gap** - M4-S14 (references only; binaries stay out of Git) |
| Image/video annotation | None, and none needed in the core | UI-owned; the core accepts a reference plus feedback |
| AI visual review, optional gates | Blockers and gates exist | UI-owned; optional gate expressed through existing workflow |
| Dependency graph | Tracker relations are not imported | Exploratory; adapters may expose relations later |
| Runner topology | Daemon and coordinator exist; no stable runner identity | **Gap** - M4-S13 |

## Low-cost future-proofing applied now

These are constraints on work already planned, not new subsystems:

1. **Nullable attribution on every versioned record.** Project, runner, session,
   agent role, provider, and model fields exist where a record can carry them.
   Unknown is `null` or absent, never invented.
2. **Planned and actual are separate.** Queue plans are recorded with a reason
   and a timestamp; observed transitions are recorded as they happen. No
   surface may present a plan as history.
3. **Additive-only machine schemas.** Every read surface has `--json`, schemas
   are versioned, and additive fields are ignored by older readers.
4. **Multiple repositories per project.** The project model must not assume one
   repository; a work item may produce several repository tracks.
5. **External tracker identity and URL** are projected on work items so any
   consumer can navigate without re-implementing tracker logic.
6. **CI correlation facts:** run id, attempt, queued/started/finished
   timestamps, conclusion, and the related agent iteration.
7. **Provider observations are classified** as measured, inferred, or unknown;
   wait reasons are recorded with their cause (peak window, quota, disabled).
8. **Retention is configured, not silent.** Events and telemetry have a declared
   retention setting; nothing is pruned without a recorded policy.
9. **Artifact references reserved:** id, kind, media type, byte size, content
   hash, storage uri, and context links. Storage adapters own the bytes.
10. **Socket contract versioning** for the local service so a sidecar can rely
    on it across additive releases.

## Explicitly out of scope for the core

UI rendering and interaction design; image or video annotation tooling; object
storage services and media lifecycle management; tenant administration and
billing; forecasting engines; graph or 3D visualisation; video processing;
provider-specific quota probes beyond declared adapters.

## Ticket mapping

| Capability | Story |
|---|---|
| Cross-project views, project-scoped queues | GH-337 era work; M4-S5 |
| Runner identity and topology | GH-358 (M4-S13) |
| Artifact references | GH-359 (M4-S14) |
| Question inbox durability | GH-360 (M4-S15) |
| History, analytics, planned versus actual | M4-S6 |
| Provider timeline and cost attribution | GH-350 (M4-S4) plus M4-S6 |
| Sidecar socket contract | GH-361 (M5-S7) |

## Sequencing

None of this precedes the jaiship-only flip (`flip-plan.md`). The constraints
above ride the flip stories where they are free (attribution fields, additive
schemas) and become their own stories after F6.
