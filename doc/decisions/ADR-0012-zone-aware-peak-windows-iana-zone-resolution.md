---
id: ADR-0012
decision_type: adr
status: Proposed
created: 2026-11-19
decision_date: null
last_updated: 2026-11-19
summary: "GH-350: peak windows admit IANA zone names (UTC retained as the default and the alias of Etc/UTC) whose offsets and transitions are resolved exclusively at a composition edge by one injected ProviderZonePort — isKnownZone, offsetSecondsAt, nextTransitionAtOrAfter — over the runtime's Intl data; the pure core receives zone facts, a zone-bound offsetSecondsAt/nextTransitionAtOrAfter value with UTC served by a core constant, and never reads Intl, the environment, or TZ data; the expiry is the earliest instant at or after the declared local end, computed exactly by a bounded transition-segment walk of at most three offset probes and three transition lookups, so a skipped local second resolves to the transition instant itself and a repeated local second to its first occurrence; an unknown zone refuses provider.peak.zone-unknown at exit 1 and a composition that cannot supply the port refuses non-UTC declarations rather than silently treating them as UTC; park cause, announcement code, and MAX/tie semantics are unchanged, and the park/announcement evidence allowlists gain exactly one field, timezone."
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
  - "A composition (daemon, MCP, embedded host) cannot supply the zone port, or can resolve offsets but cannot produce transition instants: the declared refusal is correct; revisit only if a second zone-data edge is genuinely required, and then admit it as a reviewed runtime edge rather than importing Intl into core or making the transition member optional."
  - "A runtime reports a zone as known while being unable to derive transitions for it: narrow `isKnownZone` to return false for that zone rather than letting the walk treat it as transition-free; never add an optional port member and never fall back to an offset-only approximation."
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
- **FACT:** An expiry boundary cannot be located from offsets alone. A fixed-point loop over `offsetSecondsAt` probes learns only offsets at instants it has already guessed; across a spring-forward gap the guesses alternate between the two sides of the discontinuity, so the loop's last candidate is the post-transition local reading (an hour late) or the pre-transition one (an hour early) and never the transition instant itself. Locating that instant is a fact about the zone, not a difference of two offsets (verified in the GH-350 phase-2 pre-implementation check, before any code was written).
- **FACT:** The ECMAScript `Intl` surface reports an offset for a (zone, instant) pair but exposes no transition instant, so the edge must derive one by a bounded search over the same offset function (or read a transition from a runtime that ships `Temporal`), and must verify what it returns (`offsetSecondsAt(zone, T) ≠ offsetSecondsAt(zone, T − 1000)`).
- **FACT:** Peak parking already carries a closed cause (`peak-window`), a closed announcement code (`provider.peak.parked`), and a bounded evidence allowlist. Nothing in this decision adds a cause or a code.
- **Why now:** GH-350 is the story that owns provider policy completeness. Every operator whose provider prices a non-UTC peak currently must shift the numbers by hand, which silently breaks twice a year under DST and is unauditable at review time. After this change the zone is declarative data like any other policy value.

## Problem Framing (Clarified)

The question is not "can we read a time zone?" but **where the zone fact is allowed to enter**. Three sub-problems hide inside one requirement:

1. **Zone identity.** A named zone (`Europe/Berlin`) is a rule with historical and future transitions; a fixed offset (`+02:00`) is a constant. They answer different questions. Provider pricing is published in a named zone, so an offset cannot express "weekdays 08:00–18:00 local" across a year.
2. **Purity.** The pure engine may compare local seconds-of-day against declared local bounds, but it may not discover the offset. Therefore the offset — and, because a boundary can fall inside a discontinuity, the transition instant — must be an *input* to the decision, resolved by an injected port at the composition edge, and the decision remains a pure function of (config, clock instant, zone facts).
3. **Boundaries with DST.** A local end second may be skipped or repeated by a transition. Without a declared rule, an expiry is either an hour early or an hour late, and the park's promised resume time becomes a lie in exactly the case an operator will notice. A declared rule is only honourable if the derivation can name the transition instant; an approximation cannot satisfy "the transition instant exactly", and a last-candidate fallback is not a rule at all.

Desired outcome: a zone name in configuration, the zone's offsets **and** transitions resolved at the edge, a pure evaluation, and one declared DST rule that every surface (engine, profile gate, daemon watcher) shares. Out of scope: windows crossing local midnight (the delivered no-crossing rule stands), per-window calendars/holidays, and a pinned tz database as a dependency.

## Constraints (Hard Requirements)

### C-1: The pure core never reads zone data or Intl

- **Statement:** `packages/core/provider` (and every core module it imports) performs no `Intl` call, no `TZ` environment read, no clock read, and no locale-dependent formatting; zone facts arrive as injected values.
- **Source:** prior decision (ADR-0003 runtime neutrality); ticket AC "policy expressed only in Jaiship config"
- **Verification:** boundaries/ambient-globals guard plus a negative fixture that fails if a zone or `Intl` reference appears in the provider tier
- **Negotiable:** no

### C-2: A declared zone is either honoured or refused by name — never silently reinterpreted

- **Statement:** A zone this runtime cannot resolve refuses the decision with a classified identity naming the field; it is never evaluated as UTC, never defaulted, never ignored, and never approximated from an incomplete set of zone facts. A composition that can resolve offsets but cannot produce transition instants is such an incomplete edge: it refuses rather than degrading to offset-only arithmetic.
- **Source:** internal standard (fail-closed validation; ADR-0007 fail-loud principle)
- **Verification:** test (unknown zone fixture refuses before any evaluation; no park and no selection produced; a port without a transition member does not satisfy the port type)
- **Negotiable:** no

### C-3: Resume instants are correct across a DST transition

- **Statement:** For every declared window and every evaluation instant, the computed expiry is the earliest instant at or after the evaluation instant whose local clock reading in the declared zone is at or after the declared local end second, including when the interval contains a transition; a repeated local second resolves to its first occurrence at or after the evaluation instant; a skipped local second resolves to the transition instant **exactly**, never to a rounded neighbour an hour away. The derivation is bounded and constant-cost: at most three `offsetSecondsAt` probes and at most three `nextTransitionAtOrAfter` lookups per evaluation, the transition lookup counted as its own fact class. The rule is shared by the engine, the profile gate, and the daemon watcher.
- **Source:** AC (ticket: "parking … with automatic resume when the window opens"; owner cost-control directive)
- **Verification:** test (DST matrix across spring-forward, fall-back, both hemispheres, a window not containing a transition, and the buffer edge; the spring-forward cell asserts equality with the transition instant to the millisecond; a counting port asserts the probe budget) + code review of the single shared derivation
- **Negotiable:** no

### C-4: Determinism and hermetic testability are preserved

- **Statement:** Identical configuration, injected clock instant, and injected zone facts produce byte-identical decisions, park records, expiries, and announcement identities; every test injects a table-driven zone fake that supplies offsets **and** transitions — a declared step table's transition instants are exactly its step boundaries — and reads no real tz data.
- **Source:** internal standard (provider-engine NFR determinism/hermeticity); ADR-0007 driver 1
- **Verification:** test (paired-run byte equality with a zone fake; zero live tz-data dependency in the suite; a counting fake asserts the probe budget without hidden internal probes)
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
4. **Failure legibility** — an unresolvable zone, or an edge that cannot resolve its transitions, must be a named refusal, not a silent UTC fallback and not an offset-only approximation.

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
| The expiry boundary is unreachable from offset probes alone: the fixed-point loop oscillates across a spring-forward gap and its last candidate is an hour early or an hour late, never the transition instant | FACT | GH-350 phase-2 pre-implementation analysis (`@coder`), verified before any code was written | C-3's "skipped local second resolves to the transition instant" would be unachievable with the delivered two-member port | High |
| `Intl` exposes an offset per (zone, instant) and no transition instant, so the edge derives transitions by a bounded search over its own offset function and verifies each answer by the offset change | FACT | platform capability (`Intl.DateTimeFormat` carries no transition member) | If a runtime offered transitions directly the adapter would be a pass-through; the core derivation is unchanged either way | High |
| A window never crosses local midnight and `endSecondsOfDay ≤ 86400`, so every expiry lies at most 24 h after the evaluation instant | FACT | delivered validation (`end > start`), Appendix B, ADR-0007 | Bounds the transition horizon the port must serve to one day forward, which is why `undefined` is a safe answer rather than a capability signal | High |
| A declared step table's transition instants are exactly its `fromMs` boundaries, so a fake or fixture zone source supplies transitions with no hidden probes | FACT | TDR-0058 §D2 (`zones` step table) | Hermetic tests would need a second transition channel, and the counting fixture could not pin an exact probe count | High |

## Mental Models & Techniques Used

- **First principles:** separate *zone identity* (a rule: offsets **and** transitions over time) from *the fact at an instant* (an offset, or the next transition). Configuration carries the identity; the composition resolves the facts; policy compares numbers. This is the same split ADR-0007 applied to credentials (reference vs material), and it is what makes the boundary a finite comparison instead of a search.
- **Inversion:** what makes a peak park untrustworthy? A resume time that is an hour wrong, a silently assumed UTC, or two surfaces disagreeing. Each inversion maps to C-3, C-2, C-3 again.
- **Second-order thinking:** reading `Intl` inside the engine would work on the developer's machine and fail the hermetic suite, then fail in a small-ICU host; the injected port makes the failure a refusal instead of a wrong decision. Likewise, adding one transition fact costs one port method once, where a bisection would cost 5–20 edge calls per lane per pass forever.
- **Boundary analysis:** the only hard part of zone arithmetic is the transition; declare the rule (earliest instant at or after the local end, first occurrence for a repeat) and give the derivation the one fact that makes the rule decidable, then keep one implementation.
- **KISS / least vocabulary:** the existing `timezone` position, cause, code, and boundary function carry the whole change; only an evidence field is added.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 pure | C-2 no silent reinterpretation | C-3 DST-correct | C-4 determinism | C-5 additive vocabulary | C-6 declarative config |
|---|---|---|---|---|---|---|
| ALT-0 keep UTC-only | ✅ | ✅ | ✅ (vacuous: no zones) | ✅ | ✅ | ✅ |
| ALT-1 numeric fixed offsets only | ✅ | ✅ | ❌ (a fixed offset cannot express a named-zone window across a transition) | ✅ | ✅ | ✅ |
| ALT-2 IANA names resolved in core via Intl | ❌ | ⚠️ | ✅ | ❌ | ✅ | ✅ |
| ALT-3 IANA names, zone facts (offsets + transitions) resolved at the composition edge (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 offsets plus a documented bisection, raised probe cap | ✅ | ✅ | ❌ (non-monotone across a fall-back; budget becomes data-dependent) | ✅ | ✅ | ✅ |
| ALT-5 amend the rule to "last fixed-point candidate" | ✅ | ⚠️ | ❌ (declines the exact-instant requirement) | ✅ | ✅ | ✅ |
| ALT-6 offsets at the edge plus a bundled transition table in core | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none claimed). ALT-6 is eligible and loses on driver fit (dependency restraint, lean delivery), not on a constraint.

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
- **Summary:** `timezone` admits `UTC` (default, alias of `Etc/UTC`) and IANA names matching a declared grammar. One injected `ProviderZonePort` — `isKnownZone(zone)`, `offsetSecondsAt(zone, atMs)`, and `nextTransitionAtOrAfter(zone, atMs)` — is implemented once over `Intl` in a new adapters subpath and wired by every composition (CLI, daemon, host). The pure evaluator receives a zone-bound facts value (`offsetSecondsAt(atMs)`, `nextTransitionAtOrAfter(atMs)`), computes local seconds-of-day, and resolves the expiry by a bounded transition-segment walk that is exact at both discontinuities; the existing boundary functions gain the same basis so engine, profile gate, and watcher agree.
- **Constraint compliance:** C-1 — no `Intl` or ambient read in core; zone facts arrive as an injected value and `UTC` is served by a definitional core constant. C-2 — an unknown zone refuses `provider.peak.zone-unknown` naming the field, before any evaluation, and a port that cannot produce transitions does not satisfy the port type. C-3 — one shared derivation, exact at the transition instant, constant probe budget. C-4 — zone facts are injected; fixtures pin a table whose step boundaries are the transitions. C-5 — no cause/code/skip change; one evidence field. C-6 — same key, same default, declarative string.
- **Driver fit:** Best on all seven.
- **Pros:** Correct local windows without a dependency; one arithmetic truth; the expiry is exact by construction rather than approximated; refusal is legible; the port is reusable by any future temporal rule.
- **Cons:** One new edge and one injected seam to wire into every composition; the adapter carries the only non-trivial edge code (deriving and verifying a transition instant); a composition that forgets the port must refuse rather than degrade silently (declared).
- **Why chosen:** It is the only option that satisfies the requirement and the purity boundary simultaneously, and the transition fact is the minimum additional fact that makes the declared rule honourable.

### Alternative 4 — Offsets Only, Documented Bisection, Raised Probe Cap

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** Keep the two-member port and locate the boundary by bisecting between the pre- and post-transition offsets on the predicate "local reading of `t` is at or after `E`", with the cap raised from three to roughly twenty probes.
- **Constraint compliance:** C-3 fails twice over. The predicate is monotone across a spring-forward, which is why the option is tempting — bisection does find the gap's end. It is **not** monotone across a fall-back: the predicate is true before the discontinuity, false immediately after, and true again later, so bisection returns *an* occurrence rather than the rule's first occurrence, and which one depends on the initial bracket. The budget also cannot stay constant: a one-day bracket needs about seventeen probes for one-second precision and more for a date-line-sized jump, so the probe count becomes a function of the data. C-1, C-2, C-4, C-5, C-6 pass.
- **Driver fit:** Fails driver 1 on the repeat cell — the twice-yearly case the rule exists for — and degrades driver 2, since the daemon would pay 5–20 edge calls per lane per pass.
- **Pros:** No new port member; one algorithm shape for every cell.
- **Cons:** Wrong on the fall-back cell; an unbounded, data-dependent budget no fixture can pin; and it still needs the transition instant for the repeat, at which point bisection buys nothing.
- **Why rejected:** It buys exactness only where the predicate happens to be monotone, at a permanent cost per daemon pass, and it cannot state the rule it claims to implement.

### Alternative 5 — Amend the Rule so a Skipped Local Second Resolves to the Last Fixed-Point Candidate

- **Eligibility:** Not eligible (declines C-3).
- **Summary:** Keep the two-member port and the delivered loop; redefine the spring-forward case as "whatever the last pass produced".
- **Constraint compliance:** C-3 fails by construction. The loop does not converge across the gap — it alternates between instants on either side of the discontinuity — so "the last candidate" is a function of pass parity, not of the zone: the park would promise a resume an hour early or an hour late, and which one would depend on the pass count rather than on the calendar. C-2 degrades: the rule text would still advertise "the earliest instant at or after the local end" while the engine computes something else, so the board and the engine disagree in exactly the case an operator checks. C-1, C-4, C-5, C-6 pass.
- **Driver fit:** Fails driver 1 outright and driver 3 — the watcher would inherit the same non-rule, so both surfaces would be wrong together and consistently, which is worse than disagreement.
- **Pros:** Zero port change; the smallest diff; every existing fixture keeps its shape.
- **Cons:** Delivers a known-wrong resume instant twice a year; makes the acceptance criterion unfalsifiable (there is no oracle for "the last candidate"); converts a correctness requirement into an implementation artefact.
- **Why rejected:** Retiring a requirement to accommodate an insufficient input is the inversion this decision exists to prevent. The correct input is one port method away and lives at the same edge — no new dependency, no new module, no new vocabulary.

### Alternative 6 — Offsets at the Edge Plus a Bundled Transition Table in Core

- **Eligibility:** Eligible; rejected on driver fit rather than on a constraint.
- **Summary:** Keep the two-member port for offsets and ship a compiled transition table (or a generated rule set) as a core data asset that the pure derivation reads.
- **Constraint compliance:** Passes C-1 … C-6 — embedded data is not an ambient read, and the asset is deterministic and hermetic. It contradicts this record's declared scope ("no pinned tz database as a dependency") rather than a constraint.
- **Driver fit:** Fails driver 6 (dependency restraint) and driver 7 (lean delivery), and adds a staleness liability: the repository would own tz-data updates and a version-skew class of bug the runtime already manages.
- **Pros:** No new port member; the pure core is self-sufficient; fixtures and production share one table.
- **Cons:** A data-asset lifecycle (sizing, provenance, update cadence), a second tz truth beside the runtime's, and a divergence risk that runtime versioning currently solves for free.
- **Why rejected:** It pays a permanent maintenance cost to avoid one port method. Reconsider only if a supported composition genuinely cannot derive transitions from its own offset function — the added revisit trigger covers that case.

## Decision

- **Decision:** Adopt **ALT-3**, amended so the zone port carries a transition fact and the expiry is produced by an exact bounded transition-segment walk rather than a fixed-point loop over offsets.
- **Rationale (tied to drivers):** drivers 1 and 3 are only satisfied by an *exact* boundary instant, and an exact instant is unobtainable from offset probes; one additional port method supplies it at the same edge, in the same module, under the same refusal path, without touching core purity or the vocabulary. Driver 6 is why the transition is read from the runtime rather than bundled; driver 7 is why the port grows by one member instead of by a second zone model.

### D1 — Admitted zone model

`provider.entries.<name>.peak.timezone` and `provider.profiles.profiles.<name>.peakWindows.windows[].timezone` admit the literal `UTC` (the default and the alias of `Etc/UTC`) or an IANA zone name matching `PROVIDER_ZONE_PATTERN` (`^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+)*$`, length bounded). The closed literal set `PROVIDER_PEAK_TIMEZONES` is retired and replaced by `PROVIDER_DEFAULT_ZONE = "UTC"` plus the pattern; `ProviderPeakWindow.timezone` becomes a string whose *existence* is resolved at the edge, never asserted by the pure validator. `startSecondsOfDay`, `endSecondsOfDay`, the buffer, the non-negative clamp, and the no-crossing rule keep their delivered meaning, now read as **local** seconds-of-day in the declared zone.

### D2 — The single zone edge

One new adapters subpath (`packages/adapters/src/time-zone/`) exports `createIntlZonePort(): ProviderZonePort` with three calls: `isKnownZone(zone)`, `offsetSecondsAt(zone, atMs)`, and `nextTransitionAtOrAfter(zone, atMs)`. It is the only module in the workspace that reads `Intl`/`TZ` data for provider policy; it performs no I/O, no network, and no environment read beyond what `Intl` itself uses. Core declares the port type and never imports the implementation.

```ts
// packages/core/src/contracts/provider.ts — types only (ambient-neutral tier)
export type ProviderZonePort = {
  readonly isKnownZone: (zone: string) => boolean;
  readonly offsetSecondsAt: (zone: string, atMs: number) => number;
  readonly nextTransitionAtOrAfter: (zone: string, atMs: number) => number | undefined;
};

/** The zone facts one evaluation can query; bound to a single zone. */
export type ProviderZoneFacts = {
  readonly offsetSecondsAt: (atMs: number) => number;
  readonly nextTransitionAtOrAfter: (atMs: number) => number | undefined;
};
```

`offsetSecondsAt(zone, atMs)` is the offset in effect at `atMs`; at a transition instant it is the **post-transition** offset. `nextTransitionAtOrAfter(zone, atMs)` is the smallest transition instant `T ≥ atMs` — an instant at which the zone's offset changes (`offsetSecondsAt(zone, T) ≠ offsetSecondsAt(zone, T − 1000)`) — or `undefined` when the runtime knows of no transition at or after `atMs`. It is a **required** member, not an optional one: a composition that can resolve offsets but cannot produce transition instants does not implement the port, and per C-2 it must not supply one. `undefined` is therefore reserved for a real fact — "no transition in the declared horizon" — and is never a capability signal, never a refusal, and never an implicit UTC. The core treats it as "no transition intervenes".

`undefined` is safe to treat that way for one structural reason: a declared window never crosses local midnight and `endSecondsOfDay ≤ 86400`, so every expiry lies at most 24 h after the evaluation instant. A zone with a transition in that day has one to report, and a zone with none is exactly a zone where the plain arithmetic in the current offset is correct. Refusing on `undefined` would fail a zone that lawfully abolished DST and would make a correct decision impossible; the failure it would guard against — a runtime reporting a constant offset for a zone that does transition — is an *edge fact-quality* failure no pure core can detect, and it is bounded by the configuration-time `isKnownZone` gate and by the tz-data revisit trigger.

The CLI, daemon, and host compositions each inject the port; a composition that cannot supply it **refuses a non-UTC declaration** with `provider.peak.zone-unknown` rather than treating the zone as UTC. `UTC` (and its alias `Etc/UTC`, normalised by the configuration projection) requires no port: the core binds `UTC_ZONE_FACTS`, the definitional constant `{ offsetSecondsAt: () => 0, nextTransitionAtOrAfter: () => undefined }`. That constant is a fact about UTC, not host tz data, so it keeps C-1 and the delivered "UTC needs no port" property.

### D3 — Pure evaluation and the exact expiry derivation

Local seconds-of-day = `(utcSecondsOfDay(nowMs) + zoneFacts.offsetSecondsAt(nowMs)) mod 86400`, normalised non-negative. The window is the delivered half-open interval `[openSec, endSec)`, read as local seconds, where `openSec = peakWindowOpenSeconds({ startSecondsOfDay, bufferBeforeSeconds })`. The open bound is **only ever a comparison bound**: by the time a window is open its open bound lies in the past, so no instant is derived from it and a buffer-clamped `openSec = 0` cannot produce a spurious instant. `peakWindowOpenSeconds` and `peakWindowEndSeconds` keep their names and stay the one seconds-of-day truth; neither is an expiry producer.

**The one named expiry derivation.** `peakWindowEndInstantMs(nowMs, zoneFacts, rule)` — three arguments, same name, same module; only the second parameter's *type* changes from a scalar offset to the zone-facts value. A scalar cannot express "re-resolve at the candidate", which is why the delivered signature could not be implemented as specified.

```ts
// packages/core/src/provider/peak.ts — pure; no Intl, no clock, no environment
export type PeakWindowEndRule = {
  readonly endSecondsOfDay: number;
  readonly bufferAfterSeconds: number;
}; // the same shape `peakWindowEndSeconds` already accepts, reused so there is one end-rule vocabulary

export const peakWindowEndInstantMs = (
  nowMs: number,
  zoneFacts: ProviderZoneFacts,
  rule: PeakWindowEndRule,
): number => { /* the walk below */ };
```

The engine writes this value as `expiresAtMs`; the daemon watcher uses it as its window end; the profile gate uses it for its lane decision. Callers obtain facts through an injected `zoneFactsFor(zone)` seam (engine dependencies; watch input), built by `bindZoneFacts(zone, port)` in the same module — so the three surfaces consume one derivation and one binder. A descriptor window has no after-buffer, so its caller passes `{ endSecondsOfDay: window.endSecondsOfDay, bufferAfterSeconds: 0 }`; a profile window passes its own two values.

`waitSeconds` on a peak condition and on its park is derived from the resolved expiry — `floor((expiresAtMs − nowS) / 1000)` — and never from `end − localNow`. Across a gap the two differ by the size of the skip, so a seconds-of-day subtraction would publish a `waitSeconds` that contradicts the park's own `expiresAtMs` (and the resume the board shows).

**Why the walk, and why a transition fact.** Work at whole seconds (`nowS = floor(nowMs / 1000) × 1000`, the delivered base) and let `LE(t) = t / 1000 + offsetSecondsAt(t)` be the local epoch second: linear inside an offset segment, jumping at each transition. Because windows never cross local midnight, `localNow = mod(nowS / 1000 + off₀, 86400)` anchors the local day exactly once, and the target is

```
E       = peakWindowEndSeconds(rule)                     // seconds of day, ≤ 86400
target  = (nowS / 1000 + off₀) − localNow + E            // a local epoch second
```

`target` is invariant across a repeated hour — both occurrences of the same reading yield the same local day start — which is precisely why the first-occurrence rule falls out instead of needing a special case.

```
off      ← zoneFacts.offsetSecondsAt(nowS)               // offset probe 1
segStart ← nowS
for seg ← 1 to 3:
    T   ← zoneFacts.nextTransitionAtOrAfter(segStart + 1000)   // transition probe seg
    t*  ← (target − off) × 1000                                // the instant this segment would satisfy
    if T = undefined or t* < T: return t*                      // the target lies inside this segment
    if seg = 3: return t*                                      // budget guard: never a fourth offset probe
    offNext ← zoneFacts.offsetSecondsAt(T)                     // offset probe seg+1
    if (T / 1000 + offNext) ≥ target: return T                 // the boundary itself is the earliest such instant
    off ← offNext; segStart ← T
```

The probe is `segStart + 1000` so that a transition occurring exactly at `nowS` is not re-reported: `offsetSecondsAt(nowS)` already carries the post-transition offset, and the first transition that can still invalidate a candidate is strictly after `nowS`. Two details carry the correctness: `t* < T` is a **strict** comparison, and the boundary test uses the **post**-transition offset at `T`. Together they make a fall-back's first occurrence resolve inside the previous segment and a gap's skipped reading resolve exactly at `T`.

**Probe budget.** At most **three `offsetSecondsAt` probes** and at most **three `nextTransitionAtOrAfter` lookups** per expiry derivation, with the third segment returning before it spends a fourth offset probe. The delivered ≤3 cap was a cap on offset probes and it still holds literally — the cap does not rise. The transition lookup is a different fact class with its own equal cap, so the total port-call ceiling is six, and the counting oracle counts per method. The counts are not merely bounded but small: one offset probe and one transition lookup when no transition lies between the evaluation instant and the expiry — every `UTC` window, every window on a zone without DST, and every window on a DST zone that is not open across its transition — and two of each when a single transition does (a twice-a-year case per zone).

**Result per cell.**

| Cell | Condition | Result | Probes |
|---|---|---|---|
| Normal — no transition between `nowS` and the candidate | `T` undefined, or `t* < T` | `t*`: the instant whose local reading is `E` | 1 offset + 1 transition |
| Spring-forward, `E` inside the skipped interval | `t* ≥ T` and `T/1000 + offNext ≥ target` | **`T` exactly** — the transition instant, never a rounded neighbour | 2 offsets + 1 transition |
| Spring-forward, `E` at the post-gap reading | boundary test true | `T` (local reading is exactly `E` at the transition) | 2 offsets + 1 transition |
| Spring-forward between `now` and `E`, `E` beyond the gap | `t* ≥ T` and the post reading is below `target` | the next segment's `t*` — the gap does not shorten the wall-clock distance, only the elapsed time | 2 offsets + 2 transitions |
| Fall-back, `E` inside the repeated interval | `t* < T` computed with the pre-transition offset | the **first** occurrence (`t*`) | 1 offset + 1 transition |
| Fall-back, `E` after the repeated interval, `now` inside the repeat | `t* ≥ T` and post reading below `target` | the next segment's `t*` — the only instant carrying that reading | 2 offsets + 2 transitions |
| `now` inside the repeat, `E` still ahead | first segment | the second-pass `t*`, because the earlier occurrence is already behind the evaluation instant | 1 offset + 1 transition |
| Two transitions inside one day (a 30-minute zone plus a rule change, a date-line-sized jump) | second walk iteration | the third segment's result | up to 3 offsets + 3 transitions |
| Budget exhausted after three segments | third iteration advances to the guard | the third segment's `t*` — deterministic last candidate; no IANA zone reaches this today | 3 offsets + 3 transitions |
| Runtime knows no transition at or after `nowS` | `T` undefined | `t*` in the current offset — exact for a zone with no further transition | 1 offset + 1 transition |
| Buffer edge | `E = peakWindowEndSeconds(rule)`, which may be the clamped `86400` | no special cell: the buffer enters through `peakWindowEndSeconds`; the clamped end resolves to the next local midnight by construction | as above |

The declared rule the result satisfies is: **the earliest instant at or after the evaluation instant whose local reading is at or after the declared local end second, with the earlier of two occurrences chosen when a reading repeats.** The three surface consumers are `evaluatePeakWindow(window, nowMs, zoneFacts)`, the profile gate, and the watcher's `peakWindowOpenAt(rules, nowMs, zoneFactsFor)`; all three call `peakWindowEndInstantMs` and none recomputes an instant from `utcSecondsOfDay`.

### D4 — Classified refusal

A syntactically invalid zone string stays a delivered *shape* failure on the surface that declares it: `provider.chain.invalid` for a descriptor `peak` block and `provider.profile.invalid` for a profile `peakWindows` window, naming the field. A syntactically valid but runtime-unknown zone — or a zone whose offset cannot be resolved at an instant — refuses with the **one** new provider-kind identity `provider.peak.zone-unknown` — category `user`, retryable `false`, consequence `not_landed`, projection `user-validation` (exit `1`) — carrying the offending field path in the safe summary, for both surfaces. Splitting the two cases is deliberate: the pure validator can decide grammar and cannot decide host tz data, so the environment-dependent failure gets its own name instead of masquerading as a malformed chain or profile. No wire format, park, or announcement is produced by a refusal.

### D5 — Unchanged availability vocabulary, one added evidence field

Park cause `peak-window`, condition kind `peak-window`, skip reason `peak-window`, announcement code `provider.peak.parked`, and the MAX/tie order are unchanged. The closed park evidence allowlist gains exactly one field, `timezone`, and therefore the announcement allowlist gains the same field through its existing base projection. Every park and announcement created from a zoned window carries the declared zone name (never an offset, never a locale string).

### D6 — Profile windows and lane pausing follow the same basis

`provider.profiles.*.peakWindows.*.timezone` admits the same domain; the derived `graceSecondsMax` bound, duplicate refusal, overlap-validates rule, multiplier data, and the `provider.profile.invalid` shape failure are unchanged. The daemon's window watch evaluates the same shared boundary functions and the same expiry derivation with the same port: each declared window's zone is bound through the injected `zoneFactsFor` seam, `peakWindowOpenAt(rules, nowMs, zoneFactsFor)` decides open/closed on local seconds-of-day, and the window end is `peakWindowEndInstantMs`, so a lane parks and resumes at the same instant the admission gate computed. A composition that cannot supply the port follows D2 for every non-UTC declaration (it refuses rather than treating the zone as UTC); it mounts no window-watch claim it cannot evaluate and reports the delivered `iteration-start-gating` mode exactly as any composition without the watch does.

- **Decider:** Juliusz Ćwiąkalski — pending at the GH-350 PR review.
- **Conditions for revisit:** see `revisit_triggers`.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 … C-6: no core zone or `Intl` read, with zone facts arriving as an injected value and UTC served by a definitional constant (C-1, enforced mechanically); unknown zones — and compositions that cannot produce transition instants — refuse by name with no silent UTC fallback and no offset-only approximation (C-2); one shared derivation, exact at both discontinuities, held to three offset probes and three transition lookups (C-3); injected zone facts — offsets and transitions — keep decisions deterministic and hermetic, with a step-table fake supplying transitions from its own boundaries (C-4); no cause, code, or skip-reason growth and exactly one new evidence field (C-5); the same declarative key with the same `UTC` default and no new branch (C-6). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- Declared local windows work for every provider, and the pause survives DST transitions without an operator edit.
- Engine, profile gate, and lane watcher share one boundary and one expiry rule, so a board `until` and a resume admission cannot disagree.
- The expiry is **exact by construction**, not approximated: the spring-forward case returns the transition instant itself, and the probe count is a constant rather than a function of the size of the gap.
- The zone model is a reusable seam for any later temporal policy (budget windows, release calendars) without touching core purity; the transition fact is reusable by the same consumers.
- Operator legibility improves: configuration and park both name the zone.

### Negative Outcomes

- Every composition must wire one more port; a forgotten wire is a refusal (loud, but a real integration step).
- The port grows one member and the adapter carries the only non-trivial edge code: a bounded forward search for the transition instant, which must be verified by the offset change rather than trusted from an API.
- Decisions now depend on host tz data through the port. Tests pin a fake; production inherits `Intl` versioning, which is an environment fact rather than a repository fact.
- The provider-kind error table grows by one row, with the delivered bidirectional sync and count pins to move.
- A fixed numeric offset is still expressible only as a zone; an operator who genuinely wants a literal offset has no declaration (deliberate).

### Unresolved Questions

- [ ] Whether a reduced-ICU host should ship a fallback zone table or simply refuse (owner: `@spec-writer` to declare the refusal as the supported posture; revisit trigger 1).
- [ ] Whether the evidence field `timezone` must also appear on non-zoned (UTC-default) parks or only when explicitly declared (owner: `@spec-writer`; recommendation: always carry the effective zone, so absence never implies UTC).
- [ ] Whether `isKnownZone` must be narrowed to return `false` for a zone whose transitions the runtime cannot derive, rather than relying on the 24 h envelope argument (owner: `@coder`; revisit trigger 2 — a data build that reports a constant offset for a transitioning zone is the case that would force it).

## Implementation Plan

1. Contracts: retire `PROVIDER_PEAK_TIMEZONES`, add `PROVIDER_ZONE_PATTERN`, `PROVIDER_DEFAULT_ZONE`, `ProviderZonePort` (three members) and `ProviderZoneFacts`, and widen `ProviderPeakWindow.timezone`; add `timezone` to the park evidence allowlist.
2. Pure policy: in `peak.ts`, add `PeakWindowEndRule`, `UTC_ZONE_FACTS`, `bindZoneFacts`, and `peakWindowEndInstantMs` as the bounded transition-segment walk; make `evaluatePeakWindow` take the bound facts and derive `waitSeconds` from the resolved expiry; keep `peakWindowOpenSeconds`/`peakWindowEndSeconds` as seconds-of-day producers; extend the profile rule parser's zone check to grammar-only plus the edge existence check.
3. Edge: add the `time-zone` adapters subpath implementing all three port members (the transition lookup as a bounded forward search over the adapter's own offset function, with each answer verified by `offset(T) ≠ offset(T − 1000)`); wire it into the CLI, daemon, and host compositions; wire the existence check into the provider configuration projection so `config debug` still reports the winning origin.
4. Error table: add `provider.peak.zone-unknown` and move the synchronization counts.
5. Specs/docs: provider-engine (peak section, evidence allowlist, error rows), provider-profiles (window rules), peak-pausing (shared basis), config-layer (zone value domain).
6. Tests: DST matrix (spring-forward asserting equality with the transition instant, fall-back asserting the first occurrence, southern hemisphere, no-transition, buffer edge), a counting port asserting three offset probes and three transition lookups at most, unknown-zone refusal, boundary equality across the three surfaces, and paired-run determinism with a step-table zone fake whose transitions are its step boundaries.

## Verification Criteria

- Metric: decisions differing between the engine gate, the profile gate, and the watcher for identical facts — Target: 0 — Window: GH-350 CI.
- Metric: DST-matrix cases with a resume instant other than the declared local end — Target: 0 — Window: GH-350 CI.
- Metric: spring-forward cases whose expiry differs from the transition instant by any amount — Target: 0 — Window: GH-350 CI (millisecond equality).
- Metric: peak conditions or parks whose `waitSeconds` disagrees with `floor((expiresAtMs − nowMs) / 1000)` — Target: 0 — Window: GH-350 CI.
- Metric: `offsetSecondsAt` port probes per expiry derivation exceeding 3 — Target: 0 — Window: GH-350 CI (counting fake).
- Metric: `nextTransitionAtOrAfter` port lookups per expiry derivation exceeding 3 — Target: 0 — Window: GH-350 CI (counting fake).
- Metric: unknown-zone declarations, or non-UTC declarations without a bindable port, evaluated as UTC — Target: 0 — Window: GH-350 CI.
- Metric: adapter transition instants failing the offset-change verification — Target: 0 — Window: GH-350 CI.
- Metric: `Intl`/zone references in the provider tier — Target: 0 — Window: GH-350 CI (boundaries check).
- Metric: new park causes, skip reasons, or announcement codes — Target: 0 — Window: GH-350 CI (structure inventory).

## Confidence Rating

**High.** The pure/edge split is the repository's established pattern (ADR-0003, ADR-0007), the single arithmetic home already exists, and the expiry rule is now exact by construction rather than by convergence: every cell is a finite comparison on two injected facts, and the probe budget is a constant. The medium-confidence elements are host tz-data variance and the adapter's own transition derivation — the first bounded by a refusal rather than a wrong decision, the second bounded by the offset-change verification and the counting oracle.

## References

- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — runtime-neutral core / adapters tiering.
- [ADR-0007](ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) — pure policy, injected I/O, fail-loud semantics, park vocabulary.
- [TDR-0029](TDR-0029-event-taxonomy-v2-peak-pause-kinds.md), [TDR-0030](TDR-0030-park-preservation-failure-classification.md) — the peak-pause episode contract the daemon watcher keeps.
- [TDR-0058](TDR-0058-provider-simulate-fixture-and-zero-write-simulation.md) — the simulate fixture's `zones` step table, whose `fromMs` boundaries are exactly the transition instants a hermetic zone facts source reports.
- Feature specs: [Provider Engine](../spec/features/feature-provider-engine.md), [Provider Profiles](../spec/features/feature-provider-profiles.md), [Provider Peak Pausing](../spec/features/feature-peak-pausing.md), [Configuration Layer](../spec/features/feature-config-layer.md).
- Change: `doc/changes/2026-11/2026-11-19--GH-350--provider-policy/`.

## Revision

### 2026-11-19 — transition fact in the zone port and an exact bounded expiry walk (GH-350 delivery, phase 2)

- **Status:** unchanged — `Proposed`, `decision_date: null`, `review_date: null`, `last_updated: 2026-11-19`. The owner accepts or rejects this record at the GH-350 PR review; this revision grants no authority and records no acceptance. No other decision record is added: the change is not separable from this one.
- **Trigger:** GH-350 delivery phase 2 stopped before any code was written. The coder proved the record's own D2/D3 contract unimplementable: `ProviderZonePort` declares only `isKnownZone` and `offsetSecondsAt`; Appendix B and AC-F1-2 / TC-ZONE-006 require the spring-forward case to resolve to the transition instant **exactly** (03:00 local, not 03:30); TC-ZONE-007 caps `offsetSecondsAt` at three calls per evaluation; and no budget of offset probes locates a transition to the millisecond — with three probes the loop oscillates across the gap and settles on the post-transition reading. `peakWindowEndInstantMs(nowMs, offsetSeconds, rule)` also took a scalar while requiring re-resolution at the candidate; a scalar cannot express that.
- **What this record had wrong:** three statements that a coder could only read as authority for an unimplementable, inexact, or self-contradictory contract.
  - **D2's two-member port.** Offsets alone cannot answer "which instant is the boundary". A transition instant is a fact about the zone, not a difference of two offsets, so the port as declared made C-3's exactness clause unachievable.
  - **D3's three-pass fixed point and "the last candidate is used".** The loop does not converge across a spring-forward and does not select the first occurrence on a fall-back; its result depends on pass parity. Stating it as the expiry mechanism contradicted the rule the same paragraph declared.
  - **The implicit `waitSeconds` derivation.** The delivered `evaluatePeakWindow` derives `waitSeconds` from `end − currentSeconds`. Once the expiry is an independent instant, that subtraction is wrong exactly where the expiry is non-obvious (a gap shortens the wait by the size of the skip), so the park would carry a `waitSeconds` contradicting its own `expiresAtMs`.
- **Corrected statements now carried by this record:** the port has three required members — `isKnownZone`, `offsetSecondsAt`, `nextTransitionAtOrAfter` — and `nextTransitionAtOrAfter` is required rather than optional, so an edge that cannot produce transition instants does not satisfy the port and refuses a non-UTC declaration instead of degrading; `undefined` means "no transition in the declared 24 h envelope", is never a capability signal, never a refusal, and never an implicit UTC; the pure input is the zone-bound `ProviderZoneFacts` value rather than a scalar offset, with `UTC` served by the definitional `UTC_ZONE_FACTS` constant; the expiry is the earliest instant at or after the evaluation instant whose local reading is at or after the declared local end, computed by a bounded transition-segment walk that returns the transition instant exactly in a gap, the first occurrence in a repeat, and is exact for every other cell; the probe budget is at most three `offsetSecondsAt` probes (the delivered cap, unchanged) and at most three `nextTransitionAtOrAfter` lookups (the same number, counted as its own fact class); and `peakWindowEndInstantMs(nowMs, zoneFacts, rule)` keeps its name, arity, module, and structural role — only the second parameter's type changes.
- **Sections amended in this revision:** front matter `summary` and `revisit_triggers` (two triggers: a partial edge, and a runtime that reports a zone as known while being unable to derive its transitions); Context (two FACT bullets — the offset-only impossibility and the absence of a transition API); Problem Framing sub-problems 2 and 3; C-2, C-3, C-4 (statements and verification); the Evidence table (four FACT rows); the Alternatives compliance matrix, the ALT-3 summary, and three new alternatives (ALT-4 bisection with a raised cap, ALT-5 retreating the rule, ALT-6 a bundled table in core) with their dispositions; the Decision intro and rationale; D2 (three members, the two types, the `undefined` semantics and why it is not a refusal, the UTC constant); D3 (rewritten: definitions, pseudocode, probe budget, per-cell table, the rule statement, and the single-derivation consumers); D6 (the watcher binds each window's zone through `zoneFactsFor` and uses the same derivation); the constraint attestation; Trade-offs (two positives, two negatives, one unresolved question); Implementation Plan 1–3 and 6; Verification Criteria (five added metrics and one widened); and the Confidence Rating. **No constraint changes number or intent**, D1, D4 (the refusal identity `provider.peak.zone-unknown` and its projection are untouched), D5, the closed vocabularies, the DACI assignment, and the alternative set's decision are unchanged.
- **Follow-ups this revision forces on other artifacts (not made here — this revision changes no spec, test plan, plan, pm-notes, or source file):**
  - **Specification** (`chg-GH-350-spec.md`): F-1's "`ProviderZonePort` (`isKnownZone`, `offsetSecondsAt`)" and "bounded fixed-point iteration (at most three passes, last candidate used)"; DM-1's port sentence; Appendix B's Evaluation and Expiry paragraphs and its four-row table; the glossary's "Zone port" and "Local seconds-of-day" rows; AC-F1-2's "the iteration stops at the first stable candidate or after three passes" and its `peakWindowEndInstantMs(nowMs, offsetSeconds, rule)` naming; RSK-1; DEC-1's "three-pass cap"; and the §16/§17 contract rows for `packages/core/src/contracts/provider.ts`, `provider/peak.ts`, and `domain/daemon-peak-pause.ts`.
  - **Test plan** (`chg-GH-350-test-plan.md`): TC-ZONE-005's negative control and TC-ZONE-006 are already compatible; TC-ZONE-007's *count* oracle ("at most 3 `offsetSecondsAt` calls per evaluation") still holds literally and its "last candidate" half survives as the budget-exhausted cell, but its fixture narrative ("one two-pass fixture … one deliberately unstable fixture") describes the removed fixed-point loop and needs rewording to segment counts; TC-ZONE-008's structural assertion is unchanged in shape (name, three arguments, one producer) and needs only the parameter name; §3.3's DM-1 row ("`isKnownZone` and `offsetSecondsAt` are the only zone facts policy sees"), NFR-3's "at most 3 fixed-point passes", the §7.1 fake-zone-port row, and the `peak.ts` contract row need the same correction.
  - **Plan** (`chg-GH-350-plan.yaml`): phase 2's contract comment (the two-member port, "bounded fixed-point iteration (at most three passes, last candidate used)", and the `peakWindowEndInstantMs(nowMs, offsetSeconds, rule)` description) and its "Delivered assertions that MOVE" list, since `evaluatePeakWindow` and `peakWindowOpenAt` each gain a facts parameter.
  - **TDR-0058:** compatible with no edit — a step table's `fromMs` boundaries are exactly the transitions its facts source reports, so the fixture schema and the `simulation.inputs.zones` disclosure stand.
  - **PM notes:** no edit required. Its entry quotes the ADR summary as it stood when that decision was recorded; the revision supersedes the text forward, it does not rewrite the history of what was decided.
- **Evidence for the replacement:** the walk was executed during this revision against `Europe/Berlin` spring-forward (an end inside the gap → the transition instant; an end at the post-gap reading → the same instant; an end beyond the gap → the next segment's instant), `Europe/Berlin` fall-back (an end inside the repeat → the first occurrence, one probe lower than the second; an end past the repeat; a repeat entered on its second pass), a non-DST zone (one offset probe and one transition lookup), and a date-line-sized 24 h jump. Every cell returned the rule's instant, and no cell spent more than two offset probes or two transition lookups. This is a check of the algorithm, not of a runtime's tz data.
