---
ados_distribution: internal
id: SPEC-PROVIDER-ENGINE
status: Current
created: 2026-10-31
last_updated: 2026-10-31
owners: ["engineering"]
service: delivery-os
summary: "The provider v1 engine: the typed provider configuration branch and shipped defaults, deterministic subscription-first chain resolution with eight skip reasons, UTC peak and subscription-quota evaluation combined by MAX, named self-expiring parks persisted as provider.park ledger records and folded into provider-parks.json, fail-loud announcements, credential-port-only quota authorization, the resolve/quota/parks-list CLI surface, the five provider error identities, and the pure-core / provider-quota adapter boundaries."
links:
  related_changes: ["GH-182"]
  related_decisions: ["ADR-0003", "ADR-0005", "ADR-0007"]
  contracts:
    - "packages/core/src/contracts/provider.ts"
    - "packages/adapters/src/provider-quota/index.ts"
---

# Feature: Provider Engine

## Overview

The provider engine decides which declared AI model provider entry is available for a spawn. It validates typed provider configuration, resolves a named chain in declared order, evaluates every entry's peak-window and subscription-quota conditions, and selects the first eligible entry under a subscription-first cost policy — or returns a chain park carrying an honest resume time. Every pause is a named, self-expiring park persisted through the state layer, and every failure to determine availability is a structured announcement rather than a silent "clear" verdict. Quota authorization resolves only through the credential port.

The engine does not select models or spawn sessions. It returns a decision plus durable availability state that the later spawn gate and the status, queue-readiness, doctor, spend, and ceremony surfaces consume. The minimal command surface is `ados provider resolve`, `ados provider quota`, and `ados provider parks list`.

The configuration branch is specified in [Configuration Layer and Inspection](feature-config-layer.md); the ledger records and projection in [State Layer](feature-state-layer.md); failure identity and the envelope in [Result Contract and Error Table](feature-result-contract.md); credential resolution and runtime confinement in [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md); package tiers and boundary mechanics in [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md). Placement follows [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md); the quota transport follows the reviewed confinement path of [ADR-0005](../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md); the engine's placement, fail-loud semantics, park vocabulary, and cost policy are recorded in [ADR-0007](../../decisions/ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) (Proposed, owner acceptance pending).

## Business Context

### Problem Statement

- **Problem:** Provider selection without a declared cost-aware chain and a durable pause record produces silent stalls, unaccounted paid capacity, and an indeterminate quota verdict that is indistinguishable from a clear quota. Agents and operators cannot tell why work did not start, whether paying more will help, or when a provider will resume.
- **Affected Users:** Operators, the coordinator and lifecycle agents that route work, and the later surfaces (status, queue readiness, doctor, spend, ceremony) that consume one provider-availability vocabulary.
- **Business Impact:** Every silent provider stall or indeterminate availability verdict is lost delivery time and unaccounted cost. Subscription-first routing plus a durable park with a resume time converts that loss into a bounded, diagnosable pause and protects subscription quota before paid capacity.

### Goals

- Declare provider descriptors, cost classes, peak windows, quota policy, credential references, and chains as typed, validated, layered configuration.
- Resolve a chain deterministically with subscription entries before pay-per-token entries and report every skip with one closed reason.
- Evaluate peak and quota conditions provider-agnostically and combine them by the MAX rule.
- Represent every non-clear condition as a named park with a closed cause, the active conditions, and an absolute expiry.
- Make every outage, indeterminate quota verdict, credential failure, chain exhaustion, and loop-cap outcome a structured announcement.
- Authorize quota fetches only through the credential port.
- Expose a bounded `ados provider` surface whose machine results are CommandResult envelopes.

## User Experience & Functionality

### Configuration model

Provider configuration is the typed `provider` branch of the layered catalog. All values are overridable per configuration layer, and every effective value reports its winning origin through `config debug`.

| Element | Shape | Default |
|---------|-------|---------|
| `provider.defaultChain` | Chain name used when `--chain` is omitted. | absent; `resolve` then requires an explicit chain |
| `provider.credentials.<name>.sourceKey.style` | `literal` or `environment-prefixed`. | required |
| `provider.credentials.<name>.sourceKey.name` | Source key used verbatim by a `literal` reference. | required for `literal` |
| `provider.credentials.<name>.sourceKey.suffix` | Suffix appended to the branding environment prefix. | required for `environment-prefixed` |
| `provider.entries.<name>.class` | `subscription` or `pay-per-token`. | required |
| `provider.entries.<name>.enabled` | Boolean descriptor gate. | `true` |
| `provider.entries.<name>.peak` | Optional UTC peak window. | absent; no peak condition |
| `provider.entries.<name>.quota` | Optional subscription quota policy. | absent; no quota condition |
| `peak.timezone` | Timezone basis. | `UTC`; only `UTC` is admitted |
| `peak.startSecondsOfDay` / `peak.endSecondsOfDay` | UTC seconds-of-day, end strictly greater than start. | required when peak is present |
| `peak.bufferSeconds` | Non-negative buffer that advances the effective start. | `0` |
| `quota.enabled` | Whether the quota endpoint is evaluated. | `true` |
| `quota.endpoint` | HTTPS endpoint without userinfo. | required when the quota block is present |
| `quota.credentialRef` | Name of a declared credential reference. | required when the quota block is present |
| `quota.timeoutMs` | Positive request timeout. | `15000` |
| `quota.thresholdPercent` | Integer `0..100`; a percentage at or above it is exhausted. | `100` |
| `quota.maxSleepLoops` | Positive defensive re-evaluation cap. | `24` |
| `quota.outageParkTtlSeconds` | Outage park TTL. | `300` |
| `quota.credentialParkTtlSeconds` | Credential-failure park TTL. | `900` |
| `quota.capParkTtlSeconds` | `reevaluation-cap` park TTL. | `300` |
| `provider.chains.<name>.entries` | Non-empty ordered list of declared descriptor names. | required |
| `provider.chains.<name>.allowPaidFallback` | Whether a pay-per-token entry may be selected. | `false` |

Provider dynamic-name maps (`credentials`, `entries`, `chains`) use the catalog's `record` field kind: child names are arbitrary and each child value is validated against the declared shape. Fixed branches keep exact unknown-key discipline.

The shipped defaults provide one concrete subscription descriptor and its credential reference, both overridable:

- `provider.entries.zai-coding-plan`: class `subscription`, enabled, UTC peak window `06:00–10:00` with a `7200`-second buffer (pausing from `04:00` UTC), and an enabled quota policy against `https://api.z.ai/api/monitor/usage/quota/limit` with credential reference `zai`.
- `provider.credentials.zai`: `sourceKey` `{ style: literal, name: ZAI_API_KEY }`, a reference only and never a secret value.
- `provider.chains`: empty, and `provider.defaultChain` is absent. A fresh installation therefore fails closed with `provider.chain.empty` until an operator declares a chain.

### Validation

Configuration is parsed from the already-resolved tree and then semantically validated. Schema checks cover types, enums, integer ranges, and required fields. The pure provider validator enforces the relational rules the schema cannot express:

- Every quota `credentialRef` must name a declared credential reference.
- A quota endpoint must be HTTPS with a non-empty authority, no userinfo, and no whitespace.
- Every chain must have at least one entry.
- Chain entries must name declared descriptors and must not repeat.
- Every subscription entry must precede every pay-per-token entry.
- A declared `provider.defaultChain` must name a declared chain.
- A peak window must be non-empty and must not cross midnight.

Structural or relational violations fail `provider.chain.invalid`. An absent default chain, an undeclared requested chain, or a chain with no entries fails `provider.chain.empty`. No silent reordering, substitution, or default chain is invented.

### Chain resolution

Resolution walks the selected chain in declared order and selects the first eligible entry. An entry is eligible when it is enabled, its combined condition is clear, and either it is a subscription entry or the chain allows paid fallback and no subscription entry is parked for a peak window. A peak-window park therefore never substitutes paid capacity.

Every non-selected entry is reported with exactly one reason from the closed eight-value set:

| Reason | Meaning |
|--------|---------|
| `disabled` | The descriptor's `enabled` flag is false. |
| `peak-window` | The entry is parked in its peak window. |
| `quota-exhausted` | The entry is parked on an exhausted quota limit. |
| `provider-outage` | The entry is parked on a transport, HTTP, envelope, or parse failure. |
| `credential-missing` | The entry is parked because its credential reference could not resolve. |
| `credential-rejected` | The entry is parked because the provider rejected the credential (HTTP 401/403). |
| `paid-fallback-not-allowed` | A pay-per-token entry is not selectable because the chain disables paid fallback. |
| `shadowed` | An entry with no higher-precedence reason follows the selected entry or, in a parked decision, the determining entry. |

Precedence is deterministic: `disabled`, then the entry's own condition cause, then `paid-fallback-not-allowed`, then `shadowed`.

When no entry is eligible but at least one enabled entry is parked, the decision is parked. The chain park is named `chain:<name>`, has cause `chain-exhausted`, carries the union of contributing condition kinds, and expires at the earliest contributing provider expiry. When no contributing park can supply a future expiry, resolution fails with a classified provider failure instead of fabricating one. If any evaluated entry cannot produce an honest resume time (an exhausted quota limit with no valid reset), resolution fails immediately with `provider.quota.exceeded` and persists no park or announcement for that attempt.

### Peak windows

A peak window is a UTC start second-of-day, end second-of-day, buffer, and timezone `UTC`. The effective pause window is the half-open interval `[max(0, start − buffer), end)`. Inside it the condition parks for the seconds until the window end, with an absolute expiry at that instant. Outside it the condition is clear. Evaluation is pure arithmetic over the injected clock; no vendor value is hardcoded. Non-UTC, empty, out-of-range, and cross-midnight windows fail validation.

### Quota evaluation

A subscription descriptor with an enabled quota policy issues one bounded HTTPS `GET` through the injected quota transport. The sanitized response is normalized into a secret-free snapshot of limits: each limit carries a type, a non-negative integer percentage, and an optional reset epoch in milliseconds. Only `TOKENS_LIMIT` entries participate in exhaustion; `TIME_LIMIT` entries are ignored.

A limit is exhausted when its percentage is at or above the configured threshold. The soonest future reset among exhausted limits determines the wait and the park expiry. A past or equal-to-now reset clamps to zero wait and leaves the condition clear. An exhausted limit with no valid reset is not given a fabricated expiry: resolution fails with `provider.quota.exceeded` and surfaces the `provider.quota.reset_missing` announcement code in the safe summary and diagnostic stream, with no state park or announcement record.

Malformed JSON, an invalid envelope (`code` not `200` or `success` not `true`), absent or non-array limits, a non-object limit, a non-string limit type, and a non-numeric percentage are malformed-response failures. They are classified as outages and announced; they are never treated as clear.

### Conditions and MAX

Peak and quota are independent conditions on one entry. They are combined by the MAX rule: the later expiry wins, the park lists every active condition kind, and the single cause is the condition that determines the expiry. Ties resolve in the fixed order `peak-window`, `quota-exhausted`, `provider-outage`, `credential-missing`, `credential-rejected`.

### Parks

Every non-clear provider condition becomes a named park. Provider parks are named `provider:<name>`; chain parks are named `chain:<name>`. A park carries:

- a cause from the closed set `peak-window`, `quota-exhausted`, `provider-outage`, `credential-missing`, `credential-rejected`, `chain-exhausted`, or `reevaluation-cap`;
- the active condition kinds;
- a creation time and an absolute expiry strictly in the future at creation;
- bounded, secret-free evidence drawn only from the eight-field park allowlist: `providerName`, `chainName`, `conditionKinds`, `waitSeconds`, `resetEpochMs`, `httpStatus`, `failureClass`, and `credentialRefName` (the reference name only, never the resolved value).

A peak or quota park expires at the determining condition's end. An outage or credential-failure park uses its configured TTL. A `reevaluation-cap` park uses the configured cap TTL. A `chain-exhausted` park uses the earliest contributing provider expiry. A park is always a provider-availability pause with a guaranteed resume time; it is never a blocked lane, never a delivery failure, and never hides a lane's readiness condition.

Expiry is derived at read time: a park is active while `expiresAt > now` and inactive at exactly `expiresAt <= now`. No timer, daemon, delete, or expiry write exists. An unchanged active generation (`cause:expiresAtMs`) appends nothing; a changed cause or expiry appends a new record and the latest record per park name wins. When a previously active park is observed with no current active record for its name, the next mutating resolve appends one `cleared` record and one `provider.resumed` announcement.

### Announcements

Every non-clear condition that persists a park emits exactly one structured announcement for that park generation. An outage on an entry skipped in favour of another is still announced and parked, so the result remains truthful when the chain succeeds elsewhere. Announcement identity is deterministic from the subject kind, subject name, code, and park generation, so an unchanged condition never appends a duplicate.

Announcements use a closed code set:

`provider.peak.parked`, `provider.quota.parked`, `provider.quota.reset_missing`, `provider.quota.unreachable`, `provider.quota.http_error`, `provider.quota.auth_rejected`, `provider.quota.malformed`, `provider.credential.missing`, `provider.chain.exhausted`, `provider.reevaluation.cap`, and `provider.resumed`.

`provider.peak.parked`, `provider.quota.parked`, and `provider.resumed` are informational; every other code is a warning. An announcement carries a safe templated message and bounded evidence drawn from the eight base park fields plus `parkName`, `parkExpiresAt`, and `announcementCode`. No announcement carries a secret, authorization header, raw response body, or endpoint userinfo.

Announcements surface in three places: inside `data.announcements` for `resolve` and a successful `quota`; in the classified error envelope plus the diagnostic stream for a failure that produces no park; and in the state ledger as `provider.announcement` records when a resolution persists park state. A failing `quota` carries the announcement code in the safe summary.

### Credential authorization

Quota authorization resolves the descriptor's `credentialRef` only through the `CredentialPort`. The resolved material is handed once to the quota transport for one request, used to build the authorization header in memory, and never cached, logged, persisted, or returned in evidence.

- A declared credential reference that cannot resolve through the port produces a `credential-missing` park with TTL `credentialParkTtlSeconds`, a `provider.credential.missing` announcement, and `failureClass: config.credential.missing`. No fetch is attempted.
- HTTP 401/403 produces a `credential-rejected` park with TTL `credentialParkTtlSeconds` and a `provider.quota.auth_rejected` announcement.
- A transport failure produces a `provider-outage` park with TTL `outageParkTtlSeconds` and a `provider.quota.unreachable` announcement.
- A non-auth HTTP failure produces a `provider-outage` park and a `provider.quota.http_error` announcement.
- A malformed response produces a `provider-outage` park and a `provider.quota.malformed` announcement.

The secret-read boundary remains unchanged: the provider engine, the CLI provider command, and the quota transport add no ambient environment read and no allowlist entry.

### Re-evaluation loop

`runProviderLoop` is pure policy over injected clock and sleep seams. It evaluates the combined condition, sleeps for the computed wait, takes a fresh quota fetch on the next iteration (no cache), and repeats. The defensive cap counts completed sleeps: after exactly N completed sleeps (`maxSleepLoops`, default `24`), it announces `provider.reevaluation.cap` and returns a `reevaluation-cap` park with the cap TTL as its absolute expiry, without another quota fetch and without consuming another iteration to create the park. The loop never proceeds as if clear. The CLI does not sleep or spawn; the later spawn gate consumes this policy.

### CLI surface

| Subcommand | Mutating | Flags | Success payload |
|------------|----------|-------|-----------------|
| `ados provider resolve` | yes; persists parks and announcements for a resolved decision | `--chain <name>` | Decision (selected or parked), skipped entries, parks, announcements |
| `ados provider quota` | no | `--provider <name>` | Per-provider condition views and announcements, or a classified error |
| `ados provider parks list` | no | `--all`, `--provider <name>` | Park views folded from verified ledger truth; active by default, expired and cleared with `--all` |

All three accept the global `--json` and emit one CommandResult envelope. Human `resolve` prints the selected provider or the park's cause and resume time; warnings go to the error stream. `quota` without `--provider` evaluates the default chain's entries when `defaultChain` is declared, otherwise every declared entry. `parks list` reads verified park state, makes no network call, and mutates nothing. Invalid subcommands, flags, flag values, and positionals fail as classified invocation or input errors and never crash or emit an invalid envelope.

### Error taxonomy

The provider kind carries five error identities, classified by exact code:

| Code | Category | Retryable | Projection |
|------|----------|-----------|------------|
| `provider.quota.exceeded` | transient | true | platform-provider (exit 2) |
| `provider.outage` | transient | true | platform-provider (exit 2) |
| `provider.auth.rejected` | user | false | user-validation (exit 1) |
| `provider.chain.empty` | user | false | user-validation (exit 1) |
| `provider.chain.invalid` | user | false | user-validation (exit 1) |

`provider.outage` covers quota transport, non-auth HTTP, and malformed-response failures, a chain that cannot supply a future resume time, and a failed state write. A `quota` failure to resolve a credential uses the `config`-kind identity `config.credential.missing` (user, non-retryable, user-validation). Because the provider kind has more than one row, a provider failure must carry an exact declared code; an unclassified, undeclared, or wrong-kind provider failure is contained as `fallback.internal`, never mapped to the first provider row. Announcement codes are a separate closed vocabulary, not error-table rows. The machine and documented tables are synchronized in both directions.

## Technical Architecture & Codebase Map

### High-level design

Pure provider policy lives in the runtime-neutral `@delivery-os/core/provider` subpath and imports only core contracts and its own modules. The quota HTTP transport is the one injected I/O edge, implemented in `@delivery-os/adapters/provider-quota`; the clock, sleep seam, credential port, quota transport, and state store are injected at the CLI composition edge. Parks and announcements persist through the delivered state layer as additive record kinds. The CLI surface validates grammar, delegates to the engine, and lets the edge own envelopes, streams, redaction, and exit projection.

### Core components and directory structure

| Path | Responsibility |
|------|----------------|
| `packages/core/src/contracts/provider.ts` | Provider descriptors, cost classes, peak, quota, conditions, parks, announcements, decisions, skip reasons, error codes, schema identifiers, and the `QuotaTransport` contract. |
| `packages/core/src/provider/validate.ts` | Parsing and semantic validation: references, duplicates, cost ordering, ranges, endpoints, and chain selection. |
| `packages/core/src/provider/chain.ts` | Deterministic chain resolution, skip reasons, cost-policy eligibility, and chain parks. |
| `packages/core/src/provider/peak.ts` | UTC peak-window arithmetic, buffer clamp, and expiry. |
| `packages/core/src/provider/quota.ts` | Quota snapshot normalization, `TOKENS_LIMIT` filtering, threshold/reset evaluation, and failure classification. |
| `packages/core/src/provider/conditions.ts` | MAX combination and the fixed condition tie order. |
| `packages/core/src/provider/parks.ts` | Park construction, deterministic naming, generation identity, evidence projection, ledger persistence, fold and read-time views, and the `provider-parks.json` projection. |
| `packages/core/src/provider/announcements.ts` | Announcement code mapping, severity, safe messages, and deterministic identity. |
| `packages/core/src/provider/loop.ts` | Re-evaluation driver and completed-sleep cap. |
| `packages/core/src/provider/engine.ts` | Engine composition over injected seams: `resolve`, `quota`, and `parks`. |
| `packages/core/src/provider/index.ts` | Public pure provider-engine surface. |
| `packages/adapters/src/provider-quota/index.ts` | Injectable quota transport and native-fetch production wrapper: bounded GET, `redirect: manual`, in-memory bearer header, no storage. |
| `packages/cli/src/commands/provider.ts` | Grammar and handlers for `resolve`, `quota`, and `parks list`. |
| `packages/cli/src/edge.ts` | Composition of clock, credential port, quota transport, sleep seam, and state store for the provider command. |
| `packages/core/src/config/catalog.ts` / `defaults.ts` | Provider catalog branch and shipped overridable defaults. |
| `packages/core/src/contracts/error-table.ts` | The five provider rows and exact-code provider classification. |

### Data architecture

The engine's durable vocabulary is carried by two state record kinds inside the existing state schema:

- `provider.park`, payload schema `delivery.provider.park.v1`, under the store-scoped key `provider.parks`.
- `provider.announcement`, payload schema `delivery.provider.announcement.v1`, under the store-scoped key `provider.announcements`.

Persistence occurs only in a mutating `resolve` with a state store. It acquires the state fence, reads verified ledger truth, appends only changed park generations and new announcement identities, and replaces the rebuildable `provider-parks.json` derived document (schema `delivery.provider.parks.v1`) only when park truth changed. The projection is a fold of the latest record per park name, ordered by expiry ascending then name lexical. Read paths fold verified ledger truth directly, so a missing or divergent projection never changes a view and never triggers a write. There is no separate rebuild command. A failed state write is contained as a classified provider failure rather than reported as a successful decision.

### Boundaries and runtime neutrality

- The `provider` core subpath is part of the ambient neutral set: no runtime imports, ambient globals, clock, randomness, filesystem, network, or environment access. Policy receives facts through injected seams.
- The `provider-quota` adapters subpath is the single admitted runtime-API edge for the quota request. It is an exact, reason-bearing entry in the runtime-API confinement rule; it is not a secret-read allowlist entry, and the secret-read allowlist remains at four entries.
- The CLI composition edge is the only place that imports the production credential port and quota transport and wires them into the engine.
- The state layer owns ledger framing, fences, verified reads, and atomic document replacement; the provider engine only supplies record payloads and the fold.
- Model-profile selection, harness spawn, non-UTC timezones, background timers, spend reporting, and MCP/OpenCode provider surfaces are outside this feature.

### API and interface contracts

The public engine is created by `createProviderEngine(deps)` with injected `clock`, `credentialPort`, `transport`, `sleep`, optional `stateStore`, and optional `newFenceToken`. It exposes:

- `resolve({ config, chainName?, persist? })` returning a selected decision or a parked chain decision with skipped entries, parks, and announcements, or a classified failure.
- `quota({ config, providerName? })` returning per-provider condition views and announcements, or a classified failure; it never writes state.
- `parks({ all?, providerName? })` returning the folded read-time park views or a state failure.

The quota transport contract is one `send` call receiving the endpoint, method `GET`, timeout, and credential material; it returns an HTTP status and body text. The pure normalizer never returns the raw body.

## Non-Functional Requirements

| Concern | Current guarantee |
|---------|-------------------|
| Determinism | Identical configuration, clock, credential result, and quota snapshot produce identical decisions, park payloads, and announcement identities. No ambient clock, randomness, locale, or environment enters policy. |
| Hermetic testing | Zero live network calls, zero live credential reads, and zero real sleeps; clock, sleep, credential port, and transport are injected. |
| Runtime neutrality | Provider core imports only core contracts and its own modules; the ambient-globals guard covers the provider tier. |
| Secret safety | No secret, authorization header, or raw response body appears in envelopes, diagnostics, park records, announcement records, or evidence; canary tests cover every captured surface. |
| Bounded evidence | Park and announcement evidence is at most 1024 serialized bytes and 20 fields, drawn only from the closed allowlists (8 park fields; 8 base plus 3 announcement fields). |
| Idempotence | Re-evaluating an unchanged park generation appends zero duplicate records; repeated `parks list` has zero side effects; repeated `quota` performs zero state writes. |
| Expiry correctness | A park is inactive exactly at `expiresAt`; TTL and chain parks have an expiry strictly after creation; no park is created with a past or absent expiry. |
| Error-table synchronization | The five provider rows agree between the machine table and the documented table in both directions; provider classification is exact-code and total with `fallback.internal` containment. |
| Evaluation cost | Pure evaluation of 100 provider entries completes within 50 ms on the reference environment, excluding quota transport time. |

## Quality Assurance Strategy

| Level | Location | Scope |
|-------|----------|-------|
| Structure and contract inventory | `tests/structure/provider-contract.test.ts`, `tests/structure/error-table.test.ts`, `tests/structure/content-inventory.test.ts` | Contract inventory, schema identifiers, closed sets, evidence allowlists, deterministic naming, and error rows. |
| Behaviour | `tests/behaviour/provider-chain-resolution.test.ts`, `provider-peak-window.test.ts`, `provider-quota-evaluation.test.ts`, `provider-parks.test.ts`, `provider-announcements.test.ts`, `provider-credentials.test.ts`, `provider-cli.test.ts` | Validation, ordering, selection, skip reasons, peak boundaries, quota math, park lifecycle, announcements, credential handling, and CLI paths. |
| Legacy parity | `tests/behaviour/provider-legacy-parity.test.ts` | Ported resolver battery groups and the explicit fail-loud divergence classes. |
| Golden output | `tests/golden/provider-*.test.ts` | Recorded machine and human output for selected, parked, outage, quota, and parks-list cases. |
| Checks and security | `tests/checks/provider-hermetic.test.ts`, `provider-evidence-bounds.test.ts`, `secret-read-boundary.test.ts`, `error-table-sync.test.ts` | No live network or sleeps, evidence bounds, secret-read boundary, and table synchronization. |
| Boundaries | `tests/boundaries/**` | Runtime-API confinement for the quota transport with a clean control and a provider-core negative fixture. |
| Aggregate | `pnpm check` | Whole workspace. |

## Operational & Support

### Configuration

Operators declare descriptors, credential references, and chains under the `provider` branch; `config debug` shows every effective value's winning origin. The shipped Z.AI descriptor and credential reference are overridable defaults. No chain is enabled by default, so `resolve` fails closed until a chain is declared. Endpoint, threshold, timeout, loop cap, and park TTLs are configuration, not code.

### Observability

The observability surface is the park record, the announcement record, and the command envelope. `resolve` returns the decision, skipped entries, parks, and announcements; `quota` returns per-provider state and announcements or a classified error; `parks list` returns the deterministic view. Parks and announcements are durable and deduplicated by generation and identity. No metrics exporter, trace span, or event bus is introduced.

### Cost and infrastructure

Subscription-first ordering and paid-fallback-off protect subscription quota before paid capacity; a peak-window park never substitutes paid capacity. The engine adds no third-party runtime dependency; the quota transport uses the runtime's existing fetch capability. Provider parks and announcements are bounded and deduplicated, and the projection is rebuildable.

### Maintenance

Adding a provider is a descriptor plus a credential reference, not a code branch. Adding a vendor quota shape is a new normalized snapshot mapping with fixtures. The cause, condition, skip-reason, announcement, error, and evidence vocabularies are guarded sets; growth requires a spec update and, where cross-cutting, a decision record. The bash hook remains the spawn path until the later spawn integration consumes `resolve` and the re-evaluation loop.

## Dependencies & Risks

- **Depends on** the result contract ([feature-result-contract.md](feature-result-contract.md)) for the envelope, the five provider identities, exact-code classification, exit projection, and the redaction chokepoint.
- **Depends on** the configuration layer ([feature-config-layer.md](feature-config-layer.md)) for the typed catalog, layered resolution, provenance, and shipped defaults.
- **Depends on** the state layer ([feature-state-layer.md](feature-state-layer.md)) for the append-only ledger, fences, verified reads, and atomic derived-document replacement.
- **Depends on** the credential port and runtime confinement ([feature-adapter-ports.md](feature-adapter-ports.md), [feature-monorepo-scaffold-toolchain.md](feature-monorepo-scaffold-toolchain.md)).
- **Consumed by** later status, queue-readiness, doctor, spend, ceremony, and spawn surfaces for the park and announcement vocabulary.
- **Risk — fail-loud pauses change operator expectations:** each pause carries a cause and resume time, and a peak park never substitutes paid capacity.
- **Risk — quota response drift:** every malformed class is announced and parked or classified, never treated as clear.
- **Risk — ledger growth:** deterministic generation and identity dedupe plus bounded evidence limit record growth; the projection is rebuildable.
- **Risk — secret leakage:** credential-port-only resolution, one-time material handoff, closed evidence allowlists, and canary tests.
- **Risk — misconfiguration:** schema and semantic validation fail closed with classified `provider.chain.invalid` or `provider.chain.empty`, with no silent reorder or default substitution.

## Glossary & References

| Term | Definition |
|------|------------|
| Provider descriptor | A named provider entry: cost class, enabled flag, optional peak window, and optional quota policy. |
| Cost class | `subscription` (quota-limited, preferred) or `pay-per-token` (paid fallback). |
| Provider chain | A named ordered list of descriptors plus a paid-fallback policy. |
| Peak window | A UTC interval, extended by a buffer, during which work pauses rather than using peak-priced capacity. |
| Quota snapshot | The normalized, secret-free limits and reset times derived from a provider response. |
| Condition | A provider entry's current availability driver: clear, peak-window, quota-exhausted, provider-outage, credential-missing, or credential-rejected. |
| Park | A named, self-expiring provider or chain pause with a closed cause, active conditions, and an absolute expiry. |
| Park generation | The identity of one park episode, `cause:expiresAtMs`, used to deduplicate records. |
| Announcement | A structured, deduplicated event with a closed code and severity describing a park, failure, cap, or resume. |
| Fail-loud | The rule that an indeterminate availability verdict is announced and parked, skipped, or classified; it is never treated as clear. |
| Skipped entry | A chain entry not selected, carrying exactly one closed reason. |
| Re-evaluation loop | The policy that sleeps for the computed wait, fetches fresh quota, re-evaluates, and stops at a completed-sleep cap. |
| Blocked lane | A delivery or queue readiness failure, distinct from a provider park, which always carries a resume time. |
| Provider parks projection | The rebuildable derived document `provider-parks.json`, folded by park name from verified `provider.park` ledger records. |

See also: [Configuration Layer and Inspection](feature-config-layer.md), [State Layer](feature-state-layer.md), [Result Contract and Error Table](feature-result-contract.md), [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md), [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md), the [provider conditions and parks guide](../../guides/provider-conditions-and-parks.md), the [repository glossary](../../overview/glossary.md), [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), [ADR-0005](../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md), and [ADR-0007](../../decisions/ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md).

**Change record:** `doc/changes/2026-10/2026-10-31--GH-182--provider-v1/`.
