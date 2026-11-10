---
change:
  ref: GH-280
  type: feat
  status: Proposed
  slug: owner-hold-hook
  title: "Owner hold that outranks provider windows: pause lanes, not just defer"
  owners: [engineering]
  service: delivery-os scheduling and pre-iteration hooks
  labels: [change, hooks, scheduling, queue, status, doctor, cost-control]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - pre-iteration hook contract and example hooks
      - install and uninstall script inventories
      - queue scheduling, park evaluation, claim gate, lease, and lane folds
      - dispatch engine claim seam and result envelope
      - composed supervision and queue watch (the production daemon entry is a documented residual; see §13)
      - status digest collector and providers section
      - doctor provider check and condition catalog
      - state store identity and the production state directory
      - CLI and MCP production composition
    external: []
links:
  related_changes: ["GH-277", "GH-279", "GH-237", "GH-238", "GH-243", "GH-224", "GH-146"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make an owner-declared delivery pause enforceable by adding an owner-hold fact with two equivalent sources, a DM-1 example hook that sleeps indefinitely while the hold exists, and a global read-only gate that blocks queue claims, lane dispatch, any composed supervision-cycle claim, and park auto-recovery — so a provider window can never overrule an operator who said stop — and surface the hold in `status` and `doctor` without adding a queue park cause, a state record, a seventh ready condition, or a tenth status section.

## 1. SUMMARY

Today the system knows how to **defer** work until a provider window opens; it has no way to **hold** work because an operator said stop. On 2026-11-09 a lane parked by the pre-opencode-iteration guard for an explicit owner pause resumed on its own when its Z.AI provider window opened and spent roughly five hours and twenty minutes of peak-rate capacity. No surface could hold it: the hook gates only iteration starts, a mid-flight session is not parked by it, and the queue's parks are provider conditions, not operator intent.

This change introduces one first-class concept — an **owner hold** — with two equivalent sources (a brand-derived environment variable whose non-empty value is the operator reason, and a marker file in the production store directory), one DM-1 example hook (`howLongToSleepDueToOwnerHold()`) that keeps sleeping while the hold exists, and a global read-only gate over an injected fact in the typed engine. While active, the hold suppresses next actions, refuses claims and dispatches with the existing `queue.precondition.unmet` identity and the new `owner-hold` reason, and skips the park auto-recovery mutation, so a park that reached its provider window stays parked and no record is written. Removing the hold resumes every ref from preserved queue, lease, park, and lane state, with no re-dispatch from scratch and no duplicate sessions.

The hold is also visible read-only: an additive optional `ownerHold` on the status providers **evidence record** (the `credentialPrerequisite` precedent, a sibling of `sources[]`) and an additive `ok` provider-check detail in `doctor` with one new closed evidence reason, so an operator can see the pause without any verdict, summary-count, or exit change — a deliberate pause is not a wiring defect. Provider-window deferral stays automatic and time-bounded; the owner hold is manual, indefinite, and outranks every window.

## 2. CONTEXT

### 2.1 Current State Snapshot

Two independent paths can start delivery work, and neither has an operator-intent gate.

**The shell path.** `deliver-ticket.sh` and `ceo-loop.sh` invoke the user-owned pre-iteration hook immediately before every spawn or resume. The shipped example `scripts/hooks/pre-opencode-iteration-zai.sh` is a pure gate under the GH-146 / TDR-0002 contract: it either sleeps to defer the spawn or returns `0` to proceed, and it never writes `ADOS_HOOK_ENV_V1` output. It is structured as a generic sleep-driver that takes the **maximum** across registered DM-1 condition functions (`howLongToSleepDueToPeakHours`, `howLongToSleepDueToQuotaExhaustion`), sleeps that long, and re-evaluates. The driver stops when no condition returns a positive value, and it applies a defensive re-evaluation cap (`ADOS_ZAI_MAX_SLEEP_LOOPS`, default 24) after which it logs a warning and **proceeds**. Both conditions are time-bounded by construction: a peak window ends at a UTC time, and a quota pause ends at a provider reset time.

**The typed path.** The scheduling engine computes a deterministic pass over injected facts, projects entries and next actions, claims repository leases under a fence, evaluates parks, folds lanes, and lets one-shot dispatch — and, when a composition supplies it, a supervision cycle — start work. Parks are a closed pair of vocabularies — three condition types (`provider-window`, `provider-quota`, `preemption`) and three causes with a declared one-to-one pairing (`provider-window`, `provider-quota`, `preempted-for-close-item`) — plus four recovery states. A provider-window park clears at its absolute expiry, while quota and preemption clear on a provider observation; the mutating pass then appends `clear-observed`, `recovered`, and a `park-auto-recovery` incident. Queue readiness has exactly six condition ids. The state store has exactly five queue record kinds. Status has exactly nine sections and twenty evidence reasons. Doctor has exactly five areas, three verdicts, and twenty-two evidence reasons.

| Component | Location (evidence) | Observed behaviour |
|---|---|---|
| Hook condition-function contract (GH-150 DM-1) | `scripts/hooks/pre-opencode-iteration-zai.sh:1-30,130-160,150-254` | A condition is `howLongToSleepDueTo<Reason>()`, echoes exactly one non-negative integer of seconds, uses injected seams, and emits at most one diagnostic line. Two time-bounded conditions are registered. |
| Hook condition registry and MAX driver | `scripts/hooks/pre-opencode-iteration-zai.sh:259-313` | The driver takes the maximum positive seconds, logs the reason names and UTC wake time, sleeps, and re-evaluates; `ADOS_ZAI_MAX_SLEEP_LOOPS` (default `24`) logs a warning and proceeds after the cap. |
| Hook invocation | `scripts/deliver-ticket.sh:68,619-624,1911-1922`; `scripts/ceo-loop.sh:72,200,532-535` | Both wrappers run the configured hook before every spawn/resume, including watchdog retries. The hook is not run for JOIN, probes, control commands, or dry runs. |
| Example-hook installation | `scripts/install.sh:133-135,858-865`; `scripts/uninstall.sh:427-436` | `ADOS_HOOK_EXAMPLES` names the one shipped example, the copy loop installs it executable, and uninstall removes it unconditionally. |
| Installation test fixtures | `scripts/.tests/test-install.sh:171-173,556-557`; `scripts/.tests/test-uninstall.sh:193-194,441-442` | The fixtures create and assert exactly one example hook path. |
| Shell-test determinism | `scripts/.tests/test-hook-zai-example.sh:12-25,86-120` | The suite sources the hook, overrides `_now_utc_epoch` and `_sleep`, and asserts zero real sleeps and zero network calls. |
| Queue closed vocabularies | `packages/core/src/contracts/queue.ts:112-158,209-267`; `packages/core/src/contracts/queue-ready.ts:15-23` | Three park condition types, three causes with a fixed pairing, four recovery states, six lane states, a closed idle/blocking reason set, and six ready condition ids. |
| Park evaluation and recovery | `packages/core/src/domain/queue-park.ts:95-182`; `packages/core/src/app/queue.ts:1404-1495` | An expired window evaluates `resumable`; the mutating pass appends `clear-observed`, then `recovered` plus a `park-auto-recovery` incident. Reads never append. |
| Scheduling pass | `packages/core/src/domain/queue-precedence.ts:421-603` | Assembles entries, next actions, preemption proposals, findings, and parks from injected facts; every decision is fact-driven and deterministic. |
| Claim gate and claim | `packages/core/src/domain/queue-lease.ts:164-252`; `packages/core/src/app/queue.ts:1079-1253` | The pre-fence gate evaluates parks and five readiness conditions; the fenced claim re-reads leases and refuses or takes over. |
| Lane fold | `packages/core/src/domain/queue-lanes.ts:47-159` | A lane is a pure projection; every idle lane carries a closed idle reason, and an active park maps to `parked:<cause>`. |
| Queue payload types | `packages/core/src/contracts/queue.ts:525-657,692-742` | `QueueReadData` and `QueuePlanData` carry entries, leases, weights, parks, findings, counts, and truncation; `QueueLanesData` carries lanes and counts. |
| Queue CLI projectors | `packages/cli/src/commands/queue.ts:257-288,340-463` | `toQueueReadData` and `toQueuePlanData` bound and project the schedule; `queue claim` and `queue release` are the only claim/release surfaces. |
| Queue runtime composition | `packages/cli/src/edge.ts:3983-4020,4280-4400,4215-4260` | The edge builds scheduler facts from the injected store, evaluates parks, exposes reads and watch, and performs claim through the pre-fence gate plus the fenced claim. |
| Dispatch claim seam | `packages/cli/src/production.ts:1076-1089`; `packages/core/src/app/dispatch.ts:75-77,484-487` | Production claims the lease without a pre-fence precondition; the engine carries only `{ ok: false, code }` from that seam into a `kind: "queue"` error. |
| Supervision claim seam | `packages/core/src/app/daemon-supervision.ts:30-37,101-112`; `packages/cli/src/daemon-compose.ts:400-420` | The supervision cycle asks injected next-action and claim seams for a lease. Production `daemon-compose` defaults `nextAction` to `undefined` and `claim` to a permanent refusal, and no production composition supplies `supervision`, so the production daemon entry is supervise-only and remains the resident-daemon spec's documented residual. |
| Status sections and reasons | `packages/core/src/contracts/status.ts:18-29,254-276,747-773`; `packages/core/src/domain/status.ts:1278-1428` | Nine fixed sections, a closed twenty-reason set, a single section type, and a providers section derived from config plus the verified park fold. |
| Status additive precedent | `packages/core/src/contracts/status.ts:428-442`; `packages/core/src/domain/status.ts:1826-1834,1866-1870` | One optional evidence-level `credentialPrerequisite` sibling of `sources[]` is attached to a section's evidence record after derivation, present only when its credential-dependent source failed; a human suffix renders it. |
| Status composition | `packages/cli/src/commands/status.ts:28-123`; `packages/mcp/src/serve.ts:93-131` | Provider facts are `{ config, parks }`; the CLI and MCP compose the same section set through injected readers. |
| Doctor vocabulary and provider check | `packages/core/src/contracts/doctor.ts:18-75,90-275`; `packages/core/src/domain/doctor.ts:517-677` | Five areas, three verdicts (`ok`, `fail`, `unreachable`), twenty-two evidence reasons, eleven evidence sources across five areas (four in the provider area) and six provider evidence reasons, and a provider check that reports active neutral parks as `ok` detail. |
| Doctor outcome model | `doc/spec/features/feature-doctor.md` §Outcome and exit model | Any non-ok check yields `doctor.check.failed` and exit `1`; only `fail` and `unreachable` exist today. |
| Production store directory | `packages/cli/src/production.ts:281-302`; `packages/mcp/src/serve.ts:86-92`; `packages/core/src/branding/index.ts:128` | Both compositions fix the queue/dispatch/status/doctor store at `<home>/<brand.stateDirectoryName>` (`.ados-state` for this brand). Only the audit-store edge resolves its directory through a separate config helper; the delivery store does not. Relocating the store is out of scope. |
| Core ambient restriction | `scripts/checks/ambient-globals.ts` | Core must not read ambient filesystem or process globals; a marker must arrive through an injected fact composed at the runtime edge. |
| Composition points | `packages/cli/src/production.ts:281-302`; `packages/mcp/src/serve.ts:86-92` | Both compose the state store at `<home>/<brand.stateDirectoryName>`; neither reads an ambient marker today, so the hold fact must be composed there. |
| Pinned queue vocabulary and goldens | `tests/fixtures/queue/vocabulary/closed-sets.json`; `tests/structure/queue-scheduling-contract.test.ts`; `tests/golden/queue-*.test.ts` | The fixture records the closed sets; the delivered test checks containment and the six ready ids but does not compare the lane or blocking reason arrays to the fixture. This change adds exact two-way equality for both (finding 6; the test plan owns the case details). |
| Pinned status goldens | `tests/golden/status-digest.test.ts`; `tests/fixtures/status/golden/*`; `tests/fixtures/mcp/parity/*` | Status machine and human bytes are golden-pinned, and the MCP status result is parity-checked. |
| Pinned doctor goldens | `tests/golden/doctor-output.test.ts`; `tests/structure/inventory.json`; `tests/fixtures/ports/v1-contract-inventory.json` | Doctor report bytes, inventories, and contract surfaces are pinned. |
| Wrapper stability | `tests/structure/provider-surface.test.ts:242-267` | `scripts/ceo-loop.sh` and the legacy hook regression suite are SHA-256 pinned and must stay byte-unchanged. |

Observed incident evidence (2026-11-09, GH-277):

```text
pre-opencode-iteration guard
  -> no-candidate-available; waiting until 2026-11-09T10:00:00Z
owner intent
  -> explicit delivery pause for peak-hour cost control
provider window
  -> opened at 10:00 UTC
lane
  -> resumed on its own; ~5h20m of peak-rate capacity spent
operator recovery
  -> none available; the only mechanism was manual cleanup
```

The incident is not a security event. It is an operability gap between "the provider says available" and "the operator said stop".

### 2.2 Pain Points / Gaps

- **PP-1 — Operator intent cannot outrank a provider window.** Every wait in the system is either a time-bounded window or a provider condition with an expiry. Once the window opens, work proceeds even when the operator declared a pause. The 2026-11-09 lane is the evidenced instance.
- **PP-2 — The hook gates starts, not the system.** The pre-iteration hook runs only immediately before a spawn or resume. It cannot park a mid-flight session, and a session that dies when the provider cuts out leaves a `partial` lane with no durable hold.
- **PP-3 — A hold has no durable state.** There is no marker, no fact, and no surface that says "delivery is paused by the operator". A pause lives only in the operator's head or in an out-of-band note.
- **PP-4 — The typed engine would ignore a hold anyway.** Even if an operator stopped the shell wrappers, `queue claim`, one-shot dispatch, and any composed supervision cycle would continue to select and start work from the same queue state.
- **PP-5 — Park auto-recovery would resume the lane.** A lane parked for a provider window is recovered automatically when the window passes. Without a hold gate, the queue itself performs the resume the operator wanted to prevent.
- **PP-6 — The pause is invisible.** `status` and `doctor` report provider state, active parks, and credentials, but neither can say "delivery is held by the owner", so an operator cannot verify that a pause took effect.

### 2.3 Users and Operators

| User | Need in this change |
|---|---|
| Delivery owner (human) | Declare an indefinite pause once, see it in `status` and `doctor`, and remove it without repairing queue, lease, park, or session state. |
| Delivery operator running the wrappers | Have every new spawn/resume defer with a line that names the hold and the operator's reason. |
| Coordinator / automation agent | Branch on stable tokens: `queue.precondition.unmet` with reason `owner-hold`, never a new error identity. |
| Maintainer of the scheduling engine | Keep the closed park, state, readiness, lane, status, and doctor vocabularies intact except for the one declared lane reason and one declared doctor reason, and keep reads side-effect-free. |
| Security reviewer | Confirm that the reason is bounded and sanitized, that no credential is read, and that the marker path cannot escape the production store directory in the engine. |

## 3. PROBLEM STATEMENT

Because every deferral mechanism in the delivery system is either a time-bounded provider window or a provider condition with an expiry, and because the only operator-facing gate (`pre-opencode-iteration`) runs before a spawn rather than over the queue and dispatch engine, an operator who declares a delivery pause cannot enforce it: a lane parked during the pause resumes automatically when its provider window opens, new claims and dispatches proceed, and the pause leaves no durable, inspectable state — the evidenced result is a lane that spent roughly five hours and twenty minutes of peak-rate capacity during a declared stop. The operator also cannot verify that a pause is in effect, and removing an ad-hoc pause leaves no defined recovery path.

## 4. GOALS

- **G-1**: Establish one owner-hold concept with two equivalent sources — a brand-derived environment variable whose non-empty value is the operator reason, and a marker file in the production store directory `<home>/<brand.stateDirectoryName>` — with a declared precedence and a bounded, sanitized reason.
- **G-2**: Ship a DM-1 example hook whose owner-hold condition sleeps indefinitely while the hold exists, emits a clear reason line, and is never cut short by a fixed loop cap.
- **G-3**: Refuse queue claims, one-shot dispatches, any composed supervision-cycle claim, and park auto-recovery while the hold is active, using existing identities, with zero durable writes and zero sessions.
- **G-4**: Preserve queue, lease, park, lane, handoff, and session state across a hold so removal resumes work exactly where it stopped, without re-dispatch from scratch and without duplicate sessions.
- **G-5**: Surface the hold read-only in `status` and `doctor` without adding a status section, a status reason, a doctor verdict, a doctor summary count, a doctor condition, a queue park cause, a state record kind, or a seventh queue-ready condition.
- **G-6**: Document the distinction between provider-window deferral (automatic, time-bounded) and owner hold (manual, indefinite, outranks windows), including how the example hook composes with peak and quota conditions.
- **G-7**: Register the new example in install, uninstall, and the shell test surface, and prove it with a deterministic hook test that performs zero real sleeps.
- **G-8**: Leave the closed queue vocabularies, the error identity table, the nine status sections and their closed vocabularies, the wrapper scripts, and the brand-neutral naming rules unchanged except for the explicitly declared additions.

### 4.1 Success Metrics / KPIs

| Metric | Target for this change |
|---|---|
| Delivery actions started (spawns, resumes, lane claims, queue claims) while a hold is active | 0 |
| Durable queue, lease, park, incident, daemon-lane, handoff, and attempt records written because of hold resolution or gating while a hold is active | 0 |
| Park recovery records appended for a park whose window expired during a hold | 0 |
| Hook driver proceeds while the hold persists past 24 polls | Never; the driver keeps sleeping |
| Time from creating the hold to the next iteration deferring (default configuration) | ≤ 300 s |
| Time from removing the hold to the next eligible claim being permitted (default configuration) | ≤ 1 scheduling pass; no process restart |
| Durable state mutated by removing the hold | 0 records; existing state only |
| Dispatches refused while held that name the hold in their bounded summary | 100% |
| Credential reads, network calls, and state writes performed by hold resolution | 0, 0, 0 per resolution |
| New queue park causes / condition types / recovery states / state record kinds / queue-ready conditions | 0 / 0 / 0 / 0 / 0 |
| New status sections / status evidence reasons | 0 / 0 |
| New doctor evidence reasons / doctor verdicts | 1 (`owner-hold`) / 0 |
| Real sleeps or network calls in the new shell test | 0 |
| Shellcheck findings in the new example hook | 0 |

### 4.2 Non-Goals

- **NG-1**: Killing, aborting, or pausing an already-delivering mid-flight session. The hold gates new iterations and claims only; a session that is already running continues until it ends on its own or its provider cuts it out, which can still leave a `partial` lane.
- **NG-2**: Adding a queue park cause, a park condition type, a recovery state, or a park record for the owner hold. The hold is a global read-only gate, not a per-ref park.
- **NG-3**: Adding a state record kind, a state payload schema, or a state-store migration.
- **NG-4**: Adding a seventh queue-ready condition, or changing any of the six delivered condition ids, order, tri-state, or evidence vocabulary.
- **NG-5**: Adding a tenth status section, a twenty-first status evidence reason, a new section state, or a new finding code.
- **NG-6**: Changing `deliver-ticket.sh`, `ceo-loop.sh`, `batch-deliver.sh`, their hook invocation, their retry semantics, or any pinned wrapper byte.
- **NG-7**: Any cloud, vendor, or product naming, or any hardcoded brand literal in tooling code; the environment prefix and state directory name are brand-derived, and the shell example uses the repository's existing `ADOS_*` example convention.
- **NG-8**: A new command, flag, configuration key, or queue `--park` cause, including a `queue release --park owner-hold` or an `--until`-less park on the existing causes.
- **NG-9**: Changing provider-window, provider-quota, or preemption semantics, their expiries, or their recheck cadence.
- **NG-10**: Real network calls, real sleeps, real daemon processes, or real harness sessions in any test.
- **NG-11**: Backfilling hold state into historical incidents, or attributing the 2026-11-09 cost to a hold that did not exist.
- **NG-12**: Blocking read-only inspection: `status`, `doctor`, `queue list`, `queue plan`, `lanes`, and `queue watch` remain readable and report the hold. `queue ready` is unchanged and does not report the hold (D17).
- **NG-13**: Adding a doctor verdict, a doctor summary count, a doctor condition-catalog entry, a doctor evidence source, or a doctor area.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|---|---|---|
| F-1 | One owner-hold fact with two equivalent sources, declared precedence, and a bounded reason | Two ways to declare a pause must resolve to one fact, or the shell and the engine can disagree. |
| F-2 | DM-1 owner-hold condition and an indefinite sleep driver | The hook must keep deferring for as long as the hold exists, not for a pre-computed window. |
| F-3 | Install, uninstall, and test registration of the new example | An uninstalled or untested example is not a shipped capability. |
| F-4 | Global queue gate: fact-driven suppression, claim and dispatch refusal, park-recovery skip, and resume semantics | The queue and dispatch engine, not only the wrapper, must obey the operator. |
| F-5 | Additive status providers evidence member and human rendering | A pause an operator cannot see is a pause they cannot verify. |
| F-6 | Additive doctor provider detail on an otherwise-`ok` check | A held system must be visible without being misclassified as a defect. |

### 5.1 Capability Details

#### F-1 — One owner-hold fact with two equivalent sources

1. The hold is represented by one contract fact with two equivalent sources:
   - **Environment**: the brand-derived variable `<PREFIX>_OWNER_HOLD`, where `<PREFIX>` is `BrandIdentity.environmentPrefix` with its trailing underscore normalized once (`ADOS_OWNER_HOLD` in this repository). It is derived, never hardcoded.
   - **Marker**: the regular file named `owner-hold` inside the directory the production store identity actually uses, `<home>/<brand.stateDirectoryName>` (`$HOME/.ados-state` for this product). The engine never derives that directory from an ambient working directory, never honours a store-relocation override for the hold, and never reads outside it.
2. **Activation**: the environment source is active when the variable is present with a length greater than zero; the marker source is active when the path exists. Environment wins over marker when both are active (DEC-7). If neither is active, the fact is inactive.
3. **Reason**: for the environment source the reason is the variable's value; for the marker source the reason is the first line of the file. In both cases the reason is trimmed and sanitized per item 6; if it is empty after sanitization the reason is omitted, and the hold remains active. An empty marker file is therefore an active hold without a reason.
4. **Presence is the hold, content is only the reason.** A marker that exists but cannot be read, is not a regular file, or cannot be stat'd deterministically is treated as active with source `marker` and no reason (fail-closed, DEC-7). A path that does not exist is the only inactive marker outcome.
5. The fact reports the source that won, so a surface can distinguish an environment hold from a marker hold.
6. **Reason bounds and sanitization**: strip C0 and C1 control characters and ANSI escape sequences, replace line breaks and tabs with one space, collapse whitespace runs, trim, and truncate to at most 160 characters with no ellipsis. The bound applies before the reason enters any payload, line, or log.
7. **Resolution budget**: at most one existence check and one bounded read of at most 4 096 bytes of the marker per resolution; zero network calls, zero credential reads, zero state writes.
8. **Re-resolution**: the fact is resolved on every scheduling pass, every status and doctor run, and every hook evaluation. Nothing caches the fact across passes, so a marker removed (or an environment cleared in a new process) is observed without restarting a long-lived process.
9. The marker source depends on the production store directory. If a composition cannot resolve a home directory, only the environment source applies, and the missing directory is reported by that composition's existing configuration handling, not by the hold fact. No ambient path is read and no store relocation is introduced.
10. The fact shape is a discriminated union so an inactive fact cannot carry a source or a reason, and an active fact always names its source. The inactive arm is the only arm that may be omitted from a payload.

**Rationale.** Two declaration forms exist because the two enforcement paths have different lifetimes: a shell wrapper sees an exported variable, while a long-lived process must observe a file. Resolving both into one fact, with a declared precedence and fail-closed marker handling, is what stops the shell and the engine from disagreeing about whether delivery is paused. There is deliberately no custom marker-path setting: a shell-only path would leave the typed engine unheld, which is the exact split this change exists to remove (D12).

#### F-2 — DM-1 owner-hold condition and an indefinite sleep driver

1. The example ships one condition named `howLongToSleepDueToOwnerHold()`, conforming to the delivered hook condition contract (GH-150 DM-1): it echoes exactly one non-negative integer of seconds and emits at most one diagnostic line to stderr. Unlike the zai example, the dedicated owner-hold example has no provider or model activation gate: it applies to every agent and every model, because an owner pause is provider-independent.
2. While the hold is active it echoes the configured poll interval in seconds; while inactive it echoes `0`. It never emits a time-bounded number that would let the driver proceed early, because an operator hold has no expiry.
3. The example recognises exactly two settings: `ADOS_OWNER_HOLD` (the environment reason; non-empty activates) and `ADOS_OWNER_HOLD_POLL_SECONDS` (the poll interval, default `300`). The marker path is fixed to the production store directory (`$HOME/.ados-state/owner-hold` for this product), and the example accepts no marker-path override, because a shell-only path would leave the typed engine unheld (D12). An unset, empty, or whitespace-only `ADOS_OWNER_HOLD_POLL_SECONDS` uses `300` silently. A non-empty value is accepted only as an integer in the inclusive range `1`–`3600`; a non-integer, zero, negative, or out-of-range value uses `300` with exactly one bounded warning. It never falls back to `0` or to a busy loop.
4. The driver takes the **maximum** seconds across its registered conditions and re-evaluates after every sleep, so conditions compose by MAX. The hold therefore outranks every time-bounded condition: when a peak condition asks for 3 600 seconds and the hold asks for 300, the driver sleeps 3 600; after the window ends, the hold still asks for 300 and the driver keeps sleeping.
5. **No fixed loop cap while the hold is active.** The driver must not apply the zai example's `ADOS_ZAI_MAX_SLEEP_LOOPS`-style defensive cap to a hold. A hold can last days; proceeding after a fixed number of polls would reintroduce the incident. The example ships with no iteration cap, and the composition guidance states that merging a time-bounded condition into this hook inherits the unbounded driver because the hold is the reason the loop exists.
6. Each sleep emits exactly one bounded reason line naming the source, the reason when present, and the poll interval, for example `[INFO] (pre-opencode-iteration-owner-hold) owner-hold (marker): peak-hour cost pause; sleeping 300s`. When no reason is present the `: <reason>` segment is omitted, giving `[INFO] (pre-opencode-iteration-owner-hold) owner-hold (env); sleeping 300s`. The line never contains a newline, control characters, or an unbounded reason.
7. The condition is the only default registration. The example's header documents how to append a peak, quota, or maintenance condition to the same registry, and that composition is by MAX with the hold as the floor.
8. Removing the hold makes the next evaluation echo `0`; the driver then returns `0` and the wrapper spawns or resumes normally. If the marker is removed while the driver sleeps, the condition is not seen until that sleep ends: the resume latency is therefore at most one poll interval plus the hook's own evaluation. The hold decision uses no absolute time, so a clock jump, timezone change, or DST transition can neither end a hold nor extend a deferral beyond one poll interval.
9. The hook remains a pure gate. It writes no `ADOS_HOOK_ENV_V1` output, creates no state, and does not kill or signal a running session.

**Rationale.** The delivered example already has a correct sleep driver, but it is built around waits that end. Reusing the DM-1 condition contract keeps one extension point, while removing the fixed loop cap for the hold is the difference between "defer until a window" and "stay stopped until the operator says go".

#### F-3 — Install, uninstall, and test registration of the new example

1. The example is a new file at `scripts/hooks/pre-opencode-iteration-owner-hold.sh`, executable, with the same inactive-example posture as the zai example: installation copies it and does not activate it.
2. `install.sh`'s `ADOS_HOOK_EXAMPLES` list names both examples; the existing copy loop installs the new file executable and preserves operator edits through the existing updatable-file rule.
3. `uninstall.sh`'s unconditional delivery-file removal list names the new example, so an uninstall removes it and then removes the empty `scripts/hooks/` directory exactly as it does today.
4. The install and uninstall shell-test fixtures create and assert both example hook paths, so the inventory is covered rather than assumed.
5. The example has its own deterministic test at `scripts/.tests/test-hook-owner-hold-example.sh`. It sources the hook, overrides the sleep seam and the marker-reader seam, uses temporary directories for marker fixtures, performs zero real sleeps, and makes zero network calls. It is auto-discovered by the bash-suite runner's `*/.tests/test-*.sh` discovery.
6. The example passes `shellcheck` with zero findings and passes the repository's shell conventions for strict mode, quoting, and `readonly` declarations.
7. Neither the new example nor its test is added to a wrapper or to the SHA-pinned legacy surface; the pin at `tests/structure/provider-surface.test.ts` stays green because no pinned file changes.

**Rationale.** An example that is not installed is not discoverable, and an example that is not tested drifts. Registration in both inventories and one deterministic suite is the cheapest way to keep the new path honest without touching a pinned wrapper.

#### F-4 — Global queue gate: fact-driven suppression, claim and dispatch refusal, park-recovery skip, and resume

1. **Injected fact.** The scheduling facts gain one optional `ownerHold` fact; absent means inactive. The CLI queue, lanes, dispatch, status, and doctor compositions and the MCP status composition resolve it per pass and supply it; a composition test pins that the production path supplies the fact, because an omitted fact silently restores the defect.
2. **Schedule suppression.** When the fact is active, one scheduling pass emits an empty `nextActions` list and no preemption proposal. Every entry is gated without rewriting its own reason set:
   - an entry that would be `ready` becomes `held` with `owner-hold` as its first blocking reason;
   - an entry already `held` or `not-ready` keeps its state and gains `owner-hold` as its first blocking reason, followed by its own conditions;
   - an entry with an `active` park stays `parked` with `parked:<cause>`;
   - an entry with a `stuck` park stays `stuck` with `park-condition-stuck`;
   - an entry whose park would otherwise be `resumable` (its window passed while recovery was skipped) is `held` with `owner-hold`, because the operator is now what holds it.
3. **Claim refusal.** The pre-fence claim gate evaluates the hold before parks and readiness conditions and refuses `queue.precondition.unmet` with the blocking-reason token exactly `owner-hold` (the `parked:<cause>` template remains a separate park reason and is never conflated with it). The composition checks the hold **before ref selection**, so `queue claim` with no ref also refuses with `owner-hold` and never falls through to `no-eligible-action`. The bounded claim detail separately names the source and the sanitized reason, for example `owner hold active (marker): peak-hour cost pause`. The fenced claim itself also receives the fact and refuses before acquiring the fence, so a caller that bypasses the pre-fence gate cannot claim either. Zero lease records are written.
4. **Dispatch refusal.** The production dispatch claim seam resolves the same fact before claiming and returns the existing refusal identity with a bounded summary naming the hold; the engine carries that summary into the refusal envelope. No lease, session, branch, worktree, attempt, divergence, handover, or authority change exists for that dispatch. This reuses `queue.precondition.unmet`; no new error identity is introduced. The result is a classified user-validation refusal at exit `1`, not an internal wait: a caller that wants deferral semantics must treat the `owner-hold` token as wait/do-not-abort (D19).
5. **Composed supervision and watch.** Any composed supervision cycle whose next-action seam derives from the held scheduling pass receives no action while held, and its claim seam refuses as in item 3; the production resident-daemon entry does not supply those seams today (it is the resident-daemon spec's documented residual), so this is a conditional guarantee, not a claim about production daemon wiring (D14). `queue watch` keeps streaming read payloads that carry the hold and an empty action list; it claims nothing. No daemon-lane record is written by a cycle composed from the held pass.
6. **Park-recovery skip.** While the hold is active, the mutating park-recovery pass is not invoked at all: no `clear-observed` marker, no `recovered` record, and no `park-auto-recovery` incident is appended. Read-only surfaces may still evaluate and display park state. A park that reached its provider window therefore stays durably parked.
7. **Payload presence and lane rendering.** The list, plan, and read payloads carry the active fact as an additive optional `ownerHold` member, present only when active. Lanes carry the hold through their existing idle reason; no lane payload shape changes. Because a lane renders exactly one reason (`blocking[0]`), a not-ready lane's specific idle reason is masked by `owner-hold` on the `lanes` surface while the hold is active; `queue list` retains the full ordered `blocking[]` list, so an operator seeking the specific reason reads `queue list`. `queue ready` is unchanged and carries no hold (D17).
8. **Resume semantics.** Removing the hold mutates nothing. The next pass sees an inactive fact, and the delivered selection, claim, park-recovery, and session-resume paths run unchanged against the state that existed at hold entry. No entry, lease, park, incident, daemon lane, handoff, lane identity, or session handle was rewritten, so work resumes from preserved state with no re-dispatch from scratch and no duplicate session.
9. **Delivering lanes are not killed.** A lane that is already `delivering` stays `delivering`; the hold has no cancellation semantics. The documented consequence is that a mid-flight session may still end in a provider cut-out and leave a `partial` lane.
10. **Bookkeeping remains possible.** `queue add`, `queue prioritize`, `queue dep`, and `queue release` continue to work while held, because they are operator bookkeeping rather than delivery starts; the recovery pass they would normally trigger is skipped. Claim is the only mutation refused.
11. **Closed vocabularies preserved.** The hold adds exactly one lane idle/blocking reason token, `owner-hold`. It adds no park cause, no park condition type, no recovery state, no state record kind, and no queue-ready condition; the six ready condition ids, their order, and their evidence vocabulary are unchanged. The existing error identity's remediation text is updated to name an operator hold as one of the named blocking preconditions, without adding an identity.
12. **Unreadable queue facts.** If the queue facts cannot be read, the delivered state failure is returned unchanged (exit `2`); a hold never manufactures a queue payload over unreadable state. The hold remains visible through the independent `status` and `doctor` surfaces, whose provider facts and injected hold do not depend on the queue store.

**Rationale, including the ticket's "park without `--until`" intent.** The ticket asks for a queue-level hold that parks without an expiry. A new park cause is not used: it would require a new condition type, break the declared one-to-one cause-condition pairing and the closed recovery-state set, add a state record family, and force a cleanup record on removal. The global gate produces every observable outcome the ticket asks for — no new dispatch, no automatic recovery at a provider window, no composed-supervision or watch claim, and preserved state on removal — without writing a park at all. It also satisfies the three acceptance bullets directly: a new dispatch is refused with a reason naming the hold; a parked lane does not resume at its provider window because recovery is skipped; a supervision cycle composed from the held pass and `queue watch` claim nothing because next actions are empty and the claim gate refuses (the production daemon entry remains the resident-daemon spec's residual, D14). Removal needs no repair because nothing was written.

#### F-5 — Additive status providers evidence member and human rendering

1. The status digest's `providers` section gains one additive optional **evidence-level** member `ownerHold`, a sibling of `sources[]` exactly like `credentialPrerequisite`, carrying the source and the optional sanitized reason and present only when the hold is active. It is part of the section's `evidence` record (`providers.evidence.ownerHold`), not a sibling of `chain`, `entries`, or `parks`.
2. The member is attached to the derived evidence record, so it is visible regardless of that section's own state (`observed`, `degraded`, `unknown`, or `unavailable`). It does not change the section state, counts, sources, truncation, findings, entry availability, or park rendering.
3. No section, state, evidence source, or reason is added: the nine-section order and the closed twenty-reason set are unchanged, and the digest schema version stays as delivered.
4. Human mode appends a bounded owner-hold token to the existing `providers` line: `| owner-hold` when the reason is absent, or `| owner-hold: <reason>` when present. The existing human clamp remains the outer bound.
5. The runtime resolves the fact through one optional `readOwnerHold` reader, and the provider facts carry it. The CLI and the MCP status runtime compose the same reader so the machine payload is identical across surfaces.
6. The status surface performs no credential read, no extra state read, and no write; a held system still exits `0` with a complete nine-section digest.

**Rationale.** The operator needs a place to confirm that a pause took effect and, later, that it is gone. The providers section is the natural home because the hold is about provider availability, and the credential-prerequisite precedent shows that one optional evidence-level member is enough, with no new section and no new reason.

#### F-6 — Additive doctor provider detail on an otherwise-`ok` check

1. The provider check's injected facts gain one optional `ownerHold` fact. The check's existing precedence is unchanged: configuration failures, unresolved credentials, credential-caused parks, an unreadable park fold, and contained execution keep their verdicts first.
2. When and only when the provider check would otherwise be `ok` and the hold is active, the check keeps the `ok` verdict and adds the new closed evidence reason `owner-hold`, and it appends a bounded hold segment to the existing provider detail rather than replacing it — `<existing detail>; owner hold active (marker): peak-hour cost pause`, or `<existing detail>; owner hold active (env)` when the reason is absent. `owner-hold` is a **non-failing annotation reason**: it carries no evidence source, may co-occur with `ok`, and is the fourth and last admissible provider reason (`DOCTOR_MAX_EVIDENCE_REASONS` is four). It changes no verdict, hint, or exit, and adds no fix hint. When appending would exceed `DOCTOR_MAX_DETAIL_CHARS`, truncate the existing detail to fit and keep the whole hold segment; never truncate the hold segment mid-word or drop it (D18). The hold segment alone fits within `DOCTOR_MAX_DETAIL_CHARS` at the 160-character reason cap, so it is never unrenderable.
3. No verdict, summary count, exit rule, condition-catalog entry, evidence source, or area is added. `DOCTOR_VERDICTS` stays `ok`, `fail`, `unreachable`; `DoctorSummaryCounts` is unchanged; a held system still exits `0`; the condition catalog is unchanged.
4. The new evidence reason is exactly one: `owner-hold`, inserted into the closed reason set immediately after `park-credential-cause`; every other value keeps its delivered position. No other reason is added.
5. When any provider defect exists — configuration invalid, chain unresolved or not declared, credential unavailable, credential-caused park, or an unreadable park fold — the existing `fail` or `unreachable` verdict and reason win unchanged, and the `owner-hold` reason is not added to that check. The hold remains visible through `status`.
6. Human output prints the existing provider row with the hold segment appended to the existing bounded detail, for example `provider  ok          provider chain and credentials resolve; no active park; owner hold active (marker): peak-hour cost pause`. `DOCTOR_MAX_DETAIL_CHARS` is the outer limit, and the same truncate-the-existing-detail rule applies: the whole hold segment is kept and the existing detail yields to it. With no hold, every field and every byte of the human row is exactly as delivered.
7. Machine output differs only by the additive `owner-hold` reason and the appended hold segment on the existing bounded detail; the same clamp rule applies, and verdict, summary counts, evidence sources and outcomes, and every other field are unchanged.

**Rationale.** A `doctor` run on a held system should report the pause without reclassifying it: the provider may be perfectly available, and a deliberate pause is not a wiring defect. Keeping `ok` and appending one hold segment plus its reason makes the hold visible without discarding the existing provider detail, while leaving the verdict vocabulary, the summary shape, the condition catalog, and the exit model untouched. `status` remains the surface that shows the hold even when a real provider defect wins in `doctor`.

## 6. USER & SYSTEM FLOWS

```text
Flow 1 — Declaring an owner hold
  operator: mkdir -p "$HOME/.ados-state" && printf 'peak-hour cost pause\n' > "$HOME/.ados-state/owner-hold"
            (or) export ADOS_OWNER_HOLD="peak-hour cost pause"
    -> every surface resolves one fact:
         env present and non-empty -> active, source env, reason "peak-hour cost pause"
         else marker exists        -> active, source marker, reason from first line
         else                      -> inactive
    -> status providers evidence: "providers ... | owner-hold: peak-hour cost pause" (providers.evidence.ownerHold)
    -> doctor provider check: "provider  ok          provider chain and credentials resolve; no active park; owner hold active (marker): peak-hour cost pause"
                                (verdict stays ok; hold segment appended to the existing detail; no hint; no summary or exit change)

Flow 2 — A new iteration is about to start (shell path)
  ceo-loop.sh / deliver-ticket.sh -> configured pre-opencode-iteration hook
    -> howLongToSleepDueToOwnerHold() echoes 300
    -> driver: "[INFO] (pre-opencode-iteration-owner-hold) owner-hold (marker): peak-hour cost pause; sleeping 300s"
    -> sleep 300, re-evaluate, sleep again ... (no fixed cap)
    -> a provider window condition in the same registry may ask for more; MAX wins
    -> no spawn, no resume, no session, no cost

Flow 3 — A provider window opens during the hold (typed path)
  queue scheduling pass
    -> ownerHold active -> nextActions = []
    -> ready entry -> held, blocking [owner-hold]
    -> park whose window expired -> recovery pass skipped; park record unchanged
  a supervision cycle composed from the held pass (the production daemon entry remains the resident-daemon residual)
    -> next action undefined -> mode idle
  queue claim            (ref omitted or supplied)
    -> refusal before ref selection: queue.precondition.unmet, reason=owner-hold, detail names the source/reason, exit 1, 0 records
  dispatch GH-XXX
    -> refusal before claim: queue.precondition.unmet, summary names the hold
    -> classified user-validation refusal at exit 1 (deferral callers treat owner-hold as wait/do-not-abort)
    -> 0 leases, 0 sessions, 0 attempts

Flow 4 — Removing the hold
  operator: rm "$HOME/.ados-state/owner-hold"   (or) unset ADOS_OWNER_HOLD
    -> next pass: ownerHold inactive
    -> entries, leases, parks, daemon lanes, handoffs, session handles unchanged
    -> overdue park: the delivered recovery pass appends clear-observed, recovered, incident
    -> the delivered resume path resumes the recorded session; no new branch, no second session
    -> the next hook evaluation returns 0 and the wrapper proceeds (at most one poll interval later)

Flow 5 — A hold exists while a lane is already delivering
  owner hold created
    -> scheduling stops selecting new work
    -> the delivering lane is not signalled, killed, or parked
    -> the session ends on its own or is cut out by its provider; a partial lane may remain
    -> removal resumes from the preserved state; the hold is not a kill switch
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- C1: One owner-hold contract fact, two equivalent sources, declared precedence, sanitized reason bound, fail-closed unreadable marker, and per-pass resolution (F-1).
- C2: The new DM-1 example hook with `howLongToSleepDueToOwnerHold()`, the poll-interval setting, the unbounded driver, and the reason line (F-2).
- C3: Install, uninstall, fixture, and shell-test registration of the new example (F-3).
- C4: The global queue gate over the injected fact: schedule suppression, lane reason, claim refusal, dispatch refusal, park-recovery skip, payload presence, and resume semantics (F-4).
- C5: The additive status providers evidence member and its human rendering, with MCP parity (F-5).
- C6: The additive doctor provider detail and one new evidence reason on an otherwise-`ok` check, with no new verdict, summary count, condition, or exit change (F-6).
- C7: Documentation that distinguishes provider-window deferral from owner hold and documents hook composition, plus reconciliation of the affected feature specs and command reference pages.
- C8: The vocabulary, golden, inventory, and composition-test updates required to make the additions regression-proof.

### 7.2 Out of Scope

- [OUT] Killing, aborting, pausing, or signalling a mid-flight session or an already-delivering lane (NG-1).
- [OUT] A queue park cause, park condition type, recovery state, or park record for the owner hold (NG-2).
- [OUT] A new state record kind, payload schema, store document, or migration (NG-3).
- [OUT] A seventh queue-ready condition or any change to the six delivered condition ids, order, tri-state, or evidence (NG-4).
- [OUT] A tenth status section, a new section state, a new status evidence reason, or a new finding code (NG-5).
- [OUT] A new doctor verdict, a doctor summary count, a doctor condition-catalog entry, a doctor evidence source, or a doctor area (NG-13).
- [OUT] Any edit to `deliver-ticket.sh`, `ceo-loop.sh`, `batch-deliver.sh`, the hook invocation contract, or a SHA-pinned wrapper byte (NG-6).
- [OUT] Any cloud, vendor, or product naming, or a hardcoded brand literal in tooling code (NG-7).
- [OUT] A new command, flag, configuration key, or `--park` cause, including an `--until`-less park (NG-8).
- [OUT] Changing provider-window, provider-quota, or preemption semantics, expiries, or recheck cadence (NG-9).
- [OUT] Real network calls, real sleeps, real daemon processes, or real harness sessions in tests (NG-10).
- [OUT] Backfilling hold state into historical incidents or attributing the 2026-11-09 cost retroactively (NG-11).
- [OUT] A GUI, dashboard, notification, or telemetry event for the hold (NG-12 read-only inspection remains in scope).
- [OUT] An owner hold that survives the deletion of both sources, or a hold with a scheduled expiry.

### 7.3 Deferred / Maybe-Later

- A hold that pauses a mid-flight session gracefully at the next safe boundary, as a separate change with its own cancellation semantics.
- A hold with an automatic expiry or a scheduled pause window, distinct from an operator hold.
- A dedicated `owner hold` command family that writes and clears the marker through the typed CLI instead of the shell.
- Hold-aware provider resolution that parks or announces a provider while held.
- A queue status section that is wired to the engine and could therefore render the hold in `lanes-or-queue`.
- An audit-ledger record for hold creation and removal, if operators need a durable provenance trail.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. The hold resolution performs no network call. No provider endpoint, tracker endpoint, or credential source is contacted by any hold-related surface, and no existing request shape changes.

### 8.2 Events / Messages

None. No queue notification, capsule event, telemetry event, or hook-return message is added. The hook remains a pure DM-1 gate and writes no `ADOS_HOOK_ENV_V1` output. The status digest, doctor report, queue read payloads, and lane payloads are existing read envelopes with additive optional members.

### 8.3 Data Model Impact

| ID | Element | Description |
|---|---|---|
| DM-1 | `OwnerHoldFact` and `OwnerHoldSource` | The single contract fact shared by the hook-facing documentation, the queue, status, and doctor. `OwnerHoldSource` is the closed two-value set `env` \| `marker`. `OwnerHoldFact` is a discriminated union: `{ active: false }` or `{ active: true; source: OwnerHoldSource; reason?: string }`. Declared once in a dedicated core contract module (`packages/core/src/contracts/owner-hold.ts`) and re-exported through the contracts barrel. `reason` is bounded to 160 sanitized characters and is optional because an empty marker or a whitespace-only variable is still an active hold. |
| DM-2 | Owner-hold constants | `OWNER_HOLD_ENV_SUFFIX = "OWNER_HOLD"`, `OWNER_HOLD_MARKER_NAME = "owner-hold"`, `OWNER_HOLD_MAX_REASON_CHARS = 160`, `OWNER_HOLD_DEFAULT_POLL_SECONDS = 300`, `OWNER_HOLD_MAX_POLL_SECONDS = 3600`. The variable name is `brand.environmentPrefix` normalized once plus the suffix, never a literal. |
| DM-3 | Queue scheduling fact | `QueueSchedulerFacts` (declared in `packages/core/src/domain/queue-readiness.ts`) gains one optional member `ownerHold?: OwnerHoldFact`, consumed by the scheduling pass. Absent means inactive. |
| DM-4 | Queue read payload member | `QueueReadData.ownerHold?: OwnerHoldFact` in `packages/core/src/contracts/queue.ts`, present only when active; `QueueListData` and `QueuePlanData` inherit it. `QueueLanesData` is unchanged, and `QueueReadyPayload` is unchanged and carries no hold (D17). |
| DM-5 | Lane and blocking reason token | The closed `QUEUE_LANE_IDLE_REASONS` gains exactly one token, `owner-hold`, appended to the declared array. `QUEUE_BLOCKING_REASONS` inherits it through the existing spread. No park cause, condition type, or recovery state is added. `owner-hold` (a delivery pause) is distinct from `owner-gate` (the merge owner-approval gate); the two tokens are unrelated. |
| DM-6 | Claim and dispatch refusal | `evaluateClaimPreconditions` and `claimQueueLease` refuse with code `queue.precondition.unmet` and the blocking-reason token exactly `owner-hold`; `parked:<cause>` remains a separate park reason and is never conflated with it. The bounded claim detail separately names the source and the sanitized reason (`owner hold active (<source>)` or `owner hold active (<source>): <reason>`); the `owner-hold` / `owner-hold: <reason>` shorthand used elsewhere in this spec describes the token form, not the claim-detail grammar. The dispatch claim seam returns `{ ok: false, code: "queue.precondition.unmet", summary: "owner hold active: <reason>" }`; `DispatchLeaseClaim`'s failure arm gains an additive optional `summary`, and the dispatch engine carries it into the existing `error.summary`. No new error-table identity, no new domain-kind discriminant. |
| DM-7 | Status providers evidence member | `StatusEvidence.ownerHold?: { source: OwnerHoldSource; reason?: string }` in `packages/core/src/contracts/status.ts`, an evidence-level sibling of `sources[]` (`providers.evidence.ownerHold`), attached only to the `providers` section and only when active. It is not a sibling of `chain`, `entries`, or `parks`. `StatusProviderFacts.ownerHold?: OwnerHoldFact` carries the fact into the digest. No section, state, source, or reason is added. |
| DM-8 | Doctor evidence reason and detail | `DOCTOR_EVIDENCE_REASONS` gains exactly one value, `owner-hold`, inserted immediately after `park-credential-cause`; every other value keeps its delivered position. `owner-hold` is a non-failing annotation reason with no evidence source, may co-occur with `ok`, and is the fourth and last admissible provider reason (`DOCTOR_MAX_EVIDENCE_REASONS` is four). `DoctorProviderFacts.ownerHold?: OwnerHoldFact` carries the fact into the provider check. The check keeps the `ok` verdict, adds the `owner-hold` reason, and appends a bounded `owner hold active (<source>)` hold segment to the existing provider detail; when appending would exceed `DOCTOR_MAX_DETAIL_CHARS`, the existing detail is truncated to fit and the whole hold segment is kept (D18). It adds no fix hint and changes no verdict, hint, or exit. `DOCTOR_VERDICTS`, `DoctorSummaryCounts`, `DOCTOR_CONDITION_CATALOG`, the failure summary, and the exit model are unchanged. |
| DM-9 | Hold marker location | The marker path is `<home>/<brand.stateDirectoryName>/owner-hold` — the directory the production store identity actually uses (`$HOME/.ados-state/owner-hold` for this product). The marker is read from that fixed location; the design offers no marker-path override and does not use a store-relocation environment override, because a shell-only path would leave the typed engine unheld (D12). The engine never reads an ambient path; the composition supplies the directory and the marker-read outcome. |

### 8.4 External Integrations

None. No external API, vendor, credential source, or provider endpoint is added or called. The hold is entirely local: an environment value or a file in the production store directory, plus injected facts.

### 8.5 Backward Compatibility

- **No hold present.** Every surface is unchanged. Queue payloads have no `ownerHold` member, the status providers evidence record has no `ownerHold` member, the doctor provider check is byte-identical to the delivered output for the same facts, scheduling and claims are identical, and the hook example is inactive until selected.
- **Hold present.** Behavior changes deliberately: claims are refused, next actions are empty, park recovery is skipped, and read surfaces report the hold. This is the feature, not a regression.
- **Error identities.** `queue.precondition.unmet` keeps its category, retryability, consequence, projection, and exit; only its reason vocabulary gains `owner-hold` and its remediation prose gains an operator-hold mention. The error-table row count is unchanged.
- **Queue vocabularies.** One lane/blocking reason token is added. Park causes, condition types, recovery states, state record kinds, and queue-ready conditions are byte-unchanged. Consumers that switch exhaustively over the lane reason set must add the member; a consumer that ignores unknown tokens is unaffected.
- **Dispatch envelope.** A dispatch refused by a hold now carries a bounded `summary` on the existing `queue`-kind error where the seam otherwise carries only a code. The identity and exit are unchanged; no attempt record exists to read.
- **Status envelope.** One additive optional evidence-level member on the providers section's evidence record (`providers.evidence.ownerHold`), present only when a hold is active. Section states, counts, ordering, reasons, and exits are unchanged; consumers that ignore unknown optional fields are unaffected.
- **Doctor envelope.** The provider check can carry one additive optional evidence reason (`owner-hold`) and an appended hold segment on its existing bounded detail while staying `ok`. When appending would exceed `DOCTOR_MAX_DETAIL_CHARS`, the existing detail is truncated to fit and the whole hold segment is kept. The verdict vocabulary, the summary counts, the failure summary, and the exit model are unchanged; a report with a hold is a success envelope at exit `0`, exactly as a healthy report is today. Consumers that enumerate evidence reasons must add `owner-hold`; consumers that ignore unknown reasons are unaffected.
- **Hook examples.** The zai example is unchanged. The new example is installed but inactive; an adopter selects it exactly as before.
- **Wrappers.** `deliver-ticket.sh`, `ceo-loop.sh`, `batch-deliver.sh`, and the pinned legacy hook bytes are unchanged.
- **State store.** No record, schema, or migration change. A hold writes nothing, and removing it writes nothing.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|---|---|---|
| NFR-1 | Hold resolution cost | ≤ 1 existence check and ≤ 1 bounded marker read (≤ 4 096 bytes) per resolution; 0 network calls, 0 credential reads, 0 state writes, 0 process spawns |
| NFR-2 | Side-effect freedom while held | 0 queue entry, dependency, lease, park, incident, daemon lane, daemon heartbeat, handoff, attempt, divergence, or authority records written because of hold resolution or gating, by any scheduling pass, claim, dispatch, status run, doctor run, or hook evaluation while the hold is active; the invocation audit ledger is out of scope and is neither asserted nor extended |
| NFR-3 | Deferral latency | A new iteration starts deferring within one poll interval of hold activation; the default poll interval is 300 s and the accepted range is 1–3 600 s |
| NFR-4 | Resume latency | After hold removal, the next scheduling pass permits eligible claims and the next hook evaluation returns `0`; no restart of a wrapper or long-lived process is required |
| NFR-5 | Reason safety and bounds | Every rendered or persisted reason is a single line, contains no C0/C1 control character or ANSI escape, and is ≤ 160 characters; 0 raw newlines and 0 terminal control sequences reach a human surface |
| NFR-6 | Determinism | Identical injected facts (environment, production store directory, marker outcome) and clock produce byte-identical queue payloads, status digests, doctor reports, and hook decisions across runs |
| NFR-7 | Dispatch refusal naming | 100% of hold-refused dispatches carry `queue.precondition.unmet` and a bounded summary naming the hold and its sanitized reason; 0 new error identities and 0 new domain kinds |
| NFR-8 | Closed-vocabulary integrity | 0 new park causes, 0 new park condition types, 0 new recovery states, 0 new queue state record kinds, 0 new queue-ready conditions, 0 new status sections, 0 new status evidence reasons, and 0 new doctor verdicts; exactly 1 new lane/blocking reason and 1 new doctor evidence reason. The one-reason addition is pinned by exact two-way set equality for `QUEUE_LANE_IDLE_REASONS` and `QUEUE_BLOCKING_REASONS` against `closed-sets.json`, not inferred from a fixture edit (D16). |
| NFR-9 | Hook and test determinism | The new example performs 0 real sleeps and 0 network calls in its test; the test suite is deterministic under an overridden sleep seam; shellcheck reports 0 findings |
| NFR-10 | Fail-closed marker resolution | 100% of unreadable, non-regular, or stat-failing marker outcomes resolve to active with no reason; 0 such outcomes resolve to inactive |
| NFR-11 | Boundary integrity | 0 new `process.env`, `Bun.env`, or `Deno.env` reads in core; 0 new ambient filesystem reads in core; 0 hardcoded product, binary, or brand literals in tooling code; the ambient-globals check stays green |
| NFR-12 | Golden and inventory integrity | Every changed closed set, payload shape, doctor reason, and status golden is updated deliberately; 100% of goldens and inventories are regenerated from the declared contracts, and no assertion is deleted or weakened to pass |
| NFR-13 | Documentation conformance | Every changed document under the guides area declares `ados_distribution` and the distribution drift guard passes; the delivery-modes guide contains the two-semantics distinction in one place |
| NFR-14 | Read-only surfaces stay readable | `status`, `doctor`, `queue list`, `queue plan`, `lanes`, and `queue watch` complete with their delivered exit behavior while a hold is active and report the hold; `queue ready` is unchanged and does not report the hold (D17); `status` and `doctor` exit `0`, and the hold never makes a check or section non-ok |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- No new metric, log sink, trace span, event kind, or telemetry exporter. The observability surfaces are the existing ones: the hook's bounded reason line, the queue payload's `ownerHold` member and `owner-hold` blocking reason, the status providers evidence member and human suffix, the doctor `ok` provider detail and its additive evidence reason, and the refusal summary.
- The operator's primary signals are exact and local: the hook line `owner-hold (<source>): <reason>; sleeping <N>s` (the `: <reason>` segment is omitted when absent), the `status` providers token, and the `doctor` provider `ok` line carrying the appended owner-hold segment.
- The reason is operator-authored data. It is rendered as data only, never sourced, evaluated, or used to build a command, and it is bounded before rendering.
- No credential, token, or secret is observable through any hold path, because the path reads none.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|---|---|---|---|---|---|
| RSK-1 | A fail-closed unreadable marker (permissions, a flaky mount, a directory at the marker path) freezes delivery indefinitely | H | M | Presence-only activation, a bounded warning in the hook, the hold visible in `status` and `doctor`, and documentation that names the two sources and how to clear them; the hold is opt-in, so an operator who never creates it is unaffected | M |
| RSK-2 | An operator forgets to remove a hold and delivery stays paused for days | M | M | The hook names the source and reason every poll; `status` and `doctor` show the hold; docs give a one-line removal; the marker is a small named file, not hidden state | M |
| RSK-3 | The additive `owner-hold` doctor reason changes the machine output and goldens for held runs, and a consumer that enumerates doctor reasons must add it | M | M | The change is additive only: no verdict, summary count, condition, or exit moves; the no-hold output stays byte-identical; goldens are regenerated with an explicit held case and an explicit no-hold case; the doctor spec and reference page document the one new reason | L |
| RSK-4 | The global gate's `owner-hold` token masks a more specific reason on the `lanes` surface, because a lane renders exactly one reason (`blocking[0]`); an operator may not see why work was otherwise blocked | M | M | `owner-hold` is prepended, not substituted, in the entry's ordered `blocking[]`; `queue list` retains the full ordered blocking list so the specific reason remains readable there; active and stuck parks keep their own state and reason; the lane masking is documented and operators are pointed at `queue list` | L |
| RSK-5 | A hold does not stop a mid-flight session, so a declared pause can still spend capacity until the session ends or is cut out | H | L | Explicit non-goal and documented limit; the hold stops every new iteration and claim; a future graceful-pause change is deferred | M |
| RSK-6 | The composition omits the owner-hold fact, so the typed engine keeps scheduling while the shell defers | H | L | A production-composition test pins that the fact is supplied; the claim gate refuses independently of schedule suppression, so an omitted fact still cannot claim if the claim path resolves it; both paths read the same fact | L |
| RSK-7 | An operator expects to relocate the store (or to point the hook at a custom marker path) and the engine keeps reading the fixed production directory, so the hook defers while the engine claims | M | M | The marker path is fixed to `<home>/<brand.stateDirectoryName>/owner-hold`; no marker-path override is offered; the environment source works from any directory; relocating the store is explicitly out of scope and documented as such (D12) | L |
| RSK-8 | An untrusted or accidental reason injects terminal control sequences or a newline into human output | M | L | Strip C0/C1 and ANSI, collapse whitespace, bound to 160 characters, render as data, and cover both machine and human paths in tests | L |
| RSK-9 | Adding `owner-hold` to the closed lane/blocking vocabulary breaks a pinned fixture, a structural test, or a lane golden | M | H | Update the fixture and the structural test in the same change; regenerate queue and lane goldens; review the diff for deleted assertions | L |
| RSK-10 | A held system still reports the provider check as `ok`, so an operator may not notice the pause in `doctor` | L | M | The `ok` detail names the source and the reason, `status` carries the dedicated providers evidence member, and the docs make `status` the primary verification surface; `doctor` is a wiring surface, not the hold dashboard | L |
| RSK-11 | Setting the environment variable in one shell does not reach a long-lived process or another terminal, so the pause appears inconsistent | M | M | Docs recommend the marker file for a durable pause; `status` names the source, so an operator can see whether the active hold is `env` or `marker` | M |
| RSK-12 | `queue release --park` while held appends a park that the operator then expects to recover immediately on hold removal, but recheck cadence delays it | L | M | The delivered recheck cadence is unchanged and documented; recovery happens on the first due pass after removal; the hold never rewrites or removes a park | L |
| RSK-13 | The daemon half of the acceptance is conditional: a supervision cycle that does not derive its next action from the held scheduling pass is outside this change's guarantee | M | L | The guarantee is stated conditionally in F-4.5, §13, and AC-F4-4; the production daemon entry remains the resident-daemon spec's documented residual; the test derives its seam from the held pass rather than asserting a tautology (D14) | M |

## 12. ASSUMPTIONS

- A-1: The existing wrappers already invoke the configured hook before every spawn and resume, so no wrapper edit is needed to defer new iterations (D5).
- A-2: The production store identity uses `<home>/<brand.stateDirectoryName>` (`$HOME/.ados-state` for this product), so a marker placed at `<home>/<brand.stateDirectoryName>/owner-hold` is visible to the engine. Relocating the store and custom marker paths are out of scope (D12).
- A-3: A non-empty environment value or an existing marker is a sufficient declaration of intent; no confirmation, signature, or second factor is needed.
- A-4: A hold is operator intent, so a read-only surface reporting it is not a failure; `status` and `doctor` therefore do not turn a hold into an error exit.
- A-5: The delivered resume path already reuses a recorded session and lane identity, so leaving state untouched is sufficient to avoid re-dispatch and duplicate sessions.
- A-6: The delivered park recovery is the only queue mutation that would resume a window-expired park, so skipping that pass while held is sufficient to keep it parked.
- A-7: The environment prefix and state directory name are brand-derived, so no new hardcoded product name is required in tooling code; the shell examples keep the repository's existing `ADOS_*` example convention.
- A-8: Test fixtures can inject the hold fact, the marker outcome, and the sleep seam independently, so no test needs a real filesystem race, a real daemon, or a real sleep.
- A-9: The daemon half of the acceptance is conditional: any composed supervision cycle that derives its next action from the held scheduling pass is covered, while the production resident-daemon entry remains the resident-daemon spec's existing residual and is not a claim source (D14).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|---|---|---|
| Depends on | DM-1 pre-iteration hook contract and the zai example | The new example follows the same condition-function contract, seam discipline, and pure-gate posture. The zai example is unchanged. |
| Depends on | Hook invocation in the wrappers | The deferral works because both wrappers already run the hook before every spawn/resume; the wrapper bytes stay pinned. |
| Depends on | Install and uninstall inventories | `ADOS_HOOK_EXAMPLES` and the unconditional delivery-file removal list are the registration points; the fixtures must assert both examples. |
| Depends on | Queue closed vocabularies and the structural fixture | One lane/blocking reason token is added; the fixture and its structural test are updated in the same change, with exact two-way set equality for `QUEUE_LANE_IDLE_REASONS` and `QUEUE_BLOCKING_REASONS` (D16). |
| Depends on | Queue scheduling, claim gate, lease, and lane fold | The gate inserts before park and readiness evaluation, and the claim refuses before the fence; no record shape changes. |
| Depends on | Park evaluation and recovery | The mutating recovery pass is skipped while held; read evaluation is unchanged. |
| Depends on | Dispatch engine claim seam and result envelope | The claim failure gains an additive optional summary, and the engine carries it into the existing error; no new identity or kind. |
| Depends on | Composed supervision | A supervision cycle that derives its next action from the held scheduling pass receives no action and cannot claim. The production resident-daemon entry supplies neither seam today and remains the resident-daemon spec's documented residual, so this is a conditional guarantee and not a production wiring claim (D14). |
| Depends on | Production store directory and store identity | The marker path is fixed to `<home>/<brand.stateDirectoryName>/owner-hold`; the shell example uses the same fixed default, and neither a store relocation nor a marker-path override is offered (D12). |
| Depends on | CLI and MCP production composition | Both must resolve and supply the fact per pass at the production store directory; a composition test pins the wiring. |
| Depends on | Status digest collector and doctor provider check | One additive evidence-level member, one non-failing annotation reason, and one appended detail segment; no verdict, summary count, condition, or exit change, and goldens/inventories regenerate from the contracts. |
| Blocks | Any future change that assumes a provider window is the highest-priority wait | The hold is now the highest-priority operator wait and must be considered by later scheduling work. |

## 14. OPEN QUESTIONS

None. Every decision needed for delivery is fixed in §15. The doctor surface is additive in the strict sense: one evidence reason and one `ok` detail, with the verdict set, summary counts, condition catalog, and exit model unchanged, so there is no planning-input-versus-contract tension left to resolve.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|---|---|---|---|
| DEC-1 | **Owner-hold sources (D1, corrected by D12).** Two equivalent sources resolve to one fact: the brand-derived environment variable `<PREFIX>_OWNER_HOLD` (a non-empty value is the operator reason) and a marker file named `owner-hold` in the production store directory `<home>/<brand.stateDirectoryName>` (`$HOME/.ados-state` for this product). The design offers no marker-path override and does not use a store-relocation environment override, because a shell-only path would leave the typed engine unheld; relocating the store is out of scope. Removing both sources clears the hold with no state loss. | An operator pause must be declarable from a shell and durable across terminals; one fact at the directory the engine actually reads is what keeps the shell and the engine from disagreeing. | 2026-11-10 |
| DEC-2 | **Global read-only gate (D2).** The typed engine models the hold as a global read-only gate over an injected fact, not as a queue park cause and not as a state record. The three park condition types, three causes with their declared pairing, four recovery states, five state record kinds, and six queue-ready conditions stay closed. | A hold is operator intent, not a provider condition; modelling it as a park would force a new pairing, a new record, and cleanup on removal. | 2026-11-10 |
| DEC-3 | **Read-only status and doctor surfaces (D3, D15).** Status carries one additive optional evidence-level member `ownerHold` on the providers section's evidence record (`providers.evidence.ownerHold`), a sibling of `sources[]` following the credential-prerequisite precedent: no tenth section and no new status reason, and not a sibling of `chain`, `entries`, or `parks`. Doctor carries the hold as an additive provider-check detail with exactly one new closed evidence reason, `owner-hold`, while the check keeps the `ok` verdict: a deliberate pause is not a wiring defect. No verdict, summary count, exit rule, condition, source, or area is added; when a real provider defect exists its `fail` or `unreachable` verdict and reason win unchanged, and the hold remains visible through `status`. | The operator must be able to verify a pause without reading queue internals, and the doctor surface must not turn operator intent into a defect or change the exit model. | 2026-11-10 |
| DEC-4 | **Dedicated example hook (D4).** Ship `scripts/hooks/pre-opencode-iteration-owner-hold.sh` with `howLongToSleepDueToOwnerHold()` under the DM-1 contract. Register it in `ADOS_HOOK_EXAMPLES`, remove it in `uninstall.sh`, and cover it with its own deterministic shell test. The delivery-modes guide documents merging it with peak and quota conditions: conditions compose by MAX, and the hold keeps sleeping after every time-bounded window ends. | The hold must work from the shell before it works from the engine, and the composition rule is what makes it outrank a window. | 2026-11-10 |
| DEC-5 | **No wrapper behavior changes (D5).** `deliver-ticket.sh` and `ceo-loop.sh` already invoke the configured hook before every spawn and resume; `ceo-loop.sh` is SHA-pinned by the provider-surface test. Delivery is through the example hook, the engine gate, and docs. | Editing a pinned wrapper would add risk without adding capability; the invocation point already exists. | 2026-11-10 |
| DEC-6 | **Refuse claims and skip recovery (D6).** While held, claim and dispatch are refused and the park auto-recovery mutation is skipped, so a park that reached its provider window stays parked. Read-only surfaces may still evaluate and display the park, but no recovery record is appended and no lane is claimed. | Refusing only new actions without skipping recovery would let the queue silently perform the resume the operator stopped. | 2026-11-10 |
| DEC-7 | **Resolution precedence, fixed marker location, and fail-closed marker.** The environment source wins over the marker when both are active. The marker is read only from `<home>/<brand.stateDirectoryName>/owner-hold`; no marker-path override and no store relocation is introduced (D12). Presence is the hold and content is only the reason: an empty marker is active without a reason, a whitespace-only variable is active without a reason, and an absent path or an unset/empty variable is inactive. An unreadable, non-regular, or stat-failing marker is active without a reason (fail-closed). | A pause must not be silently released by an empty file, a whitespace value, or a permissions accident; fail-closed matches "the operator said stop". | 2026-11-10 |
| DEC-8 | **Reason and composition boundary.** The reason is stripped of C0/C1 control characters and ANSI escapes, collapsed to a single line, trimmed, and truncated to 160 characters before any payload or line. Core resolves the fact from injected inputs only (environment record, production store directory, marker-read outcome); the CLI and MCP compositions supply the filesystem read, so core stays ambient-free. The fact is re-resolved per pass and per hook evaluation, never cached across passes. | A long-lived process must notice a marker removal without a restart, and untrusted operator text must never reach a terminal raw. | 2026-11-10 |
| DEC-9 | **Dispatch refusal carriage.** The production dispatch claim seam returns `queue.precondition.unmet` with an additive optional `summary` naming the hold; the dispatch engine carries it into the existing error summary. No new error identity, domain-kind member, or exit is introduced. | The operator must see why dispatch refused; the existing identity and the delivered envelope already carry the right category and exit. | 2026-11-10 |
| DEC-10 | **Doctor hold detail, reason model, and precedence.** The provider check keeps `ok` and adds exactly one evidence reason, `owner-hold`, inserted immediately after `park-credential-cause`. `owner-hold` is a non-failing annotation reason with no evidence source, may co-occur with `ok`, and is the fourth and last admissible provider reason (`DOCTOR_MAX_EVIDENCE_REASONS` is four). The check appends a bounded hold segment to the existing provider detail (`<existing detail>; owner hold active (marker): <reason>`); when appending would exceed `DOCTOR_MAX_DETAIL_CHARS`, the existing detail is truncated to fit and the whole hold segment is kept (D18). It adds no fix hint and no condition-catalog entry. An existing provider defect keeps its own `fail` or `unreachable` verdict and reason, and the hold reason is not added to that check. `DOCTOR_VERDICTS`, `DoctorSummaryCounts`, the failure summary, and the exit model are unchanged. | A pause is operator intent, not a defect; a new verdict or count would change the exit model and force every consumer and golden to treat an intentional stop as abnormal. | 2026-11-10 |

**DoR-1 remediation traceability.** D12–D19 are the PM's DoR iteration 1 remediation decisions, recorded in the change's PM notes. They are folded into DEC-1, DEC-3, DEC-7, and DEC-10 and into F-1, F-4, F-5, F-6, §13, and §18: D12 fixes the marker location, D13 gates the no-ref claim, D14 makes the daemon guarantee conditional, D15 moves the status member to evidence level, D16 requires exact two-way closed-set assertions, D17 narrows `queue ready` out of the hold surfaces, D18 specifies the detail clamp, and D19 states the deferral-versus-refusal semantics.

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|---|---|
| Owner-hold contract | New — `OwnerHoldFact`, `OwnerHoldSource`, constants, and a pure resolver over injected inputs |
| Pre-iteration hook examples | New — `howLongToSleepDueToOwnerHold()` example with an unbounded driver; existing zai example unchanged |
| Install and uninstall inventories | Updated — the new example is installed executable, never activated, and removed on uninstall |
| Shell test surface | New — deterministic hook test for the owner-hold example; install and uninstall fixtures updated |
| Queue scheduling | Updated — global suppression of next actions and preemption while held; `owner-hold` blocking reason |
| Queue claim gate and lease | Updated — hold refusal before parks, readiness, and the fence; zero records |
| Park recovery | Updated — the mutating recovery pass is skipped while held |
| Lane fold | Updated — the closed idle/blocking reason set gains `owner-hold` |
| Queue read payloads | Updated — additive optional `ownerHold` member on list, plan, and read data; `queue ready` unchanged |
| Dispatch engine claim seam | Updated — additive optional refusal summary, propagated into the existing error summary |
| Composed supervision | Unchanged code, conditional input — a cycle that derives its next action from the held pass receives no action; the production daemon entry remains a documented residual (D14) |
| Status digest collector | Updated — additive optional evidence-level `ownerHold` member on the providers section and human suffix |
| MCP status runtime | Updated — composes the same owner-hold reader for parity |
| Doctor provider check | Updated — `owner-hold` reason and a hold segment appended to the `ok` provider detail; verdict, summary, condition catalog, and exit unchanged |
| Production composition | Updated — resolves the owner-hold fact per pass for queue, dispatch, status, doctor, and the MCP status surface |
| Wrapper scripts (`deliver-ticket.sh`, `ceo-loop.sh`, `batch-deliver.sh`) | Unchanged |
| Queue park, state record, and readiness vocabularies | Unchanged |
| Error identity table and domain kinds | Unchanged |
| Operator documentation and feature specs | Updated — see §16.1 |

### 16.1 Documentation Impact

| Document | Impact |
|---|---|
| `doc/guides/delivery-modes.md` § Optional pre-iteration hooks (including activation and `ADOS_HOOK_ENV_V1`) | Updated. Adds one subsection that states the two semantics — provider-window deferral is automatic and time-bounded; an owner hold is manual, indefinite, and outranks windows — and documents the new example, both sources, precedence, removal, the fail-closed unreadable marker, the fixed default marker path `$HOME/.ados-state/owner-hold`, the absence of a marker-path override (a shell-only path would leave the typed engine unheld), the poll-interval setting, the unbounded driver, the composition-by-MAX rule, the explicit limit that a mid-flight session is not killed, and the `owner-hold` versus `owner-gate` distinction. It also states that a held dispatch/claim is a classified user-validation refusal at exit `1`, and that a caller wanting deferral semantics treats the `owner-hold` token as wait/do-not-abort (D19). The activation paragraph names both installed examples. Declares `ados_distribution: redistributable` and passes the drift guard. |
| `doc/guides/zai-peak-hours-hook.md` § Extensibility: condition functions | Updated. Notes that the same DM-1 contract now has a second example, that composition is by MAX, and that a time-bounded condition merged into the owner-hold example inherits the unbounded driver because the hold is the floor. Declares `ados_distribution: redistributable` and passes the drift guard. |
| `doc/guides/` documentation index or see-also list, where the hook examples are enumerated | Updated only if it enumerates examples; no new standalone guide is required. |
| `doc/spec/features/feature-autonomous-delivery.md` § Configuration and hook limits | Reconciled after delivery: the hold settings, the fixed marker default, the distinction between the two examples, and the explicit "no kill switch" limit. |
| `doc/spec/features/feature-scheduling-engine.md` § Capability summary, command surfaces, configuration, and state records | Reconciled after delivery: the global hold gate over the injected fact, the `owner-hold` blocking/lane reason, the additive `ownerHold` payload member, the no-ref and supplied-ref claim refusal before selection, `queue ready` unchanged, and an explicit statement that the hold is not a park cause, not a record kind, and not a seventh ready condition. |
| `doc/spec/features/feature-status-digest.md` § Providers and evidence | Reconciled after delivery: the additive optional evidence-level `ownerHold` member on the providers evidence record (`providers.evidence.ownerHold`) and human suffix; unchanged section state, counts, sources, reasons, and schema version. |
| `doc/spec/features/feature-doctor.md` § Verdict derivation matrix, closed vocabulary, evidence model, condition catalog, and outcome model | Reconciled after delivery and explicitly amended: `owner-hold` is a non-failing annotation reason with no evidence source, may co-occur with `ok`, is the fourth and last admissible provider reason, and changes no verdict/hint/exit; the hold segment is appended to the `ok` provider detail and survives the detail clamp by truncating the existing detail; a real provider defect wins. This amendment is a required doc-sync obligation, not an inference. |
| `doc/spec/features/feature-resident-daemon.md` | Verified only: the production daemon entry remains its documented residual; this change claims no production daemon wiring (D14). |
| `doc/spec/features/feature-config-layer.md` | Verified only: no configuration key is added and store relocation is out of scope; the existing state-directory resolver is not extended to the delivery store (D12). |
| `doc/planning/oss-tooling/milestones/m1/commands/queue.md` | Updated. Documents the `ownerHold` member, the `owner-hold` blocking reason, the no-ref and supplied-ref claim refusal on the existing identity, the lane-reason masking (point operators at `queue list`), and that `queue ready` is unchanged. |
| `doc/planning/oss-tooling/milestones/m1/commands/status.md` | Updated. Documents the evidence-level `providers.evidence.ownerHold` member and the human suffix. |
| `doc/planning/oss-tooling/milestones/m1/commands/doctor.md` | Updated. Documents the additive `owner-hold` annotation reason, the hold segment appended to the `ok` provider detail and its clamp rule, the defect-precedence rule, and the unchanged verdict, summary, condition, and exit surfaces. |
| `doc/spec/features/feature-capsule.md` and the state-record reference | Verified only: no record kind, capsule event, or schema changes. |
| Release note / changeset | Owned by the documentation phase: a minor-bump changeset naming the new example hook, the two hold sources, the queue/dispatch gate, the status evidence member, and the doctor `owner-hold` segment appended to the provider detail (verdict and exit unchanged). |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|---|---|---|
| AC-F1-1 | **Given** the environment variable `<PREFIX>_OWNER_HOLD` set to `peak-hour cost pause` and no marker file, **when** the hold fact is resolved, **then** it is active with source `env` and reason `peak-hour cost pause`, and the resolved variable name is the brand-derived prefix plus `_OWNER_HOLD`. | F-1, DM-1, DM-2 |
| AC-F1-2 | **Given** an unset variable and a marker file at `<home>/<brand.stateDirectoryName>/owner-hold` whose first line is `peak-hour cost pause`, **when** the fact is resolved, **then** it is active with source `marker` and reason `peak-hour cost pause`; no other marker path is read. | F-1, DM-1, DM-9 |
| AC-F1-3 | **Given** both sources active with different reasons, **when** the fact is resolved, **then** it is active with source `env` and the environment reason; the marker reason is not used. | F-1, DEC-7 |
| AC-F1-4 | **Given** the variable set to the empty string and no marker, **when** the fact is resolved, **then** it is inactive; **given** the variable set to spaces only and no marker, **then** it is active with source `env` and no reason. | F-1, DEC-7 |
| AC-F1-5 | **Given** an existing zero-byte marker file and no variable, **when** the fact is resolved, **then** it is active with source `marker` and no reason. | F-1, DEC-7 |
| AC-F1-6 | **Given** a marker path that exists but is unreadable, is a directory, or cannot be stat'd, **when** the fact is resolved, **then** it is active with source `marker` and no reason, and it never resolves inactive. | F-1, NFR-10, RSK-1 |
| AC-F1-7 | **Given** a marker reason containing a newline, a tab, an ANSI escape, and more than 160 characters, **when** the fact is resolved and rendered, **then** the reason is one line, contains no control or escape sequence, and is at most 160 characters. | F-1, NFR-5, RSK-8 |
| AC-F1-8 | **Given** no resolvable home directory and an empty environment source, **when** the fact is resolved, **then** it is inactive and no ambient path is read; **given** the environment source set, **then** it is active despite the missing directory. | F-1, NFR-11, A-2 |
| AC-F1-9 | **Given** an active fact, **when** the resolution runs, **then** it performs zero network calls, zero credential reads, and zero state writes, and at most one existence check and one bounded marker read. | F-1, NFR-1 |
| AC-F2-1 | **Given** an active hold and the default poll interval, **when** the example hook runs, **then** `howLongToSleepDueToOwnerHold()` echoes `300` and the driver sleeps 300 seconds and prints exactly one line naming `owner-hold`, the source, and the reason. | F-2, DM-2 |
| AC-F2-2 | **Given** no active hold, **when** the example hook runs, **then** the condition echoes `0`, the driver returns `0` immediately, and it performs zero sleeps and prints no deferral line. | F-2 |
| AC-F2-3 | **Given** an active hold that persists across 25 or more poll intervals with a stepping-clock test seam, **when** the driver runs, **then** it still sleeps and never proceeds or logs a loop-cap warning, proving no fixed iteration cap applies while held. | F-2, NFR-9, RSK-2 |
| AC-F2-4 | **Given** `ADOS_OWNER_HOLD_POLL_SECONDS` set to `600`, **when** the condition is evaluated, **then** it echoes `600`; **given** `0`, `-1`, `abc`, or `99999`, **then** it echoes `300` and emits exactly one bounded warning, never `0`; **given** the variable unset, empty, or whitespace-only, **then** it echoes `300` and emits no warning. | F-2, NFR-3 |
| AC-F2-5 | **Given** an active hold and a sleep seam that removes the marker during the first sleep, **when** the driver re-evaluates, **then** the condition echoes `0` and the hook exits `0` without a further sleep. | F-2, NFR-4 |
| AC-F2-6 | **Given** a registered time-bounded condition returning `3600` and the hold returning `300`, **when** the driver runs, **then** it sleeps `3600`; **when** the next evaluation returns `0` from the time-bounded condition and `300` from the hold, **then** it sleeps `300` and continues, proving MAX composition with the hold as the floor. | F-2, DEC-4 |
| AC-F2-7 | **Given** the example hook, **when** it is inspected for output side effects, **then** it writes no `ADOS_HOOK_ENV_V1` output, creates no file, and does not signal or kill a running session. | F-2, NG-1 |
| AC-F2-8 | **Given** an active hold and a clock seam that jumps forward or backward by a day between evaluations, **when** the condition and driver run, **then** the decision and the sleep duration are unaffected, because the hold uses no absolute time and a deferral never exceeds one poll interval per iteration. | F-2, NFR-6 |
| AC-F3-1 | **Given** a local install, **when** `install.sh --local` runs, **then** the new example exists at `scripts/hooks/pre-opencode-iteration-owner-hold.sh`, is executable, and is not activated. | F-3, DEC-4 |
| AC-F3-2 | **Given** a local uninstall, **when** `uninstall.sh --local` runs, **then** the new example is removed and the empty `scripts/hooks/` directory is removed, while an operator's hook at the default or overridden path is preserved. | F-3 |
| AC-F3-3 | **Given** the new hook test suite, **when** it runs, **then** it passes with zero real sleeps and zero network calls, and `shellcheck` reports zero findings on the example. | F-3, NFR-9 |
| AC-F3-4 | **Given** the repository's pinned wrapper hashes, **when** the structural provider-surface test runs, **then** `scripts/ceo-loop.sh` and the legacy hook regression bytes are unchanged. | F-3, NG-6, DEC-5 |
| AC-F4-1 | **Given** an active hold and a queue containing ready, held, parked, stuck, and not-ready entries, **when** a scheduling pass runs, **then** `nextActions` is empty, no preemption proposal exists, each ready or held entry carries `owner-hold` as its first blocking reason, active parks stay `parked:<cause>`, stuck parks stay `park-condition-stuck`, and a resumable park is `held` with `owner-hold`. | F-4, DM-3, DM-5, DEC-6 |
| AC-F4-2 | **Given** an active hold, **when** `queue claim` runs with a supplied ref or with no ref, **then** it refuses `queue.precondition.unmet` with reason `owner-hold` before ref selection (never `no-eligible-action`) and a bounded detail naming the source and reason, exits `1`, and appends zero records. | F-4, DM-6, NFR-2 |
| AC-F4-3 | **Given** an active hold and a dispatch whose harness and inputs are valid, **when** the dispatch runs, **then** it refuses with `queue.precondition.unmet` and a bounded summary naming the hold and its sanitized reason, and zero leases, sessions, branches, worktrees, attempts, divergences, handover records, and authority changes exist. The refusal is a classified user-validation refusal at exit `1`, not an internal wait; a caller that wants deferral semantics must treat the `owner-hold` token as wait/do-not-abort. | F-4, DM-6, NFR-7, DEC-9 |
| AC-F4-4 | **Given** an active hold and a supervision cycle whose next-action seam derives from the held scheduling pass, **when** the cycle and `queue watch` run, **then** the seam returns no next action, the claim seam refuses, watch streams the hold with an empty action list, and zero daemon-lane records are written; the production resident-daemon entry remains the resident-daemon spec's residual and is not claimed as wired. | F-4, NFR-2, DEC-6 |
| AC-F4-5 | **Given** a park whose provider window expired during an active hold, **when** the mutating pass and the read pass run, **then** zero `clear-observed`, `recovered`, and `park-auto-recovery` records are appended, the park record is byte-identical to its pre-hold state, and the entry is not claimed. | F-4, DEC-6, A-6 |
| AC-F4-6 | **Given** the state captured at hold entry, **when** the hold is removed and the next pass runs, **then** entries, leases, parks, incidents, daemon lanes, handoffs, and lane identities are unchanged, the overdue park recovers through the delivered pass, and a resumable session is resumed rather than re-dispatched, with no duplicate session. | F-4, NFR-4, A-5 |
| AC-F4-7 | **Given** an inactive hold, **when** list, plan, and read payloads are produced, **then** they contain no `ownerHold` member and are byte-identical to the delivered payloads for the same facts; **given** an active hold, **then** the member is present and carries the source and optional reason. On the `lanes` surface a lane shows `owner-hold` because it renders `blocking[0]`, masking a more specific idle reason, while `queue list` retains the full ordered `blocking[]`; `queue ready` is unchanged and carries no hold. | F-4, DM-4 |
| AC-F4-8 | **Given** an active hold, **when** `queue add`, `queue prioritize`, `queue dep`, and `queue release` run, **then** they append their declared records and do not invoke the park-recovery pass; `queue claim` remains refused. | F-4, DEC-6 |
| AC-F4-9 | **Given** the queue contracts, **when** the closed sets are inspected, **then** the park condition types, park causes, cause-condition pairing, recovery states, state record kinds, and the six queue-ready condition ids are unchanged, and `owner-hold` is the only added lane/blocking reason. The one-reason addition is pinned by exact two-way set equality for `QUEUE_LANE_IDLE_REASONS` and `QUEUE_BLOCKING_REASONS` against `closed-sets.json` in `queue-scheduling-contract.test.ts`; the test plan owns the case details. | F-4, NFR-8, DM-5 |
| AC-F4-10 | **Given** a lane that is already `delivering` when the hold becomes active, **when** the lane fold runs, **then** the lane stays `delivering`, the hold does not signal or kill it, and no partial-session cleanup is attempted. | F-4, NG-1, RSK-5 |
| AC-F4-11 | **Given** an active hold and a queue store that cannot be read, **when** `queue list` or `queue claim` runs, **then** the delivered state failure is returned unchanged at exit `2` and no hold-shaped payload is fabricated; **when** `status` and `doctor` run, **then** they still report the hold from their independent injected fact. | F-4, F-5, F-6, NFR-14 |
| AC-F5-1 | **Given** an active hold, **when** `status` runs, **then** the providers section's evidence record carries the additive optional `ownerHold` member (a sibling of `sources[]`, i.e. `providers.evidence.ownerHold`) with source and optional reason, its state, counts, sources, reasons, truncation, and entries are unchanged, and the command exits `0` with all nine sections. | F-5, DM-7, NFR-14 |
| AC-F5-2 | **Given** an active hold with a reason, **when** human status renders, **then** the providers line ends with `\| owner-hold: <reason>` read from `providers.evidence.ownerHold`; **given** no reason, **then** it ends with `\| owner-hold`; the digest stays within its existing line and byte bounds. | F-5, NFR-5 |
| AC-F5-3 | **Given** the MCP status tool and the CLI status command over the same injected facts, **when** both run with an active hold, **then** both produce the same evidence-level `ownerHold` member and the parity fixture matches. | F-5, NFR-6 |
| AC-F5-4 | **Given** the status contracts, **when** the digest is inspected with and without a hold, **then** the section order, section states, evidence reasons, and schema version are unchanged, and no section, state, source, reason, or finding code was added. | F-5, NFR-8 |
| AC-F6-1 | **Given** an otherwise healthy provider configuration and an active hold, **when** `doctor` runs, **then** the provider check keeps the `ok` verdict, adds the annotation reason `owner-hold`, and appends a bounded hold segment in the form `owner hold active (<source>)` or `owner hold active (<source>): <reason>` to the existing provider detail, adds no fix hint and no condition-catalog entry, leaves `DOCTOR_VERDICTS` and `DoctorSummaryCounts` unchanged, and exits `0`; **given** an existing detail at or near `DOCTOR_MAX_DETAIL_CHARS`, **then** the existing detail is truncated to fit and the whole hold segment is kept (never cut mid-word or dropped), and this near-bound case is tested. | F-6, DM-8, DEC-10 |
| AC-F6-2 | **Given** a provider configuration failure, an unresolvable provider credential, a credential-caused park, or an unreadable park fold together with an active hold, **when** `doctor` runs, **then** the existing defect keeps its own `fail` or `unreachable` verdict and reason, the `owner-hold` reason is not added to that check, the command exits `1` unchanged, and `status` still shows the hold. | F-6, F-5, DEC-10 |
| AC-F6-3 | **Given** an active hold and otherwise healthy provider facts, **when** the machine report is compared with the no-hold report for the same facts, **then** the only differences are the additive `owner-hold` reason and the hold segment appended to the existing detail; verdict, summary counts, evidence sources and outcomes, condition catalog, and exit are identical. | F-6, DM-8, NFR-8 |
| AC-F6-4 | **Given** an inactive hold, **when** `doctor` runs over unchanged facts, **then** the provider check's verdict, reason list, detail, evidence, summary counts, and human output are byte-identical to the delivered behavior, with no summary delta. | F-6, NFR-12 |
| AC-DOC-1 | **Given** the delivery-modes guide, **when** a reader looks for the pause semantics, **then** one place states that provider-window deferral is automatic and time-bounded while an owner hold is manual, indefinite, and outranks windows, and documents both sources, precedence, removal, the fixed default marker path `$HOME/.ados-state/owner-hold` and the absence of a marker-path override, the unreadable-marker behavior, the poll interval, the unbounded driver, that a mid-flight session is not killed, the `owner-hold` versus `owner-gate` distinction, and that a held dispatch/claim is a classified refusal at exit `1` with `owner-hold` meaning wait/do-not-abort to deferral callers. | F-1, F-2, F-4, G-6 |
| AC-DOC-2 | **Given** the zai hook guide's extension section, **when** a reader composes the owner-hold example with peak or quota conditions, **then** it states that conditions compose by MAX and that the hold keeps sleeping after every time-bounded window ends. | F-2, G-6, DEC-4 |
| AC-DOC-3 | **Given** the affected feature specs and command reference pages, **when** they are reconciled, **then** they describe the global gate, the additive members, the new reason, the unchanged doctor verdict and summary surfaces, the explicit `feature-doctor` annotation-reason amendment, and explicitly deny a new park cause, state record, seventh ready condition, or tenth status section. | F-4, F-5, F-6, G-8 |
| AC-DOC-4 | **Given** every changed document under the guides area, **when** the documentation-distribution drift guard runs, **then** each declares `ados_distribution` and the guard passes. | NFR-13 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery shape.** One change on branch `feat/GH-280/owner-hold-hook` from `main-tools`, delivered as a single pull request to `main-tools`. No feature flag: a hold that exists must be honored, and a flag would preserve the defect.
- **Ordering.** The sequence is contract and fact first (the fact, the constants, the one lane reason token, the one doctor reason and detail), then the pure gate and the claim/dispatch refusal, then the status and doctor surfaces, then the production composition, then the example hook and its registration, then documentation and reference pages, finishing with fixtures, goldens, inventories, and the composition pin in the same pull request. This matches the plan's fact → gate → surfaces → composition → hook → docs order. No intermediate state may leave the wrapper deferring while the engine claims; the hook lands after the gate so the shell cannot defer while the engine still claims.
- **Operational communication.** Operators learn two things: a durable pause is a marker file (recommended) or an environment variable, and a pause is not a kill switch. The guide and the reference pages carry both messages; the change record and pull-request description repeat them.
- **Verification evidence.** Beyond the fixture suites, the pull request records a manual sequence: create a marker, show `status` and `doctor` reporting it, show a queue claim and a dispatch refusing with `owner-hold`, show a parked lane not recovering after its window expires, remove the marker, and show the next pass resuming from the unchanged records. No real session is spawned during the evidence capture except the resumed one, and no secret is printed.
- **Rollback.** Reverting the change restores the previous scheduling, claim, and surface behavior. Removing a hold always reverts to normal without a code change: delete the marker and unset the variable. No migration is involved, and no record written before the change depends on it.
- **Adoption note.** Existing installs are unaffected until a hold is declared. The new example is installed but inactive; selecting it is an operator act, exactly like selecting the zai example.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None.

- No state record schema, store migration, field backfill, or seeding.
- A hold writes no record; removing it writes no record. The hold is derived state, resolved on read.
- Historical queue, park, lease, lane, attempt, and divergence records remain valid and unchanged.
- The new lane/blocking reason and the new doctor evidence reason are vocabulary additions evaluated from injected facts; no stored payload is rewritten.

## 20. PRIVACY / COMPLIANCE REVIEW

- No new personal data is collected, stored, or transmitted. The hold's only data are a source token, an optional operator-authored reason, and a local marker path.
- The reason is rendered as local data, never transmitted, never used to build a command, and bounded before rendering.
- No new network destination, telemetry exporter, or third-party sharing. No credential is read by any hold path.
- The marker is a local file in the production store directory with the operator's own permissions; the product does not widen its permissions or copy it elsewhere.
- No cloud, vendor, or product naming is introduced; the environment prefix and directory name are brand-derived.

## 21. SECURITY REVIEW HIGHLIGHTS

- **No new secret surface.** Hold resolution reads no credential and calls the credential port never. No secret-read allowlist entry is added.
- **No ambient read in core.** Core resolves the fact only from injected inputs; the filesystem read lives in the CLI/MCP composition, so the ambient-globals boundary stays intact.
- **No path escape in the engine.** The engine's marker path is fixed to `<home>/<brand.stateDirectoryName>/owner-hold`; it accepts no caller-supplied path, and neither the engine nor the example offers a marker-path override or a store-relocation shortcut.
- **Fail-closed, not fail-open.** An unreadable marker keeps delivery paused. The security-relevant property (an operator stop cannot be silently released by an I/O error) is deliberate; the operability cost is stated in RSK-1.
- **Untrusted operator text is contained.** The reason is stripped of control characters and ANSI escapes, collapsed to one line, and bounded before any payload or terminal render, so a crafted marker cannot forge a log line or manipulate a terminal.
- **No privilege widening.** The hold cannot read, write, or invoke anything outside its two sources; it grants no authority and bypasses no gate.
- **Denial-of-delivery is explicit.** An operator (or anyone who can write the production store directory or the operator's environment) can pause delivery. That is the feature; the capability boundary is the same as the wrappers' existing stop files, and it is documented rather than hidden.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **New operator-facing state.** Delivery can now be paused by a local marker or environment variable. Runbooks must distinguish "paused by the owner" (read surfaces report the hold; nothing is failing) from "stuck" (a park or readiness condition blocks without a hold).
- **Diagnosis path.** Read `status` and `doctor` first: they name the source and the reason. If the source is `env`, the pause is in the operator's shell or service environment; if the source is `marker`, the file is `<home>/<brand.stateDirectoryName>/owner-hold` (`$HOME/.ados-state/owner-hold` for this product). Removing both clears it.
- **Failure mode to watch.** A marker path that exists but is unreadable holds delivery by design. Doctor reports the hold in its provider detail (`ok` with the `owner-hold` reason), and the hook prints the source; if delivery is paused with no reason, suspect an unreadable marker or a whitespace-only variable.
- **Visibility caveat.** `doctor` stays `ok` while held, by design, so `status` is the primary surface for confirming a pause; the provider detail names the source and reason for an operator who is already in `doctor`.
- **Fixed marker location.** The marker is read only from the production store directory. There is no marker-path override and no store relocation in this change: a shell-only path would leave the typed engine unheld, which is the split the change exists to remove. An operator who needs the pause in a relocated layout must use the environment source, or treat relocation as a separate change (D12).
- **Vocabulary coupling.** The lane/blocking reason set, the doctor reason set, the queue fixture, and the goldens move together. A future addition to any of them must regenerate the fixture and goldens in the same change.
- **Cost.** The hold costs one stat and at most one small file read per scheduling pass, status run, doctor run, and hook poll. It performs zero network calls, so a pause reduces cost rather than adding to it.
- **Documentation coupling.** The delivery-modes guide, the zai guide's composition section, the feature specs, and the command reference pages must stay consistent with the two-semantics distinction; the drift guard enforces the distribution markers, and review enforces the prose.

## 23. GLOSSARY

| Term | Definition |
|---|---|
| Provider-window deferral | An automatic, time-bounded wait until a provider window opens or a quota resets. It ends by the clock or the provider, never by operator intent. |
| Owner hold | A manual, indefinite pause declared by an operator through an environment value or a marker file. It outranks every time-bounded wait and has no expiry. |
| Hold marker | The file `owner-hold` in the production store directory `<home>/<brand.stateDirectoryName>` (`$HOME/.ados-state/owner-hold` for this product). The location is fixed; no marker-path override or store relocation is offered (D12). |
| Hold fact | The single `OwnerHoldFact` resolved from the two sources and injected into the queue, status, doctor, and hook decision paths. |
| Hold source | The closed two-value set `env` \| `marker` that records which source produced an active hold. |
| Hold reason | The optional, sanitized, 160-character operator text carried by an active hold. It is data, never a command. |
| Global read-only gate | A gate over an injected fact that suppresses scheduling, refuses claims, and skips recovery without writing a park, a record, or a queue mutation. |
| Park | A durable provider condition that released a lease and is re-evaluated later. It is not a hold and has no owner intent. |
| Park auto-recovery | The mutating pass that appends `clear-observed`, `recovered`, and a `park-auto-recovery` incident for a park whose condition cleared. It is skipped while a hold is active. |
| Close condition | The stop condition the operator wants enforced; represented only by the hold fact, never by a park. |
| Poll interval | The number of seconds the owner-hold condition asks the driver to sleep before re-evaluating (`ADOS_OWNER_HOLD_POLL_SECONDS`, default `300`). |
| Hook condition-function contract | The delivered hook extension point (GH-150 DM-1): a `howLongToSleepDueTo<Reason>()` function that echoes one non-negative integer of seconds, uses injected seams, and emits at most one diagnostic line. |
| Owner-hold evidence reason | The additive doctor evidence reason `owner-hold`, a non-failing annotation reason with no evidence source, allowed on an `ok` check and as the fourth and last admissible provider reason. It appends an `owner hold active (<source>)` segment to the existing provider detail and adds no verdict, summary count, condition, or exit change. |
| `owner-hold` vs `owner-gate` | `owner-hold` is the delivery pause defined in this specification. `owner-gate` is the unrelated queue lane reason for the merge owner-approval gate. The two tokens denote different gates and must not be read as synonyms. |

## 24. APPENDICES

### Appendix A — Hold resolution precedence

| Environment source | Marker outcome | Result |
|---|---|---|
| Set, non-empty | any | Active, source `env`, reason from the variable |
| Set, empty string | exists | Active, source `marker`, reason from the file |
| Set, empty string | absent | Inactive |
| Unset | exists, readable | Active, source `marker`, reason from the first line when non-empty |
| Unset | exists, empty file | Active, source `marker`, no reason |
| Unset | exists, unreadable, not a regular file, or stat fails | Active, source `marker`, no reason (fail-closed) |
| Unset | absent | Inactive |
| Any | no resolvable home directory | Only `env` can activate; otherwise inactive, with no ambient read |

The marker is read only from `<home>/<brand.stateDirectoryName>/owner-hold`; no other path is considered (D12).

### Appendix B — Queue gate decision table (hold active)

| Situation | Entry projection | Lane projection | Claim | Records written |
|---|---|---|---|---|
| Entry would be `ready` | `held`, blocking [`owner-hold`, ...] | `idle-with-reason` / `owner-hold` | Refused `queue.precondition.unmet` / `owner-hold` | 0 |
| Entry is `held` or `not-ready` | same state, blocking [`owner-hold`, ...own reasons] | `idle-with-reason` / `owner-hold` (the specific reason is masked here; `queue list` keeps it) | Refused | 0 |
| Entry has an `active` park | `parked` / `parked:<cause>` unchanged | `parked` / `parked:<cause>` | Refused | 0 |
| Entry has a `stuck` park | `stuck` / `park-condition-stuck` unchanged | `idle-with-reason` / `park-condition-stuck` | Refused | 0 |
| Park window expired during the hold | `held` / `owner-hold` | `idle-with-reason` / `owner-hold` | Refused | 0; no `clear-observed`, no `recovered`, no incident |
| Lane already `delivering` | n/a | `delivering` unchanged | n/a | 0; not signalled |
| `queue claim` (ref omitted or supplied) | n/a | n/a | Refused before ref selection: `queue.precondition.unmet` / `owner-hold` | 0 lease |
| Dispatch asked to start | n/a | n/a | Refused `queue.precondition.unmet`, summary names the hold; classified user-validation refusal at exit `1` | 0 lease, 0 attempt, 0 session |
| Supervision cycle composed from the held pass | n/a | n/a | No next action; claim seam refuses | 0 daemon lane |
| `queue ready` | n/a | n/a | n/a | Unchanged; carries no hold (D17) |

### Appendix C — Ticket traceability

| Ticket requirement | Spec coverage |
|---|---|
| Shipped owner-hold condition example under DM-1 with composition guidance | F-1, F-2, F-3, DEC-4; AC-F2-1…AC-F2-6, AC-F3-1…AC-F3-4 |
| Durable, documented pause semantics; loop and lane iterations defer indefinitely with a clear reason; removal resumes without state loss | F-1, F-2, F-4, DEC-1, DEC-6, DEC-7; AC-F2-1, AC-F2-3, AC-F2-5, AC-F4-5, AC-F4-6 |
| Queue-level hold for the typed engine: park without `--until`, composed supervision and watch claim nothing | F-4, DEC-2, DEC-6; AC-F4-1, AC-F4-2, AC-F4-4, AC-F4-5, AC-F4-9, AC-F4-11 |
| Optional status/doctor hold visibility | F-5, F-6, DEC-3, DEC-10; AC-F5-1…AC-F5-4, AC-F6-1…AC-F6-4 |
| Acceptance: hold active refuses a new dispatch with a reason naming the hold | F-4, DEC-9, D19; AC-F4-3 |
| Acceptance: a parked lane does not resume at its provider window | F-4, DEC-6; AC-F4-5 |
| Acceptance: a supervision cycle composed from the held pass and `queue watch` claim nothing (production daemon entry remains the resident-daemon residual) | F-4, D14; AC-F4-4 |
| Acceptance: removing the hold resumes preserved state without re-dispatch or duplicate sessions | F-4, DEC-6; AC-F4-6 |
| Acceptance: docs distinguish provider-window deferral from owner hold | G-6; AC-DOC-1, AC-DOC-2, AC-DOC-3 |
| Acceptance: example passes shellcheck and hook tests, documented in delivery-modes | F-3; AC-F3-3, AC-DOC-1 |

### Appendix D — Doctor surface delta

| Surface | Delivered | After this change | Exit impact |
|---|---|---|---|
| Verdicts (`DOCTOR_VERDICTS`) | `ok`, `fail`, `unreachable` | Unchanged | None |
| Summary counts (`DoctorSummaryCounts`) | `total`, `ok`, `fail`, `unreachable` | Unchanged | None |
| Evidence reasons | 22, closed | 23 — `owner-hold` inserted immediately after `park-credential-cause`; every other value keeps its position | None |
| Condition catalog | Closed | Unchanged; no `owner.hold` entry | None |
| Provider check, healthy + hold | `ok` | `ok` + `owner-hold` annotation reason + hold segment appended to the existing detail (`<existing detail>; owner hold active (<source>): <reason>`); at the bound the existing detail yields and the whole segment is kept; no fix hint | None (exit `0`) |
| Provider check, defect + hold | `fail` or `unreachable` | Same verdict and reason; `owner-hold` is not added | Unchanged (exit `1`) |
| Provider check, no hold | Delivered output | Byte-identical | None |

No verdict is added, no count is added, and the exit model is unchanged. The only machine-visible delta on a held, otherwise healthy system is the additive `owner-hold` reason and the appended hold segment.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-10 | spec-writer | Initial specification from the GH-280 planning session and PM decisions D1–D11 (recorded as DEC-1–DEC-10, with D3a retained as history). |
| 1.1 | 2026-11-10 | spec-writer | Revised the doctor surface per the binding PM amendment: the provider check keeps the `ok` verdict and adds only the `owner-hold` evidence reason and an `ok` detail. No verdict, summary count, condition, source, area, or exit change. |
| 1.2 | 2026-11-10 | spec-writer | DoR iteration 1 remediation. Fixed the marker to the production store directory and removed the shell-only marker-path and store-relocation claims (D12); gated no-ref `queue claim` before selection (D13); made the daemon guarantee conditional on a composed supervision cycle (D14); moved the status member to `providers.evidence.ownerHold` (D15); required exact two-way closed-set assertions (D16); narrowed `queue ready` out of the hold surfaces (D17); specified the doctor detail clamp and annotation-reason model (D18); stated the deferral-versus-refusal semantics (D19); corrected decision references, ordering, lane masking, and the zero-record metric. |

---

## AUTHORING GUIDELINES

- **Sources.** This specification was authored from the GH-280 ticket, PM decisions D1–D11 plus D3a (history) and the DoR-1 remediation decisions D12–D19 recorded in the change's PM notes, the current system specs for the scheduling engine, status digest, doctor, resident daemon, config layer, and autonomous delivery, and the delivered contracts and tests cited in §2.1. No other source was used.
- **Approach.** The change is specified around one primitive (the owner-hold fact) and two enforcement points (the hook and the queue gate), with read-only visibility as an additive projection. Every closed vocabulary is named explicitly, and every addition is counted, so the test-plan writer can assert the boundary rather than invent it.
- **Honesty about the ticket's "park without `--until`" wording.** The ticket asks for a queue-level hold that parks without an expiry. The specification does not claim a park exists: §5 F-4 states why a new park cause is rejected and how the global gate produces the same observable outcome — no claims, no dispatch, no auto-recovery, preserved state — without a park record.
- **Honesty about the mid-flight limit.** The hold is a start gate, not a kill switch. The spec states this in the non-goals, the flows, the risks, and the guide obligation, because an operator who reads "pause" as "kill" would be surprised by the next provider cut-out.
- **Contract locations are evidence, not implementation tasks.** Module and type locations are named so downstream artifacts can be traced; no step-by-step implementation tasks, file-level edits, or code snippets are specified.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (`GH-280`)
- [x] `owners` has at least one entry (`engineering`)
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 plus guidelines and checklist)
- [x] ID prefixes consistent and unique (`F-`, `AC-`, `NFR-`, `RSK-`, `DEC-`, `DM-`, `OQ-`, `PP-`, `G-`, `NG-`, `A-`, `C-`)
- [x] Acceptance criteria reference at least one F-/NFR-/DEC- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details beyond contract locations cited as evidence
- [x] No content duplicated from linked docs
- [x] Front matter validates per the repo's spec convention
- [x] Open questions empty; the doctor surface is strictly additive (one evidence reason and one `ok` detail), with verdicts, summary counts, condition catalog, and exit unchanged
