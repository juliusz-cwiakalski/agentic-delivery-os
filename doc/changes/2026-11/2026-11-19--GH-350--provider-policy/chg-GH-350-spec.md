---
change:
  ref: GH-350
  type: feat
  status: Proposed
  slug: provider-policy
  title: "M4-S4: Declarative provider policy — quota, peak, cost routing"
  version: "1.0"
  owners: ["Juliusz Ćwiąkalski"]
  service: jaiship provider policy, typed configuration, and offline verification
  milestone: "M4: Jaiship-native delivery"
  labels:
    - provider
    - policy
    - configuration
    - cost-control
    - peak-windows
    - budgets
    - simulation
    - migration
    - watch
    - m4
  version_impact: minor
  audience: mixed
  security_impact: medium
  risk_level: high
  dependencies:
    internal:
      - "delivered provider engine: typed `provider` branch, chain resolution, peak and quota conditions, MAX combination and fixed tie order, parks, announcements, `provider resolve|quota|parks list` (GH-182)"
      - "delivered provider profiles: tiers/profiles/seats, pacing, watch mappings, `data-v1` env record, `provider profile resolve`, `provider watch status` (GH-234)"
      - "delivered lane-level peak pausing: per-profile window rules and the daemon window watch sharing the engine's window boundary functions (GH-294)"
      - "delivered spend read side: read-only telemetry fold, five token classes, cost, per-ticket/phase/lane/role/model breakdowns, amplification, `telemetryState` (GH-236, GH-299)"
      - "delivered metrics burn-rate alarm: project-committed declaration node, post-hoc, no gate and no persisted alarm state (GH-299)"
      - "delivered seven-layer configuration with project-committed and project-local repository layers, per-node origins, child-name record merges, reset, and the `CI=true` controls (GH-223)"
      - "delivered typed-error contract: envelope, closed domain-kind register, single projection module, `{0, 1, 2}` exit taxonomy, error-table sync gate"
      - "delivered CLI provider family and its bounded grammar (five members), the static help inventory, and the provider reference page"
      - "delivered harness deny-by-default spawn-env seam and seat binding (GH-233, GH-335)"
    external:
      - "runtime `Intl` time-zone data, read only at one adapters composition edge and never by core policy"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make quota-aware, cost-optimized provider selection a property of Jaiship configuration alone — zone-correct peak windows, ceilings that stop a spawn before it overspends, per-repository policy with visible provenance, an offline replay of the real routing decision, a safe one-time bridge off the legacy shell profiles and pre-iteration hook, and watch readings that cannot present an aged balance as headroom — while the delivered engine, parks, profiles, spend, metrics, and peak-pausing surfaces keep their current guarantees.

## 1. SUMMARY

The provider engine already picks a subscription-first entry, evaluates peak and quota conditions, parks with a cause and an absolute resume time, and announces every non-clear verdict. What it cannot do is what this story is named for. Its peak windows admit exactly `UTC`, so every provider that prices a local peak must be hand-shifted and silently breaks twice a year under a transition. It has no ceiling at all: spend is measured after the fact by a read-only report and a post-hoc burn-rate alarm, so a delivery can overspend before anyone notices. "Per-project overrides" has no declared mechanism, and the nearest reading — a new project-keyed branch — would invent the identity M4-S5 has not yet defined. There is no way to replay a routing decision offline, so the flip's evidence bar is a claim about tests rather than a capability. And the operator still has no guided path off `~/.<priorWorkingName>/config/profiles/*.sh` and the pre-iteration hook, which is the very dependency the story exists to remove.

This change delivers the delta and nothing already delivered:

1. **Zone-aware peak windows.** `UTC` stays the default and the alias of `Etc/UTC`; IANA names become declarable. The pure engine keeps deciding: it receives offset facts through one injected `ProviderZonePort`, computes local seconds-of-day, and resolves the expiry by one declared DST rule shared by the engine, the profile gate, and the daemon watcher. An unresolvable zone refuses by name instead of silently evaluating as UTC, and a composition that cannot supply the port refuses a non-UTC declaration rather than degrading.
2. **Budgets that stop before spend.** A typed `provider.budgets` branch is evaluated before resolution by one pure `evaluateBudgets` over one injected read-only spend-totals port fed by the delivered spend fold. Nothing is persisted and no counter exists. A trailing-window ceiling parks with an honest expiry; a per-ticket ceiling is a terminal classified refusal, because a ceiling that never decreases has no honest future instant at which it reopens — and this specification states that divergence from the ticket's wording rather than papering over it.
3. **Per-repository policy as configuration, not a new key.** The delivered project-committed and project-local layers are the mechanism, the checkout is the project identity, and the precedence matrix, origin evidence, invalid-layer refusal, and `CI=true` posture are stated and tested. No `provider.projects.*` surface exists.
4. **Offline simulation.** `provider simulate --fixture <path>` runs the *delivered* engine over a strict, versioned facts document with no state store, and returns the delivered `resolve` payload plus one disclosure block that states `stateWrites: 0`. Equivalence with `resolve` is a parity test, not a second evaluator.
5. **A safe one-time migration.** `provider migrate legacy` reads the legacy profile directory and hook as **data** under an assignment-only subset, never executes, sources, word-splits, or shells out, refuses the whole run with one typed identity and a closed reason set, discards credential-shaped values at the parse boundary, and emits a proposal validated by the delivered validator. The shipped hook is a program, so hook import is refused by design; the specification says so plainly.
6. **Watch freshness.** A per-target `maxAgeSeconds` and a closed watch-only `watch-stale` condition make an aged observation a third state rather than a false `clear` or a false outage, and a park derived from a watch reading cannot outlive the reading's freshness bound.

The declared costs are stated as plainly as the gains: the ticket-scope refusal diverges from "park rather than overspend"; hook migration is mostly a documented refusal; the delivered live watch read has zero age, so staleness is exercised by composition-supplied observations and by the park clamp; and a pre-spawn budget gate can land one increment above the ceiling before the next read sees it.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **Peak windows are UTC-only and are one shared arithmetic.** `PROVIDER_PEAK_TIMEZONES = ["UTC"]` is the only admitted basis, validated on both the descriptor `peak` block and the profile `peakWindows` windows. Evaluation is pure arithmetic over UTC seconds-of-day: the effective half-open window `[max(0, start − buffer), end)` and an expiry `now + (end − currentSeconds)`. The boundary functions `peakWindowOpenSeconds` and `peakWindowEndSeconds` are the single home of that truth, and the daemon's lane watcher consumes the same functions, so an engine gate, a profile gate, and a lane park cannot disagree today — and must not after a basis change.
- **The provider core is ambient-neutral.** `packages/core/src/provider` performs no clock, environment, filesystem, network, locale, or `Intl` read; policy receives facts through injected seams. The provider tier is named in the ambient-globals check, so a zone lookup inside core would be a mechanical failure, not a style question.
- **Availability has one closed vocabulary.** Five condition kinds, seven park causes, eight skip reasons, and eleven announcement codes are declared as `as const` sets. Conditions combine by the MAX rule with a fixed tie order; every park carries an expiry strictly in the future at creation; a condition with no honest reset is a *failed* entry, never a fabricated park. Park evidence is drawn from a closed eight-field allowlist (eleven for announcements) bounded to ≤ 1024 bytes and ≤ 20 fields.
- **Resolution is deterministic and configurable.** Chain order is authoritative, subscription entries precede pay-per-token entries, paid fallback is off by default, and a peak park never substitutes paid capacity. The shipped defaults declare one subscription descriptor with a `06:00–10:00` UTC window and a `7200`-second buffer, one credential *reference* (`ZAI_API_KEY` by name), and no chain, so a fresh installation fails closed.
- **Profiles and watching are delivered and read-only.** `provider.profiles` declares tiers, profiles, seats with a typed `pacingClass`, a preference chain, pacing rungs, watch targets, an optional `peakWindows` branch, and an env-record grammar. `provider watch status` reads each declared target live through the quota transport and renders `{ name, condition, source, checkedAt }`; the read accepts no state store and performs zero writes. No code path retains a watch snapshot, so in the delivered composition an observation's age is always zero.
- **Spend is one read-only fold.** `readSpendLedger` composes both telemetry planes plus the ref's transition history; the fold projects five token classes, harness-reported cost, per-ticket/per-phase/per-role/per-model breakdowns, restarts, amplification, `telemetryState`, and a reconciliation disclosure. It writes nothing, opens no harness store, and classifies absence (`spend.telemetry-absent`) rather than reporting zero. The metrics report composes the same fold for its per-dispatch block.
- **The alarm is post-hoc and is not a gate.** `metrics.burn-rate` reads one project-committed declaration node (`threshold`, `basis`, `window`), evaluates a trailing window, raises at most one alarm per crossing, and persists nothing. No gate blocks on an alarm, and there is no notification channel, scheduler, or daemon tick.
- **Configuration has seven ordered layers, two of them repository-owned.** Project-committed (`<repo>/<configDirectoryName>/config.yaml`, or the selected file) and project-local (`config.local.yaml`) sit above the machine-global layers and below environment and CLI. The provider branch is a typed ordinary branch: dynamic-name maps merge by child name, lists replace whole, `reset` removes inherited values, every effective value reports an exact origin (`layer=<layer> file=<path> line=<n>`, or the environment/CLI forms), and unknown keys fail closed. Under `CI=true`, system, user-global, and project-local sources are skipped as `ci-disabled` unless independently enabled; the project-committed layer is read.
- **There is no project registry yet.** State scope is minted from the repository identity, and M4-S5 (project registry and queues) is undelivered. Nothing anywhere in the repository declares a `provider.projects.*` key, and no project-keyed policy store exists.
- **The provider CLI family carries five members.** `provider resolve`, `provider quota`, `provider parks list`, `provider profile resolve`, and `provider watch status` share one bounded grammar that validates before any read, probe, credential resolution, or state write. The family is one of twenty-six prompt-required families and has a reference page under the M1 command directory.
- **Failure identity is one register with one projection.** The `provider` kind carries thirteen rows: five engine identities, four profile-selection identities, and four `data-v1` env-record identities. The machine table holds 164 identities, the documented table 163 delivered rows, the closed two-segment allowlist 66 declared identities, the sync-suite arithmetic `BASELINE_ROWS.length + 130`, and the result-code corpus 81 rows (56 true-positive, 25 false-positive). The projection module is the only place an exit digit appears.
- **Provider policy still has a shell path.** The legacy profile directory `~/.<priorWorkingName>/config/profiles/*.sh` supplies model-selection values, and the pre-iteration hook defers spawns for peak windows and quota exhaustion. The shipped hook example is a 316-line **program** — a sleep driver loop, registered condition functions, an HTTP seam, and a cap — not an assignments file. Its tunables are shell variables (`ADOS_ZAI_PEAK_START_UTC`, `ADOS_ZAI_PEAK_END_UTC`, `ADOS_ZAI_BUFFER_SECONDS`, `ADOS_ZAI_QUOTA_DISABLED`, `ADOS_ZAI_MAX_SLEEP_LOOPS`), the per-agent model variables are `OC_ADOS_AGENT_<AGENT>_MODEL`, the profile selector is `OC_ADOS_MODEL_PROFILE`, and the credential is `ZAI_API_KEY`. No CLI command reads any of these files, and no migration surface exists.
- **There is no offline simulation surface.** The engine is already pure over injected seams and tests drive it with fakes, but no production command lets an operator replay a scenario.
- **Documentation states the current limits as truth.** The engine page calls the basis UTC and declares non-UTC timezones out of scope; the profiles page says all windows are evaluated on the UTC basis and non-UTC windows are not modeled; several pages restate the error-table counts.

### 2.2 Pain Points / Gaps

- **A declared local peak cannot be declared.** An operator must convert a provider's published local window into UTC by hand, and the conversion is wrong for roughly half of every year in any DST zone. The pause then lands an hour early or an hour late, in exactly the case an operator will notice.
- **There is no pre-spawn ceiling.** The only cost control is a report read afterwards and an alarm that fires after the drift. A delivery can cross a declared ceiling and keep spawning until someone reads a report.
- **"Per-project overrides" has no honest answer today.** The ticket requires it; the registry that would key it does not exist. Left undecided, the next implementer invents a branch that M4-S5 must then replace, and a host-wide key can silently outrank the repository's own declaration.
- **The flip's verification bar has no surface.** "Simulated quota/peak states produce the documented routing" is a statement about unit tests, not a capability an operator or reviewer can run on their machine.
- **The shell dependency the story exists to remove is still on the path.** Provider selection and cost control still depend on shell profiles and the hook; there is no guided, reviewable way to move that policy into configuration, and a naive importer that `source`s the files would be the single riskiest surface in the change.
- **An aged balance has only two available readings, and both are false.** The delivered live read makes age zero today, but the first retained or cached observation reproduces the silent-clear class the engine exists to remove: an old reading reports `clear` (spend happens) or `provider-outage` (a false failure narrative and a wrong remedy).
- **The config-only claim is unproven by evidence.** Nothing demonstrates that provider policy resolves with the legacy profile directory and hook absent, so the story's central claim rests on the absence of a code path rather than on a test.
- **A documentation-only delivery would drift.** This change moves closed sets, evidence allowlists, error rows, and the counts those rows pin; several delivered pages restate those numbers outside the table the sync gate reads, so an unmoved page becomes a false specification page.

## 3. PROBLEM STATEMENT

Because provider selection and cost control are split between a typed engine that cannot express a local peak or a ceiling and a shell surface that still decides part of the policy, an operator cannot declare a cost-control policy in Jaiship configuration that is correct across a DST transition, cannot stop a spawn before it crosses a declared ceiling, cannot express a repository-specific policy without inventing a project identity the milestone has not defined, cannot replay a routing decision offline to prove what the policy does, and cannot leave the legacy shell profiles and hook behind with a reviewable, safe bridge — while the delivered watch surface can only report an aged observation as clear or as an outage. Every one of those gaps sits on the flip's F2 line: without them, "jaiship only" still depends on shell state for provider selection and cost control.

**Who is affected.** The operator cannot declare the policy they are paying for or leave the shell path safely. The agent team cannot attribute a cost decision to configuration, and the delivery path still depends on a hook the milestone is retiring. The reviewer cannot reproduce a routing decision offline. Support cannot distinguish "no capacity", "ceiling reached", and "reading too old to act on" from one another.

## 4. GOALS

- **G-1** Let a peak window be declared in the provider's own zone, with `UTC` preserved as the default and the alias of `Etc/UTC`, without moving zone resolution into pure policy and without letting two surfaces disagree on the boundary (ticket task: "peak windows with time zones"; ticket AC: "policy expressed only in Jaiship config").
- **G-2** Resolve a peak expiry correctly across a DST transition under one declared rule — the earliest instant at or after the declared local end — shared by the engine gate, the profile gate, and the daemon watcher (ticket AC: "an exhausted provider parks with a typed reason and resumes automatically").
- **G-3** Refuse an unresolvable zone by name rather than evaluating it as UTC, and refuse a non-UTC declaration in a composition that cannot supply the zone facts (ticket ACs: "policy expressed only in Jaiship config", "parks with a typed reason").
- **G-4** Evaluate declared per-window and per-ticket spend ceilings before a spawn against the *same* figures the spend report and the metrics alarm report, with no persisted counter and no second truth (ticket task: "budgets and alarms"; owner directive: "per-window and per-ticket ceilings that park rather than overspend").
- **G-5** Park on a window-scope crossing with a computable, honest resume instant, and refuse a ticket-scope crossing as a terminal classified outcome instead of fabricating an expiry (ticket task: budgets; AC: typed reason and automatic resume where a resume exists).
- **G-6** Never let a budget ceiling license more spending: a paid entry must not become selectable because a subscription entry is budget-parked (owner directive: prefer sunk-cost subscription quota).
- **G-7** State and prove that "per-project overrides" is satisfied by the delivered repository-owned configuration layers, with one precedence matrix, origin evidence, a fail-closed invalid-layer refusal, and the `CI=true` posture — and no project-keyed branch, key, state kind, or error identity (ticket task: "per-project overrides"; ticket AC: "policy expressed only in Jaiship config").
- **G-8** Show that a delivery resolves provider policy with the legacy profile directory and hook disabled, and that no runtime path reads them (ticket AC: "a delivery runs with the shell hook and profile files disabled").
- **G-9** Provide an offline simulation surface that runs the delivered engine over stated facts, performs no state write, credential resolution, network call, or spawn, and discloses that fact on every payload (ticket task: "policy simulation (`provider simulate`) for offline verification"; ticket AC: "simulated quota/peak states produce the documented routing including parking").
- **G-10** Provide a safe one-time bridge off the legacy profiles and hook that parses them as data only, refuses anything it cannot map, never moves a credential value, and produces a proposal the delivered validator accepts (ticket task: "one-time migration ... then removes the runtime dependency"; ticket AC: "no credential values appear in config, state, or logs").
- **G-11** Make an aged watch observation a third, named state that is never reported clear or as an outage, and ensure that a park derived from a watch reading cannot outlive the reading's freshness bound (ticket task: "balance/quota watch conditions with staleness handling"; owner directive: "verify balance live").
- **G-12** Preserve every delivered guarantee this change touches: chain resolution, peak and quota conditions, MAX and the tie order, parks, announcements, `resolve|quota|parks`, profiles, pacing, the env record, watch, spend attribution, the burn-rate alarm, lane peak pausing, config precedence, and the error-table sync contract (ticket AC: "spend is attributable per ticket/phase/model"; and the constraint that delivered surfaces do not regress).
- **G-13** Pay the declared conformance and documentation cost in one change: three provider rows, every moved count, the provider reference page, the affected specification pages, the operator guides, and the decision index (ticket task: "complete and document `provider resolve|quota|parks|profile|watch`").

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| DST-matrix cases whose resume instant differs from the earliest instant at or after the declared local end | 0 (spring-forward, fall-back, southern hemisphere, no-transition, buffer edge) |
| Boundary decisions differing between the engine gate, the profile gate, and the daemon watcher for identical facts | 0 |
| Declarations with a syntactically valid but runtime-unknown zone evaluated as UTC | 0 |
| `Intl`, `TZ`, ambient-clock, environment, filesystem, or network references inside `packages/core/provider` | 0 |
| Budget parks created with a non-future, absent, or guessed expiry | 0 |
| Ticket-scope crossings presented as parks | 0 |
| Paid entries selected while a subscription entry is budget-parked | 0 |
| Spend-totals reads per evaluation, regardless of declared budget count | Exactly 1 |
| State writes on any budget, zone, watch, simulate, or migrate evaluation path | 0 |
| Budget figures disagreeing with `spend --ref` for the same selection and instant | 0 |
| Simulation-versus-`resolve` decision differences for identical facts | 0 |
| State writes, network calls, credential resolutions, and child spawns during `provider simulate` | 0 each |
| Unknown-key, bad-version, oversize, or credential-shaped fixtures accepted | 0 |
| Legacy files executed, sourced, word-split, or shelled out during migration | 0 |
| Canary credential strings appearing in migration stdout, stderr, envelope, diagnostics, or any written file | 0 |
| Refusals that still emit a proposal or write a file | 0 |
| Emitted migration proposals rejected by `config` | 0 |
| Runtime reads of the legacy profile directory or hook | 0 |
| Aged observations reported `clear` or `provider-outage` | 0 |
| Watch-derived parks expiring after `observedAt + maxAgeSeconds` | 0 |
| Parks created from an already-stale observation | 0 |
| Provider error rows (13 → 16), table total (164 → 167), delivered rows (163 → 166), sync arithmetic (`+130` → `+133`) | Exact, with one true-positive result-code corpus row added per new code, the two-segment allowlist unchanged at 66, and the prompt-required family count unchanged at 26 |
| Delivered pages carrying a superseded statement or an outgoing count as current | 0 |

### 4.2 Non-Goals

- **NG-1**: No peak window that crosses local midnight, no per-window calendars, holidays, or date rules; the delivered no-crossing rule stands, read as local seconds-of-day.
- **NG-2**: No fixed numeric UTC-offset declaration form. A named zone is a rule; a literal offset cannot express a window across a transition.
- **NG-3**: No tz-database dependency, vendored zone table, or network zone lookup. Host `Intl` data is the source, read at one edge.
- **NG-4**: No persisted budget counter, no new state record kind, no derived budget document, and no hard real-time cap. The gate is pre-spawn; a single spawn may land one increment above the ceiling before the next read sees it.
- **NG-5**: No per-lane or per-role budget dimension in this increment; `scope` is `ticket` or `window` and `entries` narrows the governed providers.
- **NG-6**: No project registry, project key, host-store policy, per-queue policy, or policy inheritance between repositories (M4-S5).
- **NG-7**: No admission gate or eligibility rule driven by watch data; no watch cache, snapshot retention, background refresher, scheduler, daemon tick, or new command.
- **NG-8**: No hook execution, emulation, or import. No legacy file is written, moved, or deleted; no merge into an existing configuration document.
- **NG-9**: No textual diff between two simulation runs and no fixture generator.
- **NG-10**: No new alarm kind, notification channel, event topic, subscription, or persisted alarm state; `metrics.burn-rate` keeps its post-hoc role.
- **NG-11**: No new command family (the provider family grows by two members), no new state record kind, and no new store write path.
- **NG-12**: No credential value in configuration, state, logs, evidence, proposals, or fixtures; no new secret-read allowlist entry.
- **NG-13**: No change to the delivered resolve/quota/parks/profile/watch semantics beyond the additive fields and vocabulary named here; no delivered closed-set member is renamed or re-meant.
- **NG-14**: No agent-prompt or command rewrite (M4-S7), no shell-wrapper rewrite (M4-S8), and no install/release change.
- **NG-15**: No change to the spend read side or the metrics report beyond the documentation statement that the gate consumes the same fold.
- **NG-16**: No policy shared across several checkouts of one project. The project identity for this story is the repository checkout, and the boundary is declared.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Zone-aware peak windows: a widened declarative zone domain, one injected `ProviderZonePort`, pure local-seconds evaluation, and one declared DST rule shared by every surface | A declared local peak must land on the provider's clock, and the decision must stay a pure function of injected facts |
| F-2 | Budget ceilings evaluated before spend: one typed `provider.budgets` branch, one pure evaluator over one injected read-only spend-totals port, a window park and a ticket refusal, and no paid escalation | The ticket's cost-control requirement needs a gate, and a gate without a second truth or a fabricated expiry |
| F-3 | Per-repository provider policy: the repository-owned configuration layers as the declared mechanism, with one precedence matrix, origin evidence, fail-closed layer validation, and the CI posture | "Per-project overrides" must be answered by behaviour that exists rather than by a branch M4-S5 would replace |
| F-4 | Runtime policy independence: provider policy resolves from configuration alone, with the legacy profile directory and hook absent or inert, and no runtime read of either | The story's central claim is that shell state is off the delivery path; it must be evidenced, not assumed |
| F-5 | Offline policy simulation: one strict versioned facts document replayed through the delivered engine with a zero-write guarantee and a parity contract | The flip's verification bar needs an executable surface, and a second evaluator would drift |
| F-6 | One-time legacy migration: a bounded declarative reader, a validated proposal, a closed refusal set, and a name-first credential firewall | The bridge off shell policy must be safe by construction, and a shell-evaluating importer would be the riskiest surface in the change |
| F-7 | Watch observation freshness: a per-target bound, a watch-only `watch-stale` condition, and an evidence-bounded park clamp | An aged reading must be neither a false clear nor a false outage, and no pause may outlive its evidence |
| F-8 | Declared conformance and documentation truth: the vocabulary and count movements, the reference page, the affected specification pages, the operator guides, and the decision index | The aggregate gates and the documentation checks enforce this surface; declaring it stops it being discovered as breakage |

**Composition with delivered surfaces (the delta boundary).** Nothing below is re-specified; each row states only how this change composes with what is already delivered and specified.

| Delivered surface | How the delta composes |
|---|---|
| Provider engine: chain resolution, peak and quota conditions, MAX and tie order, parks, announcements, `resolve\|quota\|parks` (feature-provider-engine.md) | Peak evaluation gains a zone basis and budgets join the condition inputs; the resolver, the park invariant, the MAX rule, the chain-park union, the announcement identity rule, and the projection are untouched, so no second resolver or park vocabulary appears |
| Provider profiles: tiers, profiles, seats, pacing, watch mappings, `data-v1` env record, `profile resolve`, `watch status` (feature-provider-profiles.md) | Profile windows gain the zone domain and watch targets gain `maxAgeSeconds`; selection, pacing, the env record, the seat binding, and the watch mappings are unchanged |
| Lane peak pausing: per-profile window rules and the daemon window watch (feature-peak-pausing.md) | The watcher consumes the same zone-aware boundary function, so a lane parks and resumes at the instant the admission gate computed; the bounded grace, preservation classification, resume routing, episode events, and degradation are unchanged |
| Spend read side: verified fold, token classes, cost, breakdowns, amplification, `telemetryState` (feature-spend.md) | The budget gate consumes this fold through one injected read and reports the same figures; the report, its breakdowns, its amplification, and its absence classification are unchanged, and no second measurement path exists |
| Metrics burn-rate alarm (feature-metrics.md) | The alarm stays post-hoc and gated by nothing; the gate answers "may this spawn proceed?" and the alarm answers "did the window drift?"; they share the basis vocabulary and neither derives from the other, and no alarm kind is added |
| Seven-layer configuration: repository layers, record merge, reset, origins, CI controls (feature-config-layer.md) | The repository layers become the declared per-repository mechanism; the provider branch gains `budgets` and the watch key; merge, reset, origin grammar, strictness, and the CI controls are unchanged and no project key is introduced |
| Typed-error contract: envelope, register, projection, `{0,1,2}` exits (feature-result-contract.md) | Three additive provider rows and their documented table rows; the projection module stays the only exit-digit site and no delivered row moves |
| Harness spawn-env seam and seat binding (feature-harness-adapters.md) | Policy resolves before the spawn exactly as delivered; simulation and migration never spawn, and no spawn-env allowlist entry is added |
| CLI provider family, help inventory, provider reference page (feature-cli-entrypoint.md) | Two additive members and their help entries; the family count, parity, and page-root mapping are unchanged |

### 5.1 Capability Details

- **F-1 — Zone-aware peak windows.** `provider.entries.<name>.peak.timezone` and `provider.profiles.profiles.<name>.peakWindows.windows[].timezone` admit the literal `UTC` (the default, and the alias of `Etc/UTC`) or an IANA zone name matching a declared grammar. The closed `PROVIDER_PEAK_TIMEZONES` set retires and is replaced by a declared default zone plus the pattern; the validator decides grammar only and never asserts that a zone exists at runtime. One new adapters subpath exports the single `ProviderZonePort` (`isKnownZone`, `offsetSecondsAt`), implemented over the runtime's own zone data; it performs no I/O, no network, and no environment read beyond what `Intl` itself uses, and it is the only module in the workspace that reads zone data for provider policy. Core declares the port type and never imports the implementation. Every composition — CLI, daemon supervision, host/binary — injects it; a composition that cannot supply it **refuses a non-UTC declaration** with the new typed identity rather than treating the zone as UTC. The pure evaluator computes local seconds-of-day from the injected instant and the resolved offset, keeps the delivered non-negative buffer clamp and no-crossing rule now read as local seconds, and resolves the expiry by bounded fixed-point iteration (at most three passes, last candidate used) under the declared rule: the earliest instant at or after the declared local end, a skipped local second resolving to the transition instant and a repeated local second to its first occurrence. The delivered boundary function names stay the one boundary truth, so the engine gate, the profile gate, and the daemon watcher cannot disagree. Park cause `peak-window`, condition kind, skip reason, announcement code, and MAX/tie semantics are unchanged; the closed park evidence allowlist gains exactly one field, `timezone`, and the announcement allowlist inherits it through its existing base projection. Every park and announcement created from a window — including a `UTC`-default one — carries the declared zone name, never an offset and never a locale string, so absence never implies UTC. A syntactically invalid zone stays the declaring surface's shape failure (descriptor `peak` → `provider.chain.invalid`; profile window → `provider.profile.invalid`); only a syntactically valid zone the runtime cannot resolve carries the new identity. Profile `peakWindows` keep their duplicate-refusal, overlap-validates, derived-grace-bound, and multiplier semantics unchanged.

- **F-2 — Budget ceilings before spend.** The typed `provider` branch gains a `provider.budgets` record map whose children declare `enabled` (default `true`), `scope` (`ticket` or `window`, required), `basis` (`cost` or `tokens`, required, reusing the burn-rate basis vocabulary where `cost` is harness-reported units and is never re-priced), `ceiling` (positive number, required; a measurement at or above it is a crossing), `windowSeconds` (positive integer, required exactly for `window` and refused for `ticket`), and `entries` (a non-empty list of declared descriptor names; absent means every declared entry). Semantic validation is fail-closed, names the offending field, and fails the provider configuration with the delivered `provider.chain.invalid` rather than evaluating partially. Before resolution the composition edge performs **one** verified ref-scoped spend read and projects, per declared budget, `{ cost, tokens, newestAtMs }` for its scope — the ticket scope bounded by the ref's beginning, a window scope by `now − windowSeconds`; both bases are returned for every scope so budgets on different bases still share one read, and `newestAtMs` is null only when no observation contributes. The pure `evaluateBudgets` compares each enabled budget governing the entry under evaluation against the injected clock: clear below the ceiling; **parked** for a window scope at or above it, with cause and condition kind `budget-exhausted` and an expiry of exactly `newestAtMs + windowSeconds × 1000`, which is strictly future because `newestAtMs <= now` and the window is positive, and is honest because at that instant every observation counted now has left the window and nothing can accrue while the entry is parked; **failed** for a ticket scope at or above it, with no expiry, announced `provider.budget.crossed` at `warning` severity and skipped with reason `budget-exhausted`, and — when no later entry is eligible and no honest contributing park supplies an expiry — answered by the new terminal identity `provider.budget.exceeded` at exit `1`. Budget conditions join the delivered MAX combination and the fixed tie order inserted after `quota-exhausted` and before `provider-outage`; a chain park keeps cause `chain-exhausted` and the union of contributing kinds. A paid entry remains selectable only under the delivered eligibility rule **and** only when no subscription entry is parked for `budget-exhausted`, so a ceiling is never converted into a paid-capacity escape. A budget park persists through the delivered park and announcement record kinds; there is no budget record kind, no counter, no derived document, and no write on the evaluation path. Park evidence gains exactly five fields — `budgetName`, `budgetScope`, `budgetBasis`, `budgetMeasured`, `budgetCeiling` — and the announcement inherits them; a cost-basis measurement whose harness cost was sparse says so in the announcement message rather than in a sixth evidence field. No alarm kind is added: the gate answers "may this spawn proceed?" and the delivered burn-rate alarm answers "did the window drift?" afterwards; neither derives from the other.

- **F-3 — Per-repository provider policy.** Provider policy is declared in the typed `provider` branch and a repository overrides it in its own project-committed document (which travels with the code and is what CI reads) and locally in its project-local document (workstation-only). The project identity for this story is the repository checkout; a policy spanning several checkouts, or one that must exist without a checkout, is a declared boundary owned by M4-S5. The mechanism is stated as one precedence matrix in Appendix A: every provider policy element — descriptor, chain, profile, watch target, and budget — resolves through the same seven layers, a repository declaration beats a machine-global one, project-local beats project-committed, record maps merge by child name, lists replace whole, `reset` removes inherited values, and every effective value reports its exact winning origin. A repository-layer provider document is validated before merge like every other layer, so an invalid repository declaration refuses with the delivered `config.*` or `provider.chain.*` identity naming the field and is never a silently ignored override. Under `CI=true` the project-committed layer is the CI-visible policy layer and project-local is reported `ci-disabled` unless independently enabled; a selected configuration file occupies the project-committed slot and makes project-local `selected-config`. No `provider.projects.*` branch, key, state kind, command, or error identity exists.

- **F-4 — Runtime policy independence.** Provider policy resolves from configuration alone: no shell profile, no hook, no environment-variable convention, and no hidden file participates in selection, models, chains, credential references, windows, budgets, or watches. No production composition reads the legacy profile directory or the hook, and the migration command (F-6) is the only surface that reads them at all — by explicit invocation, once, as data. The hook is removed from the *path*, not from disk: its files may remain, inert. A delivery's provider path is evidenced by resolving and simulating policy in a fixture home where the legacy profile directory and hook are absent, and again where they are present but must be ignored, with zero reads of either. Configuration continues to store environment-variable **names** and credential **reference names** only.

- **F-5 — Offline policy simulation.** `provider simulate --fixture <path> [--json]` composes the delivered `createProviderEngine` with fixture-supplied seams and calls `resolve` with `persist: false`; no routing, condition, park, or announcement logic exists in the simulate path. The fixture is one strict JSON document under the schema identity `delivery.provider.simulate.v1` declaring only facts: the instant, an optional chain and profile selection, per-reference credential outcomes (`resolved`, `missing`, `rejected`, never a value), per-entry quota transport results (an HTTP status and body, or a transport outage), spend telemetry state and points, and an optional per-zone step table of offsets. Policy comes from the resolved configuration and never from the fixture. Unknown keys, a missing required key, a wrong type, an unsupported version, or an oversized document refuse with the delivered `input.value.rejected` **before** any evaluation; the schema has no value, secret, token, or key field anywhere, so a credential-shaped fixture is structurally impossible. The command accepts no `--chain`, `--profile`, `--all`, or positional: selection lives inside the document so one document is one scenario with no second authority. `data` is the delivered resolve payload in its delivered key order — `summary`, `chain`, `decision`, `skipped`, `parks`, `announcements` — followed by exactly one additive `simulation` object carrying the fixture path, its schema version, the instant, `stateWrites: 0`, which seams the fixture supplied, and a bounded deterministic decision summary. No delivered key is renamed, removed, re-ordered, or re-typed. There is no textual diff: a diff needs a baseline whose semantics this change cannot define honestly, so equivalence with `resolve` is proven by a parity test that feeds identical facts through both and compares decisions. Exits mirror `resolve` (`0` selected, `2` parked or fully skipped, `1` fixture or invocation defect or classified decision failure); decision failures reuse the delivered provider identities and no `provider.simulate.*` row exists. The fixture read is one bounded read with a declared byte cap, and no fixture content is echoed in a failure. No production composition reads a fixture.

- **F-6 — One-time legacy migration.** `provider migrate legacy [--profiles-dir <dir>] [--hook <path>] [--write] [--json]` lives in the existing provider family as a two-level member. Default sources derive from the invoking identity's prior working name — `<home>/.<priorWorkingName>/config/profiles/` and `<home>/.<priorWorkingName>/hooks/pre-opencode-iteration` — and the flags override them; an absent source is reported `absent` rather than failing, and when neither exists the run refuses `no-source`. The reader is bounded (declared file, byte, and line caps), reads each source once, and accepts exactly one grammar: blank lines, `#` comments, and assignments `NAME=value` or `export NAME=value` where `NAME` is a plain ASCII identifier and `value` is a single quoted or bare token containing no whitespace, no expansion character, no operator, and no backslash. Nothing else is accepted; a function definition, compound command, `source`/`.`, `eval`, `set`/`unset`/`readonly`, heredoc, redirection, pipeline, command substitution, arithmetic expansion, array, multi-command line, or expansion-bearing value refuses the **whole run** with the single identity `provider.migrate.refused` at exit `1` and one closed reason — `no-source`, `unreadable-source`, `oversized-source`, `shell-construct`, `dynamic-value`, `target-exists`, or `proposal-invalid` — naming the source path and line and never the content. Nothing is ever executed, sourced, word-split, glob-expanded, evaluated, or shelled out; no environment is read; no network is used. The credential firewall is name-first: a credential-shaped name is recognised **before** its value is examined, the parser stops at the name, discards the remainder of the line without parsing or validating it, and the only representable credential artifact is a reference — a literal source-key name or an environment-prefixed suffix. Mapping is literal-to-literal under the closed table in Appendix E; a recognised name whose value cannot be mapped is disclosed **by name** and omitted, as is an unrecognised name, because omission cannot silently change a declared value while the operator sees the list. The default output is the proposed document on stdout: one YAML document carrying the proposed `provider` branch with deterministic key order, a header comment naming the sources and the unmapped names (names only), validated by the delivered provider validator and configuration schema before printing; a proposal that fails validation refuses `proposal-invalid` rather than handing the operator an invalid document. The translation report — sources read with byte counts, mapped names, unmapped names, absent sources — goes to the diagnostic stream in human mode and into `data.report` in machine mode. `--write` creates the project-committed document only when it does not exist; an existing document refuses `target-exists` and is never modified, and no prior-identity, project-local, or other document is ever the target. **The supported posture for the hook is stated plainly: it is read as a parameters file only.** The shipped hook example is a program (driver loop, condition functions, cap), so it refuses as `shell-construct`; hook users receive a refusal naming the file and line plus the documented remedy — declare the window, quota endpoint, and credential reference in the provider branch and retire the hook from the path. No hook import is implied anywhere. The command is a **provider-policy** import: it moves no name, path, state root, or artifact, and it is unrelated to the M4-S2 namespace migration and to the install lifecycle's `--migrate` delegation refusal.

- **F-7 — Watch observation freshness.** Each watch target declares `maxAgeSeconds` — a positive integer, default `900`, validated with the rest of the target and refused as `config.value.invalid` naming the key when it is not a positive integer. `PROVIDER_WATCH_CONDITIONS = [clear, quota-exhausted, watch-stale, provider-outage, credential-missing, credential-rejected]` becomes the declared domain of the watch view's `condition`; the delivered values keep their delivered meanings, and `watch-stale` is **watch-only**: it joins no park cause, condition kind, skip reason, or announcement code, and never enters chain resolution or profile eligibility. The predicate is one pure function of the injected clock and the supplied observation instant: `ageSeconds = floor((nowMs − observedAtMs) / 1000)` and stale exactly when `ageSeconds >= maxAgeSeconds`, the bound being the first stale value in the repository's established convention. A stale view reports `watch-stale` with the observed instant, the computed age, and the declared bound; it is never coerced to `clear`, never reported as `provider-outage` (a stale reading has evidence; an outage has none, and their remedies differ), and never silently dropped. The view gains three additive fields — `observedAt`, `ageSeconds`, `maxAgeSeconds` — beside the delivered `name`, `condition`, `source`, and `checkedAt`; `checkedAt` keeps its meaning ("when the command read") and `source` stays the delivered string. A park created from a watch observation expires no later than `observedAt + maxAgeSeconds × 1000` (`expiresAt = min(naturalExpiry, bound)`); when that instant is not strictly in the future, no park is created and the observation is reported `watch-stale`, the failed-condition shape the delivered quota `reset_missing` case already established. No park cause, skip reason, announcement code, error identity, command, cache, timer, or quota freshness key is added. The delivered live composition supplies the read instant as the observation instant, so its age is zero and it never reports `watch-stale`; the predicate exists so that any composition supplying a retained observation cannot present it as clear, and so that a park cannot outlive the reading that justified it — this is stated rather than implied as everyday detection.

- **F-8 — Declared conformance and documentation truth.** The change moves in one increment: the three new provider rows (`provider.peak.zone-unknown`, `provider.budget.exceeded`, `provider.migrate.refused`, all `user`, non-retryable, `not_landed`, `user-validation`, exit `1`), the `provider` kind from 13 to 16 rows, the machine and documented table totals, the sync-suite arithmetic, and one true-positive corpus row per new code; the provider vocabulary members and evidence allowlists declared in DM-8; the provider reference page entries for the two new subcommands; and every delivered page this change falsifies, including the pages that restate the error-table counts outside the gated table. The provider family count is unchanged at 26 and the two-segment allowlist is unchanged at 66, because none of the three new codes is a kind-first two-segment identity. The affected-component section names every page, every count, and the decision-index obligation; the documentation work is bound to one acceptance criterion rather than left to a later sync.

## 6. USER & SYSTEM FLOWS

```
Flow 1: A declared local peak window
  Operator declares peak.timezone: Europe/Berlin with 08:00–18:00 local and a buffer.
  → configuration validates the grammar; the composition resolves the zone through the
    injected port. A zone the runtime cannot resolve refuses provider.peak.zone-unknown
    at exit 1 naming the field, before any evaluation; no park and no announcement.
  → outside the window: clear. Inside: a peak-window park whose expiry is the earliest
    instant at or after 18:00 local, correct across a transition.
  → the park and its announcement carry timezone: Europe/Berlin; the cause, condition
    kind, skip reason, and announcement code are exactly the delivered ones.
  → the daemon watcher computes the same instant from the same boundary function, so
    the lane parks and resumes when the admission gate said it would.

Flow 2: A trailing-window ceiling
  Operator declares provider.budgets.spend-per-day { scope: window, basis: cost,
  ceiling: 40, windowSeconds: 86400 }.
  → one verified spend read projects the window's cost, tokens, and newest observation.
  → measured 40.00 (>= 40) → the subscription entry is parked with cause
    budget-exhausted and expiry = newestAt + 86400s, strictly future. Announcement
    provider.budget.parked (info) carries budgetName, budgetScope, budgetBasis,
    budgetMeasured, budgetCeiling.
  → a paid entry in the chain is NOT selected to escape the park; the decision is
    parked and resumes automatically at the computed instant with no operator action.

Flow 3: A per-ticket ceiling
  Operator declares provider.budgets.ticket-cap { scope: ticket, basis: cost, ceiling: 200 }.
  → measured 200.00 (>= 200) → the entry is a failed entry, skipped with reason
    budget-exhausted, announced provider.budget.crossed (warning), and no park exists.
  → no later entry is eligible and no honest contributing park supplies an expiry →
    provider.budget.exceeded at exit 1, naming the budget, its scope, its basis, the
    measured figure, and the ceiling, and stating that the ceiling cannot reopen.

Flow 4: A repository overrides the machine's policy
  The machine declares a chain and a ceiling in user-global configuration.
  → the checkout's project-committed document declares a different chain and a
    different ceiling; both win.
  → the workstation's project-local document declares a third ceiling; it wins over
    committed. `config debug` reports the winning layer, file, and line for each key.
  → the repository's document declares an invalid budget scope → the run refuses
    provider.chain.invalid naming the field; the machine value is not silently used.
  → in CI, the committed policy is read and project-local is reported ci-disabled.

Flow 5: Replaying a decision offline
  Operator authors a fixture: now, chain, credential outcomes, per-entry quota
  responses, spend points, zone offsets.
  → provider simulate --fixture scenario.json composes the delivered engine with the
    fixture seams and calls resolve with persist: false.
  → data is the delivered resolve payload plus simulation { stateWrites: 0, ... }.
  → 0 state writes, 0 credential resolutions, 0 network calls, 0 spawns. Two runs of
    the same fixture are byte-identical. Feeding the same facts through resolve yields
    the same decision (parity test).

Flow 6: Migrating off the legacy shell policy
  Operator runs provider migrate legacy.
  → the reader parses the profile directory and the hook as data under the
    assignment-only grammar. Discovery is bounded; an absent source is reported.
  → an unsupported construct refuses the whole run as provider.migrate.refused at
    exit 1 with shell-construct or dynamic-value, naming file and line; stdout is
    empty and nothing is written.
  → credential-shaped names are recognised before their values; only references
    appear. A canary value never appears anywhere.
  → a valid source yields a validated provider branch on stdout, with unmapped names
    listed by name. The operator reviews it and merges it by hand, or uses --write
    when no project-committed document exists yet.
  → the shipped hook example refuses as shell-construct; the operator is given the
    documented remedy (declare the window, quota endpoint, and credential reference
    in configuration; retire the hook from the path).

Flow 7: An aged watch observation
  A composition supplies an observation with observedAt 20 minutes ago and the target
  declares maxAgeSeconds: 900.
  → ageSeconds = 1200 >= 900 → condition watch-stale, with observedAt, ageSeconds,
    and maxAgeSeconds on the view. Never clear; never provider-outage.
  → a natural park learned from that reading would have expired 5 minutes ago, so no
    park is created. A reading 5 minutes old (age 300) may create a park, but its
    expiry is clamped to observedAt + 900s.

Flow 8: A delivery with the legacy policy disabled
  The fixture home has no ~/.<priorWorkingName>/config/profiles directory and no hook.
  → provider policy resolves from configuration; provider resolve, provider quota,
    provider watch status, and provider simulate all behave normally.
  → a recording file-access stub observes zero reads of either legacy path, and the
    delivery proceeds. Nothing was migrated, deleted, or executed.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The declared zone grammar (`UTC` default and alias, IANA names), the retirement of the closed UTC-only set, the `ProviderZonePort`, the local-seconds evaluation, the bounded fixed-point expiry, the declared DST rule, and the shared basis for engine gate, profile gate, and daemon watcher.
- The `timezone` evidence field and the widened `timezone` value domain, with unchanged cause, condition kind, skip reason, announcement code, and MAX/tie semantics.
- The `provider.budgets` branch with its six keys and fail-closed semantic validation; the pure `evaluateBudgets`; the injected read-only `ProviderSpendTotalsPort` and the one ref-scoped read that projects every requested scope; the window-park and ticket-refusal split; the expiry formula; the `budget-exhausted` condition kind, park cause, and skip reason; the two budget announcements; the five evidence fields; the terminal `provider.budget.exceeded` identity; the MAX/tie insertion; and the no-paid-substitution rule.
- The per-repository clause, the identity statement, the precedence matrix for descriptor, chain, profile, watch target, and budget, the origin evidence, the invalid-repository-layer refusal, the `CI=true` and selected-file posture, and the declared multi-checkout boundary.
- The runtime-independence evidence and the statement that the hook is removed from the path, not from disk.
- `provider simulate` with its grammar, its strict versioned fixture schema, its composition over the delivered engine with `persist: false`, its zero-effect guarantee, its additive `simulation` payload block, its exits, its refusals, and its parity contract.
- `provider migrate legacy` with its grammar, its bounded single read of each source, its assignment-only subset, its whole-run typed refusal and closed reasons, its name-first credential firewall, its literal-to-literal mapping table, its unmapped disclosure, its validated proposal, its create-only `--write`, its report, and its declared hook posture.
- The per-target `maxAgeSeconds`, the watch-only closed condition set including `watch-stale`, the single freshness predicate, the park clamp, the no-park-from-stale rule, and the three additive view fields.
- The declared conformance surface: three provider rows, the moved error-table counts and corpus, the vocabulary and evidence-allowlist movements, the provider reference page additions, and every delivered page this change falsifies.
- The operator guides named in §16, including the retirement of the hook from the documented path.

### 7.2 Out of Scope

- [OUT] Windows crossing local midnight, per-window calendars, holiday rules, and date arithmetic.
- [OUT] Fixed-offset zone declarations, a vendored tz database, a pinned tz data dependency, or a network zone lookup.
- [OUT] Any persisted budget counter, budget state record kind, budget projection document, or per-lane/per-role budget dimension.
- [OUT] A hard real-time spend cap, mid-spawn interruption, or retroactive charge-back.
- [OUT] A project registry, project key, host-store policy, per-queue policy, or policy inheritance between repositories (M4-S5).
- [OUT] Any watch-driven admission gate, watch snapshot retention, cache, refresher, scheduler, or new watch command.
- [OUT] Executing, sourcing, emulating, or importing the legacy hook, and importing vendor-specific helper behaviour.
- [OUT] Writing, moving, or deleting any legacy file; merging the migration proposal into an existing configuration document.
- [OUT] A textual diff between two simulations, a `simulate --against` comparison, and a `simulate init` generator.
- [OUT] A new alarm kind, notification channel, event topic, subscription, scheduler, or persisted alarm state.
- [OUT] A new command family, a new state record kind, a new store write path, or a new environment variable.
- [OUT] Any change to the delivered spend read side or the metrics report beyond the documentation statement that the gate consumes the same fold.
- [OUT] Agent-prompt or command-definition changes (M4-S7) and shell-wrapper rewrite (M4-S8).
- [OUT] Any install, release, packaging, or artifact change.
- [OUT] Policy shared across several checkouts of one project.

### 7.3 Deferred / Maybe-Later

- A crossing-window form (split windows or an explicit crossing flag) as a separate semantic extension with its own decision.
- An explicit fixed-offset declaration for a provider that genuinely prices a literal offset — an additive variant, not this change's model.
- A pinned tz database as a dependency if host zone data proves materially variable across supported runtimes.
- Per-lane or per-role budget dimensions as a dimension on the existing spend read.
- A budget read surface of its own (an operator asking which ceiling is closest).
- A `simulate --against <fixture>` comparison and a fixture generator.
- A watched-observation write cadence, if a future composition retains snapshots.
- Merging a migration proposal into an existing configuration document, which needs a YAML writer with provenance.
- Tuning the 900-second watch default if operators find it wrong in both directions.
- Any project-keyed policy layer, decided with M4-S5's project identity.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. No HTTP surface is added or changed. The quota transport, its normalization, and the credential-port handoff are exactly as delivered. The affected surface is the provider command grammar and its payload shapes:

| Invocation | Outcome | Exit | Writes |
|---|---|---|---|
| `provider resolve [--chain <name>] [--profile <name>]` | Delivered decision semantics, now on the declared zone basis and with budget conditions in the MAX combination; persists changed park generations and new announcement identities when a store is injected | `0` selected; `2` parked; `1` classified decision failure | Delivered park/announcement records and the projection only when park truth changed; 0 writes on the budget evaluation itself |
| `provider quota [--provider <name>]` | Delivered per-provider condition views and announcements, now on the declared zone basis | `0` read; `1`/`2` delivered classification | None |
| `provider parks list [--all] [--provider <name>]` | Delivered folded park views; evidence may now carry `timezone` and the five budget fields | `0`; delivered state failure otherwise | None |
| `provider profile resolve [--agent <name>] [--for-spawn]` | Delivered selection, switch, revert, pacing, and env record; windows now on the declared zone basis | Delivered `0`/`1`/`2` | Delivered profile-target record only on change |
| `provider watch status [--provider <name>]` | Delivered live read; condition is the closed watch domain; a composition-supplied observation can report `watch-stale`; the view carries `observedAt`, `ageSeconds`, `maxAgeSeconds` beside the delivered fields | `0` read; delivered classification otherwise | None |
| `provider simulate --fixture <path> [--json]` | The delivered resolve payload plus one additive `simulation` block, with `stateWrites: 0` and the consumed seams disclosed | `0` selected; `2` parked or fully skipped; `1` fixture or invocation defect, or classified decision failure | **None** (no state write, no fence, no derived document, no credential resolution, no network, no spawn) |
| `provider simulate` without `--fixture`, with a missing value, or with an unreadable/oversized/malformed/unknown-key/bad-version fixture | `input.value.rejected` at exit `1` with a bounded summary naming the field; nothing is evaluated | `1` | None |
| `provider simulate --chain <name>` / `--profile <name>` / `--all` / any positional | Delivered grammar refusal `fallback.invocation` | `1` | None |
| `provider migrate legacy [--profiles-dir <dir>] [--hook <path>] [--write] [--json]` | The validated proposal on stdout (human) or in `data.proposal` with `data.report` (machine); without `--write` nothing is written | `0` when a proposal is produced; `1` on `provider.migrate.refused` | None, unless `--write` creates the project-committed document (create-only) |
| `provider migrate legacy --write` with the project-committed document absent | Creates that one document with the validated proposal | `0` | Exactly one new file |
| `provider migrate legacy --write` with the project-committed document present | `provider.migrate.refused` with reason `target-exists`; the document is not read for merge and never modified | `1` | None |
| `provider migrate legacy` with neither source present | `provider.migrate.refused` with reason `no-source` | `1` | None |
| `provider migrate legacy` on any unsupported construct | `provider.migrate.refused` with one closed reason, naming the source path and line and never the content; stdout empty | `1` | None |
| `provider migrate legacy --write --json` | Machine payload carrying `proposal`, `report`, and the written path | `0` / `1` as above | As above |
| `provider <unknown-subcommand>` | Delivered grammar refusal `fallback.invocation` | `1` | None |
| `provider simulate --help`, `provider migrate --help`, `provider migrate legacy --help`, and the family help | Static-inventory help with usage, options, examples, exit codes, and see-also | `0` | None |

Flags owned by the new members: `--fixture <path>` (simulate, required); `--profiles-dir <dir>`, `--hook <path>`, `--write` (migrate legacy). Global `--json`, `--verbose`, and `--pretty` behave exactly as on every other family. The provider family keeps its existing five members and gains exactly two; no flag on a delivered member changes.

### 8.2 Events / Messages

The only new event vocabulary is two announcement codes on the delivered announcement channel: `provider.budget.parked` (severity `info`) and `provider.budget.crossed` (severity `warning`). They are projected through the delivered announcement evidence allowlist, which inherits the park fields and gains the five budget fields. No ledger event kind, taxonomy version, topic, subscription, or payload shape is added; budget parks and their announcements persist through the delivered `provider.park` and `provider.announcement` record kinds. `watch-stale` is a view condition, not an event, and produces no announcement because it parks nothing. Simulation produces no record and no announcement outside its own payload. Migration produces no event. The delivered announcement identity rule (deterministic from subject kind, subject name, code, and park generation) is unchanged, so an unchanged budget condition never appends a duplicate.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Zone model and `ProviderZonePort` | `PROVIDER_DEFAULT_ZONE = "UTC"` (the alias of `Etc/UTC`) plus a declared IANA-name pattern replace the closed UTC-only set. `ProviderZonePort` is `isKnownZone(zone)` and `offsetSecondsAt(zone, atMs)`, declared in core contracts and implemented once in the new adapters time-zone subpath over the runtime's zone data. `ProviderPeakWindow.timezone` becomes a string whose existence is resolved at the edge. `UTC` requires no port; a non-UTC declaration in a composition without the port refuses. No persisted value and no state change |
| DM-2 | Budget declaration (`provider.budgets.<name>`) | Record map child with `enabled` (boolean, default `true`), `scope` (`ticket` \| `window`, required), `basis` (`cost` \| `tokens`, required), `ceiling` (positive number, required; crossing at `>=`), `windowSeconds` (positive integer, required iff `window`, refused for `ticket`), `entries` (non-empty list of declared descriptor names; absent = every declared entry). Fail-closed semantic validation names the offending field and fails as `provider.chain.invalid` |
| DM-3 | `ProviderSpendTotalsPort` | One declared read-only port: input `{ workItemRef, scopes: [{ scopeKey, fromMs }] }`; output either `{ status: "measured", totals: [{ scopeKey, cost, tokens, newestAtMs }] }` or `{ status: "empty" }` (verified-empty telemetry). Implemented at the composition edge over one verified spend read and the delivered fold; returns `O(declared budgets)` and no per-record data. `newestAtMs` is null only when no observation contributes. A failed read returns the delivered `state.*` failure and the decision refuses with that identity |
| DM-4 | Budget park and refusal facts | Park: cause and condition kind `budget-exhausted`, expiry `newestAtMs + windowSeconds × 1000` (strictly future by construction), evidence `budgetName`, `budgetScope`, `budgetBasis`, `budgetMeasured`, `budgetCeiling`. Refusal: `provider.budget.exceeded` with the same facts in its safe summary and the statement that the ceiling cannot reopen. No persisted counter and no derived document |
| DM-5 | Simulation fixture (`delivery.provider.simulate.v1`) | Strict JSON facts document: `schemaVersion` (exact), `now` (ISO instant with an explicit zone), optional `chain`, optional `profile`, optional `credentials` (reference name → `resolved` \| `missing` \| `rejected`; no value field exists), optional `quota` (entry name → `{ httpStatus, body }` or `{ transport: "outage" }`), optional `spend` (`{ telemetryState: present \| absent, points: [{ atMs, cost, tokens }] }`), optional `zones` (zone → ordered `[{ fromMs, offsetSeconds }]`). Unknown keys refuse. Arrays keep declared order; object keys are canonicalised before evaluation. Read once under a declared byte cap |
| DM-6 | Simulation payload block | `data.simulation = { fixturePath, fixtureSchemaVersion, now, stateWrites: 0, inputs: { credentials, quota, spend, zones }, summary: { decision, providerName?, parkCause?, resumeAt?, skippedCount, announcementCodes[] } }`, appended after the delivered resolve keys in their delivered order. Bounded and deterministic |
| DM-7 | Migration proposal and report | Proposal: one YAML document carrying only the proposed `provider` branch, deterministic key order, a header comment naming sources and unmapped names (names only), validated by the delivered provider validator and configuration schema before output. Report: sources read with byte counts, mapped names, unmapped names, absent sources; on the diagnostic stream in human mode and in `data.report` in machine mode. No generator metadata beyond a schema pointer |
| DM-8 | Vocabulary and evidence growth | Condition kinds 5 → 6 (`budget-exhausted`); park causes 7 → 8; skip reasons 8 → 9; announcement codes 11 → 13 (`provider.budget.parked`, `provider.budget.crossed`); park evidence allowlist 8 → 14 (`timezone` plus the five budget fields); announcement evidence allowlist 11 → 17 through its base projection; the condition tie order becomes `peak-window`, `quota-exhausted`, `budget-exhausted`, `provider-outage`, `credential-missing`, `credential-rejected`. One new closed watch-only set `PROVIDER_WATCH_CONDITIONS` with six values. No other member is renamed, removed, or re-meant |
| DM-9 | Provider error rows | `provider.peak.zone-unknown`, `provider.budget.exceeded`, `provider.migrate.refused`: all category `user`, non-retryable, consequence `not_landed`, projection `user-validation` (exit `1`). None is a kind-first two-segment identity, so the closed allowlist stays at 66. The provider kind moves 13 → 16 rows |
| DM-10 | Provider CLI grammar | Two additive members of the existing family: `simulate --fixture <path> [--json]` and `migrate legacy [--profiles-dir <dir>] [--hook <path>] [--write] [--json]`. Grammar is validated before any read, probe, credential resolution, or write; unknown flags, unknown subcommands, and positionals refuse `fallback.invocation`. Family count unchanged at 26 |

### 8.4 External Integrations

One host capability is consumed and no network dependency is added: the runtime's own `Intl` time-zone data, read only inside the new adapters time-zone subpath, only when a non-UTC zone is declared, and never by core policy. The quota HTTP transport is delivered and unchanged; simulation replaces it with fixture facts and performs no request; migration performs no request and no child process. No vendor, tracker, credential, or analytics flow is added. A runtime with reduced zone data is a supported, declared state: a zone it cannot resolve is refused by name.

### 8.5 Backward Compatibility

- **Every delivered declaration validates unchanged.** `UTC` remains the default and is now the alias of `Etc/UTC`; a window that declared `UTC` and no zone resolves exactly as before, its park carries the same cause, condition kind, skip reason, announcement code, and expiry, and its evidence gains only the `timezone` field whose value is `UTC`.
- **The peak basis widens without changing the boundary rule.** `startSecondsOfDay`, `endSecondsOfDay`, the non-negative buffer clamp, the half-open interval, the no-crossing rule, duplicate refusal, overlap-validates, and the derived grace bound keep their delivered meaning, now read as local seconds in the declared zone.
- **Nothing about availability regresses.** Chain order, subscription-first ordering, paid-fallback discipline, the MAX rule, the fixed tie order, the park invariant, the `chain-exhausted` union, the `reset_missing` failed-entry shape, announcement identity and dedupe, and the projection are unchanged. A budget condition can only add a park or a refusal when a budget is declared; an installation with no budget behaves exactly as delivered.
- **The watch condition field narrows from an open string to a closed domain.** The six values are exactly the delivered condition meanings plus `watch-stale`; the delivered live read still produces `clear`, `quota-exhausted`, `provider-outage`, `credential-missing`, or `credential-rejected` in exactly the cases it did.
- **The error table stays additive.** Three rows are added to the `provider` kind; no delivered row is renamed, reworded, or re-projected; the projection module remains the only exit-digit site; the two-segment allowlist is unchanged because none of the additions is a kind-first two-segment code.
- **The command surface is additive.** The provider family keeps its five members with their flags and payloads, and gains two. Nothing else in the composed program changes, and the prompt-required family count stays at 26.
- **The simulation payload is additive by construction.** It is the delivered resolve payload plus one block; no delivered key is renamed, removed, re-ordered, or re-typed, and `resolve` itself is unchanged by the presence of the simulate surface.
- **The migration command writes nothing unless asked, and only a new document.** No legacy file is written, moved, or deleted; the hook keeps its file and loses only its place on the path.
- **The delivered spend and metrics surfaces are untouched.** The gate consumes the same fold; the burn-rate alarm keeps its declaration node, its post-hoc role, and its absence of persisted state.
- **Retired statement.** The claim that the provider basis is UTC-only, that non-UTC windows are not modeled, and that provider policy depends on shell profiles or the hook becomes false in this change, and every page that states it is corrected in this change (§16).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Pure-core neutrality | 0 `Intl`, `TZ`, ambient-clock, environment, filesystem, or network references inside `packages/core/provider`; zone facts arrive only as injected values; the ambient-globals boundary check is green with a negative fixture that fails on an injected zone reference |
| NFR-2 | Determinism | Identical configuration, injected clock, and injected facts produce byte-identical decisions, parks, expiries, announcements, watch views, simulation payloads, and proposals; 0 ambient inputs; 0 differences between two runs of one fixture or one source set |
| NFR-3 | DST correctness | 0 cases where the computed expiry differs from the earliest instant at or after the declared local end, across spring-forward, fall-back, both hemispheres, a no-transition window, and a buffer edge; a skipped local second resolves to the transition instant and a repeated one to its first occurrence; at most 3 fixed-point passes |
| NFR-4 | One boundary truth | 0 decisions differing between the engine gate, the profile gate, and the daemon watcher for identical facts, asserted on the same fixture table |
| NFR-5 | Zone refusal | 0 syntactically valid but unresolvable zones evaluated as UTC; 0 parks or announcements produced by a zone refusal; 1 typed identity naming the field; 0 non-UTC declarations silently accepted by a composition without the port |
| NFR-6 | Budget honesty | 0 budget parks with a non-future, absent, or guessed expiry; 0 ticket-scope crossings presented as parks; 0 parks created when `newestAtMs` is null and the measured figure is at or above the ceiling |
| NFR-7 | Budget measurement identity | 0 differences between the budget's measured figure and `spend --ref` for the same selection and instant; exactly 1 spend-totals read per evaluation regardless of declared budget count; 0 per-record data crossing the port; 0 state writes on the evaluation path |
| NFR-8 | Pre-spawn bound, stated | The gate is pre-spawn: at most one spawn increment may land above a ceiling before the next evaluation observes the new records; the bound is stated in the specification and in the operator guide, and 0 documents claim a hard real-time cap |
| NFR-9 | No paid escalation | 0 paid entries selected while any subscription entry is parked for `budget-exhausted`; the delivered peak rule is unchanged |
| NFR-10 | Simulation fidelity and purity | 0 decision differences between `simulate` and `resolve` for identical facts; 0 state writes, network calls, credential resolutions, and child spawns during simulation; 0 accepted unknown-key, bad-version, oversize, or credential-shaped fixtures; byte-identical repeats; `data.simulation.stateWrites` is exactly `0` on every payload |
| NFR-11 | Migration safety | 0 executions, sources, word-splits, glob expansions, `eval`s, or child processes; 0 canary credential strings in stdout, stderr, the envelope, diagnostics, or any written file; 0 refusals that emit a proposal or write; 0 emitted proposals rejected by `config`; 0 runtime reads of the legacy paths |
| NFR-12 | Migration determinism and bounds | Byte-identical output for identical source bytes; each source read once under declared file, byte, and line caps; an oversize source refuses rather than degrading; 0 path or file content echoed in a refusal |
| NFR-13 | Watch freshness | 0 aged observations reported `clear` or `provider-outage`; 0 parks expiring after `observedAt + maxAgeSeconds × 1000`; 0 parks created from an already-stale observation; 0 state writes on the watch path; 0 new caches, timers, or commands |
| NFR-14 | Configuration-only policy | 0 provider-policy inputs from a shell profile, the hook, an environment-variable convention, or a hidden file at runtime; policy resolves with both legacy paths absent; under `CI=true` the committed policy resolves and project-local is `ci-disabled` |
| NFR-15 | Error-table synchronisation | Provider rows 13 → 16, table total 164 → 167, documented rows 163 → 166, sync arithmetic `BASELINE_ROWS.length + 130` → `+ 133`; the result-code corpus gains one true-positive row per new code, following the delivered per-change convention; two-segment allowlist unchanged at 66; 0 delivered rows renamed; the CI sync gate and the aggregate quality gate are green |
| NFR-16 | Documentation truth | 0 delivered pages stating the UTC-only basis, non-UTC-out-of-scope, the outgoing counts (164 / 163 / 66 / `+130`), or that provider policy depends on shell profiles or the hook as current truth; every page and guide named in §16 reconciled in this change; the documentation conformance checks green |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- **A cost decision is attributable to configuration.** Every budget park and refusal names the budget, its scope, its basis, the measured figure, and the ceiling, and the park carries an expiry that is the instant the trailing window releases. An operator answers "why did this not spawn?" and "when does it resume?" from the payload, without reading a report.
- **A pause names its clock.** Every park and announcement created from a window carries the declared zone name, so "paused until 18:00 Europe/Berlin" is auditable and a resume time can be checked against the operator's own calendar. The `timezone` field is always the effective declared zone, including the `UTC` default, so absence never implies a basis.
- **A watch reading discloses its age.** The view carries the observed instant, the computed age, and the declared bound beside the delivered fields, and a `watch-stale` line states all three. Nothing claims a fresher observation than the facts support.
- **A simulation discloses what it simulated.** Every payload states the fixture, the schema version, the instant, which seams the fixture supplied (credentials, quota, spend, zones — including `runtime` when the fixture omitted a zone table), the bounded decision summary, and `stateWrites: 0`, so a replay cannot be mistaken for a live decision or for a write.
- **A migration discloses its whole effect.** The report names each source and its byte count, each mapped name, each unmapped name (names only), each absent source, and — with `--write` — the one path written. A refusal names the identity, the reason, the source path, and the line, never the content and never a value.
- **A pre-spawn gate states its own limit.** The path from "measured at or above the ceiling" to "park or refuse" is visible in the decision, and the documentation states that a single spawn can land one increment above the ceiling before the next read sees it.
- No metrics exporter, trace span, event bus, notification channel, or store write is added. No provider output contains a credential, a credential value, an authorization header, or a raw response body.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | A DST transition produces a resume instant an hour early or late, so a park promises a time it cannot honour | H | M | One shared boundary function with one declared rule; a bounded fixed-point expiry; a DST matrix across spring-forward, fall-back, both hemispheres, no transition, and the buffer edge is an acceptance criterion; the engine, profile gate, and watcher are asserted equal on the same table | L |
| RSK-2 | A zone lookup leaks into core, breaking purity and hermeticity | H | L | The port is declared in core and implemented only in one adapters subpath; the ambient-globals check covers the provider tier and gains a negative fixture; zone facts are injected in every test | L |
| RSK-3 | A composition forgets to inject the zone port and silently evaluates local windows as UTC | H | M | A non-UTC declaration in a composition without the port refuses the new identity; every composition is enumerated and tested; `UTC` requires no port so the common case cannot fail | L |
| RSK-4 | The per-spawn spend read is too expensive on a large ledger | M | M | Exactly one ref-scoped read per evaluation, projected to `O(budgets)`; no per-budget re-read; no cache (a stale cache would defeat the gate); the read-cost clause is a recorded revisit trigger with a bounded projection before any cache | M |
| RSK-5 | The budget gate is mistaken for a hard cap and a delivery still lands one increment above the ceiling | M | H | The pre-spawn bound is stated in the specification, the reference material, and the operator guide; the gate is described as a pre-spawn decision, never as real-time enforcement; the measured figure is disclosed on every park and refusal | M |
| RSK-6 | A ticket-scope ceiling presented as a park would fabricate an expiry | H | L | The ticket scope is a terminal classified refusal by decision; a park with a non-future expiry is an acceptance failure; the divergence from the ticket's wording is recorded and surfaced to the owner at review | L |
| RSK-7 | A budget park becomes a cost accelerator by making paid capacity selectable | H | M | A budget-parked subscription entry blocks paid selection in addition to the delivered rule; the case is an acceptance criterion; quota stays the only limit paid capacity may relieve | L |
| RSK-8 | The migration surface executes operator-authored shell | H | L | Data-only grammar with no shell, no `eval`, no substitution, no ambient read; a construct outside the subset refuses the whole run; a canary side-effect test proves nothing ran | L |
| RSK-9 | A credential value moves into a proposal, a diagnostic, or a log | H | L | Name-first classification discards the remainder of the line at the parse boundary; only references are representable; canary fixtures scan stdout, stderr, the envelope, diagnostics, and any written file; security review of that path is mandatory | L |
| RSK-10 | Migration usefulness is lower than hoped because real profiles are not declarative | M | H | The refusal list doubles as operator documentation; the shipped hook is a program and is declared to refuse; the fallback posture — declare policy in configuration and retire the hook — is documented; a naming pattern that proves mechanical can be added only with tests | M |
| RSK-11 | The mapping table guesses legacy names and maps them wrongly | M | M | The table is closed at the names observed in this repository's shipped hook example and guides, every mapping is literal-to-literal, anything unrecognised or unaddressable is disclosed by name and omitted, and no value is computed; extending the table is a recorded decision | M |
| RSK-12 | "Per-project" is read as a project-keyed branch and a second identity appears | M | M | The mechanism is the delivered repository layers; the precedence matrix, origins, invalid-layer refusal, and CI behaviour are acceptance criteria; the multi-checkout boundary and the M4-S5 pointer are declared; no such key exists | L |
| RSK-13 | `watch-stale` is vacuous in the delivered live path and is oversold as everyday detection | M | M | The specification states the live age is zero; the condition is exercised by composition-supplied observations and by the park clamp; the documentation says so; the clamp is an acceptance criterion | L |
| RSK-14 | Simulation drifts from `resolve` and becomes a second evaluator | M | L | The simulate path imports the delivered engine and contains no condition arithmetic; parity for identical facts is an acceptance criterion; a drift is a composition defect, never a fixture change | L |
| RSK-15 | A fixture becomes a policy source or a production input | H | L | No production composition reads a fixture; the reader is reachable only from the simulate composition; a boundary test proves it; a production read is a reopen-the-boundary event | L |
| RSK-16 | The conformance surface is discovered as breakage: rows, counts, allowlist, corpus, page, help entries | M | M | Every moved value is declared in DM-8, DM-9, NFR-15, and §16 and bound to one acceptance criterion; the sync gate and the aggregate gate are green before the pull request | L |
| RSK-17 | A count-bearing page outside the gated table keeps the old numbers and becomes false | M | M | The class rule is declared in §16 and the pages are named; the same edit-set moves the register and every page that restates its numbers; the documentation conformance checks are part of the gate battery | L |
| RSK-18 | The migration mapping table introduces vendor or product literals into committed code | M | M | The targets are the delivered default entry and credential names, so no new vendor class enters beyond the delivered defaults; the table is declared data and its inventory note moves with it; the brand-literal scan stays green | L |
| RSK-19 | The three new rows drift the documented table out of sync | L | L | Three declared rows, all exit 1, all documented with category, retryability, consequence, projection, and remediation; one true-positive corpus row each; the CI sync gate is authoritative | L |

## 12. ASSUMPTIONS

- The six decision records (ADR-0012, TDR-0049, PDR-0006, TDR-0050, TDR-0051, TDR-0052) are the binding design for this change; this specification carries their normative details and does not re-litigate them. All six are `Proposed` and are accepted or rejected by the owner at this change's pull-request review.
- The runtime ships `Intl` zone data with offset history, so a named zone is resolvable without a dependency; a reduced-ICU build can carry less data, and the refusal path is therefore real rather than theoretical.
- The delivered engine, profile gate, and daemon watcher genuinely share one boundary function today, so a basis change reaches all three without a second implementation.
- The provider core is in the ambient-neutral set and a zone read inside it would fail the existing boundary check.
- A ref-scoped spend fold over the expected ledger sizes is affordable once per spawn; the latency figure is a judgement, not a measurement, and the read-cost clause is a revisit trigger. No cache is introduced, because a stale cache defeats the gate.
- Verified-empty telemetry is the honest reading for a ref that has not spent yet, so a fresh ticket evaluates clear rather than being blocked by its own empty budget read.
- Harness-reported cost is sparse and un-repriced, so a cost-basis budget can undercount; the measured figure discloses sparseness in the announcement message rather than zero-filling.
- The current and near-term operating model is one checkout per project, so the repository layer is a sufficient per-project mechanism; the multi-checkout case is declared and belongs to M4-S5.
- The legacy profile directory and hook exist for the pre-freeze working name; their default paths derive from the brand seam and both are overridable.
- The common legacy profile shape is a list of simple assignments, but the shipped hook example is a program; hook migration is therefore expected to refuse in practice, and the specification says so.
- The observed legacy variable names (`OC_ADOS_AGENT_<AGENT>_MODEL`, `OC_ADOS_MODEL_PROFILE`, the `ADOS_ZAI_*` peak/quota controls, and `ZAI_API_KEY`) are the recognisable set for this increment; anything else is disclosed as unmapped rather than guessed.
- The delivered live watch read supplies the read instant as the observation instant, so its age is zero and staleness is exercised by composition-supplied observations and by the park clamp.
- Operators can author a simulation fixture by hand and review a proposed YAML document; no generator is needed for this increment.
- Automation can diff two simulation payloads directly, so no textual diff contract is needed.
- The error-table sync gate, not the aggregate script, is the authority for the table; this change must not add it to `pnpm check`.
- The six decision records and their index rows are authored scope of a delivery-plan phase, not a hand-commit.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Provider engine (delivered, GH-182) | Chain resolution, conditions, MAX and tie order, parks, announcements, the resolve/quota/parks surface, and the injected-seam engine the simulation composes |
| Depends on | Provider profiles and watching (delivered, GH-234) | Profile windows, the watch target shape, the live read and its view, the env record, and the profile CLI members |
| Depends on | Lane peak pausing (delivered, GH-294) | The daemon watcher that consumes the shared boundary functions and must agree with the gate |
| Depends on | Spend read side (delivered, GH-236, GH-299) | The verified ref-scoped fold the budget totals port projects, and the breakdowns the traceability claim cites |
| Depends on | Metrics burn-rate alarm (delivered, GH-299) | The post-hoc alarm that stays distinct from the gate and shares the basis vocabulary |
| Depends on | Seven-layer configuration (delivered, GH-223) | The repository layers, record-map merge, reset, origin grammar, and CI controls the per-repository clause rests on |
| Depends on | Typed-error contract and sync gate (delivered) | Three new rows, the projection module as the only exit-digit site, the moved counts, and the corpus rows the sync suite demands |
| Depends on | CLI provider family, help inventory, and provider reference page (delivered) | Two additive members, their help entries, and the page they extend |
| Depends on | Runtime `Intl` zone data | The one host capability the zone port consumes; no new dependency |
| Depends on | Delivered bounded file reads | The fixture read and the migration source read, both single bounded reads with declared caps |
| Constrained by | Ambient-neutral core boundary | No `Intl`, clock, environment, filesystem, or network in `packages/core/provider` |
| Constrained by | Brand neutrality | Default migration paths derive from the prior working name; targets are the delivered default entry and credential names; no product name is committed |
| Constrained by | Closed-set discipline | Every added vocabulary member is a named extension of an existing closed set; no wildcard, family widening, or second vocabulary |
| Blocks | M4-S5 project registry | A project-keyed provider layer, if ever needed, is decided there; this change deliberately adds none |

## 14. OPEN QUESTIONS

None. Every question the six decision records left to this specification is resolved as a decision in §15, and no undecidable question was found in the ticket, the records, or the delivered contracts:

- ADR-0012's reduced-ICU posture and its `timezone`-on-`UTC`-parks question → DEC-8, DEC-9.
- TDR-0049's sparse-cost disclosure and its per-lane budget question → DEC-10, and NG-5.
- TDR-0050's credential default and its `--against` question → DEC-11, and NG-9.
- TDR-0051's mapping grammar, multi-directory flag, and proposal metadata questions → DEC-13.
- TDR-0052's `source` structure and a future snapshot cadence question → DEC-12, and NG-7.
- PDR-0006's "per-project" wording for M4-S4 → DEC-5.

Nothing in this change depends on a fact this repository does not hold. Where a fact is empirical (real legacy profile contents), the specification's posture is disclosure by name plus refusal, never a guess.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Adopt ADR-0012: `UTC` (default, alias of `Etc/UTC`) plus IANA names; one injected `ProviderZonePort` resolved only at a composition edge; pure offset-aware local seconds-of-day; the declared DST rule with a three-pass cap; `provider.peak.zone-unknown` at exit `1`; the `timezone` evidence field; causes, codes, and skip reasons unchanged; no port means non-UTC refuses. | The only model that makes a local window correct without moving zone data into pure policy, and the only one that refuses rather than silently reinterprets. ADR-0012 is **Proposed**, accepted at pull-request review. | 2026-11-19 |
| DEC-2 | Adopt TDR-0049: the `provider.budgets` branch, one pure `evaluateBudgets` over one injected read-only `ProviderSpendTotalsPort` fed by the delivered fold, no counter and no new state kind, a window park with `newestAtMs + windowSeconds × 1000`, a ticket-scope terminal refusal, `budget-exhausted` vocabulary, the two announcements, the five evidence fields, and no paid escalation. | A gate must measure the same figures the report measures, and a ceiling with no future relief must not be presented as a pause. TDR-0049 is **Proposed**, accepted at pull-request review. | 2026-11-19 |
| DEC-3 | Adopt PDR-0006: per-project overrides are the delivered project-committed and project-local layers; the checkout is the project identity; no `provider.projects.*` surface; the multi-checkout case is M4-S5's. | The behaviour already exists, policy travels with the code, and a branch added now would invent an identity the milestone has not defined. PDR-0006 is **Proposed**, accepted at pull-request review. | 2026-11-19 |
| DEC-4 | Adopt TDR-0050: `provider simulate --fixture <path> [--json]`, the strict `delivery.provider.simulate.v1` schema, `persist: false`, the delivered resolve payload plus one `simulation` block, no second evaluator, no new error row, and a parity test. | The verification bar needs an executable surface, and a reimplementation would drift from the decision it is meant to prove. TDR-0050 is **Proposed**, accepted at pull-request review. | 2026-11-19 |
| DEC-5 | Adopt TDR-0051: `provider migrate legacy`, the assignment-only data grammar, the whole-run `provider.migrate.refused` with seven closed reasons, the name-first credential firewall, the validated proposal, create-only `--write`, and the declared hook posture. Also: the specification restates the requirement as "per-repository (checkout) for M4-S4" and points at M4-S5 for the multi-checkout case. | Safe by construction, reviewable by the operator, and honest about what a declarative reader can and cannot import. TDR-0051 is **Proposed**, accepted at pull-request review. | 2026-11-19 |
| DEC-6 | Adopt TDR-0052: per-target `maxAgeSeconds` (positive integer, default 900), the watch-only closed `PROVIDER_WATCH_CONDITIONS` including `watch-stale`, the single predicate at `>=`, the park clamp, no park from an already-stale observation, and three additive view fields. | Three honest states instead of collapsing an aged reading into `clear` or into a false outage, and no pause that outlives its evidence. TDR-0052 is **Proposed**, accepted at pull-request review. | 2026-11-19 |
| DEC-7 | **Declared divergence from the ticket's wording.** The ticket says budgets "park rather than overspend". This change parks a trailing-window ceiling and answers a per-ticket ceiling with a terminal classified refusal. | A park is defined by an absolute expiry strictly in the future at creation. A trailing window can compute one; a per-ticket ceiling never decreases, so no such instant exists. Presenting it as a park would fabricate an expiry, which is the defect the fail-loud park invariant exists to prevent. The refusal names the budget, the measured figure, the ceiling, and the fact that it cannot reopen. Owner acceptance is requested at pull-request review. | 2026-11-19 |
| DEC-8 | The `timezone` evidence field is carried on **every** park and announcement created from a window, including a `UTC`-default one, and its value is always the effective declared zone name — never an offset and never a locale string. | Absence must never imply a basis. The field is one member of an existing bounded allowlist, and carrying it always keeps the evidence self-describing without a second boolean. | 2026-11-19 |
| DEC-9 | A composition that cannot supply the zone port refuses a non-UTC declaration and never falls back to UTC; there is no bundled fallback zone table. A reduced-ICU host is supported by refusing by name. | The refusal is legible and the alternative is a wrong decision that looks successful. A bundled table would be a second zone-data authority with its own drift. | 2026-11-19 |
| DEC-10 | A cost-basis budget whose harness cost was sparse discloses that sparseness in the `provider.budget.parked` / `provider.budget.crossed` announcement message; no sixth evidence field is added. | The five declared fields answer which budget, which scope, which basis, measured, and ceiling; sparsity is an annotation on the measurement, not a new fact class, and the evidence budget stays minimal. | 2026-11-19 |
| DEC-11 | In a fixture, a credential reference the selected chain needs and the document does not declare defaults to `resolved` and is disclosed in `simulation.inputs`; `missing` produces the delivered credential-resolution failure shape; `rejected` produces the delivered `credential-rejected` condition. No value field exists anywhere. | A minimal fixture must reproduce the happy path, and the disclosure keeps the default from being a hidden fact. The enum makes a credential value structurally impossible. | 2026-11-19 |
| DEC-12 | The watch view's `source` stays the delivered string; the observed instant, age, and bound ride the three additive fields, and a stale view's `source` states the observed instant and the bound without claiming a transport or credential failure. | A structured `source` would be a shape change to a delivered field for no decision that the fields do not already answer. | 2026-11-19 |
| DEC-13 | The migration mapping table is closed at the names observed in this repository's shipped hook example and guides (Appendix E), every mapping is literal-to-literal, a model assignment is addressed by the literal `OC_ADOS_MODEL_PROFILE` value and is disclosed unmapped when that literal is absent, a credential-shaped name yields only a reference, the proposal carries a schema pointer and no generator metadata, and `--profiles-dir` accepts exactly one directory. | The repository does not specify the legacy grammar; a closed table plus by-name disclosure never maps a value it cannot justify, and create-only `--write` keeps authorship and review with the operator. | 2026-11-19 |
| DEC-14 | The conformance arithmetic is declared here: provider rows 13 → 16; machine and documented table 164 → 167; delivered rows 163 → 166; sync arithmetic `+130` → `+133`; one true-positive result-code corpus row per new code, following the delivered per-change convention; two-segment allowlist unchanged at 66; prompt-required families unchanged at 26. | None of the three new codes is a kind-first two-segment identity, so the allowlist does not move; every other value moves exactly as the added rows require. | 2026-11-19 |
| DEC-15 | The ticket's "complete and document `provider resolve\|quota\|parks\|profile\|watch`" is satisfied by the delivered surfaces plus this change's additions, and the documentation work is bound to one acceptance criterion in this change rather than deferred to a later sync. | Four of the five members are delivered and documented; this change completes them and adds two members, so the obligation is a documentation delta inside the same change. | 2026-11-19 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Provider contracts (`packages/core/src/contracts/provider.ts`) | Updated additively — the zone grammar and default, `ProviderZonePort`, budget types, the spend-totals port, `PROVIDER_WATCH_CONDITIONS`, the vocabulary members, the evidence allowlists, and the tie order (F-1, F-2, F-7, DM-1, DM-3, DM-8) |
| Pure provider policy (`packages/core/src/provider/`) | Updated — offset-aware peak arithmetic and the bounded expiry, budget evaluation, condition and chain integration, the watch freshness predicate and the park clamp; new pure modules for budget evaluation, simulation payload assembly, and migration parsing/mapping (F-1, F-2, F-5, F-6, F-7) |
| Zone adapters subpath (`packages/adapters/src/time-zone/`) | New — the single `Intl`-backed `ProviderZonePort` implementation, the only workspace module that reads zone data for provider policy (F-1, DM-1) |
| Spend totals projection | New pure projection at the composition edge over the delivered `readSpendLedger` and spend fold; no new adapters I/O subpath and no state read in core (F-2, DM-3) |
| Configuration catalog (`packages/core/src/config/catalog.ts`) | Updated additively — the `provider.budgets` record map and the watch target's `maxAgeSeconds` (F-2, F-7, DM-2) |
| Provider CLI grammar and handlers (`packages/cli/src/commands/provider.ts`) | Updated — two new members, their help entries, and the closed-domain watch rendering (F-5, F-6, F-7, DM-10) |
| CLI composition edge (`packages/cli/src/edge.ts`) | Updated — injects the zone port and the spend-totals port into the provider composition, supplies the watch observation instant, composes the fixture read, and composes the migration reader; the daemon and host compositions inject the same zone port (F-1, F-2, F-5, F-7) |
| Typed-error register and projection | Updated additively — three provider rows; the projection module is unchanged (DM-9, NFR-15) |
| Error-table sync surface | Updated — the moved totals, the declared arithmetic, and one true-positive corpus row per new code (NFR-15) |
| Help inventory and provider reference page | Updated — family help lists two new members; the provider page gains their sections; the page-root mapping and the family count are unchanged (F-8) |
| System specification pages | Updated — provider engine, provider profiles, peak pausing, config layer, spend, metrics, result contract, and the nonfunctional page (F-8, NFR-16) |
| Operator guides | Updated — the conditions-and-parks guide gains the new members, zone basis, and watch-stale; the Z.AI hook guide retires the hook from the path and points at configuration plus migration; the model-configuration guide points at typed profiles as the canonical policy (F-4, F-8) |
| `doc/decisions/` | **Authored scope** — the six decision records (ADR-0012, TDR-0049, PDR-0006, TDR-0050, TDR-0051, TDR-0052) and their `doc/decisions/00-index.md` rows land **with the plan phase scope**, not as a hand-commit; the delivery plan declares `doc/decisions/**` in the authored paths of that phase |
| Documentation index | Updated — the guide and page inventory rows whose descriptions state the old provider limits (NFR-16) |
| Milestone planning pack | Updated — the M4-S4 story marker and the flip-plan F2 evidence pointer name the delivered surfaces; no design change |
| Delivered behaviour unchanged | Chain resolution, quota evaluation, parks, announcements, profiles, pacing, the env record, spend, metrics, lane peak pausing, config precedence, the harness spawn-env seam, the install lifecycle, and every other composed family |

**Technical architecture and codebase map (exact paths).** Core declares types and pure policy and performs no I/O; adapters implement the two injected edges; the CLI composes. The map is the contract the plan allocates across phases, not an implementation sequence.

| Path | Placement | Responsibility in this change |
|---|---|---|
| `packages/core/src/contracts/provider.ts` | Core contracts | Zone grammar and default zone, `ProviderZonePort`, budget declaration and evaluation types, `ProviderSpendTotalsPort`, the watch condition set, the vocabulary and evidence-allowlist members, and the tie order (F-1, F-2, F-7; DM-1, DM-2, DM-3, DM-8) |
| `packages/core/src/provider/peak.ts` | Pure policy | Offset-aware local seconds-of-day and the bounded fixed-point expiry; `peakWindowOpenSeconds` and `peakWindowEndSeconds` keep their names and remain the one boundary truth (F-1; Appendix B) |
| `packages/core/src/provider/peak-rules.ts` | Pure policy | Profile `peakWindows` validation: grammar-only zone check plus the same local basis (F-1) |
| `packages/core/src/provider/validate.ts` | Pure policy | Descriptor `peak` zone grammar and the fail-closed `provider.budgets` semantic validation (F-1, F-2; DM-2) |
| `packages/core/src/provider/budgets.ts` | Pure policy (new module) | `evaluateBudgets`: comparison, park/refusal outcome, expiry arithmetic, and evidence assembly over injected facts and the injected clock (F-2; DM-4) |
| `packages/core/src/provider/conditions.ts` | Pure policy | MAX combination with the inserted `budget-exhausted` tie position (F-2; DM-8) |
| `packages/core/src/provider/chain.ts` | Pure policy | Eligibility, `budget-exhausted` skip reason, chain-park union, and the no-paid-escalation condition (F-2) |
| `packages/core/src/provider/quota.ts` | Pure policy | The watch freshness predicate and the park clamp beside the delivered watch reader (F-7; Appendix F) |
| `packages/core/src/provider/simulate.ts` | Pure policy (new module) | Fixture schema validation and payload assembly; imports the delivered engine and contains no condition arithmetic (F-5; DM-5, DM-6) |
| `packages/core/src/provider/migrate.ts` | Pure policy (new module) | The bounded declarative reader, the name-first credential classification, the literal-to-literal mapper, and the proposal builder; no child process, shell, or ambient read (F-6; DM-7, Appendix E) |
| `packages/core/src/config/catalog.ts` | Core configuration | The `provider.budgets` record map and the watch target's `maxAgeSeconds` (F-2, F-7; DM-2) |
| `packages/core/src/state/spend-reads.ts` | Core state read | Consumed as delivered: the one verified ref-scoped read the totals projection folds (F-2; DM-3) |
| `packages/adapters/src/time-zone/index.ts` | Adapters edge (new subpath) | `createIntlZonePort`: the only module that reads zone data for provider policy; no I/O, network, or extra environment read (F-1; DM-1) |
| `packages/adapters/src/file/` | Adapters edge (delivered subpath) | The bounded single reads used for the simulation fixture and the migration sources; no read is added to any delivered composition (F-5, F-6) |
| `packages/cli/src/commands/provider.ts` | CLI | Grammar and handlers for the two additive members, and the closed-domain watch rendering (F-5, F-6, F-7; DM-10) |
| `packages/cli/src/edge.ts` | Composition edge | Injects the zone port and the spend-totals port into the provider composition, supplies the watch observation instant, and composes the fixture and migration reads; the daemon and host compositions inject the same zone port (F-1, F-2, F-4, F-5, F-7) |
| `scripts/hooks/pre-opencode-iteration-zai.sh` | Reference only | The shipped hook example the migration refuses as `shell-construct`; never executed, sourced, imported, or modified (F-6) |
| `doc/spec/features/`, `doc/guides/`, `doc/planning/oss-tooling/milestones/m1/commands/provider.md`, `doc/decisions/` | Documentation | The obligations table below, the reference page, and the six decision records with their index rows (§16, F-8) |

**Documentation obligations of this change.** The documentation work is part of the change, not a follow-up, and it is bound to one acceptance criterion (§17, AC-F8-3):

| Document | Obligation |
|---|---|
| `doc/spec/features/feature-provider-engine.md` | The zone domain and default, the port and the edge, the local-seconds evaluation and the DST rule, the `timezone` evidence field, the budget branch and its evaluation, the `budget-exhausted` members, the two budget announcements, the five budget evidence fields, the budget error row, the new tie order, the no-paid-escalation rule, the two new CLI members, and the gate-versus-alarm distinction |
| `doc/spec/features/feature-provider-profiles.md` | The zone domain on profile `peakWindows` (replacing every "UTC only" statement), the watch `maxAgeSeconds` key, the closed watch condition set and `watch-stale`, and the additive view fields |
| `doc/spec/features/feature-peak-pausing.md` | The shared zone basis for the daemon watcher and the gate, the DST rule, and the removal of the UTC-only declaration |
| `doc/spec/features/feature-config-layer.md` | The `provider.budgets` branch table, the watch `maxAgeSeconds` key, the widened zone value domain, and the per-repository clause with the precedence matrix, origin evidence, and CI posture |
| `doc/spec/features/feature-spend.md` | The statement that the budget gate consumes the same fold and reports the same figures, with one basis and no second measurement path |
| `doc/spec/features/feature-metrics.md` | The gate-versus-alarm distinction, the moved error-table counts, and the unchanged mounted family count |
| `doc/spec/features/feature-result-contract.md` | The three provider rows with category, retryability, consequence, projection, and remediation; the `provider` kind at sixteen rows; the table at 167; delivered rows at 166; the sync arithmetic at `+133`; the allowlist explicitly unchanged at 66; and, where the page or its fixtures name the result-code corpus, one added true-positive row per new code |
| `doc/spec/nonfunctional.md` | The provider row gains the zone/DST correctness, the budget read bound, the simulation purity, and the migration no-execution guarantees; any count it restates moves |
| `doc/spec/features/feature-ceremony-runner.md` | Every restatement of the error-table totals moves to 167 / 166 / 66 / `+133` |
| `doc/spec/features/feature-install-lifecycle.md` | Its conformance paragraph restates the table total and the allowlist; the total moves to 167 and the allowlist stays at 66 |
| `doc/spec/features/feature-supervise.md` | Its allowlist restatements stay at 66 and need no change; its corpus and table references move only if they name the total |
| `doc/guides/provider-conditions-and-parks.md` | The zone basis and `timezone` field, `budget-exhausted` as condition/cause/skip reason, the two budget announcements and their evidence, the terminal ticket refusal with its remedy, the watch conditions including `watch-stale` with age and bound, and the no-paid-escalation rule |
| `doc/guides/zai-peak-hours-hook.md` | The hook is off the delivery path: the window is declared in configuration, the hook file may remain inert, and `provider migrate legacy` is the guided bridge with its declared refusal posture. The guide states that this is a provider-policy import and does not conflate it with the M4-S2 namespace migration or the install lifecycle's `--migrate` flag |
| `doc/guides/opencode-model-configuration.md` | One pointer that provider/model policy is declared in the typed provider and profile branches, and that the typed profile branch is the canonical path; model-configuration guidance itself is unchanged |
| `doc/planning/oss-tooling/milestones/m1/commands/provider.md` | The two new members with usage, options, examples, exit codes, and see-also; `--help` and `--version` stay present |
| `doc/decisions/00-index.md` | The six decision-record rows (already present as records; the index rows and the records land with the plan phase scope) |
| `doc/00-index.md` | The provider and guide inventory rows whose descriptions state the old limits move with the pages |
| M4 planning pack | The M4-S4 story marker and the flip-plan F2 evidence pointer name the delivered surfaces |

**The count-bearing documentation class.** Every page that states the error-table total, the delivered-row count, the two-segment allowlist size, or the `BASELINE_ROWS` arithmetic moves with the register: those four values are one delivered fact set. The result-contract page is the primary carrier; the ceremony-runner, metrics, install-lifecycle, and supervise pages restate parts of the same set in their own sections. Each moves in the phase that moves its numbers, as **one edit-set with the register**: the edit that moves the source table's total also moves every sentence on those pages that states the outgoing total, delivered-row count, allowlist size, or arithmetic. A count-bearing page left unmoved is a false specification page, not a documentation follow-up.

**Contract surfaces this change moves.**

| Surface | What must become true |
|---|---|
| Provider vocabulary sets | Condition kinds 6, park causes 8, skip reasons 9, announcement codes 13, the tie order with `budget-exhausted` after `quota-exhausted`, one watch-only closed set of 6 |
| Evidence allowlists | Park allowlist 14 fields (`timezone` plus five budget fields); announcement allowlist 17 through its base projection; the ≤ 1024-byte and ≤ 20-field bounds unchanged |
| Error table | `provider` kind at 16 rows, table at 167, documented rows at 166, arithmetic `+133`, allowlist 66, no delivered row renamed, and one resolving true-positive corpus row per new code |
| Provider CLI family | Seven members; two new members with help entries; family count 26 and family-tail positions unchanged |
| Reference page | The provider page contains the two new members and still contains `--help` and `--version`; the page-root mapping is unchanged |
| Config catalog | `provider.budgets` and the watch `maxAgeSeconds` declared; no other provider key added or renamed |
| Structural inventories | The closed-set, evidence-allowlist, schema-identifier, and command inventories move together, with no unknown-key or wildcard widening |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** a descriptor `peak` block and a profile `peakWindows` window, **when** each declares no zone, `UTC`, `Etc/UTC`, and a valid IANA name, **then** each validates and the default resolves as `UTC`; **when** each declares a syntactically invalid zone, **then** it refuses with the declaring surface's shape identity (`provider.chain.invalid` for the descriptor, `provider.profile.invalid` for the profile window) naming the field; **when** a syntactically valid zone the runtime cannot resolve is declared, **then** `provider.peak.zone-unknown` refuses at exit `1` naming the field before any evaluation, with no park, no announcement, and no state write (ticket AC: policy expressed only in Jaiship config) | F-1, DM-1, NFR-5 |
| AC-F1-2 | **Given** declared windows and evaluation instants across spring-forward, fall-back, the southern hemisphere, a no-transition window, and a buffer edge, **when** each is evaluated, **then** the expiry is the earliest instant at or after the declared local end, a skipped local second resolves to the transition instant, a repeated local second resolves to its first occurrence, the iteration stops at the first stable candidate or after three passes, and the engine gate, the profile gate, and the daemon watcher compute the same instant from the same facts (0 differences) (ticket AC: an exhausted provider parks with a typed reason and resumes automatically) | F-1, NFR-3, NFR-4 |
| AC-F1-3 | **Given** the change branch, **when** the provider tier is scanned, **then** it contains zero `Intl`, `TZ`, ambient-clock, environment, filesystem, or network references; **when** a composition supplies no zone port and a non-UTC zone is declared, **then** the run refuses `provider.peak.zone-unknown` rather than evaluating as UTC, while a `UTC` declaration needs no port; **when** a peak park and its announcement are produced, **then** both carry `timezone` with the effective declared zone (including `UTC`), and the cause, condition kind, skip reason, announcement code, and MAX/tie semantics are unchanged (ticket AC: policy expressed only in Jaiship config) | F-1, NFR-1, NFR-5 |
| AC-F2-1 | **Given** a `provider.budgets` map, **when** each child declares `enabled`, `scope`, `basis`, `ceiling`, `windowSeconds`, and `entries` in a valid combination, **then** it validates; **when** a scope or basis is unknown, a ceiling or window is non-positive, `windowSeconds` is present on a `ticket` scope or absent on a `window` scope, an entry names no declared descriptor, or `entries` is empty, **then** the provider configuration fails with `provider.chain.invalid` naming the offending field and no partial evaluation occurs; **when** a budget is disabled, **then** it causes no read and produces no condition (ticket task: budgets and alarms) | F-2, DM-2, NFR-6 |
| AC-F2-2 | **Given** a declared `window` budget and one verified spend read, **when** the measured figure for its basis is at or above the ceiling, **then** the subscription entry is parked with cause and condition kind `budget-exhausted`, its expiry is exactly `newestAtMs + windowSeconds × 1000` and strictly future, `provider.budget.parked` is announced at `info`, the evidence carries `budgetName`, `budgetScope`, `budgetBasis`, `budgetMeasured`, and `budgetCeiling`, the measured figure equals `spend --ref` for the same selection and instant, exactly one spend-totals read occurred regardless of budget count, and zero state writes occurred (ticket task: budgets and alarms; ticket AC: an exhausted provider parks with a typed reason and resumes automatically) | F-2, DM-3, DM-4, NFR-6, NFR-7 |
| AC-F2-3 | **Given** a declared `ticket` budget measured at or above its ceiling, **when** resolution evaluates it, **then** the entry is a failed entry with no park and no fabricated expiry, it is skipped with reason `budget-exhausted`, `provider.budget.crossed` is announced at `warning`, and no evidence field beyond the five is added; **when** no later entry is eligible and no honest contributing park supplies an expiry, **then** `provider.budget.exceeded` refuses at exit `1` naming the budget, scope, basis, measured figure, and ceiling and stating that the ceiling cannot reopen; **when** the same chain contains a selectable paid entry, **then** it is not selected (ticket task: budgets and alarms; owner directive: prefer sunk-cost subscription quota) | F-2, DM-4, NFR-6, NFR-9 |
| AC-F2-4 | **Given** an entry with a budget condition and another active condition, **when** they are combined, **then** the MAX rule applies with the tie order `peak-window`, `quota-exhausted`, `budget-exhausted`, `provider-outage`, `credential-missing`, `credential-rejected`; **when** no entry is eligible but a budget-parked entry contributes, **then** the chain park keeps cause `chain-exhausted` with the union of contributing kinds and the earliest contributing expiry; **when** a subscription entry is parked for `budget-exhausted`, **then** no paid entry is selected under any chain configuration (ticket AC: simulated quota/peak states produce the documented routing including parking; owner directive: no paid escalation) | F-2, DM-8, NFR-9 |
| AC-F2-5 | **Given** a budget evaluation, **when** the spend read is verified-empty, **then** every scope measures zero and the budget evaluates clear; **when** the read fails with a delivered `state.*` failure, **then** the decision refuses with that identity and no park is created; **when** the composition is inspected, **then** no budget record kind, counter, derived document, or second measurement path exists, and the delivered `spend` breakdowns (ticket, repository, lane, role, model) and amplification are unchanged (ticket AC: spend is attributable per ticket/phase/model) | F-2, DM-3, NFR-7 |
| AC-F3-1 | **Given** a provider descriptor, chain, profile, watch target, and budget each declared in two or more of defaults, system, user-global, project-committed, project-local, environment, and CLI, **when** the configuration resolves, **then** the highest-priority declaring layer wins for every element, project-local beats project-committed, record maps merge by child name, lists replace whole, `reset` removes inherited values, and every effective value's origin names the winning layer with its file and line (or the environment/CLI form), with zero values whose origin is not the winner (ticket task: per-project overrides; ticket AC: policy expressed only in Jaiship config) | F-3, NFR-14 |
| AC-F3-2 | **Given** a repository-layer provider document, **when** it declares an invalid value, **then** the run refuses with the delivered `config.*` or `provider.chain.*` identity naming the field and never silently falls back to a machine-global value; **when** the repository layers are inspected, **then** no `provider.projects.*` branch, key, state kind, command, or error identity exists (ticket task: per-project overrides) | F-3, NFR-14 |
| AC-F3-3 | **Given** `CI=true` with a project-committed provider policy and a project-local override, **when** configuration resolves, **then** the committed policy is in effect and project-local is reported `ci-disabled` with zero reads of it; **when** an explicit `--enable-project-local-config` is supplied, **then** local policy participates; **when** a selected configuration file is in effect, **then** project-local is `selected-config` with no local read; **when** a multi-checkout project is considered, **then** the documented boundary states that one policy spanning several checkouts is not expressible in this story (ticket AC: policy expressed only in Jaiship config) | F-3, NFR-14 |
| AC-F3-4 | **Given** a validation run over a repository-layer declaration, **when** the layer supplies provider descriptors, chains, profiles, watch targets, and budgets, **then** every element is validated before merge and an invalid element refuses as in AC-F3-2; **when** the same declaration is read in CI and on a workstation, **then** the two runs differ only by the project-local layer's declared skip (ticket task: per-project overrides) | F-3, NFR-14 |
| AC-F4-1 | **Given** a fixture home with no legacy profile directory and no hook, **when** `provider resolve`, `provider quota`, `provider watch status`, and `provider simulate` run, **then** each resolves policy from configuration and a recording file-access stub observes zero reads of either legacy path; **when** the legacy files are present but inert, **then** the same zero-read result holds; **when** the composition is inspected, **then** no production module reads the legacy profile directory, the hook, or an environment-variable convention as policy input (ticket AC: a delivery runs with the shell hook and profile files disabled) | F-4, NFR-14 |
| AC-F4-2 | **Given** the configuration tree, **when** provider selection, models, chains, credential references, windows, budgets, and watches are enumerated, **then** every input is a typed configuration value, configuration stores environment-variable names and credential reference names only, and no shell profile, hook, hidden file, or environment-variable convention participates (ticket AC: policy expressed only in Jaiship config; ticket AC: no credential values appear in config, state, or logs) | F-4, NFR-14 |
| AC-F5-1 | **Given** `provider simulate --fixture <path>`, **when** it runs against a valid fixture, **then** it composes the delivered engine with fixture seams, calls `resolve` with `persist: false`, performs zero state writes, zero credential resolutions, zero network calls, and zero child spawns, and the payload's `simulation.stateWrites` is exactly `0`; **when** `--fixture` is missing, has no value, or an undeclared flag, `--chain`, `--profile`, `--all`, or a positional is supplied, **then** the delivered refusal (`input.value.rejected` or `fallback.invocation`) answers before any read and nothing is written (ticket task: policy simulation for offline verification) | F-5, DM-5, NFR-10 |
| AC-F5-2 | **Given** a fixture, **when** it carries an unknown key, a missing required key, a wrong type, an unsupported schema version, an oversized body, or any credential-shaped value field, **then** it refuses with `input.value.rejected` at exit `1` naming the field before any evaluation, with no fixture content echoed; **when** the schema is inspected, **then** no `value`, `secret`, `token`, or `key` field exists for a credential; **when** the same facts are supplied with a different object key order, **then** the decision is identical (ticket task: policy simulation; AC: no credential values appear in config, state, or logs) | F-5, DM-5, NFR-10 |
| AC-F5-3 | **Given** identical facts, **when** they are fed through `provider resolve` and through `provider simulate`, **then** the resolve keys of both payloads are equal (parity: 0 decision differences), and the simulate payload's `data` carries the delivered keys in their delivered order followed by exactly one `simulation` block; **when** the fixture selects a chain or profile, **then** the selection lives inside the document; **when** a simulated decision is selected, parked or fully skipped, or fails classification, **then** the exit is `0`, `2`, or `1` respectively, mirroring `resolve`, and no `provider.simulate.*` error row exists; **when** the same fixture runs twice, **then** both outputs are byte-identical (ticket AC: simulated quota/peak states produce the documented routing including parking) | F-5, DM-5, DM-6, NFR-10 |
| AC-F6-1 | **Given** `provider migrate legacy` with default sources and with `--profiles-dir`/`--hook` overrides, **when** a source is absent, **then** it is reported `absent` and the other source still migrates; **when** neither exists, **then** `provider.migrate.refused` refuses with reason `no-source`; **when** a valid source is read, **then** a deterministic proposal is printed on stdout (or in `data.proposal` with `--json`) with the report on the diagnostic stream or in `data.report`, the proposal is validated by the delivered provider validator and configuration schema before output, and nothing is written without `--write` (ticket task: one-time migration) | F-6, DM-7, NFR-11 |
| AC-F6-2 | **Given** a source containing a function definition, a compound command, `source`/`.`, `eval`, `set`/`unset`/`readonly`, a heredoc, a redirection, a pipeline, a command substitution, an arithmetic expansion, an array, a multi-command line, or an expansion-bearing value, **when** the migration runs, **then** the whole run refuses `provider.migrate.refused` at exit `1` with the closed reason `shell-construct` or `dynamic-value`, naming the source path and line and never the content, stdout is empty, no proposal is emitted, and nothing is written or executed (ticket task: one-time migration) | F-6, DM-7, NFR-11 |
| AC-F6-3 | **Given** a source containing a credential-shaped name (`*_API_KEY`, `*_API_TOKEN`, `*_ACCESS_TOKEN`, `*_SECRET`, `*_PASSWORD`, `*_PRIVATE_KEY`, `*_CLIENT_SECRET`) with a distinctive canary value, **when** the migration runs, **then** the name is classified before its value is examined and the value is discarded at the parse boundary, only a credential reference can appear in the proposal, and the canary string appears in no stdout, stderr, envelope, diagnostic, intermediate structure, or written file; **when** a source contains an unreadable or oversize body, **then** it refuses `unreadable-source` or `oversized-source` and no partial proposal exists (ticket AC: no credential values appear in config, state, or logs) | F-6, DM-7, NFR-11 |
| AC-F6-4 | **Given** the closed mapping table, **when** a recognised name maps literally to a target in `provider.credentials`, `provider.entries`, `provider.chains`, or `provider.profiles`, **then** the proposal carries that literal value; **when** a recognised name cannot be addressed or mapped, or the name is unrecognised, **then** it is disclosed by name as `unmapped` and omitted, and the operator sees the list; **when** `--write` runs with the project-committed document absent, **then** exactly that document is created; **when** it is present, **then** `provider.migrate.refused` refuses with reason `target-exists` and the document is never read for merge or modified; **when** a proposal fails the delivered validator, **then** `proposal-invalid` refuses instead of emitting it (ticket task: one-time migration; AC: policy expressed only in Jaiship config) | F-6, DM-7, NFR-11, NFR-12 |
| AC-F6-5 | **Given** the shipped hook example, **when** the migration reads it, **then** it refuses `shell-construct` naming the file and line and the documented remedy (declare the window, quota endpoint, and credential reference in configuration and retire the hook from the path); **when** the change is inspected, **then** no path executes, sources, word-splits, emulates, or imports the hook, no legacy file is written or deleted, and the operator guide states that posture plainly without implying hook import (ticket task: one-time migration; AC: a delivery runs with the shell hook and profile files disabled) | F-6, NFR-11, NFR-16 |
| AC-F7-1 | **Given** a watch target, **when** `maxAgeSeconds` is omitted, **then** it resolves to `900`; **when** it is a positive integer, **then** it validates; **when** it is zero, negative, or non-integer, **then** the configuration refuses `config.value.invalid` naming the key; **when** observations are aged at `bound − 1`, `bound`, and `bound + 1`, **then** the first is fresh and the latter two are stale (ticket task: balance/quota watch conditions with staleness handling) | F-7, DM-8, NFR-13 |
| AC-F7-2 | **Given** an observation at or beyond its bound, **when** the watch view is produced, **then** `condition` is `watch-stale` with `observedAt`, `ageSeconds`, and `maxAgeSeconds` beside `name`, `source`, and `checkedAt`, it is never `clear` and never `provider-outage`, and `source` states the observed instant and the bound without claiming a transport or credential failure; **when** the closed sets are inspected, **then** `watch-stale` is a member of the watch-only condition set and of no park cause, condition kind, skip reason, or announcement code (ticket task: staleness handling) | F-7, DM-8, NFR-13 |
| AC-F7-3 | **Given** a watch observation that yields a natural park, **when** its natural expiry is later than `observedAt + maxAgeSeconds × 1000`, **then** the park's expiry is clamped to that bound; **when** the bound is not strictly in the future, **then** no park is created and the observation is reported `watch-stale`; **when** the watch path runs, **then** it performs zero state writes and no cache, timer, refresher, scheduler, command, or quota freshness key exists (ticket task: staleness handling; owner directive: verify balance live) | F-7, NFR-13 |
| AC-F7-4 | **Given** the delivered live watch composition, **when** a target is read, **then** the observation instant is the read instant, age is `0`, and the condition is never `watch-stale`; **when** staleness is exercised, **then** it is demonstrated by composition-supplied observations and by the park clamp; **when** the documentation is inspected, **then** it states that the live path has zero age and makes no claim of everyday stale detection (ticket task: staleness handling) | F-7, NFR-13, NFR-16 |
| AC-F8-1 | **Given** the change branch, **when** the CI error-table gate runs, **then** the source table, the documented table, and the fixtures agree with `provider.peak.zone-unknown`, `provider.budget.exceeded`, and `provider.migrate.refused` documented with category, retryability, consequence, projection, and remediation; the `provider` kind holds sixteen rows, the table holds 167, the documented table holds 166 delivered rows, the sync arithmetic is `BASELINE_ROWS.length + 133`, each new code has a resolving true-positive corpus row and no masking false-positive row, the two-segment allowlist is unchanged at 66, and no delivered row is renamed, reworded, or re-projected (ticket task: complete and document the provider surface) | F-8, DM-9, NFR-15 |
| AC-F8-2 | **Given** the change branch, **when** the structural inventories run, **then** the provider vocabulary is exactly six condition kinds, eight park causes, nine skip reasons, thirteen announcement codes, the declared tie order, fourteen park evidence fields, seventeen announcement evidence fields, and one six-value watch condition set, with no other closed-set change and no wildcard or family widening (ticket task: complete and document the provider surface) | F-8, DM-8, NFR-15 |
| AC-F8-3 | **Given** the change branch, **when** the documentation set is inspected, **then** every page and guide named in §16 states the delivered truth: the zone basis and default, the budget branch and its park/refusal split, the per-repository mechanism with its precedence, origins, and CI posture, the simulation surface and its zero-write disclosure, the migration surface with its refusal posture and credential firewall, the watch conditions with `watch-stale` and the clamp; the result contract carries the three rows and the moved counts, the count-bearing pages carry 167 / 166 / 66 / `+133`, the provider reference page carries the two new members, and no page states the UTC-only basis, non-UTC-out-of-scope, an outgoing count, or a shell/hook runtime dependency as current truth (ticket task: complete and document the provider surface; ticket AC: policy expressed only in Jaiship config) | F-8, NFR-16 |
| AC-F8-4 | **Given** the change branch, **when** the aggregate quality gate runs, **then** it is green with the provider family at its existing membership plus two members, the family count unchanged at 26, both bins identical in content and order, the provider reference page containing `--help` and `--version`, the help-coverage mapping and inventory agreeing in both directions, and the help entries for `provider simulate`, `provider migrate`, and `provider migrate legacy` present with usage, options, examples, exit codes, and see-also (ticket task: complete and document the provider surface) | F-8, DM-10, NFR-15 |

**Ticket-AC traceability.** The ticket states six acceptance criteria.

| Ticket AC (verbatim fragment) | Specification ACs |
|---|---|
| "policy expressed only in Jaiship config" | `AC-F1-1`, `AC-F1-3`, `AC-F3-1`, `AC-F3-2`, `AC-F3-3`, `AC-F4-2`, `AC-F6-4`, `AC-F8-3` |
| "simulated quota/peak states produce the documented routing including parking" | `AC-F5-1`, `AC-F5-2`, `AC-F5-3`, `AC-F2-4` |
| "a delivery runs with the shell hook and profile files disabled" | `AC-F4-1`, `AC-F6-5` |
| "spend is attributable per ticket/phase/model" | `AC-F2-2`, `AC-F2-5` (the attribution surface is delivered by GH-236/GH-299; this change proves the gate reads the same fold rather than re-specifying it) |
| "an exhausted provider parks with a typed reason and resumes automatically" | `AC-F1-2`, `AC-F2-2`, `AC-F2-3`, `AC-F2-4` |
| "no credential values appear in config, state, or logs" | `AC-F4-2`, `AC-F5-2`, `AC-F6-3` |

**Ticket-task traceability.** "config schema for providers (credential env names only, never values)" → `AC-F4-2`, `AC-F6-3`; "subscription/quota state, chains and fallbacks, pacing rungs" → delivered (GH-182, GH-234), preserved by `AC-F2-4`, `AC-F8-2`; "peak windows with time zones" → `AC-F1-1`, `AC-F1-2`, `AC-F1-3`; "budgets and alarms" → `AC-F2-1`, `AC-F2-2`, `AC-F2-3`, `AC-F2-4`, `AC-F2-5`; "per-project overrides" → `AC-F3-1`, `AC-F3-2`, `AC-F3-3`, `AC-F3-4`; "a policy engine that resolves provider+model per spawn and injects it through the harness spawn (no shell env)" → delivered (GH-234/env record), evidenced by `AC-F4-1`, `AC-F4-2`; "parking on peak window or exhausted quota with a recorded reason and automatic resume" → delivered, extended by `AC-F1-2`, `AC-F2-2`; "balance/quota watch conditions with staleness handling" → `AC-F7-1`, `AC-F7-2`, `AC-F7-3`, `AC-F7-4`; "complete and document `provider resolve|quota|parks|profile|watch`" → `AC-F8-1`, `AC-F8-2`, `AC-F8-3`, `AC-F8-4`; "policy simulation (`provider simulate`) for offline verification" → `AC-F5-1`, `AC-F5-2`, `AC-F5-3`; "spend attribution per ticket/phase/model via `spend` and the amplification view" → delivered, evidenced by `AC-F2-5`; "one-time migration that reads the legacy profiles and the pre-iteration hook as compatibility input, then removes the runtime dependency" → `AC-F6-1`, `AC-F6-2`, `AC-F6-3`, `AC-F6-4`, `AC-F6-5`, `AC-F4-1`. Every `F-` capability is exercised by at least one acceptance criterion, and every `NFR-` is bound to at least one.

**Verification intent.** `AC-F1-2`, `AC-F1-3`, `AC-F2-2`, `AC-F2-3`, `AC-F2-4`, and `AC-F7-1`–`AC-F7-4` are pure-policy cases over injected clocks, zone tables, spend facts, and observation instants, with no live network, credential, sleep, or tz read. `AC-F1-1`, `AC-F2-1`, `AC-F3-1`–`AC-F3-4`, and `AC-F7-1` include configuration cases over layered fixtures, asserting origins and refusals. `AC-F2-2`, `AC-F2-3`, and `AC-F2-5` add a state-store byte snapshot before and after evaluation and a read-count assertion on the injected totals port. `AC-F4-1` and `AC-F4-2` are composition cases with a recording file-access stub and an enumeration of policy inputs. `AC-F5-1`–`AC-F5-3` are command cases over fixtures with throwing credential and transport fakes, a child-process import assertion, a byte snapshot, and a parity assertion against `resolve`. `AC-F6-1`–`AC-F6-5` are command cases over fixture source trees with a no-execution canary, a canary-secret byte scan of every output surface and written file, a refusal matrix, and a `config`-accepts-the-proposal assertion. `AC-F8-1`–`AC-F8-4` are the delivered gate and inventory cases plus the documentation conformance checks.

**Quality-assurance strategy (the suites this change adds or extends).** Names follow the delivered per-feature suite convention; the test plan owns cases, oracles, and case ids.

| Level | Suite (new or extended) | Scope |
|---|---|---|
| Structure and contract inventory | `provider-contract` (extended), `provider-budgets-contract` (new), `provider-watch-contract` (new) | Closed sets at their declared sizes, the tie order, the evidence allowlists, the watch-only condition set, the zone grammar, and the schema identifiers |
| Behaviour — zones | `provider-peak-zone` (new), `daemon-peak-window-isolation`/`peak-window-utc-clock` (extended) | Grammar and default, unknown-zone refusal, the DST matrix, the buffer edge, and boundary equality across engine, profile gate, and watcher with an injected zone table |
| Behaviour — budgets | `provider-budgets` (new) | Both scopes' crossing and non-crossing matrices, expiry arithmetic and strict futurity, verified-empty versus damaged read, the no-substitution rule, one-read assertion, and deterministic replay |
| Behaviour — configuration | `provider-config-precedence` (new) | The precedence matrix for descriptor, chain, profile, watch target, and budget; project-local beats committed; origin strings; invalid repository layer refusal; `CI=true` and selected-file postures; policy resolution with the legacy paths absent |
| Behaviour — simulation | `provider-simulate` (new) | The fixture-refusal matrix, the parity assertion against `resolve`, zero-effect guards (state, credential, transport, spawn), determinism and key-order shuffling, and the exit matrix |
| Behaviour — migration | `provider-migrate` (new) | The subset accept/refuse matrix, whole-run refusal with empty stdout and no write, the canary credential firewall across every output surface and written file, the mapping table and unmapped disclosure, `--write` create-only and `target-exists`, and proposal validation |
| Behaviour — watch freshness | `provider-watch-freshness` (new), `provider-watch-*` (extended) | The `bound − 1`/`bound`/`bound + 1` matrix, stale-never-clear-or-outage, the park clamp versus natural expiry, no-park-from-stale, and the live-path zero-age statement |
| Golden output | `provider-simulate-golden` (new), `provider-migrate-golden` (new), `provider-parks` (extended) | Machine and human rendering of a simulation, a proposal plus report, and a budget park with its evidence |
| Checks and security | `provider-hermetic` (extended), `provider-evidence-bounds` (extended), `secret-read-boundary` (unchanged, must stay green), `error-table-sync` (extended) | No live network, credential, sleep, or tz read; evidence ≤ 1024 bytes and ≤ 20 fields with the new fields; the credential firewall scan; the three rows, counts, and corpus rows |
| Boundaries | `tests/boundaries/**` (extended) | A negative fixture that fails if a zone or `Intl` reference appears in the provider tier; fixture-reader reachability only from the simulate composition; no child-process or shell import in the migration module |
| Documentation | `doc-conformance` (extended) | The corrected pages, the retired claims, and the moved counts |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Full eleven-phase lifecycle on the change branch; plan phases declared in the plan; commits through the commit primitive; quality gates green before the pull request; the pull request targets the integration branch and **stops open** with merge authority outside this change.
- Delivery order is constrained by dependency, not preference: contracts and the vocabulary first (nothing else can compile against an undeclared set), then the zone port and the pure arithmetic (so every later surface shares one boundary), then the budget evaluator and its totals projection, then the configuration branch and the per-repository evidence, then simulation, then migration, then watch freshness, then the conformance and documentation sweep. The plan owns the phase boundaries; this specification owns the contract.
- Adoption is inert by default for an existing installation. Absent a `provider.budgets` declaration there is no gate and no extra read; an existing `UTC` window behaves exactly as delivered and gains only the `timezone` evidence field; a watch target without `maxAgeSeconds` resolves the declared default; and the two new commands are additive members that nothing else calls. The one declared behaviour change is the zone basis: a non-UTC declaration that previously refused for being non-UTC now validates, which is the point of the story.
- The migration is one-shot and reversible by the operator: nothing is written without `--write`, `--write` is create-only, no legacy file is modified or deleted, and the hook keeps its file while losing its place on the path. Reverting the change restores the previous behaviour, because no state was migrated and no legacy artifact was transformed.
- The declared operating change is stated where operators meet it: a declared window is evaluated in its declared zone; a cost ceiling is a pre-spawn decision, not a real-time cap; a per-ticket ceiling does not reopen; and the hook is off the path after the operator adopts configuration.
- The decision records and their index rows ride a plan phase's authored scope, not a hand-commit; the delivery plan declares `doc/decisions/**` for that phase.
- An installed artifact is unaffected by any reversal: nothing in this change touches the install lifecycle, the release model, or the binary build.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

No delivery state, ledger record, or derived document is migrated, seeded, or backfilled.

**Three different things are called migration in this repository, and this change is only the first.** `provider migrate legacy` (this change) is a one-shot import of *provider policy* from legacy shell input into the typed `provider` branch. The M4-S2 namespace migration — moving configuration, state, artifact, or environment names from a prior working name to the current one — is a different story with a different owner and is not performed, accepted, or referenced here. The install lifecycle's `--migrate` flag is a third, unrelated surface: it is a typed delegation refusal that names M4-S2 as the owner of the namespace move and moves nothing. No surface in this change moves a name, a path, a state root, or an artifact, and no documentation may present `provider migrate legacy` as a namespace migration or as `install --migrate`.

- No new state record kind exists, and no persisted counter is introduced. Budget facts are measured at evaluation time from the delivered telemetry fold; the fold's records are untouched.
- The one migration in this change is a **one-shot operator-invoked policy import**, not a data migration: `provider migrate legacy` reads legacy files as data, writes nothing by default, and with `--write` creates at most one new project-committed configuration document. It never reads for merge, never modifies an existing document, and never writes, moves, or deletes a legacy file.
- A machine that never runs the migration keeps its legacy files exactly as they are; they are simply not read by any runtime path after the policy is declared in configuration.
- Rollback is the removal of this change: no budget, zone, watch, simulation, or migration artifact remains to convert, because none was persisted.

## 20. PRIVACY / COMPLIANCE REVIEW

No personal data is collected, stored, or transmitted, and nothing leaves the machine.

- The migration reads operator-authored local files that may contain credential-shaped **names**. Only names are retained for classification; the remainder of a credential-shaped line is discarded at the parse boundary and never parsed, validated, logged, persisted, or echoed. Reports contain names, source paths, and byte counts only.
- Simulation fixtures contain facts and, for credentials, an enum — never a value. A fixture cannot carry a credential value because the schema has no field for one.
- Budget evidence and refusal summaries contain budget names, scopes, bases, measured figures, and ceilings — cost and token quantities, not user content, and never a provider credential.
- Watch views contain a target name, a condition, a mapping summary, instants, an age, and a bound; no response body and no credential.
- Zone evidence contains a zone name; a locale string or offset is never persisted in its place.
- No tracker, provider, vendor, or analytics flow is added; no path in this change performs a network call except the delivered quota transport on its delivered path.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Legacy input is parsed as data, never as code.** The migration has no shell, no `source`, no `eval`, no substitution, no glob expansion, no ambient environment read, and no child process. A construct whose meaning depends on a shell refuses the entire run instead of being interpreted. The absence is asserted structurally and by a canary side-effect test.
- **The credential firewall is name-first.** A credential-shaped name is recognised before its value is examined; the value is discarded at the parse boundary; the only representable credential artifact is a reference. Canary fixtures scan every output surface and any written file. Security review of that path is mandatory. A credential value observed anywhere is treated as a security defect, not a migration bug.
- **Refusal is whole-run and typed.** No partial proposal exists, and a refusal writes nothing, so a failed import cannot leave a half-applied policy behind.
- **The proposal is validated before it is emitted.** The delivered provider validator and configuration schema decide, so the command cannot hand the operator a document that later fails closed in a way the command hid.
- **`--write` cannot merge.** It creates one new document only when none exists, so the command can never silently rewrite policy the operator reviewed earlier.
- **Simulation cannot touch anything.** It composes no state store, no credential implementation, no transport, and no child process; `persist: false` is belt and braces; `stateWrites: 0` is disclosed on every payload; a production composition cannot read a fixture.
- **The zone port is the only place `Intl` is read**, it performs no I/O or network, and core policy never reads ambient zone data — so a compromised or unusual host cannot change a decision through a hidden path, only through a refusal.
- **The budget gate reads, never writes.** One verified ref-scoped read, no counter, no fence, no derived document; a failed read refuses rather than reading as clear, so damage cannot masquerade as headroom.
- **Watch staleness cannot license spending.** An aged observation is never clear, and a park derived from a reading cannot outlive the reading's bound.
- **No new secret path.** No secret-read allowlist entry is added; configuration stores names and references only; every emitted surface remains redaction-safe by construction.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **The closed sets are the contract.** Adding a condition kind, park cause, skip reason, announcement code, evidence field, or watch condition is a deliberate bounded extension with a documentation move, never a wildcard. The declared counts in DM-8 are the checklist for the next such addition.
- **The zone port is the one temporal edge.** A future temporal rule (a budget window in local time, a release calendar) must consume the same port and the same bounded expiry rule rather than reading zone data in a second place; a second zone-data edge is a recorded revisit trigger.
- **The budget gate has no state to repair.** There is no counter to reconcile, no fence, and no drift class; the only operational question is read cost, and the answer is a bounded projection before any cache.
- **The pre-spawn bound is a maintained fact.** A document that describes the ceiling as a hard cap is a defect; the gate's freshness is telemetry freshness and that sentence must survive every edit of the operator guide.
- **The migration table is closed data with an explicit extension path.** A new recognisable name is added with tests and a recorded decision; a name that cannot be mapped is disclosed, never guessed. If real operator files prove non-declarative, the honest outcome is a refusal plus documentation, not an execution path.
- **The mapping table's targets are the delivered default entry and credential names**, so it introduces no new vendor or product literal class; the brand-literal scan and the content inventory stay green.
- **Simulation parity is the defect detector.** If simulation and `resolve` disagree for identical facts, the composition is wrong — never the fixture. That rule is what keeps the evidence trustworthy.
- **`watch-stale` is prospective by design.** The live read has zero age; the value is realised by any future retained observation and by the park clamp today. The documentation says so, and a claim of everyday detection is a defect.
- **The error rows are closed at sixteen provider rows.** A new provider refusal means a new documented row, a corpus row, and a deliberate count move.
- **The per-repository mechanism is the delivered layer model.** A future project-keyed layer is a separate decision at M4-S5; it must not be introduced by reinterpreting these layers.
- **The corrected documentation is part of the product's truth.** The UTC-only statements, the non-UTC-out-of-scope statements, the outgoing counts, and the shell/hook dependency must not reappear.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Zone basis | The declared time zone in which a peak window's seconds-of-day are read; `UTC` by default, or an IANA zone name |
| Zone port | The one injected seam (`isKnownZone`, `offsetSecondsAt`) through which pure policy receives zone facts resolved at a composition edge |
| Local seconds-of-day | `(utcSecondsOfDay(instant) + offsetSecondsAt(zone, instant)) mod 86400`, normalised non-negative |
| Declared local end | The window's `endSecondsOfDay` read in the declared zone; the expiry rule resolves the earliest instant at or after it |
| Budget | A declared ceiling over a measured spend figure, with a scope (`ticket` or `window`), a basis (`cost` or `tokens`), and optionally a governing entry list |
| Window scope | A budget measured over a trailing span ending at the evaluation instant; a crossing parks with a computable expiry |
| Ticket scope | A budget measured over the whole work-item ref; a crossing is terminal, because the ceiling never decreases |
| Crossing | A measured figure at or above the declared ceiling (`>=`) |
| Spend-totals port | The injected read-only seam that projects one verified spend read into per-scope `cost`, `tokens`, and `newestAtMs` facts |
| Budget park | A window-scope crossing expressed as a park with cause `budget-exhausted` and expiry `newestAtMs + windowSeconds × 1000` |
| Budget refusal | The terminal `provider.budget.exceeded` outcome of a ticket-scope crossing when nothing honest can supply a resume instant |
| Project identity | For this story, the repository checkout; the project-committed and project-local layers are its policy surface |
| Project-committed layer | `<repo>/<configDirectoryName>/config.yaml` (or the selected file): repository-owned, travels with the code, visible to CI |
| Project-local layer | `<repo>/<configDirectoryName>/config.local.yaml`: repository-owned, workstation-only, skipped under `CI=true` unless enabled |
| Origin | The exact winning-layer evidence for a resolved value: `layer=<layer> file=<path> line=<n>` for a file layer, or the environment/CLI forms |
| Simulation fixture | A strict `delivery.provider.simulate.v1` JSON document declaring facts (instant, selections, credential outcomes, quota results, spend points, zone offsets) and never policy or a credential value |
| Parity | The property that `simulate` and `resolve` produce the same decision for identical facts; asserted by a test, not by a diff |
| Legacy profile directory | `~/.<priorWorkingName>/config/profiles/*.sh`: assignment-shaped shell input the migration may read as data |
| Legacy hook | The pre-iteration hook that defers spawns for peak windows and quota exhaustion; a program in the shipped example, refused as `shell-construct` |
| Provider-policy migration | `provider migrate legacy`: a one-shot import of provider policy from legacy shell input into the typed branch. Distinct from the M4-S2 namespace migration (names, paths, state roots, artifacts) and from the install lifecycle's `--migrate` delegation refusal |
| Declarative subset | The migration's assignment-only grammar: blank lines, comments, and single-token assignments, nothing else |
| Credential firewall | The name-first rule that discards a credential-shaped value at the parse boundary and can emit only a reference |
| Unmapped | A recognised or unrecognised name disclosed by name and omitted from a migration proposal, because it cannot be mapped literally |
| Watch target | A declared balance or usage source under `provider.profiles.watch` with a mapping, an endpoint, a credential reference, and now a freshness bound |
| Watch freshness bound | The per-target `maxAgeSeconds` at or beyond which an observation is `watch-stale` |
| `watch-stale` | A watch-only condition meaning "observed, but too old to act on"; never clear, never outage |
| Park clamp | The rule that a park derived from a watch observation expires no later than `observedAt + maxAgeSeconds × 1000` |
| Pre-spawn bound | The declared limit that a single spawn may land above a ceiling before the next evaluation observes it; the gate is not a real-time cap |
| Declared divergence | A deliberately asymmetric outcome stated in this specification: the per-ticket ceiling is a refusal where the ticket's wording says "park" |

## 24. APPENDICES

### Appendix A — Provider policy precedence matrix (normative)

Seven ordered layers, lowest to highest priority. The highest layer that declares a value wins for that value; record maps merge by child name; lists replace whole; `reset` removes inherited descendants; every effective value reports its exact origin.

| Priority | Layer | Source | Origin form |
|---:|---|---|---|
| 1 | Defaults | Typed catalog declarations and the shipped defaults manifest | `layer=defaults file=… line=<n>` |
| 2 | System | Platform configuration directories | `layer=system file=<path> line=<n>` |
| 3 | User-global | Operator configuration directory | `layer=user-global file=<path> line=<n>` |
| 4 | Project-committed | `<repo>/<configDirectoryName>/config.yaml`, or the selected file | `layer=project-committed file=<path> line=<n>` |
| 5 | Project-local | `<repo>/<configDirectoryName>/config.local.yaml` | `layer=project-local file=<path> line=<n>` |
| 6 | Environment | Catalog-declared names built from the environment prefix and dotted paths | `layer=environment env=<KEY>` |
| 7 | CLI | Catalog-declared flag mappings | `layer=cli flag=<--flag>` |

| Policy element | Key shape | Merge behaviour | Project-local beats committed? | CI=true posture |
|---|---|---|---|---|
| Descriptor | `provider.entries.<name>` | Record map; children merge by name; a lower layer's sibling values survive | Yes | Committed read; local `ci-disabled` |
| Chain | `provider.chains.<name>` | Record map; `entries` is a list and replaces whole | Yes | Committed read; local `ci-disabled` |
| Profile | `provider.profiles.profiles.<name>` (+ `tiers`, `seats`, `precedenceChain`, `pacing`) | Record maps merge by child name; lists replace whole | Yes | Committed read; local `ci-disabled` |
| Watch target | `provider.profiles.watch.<name>` (including `maxAgeSeconds`) | Record map; children merge by name | Yes | Committed read; local `ci-disabled` |
| Budget | `provider.budgets.<name>` | Record map; children merge by name; `entries` replaces whole | Yes | Committed read; local `ci-disabled` |

The selected file (`--config`, the environment selector, then a recognised legacy selector) occupies the project-committed slot and is not an eighth layer; it makes project-local `selected-config` with no local read. A repository-layer provider document is validated before merge; an invalid declaration refuses with the delivered `config.*` or `provider.chain.*` identity naming the field. A policy spanning several checkouts of one project is not expressible through these layers and is a declared boundary (M4-S5).

### Appendix B — Zone grammar, local evaluation, and the DST rule (normative)

**Grammar.** A declared zone is the literal `UTC` (the default and the alias of `Etc/UTC`) or a name matching `^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+)*$` within a declared length bound. Grammar is decided by the pure validator; existence is decided only at the edge through the zone port.

**Evaluation.** Local seconds-of-day = `(utcSecondsOfDay(nowMs) + offsetSecondsAt(zone, nowMs)) mod 86400`, normalised non-negative. The window is the delivered half-open interval `[max(0, startSecondsOfDay − bufferSeconds), endSecondsOfDay)`, read as local seconds. Outside it the condition is clear; inside it the condition parks until the resolved expiry.

**Expiry.** Compute the candidate as `nowMs + (endSecondsOfDay − localNowSeconds) × 1000`, re-resolve the offset at the candidate, and recompute while the candidate moves; stop at the first stable candidate or after three passes and use the last candidate. The declared rule the result must satisfy is: **the earliest instant at or after the declared local end**, with a skipped local second resolving to the transition instant and a repeated local second to its first occurrence.

| Situation (illustrative) | Declared local end | Resolved expiry |
|---|---|---|
| No transition | 18:00 | The instant at which local time is 18:00 |
| Spring forward, end in the skipped interval | 02:30 | The transition instant (the first instant whose local time is at or after 02:30) |
| Fall back, end in the repeated interval | 02:30 | The **first** occurrence of 02:30 |
| Buffer edge | `start − buffer` | The buffer boundary, clamped at 0 |

The test plan owns the full matrix (both hemispheres, a no-transition window, and the buffer edge); this appendix fixes the rule, not the cases.

### Appendix C — Budget evaluation (normative)

| Declared fact | Rule |
|---|---|
| `enabled` | `false` means inert: no read contribution, no condition, no announcement |
| `scope` | `ticket` measures from the ref's beginning; `window` measures from `now − windowSeconds` |
| `basis` | `cost` uses harness-reported units and is never re-priced; `tokens` sums the declared token classes |
| `ceiling` | A measurement at or above it is a crossing (`>=`) |
| `windowSeconds` | Required exactly for `window`; refused for `ticket` |
| `entries` | Restricts which declared descriptors the budget governs; absent means every declared entry |
| Measured figure | Per scope, both bases and `newestAtMs` come from one read; `newestAtMs` is null only with no contributing observation |
| Nothing declared | No gate, no read, no condition; the delivered behaviour |

| Outcome | Condition | Result |
|---|---|---|
| Clear | Measured below the ceiling | No condition; resolution proceeds |
| Parked (`window`) | Measured at or above the ceiling | Park with cause/kind `budget-exhausted`, expiry `newestAtMs + windowSeconds × 1000`, announcement `provider.budget.parked` (`info`) |
| Failed (`ticket`) | Measured at or above the ceiling | No park; skipped with reason `budget-exhausted`; announcement `provider.budget.crossed` (`warning`); `provider.budget.exceeded` at exit `1` when nothing else can supply an honest resume |
| Unmeasurable | The read fails | Refuse with the delivered `state.*` identity; no park, no clear |
| Verified-empty | Telemetry present but nothing recorded for the scope | Measures zero; clear |

Tie order with the delivered conditions: `peak-window`, `quota-exhausted`, `budget-exhausted`, `provider-outage`, `credential-missing`, `credential-rejected`. A chain park keeps cause `chain-exhausted` and the union of contributing kinds. A budget park blocks paid substitution in addition to the delivered rule.

### Appendix D — `delivery.provider.simulate.v1` fixture and payload (normative)

| Fixture key | Shape | Required | Meaning |
|---|---|---|---|
| `schemaVersion` | `"delivery.provider.simulate.v1"` | Yes | Version discriminator; any other value refuses |
| `now` | ISO-8601 instant with an explicit zone | Yes | The injected clock instant |
| `chain` | Declared chain name | No | Simulates chain selection; absent means the declared default chain |
| `profile` | Declared profile name | No | Simulates the profile scope |
| `credentials` | Record: reference name → `resolved` \| `missing` \| `rejected` | No | The credential port's outcome per reference; an undeclared reference the selected chain needs defaults to `resolved` and is disclosed; **no value field exists** |
| `quota` | Record: entry name → `{ httpStatus, body }` or `{ transport: "outage" }` | No | The transport result per entry, consumed by the delivered normalizer unchanged; an entry with no block is not probed |
| `spend` | `{ telemetryState: "present" \| "absent", points: [{ atMs, cost, tokens }] }` | No | The spend-totals facts; `absent` is the verified-empty reading |
| `zones` | Record: zone name → ordered `[{ fromMs, offsetSeconds }]` | No | A step table; absent means the edge port is used and `simulation.inputs.zones` records `runtime` |

Unknown keys, a missing required key, a wrong type, an unsupported version, or an oversized document refuses `input.value.rejected` before evaluation. Object keys are canonicalised before evaluation; arrays keep their declared order. No `value`, `secret`, `token`, or `key` field exists.

| Payload group | Content |
|---|---|
| Delivered resolve keys | `summary`, `chain`, `decision`, `skipped`, `parks`, `announcements` in their delivered order, unchanged in name, type, and meaning |
| `simulation` | `fixturePath`, `fixtureSchemaVersion`, `now`, `stateWrites: 0`, `inputs { credentials, quota, spend, zones }`, `summary { decision, providerName?, parkCause?, resumeAt?, skippedCount, announcementCodes[] }` |

No textual diff is produced. The machine-comparable contract is: the resolve keys of a simulation equal the resolve keys of `resolve` fed the same facts.

### Appendix E — Migration subset, mapping table, and refusals (normative)

**Accepted grammar.** Blank lines and `#` comments are ignored. An assignment is `NAME=value` or `export NAME=value`, where `NAME` matches `^[A-Za-z_][A-Za-z0-9_]*$` and `value` is a single-quoted, double-quoted, or bare token containing no whitespace, no `$`, no backtick, no `;`, `&`, `|`, `(`, `)`, `<`, `>`, `*`, `?`, `[`, `]`, `{`, `}`, `~`, and no backslash. Nothing else is accepted. The hook is read under the same grammar as a parameters file.

**Closed mapping table.** Every mapping is literal-to-literal; no value is computed, concatenated, or inferred. The targets are the delivered default entry and credential names, so no new vendor literal class is introduced.

| Recognised legacy name | Target | Rule |
|---|---|---|
| `OC_ADOS_MODEL_PROFILE` | `provider.profiles.preferenceChain.base` | The literal value is the profile name |
| `OC_ADOS_AGENT_<AGENT>_MODEL` | `provider.profiles.profiles.<profile>.seats.<agent>.model` | Addressed by the literal `OC_ADOS_MODEL_PROFILE` value as `<profile>` and the lowercased `<AGENT>` token as `<agent>`; disclosed `unmapped` when that literal is absent; the value is copied verbatim |
| `ADOS_ZAI_PEAK_START_UTC` | `provider.entries.zai-coding-plan.peak.startSecondsOfDay` | Integer literal copied verbatim |
| `ADOS_ZAI_PEAK_END_UTC` | `provider.entries.zai-coding-plan.peak.endSecondsOfDay` | Integer literal copied verbatim |
| `ADOS_ZAI_BUFFER_SECONDS` | `provider.entries.zai-coding-plan.peak.bufferSeconds` | Integer literal copied verbatim |
| `ADOS_ZAI_MAX_SLEEP_LOOPS` | `provider.entries.zai-coding-plan.quota.maxSleepLoops` | Integer literal copied verbatim |
| `ADOS_ZAI_QUOTA_DISABLED` | `provider.entries.zai-coding-plan.quota.enabled` | Fixed declared translation: `1` → `false`; `0` → `true`; absent → no mapping (the default applies); any other value is `dynamic-value` |
| `ZAI_API_KEY` (credential-shaped) | `provider.credentials.zai.sourceKey` | Reference only: `{ style: literal, name: "ZAI_API_KEY" }`; the value is discarded at the parse boundary |
| `ADOS_ZAI_CONDITIONS` | — | Selects a condition set and is not literal-to-literal mappable: disclosed `unmapped` by name and omitted |
| `ADOS_HOOK_AGENT`, `ADOS_HOOK_ENV_V1` | — | Hook plumbing, not provider policy: disclosed `unmapped` by name |
| Any other name | — | Disclosed `unmapped` by name and omitted |

**Refusal reasons** (all under `provider.migrate.refused`, exit `1`):

| Reason | Meaning |
|---|---|
| `no-source` | Neither the profile directory nor the hook exists |
| `unreadable-source` | A source exists but cannot be read as a regular file within bounds |
| `oversized-source` | A source exceeds a declared file, byte, or line cap |
| `shell-construct` | A construct outside the assignment-only grammar |
| `dynamic-value` | A value that would require expansion, substitution, or interpretation |
| `target-exists` | `--write` was requested and the project-committed document exists |
| `proposal-invalid` | The mapped proposal fails the delivered validator or configuration schema |

The output is a proposal (default), a created document (`--write` when absent), or one typed refusal. Never a partial artifact.

### Appendix F — Watch freshness (normative)

| Item | Value |
|---|---|
| Key | `provider.profiles.watch.<name>.maxAgeSeconds`, positive integer, default `900`, per target |
| Predicate | `ageSeconds = floor((nowMs − observedAtMs) / 1000)`; stale exactly when `ageSeconds >= maxAgeSeconds` |
| Condition set | `clear`, `quota-exhausted`, `watch-stale`, `provider-outage`, `credential-missing`, `credential-rejected` |
| Park clamp | `expiresAt = min(naturalExpiry, observedAtMs + maxAgeSeconds × 1000)` |
| No-park rule | When the clamp is not strictly in the future, no park is created and the observation reports `watch-stale` |
| View fields | Delivered `name`, `condition`, `source`, `checkedAt`, plus additive `observedAt`, `ageSeconds`, `maxAgeSeconds` |
| Not added | Park cause, condition kind, skip reason, announcement code, error identity, command, cache, timer, quota freshness key |
| Live composition | Observation instant is the read instant; age is `0`; `watch-stale` never occurs on a live read |

| Age | Freshness | Result |
|---|---|---|
| `bound − 1` | Fresh | The mapped condition applies (including `clear`) |
| `bound` | Stale | `watch-stale` |
| `bound + 1` | Stale | `watch-stale` |
| Any, with a park whose natural expiry is past the bound | Stale-bounded | Park clamped to the bound |
| Any, with the bound already passed | Stale | No park |

### Appendix G — The three declared provider rows (normative)

| Identity | Trigger | Category | Retryable | Consequence | Projection | Remediation |
|---|---|---|---|---|---|---|
| `provider.peak.zone-unknown` | A syntactically valid declared zone cannot be resolved at runtime, or a non-UTC declaration is evaluated in a composition that supplies no zone port | user | false | `not_landed` | `user-validation` (exit `1`) | Correct the zone name, or run where zone data is available; a `UTC` declaration needs no zone data |
| `provider.budget.exceeded` | A ticket-scope budget measured at or above its ceiling, no later entry is eligible, and no honest contributing park supplies an expiry | user | false | `not_landed` | `user-validation` (exit `1`) | Raise or clear the ceiling, or start a new ticket; the ceiling cannot reopen |
| `provider.migrate.refused` | The legacy migration refused the whole run for one closed reason | user | false | `not_landed` | `user-validation` (exit `1`) | Read the named reason, file, and line; hand-author the policy, or correct the source and re-run |

None is a kind-first two-segment identity, so `RESERVED_TWO_SEGMENT_CODES` is unchanged at 66. No `provider.*` family or wildcard is introduced. Grammar refusals reuse `fallback.invocation`, value violations reuse `input.value.rejected`, declaration-node defects reuse `config.value.invalid`, and budget/fixture semantics that fail validation reuse the delivered `provider.chain.invalid`.

### Appendix H — Source anchors

- Ticket: GitHub issue 350, milestone "M4: Jaiship-native delivery", story M4-S4 (goal, task list, six acceptance clauses, the F2 flip-priority paragraph, and the owner's cost-control directive of 2026-11-18).
- Binding design: ADR-0012 (zone model, port, DST rule), TDR-0049 (budgets), PDR-0006 (per-repository mechanism), TDR-0050 (simulation), TDR-0051 (migration), TDR-0052 (watch freshness) — all `Proposed`, accepted or rejected by the owner at this change's pull-request review.
- Planning session: `doc/changes/2026-11/2026-11-19--GH-350--provider-policy/chg-GH-350-pm-notes.yaml` (scope gaps, the "per-project most plausibly maps to the delivered layers" reading, and the decision list).
- Delivered contracts verified for current truth: `packages/core/src/contracts/provider.ts` (closed sets, evidence allowlists, the UTC-only zone set, schema identifiers), `packages/core/src/provider/peak.ts` and `peak-rules.ts` (the boundary functions and profile window rules), `packages/core/src/provider/conditions.ts` and `chain.ts` (MAX, tie order, eligibility), `packages/core/src/provider/quota.ts` (the watch reader), `packages/core/src/config/catalog.ts` (the provider branch, the watch target, and the shipped defaults), `packages/core/src/state/spend-reads.ts` (the fold), `packages/cli/src/commands/provider.ts` and `packages/cli/src/edge.ts` (grammar and composition), `packages/adapters/src/provider-quota/` (the transport), and `scripts/hooks/pre-opencode-iteration-zai.sh` plus its tests (the shipped hook and its observed variable names).
- Feature specifications: [Provider Engine](../spec/features/feature-provider-engine.md), [Provider Profiles and Watching](../spec/features/feature-provider-profiles.md), [Provider Peak Pausing](../spec/features/feature-peak-pausing.md), [Configuration Layer](../spec/features/feature-config-layer.md), [Spend Read Side](../spec/features/feature-spend.md), [Metrics Report and Burn-Rate Alarms](../spec/features/feature-metrics.md), [Result Contract and Error Table](../spec/features/feature-result-contract.md).
- Operator guides: [Provider Conditions and Parks](../guides/provider-conditions-and-parks.md), [Z.AI peak-hours hook](../guides/zai-peak-hours-hook.md), [OpenCode model configuration](../guides/opencode-model-configuration.md).
- Prior change record for conventions: `doc/changes/2026-11/2026-11-18--GH-346--installable-versioned-binary/chg-GH-346-spec.md`.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-19 | @spec-writer | Initial specification: zone-aware peak windows with the injected port and the declared DST rule; budget ceilings with the window-park and ticket-refusal split; the per-repository policy clause with its precedence matrix; runtime policy independence; offline simulation; the one-time legacy migration with its closed grammar, mapping table, and credential firewall; watch observation freshness; the declared conformance and documentation surface, with the six decision records encoded and the ticket's divergences stated |

---

## AUTHORING GUIDELINES

- Authored from the GitHub issue 350 body (goal, task list, six acceptance clauses, the F2 flip-priority paragraph, and the owner's cost-control directive), the six binding decision records, the planning-session notes, and the delivered contracts named in §16 and Appendix H. No invention beyond those sources: every normative detail of a decision record is carried into a capability, a table, or an acceptance criterion rather than re-litigated.
- The ticket says budgets "park rather than overspend" and a per-ticket ceiling is a terminal refusal here. That divergence is recorded once (DEC-7), traced in §17, and surfaced to the owner at review rather than silently dropped or silently implemented as a fabricated park.
- Hook migration cannot succeed for a program-shaped hook, and the shipped example is a program. The supported posture is stated in F-6, in the flow, in the refusal reason table, and in the guide obligation — never softened into an implied import.
- The legacy profile grammar is not documented in this repository, so the mapping table is closed at the names observed in the shipped hook example and its tests, every mapping is literal-to-literal, and anything unaddressable is disclosed by name. The table's targets are the delivered default names, so it introduces no new literal class.
- The delivered live watch read has zero age. Staleness is therefore stated as prospective plus clamp-enforced, and the documentation obligation forbids implying everyday detection.
- The pre-spawn gate can land one increment above a ceiling. That bound is stated in §1, F-2, NFR-8, RSK-5, and the guide obligation rather than buried in a record.
- Judgement calls the records deliberately left to the specification are recorded as decisions with their rationale (DEC-8 through DEC-15), so a downstream reader can see which spellings, counts, and postures were chosen here and why.
- Scope discipline: this specification states behaviour, contracts, refusals, matrices, schemas, and acceptance only. Internal module structure beyond the declared architecture map, and the exact test cases, belong to the plan and the test plan.
- The conformance and documentation obligations are declared as contracts (F-8, §16, AC-F8-1 … AC-F8-4) because the aggregate gates and the documentation checks enforce them: a vocabulary member cannot land without its documented row, its corpus row, its inventory entry, and its moved count.

## VALIDATION CHECKLIST

- [x] `change.ref` matches the provided `workItemRef` (GH-350)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] `change.milestone` equals the pm-notes milestone verbatim ("M4: Jaiship-native delivery")
- [x] All sections present in order (1–25 plus authoring guidelines and this checklist)
- [x] ID prefixes consistent and unique (`F-`, `DM-`, `NFR-`, `AC-`, `RSK-`, `OQ-`, `DEC-`)
- [x] Every acceptance criterion references at least one `F-`/`DM-`/`NFR-` and uses Given/When/Then
- [x] Every `F-` capability is exercised by at least one acceptance criterion; every `NFR-` is bound to at least one
- [x] NFRs are quantified
- [x] Risks include impact, probability, mitigation, and residual risk
- [x] The six decision records are encoded by id as decisions, not re-decided
- [x] No implementation task, file-content edit, commit instruction, or merge-request template appears
- [x] The declared divergences and limits are stated honestly (ticket-scope refusal, hook posture, live-watch age, pre-spawn bound)
