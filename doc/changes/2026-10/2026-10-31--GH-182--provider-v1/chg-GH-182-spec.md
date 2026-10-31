---
change:
  ref: GH-182
  type: feat
  status: Proposed
  slug: provider-v1
  title: "M0-S13: provider v1 — quota-aware routing, named parks, fail-loud announcements"
  owners: [engineering]
  service: delivery-os provider engine
  labels: [change, planning]
  version_impact: minor
  audience: internal
  security_impact: high
  risk_level: medium
  dependencies:
    internal: [result contract, config layer, state layer, credential port, monorepo scaffold]
    external: [Z.AI quota endpoint]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver a deterministic, credential-safe provider routing engine whose peak-window and quota pauses are named, self-expiring parks carrying a cause and expiry, and whose every outage or indeterminate quota verdict is announced as a structured event instead of being silently treated as "quota clear".

## 1. SUMMARY

Deliver the v1 AI model provider engine: typed provider, chain, peak-window, and quota configuration under the layered configuration catalog; deterministic subscription-first chain resolution with explicit skip reasons; quota and peak-window evaluation ported from the legacy bash resolver battery with MAX-over-conditions, fresh re-evaluation after sleep, and a defensive loop cap; named self-expiring parks carrying a closed cause and an absolute expiry, persisted through the state layer; and structured fail-loud announcements that replace the legacy fail-open warnings. Provider quota authorization resolves only through the M0-S12 credential port. A minimal `ados provider` surface exposes `resolve`, `quota`, and `parks list`.

Model-profile selection heuristics and harness spawn are explicitly excluded: this change decides *which provider entry is available and chosen*, not *which model a given agent should run*, and it does not spawn processes.

## 2. CONTEXT

### 2.1 Current State Snapshot

The M0 trust substrate is delivered: the six-package workspace with mechanically enforced package and runtime-API boundaries; the result contract with the machine-readable error table (including the existing `provider.quota.exceeded` row), classification chain, exit projection, and a single redaction chokepoint; the seven-layer configuration layer with typed catalog fields, provenance, defaults, and fail-closed validation; the append-only state layer with a driver-neutral port, fenced appends, verified reads, and atomically replaced derived documents; and the M0-S12 credential port with one environment-backed implementation and a binding secret-read boundary invariant. Tracker, VCS, and CI client seeds exist behind the adapter ports; they are a separate adapter family from AI model hosts.

The legacy provider behavior lives in a bash hook, `scripts/hooks/pre-opencode-iteration-zai.sh`, with a deterministic battery of 71 cases in `scripts/.tests/test-hook-zai-example.sh`. That hook gates Z.AI Coding Plan spawns on a UTC peak window and, when opted in, on the Z.AI quota endpoint. It takes the MAX sleep across independent condition functions, sleeps, re-evaluates, and caps the loop. Every quota-fetch failure is fail-open: it emits one `[WARN]` reason category and returns "no wait", so the spawn proceeds as if quota were clear. No typed provider configuration, chain resolution, durable park state, or `ados provider` command exists.

### 2.2 Pain Points / Gaps

- Provider selection has no deterministic, cost-aware chain: there is no declared subscription-first ordering and no explicit record of why a provider entry was skipped.
- Peak and quota pauses live only in an untestable-by-default bash hook; their semantics are not expressed as provider-agnostic data and cannot be reused by the coordinator, status, queue, doctor, or spend surfaces.
- A pause is not durable: nothing records that a provider is paused, why, or when it resumes. Spawn failures present as silent stalls or as unlabeled elapsed time.
- The legacy fail-open behavior converts an indeterminate quota verdict (transport failure, HTTP error, malformed envelope) into "proceed", which is precisely the silent-outage class the provider engine must make impossible.
- Quota authorization reads a credential directly from the environment inside the hook. A TypeScript engine must not repeat that: credentials resolve only through the credential port.
- The legacy battery exercises Z.AI-specific JSON and UTC arithmetic, not a provider-agnostic contract. A ported battery must preserve the boundary cases while expressing them against the new model.

### 2.3 Affected Users and Business Impact

- **Operators** gain a truthful answer to "why did work not start, and when will it resume?" instead of inferring from elapsed silence.
- **The coordinator and lifecycle agents** receive a deterministic resolution decision with named skips, so routing and retry behavior are explainable rather than heuristic.
- **Engine and surface authors** (status, queue readiness, doctor, spend, ceremony) receive one park and announcement vocabulary to consume instead of re-deriving provider state.
- **Security reviewers** keep one mechanical secret boundary: provider quota authorization never reads the environment outside the credential port.

Business impact: every silent provider stall or fail-open quota verdict is a delivery-hours loss and an unaccounted cost event. Subscription-first routing plus a durable park with a resume time converts that loss into a bounded, diagnosable pause, protects the subscription quota before paid capacity, and supplies the evidence later status, queue, doctor, spend, and ceremony surfaces need. The change is additive and fail-closed, so it does not alter the current bash delivery path until the later spawn integration consumes the decision.

## 3. PROBLEM STATEMENT

Because provider selection has no quota- and peak-aware chain and no durable park vocabulary, a spawn attempt either stalls silently or falls through to paid capacity, and an outage is reduced to a fail-open warning that looks identical to a clear quota; agents and operators therefore cannot tell why work did not start, whether paying more will help, or when the provider will resume.

## 4. GOALS

- **G-1**: Declare provider descriptors, cost classes, peak windows, quota policy, and chains as typed, validated, layered configuration with an explicit required/optional/default contract.
- **G-2**: Resolve a chain deterministically in declared order with subscription entries before pay-per-token entries, and report every skip with a closed, machine-readable reason.
- **G-3**: Evaluate peak windows and subscription quota provider-agnostically, preserving the legacy battery's boundary behavior (buffers, custom windows, TOKENS_LIMIT filtering, percentage thresholds, reset-time clamping, soonest reset, MAX across conditions, fresh re-evaluation, loop cap).
- **G-4**: Represent every pause as a named, self-expiring park carrying a closed cause, the active conditions, and an absolute expiry, persisted through the state layer and distinguishable from a blocked lane.
- **G-5**: Make every outage, indeterminate quota verdict, credential failure, chain exhaustion, and loop-cap outcome a structured announcement; no transport, HTTP, envelope, or parse failure may be silent.
- **G-6**: Authorize quota fetches only through the M0-S12 credential port, with no direct environment read and no secret in any output, state record, or diagnostic.
- **G-7**: Ship a minimal, testable `ados provider` surface (`resolve`, `quota`, `parks list`) whose machine results are CommandResult envelopes.
- **G-8**: Add the provider engine's failure identities to the machine and documented error tables in both directions, preserving the existing `provider.quota.exceeded` identity.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Park records with a closed-set cause and an absolute future expiry | 100%; 0 parks without either |
| Legacy battery failure classes that remain silent | 0; every legacy fail-open case asserts a structured announcement or a classified error |
| Direct ambient credential reads in provider core, CLI provider command, and quota transport | 0; secret-read boundary green with 0 new allowlist entries |
| Subscription-first ordering violations accepted at validation | 0 |
| Deterministic replay: identical config, clock, and transport facts produce identical decisions and record payloads | 100% across repeated runs |
| Tests that perform live network I/O | 0 |
| Ported legacy boundary cases with an explicit parity mapping | 100% of the cases present in the delivered legacy battery (TC-ZAI-001..071), each mapped to a ported case or an explicit documented replacement |
| New provider error rows synchronized machine-to-doc and doc-to-machine | 100% |
| Park/announcement evidence size | ≤ 1024 serialized bytes and ≤ 20 fields per record |

### 4.2 Non-Goals

- **NG-1**: No model-profile selection, profile classes, difficulty classification, or agent-to-model heuristics. The engine returns a provider entry decision; model choice remains with the later profile story and the spawn layer.
- **NG-2**: No harness spawn, process launch, dispatch, or adapter implementation. The engine's resolve result is the input the spawn layer will consume later.
- **NG-3**: No tracker, VCS, or CI provider work; those are adapters, not this command family.
- **NG-4**: No credential sidecar or mediated credential execution; the credential port's existing implementation is used unchanged.
- **NG-5**: No non-UTC timezone or daylight-saving support in v1; windows are declared in UTC seconds-of-day.
- **NG-6**: No background daemon, timer, scheduler, or automatic park-clearing job; expiry is observed on read and re-evaluation.
- **NG-7**: No modification or retirement of the legacy bash hook; the new engine is delivered beside it.
- **NG-8**: No spend, cost dashboard, status collector, queue readiness, or doctor check; later stories consume the park and announcement vocabulary this change defines.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Typed provider configuration model under the layered catalog | Routing must be declarative, validated, traceable, and overrideable per layer, not hardcoded in a hook. |
| F-2 | Deterministic subscription-first chain resolution with explicit skips | Cost control and diagnosability both depend on a stable order and on naming why an entry was not chosen. |
| F-3 | Peak-window awareness with buffer and custom windows | Peak pricing must pause work rather than silently consume peak-priced capacity. |
| F-4 | Subscription quota awareness with legacy-parity evaluation | Quota exhaustion must produce a truthful resume time; indeterminate quota must not be treated as clear. |
| F-5 | Named self-expiring parks with cause, conditions, and expiry, persisted through state | A pause becomes a diagnosable, durable, automatically resolving fact instead of a stall. |
| F-6 | Structured fail-loud announcements | Every failure to determine availability is observable; silence is not a valid outcome. |
| F-7 | Credential-port-only quota authorization | The secret-read boundary stays mechanically true and the sidecar path stays open. |
| F-8 | Minimal `ados provider` command surface | Operators and engines need a testable way to resolve, inspect quota, and list parks. |
| F-9 | Provider error taxonomy integration | New failure identities are classifiable, retryable-or-not, and synchronized with documentation. |

### 5.1 Capability Details

- **F-1**: Provider configuration is a typed branch of the layered catalog. A provider descriptor declares a cost class (`subscription` or `pay-per-token`), an optional enabled flag, an optional peak window, and an optional quota policy. A chain declares an ordered list of provider descriptor names and a paid-fallback policy. A credential reference declares how to resolve a credential through the credential port, using the port's declared `literal` or `environment-prefixed` source-key style, and never carries secret material. Types, ranges, enums, and required/optional status are schema-enforced; cross-field semantics (references, duplicates, cost ordering) are validated by a pure provider validator. The field-level required/optional/default contract is fixed in Appendix B and is the same contract the config schema enforces. The built-in defaults ship one concrete descriptor for the Z.AI Coding Plan as the canonical shipped case and one credential reference for its environment key; no chain is enabled by default, so a fresh installation fails closed until the operator declares a chain. All values are overridable per configuration layer and provenance is visible through `config debug`.

- **F-2**: A chain is resolved in its declared order. The validator requires every subscription entry to precede every pay-per-token entry and rejects duplicates, unknown references, and empty chains. Resolution walks the chain, evaluates each entry's current conditions, and selects the first eligible entry subject to the cost policy: a later pay-per-token entry is selectable only when the chain's paid-fallback policy allows it and no preceding subscription entry is parked for a peak window; a peak-window park never permits substitution to paid capacity. Every non-selected entry is reported with a closed skip reason (`disabled`, `peak-window`, `quota-exhausted`, `provider-outage`, `credential-missing`, `credential-rejected`, `paid-fallback-not-allowed`). When no entry is eligible, the decision is a parked decision whose chain park carries cause `chain-exhausted` and the earliest resume time among the provider parks; its absolute expiry is that earliest future provider expiry, and if no contributing provider park can supply a future expiry the engine fails loud with the classified provider failure instead of fabricating one. A missing or empty chain is a classified failure, never an empty success.

- **F-3**: A peak window is declared as a UTC start second-of-day, end second-of-day, buffer seconds, and the v1 timezone basis `UTC`. The effective pause window is half-open `[max(0, start − buffer), end)`. Evaluation is pure arithmetic over the injected current time: inside the window the condition yields the seconds until end and an absolute expiry at the window end; outside it yields clear. Windows that end at or before their start, out-of-range values, and non-UTC timezones are rejected by schema validation. A custom window is fully declarative; no Z.AI values are hardcoded in the evaluator. Peak and quota conditions are evaluated together and combined by the MAX rule.

- **F-4**: A subscription descriptor may declare a quota policy: an HTTPS endpoint, a credential reference, a timeout, an exhaustion threshold (default 100 percent), a defensive re-evaluation loop cap (default 24 sleeps; the engine default applies when no quota policy is present), outage/credential park TTLs, and a cap park TTL (default 300 seconds). Evaluation normalizes the provider response into a quota snapshot, filters to `TOKENS_LIMIT` entries, ignores `TIME_LIMIT` entries, treats a non-negative integer percentage at or above the threshold as exhausted, reads `nextResetTime` as epoch milliseconds, clamps a past reset to zero wait, selects the soonest reset among exhausted limits with a valid reset, and ignores earlier resets on non-exhausted limits. An exhausted limit with no valid reset is not given a fabricated expiry: it fails loud with `provider.quota.exceeded` and a `provider.quota.reset_missing` announcement. The MAX-over-conditions driver combines peak and quota waits; re-evaluation takes a fresh fetch each iteration (no cache), and reaching the loop cap announces the cap and returns a `reevaluation-cap` park instead of proceeding silently.

- **F-5**: Every non-clear provider condition becomes a named park. Provider parks are named `provider:<providerName>`; chain parks are named `chain:<chainName>`. A park carries a closed cause (`peak-window`, `quota-exhausted`, `provider-outage`, `credential-missing`, `credential-rejected`, `chain-exhausted`, `reevaluation-cap`), the active condition kinds, a creation time, and an absolute expiry. The `reevaluation-cap` park uses the configured cap-park TTL (default 300 seconds) as its absolute expiry; the `chain-exhausted` park uses the earliest contributing provider expiry as described in F-2. Every park therefore has a bounded, honest resume time even when the defensive cap or chain exhaustion is the cause. Parks are ledger records through the state layer (record kind `provider.park`, schema `delivery.provider.park.v1`) and are folded into a rebuildable derived document for listing. Expiry is derived at read time: a park is inactive when `expiresAt <= now`; no delete or expiry write occurs. An early clear appends a `cleared` record. Re-evaluating an unchanged active park appends nothing; a changed cause or expiry appends a new record and the latest record wins. A park is a provider-availability pause with a guaranteed resume time; it is never a blocked lane, never a delivery failure, and never masks a lane's readiness condition.

- **F-6**: Every failure to determine availability produces a structured announcement record with a closed code, a severity (`info` or `warning`), the subject (provider or chain), the cause and conditions where applicable, the park name and expiry where applicable, a safe templated message, and bounded evidence. Announcements surface in three places: the machine CommandResult data for `resolve` and for a successful `quota`, the classified error envelope plus the CLI diagnostic stream for a failure that produces no park, and the state ledger (`provider.announcement`, schema `delivery.provider.announcement.v1`) when a resolution persists park state. A classified failure that produces no park (a failing `quota`, or a `resolve` that cannot produce an honest expiry) carries its announcement in the classified error envelope (with the announcement code in the safe summary) and the diagnostic stream; no state announcement record is written for a condition that has no park. Announcement identity is deterministic (subject, code, park generation) so an unchanged condition never appends duplicates. The legacy fail-open behavior is intentionally replaced: an indeterminate quota verdict is announced and parks or skips the provider; it is never treated as clear. A skipped entry's outage is still announced and parked so status can show it, even when a later entry serves the chain.

- **F-7**: Quota authorization resolves the descriptor's credential reference only through the M0-S12 `CredentialPort`. The resolved material is handed once to the quota transport for one request, used to build the authorization header in memory, and never cached, logged, persisted, or returned in evidence. A missing credential produces a `credential-missing` park and `config.credential.missing` evidence; a 401/403 produces a `credential-rejected` park and `provider.auth.rejected`; transport, non-auth HTTP, envelope, and parse failures produce a `provider-outage` park and `provider.outage`. The secret-read boundary invariant remains green with zero new allowlist entries.

- **F-8**: The `ados provider` command family exposes exactly three subcommands for v1: `resolve` (one chain decision, the only mutating subcommand), `quota` (a non-mutating condition evaluation for one provider or the default chain), and `parks list` (read-only active parks, with `--all` for expired and cleared, and `--provider` filtering). All three accept `--json` and emit one CommandResult envelope; none spawns, sleeps, or mutates a lane. `resolve` persists parks and announcements because it is the routing decision; `quota` is a non-mutating diagnostic whose failures carry classified error identity; `parks list` reads the state projection only. Invalid flag values are classified input errors, never crashes.

- **F-9**: `provider.quota.exceeded` keeps its existing identity. Additions are `provider.chain.empty` (user, non-retryable, user-validation), `provider.chain.invalid` (user, non-retryable, user-validation), `provider.outage` (transient, retryable, platform-provider), and `provider.auth.rejected` (user, non-retryable, user-validation). Each new row is added to the machine table and the documented table in the same change; the bidirectional sync invariant is binding. Because the provider kind now has more than one row, provider failures must carry an exact code; the kind-only shortcut that worked while the kind had exactly one row no longer applies to `provider`, and an unclassified or wrong-kind provider failure is contained as `fallback.internal` rather than mapped to the first provider row. Announcement codes are a separate closed vocabulary, not error-table rows.

## 6. USER & SYSTEM FLOWS

1. **Resolve a spawn target**: An engine or coordinator asks `ados provider resolve [--chain <name>]` → configuration resolves and validates → the credential port resolves any declared quota credential → the quota transport fetches fresh quota for subscription entries → peak and quota conditions are evaluated and combined by MAX → the first eligible entry under subscription-first and paid-fallback policy is selected, or the chain is parked → parks and announcements are persisted → the envelope returns the decision, skipped entries with reasons, parks, and announcements. A peak-window park returns a resume time; a quota park returns the reset time; an outage park returns a bounded retry time.
2. **Inspect quota**: An operator runs `ados provider quota [--provider <name>]` → the same evaluation runs without persisting parks → the envelope reports each provider's state, active conditions, resume time, and announcements; a transport, auth, or credential failure returns the classified error code and a safe diagnostic. Nothing is silently reported as clear.
3. **Inspect parks**: An operator or agent runs `ados provider parks list` → the state projection is read → active parks are returned sorted by expiry and name; `--all` adds expired and cleared parks; `--provider` filters. No network call is made.
4. **Re-evaluation after a pause**: The spawn gate (later integration) uses the engine's loop: evaluate → if parked, sleep for the computed wait via the injected sleep seam → fetch fresh quota and re-evaluate → repeat until clear or until the loop cap is reached. At the cap the engine announces `provider.reevaluation.cap` and returns a `reevaluation-cap` park; it never proceeds as if clear.
5. **Credential failure**: The descriptor references a credential → the credential port returns `config.credential.missing` → no fetch is attempted → a `credential-missing` park and a warning announcement are produced → the chain may continue to a later eligible entry of the same cost class, or park as `chain-exhausted`.
6. **Outage on a skipped entry**: A subscription entry's quota endpoint is unreachable → the entry is parked with `provider-outage` and announced → a later eligible subscription entry (or a permitted paid fallback) may serve → the result lists the skipped entry, its reason, and its park. The outage is never invisible just because the chain succeeded.

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The provider configuration model: descriptors, cost classes, peak windows, quota policy, credential references, chains, and the built-in Z.AI Coding Plan descriptor.
- Pure provider policy in the runtime-neutral core: chain validation and resolution, peak evaluation, quota snapshot normalization and evaluation, MAX-over-conditions, park/announcement projection, deterministic announcement identities, and the re-evaluation loop policy.
- The quota transport I/O edge: one injectable transport and its native-fetch production implementation, with a new declared adapters subpath and runtime-API confinement allowance.
- Named self-expiring parks persisted through the state layer, including the ledger record kinds, the rebuildable parks projection, and the active/expired/cleared query semantics.
- Structured announcements with a closed code set, severity, subject, cause, expiry, and bounded secret-free evidence.
- The `ados provider` command surface: `resolve`, `quota`, `parks list`, their machine and human outputs, and their error paths.
- Provider error-table rows: the retained `provider.quota.exceeded` and the new `provider.chain.empty`, `provider.chain.invalid`, `provider.outage`, and `provider.auth.rejected`.
- The ported legacy battery as a provider-agnostic test suite, with a parity mapping for every legacy case group and explicit assertions for the intentional fail-loud divergence.

### 7.2 Out of Scope

- [OUT] Model-profile selection, profile classes, difficulty classification, and agent-to-model heuristics; model choice belongs to the later profile story.
- [OUT] Harness spawn, process launch, dispatch, and adapter implementation; the engine returns a decision, not a running session.
- [OUT] Tracker, VCS, and CI provider clients; they are a separate adapter family.
- [OUT] Credential-sidecar implementation and mediated credential execution.
- [OUT] Non-UTC timezones, daylight-saving rules, and cross-midnight peak windows.
- [OUT] Background timers, daemons, schedulers, and automatic park-clearing jobs.
- [OUT] Spend/cost reporting, status collectors, queue readiness, doctor checks, and MCP exposure; they consume this vocabulary in later stories.
- [OUT] Modifying, replacing, or retiring the legacy bash hook.
- [OUT] An explicit operator command to clear a park; v1 clears by expiry or by observing a clear condition.
- [OUT] Dynamic or composed chains, per-agent chain selection, and provider health scoring.

### 7.3 Deferred / Maybe-Later

- A `provider parks clear` command with a required reason, if operations demonstrate a need beyond self-expiry.
- Non-UTC and cross-midnight peak windows, with an explicit timezone basis model.
- Paid-fallback cost caps or budgets, beyond the v1 boolean chain policy.
- Per-provider quota endpoint adapters beyond the Z.AI shape, expressed as client seeds.
- A spend join that consumes provider decisions and parks to attribute cost.
- MCP and OpenCode surfaces for the provider family.
- Provider health scoring, latency-aware routing, and hysteresis.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

No HTTP endpoint is served. The only outbound HTTP interaction is the provider quota request declared by a subscription descriptor: a bounded `GET` against an HTTPS endpoint with the authorization header built from credential-port material, a configured timeout, and no redirect or credential-bearing URL userinfo. The engine is provider-agnostic; the Z.AI Coding Plan descriptor is the shipped concrete endpoint case.

### 8.2 Events / Messages

| ID | Record / event | Contract |
|----|----------------|----------|
| EVT-1 | `provider.park` state record | Ledger record kind `provider.park`, payload schema `delivery.provider.park.v1`; append-only truth; latest record per park name wins; folded into the rebuildable `provider-parks` projection. |
| EVT-2 | `provider.announcement` state record | Ledger record kind `provider.announcement`, payload schema `delivery.provider.announcement.v1`; deterministic identity prevents duplicates for an unchanged park generation; warnings and infos are distinguished by severity. |
| EVT-3 | Command-result announcement list | `resolve` and a successful `quota` return announcements inside `data.announcements`; a failing `quota` returns its classified error identity with the announcement code in the safe summary and writes the safe diagnostic to the error stream; `resolve` persists announcements in state when it persists park state. |
| EVT-4 | `provider.resumed` announcement | Emitted once by the next mutating `resolve` that observes a previously active park clear, including after expiry; `parks list` reports expired state without writing; informational, not an error. |

Announcement codes are a closed vocabulary: `provider.peak.parked`, `provider.quota.parked`, `provider.quota.reset_missing`, `provider.quota.unreachable`, `provider.quota.http_error`, `provider.quota.auth_rejected`, `provider.quota.malformed`, `provider.credential.missing`, `provider.chain.exhausted`, `provider.reevaluation.cap`, and `provider.resumed`. The first two and the last are informational; the rest are warnings. No announcement carries a secret, an authorization header, a raw response body, or a credential source value.

### 8.3 Data Model Impact

| ID | Element | Contract |
|----|---------|----------|
| DM-1 | Provider descriptor | Named entry: cost class, optional enabled flag, optional peak window, optional quota policy. A descriptor is declarative data; it names no secret and no model heuristic. |
| DM-2 | Cost class | Closed set `subscription` and `pay-per-token`; chain validation enforces subscription entries before pay-per-token entries. |
| DM-3 | Peak window | UTC start second-of-day, end second-of-day, buffer seconds, and timezone basis `UTC`; effective pause window `[max(0, start − buffer), end)`. |
| DM-4 | Quota policy | HTTPS endpoint, credential reference, timeout, threshold percentage, loop cap, outage park TTL, credential park TTL, and cap park TTL; optional on a descriptor. The engine's default loop cap applies when no quota policy overrides it. |
| DM-5 | Credential reference binding | A named reference to a credential port source key (`literal` or `environment-prefixed`); resolution yields material or `config.credential.missing`; no secret material in configuration. |
| DM-6 | Provider chain | Named ordered list of descriptor names plus a paid-fallback boolean; empty chains, duplicates, unknown references, and cost-order violations are invalid. |
| DM-7 | Chain resolution decision | Either `selected` (provider name, cost class) or `parked` (chain park), plus the ordered skipped-entry list with a closed reason per entry. |
| DM-8 | Condition evaluation | A provider's current clear/parked/blocked state with active condition kinds, wait seconds, and an absolute expiry where the condition is parkable. |
| DM-9 | Quota snapshot and limit | Normalized response: validity, limits filtered to the relevant type, non-negative integer percentage, optional reset epoch milliseconds; never the raw body. |
| DM-10 | Park record | Park name, subject (provider or chain), closed cause, active condition kinds, state (`active` or `cleared`), creation time, absolute expiry, optional clear time, and bounded secret-free evidence. |
| DM-11 | Announcement record | Deterministic identity, closed code, severity, subject, optional cause/conditions/park name/expiry, creation time, safe message, and bounded evidence. |
| DM-12 | Parks projection and view | Rebuildable per-park-name latest-record fold; the view adds `active`, `expired`, or `cleared` state, ISO-8601 UTC expiry, and deterministic ordering. |
| DM-13 | Re-evaluation policy | MAX over condition waits, fresh fetch per iteration, sleep seam, loop cap (engine default 24), and cap outcome (announcement plus a `reevaluation-cap` park with the cap park TTL as its absolute expiry). |

**Park contract rules**: a park always has a cause from the closed set and an absolute expiry strictly in the future at creation. It is inactive when `expiresAt <= now`; no expiry write is needed. Re-evaluation with an identical cause and expiry does not append; a changed cause or expiry appends a new record. A `cleared` record is appended only when an active park is observed clear before expiry. The park's `conditions` list may contain several condition kinds while its `cause` is the single condition that determines the expiry (ties resolve in the fixed order peak-window, quota-exhausted, provider-outage, credential-missing, credential-rejected). A park is never a blocked lane: parks describe provider availability and always carry a resume time; blocked lanes describe delivery readiness and do not.

**Announcement contract rules**: every non-clear condition that persists a park emits exactly one announcement for that park generation. An outage on an entry that is skipped in favour of another still emits an announcement and persists that provider's park. Announcement identity is deterministic from the subject, code, and park generation; no randomness or ambient clock enters the identity. Severity is `warning` for every failure class and `info` for parks and resumes. The message is a safe template naming the provider, condition, and resume time only.

### 8.4 External Integrations

One external integration: the subscription quota endpoint. The shipped Z.AI Coding Plan descriptor targets `https://api.z.ai/api/monitor/usage/quota/limit` with a bounded timeout. Authorization comes only from the credential port; the credential's source key is declared in configuration as a reference, never as a value. The endpoint must be HTTPS, must not contain userinfo, and is validated at configuration load. No tracker, VCS, or CI API is called by this engine. Tests use an injected transport and perform zero live network calls.

### 8.5 Backward Compatibility

All changes are additive at the user-visible level. Existing commands, envelopes, exit codes, state schema version, and error rows remain unchanged; `provider.quota.exceeded` keeps its identity. The one contract clarification is that the `provider` kind now has multiple error rows, so provider failures are classified by exact code; a provider failure without a code is contained as `fallback.internal`. No delivered command emitted an unclassified provider failure, so no existing behavior regresses, and the result-contract documentation is updated in the same change. Provider configuration keys are new and empty by default except for the shipped descriptor and credential reference; no existing configuration becomes invalid. The state store format is unchanged: park and announcement payloads are new record kinds inside the existing schema version, and the parks projection is a rebuildable derived document. The legacy bash hook is untouched and remains the current spawn path until the later spawn integration. The intentional behavior change is confined to the new engine: legacy fail-open becomes fail-loud. Runtime-API confinement gains exactly one new declared adapter subpath with a reason and negative fixtures; the secret-read allowlist gains nothing.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism | Identical configuration, injected clock, credential result, and quota snapshot produce byte-identical decisions, park records, and announcement identities across 100 repeated runs; no ambient clock, randomness, locale, or environment enters core policy. |
| NFR-2 | Hermetic tests | 0 live network calls, 0 live credentials read, and 0 real sleeps in the provider test suite; the clock, sleep seam, credential port, and quota transport are injected. |
| NFR-3 | Runtime neutrality | The core provider policy imports only core contracts; 0 `bun:*`/`node:*` imports, 0 ambient globals, 0 filesystem/network/environment access; ambient-globals and secret-read boundary checks stay green. |
| NFR-4 | Secret safety | 0 secret bytes, authorization headers, or raw response bodies in envelopes, diagnostics, park records, announcement records, or evidence; a planted canary is never observable. |
| NFR-5 | Bounded output | Park and announcement evidence ≤ 1024 serialized bytes and ≤ 20 fields; the announcements list is bounded by the number of evaluated entries; no raw provider body is retained. |
| NFR-6 | Idempotence | Re-evaluating an unchanged condition appends 0 duplicate park or announcement records; repeated `parks list` has 0 side effects; repeated `quota` performs 0 state writes. |
| NFR-7 | Expiry correctness | A park is inactive at exactly `expiresAt`; a park created by a TTL condition has an expiry strictly after creation; a park is never created with a past or absent expiry. |
| NFR-8 | Error-table synchronization | 100% of new provider rows exist in both the machine and documented tables in both directions; the provider kind's classification is exact-code-required and total, and unclassified or wrong-kind provider failures contain to `fallback.internal`; existing non-provider classification and projection behavior is unchanged. |
| NFR-9 | Legacy parity | 100% of the battery groups in Appendix A have a ported case; every legacy fail-open class asserts an announcement or classified error, with 0 silent-clear cases. |
| NFR-10 | Evaluation cost | Pure evaluation of 100 provider entries completes in ≤ 50 ms on the reference environment, excluding quota transport time. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

The observability surface is the park and announcement record plus the command envelope:

- `resolve` returns the decision, skipped entries, active parks, and announcements in `data`; human mode prints the selected provider or the park's cause and resume time, and warnings go to the error stream.
- `quota` returns per-provider condition states and announcements on success; failures return the classified error identity and a safe diagnostic naming the provider and failure class.
- `parks list` returns active parks by default and expired/cleared parks with `--all`; ordering is deterministic.
- State carries `provider.park` and `provider.announcement` records with deterministic identities; the `provider-parks` projection is rebuildable from ledger truth.
- No new metrics exporter, trace span, or event bus is introduced. Later status and doctor collectors read the state vocabulary; later spend reporting joins decisions to cost outside this change.
- No diagnostic carries a credential value, authorization header, endpoint credential, or raw quota body.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Replacing legacy fail-open with fail-loud changes behavior operators relied on; spawns now pause where they previously proceeded | M | M | Announce every divergence with cause and resume time; document the intentional change; preserve parity for all non-failure cases; ship beside the untouched legacy hook | M — operators must learn the new pause semantics |
| RSK-2 | The quota endpoint response shape drifts, producing malformed snapshots | M | M | Normalize defensively; classify every malformed class as an announcement plus outage park; no silent clear; fixture-driven parity tests | L |
| RSK-3 | Park and announcement records accumulate in the append-only ledger | L | M | Deterministic dedupe for unchanged park generations; bounded evidence; rebuildable projection; no per-poll writes | L |
| RSK-4 | A credential leaks through a quota request diagnostic, evidence field, or state record | H | L | Credential-port-only resolution; material passed once to the transport; closed evidence field set; canary and redaction tests; no new secret-read allowlist entries | L |
| RSK-5 | Provider configuration is misconfigured (unknown reference, duplicate entry, paid entry before subscription) and resolution behaves unexpectedly | M | M | Schema validation plus pure semantic validation with classified `provider.chain.invalid`; fail closed; no silent reorder or default substitution | L |
| RSK-6 | UTC-only peak windows misrepresent a provider's local pricing window | M | L | Descriptor declares the UTC-equivalent window explicitly; non-UTC and cross-midnight windows are rejected in v1; future extension is a spec change | L |
| RSK-7 | A paid fallback silently violates the subscription-first cost policy | M | M | Subscription-first validation; paid fallback off by default; peak-window parks never substitute; policy tests and announcements | L |
| RSK-8 | Legacy parity gaps hide a boundary regression | M | M | Appendix A maps every battery group; ported cases preserve boundary math; a parity suite asserts each fail-open class now announces | L |
| RSK-9 | Announcement noise overwhelms operators or bloats output | M | M | Deterministic identity and dedupe; severity split; bounded evidence; one announcement per park generation | L |
| RSK-10 | A park is mistaken for a blocked lane, hiding a real delivery block | M | L | Separate record kinds and vocabulary; park always carries a resume time; tests assert the distinction; later status/queue consumers receive both | L |

## 12. ASSUMPTIONS

- The state layer's append, verified read, and derived-document replace operations are sufficient for park and announcement records without a state schema change.
- The credential port's synchronous resolve result is sufficient for quota authorization; the quota fetch is asynchronous and receives the material as data.
- The CLI composition edge can import the declared adapters `./credentials` and `./provider-quota` entrypoints and inject the state store, clock, and transport into the provider command.
- Provider names, endpoints, and credential source-key names are declarative data; no product brand token is hardcoded in the engine.
- The legacy hook remains the spawn gate until the harness spawn story consumes the resolve decision; this change does not cut over.
- The Z.AI Coding Plan response shape is the only shipped concrete quota shape; other providers are user-declared and must conform to the generic snapshot contract.
- `provider.quota.exceeded` remains the immediate-refusal code when quota exhaustion cannot produce an honest expiry.
- Error categories and projection classes follow the delivered result contract without change.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M0-S3 / GH-172 (result contract) | CommandResult envelope, error table, classification, projection, redaction. |
| Depends on | M0-S4 / GH-173 (config layer) | Typed catalog, layered resolution, provenance, fail-closed validation, defaults. |
| Depends on | M0-S12 / GH-181 (credential port) | `CredentialPort`, `config.credential.missing`, secret-read boundary. |
| Depends on | M0-S5 / GH-174 (state layer) | Park and announcement ledger records and the rebuildable parks projection; the story's minimum dependency list omits state, but durable parks require it and the layer is delivered. |
| Depends on | M0-S1 / GH-170 (scaffold) | Package tiers, runtime-API confinement, boundary fixtures, aggregate check. |
| Unblocks (ticket) | M0-S6 / GH-175 (status providers collector) | The collector reads the declared chain and park states from config and state; it does not call the engine, and engine telemetry enriches it later. |
| Blocks | M1-S3 / GH-189 (doctor provider check) | Doctor consumes the provider error and park vocabulary. |
| Blocks | M1-S11 (harness adapters and dispatch portability) | The spawn layer consumes the resolve decision and the re-evaluation loop. |
| Blocks | M2-S3 / GH-186 (ceremony runner) | Ceremonies consume park/availability state for night-watch and briefs. |
| Informs | M0-S7 / GH-176 (queue ready) | Provider availability is one readiness condition; the collector reads the same chain and parks. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the working adapters subpath name `provider-quota` be confirmed or renamed by the M0-S17 naming lock? | The name is descriptive and does not collide with the tracker/VCS/CI provider subpaths; behavior is independent of the name. | Non-blocking; naming lock may rename. |
| OQ-2 | Should paid fallback ever be enabled by owner policy, and under what cost cap? | v1 ships `allowPaidFallback: false` and forbids peak substitution; enabling it is a config change but a cost-policy decision. | Decision needed for policy confirmation: consult `@decision-advisor` if the owner wants a different default. Current default is fail-closed. |
| OQ-3 | Should the shipped Z.AI descriptor come with an enabled default chain? | v1 ships the descriptor and credential reference but no enabled chain, so a fresh install fails closed until a chain is declared. | Decision made for fail-closed safety; owner may request an enabled default. |

### 14.1 Decision Candidates

The following decisions have system-wide or precedent-setting impact and warrant a decision record. This spec records the chosen behavior; it does not author the records.

| ID | Candidate | Why it warrants a record |
|----|-----------|--------------------------|
| DC-1 | Provider engine placement: pure policy in core, quota I/O in a declared adapters subpath, parks through the state layer | Sets the placement precedent for every later engine that mixes pure policy with external I/O; touches runtime neutrality and boundary allowlists. |
| DC-2 | Fail-loud replaces fail-open for indeterminate provider availability | Sets the failure-handling precedent for provider and engine integrations; changes user-visible behavior from the legacy hook. |
| DC-3 | Park record schema, cause taxonomy, and deterministic naming | Cross-cutting state vocabulary consumed by status, queue, doctor, spend, and ceremony; a schema change would ripple across stories. |
| DC-4 | Subscription-first ordering and no peak-window substitution | Cost-policy decision with business impact; defines when paid capacity may be used. |
| DC-5 | Provider configuration namespace and the shipped vendor descriptor under layered defaults | Config-schema precedent for all later provider/engine settings and defaults provenance. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | v1 scope is the provider engine family: chain resolution, quota and peak awareness, parks, subscription-first ordering, fail-loud announcements, credential-port authorization, and the ported battery. Model-profile heuristics and harness spawn are excluded. | Matches the story boundary and the model-profiles concept's story mapping; avoids inventing profile selection before its contract exists. | 2026-10-31 |
| DEC-2 | Pure provider policy lives in the runtime-neutral core; the quota HTTP transport and clock/sleep seams are injected I/O; parks persist through the state layer. | Keeps core deterministic and testable, follows ADR-0003 tiers, and reuses the delivered state abstraction instead of inventing a second store. | 2026-10-31 |
| DEC-3 | Provider configuration is a typed `provider` branch of the layered catalog; the Z.AI Coding Plan descriptor and its credential reference ship as overridable defaults; no chain is enabled by default. | Makes routing declarative and traceable while failing closed until an operator explicitly opts into a chain. | 2026-10-31 |
| DEC-4 | Subscription-first ordering is enforced by validation, not by silent reordering; paid fallback is off by default; a peak-window park never substitutes paid capacity. | Explicit configuration beats hidden behavior; matches the "peak windows mean pause" policy and keeps cost decisions auditable. | 2026-10-31 |
| DEC-5 | Park causes and condition kinds are closed sets; parks are named `provider:<name>` or `chain:<name>` and carry an absolute expiry; expiry is derived at read time; the ledger is append-only with a rebuildable projection. | A closed vocabulary makes parks machine-checkable and prevents ad hoc causes; derived expiry avoids background jobs and delete semantics. | 2026-10-31 |
| DEC-6 | Indeterminate quota is fail-loud: transport, HTTP, envelope, parse, and auth failures produce announcements and a park or classified error, never a clear verdict; the loop cap parks instead of proceeding. | Directly satisfies the ticket's "outage is announced, not silent" acceptance criterion and removes the legacy fail-open defect class. | 2026-10-31 |
| DEC-7 | Quota authorization resolves only through the credential port; material is passed once to the transport and never cached, logged, or persisted; the secret-read allowlist gains zero entries. | Preserves the M0-S12 centralization invariant and the future sidecar path. | 2026-10-31 |
| DEC-8 | Error rows are `provider.chain.empty`, `provider.chain.invalid`, `provider.outage`, and `provider.auth.rejected`; `provider.quota.exceeded` is retained unchanged. | Separates configuration errors, outages, and credential rejection while keeping the delivered identity stable. | 2026-10-31 |
| DEC-9 | The v1 CLI surface is `resolve`, `quota`, and `parks list`; the CLI does not sleep or spawn; the re-evaluation loop ships as engine policy for the later spawn gate. | Keeps commands bounded and testable; a command that sleeps for hours is hostile to scripts and agents. | 2026-10-31 |
| DEC-10 | Peak windows are UTC seconds-of-day, must not cross midnight, and clamp a buffer that starts before midnight to the day boundary; non-UTC timezones are invalid in v1. | Preserves legacy arithmetic exactly, avoids DST and timezone-database dependencies, and makes boundary tests deterministic. | 2026-10-31 |
| DEC-11 | `resolve` persists parks and announcements; `quota` is a non-mutating diagnostic whose failures carry classified errors; `parks list` is read-only. | Separates a routing decision with durable effects from inspection commands with no side effects. | 2026-10-31 |
| DEC-12 | Announcement identity is deterministic from subject, code, and park generation; unchanged conditions do not append duplicates; expired parks produce a `provider.resumed` announcement on the next observation. | Prevents ledger bloat and duplicate warnings without introducing a timer or random identifier. | 2026-10-31 |
| DEC-13 | The Z.AI quota shape is the only shipped concrete descriptor; other providers are user-declared against the generic contract. | Ships a real, parity-tested case without committing the engine to vendor-specific code paths. | 2026-10-31 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Core contracts surface | New provider contract types and constants: descriptors, classes, peak, quota, conditions, parks, announcements, decisions, and schema identifiers. |
| Core provider policy | New pure engine: configuration validation, chain resolution, peak evaluation, quota normalization/evaluation, MAX driver, park projection, announcement identity, and loop policy. |
| Core configuration catalog and defaults | New `provider` catalog fields and the shipped Z.AI descriptor/credential-reference defaults; defaults manifest and exports parity extend. |
| Core error table | Four new provider rows plus the retained `provider.quota.exceeded`; provider classification becomes exact-code-required; documented table synchronized. |
| Result-contract classification | The provider kind moves from the kind-only shortcut to exact-code classification; an unclassified or wrong-kind provider failure contains to `fallback.internal`; the result-contract documentation is synchronized. |
| Adapters I/O tier | New `provider-quota` subpath: injectable quota transport and native-fetch production wrapper; runtime-API confinement allowance with a reason and negative fixtures. |
| CLI provider command | New `provider` command definition with `resolve`, `quota`, and `parks list`; payload shaping, human output, and error paths. |
| CLI composition edge | Wires the injected clock, credential port, quota transport, and state store into the provider command. |
| State layer consumer | New `provider.park` and `provider.announcement` record kinds and the `provider-parks` derived projection; no state schema change. |
| Repository invariants | Secret-read boundary stays at the existing allowlist; runtime-API confinement gains one declared subpath; boundary fixture coverage extends; error-table sync extends. |
| Documentation (sync phase) | New provider-engine feature spec; provider keys in the config-layer spec; park record vocabulary in the state-layer spec; provider rows in the error-table doc; provider command row in the registry; glossary terms. |

### 16.1 Codebase Map (Affected Paths)

This map names the components and their test homes; it is a placement contract, not an implementation task list.

| Path | Responsibility |
|------|----------------|
| `packages/core/src/contracts/provider.ts` | Provider descriptors, cost classes, peak/quota/condition/park/announcement/decision types and schema identifiers. |
| `packages/core/src/contracts/error-table.ts` | Four new provider failure rows plus the retained `provider.quota.exceeded`; the provider kind becomes multi-row and therefore exact-code-classified. |
| `packages/core/src/contracts/index.ts` | Export surface for the new provider contracts. |
| `packages/core/src/provider/index.ts` | Public pure provider engine surface. |
| `packages/core/src/provider/validate.ts` | Semantic configuration validation: references, duplicates, cost ordering, ranges. |
| `packages/core/src/provider/chain.ts` | Deterministic chain resolution, skip reasons, and cost-policy selection. |
| `packages/core/src/provider/peak.ts` | UTC peak-window evaluation, buffer clamp, and expiry arithmetic. |
| `packages/core/src/provider/quota.ts` | Quota snapshot normalization, TOKENS_LIMIT filtering, percentage/reset evaluation, and failure classification. |
| `packages/core/src/provider/parks.ts` | Park creation/refresh/clear projection, cause selection, deterministic naming, announcement identity, and expiry views. |
| `packages/core/src/provider/loop.ts` | MAX-over-conditions driver, fresh re-evaluation policy, loop cap, and cap outcome. |
| `packages/core/src/config/catalog.ts` | `provider` catalog fields and defaults metadata. |
| `packages/core/src/config/defaults.ts` | Shipped Z.AI descriptor and credential-reference defaults. |
| `packages/adapters/src/provider-quota/index.ts` | Injectable quota transport and native-fetch production implementation; timeout and response envelope; no secret storage. |
| `packages/adapters/package.json` | New `./provider-quota` declared export. |
| `.dependency-cruiser.cjs` | Runtime-API confinement allowance for the quota transport subpath, with a reason and negative fixtures. |
| `packages/cli/src/commands/provider.ts` | Command definition and handlers for `resolve`, `quota`, and `parks list`. |
| `packages/cli/src/commands/index.ts` | Export of the provider command definition. |
| `packages/cli/src/edge.ts` | Composition of clock, credential port, quota transport, and state store for the provider command. |
| `packages/cli/src/index.ts` | Registration of the `provider` command in the command program. |
| `tests/behaviour/provider-chain-resolution.test.ts` | Chain validation, ordering, selection, skip reasons, and chain parks. |
| `tests/behaviour/provider-peak-window.test.ts` | Window boundaries, buffer, custom windows, MAX with quota, invalid windows. |
| `tests/behaviour/provider-quota-evaluation.test.ts` | Quota math, reset clamping, TOKENS_LIMIT/TIME_LIMIT, threshold boundaries, malformed snapshots. |
| `tests/behaviour/provider-parks.test.ts` | Park cause/expiry, self-expiry, refresh, clear, dedupe, projection, park-vs-lane distinction. |
| `tests/behaviour/provider-announcements.test.ts` | Announcement codes, severity, surfaces, dedupe, skipped-entry outages, no-silent-path matrix. |
| `tests/behaviour/provider-credentials.test.ts` | Credential-port-only resolution, missing/rejected credentials, no-secret-output canaries. |
| `tests/behaviour/provider-cli.test.ts` | `resolve`, `quota`, `parks list` payloads, exit codes, invalid flags. |
| `tests/behaviour/provider-legacy-parity.test.ts` | Ported battery groups and the fail-loud divergence assertions. |
| `tests/golden/provider-*.test.ts` | Recorded machine and human outputs for selected, parked, outage, and parks-list cases. |
| `tests/fixtures/provider/**` | Sanitized config, quota-response, park, and announcement fixtures. |
| `tests/structure/provider-contract.test.ts` | Contract inventory, schema identifiers, closed sets, and deterministic naming. |
| `tests/checks/error-table-sync.test.ts` | Extended sync coverage for the new provider rows. |
| `tests/boundaries/**` | Failing fixtures for the new adapter subpath confinement and clean controls; secret-read boundary remains green. |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a provider configuration with descriptors and chains, **when** it is validated, **then** types, ranges, enums, and required/optional fields are schema-checked, and invalid references, duplicates, empty chains, and cost-order violations fail with `provider.chain.invalid` or `provider.chain.empty` (no silent reorder or default substitution). | F-1, DM-1, DM-2, DM-4, DM-6, NFR-8 |
| AC-F1-2 | **Given** no declared chain or a chain with no entries, **when** `resolve` runs, **then** it fails with `provider.chain.empty` (user, non-retryable, exit 1) and creates no park or announcement that pretends a provider exists. | F-1, F-9, DM-6, NFR-8 |
| AC-F1-3 | **Given** a chain where a pay-per-token entry precedes a subscription entry, **when** it is validated, **then** it fails `provider.chain.invalid` naming the chain and offending entries, and no resolution is attempted. | F-1, F-2, DM-2, DM-6 |
| AC-F1-4 | **Given** provider descriptors, chains, endpoints, and the provider engine source, **when** the forbidden-literal scan and runtime-neutrality guards run, **then** no product brand token appears outside the branding seam and provider names, endpoints, and credential source-key names remain declarative data. | F-1, NFR-3 |
| AC-F1-5 | **Given** a descriptor or chain missing a required field and another with optional fields omitted, **when** configuration validates, **then** the missing required field fails closed with a classified configuration error and each omitted optional field takes its documented default (or stays absent where the contract says optional), with provenance visible through `config debug`. | F-1, DM-1, DM-3, DM-4, DM-6, NFR-8 |
| AC-F2-1 | **Given** a valid chain with eligible entries, **when** `resolve` runs, **then** the first eligible entry in declared order is selected and every non-selected entry is returned with a closed skip reason; identical inputs produce identical decisions across repeated runs. | F-2, DM-7, NFR-1 |
| AC-F2-2 | **Given** a chain with a subscription entry before a pay-per-token entry and both eligible, **when** resolving, **then** the subscription entry is selected and the paid entry is not. | F-2, DM-2, DM-7 |
| AC-F2-3 | **Given** every chain entry is parked, **when** resolving, **then** the decision is parked with a chain park named `chain:<name>`, cause `chain-exhausted`, expiry equal to the earliest provider park expiry, and a `provider.chain.exhausted` announcement. | F-2, F-5, F-6, DM-7, DM-10 |
| AC-F2-4 | **Given** a subscription entry parked for `peak-window`, a later pay-per-token entry eligible, and `allowPaidFallback: true`, **when** resolving, **then** no paid entry is selected and the chain parks at the peak-window end. | F-2, F-3, DM-2, DM-6, DM-7 |
| AC-F3-1 | **Given** a descriptor with start 06:00 UTC, end 10:00 UTC, and buffer 7200 seconds, **when** now is 03:59:59, 04:00:00, 09:59:59, and 10:00:00 UTC, **then** the conditions are clear, parked to 10:00, parked to 10:00, and clear respectively. | F-3, DM-3 |
| AC-F3-2 | **Given** a custom peak window, **when** evaluated, **then** the declared window is used and no Z.AI-specific start/end/buffer value is hardcoded in the evaluator. | F-3, DM-3, NFR-1 |
| AC-F3-3 | **Given** a non-UTC timezone, a window that ends at or before its start, or an out-of-range second-of-day, **when** configuration is validated, **then** the configuration fails closed with a classified configuration error. | F-1, F-3, DM-3, NFR-8 |
| AC-F3-4 | **Given** peak and quota conditions active at the same time, **when** combined, **then** the MAX wait and later expiry win, the park lists both condition kinds, and the single cause is the condition determining the expiry. | F-3, F-4, F-5, DM-3, DM-8, DM-10 |
| AC-F4-1 | **Given** a `TOKENS_LIMIT` entry with percentage ≥ 100 and a valid future `nextResetTime`, **when** evaluated, **then** the condition is `quota-exhausted`, the wait is the reset minus now, and the park expiry equals the reset instant. | F-4, F-5, DM-4, DM-9, DM-10 |
| AC-F4-2 | **Given** both limits exhausted, **when** evaluated, **then** the soonest reset wins; `TIME_LIMIT` entries are ignored; percentage exactly 100 is exhausted; percentage above 100 is exhausted; a past reset clamps to zero wait and does not park; a mixed valid/invalid reset uses the valid one; a non-exhausted earlier reset is ignored. | F-4, DM-9 |
| AC-F4-3 | **Given** no `TOKENS_LIMIT` entries or all percentages below the threshold, **when** evaluated, **then** the condition is clear and no outage announcement or park is produced. | F-4, DM-8, DM-9 |
| AC-F4-4 | **Given** an exhausted `TOKENS_LIMIT` with no valid reset time, **when** evaluated, **then** the engine does not fabricate an expiry: it returns `provider.quota.exceeded` (transient, retryable, exit 2) and surfaces `provider.quota.reset_missing` in the safe error summary and diagnostic stream, with no state park or announcement record. | F-4, F-6, F-9, DM-9, NFR-7 |
| AC-F4-5 | **Given** the re-evaluation policy, **when** a condition persists, **then** every iteration takes a fresh quota fetch (no cache), the MAX across conditions is used, and after the configured loop cap the engine announces `provider.reevaluation.cap` and returns a `reevaluation-cap` park instead of proceeding; no further iterations occur. | F-4, F-6, DM-13, NFR-6 |
| AC-F4-6 | **Given** each legacy fail-open class (transport failure, 401/403, non-200, malformed JSON, invalid envelope, absent limits, non-numeric percentage), **when** the ported case runs, **then** exactly one warning announcement is produced with the matching code and the provider is parked or the command fails with the matching error; 0 cases are silently treated as clear. | F-4, F-6, F-9, NFR-9 |
| AC-F5-1 | **Given** a non-clear provider condition, **when** `resolve` persists it, **then** the park record carries a name (`provider:<name>` or `chain:<name>`), subject, cause from the closed set, active conditions, creation time, absolute future expiry, and bounded evidence, and the record round-trips through the state layer unchanged. | F-5, DM-10, NFR-5 |
| AC-F5-2 | **Given** an active park and a clock at exactly `expiresAt`, **when** parks are listed, **then** the park is inactive/expired, no expiry write or delete occurred, and `--all` shows it as expired. | F-5, DM-10, DM-12, NFR-7 |
| AC-F5-3 | **Given** an unchanged active park re-evaluated repeatedly, **when** the results are persisted, **then** no duplicate park or announcement record is appended; **given** a changed cause or expiry, **then** a new record is appended and the latest record wins. | F-5, F-6, DM-10, DM-11, NFR-6 |
| AC-F5-4 | **Given** a park and a blocked lane, **when** both are inspected, **then** they are distinct record kinds and states, the park always carries a resume time, and no park reports a lane as blocked. | F-5, DM-10, DM-12 |
| AC-F5-5 | **Given** `parks list`, **when** active parks exist, **then** they are returned sorted by expiry ascending and name lexical, `--provider` filters by subject, `--all` adds expired and cleared entries, and the command performs no network or state mutation. | F-5, F-8, DM-12, NFR-6 |
| AC-F5-6 | **Given** a `reevaluation-cap` park or a `chain-exhausted` park, **when** it is persisted, **then** it carries an absolute expiry strictly in the future (the configured cap-park TTL or the earliest contributing provider expiry respectively), and the engine never creates a park with a fabricated past or absent expiry. | F-5, DM-10, DM-13, NFR-7 |
| AC-F6-1 | **Given** any non-clear condition, outage, credential failure, chain exhaustion, or loop-cap outcome, **when** it is surfaced, **then** exactly one structured announcement per distinct park generation is produced with a closed code, severity, subject, cause/conditions where applicable, park name/expiry where applicable, and no secret, authorization header, or raw body. | F-6, DM-11, NFR-4, NFR-5 |
| AC-F6-2 | **Given** an outage on a subscription entry that is skipped in favour of a later eligible entry, **when** resolving, **then** the outage entry is parked and announced, the later entry is selected, and the result lists both the selected entry and the skipped entry with its reason and park. | F-2, F-6, DM-7, DM-10, DM-11 |
| AC-F6-3 | **Given** `resolve --json`, **when** a park or warning exists, **then** announcements appear under `data.announcements` and warnings also appear on the diagnostic stream; **given** a successful `quota`, **then** announcements appear under `data.announcements`; **given** a failing `quota`, **then** the classified error identity, the announcement code in the safe summary, and a safe diagnostic are emitted; no execution path silently returns clear. | F-6, F-8, DM-11 |
| AC-F6-4 | **Given** the legacy fail-open comparison, **when** the new engine handles each legacy warning class, **then** the documented behavior change is asserted: the new outcome is an announcement plus a park, skip, or classified error, never a silent proceed. | F-6, NFR-9 |
| AC-F7-1 | **Given** a descriptor with a quota credential reference, **when** quota is evaluated, **then** the material is resolved only through `CredentialPort`, passed once to the transport for one request, and never cached; the secret-read boundary remains green with zero new allowlist entries. | F-7, DM-5, NFR-3, NFR-4 |
| AC-F7-2 | **Given** an unresolvable credential, **when** quota is evaluated, **then** no fetch is attempted, the provider is parked with cause `credential-missing`, a `provider.credential.missing` announcement is produced, and the evidence names `config.credential.missing`. | F-7, F-9, DM-5, DM-10 |
| AC-F7-3 | **Given** any envelope, diagnostic, park record, or announcement record, **when** scanned for a planted credential canary, **then** 0 secret bytes, authorization headers, or raw quota bodies are observable. | F-7, NFR-4 |
| AC-F7-4 | **Given** an HTTP 401 or 403 from the quota endpoint, **when** evaluated, **then** the outcome is `provider.auth.rejected` (user, non-retryable, exit 1) with a `credential-rejected` park/announcement; **given** a transport or non-auth HTTP failure, **then** the outcome is `provider.outage` (transient, retryable, exit 2) with a `provider-outage` park/announcement. | F-6, F-7, F-9, DM-9 |
| AC-F8-1 | **Given** `ados provider resolve [--chain <name>]`, **when** it succeeds, **then** the envelope returns a selected or parked decision with the skipped-entry list, active parks, and announcements; `--json` emits exactly one valid CommandResult and the exit code is 0. | F-8, DM-7, DM-11 |
| AC-F8-2 | **Given** `ados provider quota [--provider <name>]`, **when** conditions are evaluated, **then** it returns per-provider state, conditions, resume time, and announcements without writing parks; failures carry the classified provider error and the projected exit code. | F-8, F-9, DM-8 |
| AC-F8-3 | **Given** `ados provider parks list [--all] [--provider <name>]`, **when** it runs, **then** it returns the documented active/expired/cleared view with deterministic ordering and no network call or state mutation. | F-8, DM-12, NFR-6 |
| AC-F8-4 | **Given** an unknown `--chain`, `--provider`, or subcommand value, **when** the command runs, **then** it fails with a classified input or provider configuration error and never crashes or emits an invalid envelope. | F-8, F-9 |
| AC-F9-1 | **Given** the new provider rows, **when** the bidirectional error-table sync runs, **then** the machine table and documented table agree exactly; `provider.quota.exceeded` keeps its identity; each new row's category, retryable flag, consequence, remediation, and projection are correct; unclassifiable failures still contain to `fallback.internal`. | F-9, NFR-8 |
| AC-F9-2 | **Given** a provider failure, **when** it carries an exact declared provider code, **then** the classification chain resolves that row; **given** it carries no code or an undeclared or wrong-kind code, **then** it is contained as `fallback.internal` and never resolves to the first provider row by kind alone. | F-9, NFR-8 |
| AC-NFR-1 | **Given** identical configuration, clock, credential result, and quota snapshot, **when** resolution and record projection run 100 times, **then** decisions, park payloads, and announcement identities are identical and no ambient clock, randomness, locale, or environment affects them. | NFR-1, NFR-3 |
| AC-NFR-2 | **Given** the provider test suite, **when** it runs in CI, **then** it performs 0 live network calls, reads 0 live credentials, performs 0 real sleeps, and uses the injected clock, sleep, credential, and transport seams. | NFR-2 |
| AC-NFR-3 | **Given** the core provider policy, **when** the neutral-tier guards and aggregate check run, **then** it imports only core contracts and contains 0 runtime imports, ambient globals, filesystem/network access, or environment reads. | NFR-3, NFR-4 |
| AC-NFR-4 | **Given** a park or announcement with maximum allowed evidence, **when** serialized, **then** it is ≤ 1024 bytes and ≤ 20 fields, and the announcements list is bounded by the evaluated-entry count. | NFR-5 |
| AC-NFR-5 | **Given** repeated `resolve`, `quota`, and `parks list` invocations with unchanged inputs, **when** they complete, **then** only the first `resolve` persists the unchanged park/announcement generation; subsequent calls append 0 records and mutate 0 state. | NFR-6 |
| AC-NFR-6 | **Given** 100 provider entries, **when** pure evaluation runs on the reference environment, **then** it completes in ≤ 50 ms excluding quota transport time. | NFR-10 |

### 17.1 Quality Assurance Strategy

Every acceptance criterion has at least one evidence home; the test plan refines the case-level mapping. The strategy is hermetic by construction: no test performs a live network call, reads a live credential, or sleeps in real time.

| Level | Scope | AC trace | Evidence |
|-------|-------|----------|----------|
| Structure and contract inventory | Closed sets, schema identifiers, config keys, error rows, neutral-tier purity, deterministic naming | AC-F1-1, AC-F1-4, AC-F1-5, AC-F9-1, AC-F9-2, AC-NFR-3 | `tests/structure/provider-contract.test.ts`, `tests/checks/error-table-sync.test.ts`, boundary fixtures |
| Behaviour | Chain validation/resolution, peak boundaries, quota math, park lifecycle, announcements, credentials, CLI paths | AC-F1-2, AC-F1-3, AC-F2-1..F2-4, AC-F3-1..F3-4, AC-F4-1..F4-5, AC-F5-1..F5-6, AC-F6-1..F6-4, AC-F7-1..F7-4, AC-F8-1..F8-4 | `tests/behaviour/provider-*.test.ts` |
| Legacy parity | Every Appendix A group and every intentional fail-loud divergence | AC-F4-6, AC-F6-4, AC-NFR-2 | `tests/behaviour/provider-legacy-parity.test.ts` |
| Golden output | Machine envelopes and human output for selected, parked, outage, and parks-list cases | AC-F6-3, AC-F8-1, AC-F8-2, AC-F8-3 | `tests/golden/provider-*.test.ts` |
| Determinism and idempotence | Identical replay, dedupe, exact-expiry behavior, bounded output, evaluation cost | AC-NFR-1, AC-NFR-4, AC-NFR-5, AC-NFR-6, AC-F5-2, AC-F5-3, AC-F5-6 | `tests/behaviour/provider-*.test.ts`, `tests/checks/**` |
| Boundaries and security | Secret-read boundary, runtime-API confinement, no live network, no live credentials, no real sleep | AC-F7-1, AC-F7-3, AC-NFR-2, AC-NFR-3 | `tests/checks/secret-read-boundary.test.ts`, `tests/boundaries/**`, `tests/behaviour/provider-credentials.test.ts` |
| Aggregate | Whole workspace | All ACs | `pnpm check` |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

Ship the provider engine as one change: contracts, pure policy, configuration keys/defaults, the quota transport, the command surface, the error rows, and the ported battery. There is no cutover: the legacy bash hook remains the current spawn path, and the spawn integration that consumes `resolve` and the re-evaluation loop is the later harness story. The change is additive and fail-closed: a fresh installation resolves no chain until an operator declares one; the shipped Z.AI descriptor is available but not enabled as a chain. Documentation is reconciled in the documentation-sync phase: a new provider-engine feature spec, provider keys in the config-layer spec, the park vocabulary in the state-layer spec, the provider rows in the error-table documentation, and the provider command row in the registry.

**Definition of Done predicates:** all acceptance criteria have passing, traceable evidence; the ported battery covers every group in Appendix A and every legacy fail-open class asserts a structured announcement or classified error; the secret-read boundary is green with zero new allowlist entries; runtime-API confinement has exactly the new quota transport admission with failing fixtures and clean controls; deterministic replay and no-live-network checks pass; error-table synchronization is green in both directions; `pnpm check` passes; documentation is synchronized; and an unmerged pull request targets `main-tools` with all required CI jobs green on the pushed HEAD. If the owner disputes the paid-fallback default or the shipped-descriptor/chain posture, resolve it through the decision candidates in §14.1 before merging the affected configuration surface.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

No migration is required. Provider configuration keys are new; the shipped descriptor and credential reference are defaults resolved through the existing defaults manifest, and existing configurations remain valid. The state schema version is unchanged; park and announcement records are additive kinds inside the existing append-only ledger, and the `provider-parks` projection is rebuildable from ledger truth. No existing state is rewritten, deleted, or reinterpreted. If a user has no provider configuration, the engine fails closed with `provider.chain.empty` rather than inventing a default chain.

## 20. PRIVACY / COMPLIANCE REVIEW

The engine handles no personal data beyond provider names and credential *references* (source-key names), which are configuration data, not secret values. Quota snapshots carry percentages and reset timestamps; the engine retains only normalized limits, never the raw body. Park and announcement evidence is bounded to provider/chain names, condition kinds, wait seconds, reset epochs, HTTP status numbers, and safe failure classes. No credential value, authorization header, endpoint userinfo, or private identifier enters a record, envelope, or diagnostic. The shipped vendor descriptor names a public API endpoint; no private or hosted-only content is introduced. The no-cloud and privacy guards delivered by M0-S15 continue to apply to committed files.

## 21. SECURITY REVIEW HIGHLIGHTS

Credential handling is the primary security surface. Provider quota authorization resolves only through the M0-S12 credential port; the resolved material is passed once to the transport and used to build the authorization header in memory, never in process arguments, logs, state, evidence, or errors. The secret-read boundary invariant remains binding with zero new allowlist entries, so the centralization claim stays mechanical. The quota endpoint is constrained to HTTPS without userinfo; redirects are not followed with credentials. Provider configuration cannot contain secret values, only references. Announcement and park evidence use a closed field set and the existing redaction chokepoint covers CLI output. 401/403 are classified as credential rejection (user-fixable) rather than retried indefinitely. State records are local, single-writer, and least-privilege as delivered. No new dependency is introduced by the pure policy; the transport uses the runtime's existing fetch capability.

## 22. MAINTENANCE & OPERATIONS IMPACT

Maintainers own one growing provider catalog: adding a provider is a configuration descriptor plus a credential reference, not a code branch; adding a vendor quota shape is a new normalized snapshot mapping with fixtures. The closed cause, condition, announcement, and error vocabularies are guarded sets: growth requires a spec update and, where cross-cutting, a decision record (DC-2/DC-3). The legacy hook stays in place until the spawn cutover, so operators retain the old path during the transition and must be told that the new engine deliberately pauses on indeterminate quota. Park records are append-only and deduplicated; the projection is rebuildable, so a torn or missing projection is recoverable from ledger truth. No runbook, daemon, or scheduled job is added. Default TTLs (300 seconds for outages, 900 seconds for credential failures, 300 seconds for cap parks) and the loop cap (24) are configurable per descriptor; changing them is a configuration change, not a code change.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Provider descriptor | A named AI model host/plan declaration: cost class, enabled flag, optional peak window, and optional quota policy. |
| Cost class | `subscription` (quota-limited, preferred) or `pay-per-token` (paid fallback); chain validation enforces subscription entries first. |
| Provider chain | A named ordered list of provider descriptors with a paid-fallback policy; resolution returns the first eligible entry or a chain park. |
| Peak window | A declared UTC interval, extended by a buffer, during which work pauses rather than using peak-priced capacity. |
| Quota snapshot | The normalized, secret-free set of relevant quota limits and reset times derived from a provider response. |
| Condition | A provider's current availability driver: clear, peak-window, quota-exhausted, provider-outage, credential-missing, or credential-rejected. |
| Park | A named, self-expiring provider or chain pause with a closed cause, active conditions, and an absolute expiry. |
| Announcement | A structured, deduplicated event record with a closed code and severity describing a park, failure, cap, or resume. |
| Fail-loud | The rule that an indeterminate availability verdict is announced and parks/skips/fails; it is never treated as clear. |
| Fail-open (legacy) | The legacy hook behavior of warning and proceeding when quota cannot be determined; intentionally replaced by fail-loud. |
| Skipped entry | A chain entry not selected, with a closed reason (`disabled`, `peak-window`, `quota-exhausted`, `provider-outage`, `credential-missing`, `credential-rejected`, `paid-fallback-not-allowed`). |
| Re-evaluation loop | The spawn-gate policy that sleeps for the computed wait, fetches fresh quota, re-evaluates, and stops at a defensive cap. |
| Blocked lane | A delivery/queue readiness failure (dependencies, owner gate, CI, repository availability); distinct from a provider park, which always carries a resume time. |
| Park generation | The identity of one continuous park episode, determined by its cause and expiry; used to deduplicate records. |

## 24. APPENDICES

### Appendix A — Legacy battery parity mapping

The ported battery preserves the legacy boundary math but asserts the fail-loud contract instead of fail-open. `TC-ZAI-*` identifiers refer to the legacy battery groups.

| Legacy group | Behavior carried into v1 | Intentional v1 change |
|--------------|--------------------------|-----------------------|
| TC-ZAI-001..005 (model gating, off-peak, in-peak, buffer, custom window) | Descriptor gating replaces the `zai-coding-plan/*` model gate; peak boundaries, buffer, and custom windows are evaluated identically in UTC. | Gating is by declared chain/descriptor, not a model string; no sleep in the CLI. |
| TC-ZAI-010..020 (transport, 401, 403, non-200, malformed JSON, invalid envelope, absent limits, non-numeric percentage, mixed failures) | One structured announcement per distinct failure class; provider parked with cause/expiry or command error. | Legacy emitted one `[WARN]` and returned "no wait"; v1 never treats the verdict as clear. |
| TC-ZAI-021..025 (key unset, opt-out, missing tools, opt-out with peak active) | A descriptor with quota disabled is silent by design; a declared credential that cannot resolve is a `credential-missing` park and announcement. Peak still applies when quota is opted out. | Missing credential is no longer a silent opt-out when quota is enabled. |
| TC-ZAI-029..042 (no TOKENS_LIMIT, below threshold, 5h/weekly exhaustion, both exhausted, TIME_LIMIT, 100 boundary, over 100, past reset, mixed reset, non-exhausted earlier reset, peak+quota MAX) | Quota math, filtering, threshold, reset clamping, soonest reset, and MAX are preserved. | A park carries cause, conditions, and absolute expiry; an exhausted limit with no valid reset is a classified error, not a silent proceed. |
| TC-ZAI-045..046 (disabled, no file cache) | Quota disabled causes no fetch; each iteration takes a fresh fetch and no cache is written. | Records are append-only and deduplicated; no file cache. |
| TC-ZAI-050..052 (secret never logged, body never logged, fail-open exit 0) | Secret and raw body remain unobservable; exit behavior follows the fail-loud taxonomy. | The fail-open exit-0 path is removed for indeterminate quota. |
| TC-ZAI-055..056 (UTC formatting, no platform date dependency) | Expiry rendering is pure UTC arithmetic/ISO formatting; no shell `date` dependency. | Same guarantee expressed in pure core. |
| TC-ZAI-060..064 (cross-time quota into peak, sleep then clear, past reset no loop, cap, fresh fetch) | MAX re-evaluation, fresh fetch, past-reset no-loop, and cap are preserved. | Cap announces and parks; it does not proceed silently. |
| TC-ZAI-070..071 (hermetic, guide contract) | Hermetic injected seams and documentation of the condition contract. | The guide documents the provider engine's condition/park contract, not the legacy hook contract. |

### Appendix B — Example provider configuration

```yaml
provider:
  defaultChain: default
  credentials:
    zai:
      sourceKey:
        style: literal
        name: ZAI_API_KEY
  entries:
    zai-coding-plan:
      class: subscription
      enabled: true
      peak:
        timezone: UTC
        startSecondsOfDay: 21600   # 06:00 UTC
        endSecondsOfDay: 36000     # 10:00 UTC
        bufferSeconds: 7200        # pause from 04:00 UTC
      quota:
        enabled: true
        endpoint: https://api.z.ai/api/monitor/usage/quota/limit
        credentialRef: zai
        timeoutMs: 15000
        thresholdPercent: 100
        maxSleepLoops: 24
        outageParkTtlSeconds: 300
        credentialParkTtlSeconds: 900
        capParkTtlSeconds: 300
  chains:
    default:
      entries:
        - zai-coding-plan
      allowPaidFallback: false
```

The built-in defaults ship the `zai-coding-plan` descriptor and the `zai` credential reference; the chain above is operator-declared. The credential map key (`zai`) is the reference name used by `quota.credentialRef`; the nested `sourceKey` is the port's declarative mapping, not a secret value. The Z.AI peak window is expressed in UTC (14:00–18:00 UTC+8 is 06:00–10:00 UTC), with the legacy two-hour buffer.

**Provider configuration field contract (required / optional / defaults).**

| Element | Required | Default | Rule |
|---------|----------|---------|------|
| `provider.defaultChain` | no | none | Chain used when `--chain` is omitted; absence makes `resolve` require an explicit chain. |
| `provider.credentials.<name>.sourceKey.style` | yes | none | `literal` or `environment-prefixed`. |
| `provider.credentials.<name>.sourceKey.name` | yes for `literal` | none | Source key used verbatim. |
| `provider.credentials.<name>.sourceKey.suffix` | yes for `environment-prefixed` | none | Suffix appended to the branding environment prefix. |
| `provider.entries.<name>.class` | yes | none | `subscription` or `pay-per-token`. |
| `provider.entries.<name>.enabled` | no | `true` | A disabled descriptor is skipped with `disabled`. |
| `provider.entries.<name>.peak` | no | none | Presence enables peak evaluation for the descriptor. |
| `peak.timezone` | yes when peak present | `UTC` | Only `UTC` in v1; other values fail closed. |
| `peak.startSecondsOfDay` | yes when peak present | none | Integer 0..86399. |
| `peak.endSecondsOfDay` | yes when peak present | none | Integer 0..86399 and strictly greater than start; no cross-midnight window. |
| `peak.bufferSeconds` | no | `0` | Non-negative; the effective start clamps to 0 at the day boundary. The shipped Z.AI descriptor sets `7200`. |
| `quota.enabled` | no | `true` when quota present | Absence of the quota block means no quota condition. |
| `quota.endpoint` | yes when quota present | none | HTTPS, no userinfo; validated at configuration load. |
| `quota.credentialRef` | yes when quota present | none | Must reference a declared credential reference. |
| `quota.timeoutMs` | no | `15000` | Positive integer milliseconds. |
| `quota.thresholdPercent` | no | `100` | Integer 0..100; a percentage at or above the threshold is exhausted. |
| `quota.maxSleepLoops` | no | `24` | Integer >= 1; defensive re-evaluation cap. |
| `quota.outageParkTtlSeconds` | no | `300` | Integer >= 1. |
| `quota.credentialParkTtlSeconds` | no | `900` | Integer >= 1. |
| `quota.capParkTtlSeconds` | no | `300` | Integer >= 1; expiry for a `reevaluation-cap` park. |
| `provider.chains.<name>.entries` | yes | none | Non-empty ordered list of declared descriptor names; duplicates and unknown references fail closed. |
| `provider.chains.<name>.allowPaidFallback` | no | `false` | Boolean; subscription entries must precede pay-per-token entries. |

### Appendix C — Error and announcement mapping

**Provider error-table rows (the machine and documented tables must agree in both directions).**

| Code | Category | Retryable | Consequence | Remediation hint | Projection |
|------|----------|-----------|-------------|------------------|------------|
| `provider.quota.exceeded` | transient | true | not_landed | Wait for the quota window to reset, then retry the operation. | platform-provider |
| `provider.outage` | transient | true | not_landed | Retry after the provider becomes reachable; consult the announcement and park for the resume time. | platform-provider |
| `provider.auth.rejected` | user | false | not_landed | Correct or replace the declared credential and retry. | user-validation |
| `provider.chain.empty` | user | false | not_landed | Declare a non-empty provider chain (or select one) and retry. | user-validation |
| `provider.chain.invalid` | user | false | not_landed | Correct the named chain entries, ordering, or references and retry. | user-validation |

| Situation | Error code | Announcement code | Park cause | Retryable | Projection |
|-----------|------------|-------------------|------------|-----------|------------|
| Peak window active | none | `provider.peak.parked` (info) | `peak-window` | n/a | success |
| Quota exhausted with valid reset | none | `provider.quota.parked` (info) | `quota-exhausted` | n/a | success |
| Quota exhausted with no valid reset | `provider.quota.exceeded` | `provider.quota.reset_missing` | none (no honest expiry) | true | platform-provider |
| Transport failure / timeout | `provider.outage` for `quota`; park for `resolve` | `provider.quota.unreachable` | `provider-outage` | true | platform-provider |
| Non-auth HTTP failure | `provider.outage` for `quota`; park for `resolve` | `provider.quota.http_error` | `provider-outage` | true | platform-provider |
| 401 / 403 | `provider.auth.rejected` for `quota`; park for `resolve` | `provider.quota.auth_rejected` | `credential-rejected` | false | user-validation |
| Malformed JSON / envelope / limits / percentage | `provider.outage` for `quota`; park for `resolve` | `provider.quota.malformed` | `provider-outage` | true | platform-provider |
| Credential unresolvable | `config.credential.missing` for `quota`; park for `resolve` | `provider.credential.missing` | `credential-missing` | false | user-validation |
| Chain missing or empty | `provider.chain.empty` | none | none | false | user-validation |
| Chain structurally invalid | `provider.chain.invalid` | none | none | false | user-validation |
| All entries parked | none | `provider.chain.exhausted` | `chain-exhausted` | n/a | success |
| Loop cap reached | none | `provider.reevaluation.cap` | `reevaluation-cap` | n/a | success |
| Park observed clear | none | `provider.resumed` (info) | n/a | n/a | success |

For a classified failure that produces no park (a failing `quota`, or a `resolve` that cannot produce an honest expiry), the error code and the announcement code are both machine-visible: the error code is the failure identity, and the announcement code is carried in the safe summary. No state write occurs. For a `resolve` that parks a provider or chain, the park and announcement are persisted so status can read them.

### Appendix D — Ticket acceptance-criterion traceability

| Ticket acceptance criterion | Covered by | Evidence boundary |
|-----------------------------|------------|-------------------|
| A park reports its cause and expiry | AC-F5-1, AC-F5-2, AC-F5-3, AC-F5-4, AC-F5-5, AC-F5-6, AC-F2-3 | Park records with closed cause and absolute expiry; state round-trip; exact-expiry inactivity; deterministic listing; cap/chain expiry; park-versus-lane distinction. |
| Provider outage is announced, not silent | AC-F4-6, AC-F6-1, AC-F6-2, AC-F6-3, AC-F6-4, AC-F7-4 | Every legacy fail-open class asserts an announcement or classified error; skipped-entry outages remain visible; no silent-clear path. |
| Subscription-first quota ordering | AC-F1-3, AC-F2-2, AC-F2-4 | Validation rejects paid-before-subscription; subscription selection precedes paid; peak never substitutes. |
| Credentials resolve through M0-S12, never direct environment reads | AC-F7-1, AC-F7-2, AC-F7-3, AC-NFR-3 | Credential-port-only resolution; zero new secret-read allowlist entries; canary scans. |
| Battery ported from the legacy resolver tests | AC-F4-2, AC-F4-5, AC-F4-6, AC-NFR-2, Appendix A | Boundary math, fresh re-evaluation, cap, fail-loud divergence, hermetic tests. |
| Deterministic, no-live-network tests | AC-NFR-1, AC-NFR-2, AC-NFR-5 | Identical replay, injected seams, zero live calls, idempotent persistence. |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31 | Change Spec Writer | Initial GH-182 provider v1 specification from the story, planning concepts, command registry, ADR-0003, delivered config/state/result/credential specs, and the legacy resolver battery. |
| 1.1 | 2026-10-31 | Change Spec Writer | Added affected users and business impact, the provider field-level required/optional/default contract, the full provider error-row taxonomy with remediation and consequence, exact-code provider classification after multiple rows, bounded expiry for cap and chain parks, and the AC-traceable QA strategy. |

---

## AUTHORING GUIDELINES

This specification is grounded in the story, the planning concepts (model profiles, policy as code, user journeys), the command registry, ADR-0003, the delivered config/state/result/credential feature specs, and the legacy resolver and its battery. The v1 boundary follows the story and the model-profiles concept: provider routing and parks ship; profile selection heuristics and harness spawn do not. The legacy battery is treated as a parity source for boundary math, not as a behavior to preserve wholesale: its fail-open warning is intentionally replaced by a structured announcement and a park or classified error, because the story's acceptance criterion makes silent outage handling unacceptable. The pure-policy/I/O split follows ADR-0003's runtime-neutral core and adapters I/O tiers; parks reuse the delivered state abstraction instead of a second store. The configuration shape is expressed at the key/field level so downstream plan and test artifacts can be traceable; the codebase map names component homes and test directories as a placement contract, not as implementation tasks. Any decision with cross-story or precedent-setting impact is flagged in §14.1 rather than recorded here.

## VALIDATION CHECKLIST

- [x] `change.ref` matches the provided `workItemRef` (GH-182); `owners` has at least one entry; `status` is `Proposed`.
- [x] All sections present in order (1–25 plus authoring guidelines and validation checklist).
- [x] ID prefixes are consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-, EVT-).
- [x] Every acceptance criterion uses Given/When/Then, references at least one F-/DM-/NFR-/EVT- ID, and is mechanically checkable.
- [x] NFRs include measurable thresholds; risks include impact, probability, mitigation, and residual risk.
- [x] Out-of-scope items are prefixed `[OUT]`; non-goals explicitly exclude model-profile heuristics and harness spawn.
- [x] The ticket acceptance criteria are traced in Appendix D; the legacy battery parity is mapped in Appendix A.
- [x] The decision candidates with cross-story impact are flagged in §14.1 and not authored as decision records here.
- [x] Affected users and business impact are stated; the provider configuration field contract names required, optional, and default values.
- [x] Provider error rows include category, retryable, consequence, remediation, and projection; exact-code provider classification is specified.
- [x] QA strategy is traceable to acceptance criteria and asserts hermetic, no-live-network tests.
- [x] Every park, including cap and chain parks, has an absolute future expiry.
- [x] No ticket/PR evolution history, no step-by-step implementation tasks, and no code-level instructions are included.
- [x] Only this spec file was written; no other files were modified.
