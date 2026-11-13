---
id: TDR-0028
decision_type: tdr
status: Proposed
created: 2026-11-13
decision_date: null
last_updated: 2026-11-13
summary: "Resolve GH-294 OQ-1: a delivery that cannot nominate a provider profile at dispatch admission is refused there — a pre-session refusal carrying the identity the resolve seam already produces (`provider.profile.absent` for an empty or chain-less branch, `provider.profile.invalid` for an invalid explicit nomination, `provider.profile.capability-denied` / `provider.profile.unavailable` when every candidate is ineligible), each at its delivered exit projection, with no lease, attempt, lane, or queue record and no event. No dispatch-default nomination concept is introduced, and no new dispatch-owned error identity is declared."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os dispatch engine admission (provider profile nomination, GH-294 F-1)"
decision_scope: repo
review_date: null
business_impact: "Fail-closed cost control: every lane admitted after GH-294 carries the nomination key the daemon's peak-window park reads, so no admitted lane can be structurally invisible to peak pausing."
customer_impact: "An operator who dispatches on an unconfigured (empty `provider.profiles`) branch is refused earlier and more cheaply — before any lease or record — with the same classified identity the resolve surface already produces; a dispatch whose every profile is in a peak window is refused at admission, exactly the delivered iteration-start gating intent, now with a durable pre-session classification."
classification:
  domains: [architecture, contracts, cost-control]
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
  driver: "@decision-advisor (GH-294: PM routed OQ-1 to a record; record written before delivery planning finalizes)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-294 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-294 clarify-scope: OQ-1 framing — classified refusal vs the profile's declared default)"
    - "@spec-writer (GH-294 specification v1.0: F-1, AC-F1-1, OQ-1, NG-8)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-294 PR review — this record fixes an admission-refusal contract)"
  performers:
    - "@coder (GH-294 delivery: admission nomination rule, identity mapping, refusal tests)"
    - "@doc-syncer (dispatch-engine and provider-profiles spec reconciliation)"
  informed:
    - "Resident daemon window watch (consumes the nomination invariant as its park key)"
    - "M2-S16 engine-first operations (consumes nomination as engine-visible data)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A production spawn path is discovered that does not consume the profile-resolve env record, so a no-nomination dispatch could previously have spawned: reopen this decision — the admission refusal would then newly refuse deliveries rather than move an existing failure earlier."
  - "An operator need arises for an explicit per-delivery nomination override (`--profile` on dispatch): extend the rule through the existing `provider.profile.invalid` identity for a bad explicit name; do not add a dispatch-owned identity."
  - "A delivered spec page needs the no-nomination refusal to carry dispatch-family detail beyond the resolve identity's row: that is a TDR-0027-style envelope decision, not a new error identity."
links:
  related_changes: ["GH-294"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-13--GH-294--provider-peak-pausing/chg-GH-294-spec.md"
    - "doc/spec/features/feature-dispatch-engine.md"
    - "doc/spec/features/feature-provider-profiles.md"
  contracts: []
  decisions: ["TDR-0019", "TDR-0027"]
  diagrams: []
---

# TDR-0028: No-Nomination Dispatch Admission — Classified Refusal Reusing the Provider-Profile Resolve Identities

## Context

GH-294 (M2-S17 provider-aware peak pausing) requires every delivery to nominate its provider profile at dispatch admission, recorded durably on the lane and attempt records (spec F-1, AC-F1-1). The nomination is the enforcement key for the whole change: the daemon's park decision reads each lane's nominated profile and the window state of that profile only (F-4), the zero-spend assertion is scoped per parked profile (F-6), and telemetry attribution joins the same key. A lane without a nomination can never be peak-paused — there is no profile whose window can be watched for it.

The configuration the nomination reads ships empty by default: the `provider.profiles` branch declares no tier, profile, or chain on a fresh install, and this empty default is fail-closed — until a preference chain is declared, profile resolution refuses with the classified `provider.profile.absent` identity rather than inventing a model. Selection is fail-closed the same way: when no profile is eligible, the refusal is `provider.profile.capability-denied` (exit 1) when every blocker is a capability blocker, otherwise `provider.profile.unavailable` (exit 2) with the full eligibility list. An invalid explicitly named profile refuses with `provider.profile.invalid` (exit 1). Profile resolution runs before any harness spawn and emits the structured env record the spawn wrapper injects.

The delivered M2 contracts pack and the GH-294 specification leave the no-nomination case open as OQ-1: classified refusal at admission versus fallback to the profile's declared default. The dispatch engine already has a disciplined pre-session refusal family (unknown harness, rejected input, credential/read preflight refusal, owner hold, lease conflict, per-ref single-flight): each refusal happens before any session attempt exists, appends no lease, attempt, lane, or queue record, publishes no event, and carries an existing classified identity — admission refusals add no `dispatch` error-table row (the same convention TDR-0019's pre-session credential preflight followed).

## Problem Framing (Clarified)

The question is not "which profile should an unnominated delivery use" but "is the nomination a structural invariant of admission or a best-effort annotation". Three distinct sub-questions collapse into it:

1. **Invariant or annotation.** If admission can proceed without a nomination, the peak-pause enforcement key is best-effort, and the class of lanes that bypass peak pausing is exactly the unconfigured-or-degraded class — the same class an operator is least likely to be watching.
2. **Identity.** If the answer is refusal, which identity carries it — a new dispatch-owned one, or the identity the resolve seam already produces for each no-nomination shape.
3. **Timing.** If the delivery would fail at spawn anyway (empty branch, all-ineligible resolve), refusing at admission changes *when* and *how expensively* the delivery fails, not *whether* it fails.

A "declared default" fallback deserves precise treatment rather than a slogan: the delivered preference chain already implements a declared default — its base profile is what unqualified resolution selects — so the fallback option is either vacuous (the default resolves and was already nominated through the normal seam) or harmful (the default exists but is ineligible, e.g. its provider is in the very peak window being enforced, and nominating it bypasses the delivered F-6 admission gating).

## Constraints (Hard Requirements)

### C-1: Every lane admitted after this change carries a nomination

- **Statement:** A dispatch admission that cannot produce a provider profile nomination does not admit; no post-change lane record exists without `providerProfile`.
- **Source:** AC (GH-294 AC-F1-1, G-1, F-1) — the ticket's fail-closed cost-control goal.
- **Verification:** test (admission suites; the lane/attempt record invariants).
- **Negotiable:** no.

### C-2: No new dispatch-owned identity where an existing classified one fits

- **Statement:** The no-nomination refusal carries an existing `provider`-family identity produced by the resolve seam; no new `dispatch.*` identity and no new error-table row is declared.
- **Source:** internal standard (feature-dispatch-engine.md: "An admission refusal carries an existing `provider`, `config`, or `input` identity"; "The admission refusals and resolve failures add no `dispatch` row").
- **Verification:** code review + test (identity/exit mapping per sub-case).
- **Negotiable:** no.

### C-3: Pre-session refusal discipline

- **Statement:** The refusal appends no lease, attempt, lane, or queue record, starts no session, and publishes no event.
- **Source:** internal standard (dispatch admission predicate; TDR-0019 precedent).
- **Verification:** test (record-count and no-event assertions).
- **Negotiable:** no.

### C-4: Reads never default, guess, or borrow a profile

- **Statement:** No surface may synthesize, infer, or borrow a nomination for a delivery that did not produce one.
- **Source:** AC (GH-294 F-1) and prior decision (provider-profiles empty-by-default fail-closed rule).
- **Verification:** test + code review.
- **Negotiable:** no.

### C-5: The delivered empty-branch behavior is preserved, not weakened

- **Statement:** An empty or chain-less `provider.profiles` branch still refuses a delivery with `provider.profile.absent` semantics; this decision may move the refusal earlier, never make it disappear.
- **Source:** prior decision (feature-provider-profiles.md: the empty default is fail-closed).
- **Verification:** test (empty-branch dispatch refuses with the delivered identity).
- **Negotiable:** no.

### C-6: Pre-change records stay valid; absence is classified, never backfilled

- **Statement:** Lanes admitted before this change legitimately lack nominations; their absence reads as a classified absence, blocks no resume, and triggers no migration.
- **Source:** AC (GH-294 NG-8, §8.5, §19).
- **Verification:** test (resume of a pre-change lane proceeds with classified absence).
- **Negotiable:** no.

## Decision Drivers

**Technical drivers (ranked):**

1. **Cost-control integrity** — an unnominated lane is permanently invisible to the window watcher; the invariant must be structural, not statistical.
2. **Earliest, cheapest failure** — a pre-session refusal costs no lease, no records, no session; the same failure at spawn is strictly more expensive.
3. **Precedent coherence** — the provider-profiles selection model already refuses empty-by-default and ineligible states with explicit classified identities; the dispatch admission family already reuses existing identities for pre-session refusals.
4. **Vocabulary economy** — zero new identities, zero new exits; the refusal is described by machinery that already exists.

**Operational drivers:**

5. **Operator actionability** — the refusal names the actual misconfiguration (empty branch vs invalid name vs all-ineligible with the blocker list), so the fix is discoverable from the refusal alone.
6. **Determinism** — identical declared configuration produces the identical admission decision; no implicit selection depends on declaration order.

## Decision Rights (DACI)

Mirrors the `governance:` front matter. Driver: `@decision-advisor`. Decider: Juliusz Ćwiąkalski (human acceptance at the GH-294 PR review; AI does not accept this R2 record). Contributors: `@pm` (OQ-1 framing), `@spec-writer` (specification v1.0), `@decision-advisor` (analysis and record). Reviewers: `@readiness-reviewer`, `@reviewer`, human owner at the GH-294 PR review. Performers: `@coder` (admission rule, identity mapping, tests), `@doc-syncer` (spec reconciliation). Informed: resident-daemon window watch consumers, M2-S16 engine-first operations.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| `provider.profiles` ships empty; empty/chain-less resolution refuses `provider.profile.absent` (exit 1) | FACT | doc/spec/features/feature-provider-profiles.md ("The branch ships empty") | High — the no-nomination state would not be reachable by default | High |
| Profile resolution runs before any harness spawn and emits the env record the spawn wrapper injects | FACT | feature-provider-profiles.md ("Spawn Integration and Env Records") | Medium — admission would be the first, not the earlier, refusal point | High |
| Fail-closed selection refusals: `capability-denied` exit 1, `unavailable` exit 2 with eligibility list; `invalid` exit 1 | FACT | feature-provider-profiles.md ("Selection and Eligibility", "CLI Surface") | Medium — identity mapping in D2 would need rework | High |
| Dispatch pre-session refusals append no records, publish no event, carry existing identities, add no `dispatch` row | FACT | feature-dispatch-engine.md (admission sections; TDR-0019/TDR-0027 lineage) | Medium — C-2/C-3 would not be precedent-backed | High |
| Every production spawn path consumes the profile-resolve env record, so a no-nomination dispatch would fail at spawn anyway | ASSUMPTION | feature-provider-profiles.md ("Profile resolution runs before any harness spawn") | Medium — the admission refusal would newly refuse deliveries that previously spawned; recorded as a revisit trigger | Medium |
| Admission-stage ordering (credential preflight vs nomination vs hold/lease gates) is a plan decision | FACT | feature-dispatch-engine.md (run order is delivery-owned mechanism) | Low — ordering does not change the decision content | High |

## Mental Models & Techniques Used

- **Inversion** — asked "what must never happen": an admitted lane burning peak-rate tokens with no key the watcher can pause it by. Option design then falls out.
- **First principles** — the nomination is the enforcement key; an enforcement key that can be absent at admission is not an enforcement key, it is a hint.
- **Second-order thinking** — traced the "declared default" fallback to its two reachable ends: redundant (default resolves → already nominated) or a bypass (default ineligible → nomination to a parked/in-window profile defeats the delivered gating).
- **Fail-closed defaults** — the repo's own empty-by-default discipline applied at the new seam instead of a new mechanism.
- **Systems thinking** — admission gating (F-6) and in-flight pausing (F-3) are one control loop; the nomination is the join key that makes the loop closed.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 | C-2 | C-3 | C-4 | C-5 | C-6 |
|----------|-----|-----|-----|-----|-----|-----|
| ALT-0 (best-effort nomination) | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ALT-1 (declared-default fallback) | ❌ | ⚠️ | ✅ | ❌ | ❌ | ✅ |
| ALT-2 (classified admission refusal) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ = passes · ❌ = fails · ⚠️ = passes only via an accepted-risk exception (none claimed here)

### Alternative 0 — Do Nothing / Best-Effort Nomination

- **Eligibility:** Not eligible (fails C-1, C-4).
- **Summary:** Record the nomination when the resolve seam produces one; a delivery that resolves nothing is admitted un-nominated, with the absence classified on the records.
- **Constraint compliance:** Fails C-1 — post-change lanes without nomination exist by design; fails C-4 in spirit — the admission path silently proceeds past an unresolvable state the rest of the system treats as fail-closed.
- **Driver fit:** Scores zero on driver 1 (the un-pausable lane class is created), well on driver 2 (nothing fails).
- **Pros:** No refusal friction; the empty-branch install dispatches… except it cannot: spawn resolution refuses anyway.
- **Cons:** Creates exactly the bypass class the ticket exists to close; the zero-spend story gains a permanent asterisk.
- **Why rejected:** Fails C-1; also incoherent — the delivery fails later at spawn regardless, so the only thing bought is a more expensive failure.

### Alternative 1 — Fallback to the Profile's Declared Default

- **Eligibility:** Not eligible (fails C-1, C-4, C-5).
- **Summary:** Introduce a declared default nomination (a new configuration concept) applied when explicit resolution yields nothing; refuse only when no default exists either.
- **Constraint compliance:** Fails C-4 — the fallback nominates a profile the delivery did not resolve to. Fails C-5 where the default is ineligible: nominating an in-window or otherwise ineligible profile is precisely the F-6 admission gating bypass. Fails C-1 whenever the default is ineligible and admission proceeds. The ⚠️ on C-2: even the benign form needs new configuration surface no delivered identity describes.
- **Driver fit:** Weak on drivers 1, 3, 6 — a second selection path beside the delivered one, with different eligibility semantics.
- **Pros:** Delivered work continues in partially-configured states.
- **Cons:** Vacuous-or-harmful (Problem Framing): the delivered chain base already is the declared default when it can resolve; when it cannot, the fallback either has nothing to use or uses something the system just declared ineligible. Adds a config concept, a second selection path, and a new bypass class.
- **Why rejected:** Fails three non-negotiable constraints; the benefit is already delivered by the preference chain.

### Alternative 2 — Classified Refusal at Admission, Reusing the Resolve Identities

- **Eligibility:** Eligible (passes C-1 through C-6).
- **Summary:** A delivery that cannot nominate is refused at dispatch admission — pre-session, recordless, eventless — carrying the identity the resolve seam produced for the specific no-nomination shape, at that identity's delivered exit projection.
- **Constraint compliance:** C-1 structural (admission and nomination are one step); C-2 by construction (the identity is the resolve's own); C-3 matches the delivered pre-session family; C-4/C-5 unchanged semantics, earlier timing; C-6 untouched (resumes never re-nominate).
- **Driver fit:** Best on all six drivers.
- **Pros:** Structural invariant; cheapest failure; zero new vocabulary; the operator sees the same classification `provider profile resolve` would give.
- **Cons:** An all-ineligible resolve can project exit 2 at admission (`provider.profile.unavailable`), so the delivered "the admission preflight is the only admission refusal whose exit can be 2" sentence widens — a spec-visible update, exits stay within {0, 1, 2}.
- **Why chosen:** See Decision.

## Decision

- **Decision:** Adopt **ALT-2**, as five binding clauses:

  1. **D1 — Refuse at admission.** A delivery that cannot nominate a provider profile at dispatch admission is refused there, as a pre-session refusal: no lease, no attempt, no lane, no queue record, no session, no event. This joins the delivered pre-session refusal family as its nomination member.
  2. **D2 — Carry the resolve identity, not a new one.** The refusal carries the identity the resolve-before-spawn seam produces for the specific shape: `provider.profile.absent` (empty or chain-less branch, exit 1), `provider.profile.invalid` (invalid explicit nomination, exit 1), `provider.profile.capability-denied` (all capability blockers, exit 1), `provider.profile.unavailable` (all candidates ineligible, exit 2, with the eligibility list). Each keeps its delivered exit projection; no `dispatch.*` identity and no error-table row is added. An all-profiles-in-window resolve refusing at admission is the delivered iteration-start gating firing at its cheapest point, not a new behavior.
  3. **D3 — One admission family.** The rule binds the dispatch family's admission as delivered: the one-shot `dispatch <ref>` path and the composed daemon supervision claim inherit it together, the same shared-predicate scope as the per-ref single-flight refusal.
  4. **D4 — Resumes never re-nominate.** The nomination is a durable record field captured at admission. A resume (operator- or window-end-driven) of a lane admitted before this change proceeds with the nomination read as a classified absence — it never blocks the resume, never borrows a profile, and the lane is simply not window-pausable; no backfill occurs.
  5. **D5 — No dispatch-default concept.** "Declared default" behavior remains what the delivered preference chain already provides: its base profile is what unqualified resolution selects, through the normal seam, subject to normal eligibility. No separate default-nomination key is introduced.

- **Rationale (tied to drivers):** Driver 1 (cost-control integrity) makes the invariant structural — C-1 admits no exception because every exception is an un-pausable lane. Driver 2 (earliest failure) is served exactly: the delivery was going to fail at spawn in every reachable no-nomination state, so admission refusal is pure timing gain. Drivers 3 and 4 (precedent, vocabulary economy) are why ALT-2 reuses the resolve identities verbatim: the classifications already exist, already name the operator's fix, and already have exit projections. Driver 6 (determinism) falls out of delegating classification to the delivered selection model instead of adding an admission-side selection variant. ALT-1 is rejected not on taste but on structure: its two reachable behaviors are redundancy and bypass (Problem Framing; second-order analysis).

- **Decider:** Juliusz Ćwiąkalski (owner) — human acceptance at the GH-294 PR review; AI does not accept this R2 record.

- **Conditions for revisit:** See `revisit_triggers`; principally the discovery of a spawn path that bypasses profile resolution, which would convert this from "earlier refusal" to "new refusal" and reopen the trade.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-6 (see the ALT-2 compliance row). No accepted-risk exceptions are claimed.

## Trade-offs & Consequences

### Positive Outcomes

- The peak-pause enforcement key is structural: `100% of dispatches admitted after this change` carry a nomination (GH-294 metric table) by construction, not by observation.
- No-nomination failures cost nothing durable — the pre-session discipline keeps ledgers clean and the refusal loop trivially retryable after configuration is fixed.
- Zero new identities, exits, or configuration concepts; the refusal's meaning is inherited wholesale from the provider-profiles vocabulary.
- Fresh-install behavior is unchanged in substance: an empty branch already refused at spawn; it now refuses earlier with the same identity.

### Negative Outcomes

- A delivery whose every profile is temporarily ineligible (e.g. all in peak windows) is refused at admission rather than failing later at spawn — spec-visible timing change; the dispatch-engine admission-refusal list gains the nomination member and loses the "preflight is the only exit-2 admission refusal" exclusivity.
- Operators who relied on post-spawn failure timing or artifacts (none delivered — refusals appended nothing before either) see none; noted for completeness.
- The ASSUMPTION that all production spawn paths consume the env record is load-bearing for the "timing-only" claim; if false, this decision introduces a genuinely new refusal.

### Unresolved Questions

- [ ] Admission-stage ordering — where the nomination refusal sits relative to the credential preflight, the owner-hold gate, and the lease/single-flight predicates (owner: @plan-writer, GH-294 plan).
- [ ] Whether the refusal's envelope needs any dispatch-family detail beyond the resolve identity's row, if operator feedback during delivery asks for it (owner: @coder; TDR-0027 governs any envelope slot).

## Implementation Plan

1. **Admission rule and identity mapping** — the nomination read joins the admission path with the resolve identity and exit projection per D2; refusal tests per sub-case (absent, invalid, capability-denied, unavailable) assert identity, exit, zero records, zero events.
2. **Daemon-claim parity** — the composed supervision claim inherits the refusal as it inherits single-flight; one suite covers both paths.
3. **Resume and pre-change lanes** — resumes read the recorded nomination or its classified absence; no re-resolution, no backfill (C-6 suite).
4. **Spec reconciliation** — dispatch-engine records the admission-refusal family's new member and the exit-2 widening; provider-profiles notes its identities' reach extends to dispatch admission; no new row in the error table.
5. **Guardrail** — the M2 planning-pack wording that left OQ-1 open is closed by this record; the GH-294 spec's OQ-1 row is amended by the PM to point here (not part of this record's writes).

## Verification Criteria

- Metric: post-change admitted lanes carrying a nomination — Target: 100% — Window: GH-294 acceptance suites and the first post-merge delivery.
- Metric: records/events appended by a no-nomination refusal — Target: 0 — Window: every run.
- Metric: identity/exit mapping per no-nomination sub-case — Target: exact match to the delivered resolve rows — Window: admission suites.
- Metric: resumes of pre-change lanes blocked for missing nomination — Target: 0 — Window: resume suites.

## Confidence Rating

High. Every reachable no-nomination shape already has a delivered, tested classification; the decision composes existing machinery at an earlier point and adds no new vocabulary. The single material assumption (all spawn paths consume the env record) is recorded with a revisit trigger.

## References

- GH-294 specification: `doc/changes/2026-11/2026-11-13--GH-294--provider-peak-pausing/chg-GH-294-spec.md` (F-1, AC-F1-1, OQ-1, NG-8, §8.5, §19)
- Dispatch engine current truth: `doc/spec/features/feature-dispatch-engine.md` (admission refusals, pre-session discipline, identity conventions)
- Provider profiles current truth: `doc/spec/features/feature-provider-profiles.md` (empty-by-default refusal, selection refusals, spawn integration)
- TDR-0019 (pre-session admission refusal precedent), TDR-0027 (failure-envelope detail conventions)
- Ticket: GitHub issue 294 (milestone M2); backlog story M2-S17
