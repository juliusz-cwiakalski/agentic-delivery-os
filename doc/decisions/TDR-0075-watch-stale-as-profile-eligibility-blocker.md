---
id: TDR-0075
decision_type: tdr
status: Proposed
created: 2026-11-22
decision_date: null
last_updated: 2026-11-22
summary: "GH-377: TDR-0062 D2's absolute that `watch-stale` never enters profile eligibility is narrowed for profile selection only. When a provider declares a watch target and the composition supplies an observation whose `ageSeconds = floor((nowMs − observedAtMs) / 1000)` is at or beyond that target's `maxAgeSeconds`, the provider is unavailable to profile selection and the blocker value is the already-delivered watch-only `watch-stale` condition. A provider with no declared watch target is never stale, and a composed live read observes at the read instant (age 0) and is never stale. Nothing else changes: chain resolution, `provider parks list`, `provider watch status`, park creation/clearing/expiry, the zero-write watch read path, and every closed set (park causes, condition kinds, watch conditions, skip reasons, announcement codes, error identities, event codes, state record kinds, schema ids, envelope keys) are exactly as delivered, and no fetch, credential read, retained snapshot, cache, timer, or state write is added. No production composition supplies a stale observation today, so the rule is a fail-loud guard for compositions that hold one and for the delivered park-expiry clamp, not a new steady-state ineligibility."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider policy: profile eligibility and watch observation freshness"
decision_scope: repo
review_date: null
business_impact: "The only surface that decides what a delivery spawns can no longer treat an aged balance or usage reading as headroom. It costs no new acquisition: the fact is already in the composition or it is absent, so the guard adds no latency, no vendor call, and no second truth. The declared residual is that no production composition supplies a stale observation today, so the commercial effect is prospective until one does."
customer_impact: "An operator sees `watch-stale` as the named reason a provider is unavailable to profile selection instead of a silent substitution or an unexplained refusal. `provider watch status` stays the authoritative observation surface; nothing claims a live verification that did not happen."
classification:
  domains: [provider-policy, profile-selection, eligibility, contracts, operations]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: medium
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-377 DoR iteration 1, finding 5: a delivered boundary is narrowed)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-377 PR review; AI does not accept this R2 record"
  contributors:
    - "@readiness-reviewer (GH-377 DoR finding 5: TDR-0062 D2 is contradicted by the shipped behaviour)"
    - "@pm (GH-377 clarify-scope and the OQ-1 revision; reserved ids TDR-0075..TDR-0076)"
    - "@spec-writer (GH-377 F-2, AC-F2-1, NG-8, DEC-7 as the statements this record governs)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@reviewer"
    - "Human owner (GH-377 PR review — this record fixes what profile eligibility may consume)"
  performers:
    - "@spec-writer (cite this record; state the observation seam and the staleness rule)"
    - "@test-plan-writer (freshness boundary arms and the closed-set equality arms)"
    - "@coder (probe consumes the observation and reports the blocker)"
    - "@doc-syncer (phase-7 reconciliation of the profiles, engine, peak, and parks-guide pages)"
  informed:
    - "Operators reading `provider parks list` and `provider watch status`"
    - "Future authors of a composition that retains or supplies a watch observation"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, option-generator, critic, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A production composition begins supplying a retained or cached watch observation. The guard then becomes a steady-state eligibility input; its acquisition, refresh, and invalidation contract must be decided then, not inferred from this record."
  - "A profile resolution is asked to fetch watch state live. That is a new acquisition path with latency, credential, and rate-limit consequences; it is explicitly out of this decision and contradicts the no-live-verification rule."
  - "A second staleness derivation appears (a per-seat freshness check, a daemon-side pre-spawn check, a park created to represent staleness). One predicate per fact is the rule; a second derivation reopens this record."
  - "An aged observation is ever observed as available or clear at the profile-eligibility surface. Treat it as a defect in the single predicate, never as a reason to widen the blocker vocabulary."
  - "The closed sets diverge by even one member (a new park cause, condition kind, skip reason, announcement code, error identity, event code, state record kind, schema id, or envelope key). Set equality is the attestation this record makes."
links:
  related_changes: ["GH-377"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-22--GH-377--provider-profile-consumes-parks/chg-GH-377-spec.md"
    - "doc/spec/features/feature-provider-profiles.md"
    - "doc/spec/features/feature-provider-engine.md"
    - "doc/spec/features/feature-peak-pausing.md"
    - "doc/guides/provider-conditions-and-parks.md"
  contracts:
    - "packages/core/src/contracts/provider.ts"
    - "packages/core/src/contracts/provider-profile.ts"
    - "packages/core/src/provider/quota.ts"
    - "packages/core/src/provider/profile.ts"
    - "packages/cli/src/edge.ts"
  diagrams: []
  decisions: ["ADR-0007", "TDR-0062"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S18"]
---

# TDR-0075: A Stale Watch Observation Is a Profile-Eligibility Blocker — A Narrowed `watch-stale` Boundary at Zero Acquisition Cost

## Context

- **FACT:** TDR-0062 D2 declares `watch-stale` watch-only and states that it "never enters chain resolution or profile eligibility". Its revisit triggers say that watch conditions as admission gates are "a new eligibility decision with its own cost model … decide it separately rather than widening this record". TDR-0062's status is `Proposed`.
- **FACT:** GH-377 makes recorded provider-attributable parks a synchronous input to profile selection, keeping the read-only contract. F-2 adds the remaining watch case: an observation older than its declared maximum, which persisted no park and therefore is not covered by the park fold (`doc/changes/2026-11/2026-11-22--GH-377--provider-profile-consumes-parks/chg-GH-377-spec.md` §5.1 F-2).
- **FACT:** GH-377's DoR iteration 1 recorded this as finding 5 (`decision_capture`): the conflict is with TDR-0062's eligibility boundary, not with its closed sets, and the reserved ids TDR-0075..TDR-0076 stood unused while a delivered record would contradict shipped behaviour.
- **FACT:** The delivered staleness mechanism is one predicate over injected facts — `ageSeconds = floor((nowMs − observedAtMs) / 1000)` and stale exactly at `ageSeconds >= maxAgeSeconds` — with the bound declared per watch target and defaulted to 900 seconds (`packages/core/src/provider/quota.ts`; `packages/core/src/contracts/provider-profile.ts`).
- **FACT:** No watch observation is persisted. `PROVIDER_RECORD_KINDS` contains only `provider.park` and `provider.announcement`; the watch read performs zero writes and builds `checkedAt` from the read instant (`doc/spec/features/feature-provider-profiles.md` §Watching; TDR-0062 D5).
- **FACT:** The composition's only watch seam is an observation instant (`ProviderComposition.watchObservedAtMs`), not a persisted condition. No production composition supplies a stale observation today.
- **FACT:** The profile blocker position is an open `string` with the delivered `kind: condition` and the bounded `detail` position, so `watch-stale` is representable with zero contract change (`packages/core/src/contracts/provider-profile.ts`; GH-377 DoR finding 5 positive checks).
- **Why now:** GH-377 ships the behaviour that narrows TDR-0062 D2. Leaving the narrowing unrecorded would leave two delivered documents contradicting each other, and would let a future reader treat either the absolute or the new behaviour as an accident.

## Problem Framing (Clarified)

The question is not "should profile selection fetch watch state?" — it must not, and GH-377 forbids it. The question is narrower:

> When a composition already holds a watch observation, and that observation is too old to act on, may profile selection refuse the provider, and at what cost?

TDR-0062 established three truth values for a watch reading: observed-and-good (`clear`), not-observed (`provider-outage`), observed-but-too-old (`watch-stale`). It then confined the third value to the watch view and to park construction. That confinement was correct for its own change and is now the only absolute standing between the delivered predicate and the eligibility surface.

Three sub-questions decide the boundary:

1. **Which facts may eligibility consume?** Only facts the composition already holds. An observation instant is such a fact; a fetch, a cache, or a timer is not.
2. **What does an aged observation mean at the eligibility surface?** The same thing it means at the watch surface: evidence that is too old to treat as headroom. It must not be read as clear, and it must not be reported as an outage, because no transport failure occurred.
3. **What must not move?** Chain resolution, the parks surface, the watch surface, park creation, clearing and expiry, and every closed vocabulary set. Only the profile-eligibility consumer gains one input.

The decision therefore narrows one sentence of TDR-0062 for one consumer, records the cost model that makes the widening acceptable, and states plainly where the behaviour is prospective rather than steady-state.

## Constraints (Hard Requirements)

### C-1: Zero acquisition on the eligibility path

- **Statement:** Profile eligibility determines staleness only from a composition-supplied observation and the injected clock; it performs no live quota or balance fetch, no watch transport call, no credential read, and adds no retained snapshot, cache, refresher, timer, or state write.
- **Source:** AC (GH-377 NG-1, NG-4); prior decision (ADR-0007 read-only evaluation; TDR-0062 C-5)
- **Verification:** test (hermetic zero-write and zero-fetch audit; no new record kind)
- **Negotiable:** no

### C-2: Every closed set is byte-identical

- **Statement:** The change adds no park cause, condition kind, watch condition, skip reason, announcement code, error identity, event code, state record kind, schema identifier, or envelope key; each closed set compares equal to the delivered one.
- **Source:** AC (GH-377 NG-2, NFR-3); prior decision (TDR-0062 C-4)
- **Verification:** test (set-equality inventory over each guarded set)
- **Negotiable:** no

### C-3: One delivered predicate over injected facts

- **Statement:** The verdict uses the delivered rule `ageSeconds = floor((nowMs − observedAtMs) / 1000)` with staleness at `ageSeconds >= maxAgeSeconds`; no second arithmetic, no ambient clock, and the boundary value is stale.
- **Source:** prior decision (TDR-0062 C-3); internal standard (repository staleness convention "at bound is stale")
- **Verification:** test (boundary matrix at bound − 1, bound, bound + 1; paired-run determinism with seeded instants)
- **Negotiable:** no

### C-4: `watch-stale` stays a watch-only name used in a blocker position

- **Statement:** `watch-stale` remains a member of `PROVIDER_WATCH_CONDITIONS` and is used at the eligibility surface only as a blocker `value`; it is never a park cause, condition kind, skip reason, announcement code, or error identity, and it never becomes a second name for an outage.
- **Source:** prior decision (TDR-0062 C-4); AC (GH-377 NG-2)
- **Verification:** structure inventory (set membership and set equality); code review
- **Negotiable:** no

### C-5: Scope containment

- **Statement:** Chain resolution, `provider parks list`, `provider watch status`, park creation, park clearing, park expiry, and the zero-write watch read path are unchanged; profile eligibility is the only consumer that gains the input, and `provider.profile.unavailable` and the delivered refusal identities are not re-minted.
- **Source:** AC (GH-377 NG-5, F-7); prior decision (ADR-0007 park invariants)
- **Verification:** regression suite (delivered chain, parks and watch cases unchanged); code review of touched call sites
- **Negotiable:** no

### C-6: Never clear, never a false failure, never an overclaim

- **Statement:** An aged observation is never reported as available or clear, is never reported as a transport or credential failure, and the operator-facing documents state both facts precisely: recorded park state is consumed synchronously and no live verification is performed.
- **Source:** AC (GH-377 F-2, §22); prior decision (ADR-0007 C-5 no silent clear; TDR-0062 C-7)
- **Verification:** test (stale-never-clear arm; golden output); documentation review
- **Negotiable:** no

### C-7: Only a declared watch target can be stale

- **Statement:** A provider with no declared `provider.profiles.watch.<name>` target is never stale; the rule is evaluated per declared target against that target's own bound, and a single composition-supplied instant never makes an undeclared-watch provider unavailable.
- **Source:** AC (GH-377 A-6 and the F-2 rule); prior decision (TDR-0062 D3 per-target bound)
- **Verification:** test (undeclared-watch provider with an old global instant stays available; two targets with different bounds reach different verdicts)
- **Negotiable:** no

> **Table stakes:** the verified park fold and read-time activity rule, credential-port-only authorization, park construction with a strictly future expiry, the capability gate on seat substitution, the unchanged committed policy, and the delivered watch read's zero writes are reused and not re-scored.

## Decision Drivers

**Technical drivers (ranked):**

1. **Fail-loud truthfulness** — an aged observation is evidence, not absence; collapsing it into `clear` or into `provider-outage` states something false at the one surface that decides what runs.
2. **Zero acquisition cost** — the widening must add no fetch, no cache, no timer, and no write; otherwise a read-only resolver becomes a networked, stateful one.
3. **One predicate** — reuse the delivered age-versus-bound rule and the delivered condition name rather than introduce a parallel freshness notion.

**Operational drivers:**

4. **Determinism** — the verdict must be a pure function of a supplied instant, a declared bound, and the injected clock.
5. **Operator legibility** — the blocker names `watch-stale` and the bounded detail names the provider, so "why is this provider not selected?" is answerable without a second tool.
6. **Reversibility** — availability returns by the clock alone; no operator action and no reconciliation step.

**Precedent drivers:**

7. **Boundary hygiene** — a delivered absolute must be narrowed explicitly, by a record that names the narrowed consumer, so the repository never carries two contradictory current truths.
8. **Honest scope** — the record states that no production composition supplies a stale observation today, so the guard is not sold as a steady-state capability.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-377 DoR iteration 1, finding 5).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-377 PR review; the AI does not accept this record and `decision_date` stays null until that acceptance.
- **Contributors:** `@readiness-reviewer` (found the delivered contradiction), `@pm` (OQ-1 revision and the id reservation), `@spec-writer` (the statements this record governs), `@decision-advisor` (analysis and record).
- **Required reviewers:** `@reviewer`, human owner.
- **Performers:** `@spec-writer`, `@test-plan-writer`, `@coder`, `@doc-syncer`.
- **Informed:** operators reading the parks and watch surfaces; future authors of a composition that retains an observation.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| TDR-0062 D2 excludes `watch-stale` from profile eligibility and routes admission gating to a separate decision | FACT | `doc/decisions/TDR-0062-watch-observation-freshness-and-stale-condition.md` D2, `revisit_triggers` | The narrowing would be an amendment to a record with no stated boundary | High |
| The delivered predicate is `ageSeconds >= maxAgeSeconds`, per target, with the bound as the first stale value | FACT | `packages/core/src/provider/quota.ts` (`isWatchObservationStale`); TDR-0062 D3 | A different boundary rule would be arbitrary and inconsistent with the watch surface | High |
| The bound is declared per watch target and defaults to 900 seconds | FACT | `packages/core/src/provider/quota.ts`; `packages/core/src/contracts/provider-profile.ts` (`ProviderWatchTarget.maxAgeSeconds`) | The rule would need a global bound, which no delivered key provides | High |
| No watch observation is persisted; the record kinds are park and announcement only | FACT | `feature-provider-profiles.md` §Watching; TDR-0062 D5 | A persisted observation would already be eligibility state and this record would be redundant | High |
| The composition seam is an observation instant (`watchObservedAtMs`), not a condition | FACT | `packages/cli/src/edge.ts` (`ProviderComposition`); GH-377 DoR finding 3 | If a composition supplied conditions, a second mapping rule would be needed | High |
| The profile blocker position is an open string with `kind: condition` and a bounded `detail` | FACT | `packages/core/src/contracts/provider-profile.ts` (`ProfileProviderAvailability`, `PROFILE_BLOCKER_KINDS`) | The narrowing would require a contract change and a new key | High |
| No production composition supplies a stale observation today | FACT | repository search; the delivered watch read observes at the read instant | The guard would be a steady-state input and would need operational monitoring | High |
| The delivered park-expiry clamp can produce an already-aged observation's absence | FACT | TDR-0062 D4 (clamp to `observedAt + maxAgeSeconds`) | The stale path's main live justification would weaken | High |
| A future composition may hold a retained observation and supply it | ASSUMPTION | no such composition exists | The rule stays vacuous until then; disclosed below | Medium |
| Per-target evaluation with "any stale target blocks the provider" is the intended aggregation | ASSUMPTION | one instant is supplied per composition while bounds are per target | A provider with two targets could be blocked by the stricter target; the alternative (any clear target unblocks) violates C-6 | Medium |

## Mental Models & Techniques Used

- **Fail-loud / three-valued honesty:** an observation is good, absent, or too old. The eligibility surface may not flatten the third case into either of the first two.
- **Inversion:** how does the narrowing cause harm? By blocking a healthy provider (over-blocking), by licensing spend on an aged reading (silent clear), or by inventing an outage (false remediation). C-1, C-6, and C-7 each close one.
- **Boundary analysis:** the only arithmetic is age versus a declared bound; the repository already fixes the boundary and the per-target declaration, so the record adopts them rather than inventing a second convention.
- **Opportunity cost:** a live fetch would buy "current" at the price of latency, credentials, rate limits, and a second acquisition path; consuming a fact the composition already holds costs nothing.
- **Second-order thinking:** an admission signal propagates into spawn binding and env records. Because the blocker only narrows what can be spawned, every downstream effect is a refusal, never a new permission.
- **Precedent hygiene:** a delivered absolute that stops being true must be narrowed in a record, at the consumer that stopped honouring it, rather than quietly contradicted in a spec page.
- **Systems thinking:** the watch read stays the observation authority, the park fold stays the durable pause authority, and profile eligibility becomes a third read-only consumer of facts it does not own.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 zero acquisition | C-2 closed sets | C-3 one predicate | C-4 `watch-stale` watch-only | C-5 scope containment | C-6 never clear / no overclaim | C-7 only declared targets |
|---|---|---|---|---|---|---|---|
| ALT-0 keep TDR-0062 D2 absolute | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (aged reading reads as clear) | ✅ |
| ALT-1 new park cause `watch-stale`, persist a park | ❌ (write) | ❌ (new cause) | ✅ | ❌ (cause vocabulary) | ❌ (park lifecycle) | ✅ | ✅ |
| ALT-2 narrow D2: `watch-stale` as an eligibility blocker (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 fetch watch state live at resolution | ❌ (fetch, credential, latency) | ✅ | ⚠️ (second clock path) | ✅ | ❌ (new acquisition on a read-only path) | ✅ | ✅ |
| ALT-4 report stale as `provider-outage` blocker value | ✅ | ✅ | ✅ | ❌ (one value, two meanings) | ✅ | ❌ (false failure, false remediation) | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none claimed).

### Alternative 0 — Keep TDR-0062 D2 Absolute

- **Eligibility:** Not eligible (fails C-6).
- **Summary:** Leave `watch-stale` out of profile eligibility. An aged observation is not consulted, so the provider is available unless a park exists.
- **Constraint compliance:** C-1 through C-5 and C-7 hold trivially. C-6 fails: an observation too old to act on is presented as clear at the eligibility surface, which is the silent-clear class ADR-0007 removed, and nothing tells the operator the reading is old.
- **Driver fit:** Fails drivers 1 and 7; passes 2–6.
- **Pros:** Zero change; TDR-0062 D2 remains literally true.
- **Cons:** The delivered fail-loud rule stops at the watch view; the first composition that holds an observation reintroduces the defect class; GH-377's F-2 and AC-F2-1 cannot be satisfied.
- **Why rejected:** It is precisely the gap GH-377's F-2 names, and it leaves a delivered absolute standing against behaviour the change requires.

### Alternative 1 — Give Staleness Its Own Park Cause

- **Eligibility:** Not eligible (fails C-1, C-2, C-4, C-5).
- **Summary:** When an observation is aged, persist a `provider.park` with cause `watch-stale`, so eligibility consumes it through the delivered park fold.
- **Constraint compliance:** C-1 fails (a state write on a read-only path). C-2 fails (a new park cause and a new announcement consequence). C-4 fails (`watch-stale` would become a park cause, not only a watch condition). C-5 fails (park creation and clearing semantics move).
- **Driver fit:** Good on driver 1, poor on 2, 3, and 6; a park must be cleared or expires by a timer-like contract the repository deliberately avoids for evidence.
- **Pros:** One eligibility input (the park fold) instead of two; no new blocker path.
- **Cons:** A write where there must be none; a second park writer on the resolver; a park represents "paused", while staleness means "evidence too old", and the two would expire differently.
- **Why rejected:** It buys vocabulary uniformity by growing the guarded park set and adding a write path — the exact costs the constraints forbid.

### Alternative 2 — Narrow D2: `watch-stale` as a Profile-Eligibility Blocker (selected)

- **Eligibility:** Eligible (passes C-1 … C-7).
- **Summary:** Profile selection consumes a composition-supplied observation. Per declared watch target, `ageSeconds >= maxAgeSeconds` makes the provider unavailable, reported with the delivered `kind: condition` blocker whose `value` is `watch-stale` and whose bounded `detail` names the provider, target, age, and bound. No declared target means never stale; a live read has age 0 and is never stale; nothing is fetched, cached, or written.
- **Constraint compliance:** C-1 by consuming only a supplied instant and the injected clock; C-2 by adding no vocabulary member; C-3 by reusing the delivered predicate unchanged; C-4 by keeping `watch-stale` in its watch-only set and using it only in the blocker value position; C-5 by leaving chain, parks, watch, and the park lifecycle untouched; C-6 by stating stale as stale and by documenting "recorded state consumed, no live verification"; C-7 by scoping the rule to declared targets.
- **Driver fit:** Best on all eight.
- **Pros:** Honest at the surface that matters; zero acquisition cost; one predicate; one name; reversible by the clock; a small, testable, additive change to one consumer.
- **Cons:** Eligibility now consumes one fact more than TDR-0062 declared, so the narrowing must be recorded and reconciled on four pages; the rule is not exercised by a production composition today; the per-target aggregation choice (any stale blocks) is conservative.
- **Why chosen:** It is the smallest mechanism that keeps the fail-loud rule true at the eligibility surface without buying it with an acquisition path.

### Alternative 3 — Fetch Watch State Live at Resolution

- **Eligibility:** Not eligible (fails C-1 and C-5; weakens C-3).
- **Summary:** Before selecting a profile, read each declared watch target live so the freshness verdict is always current.
- **Constraint compliance:** C-1 fails outright (transport, credential, latency). C-5 fails: the read-only resolver acquires a network dependency. C-3 weakens: a second clock and a second observation path enter the decision surface. C-7 still holds.
- **Driver fit:** Fails drivers 2, 4, and the owner's no-live-fetch rule; passes 1 in principle.
- **Pros:** The freshest possible verdict.
- **Cons:** A spawn-time network dependency, credential use, rate-limit exposure, nondeterministic tests, and a second truth beside `provider watch status`.
- **Why rejected:** It solves a currency problem nobody has asked for and violates the read-only contract GH-377 exists to preserve.

### Alternative 4 — Report Stale as the `provider-outage` Blocker Value

- **Eligibility:** Not eligible (fails C-4 and C-6).
- **Summary:** Reuse the delivered outage value in the blocker position so no watch name appears at the eligibility surface.
- **Constraint compliance:** C-4 fails: one value would carry two meanings (the repository's one-name-per-meaning rule). C-6 fails: the blocker would assert a transport failure that did not occur, sending an operator to check an endpoint whose call was never made. C-1, C-2, C-3, C-5, C-7 hold.
- **Driver fit:** Fails drivers 1 and 5.
- **Pros:** No watch vocabulary at the eligibility surface.
- **Cons:** False remediation path; `watch-stale` would still exist on the watch surface, so the operator would see two names for one fact.
- **Why rejected:** Outage and staleness have different remedies; TDR-0062 already rejected the same conflation at the watch surface, and it does not become acceptable one consumer downstream.

## Decision

- **Decision:** Adopt **ALT-2**.

### D1 — What changes: one eligibility input, one delivered predicate

Profile selection may treat a composition-supplied watch observation as an eligibility input.

- **Predicate:** for each declared `provider.profiles.watch.<name>` target whose observation the composition supplies, `ageSeconds = floor((nowMs − observedAtMs) / 1000)`; the target is stale when `ageSeconds >= maxAgeSeconds` (bound is stale, the delivered rule).
- **Effect:** a provider with at least one stale declared target is unavailable to profile selection. A profile whose `providers` include it is `ineligible`, and the blocker uses the delivered shape — `kind: condition`, `value: "watch-stale"`, bounded `detail` naming the provider, the target, the observed age, and the bound. No blocker kind, field, or identity is added.
- **Non-effects inside the rule:** a provider with no declared watch target is never stale; a composed live read observes at the read instant, so its age is `0` and it is never stale; the recorded condition value is not re-derived here — a condition that already derived a park is consumed as that park.
- **No state:** a stale verdict creates no park, writes nothing, and persists nothing. It is derived at the read instant and gone when the fact changes.

### D2 — What does not change

Chain resolution, `provider parks list`, `provider watch status`, park creation, park clearing, park expiry, the park-expiry clamp, the announcements attached to parks, and the zero-write watch read path are unchanged. No observation is persisted; the facts are supplied by the composition. No production composition supplies a stale observation today, so this is a fail-loud guard for compositions that do hold an observation and for the delivered park-expiry clamp — not a new steady-state ineligibility.

### D3 — Why the widening is acceptable

The widening reuses the delivered condition and adds no acquisition path: no fetch, no credential read, no cache, no timer, no write. It applies one predicate the repository already owns, over facts the caller already holds, to a consumer that already reads state synchronously.

The two obvious alternatives are worse on the record's own terms. Treating a stale observation as clear violates the fail-loud rule and is the defect class ADR-0007 removed. Adding a park cause grows a guarded set, adds a writer, and gives staleness a second expiry semantics — cost with no gain. Fetching live trades the read-only contract for currency nobody requested. Reporting stale as an outage is a false diagnosis with a wrong remediation.

The narrowing is also *narrower than a supersession*: TDR-0062's watch-surface statements, its predicate, its clamp, and its closed-set attestation all stand. Only the words "never enters profile eligibility" change, and only for profile selection. Chain resolution remains excluded, as TDR-0062 declared.

### D4 — Authority and acceptance

This is an R2 design record. Status is `Proposed`; `decision_date` is `null`. The human owner (Juliusz Ćwiąkalski) accepts it at the GH-377 PR review. AI assistance designed, analysed, and wrote the record; the AI does not accept it. Until acceptance, the GH-377 specification may cite it as the record that governs the narrowed boundary, and the record itself must not be described as settled.

### D5 — Consequences and obligations

Profile eligibility now consumes one fact more than TDR-0062 declared, and the repository must say so in the places an operator or a future author reads:

- `doc/spec/features/feature-provider-profiles.md` states the positive rule (a stale declared target blocks the provider) and stops asserting that the probe checks only declaration, enablement, and peak.
- `doc/spec/features/feature-provider-engine.md` and `doc/spec/features/feature-peak-pausing.md` no longer imply that watch state never reaches eligibility.
- `doc/guides/provider-conditions-and-parks.md` states both facts precisely: recorded park state is consumed synchronously, and no live verification is performed.
- `provider watch status` remains the authoritative observation surface; a stale blocker is derived, never announced and never parked.
- GH-377's DEC-7 ("no decision record is authored") is superseded by this record; the change spec cites TDR-0075 and the reserved TDR-0076 stays unused.

- **Decider:** Juliusz Ćwiąkalski — pending at the GH-377 PR review.
- **Conditions for revisit:** see `revisit_triggers`.

### Constraint Compliance Attestation

The chosen alternative satisfies C-1 … C-7: it consumes only a supplied observation instant and the injected clock, with no fetch, credential read, cache, timer, or write (C-1); it adds no member to any guarded set (C-2); it reuses the delivered `ageSeconds >= maxAgeSeconds` predicate unchanged, at bound stale (C-3); `watch-stale` remains in `PROVIDER_WATCH_CONDITIONS` and appears only in the blocker value position (C-4); chain resolution, the parks surface, the watch surface, the park lifecycle, and the delivered refusal identities are untouched (C-5); an aged observation is reported as stale, never clear and never as a failure, with the operator documents stating that recorded state is consumed and no live verification is performed (C-6); and only a declared watch target can be stale (C-7). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- The fail-loud rule now holds at the surface that decides what a delivery spawns, not only at the watch view.
- Profile selection and `provider watch status` can no longer disagree about whether an observation is actionable.
- The widening costs nothing at runtime: no latency, no credential, no rate limit, no write, and no timer.
- The narrowing is recorded at the consumer that changed it, so TDR-0062's watch-surface design keeps its authority and the repository carries one explicit amendment instead of an implicit contradiction.
- Recovery is a clock property: when a newer observation is supplied, availability returns with no operator action and no reconciliation.

### Negative Outcomes

- Eligibility consumes one fact more than TDR-0062 declared; the boundary now has to be read together with this record to be understood.
- No production composition supplies a stale observation today, so the behaviour is a guard rather than a capability; its everyday value is not yet demonstrated.
- Per-target evaluation with "any stale target blocks" can be stricter than an operator expects when one target has a short bound and another a long one. The alternative aggregation would read an aged fact as clear for one target, which C-6 forbids.
- The composition seam's shape (one instant versus per-target instants) is a specification obligation GH-377 must discharge; this record fixes the boundary, not the seam's plumbing.

### Unresolved Questions

- [ ] Should the stale blocker's `detail` always name the target as well as the provider and bound, or is provider plus bound sufficient for an operator? (owner: `@spec-writer`; recommendation: name the target — it is the unit that declares the bound).
- [ ] When a composition first retains an observation, does it also owe a refresh cadence and an invalidation rule? (owner: that composition; explicitly out of scope here, and a `revisit_triggers` reopening condition).
- [ ] Should the spec's seam description permit per-target instants now, so a future composition need not amend the contract again? (owner: `@spec-writer`; recommendation: describe the rule per target and treat a single supplied instant as the delivered composition's current shape).

## Implementation Plan

1. Specification: cite TDR-0075 as the authority for the narrowed boundary; state the observation seam, the per-target rule, the no-declared-target case, the live-read age-0 case, and the any-stale-blocks aggregation; retire DEC-7 and NG-8 in favour of the record.
2. Probe: the composed profile availability probe applies the delivered staleness predicate to each supplied observation for a declared target and reports the `watch-stale` blocker; it gains no port for acquisition and performs no write.
3. Tests: the freshness boundary matrix (`bound − 1`, `bound`, `bound + 1`) per target; stale-never-clear; undeclared-watch provider never stale; live read age 0; two targets with different bounds; paired-run determinism; and set equality for every guarded set.
4. Documentation (phase 7): reconcile the profiles, provider-engine, peak-pausing, and provider-conditions-and-parks pages with D5, stating recorded-state consumption and no live verification.
5. Register hygiene: add the decision index row for TDR-0075 and record the acceptance date when the owner accepts at the PR review; leave TDR-0062's status and body intact.

## Verification Criteria

- Metric: profile-eligibility resolutions reporting an aged observation as available or clear — Target: 0 — Window: GH-377 CI.
- Metric: live quota, balance, or watch transport calls on any resolution path — Target: 0 — Window: GH-377 CI (hermetic audit).
- Metric: state writes performed by profile resolution — Target: 0 — Window: GH-377 CI.
- Metric: new members in park causes, condition kinds, watch conditions, skip reasons, announcement codes, error identities, event codes, state record kinds, schema ids, or envelope keys — Target: 0 — Window: GH-377 CI (set-equality inventory).
- Metric: providers with no declared watch target blocked by staleness — Target: 0 — Window: GH-377 CI.
- Metric: changes to the delivered chain-resolution, parks, and watch-case verdicts — Target: 0 — Window: GH-377 CI (regression suite).
- Metric: byte differences between two resolutions with identical seeded facts — Target: 0 — Window: GH-377 CI.
- Metric: current-truth pages still asserting the three-check probe or the absolute exclusion — Target: 0 — Window: GH-377 phase-7 doc-sync.

## Confidence Rating

**Medium–high.** The predicate, the bound, the condition name, and the blocker shape are all delivered and individually tested; the narrowing adds arithmetic the repository already owns to a consumer that already reads state synchronously. The medium component is honesty about reach: no production composition supplies a stale observation today, and the observation seam's exact shape is a GH-377 specification obligation rather than a settled contract. The record states both rather than overclaiming a steady-state capability, and it keeps the narrowing to one consumer so the blast radius stays reviewable.

## References

- [TDR-0062](TDR-0062-watch-observation-freshness-and-stale-condition.md) — the watch freshness predicate, the `watch-stale` condition, the park clamp, and the D2 boundary this record narrows for profile eligibility only.
- [ADR-0007](ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) — fail-loud evaluation, closed vocabularies, park invariants, and the no-silent-clear rule.
- Feature specs: [Provider Profiles](../spec/features/feature-provider-profiles.md), [Provider Engine](../spec/features/feature-provider-engine.md), [Peak Pausing](../spec/features/feature-peak-pausing.md).
- Guide: [Provider Conditions and Parks](../guides/provider-conditions-and-parks.md).
- Change: `doc/changes/2026-11/2026-11-22--GH-377--provider-profile-consumes-parks/`.
