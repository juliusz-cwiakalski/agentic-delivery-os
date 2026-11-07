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

Selection is pure policy. The hard capability gate runs first (a text-only seat never receives a vision task, regardless of chain position or quota pressure), then the preference chain is walked in declared order. A profile is eligible if and only if every provider it uses is available; probes are lazy and memoized once per provider per pass, and a probe failure is never availability. The first fully eligible profile wins; every later profile is reported as shadowed-equivalent without a probe. The decision is a structured envelope carrying the profile, tier, rung, per-agent overrides, the full eligibility list, and events.

Profile-level lifecycle semantics run on every production `provider profile resolve`: after selection the edge reads the persisted target, evaluates the switch/revert decision, and persists a changed target. Expensive windows park a provider with a closed cause and absolute expiry (read-time resume, no timer). An unavailable provider condition makes its profiles ineligible and **switches** the target to the next eligible profile instead of stalling the spawn, and the selected target persists in state as one additive record. When the preferred profile becomes eligible again, the target **reverts** automatically and exactly one revert event is recorded per episode.

Provider watching extends the provider family with three normalized snapshot mappings behind the existing quota transport seam: coding-plan subscription windows (weekly and rolling), the DeepSeek balance (compared to a configured floor), and OpenAI usage windows. Watch reads are read-only and write no state; every malformed, non-auth-HTTP, transport, or credential failure is an outage or credential condition, never clear.

Dispatch-daemon integration, the audit ledger, and spend reporting are out of scope. The `provider profile resolve --for-spawn` seam and the `data-v1` env-record contract are the machinery those later stories consume.

## Configuration Model

The `provider.profiles` branch is a typed record-map branch (GH-234 F-1, DM-1..DM-5):

- `tiers`: a dynamic-name map of named responsibility groups.
- `profiles`: a dynamic-name map; each profile declares `tier`, `providers`, `seats`, and optional `agentOverrides`. A seat declares `model`, `pacingClass` (`judgment` | `execution`), `capability` (`vision-capable` | `text-only`), and an optional explicit `envName`.
- `preferenceChain`: `base` plus ordered `fallbacks`; the effective order is base-first.
- `pacing`: an ordered `goalPriorities` list, a `tailThresholdPercent`, and a dynamic-name map of `rungs` (each with `thresholdPercent` and `executionModel`).
- `watch`: a dynamic-name map keyed by provider name; each target declares a mapping kind, an HTTPS endpoint, a credential reference, and optional floor and threshold. Watch targets live only under `provider.profiles.watch`; `provider.entries` carries no watch data.
- `envRecord`: optional grammar overrides (header, name pattern, byte/line/record limits).

Record maps merge by child name, lists replace whole, and a reset removes inherited values, matching the catalog rules. Validation is fail-closed and classified: unknown tiers, profiles, providers, credentials, or seats; a profile, provider-reference, or seat name longer than 64 characters; duplicate chain entries; duplicate goal priorities; a closed-value violation; an `envRecord.header` containing LF, CR, or NUL; or a malformed threshold names the offending field and returns no partial decision. `config debug` and `config get --show-origin` expose the winning layer and source of every effective value.

The branch ships empty (`provider.profiles: {}`): no tier, profile, chain, rung, goal priority, or threshold is invented. This empty default is fail-closed: until a preference chain is declared, resolution refuses with the classified `provider.profile.absent` identity rather than inventing a model.

## Selection and Eligibility

- **Capability gate (F-3):** the target seat's declared capability is read before eligibility preference. A text-only seat is refused for a vision task and the refusal names the capability blocker. Names are never consulted. When every blocker on every losing candidate is a capability blocker, the refusal is the classified `provider.profile.capability-denied` identity.
- **Eligibility (F-4):** a profile is a candidate iff every provider it uses is available under the engine's existing condition vocabulary. Providers are probed only when a decision depends on them; a provider shared by N profiles is probed once per pass; a probe that throws or returns unavailable is a named blocker, never clear.
- **Production probe:** the composed CLI availability probe is synchronous: a provider is available when it is declared, enabled, and outside its UTC peak window. Quota-condition probing and the asynchronous re-evaluation loop are not part of the synchronous probe; they belong to the M1-S9 dispatch daemon that consumes the same profile seam.
- **Order (F-2):** the declared preference order is authoritative. The first fully eligible profile wins; every later profile still receives exactly one verdict (`shadowed`) without being probed.
- **Fail-closed:** when no profile is eligible, selection emits a `profile.ineligible` event carrying the bounded blockers. The refusal is `provider.profile.capability-denied` (user-validation, exit 1) when every blocker on every losing candidate is a capability blocker; otherwise it is `provider.profile.unavailable`, projected as a refusal envelope with the full eligibility list at exit 2.
- **Heuristics (F-2, DEC-7):** `scoreProfileTask` evaluates consequence × reasoning depth ÷ volume under a supplied policy, with amplification and family-diversity rules read from the policy data. No weight is embedded in the evaluated path.
- **Events (EVT-1..EVT-5):** selection, switch, revert, ineligible, and rung-change events join the guarded vocabulary with bounded evidence, deterministic identities, and dedupe.

## Park, Switch, and Revert

- **Production resolve path:** every `provider profile resolve` invocation, with or without `--for-spawn`, runs the lifecycle: select the profile, read the persisted target, evaluate the switch/revert decision, and persist the target when it changed. The `switched` and `reverted` outcomes, their events, and the target record are produced by the shipped CLI surface, not only by engine internals.
- **Expensive windows (F-6, DM-10):** a declared UTC peak window parks with the engine's `peak-window` cause and an absolute expiry at the effective window end. Profiles using the provider are ineligible with the park named as a blocker; the next resolution after expiry observes clear with no timer.
- **Switch-not-park (EVT-1):** an unavailable provider condition makes every profile using it ineligible; the chain selects the next eligible profile and the target switches. The switch event carries the previous target, the new target, the unavailable provider, and the revert condition. The synchronous CLI probe reports a provider available only when it is declared and enabled and outside its UTC peak window; quota-exhaustion conditions reach the same seam through the M1-S9 dispatch daemon, never through a quota fetch on the CLI probe.
- **Persisted target (EVT-4):** one additive state record kind `provider.profile-target` with payload schema `delivery.provider.profile-target.v1` and store-scoped key `provider.profile-target`. Appends are fenced, latest-wins, verified by a post-append read, and only occur on change. There is no schema-version bump or migration.
- **Revert-on-recovery (EVT-2):** when the preferred profile is selected again, the target reverts and exactly one revert event is recorded per episode. The event names the recovering provider and the recorded revert condition; an unchanged target appends nothing. Flapping is bounded by the memoized probes, the recorded revert condition, and identity dedupe.

## Pacing

Every seat assignment carries the typed `pacingClass`. A rung moves only `execution` seats; `judgment` seats are structurally immovable at every rung and never receive a rung model. **Pacing precedence:** `pacing.goalPriorities` is an ordered list whose declared order is the precedence — the first declared priority governs execution-seat movement, no hardcoded priority ordering exists, and a duplicate priority is a validation error. Under `utilize-subscription`, execution seats move at the active rung threshold; under `hold-judgment`, movement waits for the declared subscription-window tail threshold; under `minimize-paid`, movement starts as soon as utilization is above zero and a rung is active. Rung changes are recorded as `profile.rung-changed` events and deduplicated for an unchanged rung.

## Watching

The first-iteration watch set is declared as configuration on `provider.profiles.watch`, keyed by provider name, and bound to three normalized mappings inside `packages/adapters/src/provider-quota/`:

| Mapping kind | Normalized source |
|---|---|
| `coding-plan-windows` | weekly and rolling window percentages with reset instants |
| `deepseek-balance` | numeric balance compared to the configured floor; below-floor is `provider.quota.exceeded` with an operator top-up recovery condition |
| `openai-usage-windows` | declared usage windows and percentages; the window end supplies the park expiry |

Authorization resolves only through the credential port; material is handed once to the transport and never cached, logged, persisted, or returned. `provider watch status [--provider <name>]` reports `name`, `condition`, `source` (mapping summary), and `checkedAt` from the injected clock. The read path accepts no state store and performs zero writes. A malformed, non-auth-HTTP, transport, or credential failure is an outage or credential condition, never clear; a missing fixture fails the mapping test naming it.

## Spawn Integration and Env Records

Profile resolution runs before any harness spawn. `provider profile resolve --for-spawn` emits the resolved model environment as a structured env record: `recordFormat: "data-v1"`, ordered `entries` of `set`/`unset` operations, and the rendered `serialized` text. The serialized form is the wrapper-consumed wire form: the header line, `set NAME=value` / `unset NAME` records, and a final line feed. The spawn wrapper injects the validated variables into the harness spawn-env seam's deny-by-default construction; undeclared parent variables remain absent, and a validated record value takes precedence over the parent value for a declared name.

The record contract enforces the legacy floor (exact header, only set/unset records, allowlist match, no duplicate names, final LF, CR/NUL rejection, byte/line/record limits) and the hardened ceiling (strict ASCII identifier, embedded equals rejected, homoglyph/non-ASCII rejected, metacharacters rejected, exact allowlist match). The configured header itself may not contain LF, CR, or NUL: such a value is a classified configuration error at parse time and is refused again when a record is serialized. The default header is `# model-env data-v1`, and the default allowlist pattern is `^OC_[A-Z][A-Z0-9]*_AGENT_[A-Z0-9_]+_MODEL$`: the concrete product prefix is a branding value, never hardcoded. The legacy surface selects its pre-freeze header and product-prefixed allowlist through the same injectable grammar options; production defaults stay brand-neutral. Values are data: no shell is invoked and no value is interpreted at any consumption point. A refusal is classified and never partially applied.

The legacy bash hook remains the authoritative bash-surface executor: its versioned data-record contract governs that surface, and its file-metadata classes (safe regular file, ownership, permissions) govern the legacy path. M1-S9 and M1-S20 own surface rewiring.

## CLI Surface

```
provider resolve [--chain <name>] [--profile <name>]
provider profile resolve [--agent <name>] [--for-spawn]
provider watch status [--provider <name>]
provider quota [--provider <name>]
provider parks list [--all] [--provider <name>]
```

Envelope `data`: (`profile resolve`) `outcome` (`selected` | `switched` | `reverted`, or `refused` on the unavailable refusal), `profile`, `eligibility[]` (profile, verdict, blockers), `rung`, `agentOverrides`, the structured `envRecord` with `--for-spawn`, `events`, and `summary`; (`watch status`) `providers[]` (name, condition, source, checkedAt); (`resolve`) the provider-engine payload (`summary`, `chain`, `decision`, `skipped`, `parks`, `announcements`) with the named `profile` scope added when `--profile` is supplied.

`provider resolve --profile <name>` is enforced, not echoed. The named profile is validated against the configured `provider.profiles` branch; an unknown or invalid name is the classified `provider.profile.invalid` misconfiguration at exit 1. A known name restricts chain candidates to that profile's declared providers, and a profile that contributes no entry to the selected chain is `provider.chain.empty`. The envelope shape stays the provider-engine resolve payload.

Exit conventions: 0 resolved or read; 1 classified misconfiguration (including the empty-by-default refusal); 2 all candidates skipped or exhausted, announced with reasons. Invalid grammar is a classified invocation error with no resolution, probe, credential read, or state write.

## Guarded Vocabulary and Error Identities

The engine's closed, guarded sets carry these members:

- Events: `profile.selected`, `profile.switched`, `profile.reverted`, `profile.ineligible`, `profile.rung-changed`.
- State record kind: `provider.profile-target` (schema `delivery.provider.profile-target.v1`).
- Error identities: `provider.profile.absent`, `provider.profile.invalid`, `provider.profile.capability-denied`, `provider.profile.unavailable`, `provider.env-record.unauthorized`, `provider.env-record.duplicate`, `provider.env-record.malformed`, `provider.env-record.oversized`.
- Watch mapping kinds: `coding-plan-windows`, `deepseek-balance`, `openai-usage-windows`.

The provider-engine rows, condition kinds, parks, announcements, and schema identifiers documented in [Provider Engine](feature-provider-engine.md) remain part of the same closed sets. Error identities are synchronized in both directions with the documented table, and classification is exact-code with `fallback.internal` containment.

## Quality Assurance Strategy

| Level | Location | Scope |
|---|---|---|
| Structure and contract inventory | `tests/structure/provider-profile-contract.test.ts`, `provider-contract.test.ts`, `error-table.test.ts`, `content-inventory.test.ts` | Contract inventory, closed vocabularies, schema identifiers, error rows, and content inventory. |
| Behaviour | `tests/behaviour/provider-profile-*.test.ts`, `provider-watch-*.test.ts` | Configuration validation, selection and lazy probes, park/switch/revert, pacing, spawn and env records, CLI projection, watch mappings, and watch status. |
| Legacy decision table | `tests/behaviour/provider-profile-legacy-decision-table.test.ts` | Ported decision-table groups 1-5 and the no-silent-path matrix. |
| Golden output | `tests/golden/provider-profile-*.test.ts`, `provider-watch-status.test.ts` | Recorded machine and human output for profile selection, switch, watch status, and refusal. |
| Checks and security | `tests/checks/provider-profile-hermetic.test.ts`, `provider-profile-evidence-bounds.test.ts`, `tests/boundaries/**` | Hermetic policy, secret canaries, bounded evidence, runtime confinement, and the byte-identical legacy-hook guard. |
| Aggregate | `pnpm check` | Whole workspace. |

## Boundaries and Non-Functional Guarantees

Selection, lifecycle, pacing, and env-record policy are pure and runtime-neutral: they import only core contracts, use no ambient clock/randomness/environment/filesystem/network, and accept every seam as an injected parameter. Watch transports live only inside the declared `packages/adapters/src/provider-quota/` runtime-API edge; no other subpath, dependency, or secret-read allowlist entry exists for profile watching. Event evidence is structurally bounded over the closed allowlists (≤ 20 fields, ≤ 1024 bytes): profile, provider-reference, and seat names are capped at configuration validation, serialization truncates each evidence string and array to a fixed budget and shrinks evidence deterministically until the event skeleton fits, and the 1024-byte UTF-8 bound is re-asserted after message truncation. The suite is hermetic: zero live network, zero live credential reads, zero real sleeps. Identical configuration, provider facts, and injected clock produce identical decisions, eligibility lists, env records, and event identities across repeated runs.

All declared windows and expiries are evaluated on the provider engine's UTC basis; non-UTC and local-timezone windows are not modeled.

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
- [Provider Conditions and Parks](../../guides/provider-conditions-and-parks.md) — the operator-facing condition, park, and resume contract reused by profile selection.
- [Harness Adapters](feature-harness-adapters.md) — the deny-by-default spawn-environment seam.
