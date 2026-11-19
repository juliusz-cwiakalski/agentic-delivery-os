---
id: ADR-0012
decision_type: adr
status: Proposed
created: 2026-11-19
decision_date: null
last_updated: 2026-11-19
summary: "GH-350: peak windows admit IANA zone names (UTC retained as the default and the alias of Etc/UTC) whose offsets are resolved exclusively at a composition edge by one injected ProviderZonePort over the runtime's Intl data; the pure core receives offset facts and never reads Intl, the environment, or TZ data; local seconds-of-day and the absolute expiry are computed by a bounded DST-correct rule (earliest instant at or after the declared local end, repeated local seconds resolve to their first occurrence); an unknown zone refuses provider.peak.zone-unknown at exit 1 and a composition that cannot supply the port refuses non-UTC declarations rather than silently treating them as UTC; park cause, announcement code, and MAX/tie semantics are unchanged, and the park/announcement evidence allowlists gain exactly one field, timezone."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider policy: peak windows, profile windows, lane peak pausing"
decision_scope: repo
review_date: null
business_impact: "Peak cost control stops being wrong for every operator whose provider prices a local peak window; a declared window parks on the provider's local clock instead of an assumed UTC one, without weakening determinism or the pure-core boundary."
customer_impact: "An operator writes `timezone: Europe/Berlin` on a descriptor or profile window and gets the pause they declared, with the zone named on the park and the resume instant correct across a DST transition; a zone this runtime cannot resolve is refused by name instead of silently evaluated as UTC."
classification:
  domains: [architecture, contracts, cost-control, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-350 clarify_scope: ticket asks for peak windows with time zones; delivered v1 admits UTC only)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-350 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-350 clarify-scope: scope gap versus delivered UTC-only peak rule)"
    - "@spec-writer (GH-350 specification: field contracts and fixtures this record fixes)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-350 PR review — this record fixes a cross-surface temporal basis)"
  performers:
    - "@spec-writer (encode the zone grammar, the port, the DST rules)"
    - "@test-plan-writer (DST matrix oracles)"
    - "@coder (zone port, pure arithmetic, validation, fixtures)"
    - "@doc-syncer (provider-engine, provider-profiles, peak-pausing, config-layer reconciliation)"
  informed:
    - "Resident daemon and lane peak-pausing owners (the watch uses the same port)"
    - "Operators declaring windows"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A composition (daemon, MCP, embedded host) cannot supply the zone port: the declared refusal is correct; revisit only if a second zone-data edge is genuinely required, and then admit it as a reviewed runtime edge rather than importing Intl into core."
  - "Intl tz-data variance across supported runtimes produces a different offset for the same zone and instant in a recorded fixture: pin the affected fixtures and, if the variance is material to a delivery decision, reconsider a pinned tz database as an added dependency."
  - "An operator needs a window that crosses local midnight: that is a separate semantic extension (split windows or a crossing flag), not a zone change; reopen only with a recorded decision."
  - "A DST transition inside an open window is observed to produce a resume instant that disagrees with the board's window end: the expiry rule (not the zone model) is reopened."
links:
  related_changes: ["GH-350"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-provider-engine.md"
    - "doc/spec/features/feature-provider-profiles.md"
    - "doc/spec/features/feature-peak-pausing.md"
    - "doc/spec/features/feature-config-layer.md"
  contracts:
    - "packages/core/src/contracts/provider.ts"
    - "packages/core/src/provider/peak.ts"
    - "packages/core/src/provider/peak-rules.ts"
    - "packages/core/src/config/catalog.ts"
  decisions: ["ADR-0007", "TDR-0029", "TDR-0030"]
  roadmap_items: ["M4-S4"]
---

# ADR-0012: Zone-Aware Peak Windows — IANA Zone Names Resolved at the Composition Edge

## Context

- **FACT:** The ticket asks for "peak windows with time zones". The delivered engine admits exactly one basis: `PROVIDER_PEAK_TIMEZONES = ["UTC"]`, and both the descriptor `peak` block and the profile `peakWindows` block validate a `UTC`-only `timezone` designation (`packages/core/src/contracts/provider.ts`, `packages/core/src/provider/validate.ts`, `packages/core/src/provider/peak-rules.ts`).
- **FACT:** Peak evaluation is pure arithmetic over UTC seconds-of-day (`packages/core/src/provider/peak.ts`): `[max(0, start − buffer), end)` and an expiry `now + (end − currentSeconds)`. Profile windows and the daemon's lane watcher reuse the same boundary functions (`peakWindowOpenSeconds`, `peakWindowEndSeconds`), so a basis change is a cross-surface change, not a provider-engine local edit.
- **FACT:** The core tier is an ambient-neutral set: no runtime imports, ambient globals, clock, randomness, filesystem, network, or environment access; policy receives facts through injected seams (ADR-0003). `Intl` is an ambient global and time-zone data is host data, so neither may be read inside `packages/core/provider`.
- **FACT:** The seven-layer configuration validates every layer before merge and reports origins; the provider validator is pure and cannot ask the runtime whether a zone name is known.
- **FACT:** Peak parking already carries a closed cause (`peak-window`), a closed announcement code (`provider.peak.parked`), and a bounded evidence allowlist. Nothing in this decision adds a cause or a code.
- **Why now:** GH-350 is the story that owns provider policy completeness. Every operator whose provider prices a non-UTC peak currently must shift the numbers by hand, which silently breaks twice a year under DST and is unauditable at review time. After this change the zone is declarative data like any other policy value.

## Problem Framing (Clarified)

The question is not "can we read a time zone?" but **where the zone fact is allowed to enter**. Three sub-problems hide inside one requirement:

1. **Zone identity.** A named zone (`Europe/Berlin`) is a rule with historical and future transitions; a fixed offset (`+02:00`) is a constant. They answer different questions. Provider pricing is published in a named zone, so an offset cannot express "weekdays 08:00–18:00 local" across a year.
2. **Purity.** The pure engine may compare local seconds-of-day against declared local bounds, but it may not discover the offset. Therefore the offset must be an *input* to the decision, resolved by an injected port at the composition edge, and the decision remains a pure function of (config, clock instant, zone facts).
3. **Boundaries with DST.** A local end second may be skipped or repeated by a transition. Without a declared rule, an expiry is either an hour early or an hour late, and the park's promised resume time becomes a lie in exactly the case an operator will notice.

Desired outcome: a zone name in configuration, an offset resolved at the edge, a pure evaluation, and one declared DST rule that every surface (engine, profile gate, daemon watcher) shares. Out of scope: windows crossing local midnight (the delivered no-crossing rule stands), per-window calendars/holidays, and a pinned tz database as a dependency.

## Constraints (Hard Requirements)

### C-1: The pure core never reads zone data or Intl

- **Statement:** `packages/core/provider` (and every core module it imports) performs no `Intl` call, no `TZ` environment read, no clock read, and no locale-dependent formatting; zone facts arrive as injected values.
- **Source:** prior decision (ADR-0003 runtime neutrality); ticket AC "policy expressed only in Jaiship config"
- **Verification:** boundaries/ambient-globals guard plus a negative fixture that fails if a zone or `Intl` reference appears in the provider tier
- **Negotiable:** no

### C-2: A declared zone is either honoured or refused by name — never silently reinterpreted

- **Statement:** A zone this runtime cannot resolve refuses the decision with a classified identity naming the field; it is never evaluated as UTC, never defaulted, and never ignored.
- **Source:** internal standard (fail-closed validation; ADR-0007 fail-loud principle)
- **Verification:** test (unknown zone fixture refuses before any evaluation; no park and no selection produced)
- **Negotiable:** no

### C-3: Resume instants are correct across a DST transition

- **Statement:** For every declared window and every evaluation instant, the computed expiry is the earliest instant at or after the declared local end second, including when the interval contains one transition; a repeated local second resolves to its first occurrence; a skipped local second resolves to the transition instant. The rule is shared by the engine, the profile gate, and the daemon watcher.
- **Source:** AC (ticket: "parking … with automatic resume when the window opens"; owner cost-control directive)
- **Verification:** test (DST matrix across spring-forward, fall-back, both hemispheres, and a window not containing a transition) + code review of the single shared boundary function
- **Negotiable:** no

### C-4: Determinism and hermetic testability are preserved

- **Statement:** Identical configuration, injected clock instant, and injected zone facts produce byte-identical decisions, park records, expiries, and announcement identities; every test injects a table-driven zone fake and reads no real tz data.
- **Source:** internal standard (provider-engine NFR determinism/hermeticity); ADR-0007 driver 1
- **Verification:** test (paired-run byte equality with a zone fake; zero live tz-data dependency in the suite)
- **Negotiable:** no

### C-5: Additive vocabulary only

- **Statement:** No park cause, skip reason, condition kind, or announcement code is added or renamed; the only vocabulary growth is the evidence field `timezone` on park and announcement records, plus the widened `timezone` value domain.
- **Source:** internal standard (guarded-set discipline); ADR-0007 DC-3
- **Verification:** structure test (closed sets unchanged; allowlist growth is exactly one field)
- **Negotiable:** no

### C-6: Configuration remains declarative and brand-neutral

- **Statement:** The zone is a string value in the existing `peak.timezone` position; no new branch, no new key, no product or vendor literal, and the shipped default stays `UTC`.
- **Source:** AC (ticket: policy expressed only in Jaiship config); internal standard (brand neutrality)
- **Verification:** config tests (default origin `defaults`; declared origin reported by `config debug`) + brand-literal scan
- **Negotiable:** no

> **Table stakes:** the existing half-open window rule, the non-negative buffer clamp, the no-crossing rule, the closed cause/code, and the bounded evidence budget are unchanged and are not scored again.

## Decision Drivers

**Technical drivers (ranked):**

1. **Correctness of the cost control** — the pause must land on the instant the provider actually prices; an off-by-one-hour window fails at its purpose.
2. **Purity and determinism preserved by construction** — the zone fact must enter as data so the whole policy stays hermetically testable.
3. **One boundary truth** — engine, profile gate, and lane watcher must agree on open/close instants; a second arithmetic home is a defect factory.
4. **Failure legibility** — an unresolvable zone must be a named refusal, not a silent UTC fallback.

**Operational drivers:**

5. **Operator comprehension** — the zone is visible in configuration and on the park, so "paused until 10:00 Europe/Berlin" is auditable.
6. **Dependency restraint** — no tz database, no new package, no network; the runtime already ships zone data.
7. **Lean delivery** — extend the delivered `timezone` position and the delivered evaluation, rather than adding a parallel window model.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor`, routed from GH-350 clarify-scope.
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-350 PR review. The AI does not accept this record.
- **Contributors:** `@pm` (scope gap), `@spec-writer` (field and fixture contracts), `@decision-advisor` (analysis).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, human owner at the GH-350 PR review.
- **Performers:** `@spec-writer`, `@test-plan-writer`, `@coder`, `@doc-syncer`.
- **Informed:** daemon and peak-pausing owners, operators who declare windows.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| Peak evaluation is pure UTC seconds-of-day arithmetic and is the single home of the window boundary | FACT | `packages/core/src/provider/peak.ts` | A second arithmetic home would make C-3 unenforceable | High |
| Descriptor and profile windows both admit a `timezone` designation; both currently accept only `UTC` | FACT | `packages/core/src/provider/validate.ts` (`parsePeak`), `packages/core/src/provider/peak-rules.ts`, `packages/core/src/config/catalog.ts` | Widening one and not the other would leave the ticket half-satisfied | High |
| The daemon watcher consumes the same boundary functions, so a basis change reaches lane pausing without a second implementation | FACT | `packages/core/src/provider/peak.ts` (`peakWindowOpenSeconds`, `peakWindowEndSeconds`), `doc/spec/features/feature-peak-pausing.md` §3–4 | The daemon would need its own resolution and could disagree | High |
| The provider core is in the ambient-neutral set and may not read ambient globals | FACT | ADR-0003; `doc/spec/features/feature-provider-engine.md` §Boundaries | Resolving zones in core would be the cheap-but-forbidden option | High |
| Runtime `Intl` supplies IANA zone data with offset history, so a named zone is resolvable without a dependency | FACT | platform capability (`Intl.DateTimeFormat` with a zone and `longOffset`/`formatToParts`) | A pinned tz database would become a dependency decision | High |
| ICC/small-ICU builds can carry reduced tz data, so a syntactically valid zone may be unknown at runtime | ASSUMPTION | runtime packaging behavior | C-2's refusal path is real, not theoretical | Medium |
| No current consumer resolves a zone name other than by string equality with `UTC` | FACT | repository grep of `PROVIDER_PEAK_TIMEZONES` / `peak.timezone` consumers | A hidden membership check would break on a widened domain | Medium |
| Windows crossing local midnight stay out of scope | FACT | delivered validation (`end > start`) and ADR-0007 | A crossing rule would be a separate semantic extension | High |

## Mental Models & Techniques Used

- **First principles:** separate *zone identity* (a rule) from *offset* (a fact at an instant). Configuration carries the identity; the composition resolves the fact; policy compares numbers. This is the same split ADR-0007 applied to credentials (reference vs material).
- **Inversion:** what makes a peak park untrustworthy? A resume time that is an hour wrong, a silently assumed UTC, or two surfaces disagreeing. Each inversion maps to C-3, C-2, C-3 again.
- **Second-order thinking:** reading `Intl` inside the engine would work on the developer's machine and fail the hermetic suite, then fail in a small-ICU host; the injected port makes the failure a refusal instead of a wrong decision.
- **Boundary analysis:** the only hard part of zone arithmetic is the transition; declare the rule (earliest instant at or after the local end, first occurrence for a repeat) and keep one implementation.
- **KISS / least vocabulary:** the existing `timezone` position, cause, code, and boundary function carry the whole change; only an evidence field is added.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 pure | C-2 no silent reinterpretation | C-3 DST-correct | C-4 determinism | C-5 additive vocabulary | C-6 declarative config |
|---|---|---|---|---|---|---|
| ALT-0 keep UTC-only | ✅ | ✅ | ✅ (vacuous: no zones) | ✅ | ✅ | ✅ |
| ALT-1 numeric fixed offsets only | ✅ | ✅ | ❌ (a fixed offset cannot express a named-zone window across a transition) | ✅ | ✅ | ✅ |
| ALT-2 IANA names resolved in core via Intl | ❌ | ⚠️ | ✅ | ❌ | ✅ | ✅ |
| ALT-3 IANA names, offset resolved at the composition edge (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none claimed).

### Alternative 0 — Keep UTC-Only and Declare the Ticket Requirement Satisfied

- **Eligibility:** Eligible on every constraint, but only because it declines the requirement.
- **Summary:** Change nothing; document that peak windows are UTC and operators shift their numbers.
- **Constraint compliance:** Passes all constraints trivially; C-3 is vacuous.
- **Driver fit:** Fails driver 1 for every non-UTC provider and driver 5 (no auditable local window). A shifted number is indistinguishable from a typo, and re-derives the DST error twice a year.
- **Pros:** Zero delivery cost; no new edge.
- **Cons:** The ticket's explicit "with time zones" clause is declined; operators keep hand-shifting and hand-fixing.
- **Why rejected:** Declining a stated requirement is a scope decision for the owner, not an implementation convenience; the cost of the correct option is one injected port and one arithmetic rule.

### Alternative 1 — Fixed Numeric UTC Offsets Only

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** Admit `UTC` plus offsets such as `+02:00`/`-05:00`; compute local seconds as `utcSeconds + offset`.
- **Constraint compliance:** Purity and determinism pass; DST correctness fails by construction — the declaration cannot express "this window follows the provider's local clock", so it is wrong for roughly half of every year in any DST zone.
- **Driver fit:** Superficially simple, but it relocates the twice-yearly manual correction into configuration and makes the drift look declarative.
- **Pros:** Trivial arithmetic; no port.
- **Cons:** Exactly the failure the requirement exists to remove; an operator must edit policy at every transition.
- **Why rejected:** Fails C-3. It may still be *expressible* later as an explicit fixed-offset form if a provider prices a literal offset; that would be an additive variant, not this decision's model.

### Alternative 2 — IANA Names Resolved Inside the Core

- **Eligibility:** Not eligible (fails C-1 and C-4).
- **Summary:** Let the validator and evaluator call `Intl.DateTimeFormat` directly.
- **Constraint compliance:** C-1 is violated outright (ambient global in the neutral tier). C-4 degrades: the decision becomes a function of host tz data that tests cannot inject, and a runtime without full ICU silently changes a decision. C-2 degrades toward a thrown exception rather than a classified refusal.
- **Driver fit:** Best on implementation convenience, worst on the two drivers this architecture exists to protect.
- **Pros:** One call site; no port.
- **Cons:** Breaks the tier story mechanically; hermetic tests become impossible; the same config yields different decisions on different hosts.
- **Why rejected:** Disqualifying under C-1. The port exists precisely so the convenience is available at the edge and forbidden in policy.

### Alternative 3 — IANA Names With an Injected Zone Port Resolved at the Composition Edge (selected)

- **Eligibility:** Eligible (passes C-1 … C-6).
- **Summary:** `timezone` admits `UTC` (default, alias of `Etc/UTC`) and IANA names matching a declared grammar. One injected `ProviderZonePort` — `isKnownZone(zone)` and `offsetSecondsAt(zone, atMs)` — is implemented once over `Intl` in a new adapters subpath and wired by every composition (CLI, daemon, host). The pure evaluator receives the offset at the evaluation instant and the offset at each candidate expiry, computes local seconds-of-day, and applies the declared DST rule; the existing boundary functions gain the same basis so engine, profile gate, and watcher agree.
- **Constraint compliance:** C-1 — no `Intl` or ambient read in core. C-2 — unknown zone refuses `provider.peak.zone-unknown` naming the field, before any evaluation. C-3 — the rule is one shared function with the DST matrix. C-4 — zone facts are injected; fixtures pin a table. C-5 — no cause/code/skip change; one evidence field. C-6 — same key, same default, declarative string.
- **Driver fit:** Best on all seven.
- **Pros:** Correct local windows without a dependency; one arithmetic truth; refusal is legible; the port is reusable by any future temporal rule.
- **Cons:** One new edge and one injected seam to wire into every composition; a composition that forgets the port must refuse rather than degrade silently (declared).
- **Why chosen:** It is the only option that satisfies the requirement and the purity boundary simultaneously.

## Decision

- **Decision:** Adopt **ALT-3**.

### D1 — Admitted zone model

`provider.entries.<name>.peak.timezone` and `provider.profiles.profiles.<name>.peakWindows.windows[].timezone` admit the literal `UTC` (the default and the alias of `Etc/UTC`) or an IANA zone name matching `PROVIDER_ZONE_PATTERN` (`^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+)*$`, length bounded). The closed literal set `PROVIDER_PEAK_TIMEZONES` is retired and replaced by `PROVIDER_DEFAULT_ZONE = "UTC"` plus the pattern; `ProviderPeakWindow.timezone` becomes a string whose *existence* is resolved at the edge, never asserted by the pure validator. `startSecondsOfDay`, `endSecondsOfDay`, the buffer, the non-negative clamp, and the no-crossing rule keep their delivered meaning, now read as **local** seconds-of-day in the declared zone.

### D2 — The single zone edge

One new adapters subpath (`packages/adapters/src/time-zone/`, working name) exports `createIntlZonePort(): ProviderZonePort` with two calls: `isKnownZone(timezone)` and `offsetSecondsAt(timezone, atMs)`. It is the only module in the workspace that reads `Intl`/`TZ` data for provider policy; it performs no I/O, no network, and no environment read beyond what `Intl` itself uses. Core declares the port type and never imports the implementation. The CLI, daemon, and host compositions each inject it; a composition that cannot supply it **refuses a non-UTC declaration** with `provider.peak.zone-unknown` rather than treating the zone as UTC.

### D3 — Pure evaluation and the DST rule

Local seconds-of-day = `(utcSecondsOfDay(nowMs) + offsetSecondsAt(zone, nowMs)) mod 86400`, normalised non-negative. The window is open in the delivered half-open form. The expiry is resolved by fixed-point iteration bounded to three passes: compute the candidate as `now + (localEnd − localNow) seconds`, re-resolve the offset at the candidate, and recompute while the candidate moves; the loop stops at the first stable candidate or after three passes, and the last candidate is used. The declared rule is: **the earliest instant at or after the declared local end second** — a skipped local second resolves to the transition instant, and a repeated local second resolves to its first occurrence. `peakWindowOpenSeconds` and `peakWindowEndSeconds` keep their names and stay the one boundary truth; both are evaluated on the declared zone basis, so the engine gate, the profile gate, and the daemon watcher cannot disagree.

### D4 — Classified refusal

A syntactically invalid zone string stays a delivered *shape* failure on the surface that declares it: `provider.chain.invalid` for a descriptor `peak` block and `provider.profile.invalid` for a profile `peakWindows` window, naming the field. A syntactically valid but runtime-unknown zone — or a zone whose offset cannot be resolved at an instant — refuses with the **one** new provider-kind identity `provider.peak.zone-unknown` — category `user`, retryable `false`, consequence `not_landed`, projection `user-validation` (exit `1`) — carrying the offending field path in the safe summary, for both surfaces. Splitting the two cases is deliberate: the pure validator can decide grammar and cannot decide host tz data, so the environment-dependent failure gets its own name instead of masquerading as a malformed chain or profile. No wire format, park, or announcement is produced by a refusal.

### D5 — Unchanged availability vocabulary, one added evidence field

Park cause `peak-window`, condition kind `peak-window`, skip reason `peak-window`, announcement code `provider.peak.parked`, and the MAX/tie order are unchanged. The closed park evidence allowlist gains exactly one field, `timezone`, and therefore the announcement allowlist gains the same field through its existing base projection. Every park and announcement created from a zoned window carries the declared zone name (never an offset, never a locale string).

### D6 — Profile windows and lane pausing follow the same basis

`provider.profiles.*.peakWindows.*.timezone` admits the same domain; the derived `graceSecondsMax` bound, duplicate refusal, overlap-validates rule, multiplier data, and the `provider.profile.invalid` shape failure are unchanged. The daemon's window watch evaluates the same shared boundary functions with the same port, so a lane parks and resumes at the same instant the admission gate computed. A composition that cannot supply the port follows D2 for every non-UTC declaration (it refuses rather than treating the zone as UTC); it mounts no window-watch claim it cannot evaluate and reports the delivered `iteration-start-gating` mode exactly as any composition without the watch does.

- **Decider:** Juliusz Ćwiąkalski — pending at the GH-350 PR review.
- **Conditions for revisit:** see `revisit_triggers`.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 … C-6: no core zone or `Intl` read (C-1, enforced mechanically); unknown zones refuse by name with no silent UTC fallback (C-2); one shared DST rule with an explicit expiry algorithm (C-3); injected zone facts keep decisions deterministic and hermetic (C-4); no cause, code, or skip-reason growth and exactly one new evidence field (C-5); the same declarative key with the same `UTC` default and no new branch (C-6). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- Declared local windows work for every provider, and the pause survives DST transitions without an operator edit.
- Engine, profile gate, and lane watcher share one boundary and one expiry rule, so a board `until` and a resume admission cannot disagree.
- The zone model is a reusable seam for any later temporal policy (budget windows, release calendars) without touching core purity.
- Operator legibility improves: configuration and park both name the zone.

### Negative Outcomes

- Every composition must wire one more port; a forgotten wire is a refusal (loud, but a real integration step).
- Decisions now depend on host tz data through the port. Tests pin a fake; production inherits `Intl` versioning, which is an environment fact rather than a repository fact.
- The provider-kind error table grows by one row, with the delivered bidirectional sync and count pins to move.
- A fixed numeric offset is still expressible only as a zone; an operator who genuinely wants a literal offset has no declaration (deliberate).

### Unresolved Questions

- [ ] Whether a reduced-ICU host should ship a fallback zone table or simply refuse (owner: `@spec-writer` to declare the refusal as the supported posture; revisit trigger 1).
- [ ] Whether the evidence field `timezone` must also appear on non-zoned (UTC-default) parks or only when explicitly declared (owner: `@spec-writer`; recommendation: always carry the effective zone, so absence never implies UTC).

## Implementation Plan

1. Contracts: retire `PROVIDER_PEAK_TIMEZONES`, add `PROVIDER_ZONE_PATTERN`, `PROVIDER_DEFAULT_ZONE`, `ProviderZonePort`, and widen `ProviderPeakWindow.timezone`; add `timezone` to the park evidence allowlist.
2. Pure policy: extend `peak.ts` with the offset-aware local-seconds and bounded fixed-point expiry; route `peakWindowOpenSeconds`/`peakWindowEndSeconds` through the same basis; extend the profile rule parser's zone check to grammar-only plus the edge existence check.
3. Edge: add the `time-zone` adapters subpath and wire it into the CLI, daemon, and host compositions; wire the existence check into the provider configuration projection so `config debug` still reports the winning origin.
4. Error table: add `provider.peak.zone-unknown` and move the synchronization counts.
5. Specs/docs: provider-engine (peak section, evidence allowlist, error rows), provider-profiles (window rules), peak-pausing (shared basis), config-layer (zone value domain).
6. Tests: DST matrix (spring-forward, fall-back, southern hemisphere, no-transition), unknown-zone refusal, boundary equality across the three surfaces, paired-run determinism with a zone fake.

## Verification Criteria

- Metric: decisions differing between the engine gate, the profile gate, and the watcher for identical facts — Target: 0 — Window: GH-350 CI.
- Metric: DST-matrix cases with a resume instant other than the declared local end — Target: 0 — Window: GH-350 CI.
- Metric: unknown-zone declarations evaluated as UTC — Target: 0 — Window: GH-350 CI.
- Metric: `Intl`/zone references in the provider tier — Target: 0 — Window: GH-350 CI (boundaries check).
- Metric: new park causes, skip reasons, or announcement codes — Target: 0 — Window: GH-350 CI (structure inventory).

## Confidence Rating

**High.** The pure/edge split is the repository's established pattern (ADR-0003, ADR-0007), the single arithmetic home already exists, and the only genuinely new mechanics are the offset port and the declared DST rule — both fully testable with an injected table. The medium-confidence element is host tz-data variance, which is bounded by a refusal rather than a wrong decision.

## References

- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — runtime-neutral core / adapters tiering.
- [ADR-0007](ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) — pure policy, injected I/O, fail-loud semantics, park vocabulary.
- [TDR-0029](TDR-0029-event-taxonomy-v2-peak-pause-kinds.md), [TDR-0030](TDR-0030-park-preservation-failure-classification.md) — the peak-pause episode contract the daemon watcher keeps.
- Feature specs: [Provider Engine](../spec/features/feature-provider-engine.md), [Provider Profiles](../spec/features/feature-provider-profiles.md), [Provider Peak Pausing](../spec/features/feature-peak-pausing.md), [Configuration Layer](../spec/features/feature-config-layer.md).
- Change: `doc/changes/2026-11/2026-11-19--GH-350--provider-policy/`.
