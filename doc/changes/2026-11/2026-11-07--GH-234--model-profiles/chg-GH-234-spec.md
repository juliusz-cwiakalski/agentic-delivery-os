---
change:
  ref: GH-234
  type: feat
  status: Proposed
  slug: model-profiles
  title: "M1-S21: Model profiles and provider watching"
  owners: [engineering]
  service: delivery-os provider engine
  labels: [change, planning]
  version_impact: minor
  audience: internal
  security_impact: high
  risk_level: medium
  dependencies:
    internal: [provider engine, harness adapters, config layer, state layer, result contract, credential port]
    external: [coding-plan subscription quota endpoints, DeepSeek balance API, OpenAI subscription usage windows]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make model routing profile-driven machinery instead of agent/operator discipline — tiers, profiles, selection heuristics, eligibility chains, provider watching, park/switch/revert semantics, subscription pacing, and validated data-record spawn injection — so quota and cost policy are enforced by the engine at every spawn rather than maintained by hand.

## 1. SUMMARY

Deliver model profiles and provider watching for the provider family: tiers as responsibility structure and profiles as model-per-tier assignments with per-agent overrides, all declared as typed layered configuration together with declarative selection heuristics, hard capability gates, and a preference chain whose eligibility requires every provider a profile uses to be available (probes lazy and memoized). Extend provider watching to the first-iteration set — the coding-plan subscription quota endpoints (weekly and rolling windows), the DeepSeek balance API, and the OpenAI subscription usage windows — as new normalized snapshot mappings behind the delivered provider engine. Add park/switch/revert semantics at the profile level: expensive windows park with cause and expiry, subscription exhaustion switches to the next eligible profile instead of parking, and the persisted target profile reverts automatically on recovery. Add subscription pacing as configuration with a typed `pacingClass` field on seat assignments (judgment | execution) that the engine enforces. Integrate spawn: profile resolution always runs before any harness spawn, and `provider profile resolve --for-spawn` emits the resolved model environment as validated data records (record format `data-v1`), never shell code, with the legacy env-record validation contract carried over and adversarially hardened. The legacy resolver's decision table (chain order, lazy probes, park-versus-switch, revert, condition seams) is covered by ported tests.

Dispatch-daemon integration, the audit ledger, and spend reporting are explicitly out of scope: this change delivers the machinery and the seam those stories (M1-S9, M1-S22, M1-S19/M2) consume.

## 2. CONTEXT

### 2.1 Current State Snapshot

The provider engine v1 (M0-S13) is delivered: typed provider configuration in the layered catalog, deterministic subscription-first chain resolution with a closed eight-value skip-reason set, UTC peak-window and quota evaluation combined by MAX, named self-expiring parks persisted as additive state records, fail-loud announcements, credential-port-only quota authorization, and a guarded vocabulary whose growth requires a spec update (and, where cross-cutting, a decision record). Its feature spec explicitly excludes model-profile selection: it decides *which provider entry is available*, not *which model an agent runs*.

The harness adapter seam (M1-S11) is delivered: harness-neutral instance/session ports, the opencode and Claude Code adapters, and a deny-by-default execution-environment descriptor that builds the child spawn environment from declared data and reads no ambient environment. Its feature spec explicitly excludes model profiles.

Model routing today is hand-maintained: model assignments live as manual model-environment variables (`OC_ADOS_AGENT_*_MODEL`), applied through the legacy bash hook's data-only env-record contract (`ADOS_HOOK_ENV_V1`), which already carries a name allowlist and rejects duplicate names, metacharacters, homoglyphs, NUL, CR, and missing final-LF, with size and file-metadata checks — validation precedents proven by the in-repo hook regression tests. Provider watching covers only the Z.AI quota endpoint. There is no profile concept, no tier structure, no capability gate, no automatic switch-or-park across profiles, no revert-on-recovery, and no subscription pacing. The dispatch daemon (M1-S9) and the command audit ledger (M1-S22) are still open; the M1 roadmap's exit-evidence table assigns this story the "spawns resolve profiles" criterion, evidenced by zero manual model-environment overrides in the final two weeks.

### 2.2 Pain Points / Gaps

- Model routing is agent/operator discipline, not machinery: every spawn depends on hand-set model environment variables, and nothing at spawn time enforces quota or cost policy.
- There is no profile concept: no tier structure, no per-agent overrides, no declarable selection heuristics, and no preference chain, so model choice is neither testable nor replayable.
- An exhausted subscription provider is discovered at task failure time rather than avoided: there is no switch to a next eligible profile and no automatic revert when the provider recovers.
- Expensive windows (peak hours, priced multipliers) are invisible to model choice; there is no park-with-cause-and-expiry at the profile level and no guaranteed resume when a window clears.
- Provider watching covers a single vendor quota shape; the coding-plan subscription windows, DeepSeek balance, and OpenAI usage windows are unwatched.
- Nothing prevents a text-only seat from receiving a vision task; capability constraints are not machinery.
- Subscription quota is not paced: there are no declared goal priorities or rungs, and no typed field distinguishing judgment seats from execution seats.
- Manual model-environment overrides are unauditable today (the audit ledger arrives with M1-S22), and the validated env-record contract exists only inside the legacy bash hook rather than as an engine-level, harness-neutral contract.

## 3. PROBLEM STATEMENT

Because model routing exists only as hand-maintained environment variables with no profile machinery, a spawn cannot be routed by declared policy: quota exhaustion and expensive windows are discovered by failure instead of avoided by switch-or-park, recovery never reverts the target, capability mismatches (a text-only seat receiving a vision task) are unguarded, subscription pacing is unenforceable, and the model each agent ran is unexplainable and unauditable — resulting in wasted subscription quota, unaccounted paid spend, silent stalls, and routing behavior that differs between the CLI and the (upcoming) dispatch daemon.

## 4. GOALS

- **G-1**: Declare tiers, profiles, per-agent overrides, capability descriptors, pacing goal priorities, rungs, thresholds, and preference chains as typed, validated, layered configuration; tuning them requires no code change.
- **G-2**: Encode selection heuristics as deterministic, replayable declarative policy (consequence of an error × reasoning depth ÷ volume; amplification and family-diversity rules declared, never hardcoded).
- **G-3**: Enforce hard capability gates in the engine: a text-only seat never receives a vision task, regardless of chain position or quota pressure.
- **G-4**: Resolve a profile only when every provider it uses is available, with lazy, memoized probes; report each ineligible profile with named blockers.
- **G-5**: Watch the first-iteration provider set through the provider engine as new normalized snapshot mappings, with the engine's fail-loud and secret-safety rules unchanged.
- **G-6**: Park expensive windows with cause and expiry and resume exactly when the window clears; on subscription exhaustion switch — never park — to the next eligible profile; persist the target profile in state and revert automatically on recovery.
- **G-7**: Enforce subscription pacing as configuration: declared goal priorities and rungs move only seats whose typed `pacingClass` is `execution`; judgment seats are structurally immovable by rungs.
- **G-8**: Guarantee that profile resolution runs before every harness spawn and that the resolved model environment reaches the spawn wrapper only as validated data records — never shell code — with the env-record schema adversarially hardened.
- **G-9**: Port the legacy resolver's decision table as tests over the enumerated groups (chain order, lazy probes, park-versus-switch, revert, condition seams), and grow the guarded vocabularies (announcements, state records, error identities) with in-change synchronization.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Spawns that start without a resolved profile | 0; resolution-before-spawn is enforced on every spawn surface |
| Spawns where a text-only seat received a vision task | 0 (hard gate) |
| Pacing rungs that moved a `judgment`-class seat | 0 |
| Exhaustion episodes without an automatic switch to the next eligible profile | 0 |
| Recovered subscriptions without an automatic revert of the persisted target | 0 |
| Parks missing a closed cause or an absolute expiry | 0; resume occurs exactly at window clear |
| Configuration-only behavior changes (chain, thresholds, rungs, overrides) demonstrated by tests without code edits | 100% of those knobs |
| Ported decision-table groups with delivered test coverage | 5 of 5 (chain order, lazy probes, park-versus-switch, revert, condition seams) |
| Adversarial env-record classes rejected | 100% of the enumerated classes in Appendix D |
| Duplicated switch/revert/ineligible events for an unchanged condition | 0 (deterministic identity + dedupe) |
| Secret bytes in envelopes, env records, state records, events, or evidence | 0; watch authorization is credential-port-only |
| Live network calls, live credentials, or real sleeps in the test suite | 0 |

### 4.2 Non-Goals

- **NG-1**: No dispatch-daemon integration. The daemon (M1-S9) consumes the `--for-spawn` seam; this change delivers the seam and the current spawn surfaces only.
- **NG-2**: No audit ledger. The milestone-exit evidence surface is M1-S22; this change delivers the machinery the criterion measures.
- **NG-3**: No spend reporting, cost dashboards, or metrics exporters. Selection events are emitted for later stories (M1-S19 / M2-S6) to consume.
- **NG-4**: No non-UTC peak windows, cross-midnight windows, or local-timezone pricing windows; the engine v1 UTC basis is unchanged.
- **NG-5**: No background watchers, timers, or daemons for watching, switching, or reverting; all transitions are observed at resolution time, consistent with engine read-time expiry.
- **NG-6**: No modification or retirement of the legacy bash hook; its env-record contract carries over as data, and the hook remains untouched until its surfaces consume the seam.
- **NG-7**: No tracker, VCS, or CI provider work, and no MCP/OpenCode provider surfaces; this family is AI model hosts only.
- **NG-8**: No implementation of the difficulty proposal/cross-validation flow; the declarative heuristics framework ships, and proposal cross-validation remains the declared escalation path when policy is ambiguous.
- **NG-9**: No new harness adapters and no changes to delivered adapter capability gaps.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Profile, tier, pacing, and preference-chain configuration model | Routing must be declarative, validated, layered data — not hand-maintained environment discipline — so tuning needs no code change. |
| F-2 | Declarative selection heuristics as policy data | Model choice must be deterministic, replayable, and explainable; heuristics in code are neither auditable nor tunable. |
| F-3 | Hard capability gates | A capability mismatch (text-only seat, vision task) is a correctness defect that quota pressure must never excuse. |
| F-4 | Eligibility chain with lazy, memoized provider probes | A profile is a candidate only when every provider it uses is available; laziness bounds cost, memoization bounds fetches. |
| F-5 | Provider watching for the first-iteration provider set | Switch/park/revert/pacing decisions need live provider conditions; three new vendor shapes enter behind the engine's mapping rules. |
| F-6 | Profile-level park, switch, and revert with persisted target | Exhaustion must switch (not stall), expensive windows must park with a guaranteed resume, and recovery must restore the preferred target. |
| F-7 | Subscription pacing rungs bound to typed pacingClass seats | Quota preservation is policy; the typed field makes judgment seats structurally immovable instead of protected by naming convention. |
| F-8 | Spawn-time resolution and validated env-record emission | One selection decision before every spawn, injected as hardened data records, removes manual overrides and shell-injection risk. |
| F-9 | CLI surface: `provider profile resolve` and `provider watch status` | Operators, agents, and the future daemon need a testable command surface for the selection decision and watch state. |
| F-10 | Guarded vocabulary growth with in-change synchronization | New events, record kinds, and error identities must land with the machine/documented tables and specs in sync. |
| F-11 | Ported decision-table test coverage | The legacy resolver's semantics survive the rewrite: the five enumerated groups anchor the parity suite. |

### 5.1 Capability Details

- **F-1**: The typed provider catalog branch gains profile-model configuration. A **tier** (working names: lite, regular, powerful) is a responsibility group — a class of profiles from which a delivery selects. A **profile** is a named model-per-tier assignment (which model each seat/tier uses) plus optional per-agent overrides, a capability descriptor per seat (for example, vision-capable or text-only), the set of providers the profile uses, and a typed `pacingClass` per seat assignment (F-7). A **preference chain** declares the base profile, fallback profiles, and chain order. **Pacing configuration** declares goal priorities (utilize the subscription window; keep the judgment seat until a configured tail; minimize paid use), named rungs, and the thresholds that move seats between rungs. All of it layers through the existing catalog rules (record maps merge by child name, lists replace whole, reset removes inherited values, provenance visible through config inspection), is validated fail-closed (unknown references, duplicate names, ordering violations, and unknown keys are classified configuration errors, never silent defaults), and ships **empty by default**: a fresh installation resolves no profile and refuses spawns with a classified error until an operator declares profiles and a preference chain — mirroring the shipped engine rule that no chain is enabled by default.

- **F-2**: Selection heuristics are declarative policy data evaluated by the engine, not agent reasoning: a task's model assignment weighs the consequence of an error, the reasoning depth the task needs, and its volume; amplification rules (when a class of task warrants a higher tier) and family-diversity rules (avoid concentrating a delivery on one model family when declared) are declared in configuration. Evaluation is deterministic and replayable from configuration plus provider facts; experiments with different heuristics require a decision record, not a code edit. Every selection is recorded as a telemetry event carrying the profile, tier, rung, and reason (EVT-5), giving later spend/metrics stories their join key.

- **F-3**: Capability gates are hard rules evaluated before eligibility preference: a seat whose capability descriptor is text-only is refused for a vision task regardless of its chain position, quota advantage, or rung. The refusal is not a fallback-by-accident: the eligibility list names the capability blocker per refused profile, and selection proceeds with the next eligible, capable candidate — or fails closed with a classified refusal when none exists. The gate reads the declared capability descriptors; it infers nothing from profile names.

- **F-4**: A profile is a candidate if and only if every provider it uses is available under the engine's existing conditions (enabled, peak, quota, parks). Availability probes are **lazy** — a provider is probed only when a decision depends on it — and **memoized** within a resolution pass, so N profiles sharing one provider cause at most one probe. Each ineligible profile is reported with a verdict and named blockers drawn from the engine's closed condition vocabulary (for example, "coding-plan quota exhausted, weekly window at threshold"). Probe failure is never treated as availability (fail-loud carries over).

- **F-5**: Watching extends the provider engine with three normalized snapshot mappings behind the existing quota transport seam: the coding-plan subscription quota endpoints (weekly and rolling windows), the DeepSeek balance API (balance compared to a configured floor), and the OpenAI subscription usage windows (declared usage windows and percentages). Each mapping normalizes its vendor response into the engine's secret-free snapshot vocabulary; every malformed, non-auth-HTTP, transport, or credential failure classifies exactly as the engine classifies today (outage/credential park semantics, `reset_missing`-style announcements where applicable), never as clear. Authorization resolves only through the credential port. Watch reads (`provider watch status`) are read-only and write no state; mutating resolution persists parks and events as the engine does today.

- **F-6**: Profile-level pause semantics reuse the engine's park vocabulary. A provider in an **expensive window** (declared peak hours or a priced multiplier above threshold) parks with a closed cause, active conditions, and an absolute expiry at the window end; it resumes exactly when the window clears (read-time expiry; no timer). A provider whose subscription is **exhausted** does not park the spawn: the chain **switches** to the next eligible profile automatically (switch-not-park), the switch event carries the new target and the revert condition (EVT-1), and the selected target profile **persists in state** as an additive record (EVT-4) so behavior is stable across spawns. When the exhausted provider **recovers**, the target **reverts automatically** to the preferred profile and a revert event is recorded (EVT-2). No sleep-without-record path exists: every pause, switch, and revert is a record or a classified outcome.

- **F-7**: Every seat assignment carries a typed `pacingClass` field with the closed values `judgment` and `execution`. Pacing rungs — configuration-declared levels such as a cruise rung and degraded rungs, with the goal priorities of F-1 — move **only** seats whose declared `pacingClass` is `execution`; a configuration that attempts to move a judgment seat via rungs is rejected at validation or structurally inert in the engine, and the engine's enforcement is the field, not a profile-naming convention. Judgment seats stay on their assigned model until the declared tail threshold of the subscription window is crossed. Rung transitions are recorded (EVT-5) and deduplicated.

- **F-8**: Profile selection always runs before any harness spawn, whether initiated from the CLI or (later) the dispatch daemon; a spawn never starts without a resolved profile, and resolution failure is a classified, announced refusal — never an implicit model. `provider profile resolve --for-spawn` emits the resolved model environment as **validated data records** with `recordFormat: data-v1` (F-1 field names, values as data), and the spawn wrapper injects that environment into the harness spawn-env seam's deny-by-default construction. The legacy env-record contract carries over as data: a header line, `set NAME=value` / `unset NAME` records, a final line feed, and size limits; the name allowlist pattern (`OC_ADOS_AGENT_*_MODEL` built-in, overridable by configuration) carries over; and the validation schema is adversarially hardened beyond the legacy checks (Appendix D). Values are never shell-interpreted: the record is data consumed by the spawn wrapper, not a script for a shell.

- **F-9**: The provider command surface gains two subcommands and one flag: `provider resolve --profile <name>` (resolve for a named profile context), `provider profile resolve [--agent <name>] [--for-spawn]` (the selection decision every spawn runs; `--for-spawn` adds the env record), and `provider watch status [--provider <name>]` (per-provider condition, source, and check time). Machine results are CommandResult envelopes whose `data` shapes are fixed in Appendix C; exit statuses follow the delivered provider convention (0 resolved/read; 1 misconfiguration, classified; 2 all candidates skipped/exhausted, announced with reasons). Invalid grammars fail as classified invocation errors.

- **F-10**: Vocabulary growth lands in-change under the engine's guarded-set rules: new announcement/event codes for profile switch, revert, and ineligibility (EVT-1..3); one new additive state record kind for target-profile persistence (EVT-4); a selection telemetry event (EVT-5); and any new error identities appended to the machine and documented error tables in both directions with exact-code classification and `fallback.internal` containment. Where an addition is cross-cutting beyond the provider family, a decision record accompanies it per the engine's maintenance rules.

- **F-11**: The legacy resolver scripting's decision table is covered by ported tests over the five enumerated groups (Appendix A): chain order, lazy probes, park-versus-switch, revert, and condition seams. Per the recorded PM decision, "ported tests" means these ticket-enumerated groups, not an ID-for-ID mapping to an external battery; if the owner surfaces the external battery at review, the mapping extends then. Every legacy fail-open or fail-stuck class in the enumerated table asserts a structured event or classified outcome — no silent behavior.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Spawn-time profile resolution (every harness spawn)
  Spawn request (CLI today; daemon later)
    → profile resolution runs first (F-8)
    → eligibility chain walks the preference chain (F-4):
        capability gate (F-3) → provider availability (lazy, memoized probes)
    → first eligible profile selected; selection event recorded (F-2)
    → `--for-spawn` emits envRecord as validated data (data-v1)
    → spawn wrapper injects the record into the harness spawn-env seam (deny-by-default)
    → spawn starts. No resolved profile → classified refusal; spawn never starts.

Flow 2: Subscription exhaustion → switch → revert
  Coding-plan quota crosses threshold
    → mixed profile ineligible (blocker named: quota exhausted)
    → chain switches to next eligible profile (deepseek) — switch event
      carries new target + revert condition (EVT-1)
    → target profile persisted in state (EVT-4); later spawns use it
    → subscription resets/recovers on a later resolution
    → revert event recorded (EVT-2); target reverts to mixed automatically.

Flow 3: Expensive window → park → exact resume
  Provider enters declared peak window (or priced multiplier crosses threshold)
    → provider parks with cause + absolute expiry at window end (F-6)
    → profiles using it become ineligible with the park named as blocker
    → chain proceeds with another profile, or parks the decision honestly
    → window clears → next resolution observes expiry passed → provider resumes;
      no timer, no background job (read-time expiry).

Flow 4: Subscription pacing rung
  Watched windows show utilization crossing a declared threshold
    → rung adjustment evaluates goal priorities (F-1, F-7)
    → seats with pacingClass `execution` move per the rung;
      `judgment` seats never move (engine-enforced typed field)
    → rung transition recorded with profile, rung, reason (EVT-5).

Flow 5: Watch status (read-only)
  Operator or agent runs `provider watch status [--provider <name>]`
    → each configured provider reports name, condition, source, checkedAt
      from its normalized snapshot mapping (F-5)
    → zero state writes; malformed vendor responses surface as outage
      conditions, never as clear.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The profile/tier/pacing/watch configuration branch in the layered catalog (F-1): tiers, profiles, per-agent overrides, capability descriptors, preference chains, pacing goal priorities, rungs, thresholds — validated fail-closed, empty by default.
- The selection engine: declarative heuristics (F-2), hard capability gates (F-3), eligibility chains with lazy memoized probes and named blockers (F-4).
- Provider watching transports for the first-iteration set — coding-plan subscription quota endpoints (weekly + rolling windows), DeepSeek balance API, OpenAI subscription usage windows — as new normalized snapshot mappings behind the provider engine (F-5).
- Park/switch/revert semantics at the profile level, including target-profile persistence in state as an additive record kind with revert-on-recovery (F-6).
- Subscription pacing as configuration with typed `pacingClass` seats enforced by the engine (F-7).
- Spawn integration on current surfaces: resolution before every spawn, `--for-spawn` env records as validated data (`data-v1`), hardened env-record validation carrying over the legacy `ADOS_HOOK_ENV_V1` contract (F-8).
- CLI surface: `provider resolve --profile`, `provider profile resolve [--agent] [--for-spawn]`, `provider watch status [--provider]` (F-9).
- Guarded-vocabulary growth synchronized in-change: switch/revert/ineligible events, target-profile record kind, selection event, new error identities, error-table sync (F-10).
- Ported decision-table tests over the five enumerated groups (F-11, Appendix A).

### 7.2 Out of Scope

- [OUT] Dispatch-daemon integration consuming the spawn seam (M1-S9, GH-239, open).
- [OUT] Command audit ledger and its override-evidence surface (M1-S22, GH-223, open); the milestone-exit criterion's evidence arrives there.
- [OUT] Spend reporting, cost dashboards, metrics exporters (M1-S19 / M2-S6) — later consumers of the selection events.
- [OUT] Difficulty proposal/cross-validation flow implementation beyond the declared escalation-path policy; difficulty re-scoring mid-delivery.
- [OUT] Non-UTC peak windows and local-timezone pricing windows.
- [OUT] Background watchers, timers, or daemons for watching, switching, or reverting.
- [OUT] Modification or retirement of the legacy bash hook; its contract carries over as data only.
- [OUT] MCP/OpenCode provider surfaces; tracker/VCS/CI providers.
- [OUT] New harness adapters or changes to delivered adapter capability gaps.
- [OUT] ModelPolicy typed-primitive refinement beyond the declarative framework (M2 refinement).

### 7.3 Deferred / Maybe-Later

- Additional watch targets beyond the first-iteration set (each is a new normalized snapshot mapping with fixtures, per the engine's maintenance rules).
- Tier renames when the naming lock concludes (lite/regular/powerful are working names).
- Difficulty re-scoring mid-delivery and proposal/cross-validation flow delivery.
- Multi-window pacing optimization across overlapping subscriptions.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. No HTTP server surface is introduced. The command surface is CLI-only; its contracts are the command grammar and envelope shapes in F-9 and Appendix C. All vendor traffic is outbound HTTPS through the provider engine's existing quota-transport seam (F-5).

### 8.2 Events / Messages

| ID | Event / Message | Contract |
|----|-----------------|----------|
| EVT-1 | Profile switch event | Emitted when selection switches from the persisted target to the next eligible profile on exhaustion. Carries the previous target, the new target, and the revert condition. Informational-adjacent (routing was preserved); deterministic identity prevents duplicates for an unchanged condition. |
| EVT-2 | Profile revert event | Emitted when a recovered provider allows the target to revert automatically to the preferred profile. Carries the restored target and the recovering provider. |
| EVT-3 | Profile-ineligible event | Emitted with the eligibility verdicts: per refused profile, the verdict and named blockers (condition or capability). Surfaced in the `eligibility[]` list of the selection envelope; never silently dropped. |
| EVT-4 | Target-profile persistence record | One new additive state record kind inside the existing state schema (own payload schema identifier, store-scoped key, single-writer fence, verified post-append read; latest record wins). Carries the current target profile, the reason (selection, switch, revert), and the revert condition when present. No schema-version bump or migration. |
| EVT-5 | Selection event | One structured event per selection decision carrying profile, tier, rung, reason, and eligibility blockers when the top candidate was refused. The later spend/metrics stories consume these; no exporter ships here. |

New announcement/event codes join the engine's closed, guarded code set; severity, safe templated messages, bounded allowlisted evidence, and dedupe rules carry over unchanged. No event carries secrets, authorization headers, raw vendor bodies, or endpoint userinfo.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Tier | A named responsibility group (working names lite, regular, powerful) grouping profiles a delivery selects from; declared in the typed catalog branch; exact-key discipline for the fixed shape. |
| DM-2 | Profile | Named model-per-tier assignment: model per tier/seat, optional per-agent overrides, capability descriptor per seat (closed capability vocabulary, e.g., vision-capable / text-only), the set of providers it uses, and the profile's position data for the preference chain. |
| DM-3 | Seat assignment with pacingClass | A seat's assignment carries the typed field `pacingClass` with the closed values `judgment` and `execution`; the engine enforces rung movement by this field. |
| DM-4 | Preference chain | Declared base profile, fallback profiles, and chain order; validated fail-closed (no unknown references, no duplicates, non-empty). |
| DM-5 | Pacing configuration | Declared goal priorities (utilize subscription window; keep the judgment seat until a configured tail; minimize paid use), named rungs, and thresholds; all values configuration, none hardcoded. |
| DM-6 | Eligibility verdict | Per profile: `eligible` or `ineligible` with a blockers list naming the engine condition or capability gate; lazy evaluation order follows the preference chain. |
| DM-7 | Env record (`data-v1`) | The resolved model environment as validated data records: header line, `set NAME=value` / `unset NAME` records, final line feed, size limits, name allowlist match, and the hardened validation classes of Appendix D; `recordFormat: data-v1` declared in the envelope `envRecord`. Never shell code; values never shell-interpreted. |
| DM-8 | Selection decision | Envelope data: selected profile, rung, agent overrides, eligibility list, envRecord (with `--for-spawn`), and events; or a classified refusal with the eligibility list and announcements. |
| DM-9 | Watch condition view | Per provider: name, condition (engine condition vocabulary), source (mapping identifier plus human summary, e.g., "weekly 61%, 5h window 12%"), checkedAt. |
| DM-10 | Expensive window | Declared peak hours or priced-multiplier threshold that parks the provider with the engine's closed cause set and an absolute expiry at window end. |

### 8.4 External Integrations

Three vendor integrations enter behind the provider engine, each as a new normalized snapshot mapping with fixtures per the engine's maintenance rules:

- **Coding-plan subscription quota endpoints** — weekly and rolling windows; authorization via the credential port; windows normalized into the snapshot vocabulary with threshold/reset semantics consistent with the engine's quota rules.
- **DeepSeek balance API** — balance normalized and compared to a configured floor; below-floor behaves as the engine's exhaustion class with a declared recovery condition (top-up is operator action; the revert condition is recorded honestly).
- **OpenAI subscription usage windows** — declared usage windows and percentages normalized like quota limits; window end supplies the park expiry.

All endpoints must be HTTPS without userinfo; credential material resolves only through the credential port, is handed once to the transport, and never appears in any record. Every malformed, non-auth-HTTP, transport, or credential failure classifies exactly as the engine classifies today and is never treated as clear. No tracker, VCS, or CI API is touched.

### 8.5 Backward Compatibility

All changes are additive at the user-visible level. Existing `provider resolve`, `quota`, and `parks list` behavior, envelopes, exit conventions, state schema version, and error rows are unchanged; new error identities are appended, never renumbered. The new configuration branches ship empty, so no existing configuration becomes invalid; a fresh installation that declares nothing continues to fail closed exactly as the engine does today for chains. The legacy bash hook is untouched; its `ADOS_HOOK_ENV_V1` contract carries over as the data contract for the current bash spawn surface, so existing allowlists and validated records remain valid. The harness spawn-env seam is consumed as delivered — the deny-by-default construction and its secret-read boundary gain no new ambient reads and no secret-read allowlist entries. The intentional behavior change is confined to the new machinery: model routing moves from manual overrides to profile resolution, which is precisely the story's purpose; surfaces that never spawned (none today resolve profiles) are unaffected.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism | Identical configuration, provider facts, and injected clock produce identical selection decisions, eligibility lists, env records, and event identities across 100 repeated runs; no ambient clock, randomness, locale, or environment enters selection policy. |
| NFR-2 | Hermetic tests | 0 live network calls, 0 live credential reads, 0 real sleeps in the test suite; clock, transports, credential port, and state store are injected. |
| NFR-3 | Runtime neutrality | Selection policy is pure (imports only core contracts; 0 runtime-API access); watch transports are declared adapter edges; secret-read boundary stays green with 0 new allowlist entries. |
| NFR-4 | Secret safety | 0 secret bytes, authorization headers, credential values, or raw vendor bodies in envelopes, env records, state records, events, diagnostics, or evidence; watch authorization is credential-port-only with one-time material handoff. |
| NFR-5 | Probe laziness and memoization | Per resolution pass, at most one availability probe per distinct provider regardless of how many profiles reference it; providers are probed only when a decision depends on them; probe count ≤ number of distinct providers in the evaluated chain. |
| NFR-6 | Evaluation cost | Pure eligibility evaluation of 100 profiles over a 100-provider configuration completes in ≤ 50 ms on the reference environment, excluding probe transport time. |
| NFR-7 | Env-record hardening | 100% of the adversarial classes in Appendix D are rejected with a classified refusal; values are never shell-interpreted; unauthorized names, duplicates, homoglyphs, metacharacters, NUL, CR, embedded equals-in-name, missing final LF, and over-limit payloads never reach a spawn. |
| NFR-8 | Bounded evidence | Event and state-record evidence ≤ 1024 serialized bytes and ≤ 20 fields, drawn only from the closed allowlists carried over from the engine. |
| NFR-9 | Idempotence | Unchanged provider/profile conditions append 0 duplicate switch, revert, ineligible, or selection events; a revert is recorded exactly once per exhaustion episode; repeated `watch status` and read-path resolves perform 0 state writes. |
| NFR-10 | Error-table synchronization | 100% of new error identities exist in the machine and documented tables in both directions; classification is exact-code and total with `fallback.internal` containment; existing rows unchanged. |
| NFR-11 | Configuration-only tuning | Changing the preference chain, thresholds, rungs, or per-agent overrides requires 0 code changes and is demonstrated by tests that alter configuration only. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- Every selection decision is recorded as a selection event (EVT-5) with profile, tier, rung, and reason — the concept's "every selection is recorded" rule — forming the join key for later spend/metrics stories without shipping any exporter here.
- Switch, revert, and ineligible events (EVT-1..3) carry bounded, allowlisted evidence: previous/new target, revert condition, blockers per refused profile.
- `provider watch status` reports per-provider condition, source, and checkedAt (DM-9); `provider profile resolve` returns the full selection decision including the eligibility list (DM-8).
- Park and announcement vocabulary persists exactly as the engine delivers today; profile-level pauses reuse it rather than inventing a parallel one.
- No metrics exporter, trace span, or event bus is introduced; no diagnostic carries credential or secret material.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Guarded-vocabulary growth (new event codes, one new state record kind, new error identities) drifts out of sync with the machine/documented tables and specs | M | H | Declared in-change (F-10); error-table sync tests updated in the same change; spec/maintenance update included; decision record where the addition is cross-cutting per the engine's rules | L |
| RSK-2 | Vendor watch shapes drift (endpoints, envelope fields, window semantics), producing malformed snapshots or wrong conditions | M | M | Defensive normalization into the snapshot vocabulary; every malformed class is an outage/credential condition, never clear; fixture-driven tests per mapping | M — external APIs are outside this repo's control |
| RSK-3 | The external legacy resolver battery is not in-repo; "ported tests" could silently diverge from the original decision table | M | M | PM decision recorded: the ticket-enumerated five groups define the table (Appendix A); divergence after delivery is a defect per the seeded scenarios; external battery, if surfaced at review, extends the mapping | L |
| RSK-4 | An env-record validation gap lets model environment be injected as shell code or via unauthorized names | H | L | Data-only record format (`data-v1`); allowlist match; hardened rejection classes (Appendix D); values never shell-interpreted; adversarial tests; legacy validation precedents carried over | L |
| RSK-5 | Switch/revert oscillation when a provider flaps between exhausted and recovered, thrashing targets | M | M | Memoized probes bound probe churn; the revert condition is recorded on switch; target persistence stabilizes behavior across spawns; declared thresholds gate transitions; events dedupe | L |
| RSK-6 | The milestone-exit criterion cannot be fully evidenced by this change because the dispatch daemon (M1-S9) and audit ledger (M1-S22) are open | M | H | Criterion is milestone-scoped per the ticket; this change delivers the machinery and the seam; dependency tracked in Section 13; the CLI surface already exercises the decision path | M until the dependent stories land |
| RSK-7 | Capability descriptors are wrong in configuration (a vision-capable model declared text-only, or vice versa), causing wrong refusals or gate bypass | M | M | Capability vocabulary is closed and validated; the gate reads declared descriptors only; refusal names the blocker so misconfiguration is visible; tests cover both directions | L |
| RSK-8 | Event noise or ledger growth from frequent rung or switch transitions | L | M | Deterministic identity and dedupe; bounded evidence; rungs move only on declared threshold crossings; persistence appends only on change | L |

## 12. ASSUMPTIONS

- The engine v1 condition set (enabled, peak, quota, outage, credential) is sufficient to express profile eligibility; no new provider-condition kinds are required.
- The harness spawn-env seam accepts constructed environment data and can receive the resolved model environment as records, per the delivered deny-by-default descriptor.
- The legacy env-record grammar (header line, `set`/`unset` records, final LF, size limits, file-metadata checks) is an accurate carry-over contract for the current bash spawn surface.
- The coding-plan endpoints expose weekly and rolling window utilization; the DeepSeek balance API exposes a numeric balance comparable to a configured floor; the OpenAI usage endpoints expose declared windows with percentages.
- Expensive windows are declared in UTC, consistent with the engine v1 basis; operators declare the UTC-equivalent of any local pricing window.
- Tier working names (lite, regular, powerful) may be renamed without structural change; names are configuration identifiers.
- Selection telemetry events are sufficient for later spend attribution; SpendRecord joins arrive in a later story.
- Proposal/cross-validation of difficulty remains the escalation path when the declarative heuristics are ambiguous; the engine never infers difficulty from free-form reasoning alone.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Provider engine v1 (M0-S13, GH-182 — delivered) | Conditions, parks, announcements, MAX rule, snapshot-mapping maintenance rules, guarded vocabularies, quota transport seam. |
| Depends on | Harness adapters (M1-S11, GH-233 — delivered; branch base a69b555e) | Deny-by-default spawn-env seam and harness ports the env records flow into. |
| Depends on | Configuration layer | Typed catalog, `record` field kind, layered merge/reset, provenance, fail-closed validation. |
| Depends on | State layer | Additive record kinds, single-writer fences, verified reads, no schema-version bump. |
| Depends on | Result contract | CommandResult envelope, error-table sync discipline, redaction chokepoint, exit projection. |
| Depends on | Credential port | Watch authorization for all three vendor integrations; secret-read boundary. |
| Consumed by (blocks) | Dispatch daemon (M1-S9, GH-239 — open) | Consumes `provider profile resolve --for-spawn` as its spawn seam. |
| Consumed by | Audit ledger (M1-S22, GH-223 — open) | Provides the milestone-exit override evidence this change's machinery is measured by. |
| Consumed by | Metrics and spend (M2-S6; M1-S19) | Consume selection events (EVT-5) for spend attribution. |
| Consumed by | Lifecycle agents (M1-S20) | Agent integration reads the resolved profile decision instead of hand-maintained model environments. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Final tier names — lite, regular, powerful are working names | The concept defers the names to the naming lock; renames are configuration identifiers plus docs. | Decision needed: consult `@decision-advisor` (naming lock outcome) |
| OQ-2 | Difficulty cross-validation precedence — coordinator proposal versus lifecycle validation on disagreement | The concept leaves the veto owner open; the escalation path is declared policy here, the flow is out of scope (NG-8). | Decision needed: consult `@decision-advisor` |
| OQ-3 | Does the owner hold an external legacy resolver test battery to port ID-for-ID (GH-182 style)? | Not present in-repo; the PM decision (2026-11-07) defines the table by the ticket-enumerated groups; an external battery would extend the mapping. | Open — surface at PR review; spec proceeds on the enumerated groups |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Seat assignments carry a typed `pacingClass` (values `judgment` and `execution`); pacing rungs move only execution-class seats — the field is what the engine enforces, not a naming convention | Ticket pinned decision; naming conventions are unenforceable and drift | 2026-11-07 |
| DEC-2 | Hard capability gates; eligibility = every provider available; probes lazy and memoized; switch-not-park on exhaustion with revert-on-recovery | Ticket pinned decision; correctness gates must not degrade under quota pressure, and stalls must become switches | 2026-11-07 |
| DEC-3 | The spawn wrapper emits validated data records, never shell code; the env-record schema is adversarially hardened (duplicates, metacharacters, homoglyphs, NUL/equals rejected); the legacy `ADOS_HOOK_ENV_V1` record contract and `OC_ADOS_AGENT_*_MODEL` allowlist carry over | Ticket pinned decision plus the in-repo legacy contract and its validation precedents; data-only records eliminate the shell-injection class | 2026-11-07 |
| DEC-4 | The milestone-exit criterion (all pilot-path spawns resolve through the engine; zero manual model-environment overrides in the final two-week audit window) is milestone-scoped; this change delivers the machinery and the seam | Ticket wording "declared in" the roadmap; the audit ledger is M1-S22 (GH-223) and the daemon is M1-S9 (GH-239) — both open. PM decision recorded in pm-notes | 2026-11-07 |
| DEC-5 | "Ported tests" means the ticket-enumerated decision-table groups (chain order, lazy probes, park-versus-switch, revert, condition seams), not an ID-for-ID mapping to an external battery | The legacy resolver scripting and its battery are not present in this repository (PM-verified); GH-182 had an in-repo battery, GH-234 does not. PM decision recorded in pm-notes | 2026-11-07 |
| DEC-6 | Spawn-integration scope = selection machinery + `provider profile resolve --for-spawn` env-record contract + current spawn surfaces; dispatch-daemon integration lands with M1-S9 | PM decision recorded in pm-notes; keeps this change deliverable without the open daemon story | 2026-11-07 |
| DEC-7 | Selection heuristics are deterministic, replayable declarative policy; heuristic experiments require a decision record | Concept guardrail adopted verbatim; replayability and auditability of routing choices | 2026-11-07 (adopted from the 2026-10-25 concept) |
| DEC-8 | Profiles, tiers, pacing, and watch targets are configuration data; adding a watch target is a new normalized snapshot mapping with fixtures | Concept design plus the engine's maintenance rules; routing and watching grow as data, not code branches | 2026-11-07 |
| DEC-9 | The profile configuration ships empty by default; a fresh installation refuses spawns with a classified error until profiles and a preference chain are declared | Mirrors the shipped engine rule (no chain enabled by default) and enforces AC-1 fail-closed semantics — no implicit model is ever invented | 2026-11-07 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Provider engine feature spec (SPEC-PROVIDER-ENGINE) | Updated — model-profile selection enters the provider family here (the spec today explicitly excludes it); per the first-spec rule, a new feature spec is warranted if the profile area deserves its own document; decided at doc-sync |
| Provider man page (M1 pack) | Updated — `provider resolve --profile`, `provider profile resolve`, `provider watch status` grammar, envelope shapes, exit statuses |
| CLI command registry | Updated — two new subcommands and one flag registered |
| Repository glossary | Updated — profile, tier, pacingClass, rung, eligibility, env record terms |
| Provider core policy (engine family) | New/extended — profile selection policy, capability gates, eligibility chain, pacing rung evaluation |
| Watch snapshot mappings (adapter family) | New — three normalized mappings with fixtures (coding-plan, DeepSeek, OpenAI) |
| CLI provider command | Extended — new subcommand handlers and envelope data |
| Configuration catalog | Extended — provider profile-model branch (profiles, tiers, pacing, chains), shipped empty |
| State registry | Extended — one additive target-profile record kind |
| Error table (machine + documented) | Extended — new provider/profile error identities, synced both directions in-change |
| Spawn surfaces (bash hook contract; harness spawn-env seam consumption) | Extended — resolution-before-spawn and data-record injection; the legacy hook itself is untouched |
| Dispatch daemon (future, M1-S9) | Not affected here — consumes the delivered seam |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F8-1 | **Given** a queued spawn on any current spawn surface, **when** the spawn is requested, **then** profile resolution runs first and the spawn starts only with a resolved profile; the emitted model environment is a validated `data-v1` record (never shell code, never shell-interpreted); if no profile resolves, the spawn does not start and the refusal is classified and announced — never an implicit model. | F-8, F-4, DM-7, NFR-7 |
| AC-F6-1 | **Given** a provider entering its declared expensive window (peak hours or a priced multiplier above threshold), **when** profile resolution runs, **then** the provider parks with a closed cause and an absolute expiry (both present on the park record), profiles using it are ineligible with the park named as blocker, and the provider resumes exactly when the window clears — with no sleep-without-record path and no background timer. | F-6, F-4, DM-10, NFR-9 |
| AC-F6-2 | **Given** the preference chain (mixed, deepseek) and the coding-plan subscription quota just exhausted, **when** a spawn resolves its profile, **then** mixed is ineligible with the exhaustion named as blocker and deepseek is selected automatically (switch-not-park); the switch event carries the new target and the revert condition; the target persists in state; **when** the subscription recovers, the target reverts to mixed automatically and exactly one revert event is recorded. | F-6, F-4, EVT-1, EVT-2, EVT-4, NFR-9 |
| AC-F3-3 | **Given** a vision-capable task queued for an agent whose tier seats include a text-only profile candidate, **when** selection evaluates candidates, **then** the text-only candidate is refused for the vision task regardless of chain position or quota advantage; the eligibility list names the capability blocker per refused profile; selection proceeds with the next eligible capable candidate or fails closed with a classified refusal. | F-3, F-4, DM-6, EVT-3 |
| AC-F7-4 | **Given** declared pacing goal priorities and rungs with a threshold crossing, **when** a rung adjustment evaluates seats, **then** only seats whose declared `pacingClass` is `execution` move; every `judgment` seat is unchanged across all rungs; a configuration attempting to move a judgment seat is rejected at validation or structurally inert in the engine. | F-7, DM-3, DM-5 |
| AC-F1-5 | **Given** a delivered installation, **when** an operator changes only configuration — the preference chain, thresholds, rungs, or per-agent overrides — **then** routing behavior changes accordingly with zero code changes, invalid configurations fail closed with classified errors, and provenance of every effective value is inspectable. | F-1, F-2, DM-4, DM-5, NFR-11 |
| AC-F11-6 | **Given** the ported decision-table groups (chain order, lazy probes, park-versus-switch, revert, condition seams), **when** the test suite runs, **then** every group has ported coverage of the legacy decision table, every legacy fail-open or fail-stuck class asserts a structured event or classified outcome, and no silent behavior exists in any covered case. | F-11, F-4, F-6, NFR-2 |
| AC-F9-7 | **Given** the first-iteration provider set with declared credentials and mappings, **when** `provider watch status [--provider <name>]` runs, **then** each configured provider reports name, condition, source, and checkedAt derived from its normalized snapshot mapping; malformed vendor responses surface as outage conditions, never as clear; the read performs zero state writes. | F-5, F-9, DM-9, NFR-2, NFR-9 |
| AC-F8-8 | **Given** the M1 pilot paths at milestone exit, **when** the exit evidence is evaluated, **then** every harness spawn on those paths resolved its profile through the engine (never a manual model-environment override), and the audit ledger shows zero manual overrides in the final two-week window — with this change delivering the machinery and the seam, and the evidence surfaces arriving via M1-S9 and M1-S22. (Milestone-scoped; not gated on this change's merge alone.) | F-8, F-9, DEC-4, DEC-6 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery order**: configuration branch and selection engine first, then the CLI surface, then spawn-seam integration on current surfaces — each step independently testable.
- **Additive cutover**: the legacy bash hook remains untouched; the machinery lands beside it. Manual model-environment overrides stop being the primary path only as spawn surfaces consume the seam; no forced flip occurs in this change.
- **Fail-closed adoption**: operators adopt by declaring tiers, profiles, and a preference chain; until then spawns refuse with a classified error rather than guessing a model (DEC-9).
- **Communication**: man page and feature-spec updates land in the same change; vocabulary growth is declared here so downstream consumers (daemon, audit, spend) can plan against fixed shapes.
- **Milestone evidence**: the exit criterion is evaluated at M1 exit with M1-S9 and M1-S22 in place, not at this change's merge (DEC-4).

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. The new configuration branches ship empty with no migration; the target-profile persistence is an additive record kind inside the existing state schema (no schema-version bump, no backfill, no rebuild command); parks and announcements reuse the engine's existing records. Existing state stores require no action.

## 20. PRIVACY / COMPLIANCE REVIEW

No personal data is introduced. Env records carry model identifiers and agent role names only — never prompt text, message bodies, transcripts, diffs, tool output, or credential material. Selection, switch, revert, and watch records carry routing facts (profiles, conditions, thresholds, check times) and bounded allowlisted evidence. Vendor watch requests transmit authorization material once in memory per the credential-port contract and never persist it.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Env-record hardening is the core security surface**: name-shape validation, allowlist match (`OC_ADOS_AGENT_*_MODEL` pattern carried over, overridable by configuration), duplicate-name rejection, metacharacter and homoglyph rejection, NUL and CR rejection, equals-in-name rejection, final-LF requirement, size limits — and values are data, never shell-interpreted (Appendix D). The legacy validation precedents and their regression classes carry over as the floor, not the ceiling.
- **Credential safety carries over unchanged**: watch authorization resolves only through the credential port; material is handed once to the transport, never cached, logged, persisted, or returned; the secret-read allowlist gains nothing.
- **Fail-closed defaults**: no profile chain ships enabled; resolution failure refuses the spawn rather than substituting a model.
- **No new runtime-API location beyond the declared watch transport edges**, which follow the engine's existing adapter confinement; selection policy stays runtime-neutral.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Adding a profile, tier, rung, threshold, or override** is configuration only (F-1, NFR-11); adding a watch target is a new normalized snapshot mapping with fixtures, per the engine's maintenance rules.
- **Vocabulary is guarded**: the new event codes, record kind, and error identities declared here are closed sets; growth requires a spec update and, where cross-cutting, a decision record.
- **Doc duties land in-change**: SPEC-PROVIDER-ENGINE update (or a new feature spec per the first-spec rule), the provider man page, the CLI command registry, and the glossary.
- **Operational posture**: operators inspect routing through `provider profile resolve`, watch through `provider watch status`, and park state through the existing parks surface; no new daemon, timer, or background process to operate.
- **Deprecation direction**: manual model-environment overrides become the legacy path; their retirement is milestone-scoped evidence (M1-S22), not an action in this change.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Tier | A responsibility group (working names lite, regular, powerful) grouping profiles a delivery selects from. |
| Profile | A named model-per-tier assignment with per-agent overrides, capability descriptors, and its provider set. |
| Seat | One agent's slot in a profile; its assignment carries the model and the typed pacingClass. |
| pacingClass | Typed field on a seat assignment with closed values `judgment` and `execution`; pacing rungs move only execution seats. |
| Pacing rung | A configuration-declared level expressing the active subscription-pacing posture (goal priorities and per-seat movement). |
| Preference chain | The declared base profile, fallbacks, and order selection walks. |
| Eligibility | A profile is a candidate iff every provider it uses is available; blockers name each refusal. |
| Probe | A provider-availability check; lazy (only when a decision depends on it) and memoized (once per provider per pass). |
| Hard capability gate | An engine rule refusing a capability-mismatched assignment (text-only seat, vision task) regardless of quota or position. |
| Expensive window | A declared peak period or priced-multiplier threshold during which the provider parks with cause and expiry. |
| Switch-not-park | On subscription exhaustion, selection moves to the next eligible profile instead of stalling the spawn. |
| Revert-on-recovery | The persisted target profile automatically returns to the preferred profile when the exhausted provider recovers. |
| Env record (`data-v1`) | The resolved model environment as validated data records (header, `set`/`unset` lines, final LF) — never shell code. |
| Decision table | The legacy resolver's ported semantics: chain order, lazy probes, park-versus-switch, revert, condition seams. |
| Judgment seat | A seat whose `pacingClass` is `judgment`; held on its model until the configured subscription-window tail. |
| Execution seat | A seat whose `pacingClass` is `execution`; the only class pacing rungs may move. |
| Watch status | The read-only per-provider condition view from the normalized snapshot mappings (name, condition, source, checkedAt). |

## 24. APPENDICES

### Appendix A — Ported decision-table groups (the "ported tests" contract)

| Group | Must cover |
|-------|------------|
| 1. Chain order | Profiles resolve in declared preference order; first fully eligible profile wins; later eligible profiles report as shadowed-equivalent; ordering violations fail validation. |
| 2. Lazy probes | A provider is probed only when a decision depends on it; one probe per provider per pass regardless of referencing profiles; probe failure is never availability. |
| 3. Park-versus-switch | Expensive window → park with cause/expiry; exhaustion → switch to next eligible profile (never a spawn-stalling park); parked decision when nothing is eligible. |
| 4. Revert | Recovery restores the preferred target automatically; exactly one revert event per episode; persisted target stable across spawns in between. |
| 5. Condition seams | Condition boundaries at the profile level: threshold crossings, window start/end instants, buffer effects, credential classes, malformed vendor responses (never clear). |

### Appendix B — Seeded scenarios

SC-M1-21 (profile eligibility with hard capability gate and auto-switch revert) and SC-M1-22 (expensive window parks; exhaustion switches) in the M1 test-scenarios register seed this change's behavior tests; divergence after delivery is a defect. Their asserts — data-only env records, per-profile blockers, revert events, judgment seats unchanged across rungs, park cause+expiry, switch event with revert condition, no sleep-without-record path — are folded into AC-F6-1, AC-F6-2, AC-F3-3, AC-F7-4, and AC-F8-1.

### Appendix C — Command envelope data shapes (contract level)

- `provider resolve [--chain] [--profile <name>]` → `provider`, `mode` (subscription, paid), `decision`, `parksConsidered` (delivered shape; `--profile` scopes the resolution context).
- `provider profile resolve [--agent <name>] [--for-spawn]` → `profile`, `eligibility[]` (profile, verdict, blockers), `rung`, `agentOverrides`, and with `--for-spawn` an `envRecord` declaring `recordFormat: data-v1`.
- `provider watch status [--provider <name>]` → `providers[]` (name, condition, source, checkedAt).

Exit conventions: 0 resolved/read; 1 misconfiguration (classified); 2 all candidates skipped or exhausted (announced, with skip reasons).

### Appendix D — Env-record validation classes (carried-over floor + hardened ceiling)

Carried over from the legacy contract: exact header line; only `set NAME=value` and `unset NAME` records; name matches the allowlist; no duplicate names; output is a safe regular file with safe ownership/permissions; byte-limit on the file and per line; final line feed required; CR and NUL rejected anywhere. Hardened in this change: name shape enforced by the strict identifier rule; embedded equals signs in names rejected; homoglyph and non-ASCII name rejection (allowlist matching is exact); metacharacter rejection in names; values passed as data with no shell interpretation at any consumption point; unauthorized or unknown names refused with a classified error. Every class is rejected with a classified refusal and never partially applied.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-07 | spec-writer | Initial specification from ticket GH-234, pm-notes, the model-profiles concept, the provider man page, seeded scenarios SC-M1-21/22, and the delivered system specs |

---

## AUTHORING GUIDELINES

- Sources: ticket GH-234 (canonical task/AC source, pinned decisions), chg-GH-234-pm-notes.yaml (PM decisions on ported tests, spawn-integration scope, milestone-exit scoping), the model-profiles concept, the provider man page (CLI grammar and envelope shapes), the M1 test-scenarios register (SC-M1-21/22), the M1 interactions register, backlog §M1-S21, the M1 roadmap exit-evidence table, and the delivered system specs for the provider engine, harness adapters, config layer, state layer, and result contract. Legacy env-record validation precedents were read from the in-repo hook contract and its regression tests (referenced by contract name, not by path).
- Pinned decisions were carried verbatim into the decision log (DEC-1..6) and not re-derived; DEC-7..9 record concept guardrails and spec-level scoping choices (fail-closed empty default, data-only growth rules).
- All seven ticket ACs map to AC-F8-1, AC-F6-2, AC-F6-1, AC-F3-3, AC-F7-4, AC-F1-5, and AC-F11-6; the milestone-exit criterion is AC-F8-8 with its dependency context; AC-F9-7 makes the watching deliverable itself testable.
- No implementation detail: capabilities, contracts, and flows are stated behaviorally; file-level paths, module names, and task breakdowns are left to the plan writer.
- Missing or deferred information is captured as OQ-1..3 rather than invented; tier names and the external battery question remain open by design.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-234)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1-25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, EVT-, OQ-)
- [x] Acceptance criteria reference at least one F-/DM-/EVT-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (contracts summarized, not copied)
- [x] Front matter validates per front_matter_rules
