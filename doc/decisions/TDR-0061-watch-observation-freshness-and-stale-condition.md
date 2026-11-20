---
id: TDR-0061
decision_type: tdr
status: Proposed
created: 2026-11-19
decision_date: null
last_updated: 2026-11-19
summary: "GH-350: watch freshness is a per-target declaration, `provider.profiles.watch.<name>.maxAgeSeconds` (positive integer, default 900), and a closed watch-condition value `watch-stale` in a new watch-only set PROVIDER_WATCH_CONDITIONS (clear, quota-exhausted, watch-stale, provider-outage, credential-missing, credential-rejected). Staleness is `ageSeconds >= maxAgeSeconds` where age derives from the injected clock and the observation instant; a stale observation is fail-loud and is never reported clear and never conflated with outage (outage = the read failed, nothing observed; watch-stale = an observation exists but is too old to act on). A park created from a watch observation is clamped so it expires no later than `observedAt + maxAgeSeconds`; a stale observation creates no park because no honest future expiry exists. No new park cause, skip reason, announcement code, error identity, or cached snapshot is introduced, and no `maxAgeSeconds` key is added to quota policy because quota is fetched fresh per evaluation."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider policy: watch conditions and observation freshness"
decision_scope: repo
review_date: null
business_impact: "A balance or usage reading that has aged cannot be mistaken for headroom: the condition names staleness, and any pause derived from the reading cannot outlive it. That protects the owner directive 'verify balance live, because cached balances lag top-ups' without adding a cache or a new alarm system."
customer_impact: "An operator sees `watch-stale` with the observed age and the declared bound instead of a misleading `clear`, and a park learned from a watched balance can never promise a resume time that its evidence no longer supports."
classification:
  domains: [contracts, operations, cost-control, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: low
  uncertainty: medium
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-350 clarify_scope: watch staleness is absent)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-350 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-350 clarify-scope: 'balance/quota watch conditions with staleness handling')"
    - "@spec-writer (GH-350 specification: key, condition set, view fields)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-350 PR review)"
  performers:
    - "@spec-writer (key, condition set, clamp rule)"
    - "@test-plan-writer (freshness matrix and clamp oracles)"
    - "@coder (watch reader, park clamp, view fields)"
    - "@doc-syncer (provider-profiles watch section, provider-engine park section)"
  informed:
    - "Watch mapping owners (coding-plan windows, DeepSeek balance, OpenAI usage)"
    - "Operators reading watch status"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A composition begins retaining snapshots (a cache, a persisted last-known reading): the freshness rule already covers it, but the cache's own invalidation contract must be decided then; do not let a retained snapshot bypass the bound."
  - "Watch conditions are proposed as admission gates: that is a new eligibility decision with its own cost model (a per-spawn fetch or a snapshot); decide it separately rather than widening this record."
  - "Operators find a 900-second default wrong in both directions: tune the default; the per-target key and the `>=` rule stay."
  - "A stale condition is ever observed as `clear` in a produced payload: treat it as a defect in the single staleness predicate, not as a reason to add a second one."
links:
  related_changes: ["GH-350"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-provider-profiles.md"
    - "doc/spec/features/feature-provider-engine.md"
    - "doc/spec/features/feature-config-layer.md"
  contracts:
    - "packages/core/src/contracts/provider.ts"
    - "packages/core/src/contracts/provider-profile.ts"
    - "packages/core/src/provider/quota.ts"
  decisions: ["ADR-0007", "TDR-0026"]
  roadmap_items: ["M4-S4"]
---

# TDR-0061: Watch Observation Freshness — A Per-Target Bound, a Watch-Only `watch-stale` Condition, and Evidence-Bounded Parks

## Context

- **FACT:** The ticket asks for "balance/quota watch conditions with staleness handling". The delivered watch surface reads each declared target live through the quota transport, maps the response to a normalized snapshot, and renders `{ name, condition, source, checkedAt }` per target; the read performs zero writes and resolves credentials only through the credential port (`doc/spec/features/feature-provider-profiles.md` §Watching).
- **FACT:** The owner directive adds "verify balance live (cached balances lag top-ups)". A reading that is old is not the same fact as a reading that failed: the first has evidence, the second has none.
- **FACT:** The delivered vocabulary already distinguishes a failed read (outage) from a policy limit (quota-exhausted) and from a credential failure. It has no member meaning "observed, but too old".
- **FACT:** The park invariant requires an absolute expiry strictly in the future at creation; a condition with no honest future expiry is a failed entry, not a park (`feature-provider-engine.md` §Parks; ADR-0007 DC-3).
- **FACT:** The watch condition field is currently typed as a plain string on `ProviderWatchConditionView`, so a new value is not a type-breaking change but must be closed and documented.
- **FACT:** No code path retains a watch snapshot across invocations; the delivered read is live, so `checkedAt` is always the read instant and age is zero. Staleness therefore becomes observable only where a composition supplies a retained observation, and where a park derived from a watch reading outlives its evidence.
- **Why now:** GH-350 completes the provider-policy surface. The staleness gap is small in code and large in meaning: without it, the only two available readings of an aged balance are "clear" (wrong) and "outage" (also wrong).

## Problem Framing (Clarified)

"Staleness handling" is not a timer and not a cache. It is a **predicate over an observation instant plus a declared bound**, applied wherever a decision consumes an observation. Three questions:

1. **Where is the bound declared?** It is policy: per target (balance lags top-ups differently from weekly usage windows), with one default.
2. **What does an aged observation produce?** A closed condition value that is neither clear nor outage — because both existing values would state something false.
3. **What may be built on an aged observation?** Nothing that outlives it. A park learned from a reading must expire no later than the reading's freshness bound; a park whose bound has already passed cannot be created at all.

The decision deliberately does **not** introduce a cache, a background refresher, or admission gating from watch data. It makes the existing live read honest and makes any future retained observation safe by construction.

## Constraints (Hard Requirements)

### C-1: A stale observation is never clear and never outage

- **Statement:** An observation whose age is at or beyond its declared bound reports the closed value `watch-stale`, with the observed age and the bound in the view; it is never coerced to `clear`, never reported as `provider-outage`, and never silently dropped.
- **Source:** AC (staleness handling); ADR-0007 C-5 (no silent clear)
- **Verification:** test (aged observation fixtures at bound − 1, at bound, at bound + 1 per target; each asserts the condition value)
- **Negotiable:** no

### C-2: Parks cannot outlive their evidence

- **Statement:** A park created from a watch observation has an expiry no later than `observedAt + maxAgeSeconds × 1000`; when that instant is not strictly in the future, no park is created and the observation is reported `watch-stale`.
- **Source:** prior decision (ADR-0007 DC-3 park invariant); owner directive (live balance verification)
- **Verification:** test (a below-floor balance with a long natural TTL is clamped; an already-aged observation creates no park)
- **Negotiable:** no

### C-3: One predicate, computed from injected facts

- **Statement:** `ageSeconds = floor((nowMs − observedAtMs) / 1000)` and `stale ⟺ ageSeconds >= maxAgeSeconds`; the clock is injected, the observation instant is supplied by the reader's runtime, and no ambient clock enters the watch path.
- **Source:** internal standard (determinism; config-layer staleness convention "at bound is stale")
- **Verification:** test (paired-run determinism with seeded observation instants; boundary equality)
- **Negotiable:** no

### C-4: Closed, named vocabulary; watch-only

- **Statement:** `watch-stale` is a member of a new watch-only closed set `PROVIDER_WATCH_CONDITIONS`; it is **not** a park cause, condition kind, skip reason, or announcement code, because a stale observation parks nothing.
- **Source:** internal standard (guarded sets; one meaning per vocabulary)
- **Verification:** structure inventory (set membership; park-cause set unchanged)
- **Negotiable:** no

### C-5: No cache, no timer, no new surface

- **Statement:** GH-350 adds no retained snapshot, background refresh, scheduler, daemon tick, or new command; the freshness bound is enforced at the point of consumption, and `provider watch status` remains the operator surface.
- **Source:** ticket scope; provider-profiles "read path accepts no state store and performs zero writes"
- **Verification:** test (zero writes; no new record kind); structure inventory (no new command)
- **Negotiable:** no

### C-6: No symmetric quota key

- **Statement:** `maxAgeSeconds` is declared on watch targets only; the quota policy gains no freshness key, because a quota snapshot is fetched and consumed in the same evaluation and is never retained.
- **Source:** delivered quota evaluation semantics; lean-surface driver
- **Verification:** config schema test (unknown quota key refuses); code review
- **Negotiable:** no

### C-7: Operator-legible disclosure

- **Statement:** The stale condition carries the observed instant, the computed age, and the declared bound, and the human line states them; nothing claims a fresher observation than the facts support.
- **Source:** internal standard (bounded evidence / honest claims)
- **Verification:** golden output + evidence-bound test
- **Negotiable:** no

> **Table stakes:** the three watch mapping kinds and their normalized snapshots, credential-port-only authorization, the zero-write read path, and the delivered outage/credential condition mapping are unchanged and not re-scored.

## Decision Drivers

**Technical drivers (ranked):**

1. **Truthfulness** — an aged reading is a third state; collapsing it into either existing state states something false.
2. **Determinism** — the predicate must be a pure function of an injected clock and a supplied observation instant.
3. **Evidence-bounded decisions** — a park must not outlive the facts that justified it.

**Operational drivers:**

4. **Operator legibility** — age and bound are visible, so "why is this not clear?" is answerable.
5. **Least surface** — one key, one closed value, no cache, no timer, no new command.
6. **Cost-control direction** — a stale balance must not license spending, and a pause must not promise an unsupported resume.

**Product driver:**

7. **AC completeness** — the ticket names watch conditions with staleness handling; this is the smallest honest mechanism that delivers it.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-350 clarify-scope).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-350 PR review; the AI does not accept this record.
- **Contributors:** `@pm` (scope), `@spec-writer` (key and view shape), `@decision-advisor` (analysis).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, human owner.
- **Performers:** `@spec-writer`, `@test-plan-writer`, `@coder`, `@doc-syncer`.
- **Informed:** watch mapping owners, operators.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The watch read is live, read-only, zero-write, and carries `checkedAt` from the injected clock | FACT | `packages/core/src/provider/quota.ts` (`createProviderWatchStatus`); `feature-provider-profiles.md` §Watching | Staleness would already exist in a cache | High |
| Watch targets are declared per provider under `provider.profiles.watch` with mapping, endpoint, credentialRef, floor, thresholdPercent | FACT | `packages/core/src/config/catalog.ts` (`PROVIDER_WATCH_TARGET`) | A per-target key would need a different home | High |
| The watch condition field is an open string on the view, and the mapping code produces the delivered engine conditions | FACT | `packages/core/src/contracts/provider-profile.ts` (`ProviderWatchConditionView`); `conditionForFailure` | Closing the set is additive but must be declared | High |
| Parks require a strictly future expiry; no expiry is fabricated | FACT | `feature-provider-engine.md` §Parks; ADR-0007 DC-3 | C-2 would be optional | High |
| The repository's staleness convention treats the bound as the first stale value (`>=`) | FACT | `merge.gate-freshness` ("at-bound is stale"); `queue.lease-ttl` ("at or beyond") | The boundary rule would be arbitrary | High |
| No composition retains a watch snapshot today | FACT | repository search; watch reader builds `checkedAt` from `nowMs` | The delivered path would already exhibit staleness | High |
| A future composition may supply a retained observation (a cached read or a persisted last-known value) | ASSUMPTION | no such composition exists | The predicate would be vacuous in v1 | Medium |
| 900 seconds is a defensible default bound | ASSUMPTION | matches `credentialParkTtlSeconds`; no operator data | The default would need tuning | Medium |
| Watch conditions are not chain-eligibility inputs today | FACT | profile probe = declared, enabled, outside peak; chain resolution consumes peak/quota/budget | A stale condition would need a skip reason | High |

## Mental Models & Techniques Used

- **Three-valued honesty:** clear means "observed and good", outage means "not observed", stale means "observed, and too old to act on". Collapsing three into two always lies about one case.
- **Inversion:** how does an aged balance cause harm? By being read as clear (spend happens) or as outage (a false failure narrative). Both are prevented by naming the third state.
- **Boundary analysis:** the only arithmetic is age versus bound; the repository already fixes the boundary convention, so this decision adopts it rather than inventing one.
- **Second-order thinking:** a park with a TTL longer than its evidence promises a resume that a re-read cannot honour; clamping converts a future lie into a bounded pause.
- **Opportunity cost:** a cache would buy freshness latency at the cost of a second truth and a bypass of the bound; the live read plus a predicate costs nothing.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 never clear/outage | C-2 evidence-bounded parks | C-3 one predicate | C-4 watch-only vocabulary | C-5 no cache/timer | C-6 no quota key | C-7 legible |
|---|---|---|---|---|---|---|---|
| ALT-0 no staleness concept | ❌ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-1 staleness reported as outage | ✅ (technically) | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| ALT-2 per-target `maxAgeSeconds` + `watch-stale` + park clamp (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 retained snapshot cache with a refresher | ✅ | ⚠️ | ⚠️ | ✅ | ❌ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none claimed).

### Alternative 0 — No Staleness Concept

- **Eligibility:** Not eligible (fails C-1; C-2 passes only vacuously because no watch-derived park exists yet).
- **Summary:** Keep `clear | quota-exhausted | provider-outage | credential-*` and treat any observation as current.
- **Constraint compliance:** An aged reading reports `clear`, which is the silent-clear class ADR-0007 removed. C-7 fails: nothing tells the operator the reading is old.
- **Driver fit:** Fails drivers 1, 4, 7.
- **Pros:** Zero change.
- **Cons:** The ticket requirement is unmet; the first retained snapshot or cached read reproduces the defect class.
- **Why rejected:** It is the gap the ticket names.

### Alternative 1 — Report a Stale Observation as `provider-outage`

- **Eligibility:** Not eligible (fails C-4, weakens C-1).
- **Summary:** Reuse the outage condition for an aged observation.
- **Constraint compliance:** C-1 is satisfied only in the letter ("not clear"), but the value asserts a transport failure that did not occur — a false remediation path ("check the endpoint") for a condition whose remedy is "re-read". C-4 fails: one value, two meanings.
- **Driver fit:** Fails drivers 1 and 4.
- **Pros:** No new vocabulary.
- **Cons:** Operators chase a non-existent outage; the mapping's diagnostics become untrustworthy.
- **Why rejected:** Outage and staleness have different remedies; one name per meaning is the repository rule.

### Alternative 2 — Per-Target Bound, Watch-Only `watch-stale`, Park Clamp (selected)

- **Eligibility:** Eligible (passes all constraints).
- **Summary:** Declare `maxAgeSeconds` per watch target (default 900); compute age from the injected clock and the observation instant; report `watch-stale` at or beyond the bound; clamp any watch-derived park to the same bound, and create no park from an already-stale observation. No cache, no timer, no new command.
- **Constraint compliance:** C-1 by the new closed value; C-2 by the clamp and the no-park rule; C-3 by one predicate over injected facts; C-4 by a watch-only set; C-5 by consuming at read time with no retention; C-6 by scoping the key to watch; C-7 by the view fields and human line.
- **Driver fit:** Best on all seven.
- **Pros:** Honest three-state reporting; parks cannot outlive evidence; small, testable, additive.
- **Cons:** In the delivered live path age is always zero, so the value is exercised by composition-supplied observations and by the park clamp rather than by everyday reads; the default bound is a guess.
- **Why chosen:** It is the smallest mechanism that is truthful today and safe the moment a retained observation exists.

### Alternative 3 — Retained Snapshot Cache with a Refresher

- **Eligibility:** Not eligible (fails C-5; weakens C-2 and C-3).
- **Summary:** Persist each watch snapshot and refresh it on a cadence; read the cache and expose its age.
- **Constraint compliance:** C-5 fails outright (cache, scheduler). C-2 weakens: a park built from a cached reading inherits the cache's staleness unless the clamp is added anyway. C-3 weakens: two write paths and a background clock enter the decision surface.
- **Driver fit:** Fails drivers 2, 5, and the owner directive (live verification).
- **Pros:** Cheap reads.
- **Cons:** A second truth, a write path, a scheduler, and a bypass of "verify balance live".
- **Why rejected:** It solves a latency problem nobody has and creates the staleness problem this record exists to bound.

## Decision

- **Decision:** Adopt **ALT-2**.

### D1 — The key

`provider.profiles.watch.<name>.maxAgeSeconds` — positive integer (≥ 1), default `900`, per target, validated with the rest of the watch target (`config.value.invalid` naming the key on a non-integer, zero, or negative value). The key is declared only on watch targets; `provider.entries.*.quota` gains no freshness key (C-6).

### D2 — The closed condition set

`PROVIDER_WATCH_CONDITIONS = ["clear", "quota-exhausted", "watch-stale", "provider-outage", "credential-missing", "credential-rejected"]` becomes the declared domain of the watch view's `condition`. `watch-stale` is watch-only: it joins no park cause, condition kind, skip reason, or announcement code, and it never enters chain resolution or profile eligibility. The delivered values keep their delivered meanings.

### D3 — The predicate

`ageSeconds = floor((nowMs − observedAtMs) / 1000)`; a target is stale when `ageSeconds >= maxAgeSeconds` (the bound is the first stale value, matching `merge.gate-freshness` and `queue.lease-ttl`). `observedAtMs` is supplied by the watch reader's runtime; the delivered live reader supplies the read instant, so age is `0` and the condition is never stale on a live read. The view gains three additive fields — `observedAt` (ISO instant), `ageSeconds`, and `maxAgeSeconds` — beside the delivered `name`, `condition`, `source`, and `checkedAt`; `checkedAt` is unchanged and still means "when the command read". A stale view's `source` states the observed instant and the bound; it never claims a transport or credential failure.

### D4 — Parks and announcements

A park created from a watch observation (for example a below-floor balance) has `expiresAt = min(naturalExpiry, observedAtMs + maxAgeSeconds × 1000)`. When that instant is not strictly in the future, no park is created and the observation is reported `watch-stale` — the failed-condition shape the quota `reset_missing` case already established. No announcement code is added: a stale observation produces no park and therefore no park announcement; a failed watch read keeps the delivered `provider.quota.unreachable` / `provider.quota.http_error` / `provider.quota.malformed` / `provider.quota.auth_rejected` / `provider.credential.missing` codes, and a park that expires by the clamp is observed gone by the next evaluation, which appends the delivered `provider.resumed` announcement exactly as any other expiry does.

### D5 — What this does not do

No snapshot is persisted, no clock or timer is added, no admission gate consumes watch data, and `provider watch status` remains the only surface. The record states plainly that in the delivered live composition age is always zero; the predicate exists so that (a) any composition that supplies a retained observation cannot present it as clear, and (b) a park cannot outlive the reading that justified it. That is the whole of "staleness handling" for this change.

- **Decider:** Juliusz Ćwiąkalski — pending at the GH-350 PR review.
- **Conditions for revisit:** see `revisit_triggers`.

### Constraint Compliance Attestation

The chosen alternative satisfies C-1 … C-7: an aged observation reports `watch-stale` and never clear or outage (C-1); parks are clamped to the observation's freshness bound and an already-stale observation creates none (C-2); one predicate over an injected clock and a supplied observation instant (C-3); the new value lives in a watch-only closed set and touches no other vocabulary (C-4); no cache, timer, scheduler, or command is added (C-5); no quota freshness key exists (C-6); and the view carries observed instant, age, and bound (C-7). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- The three-state truth is expressed: observed-and-good, not-observed, observed-but-too-old.
- A park can no longer promise a resume time its evidence does not support.
- The rule is one predicate, deterministic and cheap, and it is ready for any future retained observation without a second design.
- No vocabulary collision: outage keeps its single meaning.

### Negative Outcomes

- In the delivered live path the new condition is not exercised by everyday use; its value is demonstrated by composition-supplied observations and the park clamp. That is a disclosure, not a hidden limitation.
- The default bound (900 s) is a judgement, not a measurement; operators may tune it.
- The watch view grows three additive fields and a closed condition domain, which the spec and goldens must carry.
- A clamped park may expire sooner than the natural condition would, causing a re-read sooner than a TTL-only design.

### Unresolved Questions

- [ ] Whether the rendered `source` string should be structured (a small object) instead of free text for stale views (owner: `@spec-writer`; recommendation: keep `source` as the delivered string and put the numbers in the additive fields).
- [ ] Whether a future retained snapshot must also declare its own write cadence (owner: the composition that introduces it; explicitly out of scope here).

## Implementation Plan

1. Contracts: `PROVIDER_WATCH_CONDITIONS`; the three additive view fields; the per-target `maxAgeSeconds` in the watch target catalog shape.
2. Pure policy: the freshness predicate and the park clamp, shared by the watch reader and any watch-derived park construction.
3. Rendering: human line states condition, observed instant, age, and bound; machine payload carries the fields.
4. Specs/docs: provider-profiles (watch key and conditions), provider-engine (park clamp in the park section), config-layer (watch target key).
5. Tests: freshness boundary matrix (`bound−1`, `bound`, `bound+1`), stale-never-clear, clamp versus natural expiry, no-park-from-stale, determinism with a seeded observation instant, unknown-key refusal for a quota freshness key.

## Verification Criteria

- Metric: aged observations reported `clear` or `provider-outage` — Target: 0 — Window: GH-350 CI.
- Metric: watch-derived parks expiring after `observedAt + maxAgeSeconds` — Target: 0 — Window: GH-350 CI.
- Metric: parks created from an already-stale observation — Target: 0 — Window: GH-350 CI.
- Metric: new park causes, skip reasons, or announcement codes for staleness — Target: 0 — Window: GH-350 CI (structure inventory).
- Metric: state writes on the watch path — Target: 0 — Window: GH-350 CI.
- Metric: byte differences between two reads with identical seeded facts — Target: 0 — Window: GH-350 CI.

## Confidence Rating

**Medium–high.** The predicate and the park clamp are simple and fully testable, and the vocabulary decision is well supported by the repo's one-meaning-per-name rule. The medium component is scope honesty: the delivered live read has zero age, so the change's value is prospective for retained observations and immediate only for the park clamp. The record states that rather than overclaiming.

## References

- [ADR-0007](ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) — fail-loud, park invariant, closed vocabularies.
- [TDR-0026](TDR-0026-queue-lifecycle-removal-single-flight.md) — tracker-delivery-state staleness precedent (staleness as a declared condition).
- Feature specs: [Provider Profiles](../spec/features/feature-provider-profiles.md), [Provider Engine](../spec/features/feature-provider-engine.md), [Configuration Layer](../spec/features/feature-config-layer.md).
- Change: `doc/changes/2026-11/2026-11-19--GH-350--provider-policy/`.
