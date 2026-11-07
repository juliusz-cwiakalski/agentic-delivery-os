---
ados_distribution: internal
id: SPEC-PROVIDER-PROFILES
status: Current
created: 2026-11-07
last_updated: 2026-11-07
owners: ["engineering"]
service: delivery-os
summary: "Model-profile selection and provider watching: the typed provider.profiles branch (tiers, profiles, seats with a typed pacingClass, preference chain, pacing rungs, watch targets, shipped empty), the pure selection engine (declarative heuristics, hard capability gate, lazy memoized eligibility probes), profile park/switch/revert with a persisted target record, the coding-plan/DeepSeek/OpenAI watch mappings, the provider profile resolve and provider watch status CLI surfaces, and resolve-before-spawn with a hardened data-v1 env-record contract."
links:
  related_changes: ["GH-234", "GH-182", "GH-233"]
  related_decisions: ["ADR-0003", "ADR-0005", "ADR-0007"]
  contracts:
    - "packages/core/src/contracts/provider-profile.ts"
    - "packages/core/src/contracts/provider.ts"
    - "packages/adapters/src/provider-quota/index.ts"
---

# Feature: Provider Profiles and Watching

## Overview

Model profiles turn model routing from hand-maintained environment discipline into declared, validated, replayable machinery. A **tier** is a responsibility group; a **profile** is a named model-per-tier assignment with per-seat capability descriptors, an optional per-agent override, the providers it uses, and a typed `pacingClass` per seat. A **preference chain** declares the base profile and fallbacks; **pacing** declares ordered goal priorities, named rungs, and the subscription-window tail. All of it is layered configuration and ships **empty by default**: a fresh installation declares no profile and refuses a spawn with a classified error rather than inventing a model.

Selection is pure policy. The hard capability gate runs first (a text-only seat never receives a vision task, regardless of chain position or quota pressure), then the preference chain is walked in declared order. A profile is eligible if and only if every provider it uses is available; probes are lazy and memoized once per provider per pass, and a probe failure is never availability. The first fully eligible profile wins; later eligible profiles are reported as shadowed-equivalent. The decision is a structured envelope carrying the profile, tier, rung, per-agent overrides, the full eligibility list, and events.

The engine also delivers profile-level lifecycle semantics. Expensive windows park a provider with a closed cause and absolute expiry (read-time resume, no timer). Subscription exhaustion **switches** to the next eligible profile instead of stalling the spawn, and the selected target persists in state as one additive record. When the exhausted provider recovers, the target **reverts** automatically and exactly one revert event is recorded per episode.

Provider watching extends the provider family with three normalized snapshot mappings behind the existing quota transport seam: coding-plan subscription windows (weekly and rolling), the DeepSeek balance (compared to a configured floor), and OpenAI usage windows. Watch reads are read-only and write no state; every malformed, non-auth-HTTP, transport, or credential failure is an outage or credential condition, never clear.

Dispatch-daemon integration, the audit ledger, and spend reporting are out of scope. The `provider profile resolve --for-spawn` seam and the `data-v1` env-record contract are the machinery those later stories consume.

## Configuration Model

The `provider.profiles` branch is a typed record-map branch (GH-234 F-1, DM-1..DM-5):

- `tiers`: a dynamic-name map of named responsibility groups.
- `profiles`: a dynamic-name map; each profile declares `tier`, `providers`, `seats`, and optional `agentOverrides`. A seat declares `model`, `pacingClass` (`judgment` | `execution`), `capability` (`vision-capable` | `text-only`), and an optional explicit `envName`.
- `preferenceChain`: `base` plus ordered `fallbacks`; the effective order is base-first.
- `pacing`: an ordered `goalPriorities` list, a `tailThresholdPercent`, and a dynamic-name map of `rungs` (each with `thresholdPercent` and `executionModel`).
- `watch`: a dynamic-name map of watch targets (mapping kind, HTTPS endpoint, credential reference, optional floor and threshold).
- `envRecord`: optional grammar overrides (header, name pattern, byte/line/record limits).

Record maps merge by child name, lists replace whole, and a reset removes inherited values, matching the delivered catalog rules. Validation is fail-closed and classified: unknown tiers, profiles, providers, credentials, or seats; duplicate chain entries; duplicate goal priorities; a closed-value violation; or a malformed threshold names the offending field and returns no partial decision. `config debug` and `config get --show-origin` expose the winning layer and source of every effective value.

The branch ships empty (`provider.profiles: {}`): no tier, profile, chain, rung, goal priority, or threshold is invented.

## Selection and Eligibility

- **Capability gate (F-3):** the target seat's declared capability is read before eligibility preference. A text-only seat is refused for a vision task and the refusal names the capability blocker. Names are never consulted.
- **Eligibility (F-4):** a profile is a candidate iff every provider it uses is available under the engine's existing condition vocabulary. Providers are probed only when a decision depends on them; a provider shared by N profiles is probed once per pass; a probe that throws or returns unavailable is a named blocker, never clear.
- **Order (F-2):** the declared preference order is authoritative. The first fully eligible profile wins; every later profile still receives exactly one verdict (`shadowed`) without being probed.
- **Fail-closed:** when no profile is eligible, the decision is `provider.profile.unavailable` with the full eligibility list and a `profile.ineligible` event. The CLI projects this to exit 2.
- **Heuristics (F-2, DEC-7):** `scoreProfileTask` evaluates consequence × reasoning depth ÷ volume under a supplied policy, with amplification and family-diversity rules read from the policy data. No weight is embedded in the evaluated path.
- **Events (EVT-1..EVT-5):** selection, switch, revert, ineligible, and rung-change events join the guarded vocabulary with bounded evidence, deterministic identities, and dedupe.

## Park, Switch, and Revert

- **Expensive windows (F-6, DM-10):** a declared UTC peak window parks with the engine's `peak-window` cause and an absolute expiry at the effective window end. Profiles using the provider are ineligible with the park named as a blocker; the next resolution after expiry observes clear with no timer.
- **Switch-not-park (EVT-1):** exhaustion of a subscription provider makes the profile ineligible; the chain selects the next eligible profile. The switch event carries the previous target, the new target, and the revert condition.
- **Persisted target (EVT-4):** one additive state record kind `provider.profile-target` with payload schema `delivery.provider.profile-target.v1` and store-scoped key `provider.profile-target`. Appends are fenced, latest-wins, verified by a post-append read, and only occur on change. There is no schema-version bump or migration.
- **Revert-on-recovery (EVT-2):** when the preferred profile is selected again, the target reverts and exactly one revert event is recorded per exhaustion episode. Flapping is bounded by the memoized probes, the recorded revert condition, and identity dedupe.

## Pacing

Every seat assignment carries the typed `pacingClass`. Rungs move only `execution` seats; `judgment` seats are structurally immovable and stay on their assigned model until the declared subscription-window tail. `pacing.goalPriorities` is an ordered list: the declared order is the precedence (first declared wins), with no hardcoded ordering. A duplicate priority is a validation error. Rung changes are recorded as `profile.rung-changed` events and deduplicated for an unchanged rung.

## Watching

The first-iteration watch set is declared as configuration on `provider.profiles.watch` and bound to three normalized mappings inside `packages/adapters/src/provider-quota/`:

| Mapping kind | Normalized source |
|---|---|
| `coding-plan-windows` | weekly and rolling window percentages with reset instants |
| `deepseek-balance` | numeric balance compared to the configured floor; below-floor is `provider.quota.exceeded` with an operator top-up recovery condition |
| `openai-usage-windows` | declared usage windows and percentages; the window end supplies the park expiry |

Authorization resolves only through the credential port; material is handed once to the transport and never cached, logged, persisted, or returned. `provider watch status [--provider <name>]` reports `name`, `condition`, `source` (mapping summary), and `checkedAt` from the injected clock. The read path accepts no state store and performs zero writes. A malformed, non-auth-HTTP, transport, or credential failure is an outage or credential condition, never clear; a missing fixture fails the mapping test naming it.

## Spawn Integration and Env Records

Profile resolution runs before any harness spawn. `provider profile resolve --for-spawn` emits the resolved model environment as a structured env record with `recordFormat: "data-v1"`; the serialized wire form is the header line, `set NAME=value` / `unset NAME` records, and a final line feed. The spawn wrapper injects the validated variables into the harness spawn-env seam's deny-by-default construction; undeclared parent variables remain absent.

The hardened record contract preserves the carried-over floor (exact header, only set/unset records, allowlist match, no duplicate names, final LF, CR/NUL rejection, byte/line/record limits) and adds the hardened ceiling (strict ASCII identifier, embedded equals rejected, homoglyph/non-ASCII rejected, metacharacters rejected, exact allowlist match). The built-in allowlist shape is `OC_<PREFIX>_AGENT_<SEAT>_MODEL`; the concrete product prefix is a branding value, and the pattern is overridable by configuration. Values are data: no shell is invoked and no value is interpreted at any consumption point. A refusal is classified and never partially applied.

The legacy bash hook is not modified: its versioned data-record contract remains the authoritative bash-surface executor, and its file-metadata classes (safe regular file, ownership, permissions) remain the legacy-path oracle. M1-S9 and M1-S20 own surface rewiring.

## CLI Surface

```
provider resolve [--chain <name>] [--profile <name>]
provider profile resolve [--agent <name>] [--for-spawn]
provider watch status [--provider <name>]
provider quota [--provider <name>]
provider parks list [--all] [--provider <name>]
```

Envelope `data`: (`profile resolve`) `profile`, `eligibility[]` (profile, verdict, blockers), `rung`, `agentOverrides`, `envRecord` with `--for-spawn`, and `events`; (`watch status`) `providers[]` (name, condition, source, checkedAt); (`resolve`) the delivered `provider`/`mode`/`decision`/`parksConsidered` shape with an optional `profile` echo.

Exit conventions: 0 resolved or read; 1 classified misconfiguration (including the empty-by-default refusal); 2 all candidates skipped or exhausted, announced with reasons. Invalid grammar is a classified invocation error with no resolution, probe, credential read, or state write.

## Guarded Vocabulary and Error Identities

New codes join the engine's closed, guarded sets in-change:

- Events: `profile.selected`, `profile.switched`, `profile.reverted`, `profile.ineligible`, `profile.rung-changed`.
- State record kind: `provider.profile-target` (schema `delivery.provider.profile-target.v1`).
- Error identities: `provider.profile.absent`, `provider.profile.invalid`, `provider.profile.capability-denied`, `provider.profile.unavailable`, `provider.env-record.unauthorized`, `provider.env-record.duplicate`, `provider.env-record.malformed`, `provider.env-record.oversized`.
- Watch mapping kinds: `coding-plan-windows`, `deepseek-balance`, `openai-usage-windows`.

Existing provider-engine rows, condition kinds, parks, announcements, and schema identifiers are unchanged. Error identities are synchronized in both directions with the documented table, and classification is exact-code with `fallback.internal` containment.

## Boundaries and Non-Functional Guarantees

Selection, lifecycle, pacing, and env-record policy are pure and runtime-neutral: they import only core contracts, use no ambient clock/randomness/environment/filesystem/network, and accept every seam as an injected parameter. Watch transports live only inside the declared `packages/adapters/src/provider-quota/` runtime-API edge; no new subpath, dependency, or secret-read allowlist entry is added. Evidence is bounded to the closed allowlists (≤ 1024 bytes, ≤ 20 fields). The suite is hermetic: zero live network, zero live credential reads, zero real sleeps. Identical configuration, provider facts, and injected clock produce identical decisions, eligibility lists, env records, and event identities across repeated runs.

## Acceptance Trace

| AC | Where satisfied |
|---|---|
| AC-F8-1 | resolve-before-spawn seam, `data-v1` record, classified refusal, require tests |
| AC-F6-1 | peak-window park with cause/expiry and read-time resume |
| AC-F6-2 | switch-not-park, persisted target, exactly-once revert |
| AC-F3-3 | hard capability gate and named blockers |
| AC-F7-4 | declared-order pacing, typed execution-only movement |
| AC-F1-5 | configuration-only tuning, fail-closed validation, provenance |
| AC-F11-6 | ported decision-table groups 1-5 and no-silent-path matrix |
| AC-F9-7 | watch status envelope/filter, malformed-never-clear, zero writes |
| AC-F8-8 | machinery/seam delivered; milestone evidence via M1-S9/M1-S22 |

## Related Documents

- [Provider Engine](feature-provider-engine.md) — the delivered availability engine this feature composes.
- [Configuration Layer and Inspection](feature-config-layer.md) — layered merge, reset, and provenance.
- [State Layer](feature-state-layer.md) — additive record kinds and fenced appends.
- [Result Contract and Error Table](feature-result-contract.md) — envelopes, exits, and error identities.
- [Harness Adapters](feature-harness-adapters.md) — the deny-by-default spawn-environment seam.
