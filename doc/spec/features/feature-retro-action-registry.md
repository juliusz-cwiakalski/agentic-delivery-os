---
ados_distribution: internal
id: SPEC-RETRO-ACTION-REGISTRY
status: Current
created: 2026-11-16
last_updated: 2026-11-16
owners: ["engineering"]
service: delivery-os
summary: "The retro follow-through memory behind every retro level: its own validated state boundary with the additive retro.action and retro.action-closure record kinds under the retro.actions and retro.action-closures key prefixes, the five-field filing contract plus verification artifact, outcome verifier, and rollback condition with the all-or-nothing retro.action-incomplete refusal, derived aging on the one pinned basis (time open since the recorded filing timestamp) with the 14-day nudge and 30-day or second-miss escalation, explicit two-plane closure with the both-plane deprioritized/superseded routes and the retro.closure-incomplete refusal, the fixed improvement WIP limit of three with the retro.wip-limit-exceeded refusal, the additive retro action file|close|list verb group, the board ACTIONS section, and the registry follow-through producers behind the ceremony pass and the retro report fold."
links:
  related_changes: ["GH-287"]
  contracts:
    - "packages/core/src/contracts/action.ts"
    - "packages/core/src/state/action-registry.ts"
    - "packages/core/src/domain/action-filing.ts"
    - "packages/core/src/domain/action-aging.ts"
    - "packages/core/src/domain/action-closure.ts"
    - "packages/cli/src/commands/retro.ts"
---

# Feature: Retro Action Registry

## Overview

The retro action registry is the follow-through memory behind every retro level.
It validates and records actions through a five-field contract plus a
verification artifact, derives aging at read time, closes actions only through
explicit decisions that separate the artifact plane from the outcome plane, and
bounds each improvement window with a fixed WIP limit. It sits on top of the
retro evidence pipeline and the ceremony runner, which hands its declared
actions to this registry.

## Business Context

### Problem Statement

A follow-through section without a producer is a list, not enforcement: with no
owner validation, no verb discipline, no measurable outcome or tracker anchor at
filing, no aging, and no explicit-closure rule, actions drift silently and no
retro level can tell an applied action from a claimed one.

### Goals

- Filing integrity: an action that misses a contract member, or whose field
  violates its contract rule, cannot be filed.
- Outcome accountability: every action records an outcome verifier (a delayed
  metric window) and a rollback condition.
- Explicit closure: nothing closes without an explicit decision, and artifact
  closure is distinct from outcome closure.
- Visible aging on the board beside the owner asks.
- A focused improvement window bounded by the fixed WIP limit of three.

## User Experience & Functionality

### Command surface

The registry surface is the additive `action` verb group inside the delivered
`retro` command family; it adds no command family to the prompt-required set.

| Invocation | Behavior |
|---|---|
| `retro action file` | Validates the five-field contract plus artifact, outcome-verifier window, and rollback condition, then appends one action record. |
| `retro action close` | Records one explicit closure decision for the artifact or outcome plane. |
| `retro action list [--window <name>]` | Returns the recorded actions and each window's count/limit disclosure as `data.actions` and `data.windows`. |

`retro collect` and `retro report` keep their grammar and semantics.

### Filing contract

A conforming filing carries a named owner (one agent role or one human — a
team-owned action is invalid), a verb from the closed vocabulary
`add/remove/change/test/deploy` (`review` and `improve` are unverifiable and
refused), a measurable outcome, a real tracker entry, a due date, a verification
artifact reference, an outcome verifier with a non-null delayed metric window,
and a rollback condition.

A missing member and a present-but-non-conforming member share one refusal:
exit 1 under `retro.action-incomplete`, naming the offending field, with no
action row created. Free text is bounded; an over-long value is refused naming
its bound, never silently clipped. Tracker corroboration is read-only through
the delivered tracker read seam; an unreachable tracker keeps the entry recorded
with its corroboration state disclosed.

### Aging

Aging is derived at read and render time from the recorded filing timestamp —
the one declared basis — and the recorded due-date lapse events. Nothing is
stored and no scheduler exists.

| Condition | Aging state |
|---|---|
| 0–13 days open | `current` |
| Exactly 14 days open, through 29 | `nudged` |
| 30 or more days open | `escalated` (`threshold-days`) |
| Two recorded due-date lapse events, any age | `escalated` (`second-miss`) |

Due dates feed only the second-miss counter, never the day thresholds.

### Closure planes

Closure is explicit only.

| Route | Required justification | Plane effects |
|---|---|---|
| `done` | A verification artifact | `artifactClosure` closed; `outcomeClosure` open with its non-null verification window |
| `deprioritized` | A reason | Both planes closed in the one decision; the verification window is `mooted` by the decision |
| `superseded` | A recorded successor action reference | Both planes closed in the one decision; the window is `mooted` |

An explicit outcome decision citing in-window verifier evidence closes the
outcome plane of a `done` action. Outcome closure never follows from elapsed
time or from artifact closure alone. A closure attempt missing its decision or
justification is refused under `retro.closure-incomplete` naming what is
missing; a closure decision targeting an already-closed plane is refused under
the same identity, naming the plane and its existing closure, and appends no
second closure record.

### Improvement WIP limit

Each improvement window holds at most three open actions — the fixed
contract-data value. A filing into a window at its limit is refused with exit 1
under `retro.wip-limit-exceeded`, naming the window, its open count, and its
limit, and no action row lands. Deprioritize and supersede are the deliberate
routes that free a slot. The window's count and limit are disclosed wherever the
window is reported.

### Board actions surface

The board renders an additive `ACTIONS` section immediately after `ASKS` under
the kept `delivery.board.v1` identity. Rows carry identity, repository, owner,
level, age, aging state, and the window count/limit; rows are ordered
deterministically, capped per repository with counted omissions, and participate
in the declared byte-guard drop order. An empty registry renders the label with
explicit zero counters; a failed registry read discloses the classified source
state with exit 0 and no fabricated rows.

### Follow-through producers

The registry is the producer behind the delivered follow-through surfaces. The
ceremony retro-evidence pass inspects each open action's verification artifact —
never the owner's status claim — and assigns `applied`, `partial`, or
`violated-with-consequence` from that evidence; an unresolvable artifact
degrades to `unverified`. The retro report's delivered `followThrough[]` fold
gains its registry reader: entries carry `{ action, verdict, artifactRef? }`
plus registry provenance, and `retro report`'s `data` keeps exactly its four
delivered top-level keys.

## Technical Architecture & Codebase Map

### Core components

- `packages/core/src/contracts/action.ts` — the single declaration home of the
  contract vocabulary, record kinds, payload schemas, prefixes, aging basis and
  thresholds, WIP limit, closure routes and planes, refusal identities, grammar,
  and board member set.
- `packages/core/src/domain/action-filing.ts` — the all-or-nothing filing gate,
  the window projection, and the filing engine.
- `packages/core/src/domain/action-aging.ts` — the pure aging ladder.
- `packages/core/src/domain/action-closure.ts` — closure evaluation, plane
  projection, and the list projection.
- `packages/core/src/state/action-registry.ts` — the registry's own validated
  boundary over the reusable artifact-boundary factory.
- `packages/cli/src/commands/retro.ts` and `packages/cli/src/edge.ts` — the
  verb-group grammar, human renders, and the composition root.
- `packages/core/src/domain/ceremony-retro.ts` — the registry producer for the
  ceremony follow-through facts.

### Data architecture

The registry declares exactly two record kinds — `retro.action` and
`retro.action-closure` — under the store-scoped key prefixes `retro.actions` and
`retro.action-closures` in the shared `retro.` key family. Payload schemas are
`delivery.retro.action.v1` and `delivery.retro.action-closure.v1`. The delivered
retro-registry boundary's exactly-three declaration is unchanged; its read skips
the sibling action kinds.

### Invariants and gates

- One contract home; no constant is re-derived per suite.
- Writes are explicit, fenced, and invocation-gated; reads never write; there is
  no update-in-place and no delete.
- Byte-identical repeat renders over identical records, injected clock, and
  injected run id; zero model calls.
- Machine `data` stays within the declared UTF-8 byte cap; free text is bounded
  and every omitted row is counted.
- Records carry references, identities, roles, dates, and bounded text only;
  the redaction chokepoint composes on every render path.
- The three additive refusal identities are exact two-segment rows under the
  delivered `retro` domain kind, in two-way machine/documented sync.

## Security and Boundaries

Claimed identities are attribution only. No credential is resolved, stored, or
rendered by any filing, aging, closure, or board path. Aging and closure are
derived, never scheduled, and no background write exists.

## Quality Assurance Strategy

Offline suites cover the filing matrix, the aging boundary ladder, the closure
matrix, the WIP refusal, the board surface, the follow-through producers, the
cross-level unity, and a cross-cutting honesty battery (determinism, bounds,
write discipline, read cost, privacy, hermeticity, disclosure, audit) with a
23-mutant meta-suite.

## Related

- [Retro Evidence Pipeline](feature-retro-pipeline.md)
- [Ceremony Runner](feature-ceremony-runner.md)
- [Board](feature-board.md)
- [Doctor](feature-doctor.md)
- [State Layer](feature-state-layer.md)
- [Result Contract](feature-result-contract.md)
- [CLI Entrypoint and Self-Description](feature-cli-entrypoint.md)

**Change records:** `doc/changes/2026-11/2026-11-16--GH-287--retro-action-registry/`.
