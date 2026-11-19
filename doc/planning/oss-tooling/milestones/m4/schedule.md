# M4 delivery schedule — reaching jaiship-only operation

Status: active schedule. Owner of record: CEO agent under user-delegated
autonomous authority. Revises nothing in `flip-plan.md`; it sequences the
remaining work and states the cutover rule.

## Goal

Deliver all remaining work through Jaiship itself: `dispatch`, `loop`, `merge`,
`closeout`, `queue`, `provider`, and the history surfaces — with no
`deliver-ticket.sh` or `ceo-loop.sh` on the path, and with provider switching,
remaining-quota tracking, and peak-hour parking driven by Jaiship policy.

## Remaining inventory (2026-11-19)

| Scope | Story | Ticket | State |
|---|---|---|---|
| M3 | S2 Jira backlog adapter | GH-336 | queued (flip gate) |
| M3 | S3 GitLab code-host adapter | GH-337 | queued (flip gate) |
| M3 | S6 Multi-tracker per project | GH-340 | queued (after S2, S3) |
| M4 | F2 Provider policy | GH-350 | delivering |
| M4 | F3 Loop supervision | GH-348 | delivering |
| M4 | F4 Merge/closeout repair | GH-349 | delivering (8/11) |
| M4 | F1b Operator surface | GH-354 | next wave |
| M4 | F5 Agent prompts | GH-351 | after F1-F4 |
| M4 | F6 Dogfood and thin wrappers | GH-352 | after F1-F5 |
| M4 | S2 Namespace migration | GH-365 | after flip gate |
| M4 | S3 Conformance residual | GH-366 | after S9-S11 |
| M4 | S5 Project queues | GH-367 | after S11, M3-S6 |
| M4 | S6 History export | GH-368 | after S5 |
| M4 | S13 Runner identity | GH-358 | after S5 |
| M4 | S14 Artifact references | GH-359 | after S6 |
| M4 | S15 Question inbox | GH-360 | after S9, S5 |
| M5 | S7 Socket contract | GH-361 | after S5, S6, S13 |

## Waves

Capacity is three lanes. A lane slot is never idle while eligible work exists,
and no wave starts before its gate is green.

### Wave A — finish the flip core (running)
Lanes: GH-349 (F4), GH-350 (F2), GH-348 (F3).

Gate A (flip gate): F1a, F2, F3, and F4 merged, each with 11/11 phases, green
CI, zero unresolved threads, and a recorded privacy scan.

### Wave B — prompts and operator surface (gate A)
Lanes: GH-351 (F5 prompts), GH-354 (F1b operator surface), and one adapter
(GH-336 Jira; GH-337 follows in the next slot).

Why here: F5 is the gate that stops the prompts from mandating the shell path;
F1b supplies the per-ref `status` and `is-delivering` queries the evidence
window needs. The adapter work is independent and fills the third slot.

Gate B: F5 and F1b merged; the prompt conformance scan is green and no prompt
requires a shell entry point.

### Wave C — cutover to jaiship-only (gate B)
From this point **all** new deliveries are dispatched with `jaiship dispatch`
and supervised with `jaiship loop`. The shell entry points are not used
internally; if a jaiship path fails, the failure is recorded as a parity gap and
fixed, not routed around.

Lanes during the evidence window: GH-337 (GitLab), GH-340 (multi-tracker),
GH-367 (project queues), then GH-368 (history), GH-365 (namespace), GH-358
(runner identity), GH-360 (question inbox), GH-359 (artifact references).

F6 (GH-352) runs alongside: it collects the evidence (10 dispatches or 5 days,
at least 8 of 11 result classes, one resume, one blocked, one parallel pair,
zero shell fallbacks), then rewrites the wrappers as thin `jship` shims.

### Wave D — release readiness (M5)
GH-361 (socket contract) and the remaining M5 stories, after Wave C.

## Cost and provider policy during the schedule

- Three lanes maximum; the third slot is filled only by work whose dependencies
  are green.
- Until F2 merges, the deepseek rail with weekday peak parking (06:00-10:00Z)
  applies. After F2 merges, policy is Jaiship configuration: prefer sunk-cost
  subscription quota (the weekly allowance resets 2026-11-22T15:01Z), fall back
  to pay-per-token, park on peak or exhaustion with a recorded reason, and
  attribute spend per ticket, phase, lane, role, and model.
- No retries against an exhausted provider; balance is verified live because
  caches lag top-ups.
- Budget alarms park a lane rather than overspend.

## Decision-id reservation

Parallel lanes allocate decision records independently and collide without
reservation. The next free id after the current wave is **TDR-0063**.

| Wave | Reserved range |
|---|---|
| B | TDR-0063..TDR-0071 (three stories, three ids each) |
| C | TDR-0072 onward, three per story, assigned at dispatch |

Dispatch prompts must carry the reserved range.

## Known risks and mitigations

| Risk | Mitigation |
|---|---|
| DoR iteration loops on artifact allocation | The readiness pass names the implementing phase and driver for every assertion; the escalation rule is one scoped pass, then a recorded deviation |
| Decision-id collisions | Reserved ranges per wave |
| Tracker/API flaps misclassify landed work | Verify artifacts directly (phases, commits, PR state) before any re-dispatch |
| `BEHIND` churn on serial merges | F4's merge-queue rebase; until then, sync the branch in place rather than re-dispatch |
| Lane processes killed by host restarts | Resume the same branch; on-disk artifacts are truth |
| Cost drift | F2 policy plus spend attribution; three-lane cap |
