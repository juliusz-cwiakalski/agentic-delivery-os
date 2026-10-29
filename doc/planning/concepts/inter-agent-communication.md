---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/inter-agent-communication.md
---
# Concept: inter-agent communication

Status: Draft (2026-10-27, from owner notes; parked concept and idea
box: designed, not scheduled). Positioned as a **design envelope and
idea box**: nothing here is scheduled for the first milestones; pieces get
implemented only when a live delivery need shows up (revisit from M2
as needed). The messaging layer between ADOS agents across scopes.
Generalizes the proven coordinator-inbox pattern (the pilot's
cross-repo agent-to-CEO intake) into a scoped messaging model with
explicit transports and delivery semantics. Companions:
[memory-autonomy-and-visibility.md](memory-autonomy-and-visibility.md)
(what is shared vs private), [retrospectives.md](retrospectives.md)
(evidence), the registry status and queue commands.

## Principles

1. **Artifacts over messages, references over content.** The default
   inter-agent handoff is an artifact plus a reference (spec, plan,
   PR, capsule, decision record). Message payloads are **structured
   reference lists** - typed entries (what it is, where it lives, what
   to do with it) - so the receiving agent can reason and act on the
   manifest without opening the referenced files, and opens only what
   its task actually needs. "Write it where it lives, message the
   pointer, list before you load."
2. **Memory is not a chat channel** (existing anti-pattern): messages
   never promote memory-to-memory; a lesson goes through the retro
   promotion path, not an inbox.
3. **Everything is data.** Messages are untrusted input by default:
   trust levels apply, external-origin messages are quarantined
   content, and no message can carry instructions that override
   policy (same rule as memory and evidence).
4. **Deliverable beats interruptible.** Agents work in sessions with
   plans; communication designs around decision boundaries, not
   around assuming a listener is always on.

## Message model

A message is a typed, small record:

```yaml
id: msg-2026-10-27-0042
from: reviewer-agent          # agent, role, or human principal
to: ceo                       # agent, role, lane, or broadcast scope
scope: repo                   # session | change | repo | fleet
kind: ask                    # ask | answer | notify | request | escalate | report | heartbeat
subject: PR 178 review verdict
ref: doc/changes/.../chg-GH-178-spec.md   # artifact reference, not content
origin:                      # provenance: where this message was triggered
  change: GH-178             # change id, when triggered from a delivery
  repo: service-a
  agent: reviewer-agent
priority: normal             # low | normal | high | urgent
created: 2026-10-27T09:12:00Z
ttl: 14d                     # ephemeral classes expire; durable classes do not
read_at: null                # receipt for audit and aging metrics
```

Payloads stay minimal: subject plus reference. Anything longer than a
paragraph is an artifact and the message links it. **Every message
carries its origin** (change, repo, agent) even when it targets a
wider scope - a fleet-scoped strategy note triggered by a specific
delivery still traces back to that delivery. Origin linkage is what
makes communication analyzable per change and per retro.

## Scopes and transports

| Scope | Lives | Transport | Examples |
|---|---|---|---|
| Session | Memory of one session, local | In-context | working notes, intra-session asks |
| Change | The change capsule | Git-persisted | phase handoffs, review verdicts, blocker records |
| Repo / project | Per-agent inboxes under the project | Git-persisted, append-only | cross-agent asks, escalations, reports (the proven inbox pattern) |
| Fleet / global | Central config or the fleet store | Git-persisted | policy notices, cross-repo coordination |

Rule for persistence: **durable or authoritative means git; ephemeral
or signaling means the event stream.** A message that must survive
compaction, be reviewed in a PR, or be cited as evidence is written to
a git-persisted inbox. A nudge ("branch updated", "gate green",
"container wedged") is an event; the event log already carries it, and
inboxes never duplicate events. Both feeds are watermarked and
collectable - collectors read, agents write (same trust split as the
retro evidence plane).

## Delivery semantics: pull at read points, no interruptions

Agents are not daemons and **running work is never interrupted by
messages**. Messages are read at explicit read points:

- **Session start**: the decision-point view (unread inbox, ready
  queue, open actions, gate states) is part of every session bootstrap.
- **Mid-session, at the agent's own discretion**: when the agent
  decides a phase or work portion is complete and it is choosing the
  next step, it may re-read the view before committing to the next
  action.

Push exists only as dispatch-as-wake for genuinely urgent cases
(incident, owner ask, freeze): the dispatcher starts a session with
the message as opening context. Waking equals dispatching with
priority - no resident listeners, no second mechanism. Urgent
interruption of live work is demotion and emergency-stop territory
(software-delivery-autonomy.md), which is policy, not messaging.

## Message workflow: acknowledge, act, complete

A message that requests action carries a small lifecycle:

```text
new -> acknowledged (agent took ownership) -> completed (action done, artifact referenced)
```

- **Acknowledged** means ownership claimed, not done. Acknowledged
  messages remain retrievable (history queries: what did I own, what
  did I act on, when) - they are audit and retro evidence, not noise.
- **Completed** requires the proving artifact: the ref field points at
  the PR, capsule, decision, or answer that closes the request.
  Completion without an artifact is a lint finding.
- Aging applies to the whole lifecycle: a message acknowledged but not
  completed past its SLA surfaces on the board beside unread
  high-priority messages.
- No-acknowledgment-needed kinds (notify, heartbeat-as-event) skip
  the workflow entirely.

## Inbox mechanics

- One inbox per agent (or role) per scope; append-only; read receipts
  for audit. Aging is visible: an unread high-priority message past
  its SLA surfaces on the board next to owner asks (the pilot's
  carrier-inert failure - inbox unread for days while work continued -
  is the named anti-pattern this prevents).
- Rate and batch discipline: agents batch non-urgent messages into
  their decision-point reads; broadcast scopes are rate-limited;
  heartbeats are events, not inbox messages.
- No secrets in messages, ever (lint rule). Cross-fleet messages enter
  as quarantine-class content until locally validated.
- Subagent final reports are evidence, not messages: they land in the
  capsule/event stream, and a short report-message may point at them.

## What this replaces and what it keeps

Today: the coordinator inbox exists (pilot pattern), subagent reports
are harvested, ceremonies fetch state at their cadence - all pull
already. This concept keeps those, adds: typed message records with
TTLs and receipts, scope-declared transports, the decision-point view
contract for every agent (not just the coordinator), and dispatch-as-
wake for urgency.

## Tooling hides the format

The message format and storage are **implementation details behind the
tooling**: agents never touch raw inbox files. They use the messaging
surface (list, read, send, acknowledge, complete, query history), and
the backend is swappable - git-persisted files as the default local
backend, with remote or service-backed backends possible later without
agent-visible change. This keeps prompts simple and stable (one tool
contract) and lets the transport evolve (local files today; a
connected messaging service someday) without re-teaching agents.

## Communication is retro evidence

Because messages are typed records with origin, scope, and lifecycle
receipts, the communication stream is analyzable input for
retrospectives (retrospectives.md): unanswered asks and their aging
(who waited on whom, for how long), escalation patterns and rates,
ask/answer latency per agent pair, communication load versus delivery
outcomes (are heavy-coordination changes slower or safer?), and
message-driven interruptions of planned work. The origin linkage lets
a change-level retro (R1) pull exactly the communication its delivery
generated, regardless of the scopes the messages targeted. Treat
communication analytics like any other retro evidence: collected
mechanically, facts separated from interpretations, never a grading
system for individual agents.

## Deferred ideas (idea box; not designed yet, not scheduled)

Captured deliberately unrefined; revisit from M2 when a real need
appears:

- **Threads**: multi-agent readable reply chains around a message
  (ask -> answer -> follow-up), with thread subscription.
- **Group addressing**: one-to-many and many-to-many channels - guild
  channels, and executive patterns like a council of senior agents
  (c-suite level) deliberating strategy together. Group communication
  compounds the conformity and anchoring risks the memory model warns
  about; if built, it needs the same independence discipline as
  adversarial roles.
- **Human-to-agent messaging, both directions**: the owner messaging
  agents (and agents messaging the owner) through the same channel
  instead of tracker-first asks. Possibly a way to be
  harness-agnostic; possibly over-complicating - evaluate both.
- **Remote backends**: messaging via connected remote services
  (cross-host fleets, hosted coordination).
- **Subscription/filter models**: agents subscribing to kinds or
  scopes instead of polling whole inboxes.
- **Message-to-action auto-linkage**: a completed message proving the
  action with a gate or ceremony artifact automatically.

## Compatibility with the current build

What the scheduled stories must keep open so this concept can be
adopted without redesign:

- `ados steer` (M2-S5) is the **first shipping vehicle**: build it as
  the first message type on the typed message record (origin block,
  receipt, TTL, artifact-ref completion) rather than a bespoke
  owner-note channel, and agent-to-agent messages extend the same
  contract later.
- The session-bootstrap decision-point view (fed by the status
  collectors, M0-S6) is the read-point surface: keep that view
  contract extensible with an unread-messages section.
- Inboxes are append-only local state and fit the state layer (M0-S5)
  and the git-persisted artifact conventions; no new storage model is
  required later.

## Open questions

1. Which need arrives first in real deliveries - likely the
   coordinator inbox already covers it; resist building the rest until
   a second consumer appears.
2. Should the ack/complete workflow apply to owner asks too (asks
   aging on the board already exists) or stay agent-to-agent only?
3. History queries: per-agent (what did I handle) versus per-message
   (who touched this) - both cheap once receipts exist; pick at
   implementation.
