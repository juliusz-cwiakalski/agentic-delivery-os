---
change:
  ref: GH-377
  type: fix
  status: Proposed
  slug: provider-profile-consumes-parks
  title: "M4-S18: Provider profile selection must consume recorded parks (M4)"
  owners: ["Juliusz Ćwiąkalski"]
  service: "provider profile selection and spawn admission (CLI resolver composition)"
  milestone: "M4: Jaiship-native delivery"
  labels:
    - provider
    - profiles
    - parks
    - eligibility
    - spawn
    - defect
    - m4
  version_impact: none
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - "delivered provider engine: closed park causes and condition kinds, park construction with absolute expiry, verified park fold and read-time expiry, `provider resolve` / `provider parks list` (GH-350)"
      - "delivered provider profiles: tiers, profiles, seats, preference chain, pacing rungs, agent overrides, injected availability probe, `data-v1` env record, `provider profile resolve` (GH-234, GH-294)"
      - "delivered watch freshness: closed watch condition set including `watch-stale`, `maxAgeSeconds`, park clamp (GH-350)"
      - "delivered dispatch nomination gate over the same resolved provider configuration and probe, with the four closed profile refusal identities (GH-294, TDR-0028)"
      - "delivered per-spawn seat binding and `data-v1` env-record contract (GH-233, GH-335)"
      - "delivered committed provider policy and preference chain `delivery` → `paid` (GH-374)"
    external:
      - "none added; the declared z.ai Coding Plan subscription and DeepSeek pay-per-token rail remain policy targets only"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make recorded provider parks an eligibility input to profile and seat resolution, so the model a delivery actually spawns on is the model the provider policy considers usable, while preserving the closed park vocabulary, the no-live-fetch rule, and the operator's zero-configuration recovery path (F-1, F-3, NFR-1).

## 1. SUMMARY

The synchronous profile availability probe answers from three facts only: the provider is declared, it is enabled, and its declared peak window is not open. Everything the engine already knows about a provider's real condition — the parks it persists for quota exhaustion, budget ceilings, outages, credential failures, and peak windows, plus the recorded watch condition and its freshness — never reaches profile selection. On 2026-11-21 the chain resolver reported z.ai parked for `quota-exhausted` in the same repository where `provider profile resolve --agent pm --for-spawn` still selected the `delivery` profile and emitted a z.ai model, and a truthful spawn was obtained only through a hand-written project-local override.

This change makes the verified park fold an eligibility input at two levels — the profile's declared providers and the seat's effective model — and adds seat substitution from the next eligible profile with a named refusal when no profile can supply the seat. The result is a `--for-spawn` record whose every value names a provider that is not parked at resolution time, an env record and a spawn binding that agree by construction, automatic recovery through read-time expiry with no timer, write, or configuration edit, and no new cause, condition kind, skip reason, announcement code, error identity, state record kind, or envelope key.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **Parks are already durable truth.** The provider engine persists every non-clear provider condition with an honest future expiry as a named park (`provider:<name>`) inside the closed eight-value cause set, folds verified ledger truth at read time, and derives activity from `expiresAt > now` with no timer and no expiry write. `provider parks list` is the operator surface over that fold.
- **The chain resolver already consumes parks.** `provider resolve` skips a parked entry with one closed reason, reports the park with its cause and next-eligible time, and selects the next eligible entry, so the resolver's view of z.ai and the profile probe's view of z.ai can disagree at the same instant.
- **The profile probe ignores them.** The composed availability probe reports a provider available when it is declared, enabled, and outside its declared-zone peak window. It performs no park read, no quota fetch, no watch transport call, and no state write.
- **Selection is provider-level, seats are not.** The preference chain is walked in declared order and a profile is a candidate when every provider in its declared `providers` list is available; later profiles are `shadowed`. Seat resolution then reads the selected profile's seat map, but a seat's effective model may name a provider **outside** that list — a plain declared seat model, a pacing rung's `executionModel`, or an `agentOverrides` mapping — so provider-level eligibility alone cannot make an emitted model truthful.
- **The env record and the binding read one model map.** The `data-v1` env record takes each seat's model from the resolved seat-model map, and the per-spawn binding resolves the same agent's seat from the same map. Whatever the map says is what both surfaces emit.
- **One probe factory serves three call sites.** The profile-resolve edge handler, the spawn-context helper, and the dispatch nomination predicate each construct the probe through one factory, so a factory that ignores parks produces the same blind spot at admission and at spawn.
- **The committed policy is unchanged by this defect.** `delivery` declares `[zai-coding-plan, deepseek]` with the `pm` seat on the z.ai flash model; `paid` declares `[deepseek]` with the same seat on the DeepSeek flash model; `preferenceChain` is `delivery` then `paid`.

### 2.2 Pain Points / Gaps

- **A parked provider is selected anyway.** With z.ai at 100% weekly quota, `provider resolve` reports `skip quota-exhausted` and an active park, while `provider profile resolve --agent pm --for-spawn` selects `delivery` and emits `zai-coding-plan/glm-5.3-flash`. A native dispatch under that record spawns the PM on an exhausted provider.
- **The declared subscription-first policy is not honoured at spawn.** The committed policy says subscription first, paid as the declared fallback; the spawn path silently contradicts it exactly when the subscription is unavailable, which is the only moment the fallback exists for.
- **Truth requires a hand-written override.** The operator had to set a project-local `preferenceChain.base = paid` to obtain a usable record. Correctness must not depend on an undocumented local edit.
- **Seat-level routing is unprotected.** Eligibility is checked on the profile's provider list, but a declared seat model, a rung model, or an agent override can point a seat at another provider, so the same inconsistency returns through a second door.
- **Degradation is silent rather than named.** A stale watch observation produces no park at all, so it has no way to reach profile eligibility: the only available readings are "clear" or "outage", and both are wrong.
- **Recovery looks automatic only because parks are ignored.** Once parks become inputs, resume must stay a pure read-time property; a cache, timer, or write would trade one defect for another.

## 3. PROBLEM STATEMENT

Because the synchronous profile availability probe reads only declaration, enablement, and peak-window state and therefore ignores the provider parks and watch conditions the engine already persists, an operator cannot rely on `provider profile resolve --for-spawn` to name a provider the declared policy considers usable, resulting in native spawns on exhausted, parked, or stale-evidence providers, a committed subscription-first policy that is contradicted at the moment it matters, and a correctness path that today requires an undocumented local configuration override.

## 4. GOALS

- **G-1**: Recorded provider-attributable parks are eligibility inputs to profile selection exactly as peak windows are, including the recorded watch condition and its freshness, evaluated at read time.
- **G-2**: A seat whose effective model pins a provider that is recorded-unavailable (an active provider-attributable park, or a stale observation under F-2) is substituted from the next valid profile in `preferenceChain` order; when no valid substitute supplies the seat, resolution refuses `provider.profile.unavailable` naming the seat and the provider.
- **G-3**: `--for-spawn` is truthful: no emitted model names a provider parked at resolution time, and the env record and the spawn binding agree for every seat.
- **G-4**: Recovery is automatic on park expiry or quota reset through read-time expiry, with no timer, write, daemon, or configuration edit.
- **G-5**: Existing chain behavior is unchanged: `provider resolve` still parks and reports `quota-exhausted` with a next-eligible time, and its skip vocabulary is untouched.
- **G-6**: The fix stays in the resolver/composition seam: no policy data edit, no operator-local edit, and no growth in any closed vocabulary.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Resolutions emitting a model whose provider is parked at resolution time | 0, over the full proof matrix (F-1, F-3, F-4) |
| The observed 2026-11-21 state reproduced by fixtures | 1 of 1: `pm --for-spawn` selects `paid` and emits `deepseek/deepseek-flash` |
| Manual actions required to recover after park expiry or quota reset | 0 (F-5) |
| Declared park causes left unclassified by the taxonomy proof | 0 of 8 (F-6) |
| New park causes, condition kinds, skip reasons, announcement codes, error identities, state record kinds, envelope keys | 0 each (NFR-3) |
| Park or announcement records written by profile resolution | 0 (NFR-2) |
| Behaviours changed in `provider resolve` | 0 (F-7) |

### 4.2 Non-Goals

- **NG-1**: No live quota fetch, balance read, or watch transport call is added to any resolution path.
- **NG-2**: No new park cause, condition kind, watch condition, skip reason, announcement code, error identity, event code, state record kind, schema identifier, or envelope key.
- **NG-3**: The committed `provider.profiles` and `provider.entries` policy is not edited, and the operator-local configuration slot is neither read differently nor required.
- **NG-4**: No timer, cache, refresher, daemon, or expiry write is introduced; park expiry remains a read-time derivation.
- **NG-5**: Chain resolution, park creation, park clearing, and announcements keep their delivered behavior and are only verified, never redesigned.
- **NG-6**: No budget evaluation and no work-item-ref read is added to profile resolution; a `ticket`-scope ceiling crossing persists no park and stays governed by the chain resolver's existing refusal.
- **NG-7**: The contradicted specification sentences are not edited here; the reconciliation obligation is the phase-7 doc-sync scope named in §22.
- **NG-8**: The change is bounded to one decision record. No second decision record is authored: DEC-7 cites TDR-0075 as the governing record, and TDR-0075 records the one genuinely precedent-setting narrowing — that a stale declared watch target becomes a profile-eligibility blocker — while narrowing TDR-0062 D2 for profile eligibility only; TDR-0062 is not superseded and the reserved id TDR-0076 stays unused. Both statements stay in force.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Recorded provider-attributable parks are profile eligibility inputs | The engine's durable truth about a provider must reach the only surface that decides what to spawn |
| F-2 | Watch condition and freshness are eligibility inputs, named and never silently clear | An aged observation has evidence; presenting it as clear is the failure the fail-loud rule forbids |
| F-3 | Seat-level re-check of recorded unavailability (park or stale), with substitution or a refusal naming seat and provider | Declared, rung-derived, and override-targeted seat models all route past the profile's provider list |
| F-4 | Truthful `--for-spawn`: env record and spawn binding agree and never name a parked provider | A record that a dispatch trusts must describe the spawn it will produce |
| F-5 | Automatic recovery by read-time expiry and freshness, with no timer, write, or config edit | Resume must remain a property of the clock, not of a process or an operator |
| F-6 | Complete, classified cause taxonomy: eight causes, six provider-attributable, two chain-level | "Every declared cause is pinned" is only meaningful with an explicit subject classification |
| F-7 | Chain resolution behavior preserved | The engine's park and skip contract is consumed by many surfaces and must not drift |

### 5.1 Capability Details

**F-1 — Parks as eligibility inputs.** At the resolution instant, a provider is available to profile selection if and only if it is declared, enabled, outside its declared-zone peak window, carries no active provider-attributable park, and is not blocked by a stale watch observation. Park activity is the delivered read-time rule: active while `expiresAt > now`, inactive at `expiresAt <= now`. The park facts are read through the same verified fold the parks listing surface reads; resolution adds no quota fetch, no watch transport call, no credential read, and no park or announcement write. The six provider-attributable causes are `peak-window`, `quota-exhausted`, `budget-exhausted`, `provider-outage`, `credential-missing`, and `credential-rejected`. A park's cause is the blocker value the ineligible profile reports, and a profile that uses a parked provider is `ineligible` with that blocker rather than `shadowed`. A provider with no park record and no observation is treated exactly as delivered: declared, enabled, and peak-free means available.

**F-2 — Watch condition and freshness.** A recorded watch condition that derived a park is already covered by F-1 through the park. The remaining case is an observation that is older than its declared maximum and therefore persisted no park — whether the underlying reading was a condition or a clear. Such a provider is not clear: it is blocked and named with the delivered watch-only condition `watch-stale`, which joins no park cause, skip reason, announcement code, or error identity. The freshness rule is the delivered one, evaluated per declared `provider.profiles.watch.<name>` target: `ageSeconds = floor((nowMs − observedAtMs) / 1000)`, and a target is stale exactly when `ageSeconds >= maxAgeSeconds` for that target, with the boundary value stale. A provider with no declared watch target is never stale; a provider whose declared watch target is stale is unavailable. A composed live read observes at the read instant, so its age is zero and it can never report staleness; the stale path exists as the fail-loud guard for composition-supplied observations and for the delivered park clamp, and no production composition supplies a stale observation today (§8.6). Only freshness is consumed here: the condition value a supplied observation carries is not re-derived into a second blocker, so a condition that already derived a park is consumed as that park. A park-fold or observation read that fails is never clear: it yields an unavailable verdict through the delivered probe-failure path, with no new identity. TDR-0075 is the authority for this rule and for the narrowed boundary it rests on.

**F-3 — Seat-level re-check and substitution.** Profile eligibility and seat resolution are both checked, because a seat's effective model can name a provider outside the profile's declared `providers` list through a plain declared seat model, a pacing rung's `executionModel`, or an `agentOverrides` mapping; the re-check therefore applies to every effective seat model, whether declared, rung-derived, or override-targeted. The re-check consumes **recorded unavailability only**: the seat provider carries an active provider-attributable park, or a stale observation under F-2. Declaration, enablement, and the declared peak window remain profile-level facts, so a seat model naming an undeclared, disabled, or peak-parked provider behaves exactly as delivered and is neither substituted nor refused by this change. Eligibility therefore runs at two levels, and the distinction is exact. **Selection pass:** the preference chain is walked in declared order, the first fully eligible profile wins, and every later profile is reported `shadowed` and is **not probed during selection**, so the eligibility list reports selection-time verdicts only. **Substitution search:** it runs only when the selected profile's effective seat model names a recorded-unavailable provider; it inspects later profiles in declared order, probing their declared providers through the same memoized probe (one probe per distinct provider), and the first valid supplier wins — a profile that is eligible under the same facts, declares the seat, and declares it on a provider that is not recorded-unavailable and satisfies the required capability; the substituted model then becomes the value for that seat everywhere the resolution emits it. Candidate verdicts are **not** written into the eligibility list — a candidate stays `shadowed` there whether or not it supplies the seat — and the search is bounded by declared order and stops at the first valid source. A candidate that fails any of those conditions is not a valid source — in particular, a capability-inadequate substitute does not supply the seat, so the capability gate is never relaxed. When no valid substitute exists, the resolution refuses `provider.profile.unavailable` naming the seat and the provider, emits no env record, and invents no model. That refusal is the outcome regardless of why no profile supplied the seat — whether a later profile was ineligible under the same probe, did not declare the seat, or declared it only on a capability-inadequate model. The delivered `provider.profile.capability-denied` remains reserved for one case: the selected profile's **own** seat failing the task's hard capability requirement, a condition independent of parks and unchanged by this change. Substitution is a per-seat routing fact inside the selected profile, not a profile switch: the selected profile, its tier, its rung, and its agent overrides are unchanged. A later profile inspected as a substitution candidate is not re-verdicted — it stays `shadowed` in the eligibility list — so the refusal's bounded `summary`, naming the seat and the parked provider, is the one seat-level evidence position (DM-2). Reach: the plain declared-seat and agent-override arms are reachable from a committed configuration today; the rung arm is a contract-level arm exercised by supplying pacing output, because no production caller supplies seat models for rung evaluation today.

**F-4 — Truthful `--for-spawn`.** The substituted model is carried in the existing per-seat model map that both the env record and the per-spawn binding read, so agreement is structural rather than a second derivation: for every declared seat, the record's value and the binding's value are the same string. Emission is all-or-nothing: a resolution that cannot satisfy every seat emits no record and refuses; no partial record and no placeholder model is ever produced. Every emitted value names a provider that is not recorded-unavailable at the resolution instant: it carries no active provider-attributable park and no stale observation under F-2.

**F-5 — Automatic recovery.** A provider becomes eligible again when its park is inactive by the read-time rule or when its recorded condition clears; the next resolution then selects the preferred profile and its declared seats again. No timer, daemon, cache, delete, or expiry write participates, and no configuration or local override is required or removed. Recovery is observable as the delivered switch/revert lifecycle: the target record and its events behave as delivered, and this change adds no event code and no write on the read-only path. The same instant yields the same verdict whether the state was never parked or a park expired at that instant.

**F-6 — Cause taxonomy.** The proof fixture pins all eight declared park causes and classifies the subject of each. Six causes are provider-attributable and make their subject provider unavailable with the cause as the blocker value. `chain-exhausted` belongs to a chain park (`chain:<name>`), not to a provider, and never makes an individual provider unavailable. `reevaluation-cap` is the engine's own loop-cap pause and likewise never makes an individual provider unavailable and never clears a provider park. `budget-exhausted` is provider-attributable in both representations the engine exposes: the `window`-scope park carries a durable expiry and is therefore an eligibility input, while the `ticket`-scope crossing fails the entry and persists no park, so it is classified as provider-attributable but is not readable as an eligibility input by a read-only resolution. No cause is silently ignored, no cause silently clears a provider, and adding or removing a member of the closed set without a classification fails the proof.

**F-7 — Chain resolution preserved.** `provider resolve` keeps its behavior: a parked entry is skipped with its closed reason, the park is reported with cause and next-eligible time, the decision selects the next eligible entry or returns the chain park, and the mutating path persists parks and announcements exactly as delivered. The change adds no skip reason, no cause, no announcement, and no payload key, and it does not alter which entry is selected for any fact set.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Recorded quota park (the observed defect, now correct)
  Operator/agent: provider profile resolve --agent pm --for-spawn
    → read verified park fold + declared peak evaluation at one clock instant
    → delivery ineligible: blocker condition quota-exhausted on provider:zai-coding-plan
    → paid eligible → selected
    → pm seat model deepseek/deepseek-flash → env record entry + binding agree
    → dispatch spawns on the paid rail; no local override exists or is needed
```

```
Flow 2 — Recorded peak park (parity with quota)
  Same as Flow 1, with the park cause peak-window supplied from the fold at an
  instant outside the declared entry peaks: identical decision, blocker value
  peak-window. The cause changes the reported name, not the eligibility rule.
```

```
Flow 3 — Seat-level re-check (declared, rung-derived, or override-targeted seat)
  Selection pass: first eligible profile selected; later profiles shadowed,
  not probed, and the eligibility list reports those selection-time verdicts
    → effective seat model names a provider with an active park or a stale
      observation
    → substitution search: later profiles in declared order, each candidate's
      declared providers probed through the same memoized probe; the first
      valid supplier wins — eligible under the same facts, declares the seat,
      and declares it on a not-recorded-unavailable, capability-adequate
      provider
      → seat taken from there; model emitted and bound from the same map
      → candidate verdicts are not written into the eligibility list
    → no valid supplier (ineligible under the same probe, seat undeclared, or
      capability-inadequate)
      → refuse provider.profile.unavailable as the delivered data envelope at
        exit 2, naming seat and provider, with the eligibility list unchanged,
        no profile event of any kind, and no env record
    → capability-denied stays reserved for the selected profile's own seat
      failing the task's hard capability requirement
```

```
Flow 4 — Recovery
  Park active at T (delivery ineligible, paid selected)
    → clock passes the recorded expiry (or the recorded condition clears)
    → next resolution observes the park inactive by read-time rule
    → delivery eligible → selected → z.ai seats restored
    → no timer ran, nothing was written by the read, nothing was reconfigured
```

```
Flow 5 — Stale observation
  Composition supplies { condition, observedAtMs } for a provider that declares
  provider.profiles.watch.<name> with maxAgeSeconds
    → ageSeconds = floor((nowMs − observedAtMs) / 1000) >= maxAgeSeconds
    → provider is not clear → blocked and named watch-stale
    → fail loud (named blocker), never a silent clear, never an invented outage
  No declared watch target → never stale
  Live read observes at the read instant → age 0 → never stale
```

```
Flow 6 — Chain resolve (unchanged, verified)
  provider resolve → z.ai skipped quota-exhausted, provider park cause
  quota-exhausted, next-eligible time = reset instant, deepseek selected.
  Mutating path persists the same park generation as before this change.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The composed profile availability probe: declaration, enablement, declared peak window, recorded provider-attributable parks, and recorded watch condition with freshness.
- The watch-observation seam (§8.6): the park fold input, the composition-supplied per-provider observation input, the per-declared-target staleness rule, and the honest statement that no production composition supplies a stale observation today.
- Profile eligibility over the declared provider list, with park-derived blockers in the delivered blocker shape.
- Seat-level re-check of recorded unavailability for every effective seat model — declared, rung-derived, and override-targeted — with the seat gate deliberately not widened to declaration, enablement, or declared peak.
- Seat substitution from the next valid profile in declared chain order, with capability preservation.
- The `provider.profile.unavailable` refusal naming the seat and the provider in the bounded `summary`, carrying the eligibility list unchanged, with no env record.
- TDR-0075 as the deliverable decision record that narrows TDR-0062 D2 for profile eligibility only, together with its index row.
- Truthfulness and agreement of the `--for-spawn` env record and the per-spawn binding.
- Read-time recovery and its zero-write, zero-timer property.
- The eight-cause classification proof, the profile-eligibility behaviour matrix, the freshness boundary cases, and the unchanged-chain regression proof.
- The declared reconciliation obligation handed to phase 7 for the specification sentences named in §22, including the refusal-cause wording on the dispatch-engine, result-contract, and peak-pausing pages.

### 7.2 Out of Scope

- [OUT] Any live quota, balance, or usage fetch; any watch transport invocation; any network call on any resolution path.
- [OUT] Editing the committed provider policy, the preference chain, the seat matrix, or the operator-local configuration slot.
- [OUT] New vocabulary of any kind: park cause, condition kind, watch condition, skip reason, announcement code, error identity, event code, state record kind, schema identifier, envelope key.
- [OUT] Park creation, clearing, or expiry writes by profile resolution; any daemon, timer, or cache.
- [OUT] Budget evaluation or work-item-ref resolution inside profile resolution.
- [OUT] Changes to `provider resolve`, `provider quota`, `provider parks list`, `provider watch status`, `provider simulate`, or `provider migrate legacy` behavior.
- [OUT] Documentation edits to the contradicted specification sentences (phase 7).
- [OUT] Widening the seat gate to declaration, enablement, or the declared peak window: the seat guarantee covers recorded unavailability only, and a seat on an undeclared, disabled, or peak-parked provider keeps its delivered behaviour.
- [OUT] Any second decision record: TDR-0076 stays unused, and TDR-0062 is neither superseded nor amended outside the profile-eligibility boundary TDR-0075 narrows.
- [OUT] The separate parked work item GH-366 and its branch/worktree.

### 7.3 Deferred / Maybe-Later

- A per-seat substitution provenance field on the resolve envelope, so an operator can read which profile supplied a substituted seat without inferring it from the emitted model. Deferred: it adds an envelope key, and the emitted model value already answers the operational question; the eligibility list deliberately does not, because it reports selection-time verdicts and a substitution candidate stays `shadowed`.
- A weekday dimension for peak windows (inherited from the adopted policy's daily semantics).
- Native-daemon live verification of quota and balance before spawn, which remains the daemon path's scope.
- Extending profile eligibility to a `ticket`-scope budget crossing, which would require a ref-bearing spend read on the resolution path and therefore contradicts the read-only, ref-free contract.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A. The change is confined to local CLI resolution surfaces; no HTTP endpoint, route, or payload is added or modified, and no vendor endpoint is contacted.

### 8.2 Events / Messages

| ID | Event | Contract |
|----|-------|----------|
| EVT-1 | `profile.selected` | Unchanged code, severity, evidence keys, and identity derivation. Park-derived blockers may appear in its bounded `blockers` evidence exactly as other blockers do, using existing vocabulary values. |
| EVT-2 | `profile.ineligible` | Unchanged code and shape; its `blockers` evidence now names park causes and `watch-stale` when those are the reason no profile is eligible. The `capability-gate` reason is unchanged and takes precedence only when every blocker is a capability blocker. A seat-level refusal emits **no** profile event: not `profile.selected`, not `profile.ineligible`, not `profile.switched`/`profile.reverted`/`profile.rung-changed`, and any selection-time event computed before the seat check is not emitted on the refusal path, so the refusal envelope is the only evidence. No new event code, condition, or evidence key is added: no profile-level ineligibility occurred, and the selected profile remains eligible. |
| EVT-3 | `profile.switched` / `profile.reverted` | Unchanged. Recovery through read-time expiry drives the delivered switch/revert lifecycle; no new event code, condition, or evidence key is added. |

No provider announcement is emitted or suppressed by profile resolution, and no park record is appended by it.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Park-derived eligibility fact | The resolution's provider-availability verdict is derived from the declared descriptor, enablement, declared peak window, the verified park fold's active state at the resolution instant, and the recorded watch condition and freshness. Activity is `expiresAt > now`; no derived fact is persisted. |
| DM-2 | Eligibility blocker for a recorded-unavailable provider, and the refusal's evidence position | Uses the delivered blocker shape (`kind: condition`, `value` = the park cause or `watch-stale`, bounded `detail` naming the provider, the cause, and — for staleness — the declared target, the observed age, and the bound) and the delivered open string value position. The values drawn on remain the delivered availability values (undeclared, disabled, unresolvable peak zone, peak window) plus the existing closed park cause set and `watch-stale`. A seat-level refusal adds no evidence position: the delivered eligibility list is carried unchanged — the selected profile stays `eligible` because its declared `providers` are available and only a seat model is recorded-unavailable, and later profiles stay `shadowed` because selection did not probe them; the substitution search inspects candidates separately through the same memoized probe and writes no candidate verdict into the list — while the bounded refusal `summary` names both the seat and the parked provider. No blocker kind, field, envelope key, or identity is added, no blocker is appended to the eligibility entry, and no verdict flips. A later profile inspected as a substitution candidate stays `shadowed`, so substitute eligibility is not readable from the list. |
| DM-3 | Substituted seat model | The substituted model is written into the existing per-seat model map of the decision, which is the single source both the env record and the per-spawn binding read. No new field, key, or record is introduced; agreement follows from the shared map. |
| DM-4 | Unchanged durable vocabulary | No new state record kind, payload schema, store-scoped key, park field, announcement field, or event evidence key. Existing `provider.park` and `provider.announcement` records are read as delivered and never written by this path. |
| DM-5 | `data-v1` env record | Unchanged grammar, header, allowlist pattern, byte/line/record limits, and set/unset shape. Only the model values carried for substituted seats differ, and they are validated exactly as other seat models are. |
| DM-6 | Park input to the probe | The verified provider-park fold, named by provider (`provider:<name>`) and by chain (`chain:<name>`), with its closed cause and absolute expiry. Read once per resolution; activity is the read-time rule `expiresAtMs > nowMs`; read-only, with no persistence, cache, or write. |
| DM-7 | Observation input to the probe | Composition-supplied, per provider, keyed by provider name: `{ condition, observedAtMs }`. Consumed at the read instant; no persistence, no fetch, no credential read, no write. |

### 8.4 External Integrations

None added. No vendor API is called by any resolution path, no credential material is requested, and no watch transport is invoked. The declared z.ai and DeepSeek entries remain policy targets whose recorded facts are read from local state.

### 8.5 Backward Compatibility

- A state with no park records and no supplied observations resolves exactly as delivered for the same configuration and clock: same decision, same eligibility verdicts, same env record, same exit code — **including** seat models that name an undeclared, disabled, or peak-parked provider, which the seat gate of this change does not touch (AC-F3-3).
- Configuration shapes are unchanged: no new key, no renamed key, no changed default, no validation rule added or relaxed.
- The resolve envelope keys are unchanged (`outcome`, `profile`, `tier`, `rung`, `agentOverrides`, `eligibility[]`, `envRecord`, `events`, `summary`), and no field is removed.
- Refusal identities and their exit projections are unchanged. `provider.profile.unavailable` is delivered today as a **`data` envelope** — `outcome: "refused"`, `code`, `summary`, `eligibility`, `events` — projected to exit 2 through the delivered `platform-provider` projection; it is never an `error` envelope and its `data` is never absent. This change keeps that projection exactly: the full eligibility list is carried unchanged, the seat and the parked provider are named in the bounded `summary`, and the existing refresh/override remedies apply. A capability-inadequate later profile changes neither the identity nor the evidence position.
- Existing park records, target records, and `--all` park views are read without transformation; there is no migration, back-fill, or rewrite.
- An operator's local override remains valid and remains unnecessary: it is neither removed nor required, and its absence is no longer a correctness gap.
- **AC-F1-1 asserts the selection facts, not a forced lifecycle outcome.** The criterion fixes the selected profile, the eligibility verdicts, and the emitted model while accepting whichever delivered `outcome` value the target lifecycle produces for those facts, and the delivered switch/revert behavior is unchanged and unextended by this change.

### 8.6 Probe Inputs: the Park Fold and the Watch-Observation Seam

The composed profile availability probe takes exactly two new inputs. Both are facts the composition already holds; neither is acquired.

| Input | Shape and provenance | Read discipline |
|-------|---------------------|-----------------|
| Park input (DM-6) | The verified provider-park fold, named by provider (`provider:<name>`) and by chain (`chain:<name>`), with its closed cause and absolute expiry. | Read once per resolution; activity is the read-time rule `expiresAtMs > nowMs`; read-only, with no persistence, cache, or write. |
| Observation input (DM-7) | Composition-supplied, per provider, keyed by provider name: `{ condition, observedAtMs }`. | Consumed at the read instant; no persistence, no fetch, no credential read, no write. |

**Staleness rule (exact).** A provider is stale only when it has a declared `provider.profiles.watch.<name>` target and, for that target, `ageSeconds = floor((nowMs − observedAtMs) / 1000) >= maxAgeSeconds`.

- The bound is the declared target's own `maxAgeSeconds`; the boundary value is stale.
- The delivered configuration shape is one watch target per provider name (`provider.profiles.watch.<name>`), so that single declared target's bound decides the provider's staleness.
- A provider whose declared watch target is stale is unavailable to profile selection and reports the `watch-stale` blocker.
- A provider with **no** declared watch target is never stale, whatever observation the composition supplies.
- A composed live read observes at the read instant, so its age is `0` and it is never stale.
- An absent observation is not stale; it contributes nothing, exactly as delivered.
- Only freshness is consumed at this seam. The condition value a supplied observation carries is not mapped to a second blocker: a condition that derived a park is consumed as that park (TDR-0075 D1).

**Production honesty.** No production composition supplies a stale observation today; the delivered compositions supply at most an observation instant taken at the read instant. F-2 is therefore a fail-loud guard for compositions that hold an observation and for the delivered park-expiry clamp, not a steady-state ineligibility input (A-10, A-11).

**Authority.** TDR-0075 is the record that narrows TDR-0062 D2 for profile eligibility only, and it fixes the boundary this seam implements: TDR-0062's watch-surface design, its predicate, its clamp, and its closed-set attestation all stand, and chain resolution remains excluded.

**Readings this seam explicitly excludes.** The following are *not* this rule and must not be implemented from this specification:

- One global observation instant applied to every provider as if each had the same bound.
- A staleness verdict for a provider that declares no watch target.
- "All providers are stale when a global observation is old."

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism and hermeticity | Identical configuration, park facts, observation facts, and injected clock produce identical decisions, eligibility lists, env records, event identities, and refusal codes across repeated runs and across independent compositions; zero live network calls, zero live credential reads, zero real sleeps, zero ambient clock reads in the evaluated path |
| NFR-2 | Read-only park consumption | Zero park records, announcement records, or cleared records written by profile resolution; at most one verified park-fold read per resolution regardless of provider, profile, or seat count; the only writes on the surface remain the delivered profile-target persistence on change |
| NFR-3 | Closed-vocabulary invariance | Exact equality with the delivered sets: 8 park causes, 6 condition kinds, 6 watch conditions, 9 skip reasons, and the delivered announcement code set; 0 new error identities, event codes, state record kinds, schema identifiers, and envelope keys |
| NFR-4 | Evaluation cost | One probe per distinct provider per selection pass (memoized), one park-fold read per resolution, and no per-seat re-read of park state; pure selection over 100 providers completes within the delivered 50 ms reference bound excluding state I/O |
| NFR-5 | Boundary correctness | A park is active if and only if `expiresAt > now` and inactive at exactly `expiresAt`; a reading is stale if and only if `ageSeconds >= maxAgeSeconds` for its own declared watch target, with the boundary value stale and the immediately preceding second not stale, and a provider that declares no watch target is never stale; 0 off-by-one tolerance in either predicate |
| NFR-6 | Bounded, secret-free evidence | Every new blocker and event evidence subject to the delivered profile caps (≤ 20 fields, ≤ 1024 serialized bytes, ≤ 128-byte evidence strings, ≤ 8 array items, ≤ 96-byte items); no credential value, authorization header, endpoint userinfo, or raw response body appears in any envelope, event, refusal, or diagnostic |
| NFR-7 | Compatibility with absent facts | With zero park records and zero supplied observations, the decision, eligibility list, env record, span of emitted values, and exit code are identical to the delivered behavior for the same configuration and clock (golden comparison) — **including** seat models that name an undeclared, disabled, or peak-parked provider, so the seat gate is not widened — and a park-fold read failure is never projected as clear |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- **No new telemetry.** No metric, log channel, event code, announcement code, or alert is added. The change is observable through the delivered surfaces.
- **Blockers are the evidence.** A parked or stale provider that appears in a profile's declared `providers` is visible as an `ineligible` verdict with the park cause or `watch-stale` as the blocker value, in the same evidence position as a peak blocker, bounded by the delivered caps.
- **A seat-level refusal adds no evidence position.** The refusal carries the delivered eligibility list unchanged: the selected profile stays `eligible` because its declared `providers` are available and only a seat model is recorded-unavailable, and later profiles stay `shadowed` because selection did not probe them; the substitution search inspects candidates separately through the same memoized probe and writes no candidate verdict into the list. The bounded `summary` names both the seat and the parked provider. No envelope key is added, no blocker is appended to the eligibility entry, and no verdict flips.
- **The seat-level refusal emits no profile event.** No `profile.selected`, no `profile.ineligible`, and no `profile.switched`/`profile.reverted`/`profile.rung-changed`; any selection-time event computed before the seat check is not emitted on this path. The refusal envelope is the only evidence, because no profile-level ineligibility occurred and the selected profile remains eligible. No new event code, condition, or evidence key is added.
- **Substitute eligibility is not readable from the list.** A later profile inspected as a substitution candidate stays `shadowed`; the list reports selection-time verdicts, not the substitution search, so the emitted model remains the provenance evidence (§7.3).
- **Two authorities stay comparable.** `provider parks list` remains the authoritative park view, and `provider watch status` remains the authoritative observation view with `observedAt`, `ageSeconds`, and `maxAgeSeconds`; a resolution's verdict must be explained by the facts those surfaces report at the same instant.
- **Recovery is visible without instrumentation.** After expiry, the next resolution's selected profile and the delivered switch/revert events show the resume; no counter is added.
- **Failure is loud.** A park-fold or observation read failure produces a named unavailable verdict rather than a clear one, so a monitoring gap degrades into a visible refusal instead of a silent spawn on a parked provider.
- **Operator reproduction.** The observed defect and its correction must be reproducible from recorded state alone, so a support conversation can cite the park record and the emitted record instead of a live vendor response.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | An unreadable or partially readable park fold is treated as clear, so a parked provider is selected | H | L | Fail-closed rule: a read failure yields a named unavailable verdict through the delivered probe-failure path, and a dedicated AC arm asserts it | L |
| RSK-2 | An over-broad attribution blocks a healthy provider (for example reading a chain park as provider unavailability) | M | M | F-6's eight-cause classification with an explicit subject per cause, plus the rule that only a provider's own park affects it | L |
| RSK-3 | A stale or mis-recorded park refuses a spawn that would have succeeded | M | M | Read-time expiry with no cache, the delivered park clamp to the observation freshness bound, `--all` visibility for operators, and the delivered early-clear record | M |
| RSK-4 | Seat substitution moves a seat to the paid rail while the subscription profile stays selected, so cost class changes silently | M | M | Substitution only to a provider with no active park and no stale observation; the substituted model is the emitted and bound value; the committed paid seats are the declared paid rail; the proof asserts the substituted model per seat | L |
| RSK-5 | The substitution is not visible as provenance in the envelope, so an operator cannot tell which profile supplied a seat | L | M | The emitted model is itself the evidence; the refusal `summary` names the seat and the parked provider; because the eligibility list is carried unchanged and a substitution candidate stays `shadowed`, substitute eligibility is deliberately not readable from the list; the provenance field is declared deferred (§7.3) | L |
| RSK-6 | The fix reaches one call site but not the others (for example the profile-resolve edge handler without the spawn-context helper or the nomination predicate), recreating the disagreement, or a second availability derivation appears beside the shared probe | H | L | One probe factory, three call sites (the profile-resolve edge handler, the spawn-context helper via an injected reader, and the dispatch nomination predicate), one verified fold read per resolution; the regression asserts no fourth call site and no second availability derivation, and F-4's agreement AC covers the spawn path rather than only the CLI surface | L |
| RSK-7 | The specification pages still assert the three-check probe, so operators and future changes read the old contract | M | H | §22 names the exact superseded statements and the phase-7 reconciliation obligation; this specification states the new contract as current | M (until phase 7 lands) |
| RSK-8 | Enabling watch staleness for profile eligibility contradicts a previously recorded closed boundary and confuses the guarded vocabulary | M | L | `watch-stale` remains watch-only in the vocabulary sense: it adds no cause, skip reason, announcement, identity, timer, cache, or write; NFR-3 asserts set equality; TDR-0075 records the narrowed boundary explicitly (TDR-0062 D2 narrowed for profile eligibility only, not superseded); §22 names the historical boundary statement and the positive rule phase 7 must state | L |
| RSK-9 | The proof depends on live provider state and becomes flaky or unavailable | M | M | The proof runs on committed fixtures over recorded park and observation facts; the live 2026-11-21 state is corroboration only, never a test dependency | L |
| RSK-10 | Descriptor peak evaluation and a recorded peak park disagree at a boundary instant, producing two different blocker names for one condition | L | M | Both use the declared-zone basis and the same condition value; the park is authoritative when present, and either path yields the identical eligibility effect | L |

## 12. ASSUMPTIONS

- **A-1**: The composition that builds the profile availability probe already holds the verified state store that the profile-target record and the parks listing use, so the park fold needs no new injected port.
- **A-2**: Park records carry an absolute expiry, a closed cause, and secret-free bounded evidence, as delivered; no park reading requires a credential or a network call.
- **A-3**: A chain park is named `chain:<name>` and is never attached to a provider subject, so the fold's per-park name is sufficient to classify subject scope.
- **A-4**: The committed policy is unchanged: `delivery` declares `[zai-coding-plan, deepseek]` with the `pm` seat on `zai-coding-plan/glm-5.3-flash`, and `paid` declares `[deepseek]` with the `pm` seat on `deepseek/deepseek-flash`.
- **A-5**: The operator-local configuration slot remains untouched and is not required by any accepted behavior.
- **A-6**: A composed live watch read observes at the read instant and therefore has age zero; staleness arises only from composition-supplied observations and from the park clamp.
- **A-7**: The 2026-11-21 z.ai exhaustion is corroborating evidence for the defect, not an acceptance dependency.
- **A-8**: No resident daemon is required for resume; read-time expiry governs every park and observation verdict.
- **A-9**: `provider resolve` remains the mutating park producer and profile resolution remains a reader; this change creates no second park writer.
- **A-10**: No production composition supplies a stale observation today. The delivered compositions supply at most an observation instant taken at the read instant, so a stale verdict is reachable only from a composition that holds an observation, or from the delivered park clamp; F-2 is a fail-loud guard, not a steady-state input.
- **A-11**: The observation seam is per provider and keyed by provider name, with shape `{ condition, observedAtMs }`, and a composition may hold such an observation without persisting it. If a composition ever retains one, its refresh cadence and invalidation rule are that composition's obligation and a TDR-0075 revisit trigger, not an inference from this change.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Delivered provider parks and the verified fold (GH-350) | Supplies the eight closed causes, absolute expiry, and the read-time activity rule |
| Depends on | Delivered provider profiles and the injected availability probe (GH-234, GH-294) | Supplies selection order, blockers, seats, rungs, overrides, and the probe port |
| Depends on | Delivered watch freshness and the `watch-stale` condition (GH-350) | Supplies `maxAgeSeconds`, the age predicate, and the park clamp |
| Depends on | TDR-0062 (unchanged) | Supplies the freshness predicate, the clamp, and the `watch-stale` condition; its D2 boundary is narrowed only for profile eligibility, by TDR-0075 |
| Depends on | TDR-0075 (authored in this change) | Records the narrowed boundary: a stale declared watch target is a profile-eligibility blocker at zero acquisition cost. TDR-0062 is not superseded and TDR-0076 stays unused |
| Depends on | Delivered dispatch nomination gate over the same probe (GH-294) | Makes the admission path inherit the corrected verdict with no second implementation |
| Depends on | Delivered per-spawn binding and `data-v1` env record (GH-233, GH-335) | Supplies the single per-seat model map that keeps record and binding in agreement |
| Depends on | The committed provider policy and preference chain (GH-374) | Supplies the `delivery` → `paid` order and the seat models the acceptance cases assert |
| Blocks | The release bar for native dispatch | Without this, the committed subscription-first policy is contradicted at the only moment its fallback exists |
| Blocks | Consistency between chain resolution and profile selection | Two surfaces reporting different availability for the same instant is a defect in its own right |
| External | None added | No vendor endpoint, credential, or transport call is introduced |

## 14. OPEN QUESTIONS

None open. The two questions raised during clarification are resolved and recorded here for traceability. OQ-1's resolution is now governed by TDR-0075, the record that narrows TDR-0062 D2 for profile eligibility only; OQ-2 remains a contract statement.

| ID | Question | Resolution | Status |
|----|----------|------------|--------|
| OQ-1 | How is a stale watch observation represented to profile eligibility without growing the vocabulary? | It is a named blocker using the existing watch-only `watch-stale` condition, evaluated per declared watch target under §8.6. It adds no park cause, skip reason, announcement, timer, cache, or state write, so the closed sets are preserved. A live read has age zero and is never stale; staleness is the fail-loud guard for composition-supplied observations and the park clamp. TDR-0075 narrows TDR-0062 D2 for this consumer only. | Resolved (pm-notes, 2026-11-22; F-2, DEC-5, DEC-7, §8.6; governed by TDR-0075) |
| OQ-2 | Is provider-level eligibility alone sufficient for a truthful `--for-spawn` record? | No. Seat resolution independently re-checks the effective seat model's provider against the same facts, substitutes the same seat from the next eligible profile, and refuses `provider.profile.unavailable` naming seat and provider when no profile supplies it. | Resolved (pm-notes, 2026-11-22; F-3, DEC-4) |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Park facts are read through the same verified fold the parks listing surface reads, at read time, with no live fetch, no watch transport call, and no state write. | The engine's durable truth is already verified and expiry-correct; a second acquisition path would create a second truth and break the read-only contract. | 2026-11-22 |
| DEC-2 | Six causes are provider-attributable; `chain-exhausted` and `reevaluation-cap` are chain-level and never make an individual provider unavailable. | A chain park and a loop-cap pause describe the chain's or the loop's state, not a provider's; attributing them would block healthy providers. | 2026-11-22 |
| DEC-3 | A park-fold or observation read failure is never clear; it yields an unavailable verdict through the delivered probe-failure path, with no new identity. | The delivered rule "a probe failure is never availability" already covers indeterminate evidence; reusing it avoids new vocabulary and a silent-clear path. | 2026-11-22 |
| DEC-4 | Seat resolution re-checks every effective seat model's provider — declared, rung-derived, and override-targeted — against recorded unavailability only (an active provider-attributable park or a stale observation), substitutes from the next profile that is eligible, declares that seat, and declares it on a not-recorded-unavailable and capability-adequate model, and refuses `provider.profile.unavailable` naming seat and provider when no valid substitute exists; `capability-denied` is reserved for the selected profile's own seat failing the task's hard capability requirement. | Provider-list eligibility cannot see a declared, rung, or override seat model, and substitution must not buy availability by sacrificing a required capability. A capability-inadequate substitute satisfies no condition of a valid source, so it yields the same refusal the binding owner comment requires; reserving `capability-denied` for the selected profile's own seat keeps the two identities' exit, retryability, and remedy correct. | 2026-11-22 |
| DEC-5 | Staleness uses only the existing `watch-stale` condition; no park cause, skip reason, announcement, timer, cache, or write is added. | The condition already exists and is already the third state between clear and outage; adding vocabulary would break the guarded sets for no gain. | 2026-11-22 |
| DEC-6 | The substituted seat model is carried in the existing per-seat model map, and no envelope key is added. | Both the env record and the binding read that map, so agreement is structural; a new key would be an interface change with no new capability. | 2026-11-22 |
| DEC-7 | TDR-0075 records the narrowed `watch-stale` boundary: a stale declared watch target is a profile-eligibility blocker at zero acquisition cost. This statement cites TDR-0075 as the governing record for that narrowing, and NG-8 bounds the change to that one record; both statements stay in force. TDR-0075 narrows TDR-0062 D2 for profile eligibility only; TDR-0062 is not superseded, chain resolution remains excluded, and TDR-0076 stays unused. | The conflict was with TDR-0062's eligibility boundary, not with its closed sets, and TDR-0062's own revisit trigger routes an admission-gating widening to a separate decision. Recording it at the consumer that changed it keeps the repository from carrying two contradictory current truths. | 2026-11-22 |
| DEC-8 | Eligibility is one rule at two levels. The selection pass walks the chain in declared order, the first fully eligible profile wins, and later profiles are reported `shadowed` and not probed, so the eligibility list reports selection-time verdicts only. The substitution search runs only for a recorded-unavailable seat, inspects later profiles in declared order, probes their declared providers through the same memoized probe, and takes the first valid supplier — eligible under the same facts, declaring the seat, on a not-recorded-unavailable and capability-adequate provider — writing no candidate verdict into the list. A seat-level refusal therefore adds no evidence position: the list is carried unchanged, the selected profile stays `eligible`, later profiles stay `shadowed`, and the bounded refusal `summary` names the seat and the parked provider; the refusal emits no profile event. | The selected profile's declared providers really are available — only a seat model is recorded-unavailable — so flipping its verdict would misdescribe an unchanged selection, and candidate eligibility is a search fact rather than a selection verdict; `unavailable` and `capability-denied` differ in exit, retryability, and remedy, so the arm the operator must act on has to name the identity; and no profile-level ineligibility occurred, so no profile event is truthful on the refusal path. | 2026-11-22 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Composed profile availability probe (resolver/composition seam) | Updated — adds recorded parks and the recorded watch condition with freshness to its inputs; keeps declaration, enablement, and declared peak; adds no network, credential, or write |
| Profile selection engine | Updated — reports park-derived blockers on the ineligible profile; adds the seat-level re-check and substitution; vocabulary and event shapes unchanged |
| Provider park fold consumer | Reused — one additional read-only consumer of the verified fold; no new writer and no new projection |
| `provider profile resolve` surface | Updated — truthful env record and binding; `provider.profile.unavailable` refusal naming seat and provider |
| Dispatch nomination predicate | Inherits — constructed from the same probe factory as the profile-resolve edge handler and the spawn-context helper, so admission and spawn agree without a second availability derivation |
| `provider resolve` / chain resolver | Unchanged — verified by regression proof |
| `provider quota`, `provider parks list`, `provider watch status` | Unchanged — same folds and views; no field, filter, or write changes |
| State layer (`provider.park`, `provider.announcement`, target record) | Unchanged — same record kinds, schemas, keys, fences, and read-time activity rule |
| Decision record TDR-0075 (watch staleness as a profile-eligibility blocker) | New — records the narrowed `watch-stale` boundary and its zero-acquisition cost model; narrows TDR-0062 D2 for profile eligibility only without superseding it; TDR-0076 stays unused; its ledger index row lands with the change and is verified in phase 7 |
| Committed provider policy | Unchanged — no entry, chain, profile, seat, ceiling, or watch target edited |
| Feature specification "Provider Profiles and Watching" | Reconcile in phase 7 — its "production probe" sentence (declared, enabled, peak window only) and its "quota conditions reach the seam through the daemon, never through a quota fetch on the CLI probe" aggregation are superseded on the first half and preserved on the second |
| Feature specification "Dispatch Engine" | Reconcile in phase 7 — its definition of `provider.profile.unavailable` as the nomination refusal when "every candidate is ineligible" becomes incomplete; phase 7 states that the identity covers both the all-candidates-ineligible refusal and a seat-level refusal in which the selected profile is eligible but no profile supplies the seat |
| Feature specification "Result Contract" | Verify/clarify in phase 7 — its static one-line description of `provider.profile.unavailable` ("no provider profile is eligible under the current conditions") is checked against the two refusal causes and clarified if it reads as all-candidates-only |
| Feature specification "Peak Pausing" | Reconcile in phase 7 — its "(all candidates ineligible)" parenthetical is checked against the seat-level refusal cause and clarified |
| Operator guide "Provider Conditions and Parks" | Verify in phase 7 — its "the synchronous probe reads no live quota or balance" statement stays true (no live fetch is added) and should be clarified to say recorded park state **is** consumed |
| Specification statements on watch freshness | Reconcile in phase 7 — the current pages are silent about whether staleness affects profile eligibility, and the GH-350 change record declared it excluded. Phase 7 states the positive rule (consumed as a named blocker) and keeps chain resolution unchanged |
| Proof harness and committed fixtures | New — the eight-cause classification matrix, the profile-eligibility behaviour matrix, the freshness boundaries, the env-record/binding agreement proof, and the unchanged-chain regression |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the committed policy and recorded facts in which `zai-coding-plan` carries an active `quota-exhausted` park with a future expiry and `deepseek` is clear, at a resolution instant outside both declared entry peak windows, **when** `provider profile resolve --agent pm --for-spawn` runs, **then** it exits 0 with the delivered lifecycle `outcome` — `selected`, or `switched` when the recorded target moves from the base profile to the paid fallback — and `profile: paid`, the eligibility list reports `delivery` as `ineligible` with a blocker whose kind is `condition` and whose value is `quota-exhausted` naming `zai-coding-plan` and `paid` as `eligible`, the PM entry of the env record is `deepseek/deepseek-flash`, no env-record entry names `zai-coding-plan`, **and** the same result is obtained with no operator-local override present (the observed 2026-11-21 state reproduced from recorded facts alone) | F-1, F-4, NFR-7 |
| AC-F1-2 | **Given** the committed policy, no active park records, and no supplied observations, at a resolution instant outside both declared entry peak windows, **when** `provider profile resolve --agent pm --for-spawn` runs, **then** it selects `delivery`, the eligibility list reports `delivery` as `eligible` and `paid` as `shadowed`, and the PM entry of the env record is `zai-coding-plan/glm-5.3-flash` | F-1, F-4 |
| AC-F1-3 | **Given** an active `peak-window` park recorded for `zai-coding-plan` and `deepseek` clear, at an instant outside the declared entry peaks so that only the recorded park can drive the outcome, **when** `provider profile resolve --agent pm --for-spawn` runs, **then** it selects `paid` and emits `deepseek/deepseek-flash` with a `peak-window` blocker on `delivery`; **and when** the identical facts carry the cause `quota-exhausted` instead, **then** the decision, eligibility verdicts, and emitted model are identical and only the blocker value differs, proving that a peak park and a quota park are one eligibility rule | F-1, F-6 |
| AC-F2-1 | **Given** a provider that declares a `provider.profiles.watch.<name>` target with its own `maxAgeSeconds`, carries no active park, and is supplied a clear observation whose `ageSeconds` is exactly `maxAgeSeconds`, **when** profile resolution runs, **then** that provider is not clear: the profile using it is `ineligible` with a blocker whose value is `watch-stale`, and no env record names a model on that provider; **and when** the same observation is one second younger (`ageSeconds = maxAgeSeconds − 1`), **then** the provider is available under the delivered predicate; **and when** a provider declares no watch target and the composition supplies an old observation, **then** that provider is never stale; **and when** a composed live read supplies the read instant, **then** the reported age is 0 and `watch-stale` is never produced; **and when** the closed sets are compared with the delivered ones, **then** the park causes, condition kinds, watch conditions, skip reasons, announcement codes, error identities, event codes, and state record kinds are exactly equal, with zero additions | F-2, NFR-3, NFR-5 |
| AC-F3-1 | **Given** the `delivery` profile selected as eligible and an effective seat model — declared, set by a pacing rung from supplied pacing output, or set by an agent override — that names a provider carrying an active park, **when** resolution runs for the agent that targets that seat, **then** the same seat is taken from the first valid later profile in `preferenceChain` order — eligible under the same probe, declaring the seat, and declaring it on a provider that is not recorded-unavailable and satisfies the required capability — the emitted model for that seat is that profile's declared seat model, the env-record entry and the per-spawn binding for that agent carry that same model, and the selected profile, tier, rung, agent overrides, and eligibility list are otherwise unchanged; **and when** the candidate substitute's seat does not satisfy the capability the resolution requires, **then** that profile is not used as a source at all — the capability gate is preserved, no capability classification is emitted for the substitute, and the unsupplied seat is governed by AC-F3-2 | F-3, F-4 |
| AC-F3-2 | **Given** a selected profile whose effective seat model names a provider carrying an active park or a stale observation, and no later profile is a valid supplier after substitution inspection — each later profile in declared order is ineligible under the same probe, does not declare that seat, or declares it only on a capability-inadequate model — **when** resolution runs, **then** it refuses `provider.profile.unavailable` at exit 2, emits no env record and no binding, and invents no fallback model; the refusal is the delivered `data` envelope (`outcome: "refused"`, `code`, `summary`, `eligibility`, `events`) projected at exit 2, with no `error` envelope and no `data` absence; the bounded `summary` names **both** the seat and the parked provider; the eligibility list reports selection-time verdicts only and is carried unchanged — the selected profile remains `eligible`, later profiles remain `shadowed` (not probed during selection; the substitution search inspects candidates separately and writes no candidate verdict into the list), no blocker is appended to any entry, and no verdict flips; **and** the seat-level refusal emits no profile event at all — no `profile.selected`, no `profile.ineligible`, no `profile.switched`/`profile.reverted`/`profile.rung-changed` — and any selection-time event computed before the seat check is not emitted on this path, so the refusal envelope is the only evidence, with no new event code, condition, or evidence key, because no profile-level ineligibility occurred and the selected profile remains eligible | F-3, NFR-6, DM-2 |
| AC-F3-3 | **Given** zero park records and zero supplied observations, and an effective seat model that names a provider which is undeclared, or disabled, or inside its declared peak window, **when** resolution runs, **then** the outcome is exactly the delivered behaviour: the seat is neither substituted nor refused by this change, the emitted value is the delivered one, the eligibility verdicts and the exit code are unchanged, and no `watch-stale` or park blocker appears — proving the seat gate was not widened beyond recorded unavailability | F-3, NFR-7 |
| AC-F4-1 | **Given** any resolution that emits a `--for-spawn` env record, **when** the record is compared with the per-spawn binding produced from the same resolved selection for every declared seat, **then** each seat's env-record value equals the model the binding supplies, and no emitted value names a provider that has an active park or a stale observation at the resolution instant; **and when** a seat cannot be satisfied, **then** no record is emitted at all — never a partial record, placeholder, or inherited parent value — **and when** the dispatch nomination predicate is driven over the same configuration and facts, **then** its verdict matches the CLI resolution's verdict | F-4, F-1, F-3, NFR-1 |
| AC-F5-1 | **Given** a recorded park that is active at instant T and a state that is otherwise unchanged, **when** the clock advances past the recorded expiry with no configuration edit, no timer, no daemon, and no write, **then** the next resolution selects `delivery` and emits the z.ai seats again, and the same holds for a recorded condition that clears before expiry; **and when** the clock sits exactly at the recorded expiry, **then** the park is inactive and the provider available; **and when** the state was never parked, **then** the decision at that instant is identical; **and when** the resolution runs, **then** it appends zero park, announcement, or cleared records and the delivered target-record persistence is the only write on the surface | F-5, NFR-2, NFR-5 |
| AC-F6-1 | **Given** a committed fixture that pins every member of the eight-value park cause set, **when** each cause is presented as recorded state and classified, **then** `peak-window`, `quota-exhausted`, `budget-exhausted`, `provider-outage`, `credential-missing`, and `credential-rejected` each make their named provider unavailable with that cause as the blocker value, `chain-exhausted` (a `chain:<name>` park) and `reevaluation-cap` make no individual provider unavailable and clear no provider park, the `window`-scope `budget-exhausted` park is consumed as an eligibility input while the `ticket`-scope crossing is classified provider-attributable but persists no park and is therefore not readable as one, **and when** a cause is added to or removed from the closed set without a classification, or one is silently ignored or silently clears a provider, **then** the fixture fails naming the cause | F-6, F-1 |
| AC-F7-1 | **Given** the facts of AC-F1-1, **when** the mutating `provider resolve` runs with a state store, **then** behavior is unchanged: `zai-coding-plan` is skipped with reason `quota-exhausted`, the provider park is reported with cause `quota-exhausted` and a next-eligible time equal to the recorded reset instant, `deepseek` is selected, the delivered payload keys are unchanged, and the persisted park generation is the same as before this change; **and when** no park exists for any entry, **then** chain resolution, its skip reasons, and its selection are unchanged; **and when** the skip-reason and park-cause sets are compared with the delivered sets, **then** they are exactly equal | F-7, NFR-3 |
| AC-NFR1-1 | **Given** identical configuration, recorded park facts, observation facts, and an injected clock, **when** each resolution case runs three times and across two independent compositions, **then** decisions, eligibility lists, emitted models, event identities, and refusal codes are identical; the run performs zero network calls, zero live credential reads, and zero sleeps; no state records are appended beyond the delivered target-record persistence; **and when** the same resolution runs over a configuration declaring one hundred providers, **then** the park fold is read at most once and each distinct provider is probed at most once per pass; **and when** the park fold read fails, **then** the outcome is a named unavailable verdict, never a clear one and never an internal crash, with no new identity introduced | NFR-1, NFR-2, NFR-4, NFR-7, F-1 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Single change, no flag.** The defect and its correction are one behavior; a feature flag would leave the untruthful path reachable, which is the defect.
- **Capability exposure order.** The delivery exposes the corrected verdict first at the profile level, then at the seat level, then proves the whole matrix; the plan owns the phase structure and no plan detail belongs in this specification.
- **No operator action.** No configuration edit, migration step, credential rotation, or override removal is required or requested. An existing local override keeps working.
- **Proof before merge.** The behaviour matrix, the eight-cause classification fixture, the agreement proof, the freshness boundaries, and the unchanged-chain regression must be green in the aggregate gate before review.
- **Branch and target.** The change is delivered on its own branch with the PR targeting the tooling integration branch and left open for merge authority; commit hygiene follows the repository's commit convention.
- **Documentation lands next.** The reconciliation named in §22 is the phase-7 obligation; until it lands, this specification is the current statement of the contract and the review must be read against it.
- **Decision record lands with the change.** TDR-0075 is delivered with this change and stays `Proposed` until the human owner accepts it at the PR review; its ledger index row lands with the change and is verified in phase 7.
- **No announcement or operator communication** is required; the observable change is that `provider profile resolve` stops naming providers the operator already sees parked.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. There is no schema change, no record-shape change, and no key change. Existing `provider.park` records become readable as eligibility truth without transformation, because the fold and the read-time activity rule are delivered unchanged. Existing profile-target records, `provider-parks.json` projections, and `--all` views remain valid and unchanged. No seeding, back-fill, dual-read, or rollback data step exists; reverting the behavior requires no state repair.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A for personal data: no personal data is collected, derived, or exposed. Park and observation records are already secret-free and carry only bounded provider, condition, timing, and budget evidence. The change reads additional local state and emits no additional field, so the data inventory and retention position are unchanged. No vendor terms of service are newly exercised, because no vendor request is made.

## 21. SECURITY REVIEW HIGHLIGHTS

- **No new read surface.** No credential port call, environment read, network request, or secret-read allowlist entry is added; park facts are local state and observation facts are composition-supplied.
- **Fail-closed, not fail-open.** An unreadable park fold or observation yields a named unavailable verdict, so a tampered or damaged state cannot be used to force a spawn on a provider the policy considers unusable.
- **No privilege escalation path.** Profile resolution cannot write park state, clear a park, or fabricate a park, so it cannot be used to lift a pause; park authorship remains with the mutating chain resolver and the watch path.
- **Evidence stays bounded and clean.** The refusal names a seat and a provider only; no credential reference value, authorization header, endpoint userinfo, or raw response body can reach the new blocker or refusal text.
- **Redaction and canary coverage** extends to the new refusal and blocker paths: a canary credential must not appear in the refusal envelope, the eligibility list, the env record, the events, or the diagnostics.
- **Residual risk is low**: the change strictly narrows what can be spawned, and every narrowing is reversible by the clock alone.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Phase-7 reconciliation is mandatory, not cosmetic.** The Provider Profiles and Watching page currently states that the composed CLI availability probe reports a provider available when it is declared, enabled, and outside its declared peak window, and that quota conditions reach the seam through the dispatch daemon rather than the CLI probe. The first half is superseded by this change (recorded parks are now synchronous inputs); the second half stays true in the narrow sense that no live quota fetch occurs, and the page must say both things precisely: recorded park state is consumed, live verification is not performed. Phase 7's documentation scope is five specification pages, the operator guide, and the decision ledger: `doc/spec/features/feature-provider-profiles.md`, `doc/spec/features/feature-provider-engine.md`, `doc/spec/features/feature-peak-pausing.md`, `doc/spec/features/feature-dispatch-engine.md`, `doc/spec/features/feature-result-contract.md`, `doc/guides/provider-conditions-and-parks.md`, `doc/decisions/TDR-0075-watch-stale-as-profile-eligibility-blocker.md`, and its row in `doc/decisions/00-index.md`, with no residual contradiction left on any of them.
- **The refusal-cause wording needs a second pass.** `doc/spec/features/feature-dispatch-engine.md` defines `provider.profile.unavailable` as the nomination refusal when every candidate is ineligible. After this change that definition is incomplete: the identity also covers a seat-level refusal in which the selected profile is eligible but no profile supplies the seat. Phase 7 states both causes on that page. `doc/spec/features/feature-result-contract.md` carries a static one-line description of the same identity and `doc/spec/features/feature-peak-pausing.md` carries an "(all candidates ineligible)" parenthetical; both are verified and clarified in the same pass wherever the wording no longer holds as a general statement.
- **A historical boundary statement is narrowed.** The GH-350 change record declared `watch-stale` as a condition that never enters chain resolution or profile eligibility, and the current specification pages are silent on the question. TDR-0075 is the record that narrows that statement for profile eligibility only: chain resolution remains untouched, TDR-0062 is not superseded, and profile eligibility now consumes staleness as a named blocker with no vocabulary growth. Phase 7 states the positive rule on the profiles, engine, and peak pages instead of leaving the older absolute to be discovered as a contradiction.
- **The operator guide stays true with a clarification.** Its statement that the synchronous probe reads no live quota or balance remains correct, and should be clarified to say recorded park state is consumed, so an operator understands why `provider profile resolve` now agrees with `provider parks list`.
- **One probe factory, three call sites.** The profile-resolve edge handler, the spawn-context helper, and the dispatch nomination predicate must keep constructing the probe through one factory, with one verified fold read per resolution. A future fourth call site or a second availability derivation would recreate this defect silently; review of any probe change checks all three call sites and the single fold read.
- **No new operational surface.** No configuration key, command, flag, view field, or state document is added, so the runbook, the doctor checks, and the operator's mental model change only in one respect: profile resolution now reflects parks.
- **Cause classification is a maintained invariant.** The eight-cause classification table in Appendix A must be updated with any future cause, and the fixture fails if the closed set and the classification drift apart.
- **Cost and latency stay flat.** One park-fold read per resolution and memoized probes mean the operational cost does not grow with profile or seat count, and no timer means no background load.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Park | A named, self-expiring provider-availability pause persisted with a closed cause, active conditions, and an absolute expiry; `provider:<name>` for a provider park, `chain:<name>` for a chain park. |
| Provider-attributable cause | A park cause whose subject is one provider, so it makes that provider unavailable to selection. |
| Chain-level cause | `chain-exhausted` or `reevaluation-cap`: a cause describing the chain's or the loop's state, never an individual provider's availability. |
| Verified fold | The read that reconstructs current park state from verified ledger truth, the same fold the parks listing surface reads. |
| Read-time expiry | The rule that activity is derived from the clock and the recorded expiry, with no timer, delete, or expiry write. |
| Eligibility input | A fact that can make a provider unavailable to profile selection: declaration, enablement, declared peak window, an active provider-attributable park, or a stale observation. |
| Recorded unavailability | A provider that carries an active provider-attributable park or a stale declared watch observation; the only unavailability the seat-level re-check consumes, and the scope of the ticket's "parked provider" wording. |
| Watch observation | A composition-supplied freshness fact for one provider, `{ condition, observedAtMs }`, consumed at the read instant and never persisted, fetched, or written. |
| Substitution candidate | A later profile inspected as a possible source for a recorded-unavailable seat; it stays `shadowed` in the eligibility list whether or not it supplies the seat. |
| Seat | One named agent role's model assignment inside a profile, with a pacing class and a capability. |
| Effective seat model | The model a seat resolves to after pacing rungs and agent overrides, which may name a provider outside the profile's declared provider list. |
| Seat substitution | Taking the same seat from the first valid later profile in declared chain order — eligible under the same probe, declaring the seat, and declaring it on a not-recorded-unavailable, capability-adequate provider — because the selected profile's effective model names a recorded-unavailable provider. The search probes candidate declared providers through the same memoized probe and writes no candidate verdict into the eligibility list. |
| Truthful `--for-spawn` | The property that every value in the emitted env record names a provider available at the resolution instant, and that the record and the spawn binding agree. |
| Watch freshness | The additive rule that an observation is stale exactly when its age reaches the declared maximum, expressed only through the `watch-stale` condition. |
| Resolved profile | The profile selected by the preference chain at the resolution instant, after park-derived eligibility. |
| Spawn binding | The per-spawn mapping from a caller-supplied agent identity to the selected profile's seat and model. |

## 24. APPENDICES

### Appendix A — Park cause taxonomy and eligibility effect

| Cause | Subject | Provider-attributable | Effect on profile eligibility |
|-------|---------|-----------------------|-------------------------------|
| `peak-window` | one provider | Yes | Provider unavailable while the park is active; blocker value `peak-window` |
| `quota-exhausted` | one provider | Yes | Provider unavailable while the park is active; blocker value `quota-exhausted` |
| `budget-exhausted` | one provider | Yes | `window` scope: park with expiry, consumed as an eligibility input. `ticket` scope: entry failure, no park, so not readable by a read-only resolution and left to the chain resolver's delivered refusal |
| `provider-outage` | one provider | Yes | Provider unavailable while the park is active; blocker value `provider-outage` |
| `credential-missing` | one provider | Yes | Provider unavailable while the park is active; blocker value `credential-missing` |
| `credential-rejected` | one provider | Yes | Provider unavailable while the park is active; blocker value `credential-rejected` |
| `chain-exhausted` | one chain (`chain:<name>`) | No | No individual provider becomes unavailable; never silently clears a provider |
| `reevaluation-cap` | one provider's loop | No | No individual provider becomes unavailable; never silently clears a provider park |

The fixture pins this table row by row: a cause whose classification is missing, a cause treated as provider unavailability when it is chain-level, and a cause that leaves a parked provider apparently clear all fail it.

### Appendix B — The observed defect and its correction

Reproduced 2026-11-21 with the z.ai weekly quota at 100%:

- `provider resolve` reported the summary as DeepSeek selected, a `quota-exhausted` skip on `zai-coding-plan`, and an active `quota-exhausted` park on the same provider.
- `provider profile resolve --agent pm --for-spawn` reported the `delivery` profile as selected at rung `base` with `paid` shadowed, and emitted a z.ai model for the PM seat.

The two surfaces disagreed about the same provider at the same instant, and a native dispatch under the emitted record would have spawned the PM on an exhausted provider. The operator's workaround was a project-local preference-chain override to the paid profile.

After this change the same recorded facts produce the paid profile with the DeepSeek PM model, and the override is unnecessary. The correction is driven by recorded state, not by the live vendor response, so the case is reproducible offline.

### Appendix C — Probe inputs, before and after

| Input | Before | After |
|-------|--------|-------|
| Provider declared | Evaluated | Evaluated |
| Provider enabled | Evaluated | Evaluated |
| Declared peak window | Evaluated | Evaluated |
| Active provider-attributable park | Not evaluated | Evaluated from the verified fold at read time |
| Seat-level re-check scope | Not evaluated | Evaluated for every effective seat model, on recorded unavailability only (park or stale); declaration, enablement, and declared peak stay profile-level facts |
| Recorded watch condition | Not evaluated | Evaluated; a park derived from it is covered by the row above |
| Watch freshness | Not evaluated | Evaluated per declared watch target under §8.6; a stale observation is a named `watch-stale` blocker, and a provider with no declared target is never stale |
| Live quota fetch | Not performed | Not performed |
| Watch transport call | Not performed | Not performed |
| State write by the probe | None | None |
| Park/announcement write by profile resolution | None | None |
| New vocabulary | — | None |

### Appendix D — Proof matrix

| Case | Facts | Expected |
|------|-------|----------|
| Quota park | z.ai `quota-exhausted` active, DeepSeek clear, outside peaks | `paid`, PM model `deepseek/deepseek-flash`, `delivery` ineligible on `quota-exhausted` |
| Healthy | No parks, no observations, outside peaks | `delivery`, PM model `zai-coding-plan/glm-5.3-flash`, `paid` shadowed |
| Peak park parity | z.ai `peak-window` active, outside declared peaks | `paid`; cause changes the blocker name only |
| Recovery | Park expired, or condition cleared, no config change | `delivery` restored; zero writes by the read |
| Freshness boundary | Observation age at the bound, and one second below it | Stale at the bound, available below it |
| Cause taxonomy | All eight causes, each with a subject | Six attributable, two chain-level; none ignored, none clears a provider |
| Seat substitution | Selected profile's declared, rung-derived, or override-targeted seat on a parked or stale provider | Substitution search in declared order, candidate declared providers probed through the same memoized probe; seat taken from the first valid supplier (eligible under the same facts, declares the seat, not-recorded-unavailable, capability-adequate); no candidate verdict in the list |
| No supplier | Parked or stale seat; no later profile is a valid supplier after substitution inspection — each is ineligible under the same probe, does not declare it, or is capability-inadequate | `provider.profile.unavailable` as the delivered `data` envelope at exit 2, naming seat and provider in the bounded `summary`, eligibility list carried unchanged, no profile event, no env record |
| Seat gate boundary | Zero parks and zero observations; seat on a peak-parked, disabled, or undeclared provider | Delivered behaviour; no substitution and no new refusal (AC-F3-3) |
| Agreement | Any record-emitting resolution | Env record value equals binding value per seat; no parked provider named |
| Chain regression | The quota-park facts through `provider resolve` | Skip `quota-exhausted`, park with next-eligible time, DeepSeek selected, unchanged payload |
| Determinism | Identical facts, three runs, two compositions | Identical decisions, eligibility, records, identities, codes; zero network, credential, sleep, extra write |

### Appendix E — Vocabulary closure register

Unchanged and asserted equal to the delivered sets: park causes (eight), condition kinds (six), watch conditions (six), skip reasons (nine), announcement codes, provider error identities, profile event codes (`profile.selected`, `profile.switched`, `profile.reverted`, `profile.ineligible`, `profile.rung-changed`), state record kinds (`provider.park`, `provider.announcement`), payload schema identifiers, store-scoped keys, and the resolve envelope keys. No entry is added, renamed, or removed by this change.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-22 | @spec-writer | Initial specification for GH-377: recorded parks and watch freshness as profile-eligibility inputs, seat-level re-check with substitution and the named refusal, truthful `--for-spawn` agreement, read-time recovery, the eight-cause classification proof, and the unchanged-chain regression; no vocabulary growth and no policy edit |
| 1.1 | 2026-11-22 | @spec-writer | Revision after DoR iteration 1 (findings 1, 2, 3, 4, 5, 7, 8, 10; nit 12 deferred to the plan). Seat guarantee scoped to recorded unavailability — an active park or a stale observation — with AC-F3-3 as the regression boundary proving the seat gate was not widened; a capability-inadequate substitute is not a valid source and yields `provider.profile.unavailable`, so AC-F3-1 and AC-F3-2 no longer overlap and `capability-denied` is reserved for the selected profile's own seat; the seat-level refusal's evidence position is fixed (eligibility list carried unchanged, `summary` names seat and provider, no verdict flip, candidate stays `shadowed`); the watch-observation seam is specified as §8.6 with the per-declared-target staleness rule, the undeclared-target case, the live-read age-0 case, the excluded readings, and the production-honesty statement, with assumptions A-10 and A-11; TDR-0075 is cited as the record that narrows TDR-0062 D2 for profile eligibility only, replaces DEC-7, and joins the deliverable and phase-7 documentation scope; `## 26. DEFINITION OF DONE` is added; call-site language is corrected to one probe factory, three call sites, one fold read per resolution. |
| 1.2 | 2026-11-22 | @spec-writer | Revision after DoR iteration 2 (findings 2, 3, 5, 6 and the spec side of finding 4). Finding 2: one two-level rule stated in F-3, DM-2, §10, AC-F3-2 and DEC-8 — the selection pass walks the chain and does not probe later profiles, while the substitution search inspects later candidates through the same memoized probe and writes no candidate verdict into the eligibility list; AC-F3-2's Given no longer treats later-profile ineligibility as a premise. Finding 5: the seat-level refusal emits no profile event of any kind — the refusal envelope is the only evidence — stated in EVT-2, §10 and AC-F3-2. Finding 3: §8.5 names the delivered `data` refusal envelope at exit 2 via the `platform-provider` projection; the phase-7 scope adds the dispatch-engine and result-contract pages; DOD-8's residual-gap sweep covers the all-candidates-ineligible-only reading of the refusal identity. Finding 6: DEC-7 cites TDR-0075 as the governing record and NG-8 bounds the change to that one record, matching the TDR framing with both statements staying in force. |
| 1.3 | 2026-11-22 | @spec-writer | Delivered-behaviour alignments found during implementation, no scope, acceptance, DOD, TDR, or vocabulary change. Alignment 1: AC-F1-1 asserts the selection facts and accepts the delivered lifecycle `outcome` — `selected`, or `switched` when the recorded target moves from the base profile to the paid fallback — instead of forcing `selected`, and §8.5 states that the criterion asserts the selection facts rather than a forced lifecycle outcome and that the delivered switch/revert behaviour is unchanged. Alignment 2: §8.6 and F-2 state staleness for the delivered configuration shape of one watch target per provider name — a provider whose declared watch target is stale is unavailable, replacing the "at least one stale declared target" phrasing — while the per-target `maxAgeSeconds` predicate and the no-target-never-stale rule are unchanged. |

## 26. DEFINITION OF DONE

The change is done only when every item below is observed rather than asserted. Every acceptance criterion in §17 is closed by a named case, and the seat, refusal, and freshness behaviour additionally satisfies the rules stated once in F-3, DM-2, and §10.

| ID | Definition-of-Done item | How observed |
|----|-------------------------|--------------|
| DOD-1 | Every functional and NFR acceptance criterion is green. | The test plan's traceability matrix maps each criterion in §17 (`AC-F1-*`, `AC-F2-*`, `AC-F3-1`..`AC-F3-3`, `AC-F4-*`, `AC-F5-*`, `AC-F6-*`, `AC-F7-*`, `AC-NFR1-1`) to its owning case; `TMPDIR=$PWD/tmp/tmpdir pnpm check` exits 0, and the captured log shows every owning case green with no check skipped, disabled, or made vacuous. |
| DOD-2 | The committed policy and any operator-local file are untouched. | The committed `.jaiship/config.yaml` and any operator-local layer present at start are byte-identical at end (digest comparison); the change diff contains no policy edit and no added configuration key; no operator-local override is required to obtain the accepted record (AC-F1-1's override-absent arm). |
| DOD-3 | The vocabulary and the decision boundary are intact. | A set-equality inventory shows zero new members in every closed set (park causes, condition kinds, watch conditions, skip reasons, announcement codes, error identities, event codes, state record kinds, schema identifiers) and zero new envelope keys; TDR-0075 is present and narrows TDR-0062 D2 for profile eligibility only, TDR-0062 is not superseded, and TDR-0076 is unused; the pages named in §22 and the decision index are reconciled in phase 7 with no residual contradiction (AC-F2-1, AC-F7-1, NFR-3). |
| DOD-4 | One probe factory, three call sites, one fold read. | A construction census shows the probe built through one factory at exactly three sites — the profile-resolve edge handler, the spawn-context helper via an injected reader, and the dispatch nomination predicate — with one verified park-fold read per resolution and no second availability derivation; the regression fails if a fourth site or a second derivation appears (AC-NFR1-1, NFR-2, NFR-4, RSK-6). |
| DOD-5 | The read-only contract is observed, not claimed. | The hermetic audit records zero live fetch, zero credential read, zero network call, and zero real sleep on every resolution path, and zero park, announcement, or cleared records written by profile resolution; the delivered target-record persistence remains the only write on the surface (AC-F5-1, AC-NFR1-1, NFR-1, NFR-2). |
| DOD-6 | Delivery hygiene and platform state are as declared. | Every commit was created through the commit primitive; the PR is open against `main-tools` and unmerged, with merge authority outside the change; the decision ledger maximum is re-verified at delivery time and TDR-0076 remains unused (§18). |
| DOD-7 | The delivery ledger and the gates support the claim. | Every declared plan phase is complete with a per-phase pm-notes `notes:` entry naming the plan phase id, the commit hash, and the test result; review reports PASS; the quality gates are green; the branch-range commit-message gate reports `PASS` over the change branch's own commits and that verdict is recorded as a pm-notes `notes:` entry. |
| DOD-8 | Current-truth documentation carries no residual gap. | `@doc-syncer` reconciles every page named in §22 — the profiles page, the engine page, the peak-pausing page, the dispatch-engine page, the result-contract page, the provider-conditions-and-parks guide — plus the decision ledger, and a residual-gap sweep over that page set finds zero statements presenting, as current, the three-check probe, the absolute `watch-stale` exclusion, or an all-candidates-ineligible-only reading of `provider.profile.unavailable` (the identity covers both the all-candidates-ineligible refusal and the seat-level refusal in which the selected profile is eligible but no profile supplies the seat) (NG-7, §22). |

---

## AUTHORING GUIDELINES

This specification was authored from the ticket body, the owner-authored implementation-pointer comment of 2026-11-22, the change's pm-notes decisions, the current provider, profile, peak-pausing, and parks specifications, and the delivered contracts for park causes, condition and watch condition sets, profile selection, and the composed availability probe. The two clarification questions raised at intake are resolved in the pm-notes and recorded here as contract statements; the one that narrowed a delivered boundary is recorded as TDR-0075, which narrows TDR-0062 D2 for profile eligibility only, leaves TDR-0062 otherwise intact, and keeps TDR-0076 unused. The scope is deliberately the resolver/composition seam plus profile and seat resolution: the committed policy is treated as fixed input, the operator's local override is treated as neither required nor removed, and every accepted behaviour is expressed as a testable contract with an explicit vocabulary-closure check. §8.6 states the observation seam and the honest limit of its reach today; §26 states the change's own Definition of Done. The known contradiction in the profiles page, and the narrower watch-freshness boundary sentence, are recorded as phase-7 reconciliation obligations rather than silently edited or silently ignored.

## VALIDATION CHECKLIST

- [x] `change.ref` matches the provided `workItemRef` (`GH-377`)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] `change.milestone` is the tracker milestone title verbatim and matches the pm-notes value
- [x] All sections present in the required order (1–26 plus authoring guidelines and checklist)
- [x] Document version 1.3 recorded in the Document History with the revision's two delivered-behaviour alignments named
- [x] ID prefixes consistent and unique (`F-`, `AC-`, `NFR-`, `RSK-`, `DEC-`, `DM-`, `EVT-`, `OQ-`, `A-`, `DOD-`)
- [x] Acceptance criteria reference at least one capability or NFR and use Given/When/Then
- [x] AC-F1-1 asserts the selection facts — `profile: paid`, the eligibility verdicts, the emitted model — and accepts the delivered lifecycle `outcome` (`selected`, or `switched` on the base-to-paid target move) rather than forcing `selected`; §8.5 states the criterion does not force a lifecycle outcome and that the delivered switch/revert behaviour is unchanged
- [x] The staleness rule in §8.6 and F-2 uses the delivered one-target-per-provider shape — a provider whose declared watch target is stale is unavailable — with no "at least one" aggregation, while the per-target `maxAgeSeconds` predicate and the no-target-never-stale rule are retained
- [x] AC-F3-1, AC-F3-2, and AC-F3-3 are non-overlapping: substitution, the no-valid-substitute refusal, and the unchanged delivered behaviour outside recorded unavailability
- [x] The seat guarantee is scoped to recorded unavailability (active park or stale observation), and AC-F3-3 proves the gate was not widened
- [x] One two-level rule is stated consistently in F-3, DM-2, §10, AC-F3-2, and DEC-8: the selection pass walks the chain in declared order and does not probe later profiles, while the substitution search inspects candidates in declared order through the same memoized probe and writes no candidate verdict into the eligibility list
- [x] The seat-level refusal names the seat and provider in the bounded `summary` while the eligibility list is carried unchanged, with no envelope key, no appended blocker, and no verdict flip
- [x] The seat-level refusal emits no profile event of any kind — no `profile.selected`, no `profile.ineligible`, no `profile.switched`/`profile.reverted`/`profile.rung-changed` — and the refusal envelope is the only evidence (EVT-2, §10, AC-F3-2)
- [x] The refusal projection is named once as the delivered `data` envelope at exit 2 (`outcome: "refused"`, `code`, `summary`, `eligibility`, `events`) through the `platform-provider` projection, never an `error` envelope and never absent `data` (§8.5, AC-F3-2)
- [x] The watch-observation seam, the per-declared-target staleness rule, and the "no production composition supplies a stale observation" limit are stated (§8.6, A-10, A-11)
- [x] NFRs carry measurable values or exact predicates
- [x] Risks include impact and probability, plus mitigation and residual risk
- [x] No implementation tasks, code file paths, or step-by-step instructions
- [x] No new park cause, condition kind, skip reason, announcement code, error identity, event code, state record kind, or envelope key claimed
- [x] Committed policy and operator-local configuration declared unchanged
- [x] Document contradictions named as phase-7 obligations rather than changed here, with the pages named in §22 (profiles, engine, peak-pausing, dispatch-engine, result-contract) and the decision index in that scope
- [x] The phase-7 page set is expanded, and DOD-8's residual-gap sweep covers the refusal-cause wording — the identity covers both the all-candidates-ineligible refusal and the seat-level refusal — as well as the three-check probe and the absolute `watch-stale` exclusion
- [x] TDR-0075 authored in this change and cited as the narrowed-boundary authority; TDR-0062 not superseded; TDR-0076 explicitly unused
- [x] `## 26. DEFINITION OF DONE` present with DOD-1..DOD-8 traced to acceptance criteria and to the delivery conventions
