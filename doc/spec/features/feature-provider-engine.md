---
ados_distribution: internal
id: SPEC-PROVIDER-ENGINE
status: Current
created: 2026-10-31
last_updated: 2026-11-20
owners: ["engineering"]
service: delivery-os
summary: "The provider v1 engine: the typed provider configuration branch and shipped defaults, deterministic subscription-first chain resolution with nine skip reasons, zone-aware peak and subscription-quota evaluation combined by MAX, the typed spend-ceiling budget gate over one ref-scoped totals read, named self-expiring parks persisted as provider.park ledger records and folded into provider-parks.json, fail-loud announcements, credential-port-only quota authorization, offline simulation and legacy policy migration, the seven-member `provider` CLI family mounted as the twenty-seventh and last prompt-required one, the five provider-engine error identities, and the pure-core / provider-quota / time-zone adapter boundaries."
links:
  related_changes: ["GH-182", "GH-234", "GH-175", "GH-176", "GH-224", "GH-231", "GH-350"]
  related_decisions: ["ADR-0003", "ADR-0005", "ADR-0007", "ADR-0012", "PDR-0006", "TDR-0057", "TDR-0058", "TDR-0059", "TDR-0060", "TDR-0061", "TDR-0062"]
  contracts:
    - "packages/core/src/contracts/provider.ts"
    - "packages/core/src/contracts/provider-profile.ts"
    - "packages/adapters/src/provider-quota/index.ts"
    - "packages/adapters/src/time-zone/index.ts"
---

# Feature: Provider Engine

## Overview

The provider engine decides which declared AI model provider entry is available for a spawn. It validates typed provider configuration, resolves a named chain in declared order, evaluates every entry's peak-window and subscription-quota conditions, and selects the first eligible entry under a subscription-first cost policy — or returns a chain park carrying an honest resume time. Every pause is a named, self-expiring park persisted through the state layer, and every failure to determine availability is a structured announcement rather than a silent "clear" verdict. Quota authorization resolves only through the credential port.

The engine selects provider entries, not models: model-profile selection and provider watching are specified in [Provider Profiles and Watching](feature-provider-profiles.md) and compose this engine's conditions, parks, announcements, and quota transport seam. It returns a decision plus durable availability state that the later spawn gate and the status, queue-readiness, doctor, spend, and ceremony surfaces consume. The provider family is prompt-required: it is mounted as the twenty-seventh and last prompt-required family, and its engine CLI surface is `provider resolve`, `provider quota`, and `provider parks list`, beside the two additive members `provider simulate` and `provider migrate legacy` specified below.

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
- Expose a bounded CLI `provider` surface whose machine results are CommandResult envelopes.

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
| `provider.entries.<name>.peak` | Optional zone-aware peak window. | absent; no peak condition |
| `provider.entries.<name>.quota` | Optional subscription quota policy. | absent; no quota condition |
| `peak.timezone` | Declared zone. | `UTC` (default; alias of `Etc/UTC`) or an IANA zone name matching the declared grammar |
| `peak.startSecondsOfDay` / `peak.endSecondsOfDay` | Local seconds-of-day on the declared zone, end strictly greater than start. | required when peak is present |
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
| `provider.budgets.<name>.enabled` | Whether the declared ceiling is evaluated at all. | `true` |
| `provider.budgets.<name>.scope` | `ticket` measures from the work item's beginning; `window` measures from `now − windowSeconds`. | required |
| `provider.budgets.<name>.basis` | `cost` uses harness-reported units and is never re-priced; `tokens` sums the declared token classes. | required |
| `provider.budgets.<name>.ceiling` | A measurement at or above it is a crossing (`>=`). | required |
| `provider.budgets.<name>.windowSeconds` | Positive integer trailing window. | required iff `scope` is `window`; refused on `ticket` |
| `provider.budgets.<name>.entries` | Restricts which declared descriptors the budget governs. | absent means every declared entry |

Provider dynamic-name maps (`credentials`, `entries`, `chains`, `budgets`) use the catalog's `record` field kind: child names are arbitrary and each child value is validated against the declared shape. Fixed branches keep exact unknown-key discipline.

The shipped defaults provide one concrete subscription descriptor and its credential reference, both overridable:

- `provider.entries.zai-coding-plan`: class `subscription`, enabled, peak window `06:00–10:00` declared in `UTC` with a `7200`-second buffer (pausing from `04:00` UTC), and an enabled quota policy against `https://api.z.ai/api/monitor/usage/quota/limit` with credential reference `zai`.
- `provider.credentials.zai`: `sourceKey` `{ style: literal, name: ZAI_API_KEY }`, a reference only and never a secret value.
- `provider.chains`: empty, and `provider.defaultChain` is absent. A fresh installation therefore fails closed with `provider.chain.empty` until an operator declares a chain.

### Validation

Configuration is parsed from the already-resolved tree and then semantically validated. Schema checks cover types, enums, integer ranges, and required fields. The pure provider validator enforces the relational rules the schema cannot express:

- Every quota `credentialRef` must name a declared credential reference when the quota policy is enabled.
- An enabled quota endpoint must be HTTPS with a non-empty authority, no userinfo, and no whitespace.
- A quota policy with `enabled: false` is inert for provider validation: the validator skips both the credential-reference and endpoint relational checks, so a disabled block never fails with a credential or endpoint error, and the provider-tree parser defaults an omitted `endpoint` and `credentialRef` to empty strings. The layered schema still requires the two fields whenever a quota block is present, and no quota evaluation or fetch occurs.
- Every chain must have at least one entry.
- Chain entries must name declared descriptors and must not repeat.
- Every subscription entry must precede every pay-per-token entry.
- A declared `provider.defaultChain` must name a declared chain.
- A peak window must be non-empty and must not cross midnight.
- Every declared budget has a closed scope (`ticket` or `window`), a closed basis (`cost` or `tokens`), and a positive ceiling; `windowSeconds` is required exactly for a `window` scope and refused on `ticket`, and a declared `entries` list is non-empty and names declared descriptors. A budget defect fails `provider.chain.invalid` naming the field path, and no partial evaluation escapes.

Structural or relational violations fail `provider.chain.invalid`. An absent default chain, an undeclared requested chain, or a chain with no entries fails `provider.chain.empty`. No silent reordering, substitution, or default chain is invented.

### Chain resolution

Resolution walks the selected chain in declared order and selects the first eligible entry. An entry is eligible when it is enabled, its combined condition is clear, and either it is a subscription entry or the chain allows paid fallback and no subscription entry is parked for a peak window. A peak-window park therefore never substitutes paid capacity.

The no-paid-escalation rule extends that eligibility to spend ceilings and keeps the two budget outcomes distinct. A subscription entry parked by a `window`-scope budget (class P) blocks paid substitution exactly as a peak park does, so no chain configuration makes a paid entry selectable while a subscription entry is budget-parked. A `ticket`-scope crossing (class T) fails that one entry without parking it, so a later paid entry stays selectable when the chain declares `allowPaidFallback`: the failure names the entry instead of inventing a ceiling-wide pause.

Every non-selected entry is reported with exactly one reason from the closed nine-value set:

| Reason | Meaning |
|--------|---------|
| `disabled` | The descriptor's `enabled` flag is false. |
| `peak-window` | The entry is parked in its peak window. |
| `quota-exhausted` | The entry is parked on an exhausted quota limit with a future reset, or is skipped as a failed entry whose exhausted limit has no honest reset. |
| `budget-exhausted` | The entry is parked (`window` scope) or failed (`ticket` scope) on a declared spend ceiling measured at or above its limit. |
| `provider-outage` | The entry is parked on a transport, HTTP, envelope, or parse failure. |
| `credential-missing` | The entry is parked because its credential reference could not resolve. |
| `credential-rejected` | The entry is parked because the provider rejected the credential (HTTP 401/403). |
| `paid-fallback-not-allowed` | A pay-per-token entry is not selectable because the chain disables paid fallback. |
| `shadowed` | An entry with no higher-precedence reason follows the selected entry or, in a parked decision, the determining entry. |

Precedence is deterministic: `disabled`, then the entry's own condition cause, then `paid-fallback-not-allowed`, then `shadowed`.

When no entry is eligible but at least one enabled entry is parked, the decision is parked. The chain park is named `chain:<name>`, has cause `chain-exhausted`, carries the union of contributing condition kinds, and expires at the earliest contributing provider expiry. A failed entry (an exhausted quota limit with no honest reset) does not abort the walk: it is reported as skipped with reason `quota-exhausted`, creates no park, and its `provider.quota.reset_missing` announcement remains in the command-result announcements while resolution continues to a later eligible entry. Only parks with an honest future expiry contribute; a failed entry never contributes a park. When no later entry is eligible and no contributing provider park can supply an honest future expiry, resolution fails with the classified failure (`provider.quota.exceeded` for the quota-exhaustion case) instead of fabricating one. A missing or empty chain is a classified failure, never an empty success.

### Peak windows

A peak window is a start second-of-day, end second-of-day, buffer, and declared zone (`UTC` by default, or an IANA zone name matching the declared grammar and bounded by `PROVIDER_ZONE_NAME_MAX_LENGTH`). Its seconds-of-day are read on that zone's clock: the effective pause window is the half-open interval `[max(0, start − buffer), end)` in local seconds, and inside it the condition parks with an absolute expiry resolved by the one named `peakWindowEndInstantMs(nowMs, zoneFacts, rule)` derivation. The rule is the earliest instant at or after the declared local end; a skipped local second resolves to the transition instant exactly and a repeated local second to its first occurrence. Pure policy receives zone facts through the injected `ProviderZonePort` (`isKnownZone`, `offsetSecondsAt`, the required `nextTransitionAtOrAfter`); no vendor or ambient zone read enters core. A grammar-valid zone the composition cannot resolve refuses `provider.peak.zone-unknown` at exit 1 before any evaluation on `resolve`, `quota`, and `profile resolve`, with no park and no announcement. Empty, out-of-range, and cross-midnight windows fail validation. No vendor value is hardcoded.

### Quota evaluation

A subscription descriptor with an enabled quota policy issues one bounded HTTPS `GET` through the injected quota transport. The sanitized response is normalized into a secret-free snapshot of limits: each limit carries a type, a non-negative integer percentage, and an optional reset epoch in milliseconds. Only `TOKENS_LIMIT` entries participate in exhaustion; `TIME_LIMIT` entries are ignored.

A limit is exhausted when its percentage is at or above the configured threshold. A future reset on any exhausted limit wins as the soonest reset among exhausted limits and determines the wait and the park expiry. A past or equal-to-now reset clamps to zero wait and leaves the condition clear only when every exhausted limit carries a valid reset; the reset of a non-exhausted limit is ignored. If at least one exhausted limit has no valid reset and no exhausted limit yields a future reset, the verdict is indeterminate: the per-entry condition is failed with `provider.quota.exceeded` and a `provider.quota.reset_missing` announcement, and no expiry is fabricated. A failed entry is skipped with reason `quota-exhausted` and does not abort the walk; the command fails loud only when no later eligible entry exists and no honest contributing park can supply an expiry (see Chain resolution). A failed verdict writes no state park or state announcement record.

Malformed JSON, an invalid envelope (`code` not `200` or `success` not `true`), absent or non-array limits, a non-object limit, a non-string limit type, and a non-numeric percentage are malformed-response failures. They are classified as outages and announced; they are never treated as clear.

### Budget ceilings

A declared `provider.budgets` record map turns spend into a pre-spawn gate. Evaluation consumes exactly one verified, ref-scoped spend-totals read that projects every declared scope, so the read count is one at any budget count and both bases are served by the same read. Nothing declared means no gate, no read, and no condition.

- A measurement below the ceiling is clear and resolution proceeds.
- At or above the ceiling on a `window` scope, the entry parks with cause and condition kind `budget-exhausted` and the expiry `newestAtMs + windowSeconds × 1000`, which is strictly future by construction; the `provider.budget.parked` announcement is raised once per park generation at `info` and carries the five budget evidence fields.
- At or above the ceiling on a `ticket` scope, the entry is failed rather than parked: no park and no expiry are created, the entry is skipped with reason `budget-exhausted`, and the `provider.budget.crossed` announcement is raised at `warning` with the same five fields. When no later entry is eligible and no honest contributing park supplies an expiry, resolution fails with `provider.budget.exceeded` at exit `1`, whose remediation is to raise or clear the ceiling, or to start a new ticket, because the ceiling cannot reopen by itself.
- A read that fails refuses with the delivered `state.*` identity instead of reading as clear, while a verified-empty reading with telemetry present measures zero and is clear.

The measured subject is a fact, so the read needs one work-item ref and resolves it through one declared three-tier precedence: an explicitly supplied ref-bearing fact wins (today only the `simulate` fixture's `workItemRef`); otherwise the local delivery context at `<cwd>/.ai/local/pm-context.yaml` through the delivered seam and the same pattern an omitted `spend --ref` uses; otherwise the evaluation refuses. The ref is required exactly when at least one enabled budget is declared, for either scope, because the one read is ref-scoped. When a required ref cannot resolve, the run refuses once with `input.value.rejected` at exit `1` before resolution, naming the enabled budgets, the context path, and the remedy — never a zero measurement, a clear or inert skip, or a window-only downgrade. The read-only members (`quota`, `parks list`, `profile resolve`, and `watch status`) resolve no ref and never fail on a missing context, and `simulate` takes its ref only from the fixture. There is no provider flag, no environment variable, no state-store read, and no new `resolve` key.

The evidence is closed to five budget fields: `budgetName` names the ceiling that crossed, `budgetScope` records `ticket` or `window`, `budgetBasis` records `cost` or `tokens`, `budgetMeasured` carries the figure the one read produced, and `budgetCeiling` carries the declared limit. The work-item ref is not a sixth field; it appears in the announcement or refusal message only.

The gate is bounded and honest about that bound: at most one spawn increment may land above a ceiling before the next evaluation observes the new records, so the documented limit is a one-spawn-increment pre-spawn bound rather than a real-time spend stop. The gate is also distinct from an alarm: a ceiling parks or refuses before a spawn, while the [metrics](feature-metrics.md) burn-rate alarm reports a crossing as evidence and blocks nothing.

### Conditions and MAX

Peak and quota are independent conditions on one entry. They are combined by the MAX rule: the later expiry wins, the park lists every active condition kind, and the single cause is the condition that determines the expiry. Ties resolve in the fixed order `peak-window`, `quota-exhausted`, `budget-exhausted`, `provider-outage`, `credential-missing`, `credential-rejected`.

### Parks

Every non-clear provider condition with an honest future expiry becomes a named park; a failed entry (quota exhausted with no honest reset) is not a park and is reported as a skipped entry instead. Provider parks are named `provider:<name>`; chain parks are named `chain:<name>`. A park carries:

- a cause from the closed set `peak-window`, `quota-exhausted`, `budget-exhausted`, `provider-outage`, `credential-missing`, `credential-rejected`, `chain-exhausted`, or `reevaluation-cap`;
- the active condition kinds;
- a creation time and an absolute expiry strictly in the future at creation;
- bounded, secret-free evidence drawn only from the fourteen-field park allowlist: `providerName`, `chainName`, `conditionKinds`, `waitSeconds`, `resetEpochMs`, `httpStatus`, `failureClass`, `credentialRefName` (the reference name only, never the resolved value), `timezone`, `budgetName`, `budgetScope`, `budgetBasis`, `budgetMeasured`, and `budgetCeiling`.

A peak or quota park expires at the determining condition's end. A `budget-exhausted` park expires at `newestAtMs + windowSeconds × 1000`, the end of its declared trailing window. An outage or credential-failure park uses its configured TTL. A `reevaluation-cap` park uses the configured cap TTL. A `chain-exhausted` park uses the earliest contributing provider expiry. A park is always a provider-availability pause with a guaranteed resume time; it is never a blocked lane, never a delivery failure, and never hides a lane's readiness condition.

Expiry is derived at read time: a park is active while `expiresAt > now` and inactive at exactly `expiresAt <= now`. No timer, daemon, delete, or expiry write exists. An unchanged active generation (`cause:expiresAtMs`) appends nothing; a changed cause or expiry appends a new record and the latest record per park name wins. When a previously active park is observed gone on the next mutating resolve, that resolve appends one `provider.resumed` announcement. It appends a `cleared` record only when the clear is observed before expiry (`expiresAt > now`); a park observed after expiry stays `expired` in `--all` views with no `cleared` record and no expiry write.

### Announcements

Every non-clear condition that persists a park emits exactly one structured announcement for that park generation. A failed entry that persists no park still contributes its `provider.quota.reset_missing` announcement to the command result. An outage on an entry skipped in favour of another is still announced and parked, so the result remains truthful when the chain succeeds elsewhere. Announcement identity is deterministic from the subject kind, subject name, code, and park generation, so an unchanged condition never appends a duplicate.

Announcements use a closed code set:

`provider.peak.parked`, `provider.quota.parked`, `provider.quota.reset_missing`, `provider.quota.unreachable`, `provider.quota.http_error`, `provider.quota.auth_rejected`, `provider.quota.malformed`, `provider.credential.missing`, `provider.chain.exhausted`, `provider.reevaluation.cap`, `provider.resumed`, `provider.budget.parked`, and `provider.budget.crossed`.

`provider.peak.parked`, `provider.quota.parked`, `provider.resumed`, and `provider.budget.parked` are informational; every other code, including `provider.budget.crossed`, is a warning. The two budget codes are raised once per budget episode: `provider.budget.parked` at `info` when a `window`-scope ceiling parks the entry with the five budget evidence fields, and `provider.budget.crossed` at `warning` when a `ticket`-scope ceiling fails the entry and no park is created. An announcement carries a safe templated message and bounded evidence projected at runtime through the closed seventeen-field allowlist: `providerName`, `chainName`, `conditionKinds`, `waitSeconds`, `resetEpochMs`, `httpStatus`, `failureClass`, `credentialRefName`, `timezone`, `budgetName`, `budgetScope`, `budgetBasis`, `budgetMeasured`, `budgetCeiling`, `parkName`, `parkExpiresAt`, and `announcementCode`; non-allowlisted keys are dropped. No announcement carries a secret, authorization header, raw response body, or endpoint userinfo.

Announcements surface in three places: inside `data.announcements` for `resolve` and a successful `quota`; in the classified error envelope plus the diagnostic stream for a failure that produces no park; and in the state ledger as `provider.announcement` records when a resolution persists park state. A failed entry's announcement appears in `data.announcements` but is not written to the state ledger because no park exists. A failing `quota` carries the announcement code in the safe summary.

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
| `provider resolve` | yes; persists parks and announcements for a resolved decision | `--chain <name>`, `--profile <name>` (restricts candidates to the named profile's providers; see [Provider Profiles and Watching](feature-provider-profiles.md)) | Decision (selected or parked), skipped entries, parks, announcements |
| `provider quota` | no | `--provider <name>` | Per-provider condition views and announcements, or a classified error |
| `provider parks list` | no | `--all`, `--provider <name>` | Park views folded from verified ledger truth; active by default, expired and cleared with `--all` |
| `provider simulate` | no; zero state, credential, network, and spend effect | `--fixture <path>` | The delivered resolve payload from the `delivery.provider.simulate.v1` fixture, plus the `simulation` block |
| `provider migrate legacy` | only with `--write`, and only when the target document is absent | `--profiles-dir <path>`, `--hook <path>`, `--write` | A mapped proposal, a created document, or one `provider.migrate.refused` refusal |

`provider simulate` replays one fixture through the delivered engine and discloses `fixturePath`, `fixtureSchemaVersion`, `now`, the supplied `workItemRef` when the fixture declared one, `stateWrites: 0`, and the credential, quota, spend, and zone inputs it consumed; the fixture declares chain and profile selection, so the member accepts no `--chain`, `--profile`, or `--ref` flag and never reads the local context. `provider migrate legacy` reads the legacy profile directory and the pre-iteration hook once as compatibility input under an assignment-only grammar, maps the recognised names literal-to-literal, and discloses every unmapped name; it refuses the whole run rather than producing a partial artifact, names a provider-policy import rather than the M4-S2 namespace migration or the install lifecycle's `--migrate` flag, and no path executes, sources, imports, or emulates the hook.

All five accept the global `--json` and emit one CommandResult envelope. Human `resolve` prints the selected provider or the park's cause and resume time; warnings go to the error stream. `quota` without `--provider` evaluates the default chain's entries when `defaultChain` is declared, otherwise every declared entry. `parks list` reads verified park state, makes no network call, and mutates nothing. Invalid subcommands, flags, flag values, and positionals fail as classified invocation or input errors and never crash or emit an invalid envelope.

### Status consumer

The status digest consumes the provider vocabulary without running the provider engine. It reads the declared `provider.defaultChain`, `provider.chains`, and `provider.entries` from the resolved configuration snapshot, and it reads active park views from the verified state fold documented in [State Layer](feature-state-layer.md). It never calls `resolve`, `quota`, or `parks`, never fetches quota, never evaluates a peak or quota condition, and never writes a park or announcement.

Consequently, status reports an entry with an active park as `parked` and every other declared entry as `unverified`, never `available`. A declared chain that does not resolve makes the providers section `unknown`; an absent default chain makes it `unavailable`; a park-fold failure makes it `degraded`. The section's config/state evidence reuses the engine's declared identities rather than adding new ones: an unresolved chain carries `failureCode: "config.value.invalid"` with reason `provider-chain-unresolved` and no `failureClass`, and a configuration resolution failure carries the relevant existing `config.*` code. The status contract is specified in [Status Digest](feature-status-digest.md).

### Queue-ready consumer

The `queue ready` ready-set (M0-S7) is a second read-only consumer of the same provider vocabulary. Its `provider-available` condition reads the declared `provider.defaultChain`, `provider.chains`, and `provider.entries` from the resolved configuration snapshot and the verified active park views from the state fold. It never calls `resolve`, `quota`, or `parks`, never fetches quota, never evaluates a peak or quota condition, and never writes a park or announcement.

Consequently the condition reports an active chain park as `unsatisfied` with the bounded cause and expiry, an active provider park or all parked entries as `unsatisfied`, and an enabled unparked entry as `satisfied` with "no active park"; it never claims `available` and its evidence always carries the fixed `engine-not-run` companion. A provider-config read failure is mapped by the read's own reason (`config-invalid` or `provider-chain-unresolved`), and a park-fold failure is `state-unreadable`. The ready-set contract is specified in [Queue Ready](feature-queue-ready.md).

### Doctor consumer

The read-only `doctor` diagnostic is a third read-only consumer of the provider vocabulary. Its provider check reads the resolved provider configuration, structurally resolves the declared default chain against the declared entries, resolves enabled entries' credential references for presence through the credential port, and reads active parks and persisted announcements from the verified state fold shared with the state check. It never calls `resolve`, `quota`, or `parks list`, never fetches quota, never injects the quota transport, never evaluates a peak or quota condition, and never writes a park or announcement.

Consequently a configuration-resolution failure (`config-invalid` with its classified `config.*` code) and a provider-branch validation failure (`provider-chain-unresolved` with `config.value.invalid`) fail the provider check without aborting the run; an undeclared default chain and an unresolvable credential reference also fail it. Active parks with cause `credential-missing` or `credential-rejected` fail it with a credential-refresh hint. The five wiring-neutral causes — `peak-window`, `quota-exhausted`, `provider-outage`, `chain-exhausted`, and `reevaluation-cap` — appear in the bounded detail with cause, expiry, and a `provider quota --provider <name>` directive without flipping the verdict. `reevaluation-cap` is wiring-neutral because the engine's self-expiring loop-cap pause is a capacity condition, not a configuration or credential defect. The doctor contract is specified in [Doctor](feature-doctor.md).

### Error taxonomy

The provider kind carries sixteen rows while the engine family's own count stays five. The five provider-engine error identities, classified by exact code:

| Code | Category | Retryable | Projection |
|------|----------|-----------|------------|
| `provider.quota.exceeded` | transient | true | platform-provider (exit 2) |
| `provider.outage` | transient | true | platform-provider (exit 2) |
| `provider.auth.rejected` | user | false | user-validation (exit 1) |
| `provider.chain.empty` | user | false | user-validation (exit 1) |
| `provider.chain.invalid` | user | false | user-validation (exit 1) |

`provider.outage` covers quota transport, non-auth HTTP, and malformed-response failures, a chain that cannot supply a future resume time for a reason other than an indeterminate quota verdict, and a failed state write. A `quota` failure to resolve a credential uses the `config`-kind identity `config.credential.missing` (user, non-retryable, user-validation). Because the provider kind has more than one row, a provider failure must carry an exact declared code; an unclassified, undeclared, or wrong-kind provider failure is contained as `fallback.internal`, never mapped to the first provider row. Announcement codes are a separate closed vocabulary, not error-table rows. The machine and documented tables are synchronized in both directions. The profile-selection and `data-v1` env-record families add eight further provider-kind identities documented in [Provider Profiles and Watching](feature-provider-profiles.md).

The three identities this change adds are `user`, non-retryable, and projected as `user-validation` at exit `1`, and each carries its own remediation: `provider.peak.zone-unknown` asks the operator to correct the zone name or run where zone data is available, because a `UTC` declaration needs no zone data; `provider.budget.exceeded` asks the operator to raise or clear the ceiling or start a new ticket, because the ceiling cannot reopen by itself; and `provider.migrate.refused` asks the operator to read the named reason, file, and line and then hand-author the policy or correct the source and re-run. None is a kind-first two-segment identity, so the reserved two-segment allowlist is unchanged.

## Technical Architecture & Codebase Map

### High-level design

Pure provider policy lives in the runtime-neutral `@delivery-os/core/provider` subpath and imports only core contracts and its own modules. Peak arithmetic receives zone facts through the injected `ProviderZonePort` implemented at `@delivery-os/adapters/time-zone`, and the quota HTTP transport is the other injected I/O edge, implemented at `@delivery-os/adapters/provider-quota`. The CLI composition edge accepts an injected provider composition (the six declared seams — clock, credential port, quota transport, sleep, state store, and fence factory — beside the spend-totals port, the work-item ref seam, and the zone seam) and wires it into the engine; the production composition supplies the credential port, the quota transport, the spend-totals projection, and the `Intl` zone binder, so the engine's peak evaluation, the profile probe, and the simulation replay all resolve a declared IANA zone through the one `time-zone` adapter. A composition that cannot resolve a declared zone refuses `provider.peak.zone-unknown` rather than reading the declaration as `UTC`. Tests inject fakes. Parks and announcements persist through the delivered state layer as additive record kinds. The CLI surface validates grammar, delegates to the engine, and lets the edge own envelopes, streams, redaction, and exit projection.

### Core components and directory structure

| Path | Responsibility |
|------|----------------|
| `packages/core/src/contracts/provider.ts` | Provider descriptors, cost classes, the declared zone grammar and the zone-bound facts, the `ProviderZonePort` and `PeakWindowEndRule`, budget declarations and the spend-totals port, peak, quota, conditions, parks, announcements, decisions, skip reasons, error codes, schema identifiers, and the `QuotaTransport` contract. |
| `packages/core/src/provider/validate.ts` | Parsing and semantic validation: references, duplicates, cost ordering, ranges, endpoints, and chain selection. |
| `packages/core/src/provider/chain.ts` | Deterministic chain resolution, skip reasons, cost-policy eligibility, and chain parks. |
| `packages/core/src/provider/peak.ts` | Zone-aware peak-window arithmetic, the local-seconds basis, and the one named transition-segment expiry derivation shared by the gate and the watcher. |
| `packages/core/src/provider/quota.ts` | Quota snapshot normalization, `TOKENS_LIMIT` filtering, threshold/reset evaluation, and failure classification. |
| `packages/core/src/provider/budgets.ts` | Pure budget evaluation over injected totals and clock facts: the comparison, the `window` park with its derived expiry, the `ticket` failure with no park, and the five-field evidence. |
| `packages/core/src/provider/simulate.ts` | `delivery.provider.simulate.v1` fixture validation and payload assembly over the delivered engine; no condition arithmetic and no state write. |
| `packages/core/src/provider/migrate.ts` | The bounded legacy reader, the name-first credential classification, the literal-to-literal mapper, and the proposal builder; no child process, shell, or ambient read. |
| `packages/core/src/provider/conditions.ts` | MAX combination and the fixed condition tie order. |
| `packages/core/src/provider/parks.ts` | Park construction, deterministic naming, generation identity, evidence projection, ledger persistence, fold and read-time views, and the `provider-parks.json` projection. |
| `packages/core/src/provider/announcements.ts` | Announcement code mapping, severity, safe messages, and deterministic identity. |
| `packages/core/src/provider/loop.ts` | Re-evaluation driver and completed-sleep cap. |
| `packages/core/src/provider/engine.ts` | Engine composition over injected seams: `resolve`, `quota`, and `parks`. |
| `packages/core/src/provider/index.ts` | Public pure provider-engine surface. |
| `packages/adapters/src/provider-quota/index.ts` | Injectable quota transport and native-fetch production wrapper: bounded GET, `redirect: manual`, in-memory bearer header, no storage. |
| `packages/adapters/src/time-zone/index.ts` | The single `Intl`-backed `ProviderZonePort` implementation: the only workspace module that reads zone data for provider policy, with no I/O, network, or extra environment read. |
| `packages/cli/src/commands/provider.ts` | Grammar and handlers for `resolve`, `quota`, `parks list`, `simulate`, and `migrate legacy`; the same command file hosts the provider-family profile and watch subcommands specified in [Provider Profiles and Watching](feature-provider-profiles.md). |
| `packages/cli/src/edge.ts` | Wires the injected provider composition into the engine for the provider command, binds the `Intl` zone port for the engine's peak evaluation, the profile probe, and the simulation replay, refuses an unresolvable declared zone by name before resolution or probing, injects the spend-totals port, supplies the watch observation instant, and composes the fixture and migration reads. |
| `packages/core/src/config/catalog.ts` / `defaults.ts` | Provider catalog branch and shipped overridable defaults. |
| `packages/core/src/contracts/error-table.ts` | The five provider-engine rows and exact-code provider classification. |

### Data architecture

The engine's durable vocabulary is carried by two state record kinds inside the existing state schema:

- `provider.park`, payload schema `delivery.provider.park.v1`, under the store-scoped key `provider.parks`.
- `provider.announcement`, payload schema `delivery.provider.announcement.v1`, under the store-scoped key `provider.announcements`.

Persistence occurs only in a mutating `resolve` with a state store. It acquires the state fence, reads verified ledger truth, appends only changed park generations and new announcement identities, and replaces the rebuildable `provider-parks.json` derived document (schema `delivery.provider.parks.v1`) only when park truth changed. The projection is a fold of the latest record per park name, ordered by expiry ascending then name lexical. Read paths fold verified ledger truth directly, so a missing or divergent projection never changes a view and never triggers a write. There is no separate rebuild command. A failed state write is contained as a classified provider failure rather than reported as a successful decision.

### Boundaries and runtime neutrality

- The `provider` core subpath is part of the ambient neutral set: no runtime imports, ambient globals, clock, randomness, filesystem, network, or environment access. Policy receives facts through injected seams.
- The `provider-quota` adapters subpath is the single admitted runtime-API edge for the quota request. It is an exact, reason-bearing entry in the runtime-API confinement rule; it is not a secret-read allowlist entry, and the secret-read boundary admits no entry from this subpath. The `time-zone` adapters subpath is the only module that reads zone data for provider policy; `Intl` is confined there and no provider core module imports it.
- The production composition registers the family unconditionally and supplies the six declared seams (clock, credential port, quota transport, sleep, state store, fence factory) beside the spend-totals projection, the `Intl` zone binder, the work-item ref seam, and the fixture and migration reads; the CLI composition edge accepts that composition and wires its ports into the engine. A declared IANA window therefore evaluates on its own zone in `resolve` and parks at its declared local end rather than refusing. An unresolvable zone refuses `provider.peak.zone-unknown` by name at `resolve` and `quota`; `profile resolve` refuses the same identity before probing, and the probe reports `available: false` with that condition. The status and dispatch profile contexts fail closed to no context rather than selecting against a `UTC`-substituted window; dispatch's nomination probe reports the provider unavailable and maps the refusal to `provider.profile.unavailable` with the unresolvable zone named in the blocker detail. The daemon watcher's `peakWindowOpenAt` carries an unresolvable window zone as an explicit `unknownZone` rather than skipping it as a closed `UTC` window, and no production composition mounts a `peakPause` port today. Tests inject fakes.
- The state layer owns ledger framing, fences, verified reads, and atomic document replacement; the provider engine only supplies record payloads and the fold.
- Model-profile selection (specified in [Provider Profiles and Watching](feature-provider-profiles.md)), harness spawn, background timers, spend reporting, and MCP/OpenCode provider surfaces are outside this feature.

### API and interface contracts

The public engine is created by `createProviderEngine(deps)` with injected `clock`, `credentialPort`, `transport`, `sleep`, optional `stateStore`, and optional `newFenceToken`, beside the optional zone seam `zoneFactsFor`, the optional budget seams `spendTotals` and `resolveWorkItemRef`, and the optional `workItemContextPath` the refusal names. It exposes:

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
| Bounded evidence | Park and announcement evidence is at most 1024 serialized bytes and 20 fields, drawn only from the closed allowlists (14 park fields; 14 base plus 3 announcement fields); announcement evidence is projected through the 17-field allowlist at runtime, so non-allowlisted keys are dropped. |
| Idempotence | Re-evaluating an unchanged park generation appends zero duplicate records; repeated `parks list` has zero side effects; repeated `quota` performs zero state writes. |
| Expiry correctness | A park is inactive exactly at `expiresAt`; TTL and chain parks have an expiry strictly after creation; no park is created with a past or absent expiry. |
| Error-table synchronization | The five provider-engine rows agree between the machine table and the documented table in both directions; provider classification is exact-code and total with `fallback.internal` containment. |
| Evaluation cost | Pure evaluation of 100 provider entries completes within 50 ms on the reference environment, excluding quota transport time; a budget evaluation issues exactly one spend-totals read regardless of how many ceilings are declared, and the five evidence fields add no second measurement path. |

## Quality Assurance Strategy

| Level | Location | Scope |
|-------|----------|-------|
| Structure and contract inventory | `tests/structure/provider-contract.test.ts`, `provider-budgets-contract.test.ts`, `provider-watch-contract.test.ts`, `provider-mounting.test.ts`, `error-table.test.ts`, `content-inventory.test.ts` | Contract inventory, schema identifiers, closed sets, evidence allowlists, the budget and watch contracts, the 27-family mount, deterministic naming, and error rows. |
| Behaviour | `tests/behaviour/provider-chain-resolution.test.ts`, `provider-peak-window.test.ts`, `provider-peak-zone.test.ts`, `provider-quota-evaluation.test.ts`, `provider-budgets.test.ts`, `provider-budget-ref.test.ts`, `provider-parks.test.ts`, `provider-announcements.test.ts`, `provider-credentials.test.ts`, `provider-config-precedence.test.ts`, `provider-cli.test.ts` | Validation, ordering, selection, skip reasons, peak boundaries and the DST matrix, quota math, both budget scopes and the ref matrix, park lifecycle, announcements, credential handling, per-repository precedence, and CLI paths. |
| Behaviour — additive members | `tests/behaviour/provider-simulate.test.ts`, `provider-migrate.test.ts`, `provider-watch-freshness.test.ts` | Fixture validation and zero-effect replay with resolve parity, the migration accept/refuse matrix and credential firewall, and the freshness bound with the park clamp. |
| Legacy parity | `tests/behaviour/provider-legacy-parity.test.ts` | Ported resolver battery groups and the explicit fail-loud divergence classes. |
| Golden output | `tests/golden/provider-*.test.ts` | Recorded machine and human output for selected, parked, outage, quota, parks-list, simulation, and migration cases. |
| Checks and security | `tests/checks/provider-hermetic.test.ts`, `provider-evidence-bounds.test.ts`, `provider-zone-refusal.test.ts`, `provider-entrypoint-reachability.test.ts`, `provider-coverage-mount.test.ts`, `secret-read-boundary.test.ts`, `error-table-sync.test.ts` | No live network, sleep, or ambient zone read, evidence bounds, the zone refusal, 7/7 member and 8/8 help reachability with its two negative arms, secret-read boundary, and table synchronization. |
| Boundaries | `tests/boundaries/**` | Runtime-API confinement for the quota transport with a clean control and a provider-core negative fixture that fails if an `Intl` or zone read appears in the provider tier. |
| Aggregate | `pnpm check` | Whole workspace. |

## Operational & Support

### Configuration

Operators declare descriptors, credential references, chains, spend ceilings, profiles, and watch targets under the `provider` branch; `config debug` shows every effective value's winning origin. The shipped Z.AI descriptor and credential reference are overridable defaults. No chain is enabled by default, so `resolve` fails closed until a chain is declared. Endpoint, threshold, timeout, loop cap, park TTLs, budget ceilings, and watch bounds are configuration, not code.

### Observability

The observability surface is the park record, the announcement record, and the command envelope. `resolve` returns the decision, skipped entries, parks, and announcements; `quota` returns per-provider state and announcements or a classified error; `parks list` returns the deterministic view. Parks and announcements are durable and deduplicated by generation and identity. No metrics exporter, trace span, or event bus is introduced.

### Cost and infrastructure

Subscription-first ordering and paid-fallback-off protect subscription quota before paid capacity; a peak-window park never substitutes paid capacity. The engine adds no third-party runtime dependency; the quota transport uses the runtime's existing fetch capability. Provider parks and announcements are bounded and deduplicated, and the projection is rebuildable.

### Maintenance

Adding a provider is a descriptor plus a credential reference, not a code branch. Adding a vendor quota shape is a new normalized snapshot mapping with fixtures. The cause, condition, skip-reason, announcement, error, and evidence vocabularies are guarded sets; growth requires a spec update and, where cross-cutting, a decision record. Provider and model policy is resolved before each spawn by the typed dispatch composition through the profile seam and the `data-v1` env record, and the family is mounted in the production composition; the shipped hook example is inert as policy input because no composition reads it.

## Dependencies & Risks

- **Depends on** the result contract ([feature-result-contract.md](feature-result-contract.md)) for the envelope, the five provider-engine identities, exact-code classification, exit projection, and the redaction chokepoint.
- **Depends on** the configuration layer ([feature-config-layer.md](feature-config-layer.md)) for the typed catalog, layered resolution, provenance, and shipped defaults.
- **Depends on** the state layer ([feature-state-layer.md](feature-state-layer.md)) for the append-only ledger, fences, verified reads, and atomic derived-document replacement.
- **Depends on** the credential port and runtime confinement ([feature-adapter-ports.md](feature-adapter-ports.md), [feature-monorepo-scaffold-toolchain.md](feature-monorepo-scaffold-toolchain.md)).
- **Consumed by** the status digest ([feature-status-digest.md](feature-status-digest.md)) for the declared configuration branch and verified park views only; status never runs the engine or fetches quota.
- **Consumed by** the queue-ready ready-set ([Queue Ready](feature-queue-ready.md)) for the declared chain and verified park vocabulary only; queue ready never runs the engine or fetches quota.
- **Consumed by** the doctor diagnostic ([Doctor](feature-doctor.md)) for the declared configuration branch, structural chain resolution, credential references, verified park views, announcement vocabulary, and park causes only; doctor never runs the engine or fetches quota.
- **Consumed by** later spend, ceremony, and spawn surfaces for the park and announcement vocabulary.
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
| Peak window | A half-open interval on the declared zone's clock, extended by a buffer, during which work pauses rather than using peak-priced capacity. |
| Budget ceiling | A declared spend limit on one basis and either a ticket or a trailing window scope; a measurement at or above it parks (`window`) or fails (`ticket`) an entry. |
| Budget crossing | The point at which a measured spend figure reaches its declared ceiling; the ticket-scope outcome, reported once per entry with `provider.budget.crossed`. |
| Quota snapshot | The normalized, secret-free limits and reset times derived from a provider response. |
| Condition | A provider entry's current availability driver: clear, peak-window, quota-exhausted, budget-exhausted, provider-outage, credential-missing, or credential-rejected. |
| Park | A named, self-expiring provider or chain pause with a closed cause, active conditions, and an absolute expiry. |
| Park generation | The identity of one park episode, `cause:expiresAtMs`, used to deduplicate records. |
| Announcement | A structured, deduplicated event with a closed code and severity describing a park, failure, cap, or resume. |
| Fail-loud | The rule that an indeterminate availability verdict is announced and parked, skipped, or classified; it is never treated as clear. |
| Skipped entry | A chain entry not selected, carrying exactly one closed reason. |
| Re-evaluation loop | The policy that sleeps for the computed wait, fetches fresh quota, re-evaluates, and stops at a completed-sleep cap. |
| Blocked lane | A delivery or queue readiness failure, distinct from a provider park, which always carries a resume time. |
| Provider parks projection | The rebuildable derived document `provider-parks.json`, folded by park name from verified `provider.park` ledger records. |

See also: [Provider Profiles and Watching](feature-provider-profiles.md), [Configuration Layer and Inspection](feature-config-layer.md), [State Layer](feature-state-layer.md), [Result Contract and Error Table](feature-result-contract.md), [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md), [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md), the [provider conditions and parks guide](../../guides/provider-conditions-and-parks.md), the [repository glossary](../../overview/glossary.md), [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), [ADR-0005](../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md), and [ADR-0007](../../decisions/ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md).

**Change record:** `doc/changes/2026-10/2026-10-31--GH-182--provider-v1/`.
