# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-377
Date: 2026-11-22
Pause Required: no

Scope read: ticket `juliusz-cwiakalski/agentic-delivery-os#377` (body + the single owner-authored
implementation-pointer comment of 2026-11-22, treated as binding), `chg-GH-377-spec.md` v1.0,
`chg-GH-377-test-plan.md` v1.0, `chg-GH-377-plan.yaml` (`plan validate` = valid,
`readyForDevelopment: true`), `chg-GH-377-pm-notes.yaml`, `doc/spec/features/feature-provider-profiles.md`,
`feature-provider-engine.md`, `feature-peak-pausing.md`, `feature-config-layer.md`,
`doc/guides/provider-conditions-and-parks.md`, `doc/decisions/TDR-0062`, `ADR-0007`,
`packages/core/src/contracts/{provider,provider-profile,error-table,plan}.ts`,
`packages/core/src/provider/{profile,engine,parks,loop}.ts`,
`packages/cli/src/edge.ts` (`createResolvedProviderProbe`, `profile.resolve` handler),
`packages/cli/src/production.ts` (`resolveProfileContextFrom`, dispatch nomination predicate),
`.jaiship/config.yaml`, and the delivered suites the plan claims to extend.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: PASS
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: FAIL

Positive checks recorded (so they are not re-litigated on the next iteration):

- **Plan coverage arithmetic is exact.** The four phases own 35 TC identifiers, each exactly once:
  phase 1 = 059–065, 087, 088, 091; phase 2 = 066–070, 092, 093; phase 3 = 071–075, 089, 090;
  phase 4 = 076–086. Union = `TC-PROFILE-059..093`, the delivered maximum is `TC-PROFILE-058`, so the
  namespace is continued, not reused. Every F-1..F-7, NFR-1..NFR-7, DM-1..DM-5 and EVT-1..EVT-3 is
  owned by at least one phase and one case.
- **All three probe call sites are covered.** `createResolvedProviderProbe` is constructed exactly three
  times in the delivered tree (`packages/cli/src/edge.ts` profile-resolve handler,
  `production.ts` `resolveProfileContextFrom`, `production.ts` `nominationPredicate`). Phase 1 owns the
  edge handler, phase 3 owns `production.ts` and names `resolveProfileContextFrom`'s injected reader and
  the nomination predicate. A-1 holds: `provider.stateStore` is in scope at the edge handler and `store`
  is in scope at both production sites, so the park fold needs no new injected port type.
- **The two resolved contracts fit the delivered contract shapes.** `ProfileProviderAvailability.condition`
  is an open `string`, `PROFILE_BLOCKER_KINDS` already contains `condition`, and `PROFILE_EVIDENCE_FIELDS`
  already carries `blockers` — so `watch-stale` is representable with zero contract change, and
  `contract-inventory.json` (which inventories `contracts/` only) is untouched by changes confined to
  `provider/profile.ts` and `cli/edge.ts`.
- **The probe can read parks synchronously and read-only.** `StateStorePort.readRecords` and
  `readProviderParkViews(store, nowMs)` are synchronous, derive activity as `expiresAtMs <= nowMs →
  expired`, and never write; `createParkRecord` accepts any `ParkCause` with either `subjectKind`, so the
  provider-subject `reevaluation-cap` arm of TC-PROFILE-081 is constructible (A-T7 holds).
- **The phase-7 page scope is largely correct.** Only `feature-provider-profiles.md` and
  `doc/guides/provider-conditions-and-parks.md` repeat the superseded "declared, enabled, peak window"
  boundary; both are declared. `feature-provider-engine.md`'s edge description ("supplies the watch
  observation instant") is the right third page.
- `doc/spec/**` contradictions are declared as phase-7 obligations and not silently edited (NG-7): this
  is the accepted, scoped deferral, which is why `system_spec_consistency` passes.
- No ticket requirement is dropped: the six ticket ACs map to AC-F1-1, AC-F1-2, AC-F1-3, AC-F5-1,
  AC-F6-1, AC-F7-1; required behaviours 1–4 map to F-1/F-2, F-3, F-4, F-5; the comment's five proof items
  and its constraints (no policy edit, no operator-local requirement, GH-366 out of scope, PR open against
  `main-tools`, no pre-emptive TDR) are each represented.

## Findings

1. [critical] cross_artifact_consistency — spec#§17 `AC-F3-1` (last clause) + test-plan#5.2 `TC-PROFILE-069`
   vs. the binding owner comment (2026-11-22, "Seat substitution" and "Proof required") and spec#§17 `AC-F3-2`.
   Gap: for the case "the only later profile declares the seat but is capability-inadequate", the spec and
   test plan pin `provider.profile.capability-denied`, while the owner's binding comment says "If no
   eligible profile supplies the seat, refuse `provider.profile.unavailable` naming the seat and the
   provider". The two identities are not interchangeable: `capability-denied` is `user-validation`
   (exit 1, `retryable: false`, remediation "Assign a seat whose declared capability matches the task"),
   `unavailable` is `platform-provider` (exit 2, `retryable: true`, remediation "Wait for a named provider
   condition to clear"). The capability identity is also factually wrong in this arm — the *selected*
   profile's seat is capability-adequate; only the substitute is not — so an operator is told to change a
   capability declaration that is already correct and is denied a retry that would succeed after expiry.
   A capability-inadequate substitute satisfies neither AC-F3-2's built-in precondition ("every later
   profile is either ineligible or does not declare that seat") nor a new identity (forbidden), so the
   behaviour is currently undefined for a real arm.
   Remediation target: specification
   Suggested fix: decide and state once that a capability-inadequate substitute does not supply the seat and
   therefore yields `provider.profile.unavailable` naming seat and provider (matching the binding comment);
   delete AC-F3-1's "the delivered capability classification applies" clause and TC-PROFILE-069's
   `capability-denied` expectation, keeping the capability *gate* preserved (the substitute is simply not
   used). If `capability-denied` is genuinely intended, the spec must record the deviation from the owner
   comment and AC-F3-2 must be reworded, because the two currently contradict each other.

2. [major] spec_completeness — spec#§8.3 `DM-2`, §17 `AC-F3-2`; test-plan#5.2 `TC-PROFILE-070`, `TC-PROFILE-071`.
   Gap: AC-F3-2 requires "the refusal and eligibility evidence name **both** the seat and the parked
   provider", and the tests require that in "the eligibility list" itself. The delivered model cannot carry
   it: the selected profile is `eligible` (its declared `providers` are all available; only a seat model is
   parked), and `selectProfile` marks every later profile `shadowed` *without probing*. So the only way to
   satisfy the AC as written is to flip the selected profile's verdict to `ineligible` on the refusal path,
   which contradicts F-3 ("substitution is a per-seat routing fact inside the selected profile, not a
   profile switch") and TC-PROFILE-068's assertion that `profile`, `rung`, `tier` and the full eligibility
   list are unchanged; the alternative (a seat evidence position) is a new key, forbidden by NG-2.
   Remediation target: specification
   Suggested fix: name the single evidence position explicitly (for example: the refusal `summary` plus a
   `condition` blocker with `value` = the park cause and `detail` naming `<seat>` and `<provider>`, appended
   to the selected profile's eligibility entry only on the refusal path) and say whether that entry's
   verdict flips; then align TC-PROFILE-068 (substitution leaves the list identical) and TC-PROFILE-070/071
   (refusal names seat and provider) with that one rule. Also state that a later profile stays `shadowed`
   when it is inspected as a substitution candidate, so an operator cannot read substitute eligibility from
   the list (this also qualifies §10 "Blockers are the evidence" and RSK-5's rationale).

3. [major] spec_completeness — spec#§5.1 `F-2`, §8 (no interface entry), §12 `A-1`/`A-6`, §17 `AC-F2-1`.
   Gap: the spec never says *which seam* supplies a watch observation to the probe, nor *which providers*
   can be stale. The delivered facts are: no watch observation is persisted (`PROVIDER_RECORD_KINDS` is
   `provider.park | provider.announcement` only), and the composition's only watch seam is
   `ProviderComposition.watchObservedAtMs` — an observation *instant*, with no condition. A-1 only claims
   that the park fold needs no new injected port; nothing covers observations. Consequently "a
   composition-supplied observation reporting a clear condition" (AC-F2-1) cannot be produced by any
   delivered composition, and three materially different implementations satisfy the text: a single global
   `observedAt` for all providers, per-watch-target instants, or "every provider is stale if the global
   observation is old". The first two differ observably whenever watch targets declare different
   `maxAgeSeconds`; the third blocks providers that have no watch target at all. A-T6's "a composed live read
   observes at the read instant" silently assumes the answer.
   Remediation target: specification
   Suggested fix: add the probe's inputs to §8 (park reader + observation source and their shapes), state
   the exact staleness rule (per declared `provider.profiles.watch.<name>` target: `ageSeconds =
   floor((nowMs − observedAtMs) / 1000) >= maxAgeSeconds` ⇒ blocker `watch-stale`; a provider with no watch
   target is never stale), and state plainly that no production composition supplies a stale observation
   today, so F-2 is a guard, not a steady-state input — the same honesty TDR-0062 D5 uses for the watch
   surface.

4. [major] cross_artifact_consistency — spec#§8.5, §9 `NFR-7` vs. §5.1 `F-3` / `AC-F3-1`;
   test-plan#5.2 `TC-PROFILE-066`, `TC-PROFILE-067`.
   Gap: F-3 re-checks the seat's provider against "the same availability facts", i.e. declaration,
   enablement, declared peak window, active park *and* staleness — not parks only. Therefore a seat model on
   an undeclared provider, a disabled provider, or a provider inside its declared peak window becomes
   unavailable and is substituted or refused *with zero park records and zero observations*. §8.5 states
   "A state with no park records and no supplied observations resolves exactly as delivered for the same
   configuration and clock", and NFR-7 repeats it ("identical to the delivered behavior"); both are false
   for any configuration whose seat models reach outside `profile.providers` or are inside a peak. That is a
   real blast radius the plan does not declare, and no case covers it: TC-PROFILE-066/067 exercise a
   *parked* provider through a rung/override; no case covers a seat on a peak-parked, disabled or undeclared
   provider. The ticket's own wording is narrower ("never emit a model whose provider is **parked** at the
   moment of resolution"), so the widening is a choice, not a requirement.
   Remediation target: specification
   Suggested fix: either (a) scope the seat guarantee to park + stale eligibility, exactly as the ticket
   states, or (b) keep the broad rule and then correct §8.5/NFR-7 to say "with no parks **and all seat
   providers declared, enabled and outside peak**, behaviour is identical", and add the peak-parked-seat and
   undeclared-seat arms to AC-F3-1 and the test plan (with a plan phase owning them).

5. [major] decision_capture — spec#§4.2 `NG-8`, §15 `DEC-7` vs. `doc/decisions/TDR-0062` D2 and
   `revisit_triggers`.
   Gap: TDR-0062 D2 states in terms: "`watch-stale` is watch-only: it joins no park cause, condition kind,
   skip reason, or announcement code, **and it never enters chain resolution or profile eligibility**", and
   its revisit triggers say "Watch conditions are proposed as admission gates: that is a new eligibility
   decision ... decide it separately rather than widening this record." GH-377 does exactly the thing the
   record says must be decided separately: it makes a watch condition a profile-eligibility blocker *and*
   therefore a dispatch-admission input. The spec declares no decision record is needed because no
   vocabulary grows (DEC-7) — but the conflict is with the D2 *eligibility boundary*, not with the closed
   sets. The reserved ids TDR-0075..0076 are left unused while a delivered decision record will contradict
   the shipped behaviour; the pm-notes note "spec contradiction to reconcile in phase 7" covers spec pages
   only, and phase 7's scope (`doc/spec/**`) cannot amend `doc/decisions/**`.
   Remediation target: specification (route authoring to `@decision-advisor`)
   Suggested fix: author a decision record (TDR-0075 by the owner's reservation rule, not pre-emptively —
   this is the "genuinely needed" case) that narrows TDR-0062 D2 for profile eligibility, states the
   zero-live-fetch / zero-snapshot / zero-write cost model that makes the admission widening acceptable, and
   links/supersedes the boundary; add the record to the change's deliverable artifact list and to the
   phase-7 documentation obligation. An owner-recorded explicit exemption is the only acceptable alternative.
   (If `@decision-advisor` judges that the reversal needs owner acceptance, the PM records a pause then —
   not this gate.)

6. [major] test_traceability — test-plan#5.2 `TC-PROFILE-071`.
   Gap: this is the only edge-level (exit-2 projection) case for AC-F3-2, and its precondition is the
   *committed* policy ("Committed-policy text served through the injected file system ... recorded facts in
   which both declared providers are parked (or the substitute profile is ineligible)"). That state cannot
   reach the new seat path: `delivery.providers = [zai-coding-plan, deepseek]`, all 24 `delivery` seats name
   one of those two, and all 24 `paid` seats name `deepseek`; parking either provider (or both) produces the
   *delivered* provider-level `provider.profile.unavailable` because every profile is ineligible on its own
   `providers` list. So the case passes through pre-existing code, or fails to reach the refusal it claims
   to prove; the new seat-level exit-2 projection is untested at any layer.
   Remediation target: test_planning
   Suggested fix: drive TC-PROFILE-071 through an injected fixture policy document whose selected profile is
   eligible on its `providers` while one seat model names a parked provider *outside* that list and no later
   profile declares that seat on an available provider (the same fixture family as TC-PROFILE-070), and keep
   the committed document for AC-F1-1/AC-F1-2 only. State explicitly in the precondition that the refusal
   under test is the seat-level one, not the all-profiles-ineligible one.

7. [major] dod_defined — spec (whole document; §4.1 and §18 are outcome metrics and rollout prose, not a DoD).
   Gap: the spec defines no Definition of Done. `doc/guides/definition-of-done.md` states "Every change must
   define its own DoD in its spec ... DoD existence is itself a Definition-of-Ready criterion"; recent specs
   carry a `DOD-` block asserted in their validation checklist, and this spec's checklist does not claim one.
   Phase 10 (`dod_check`) therefore has no change-specific bar to check beyond the ACs, and the ticket's own
   delivery conventions (PR open against `main-tools`, `pnpm check` green with `TMPDIR=$PWD/tmp/tmpdir`,
   commits via the primitive, no committed-policy edit, decision ledger re-verified) are not captured as
   done conditions.
   Remediation target: specification
   Suggested fix: add a "Definition of Done" block with concrete, testable items traced to the ACs and to the
   ticket conventions (e.g. every AC-F*/AC-NFR1 case green in `pnpm check`; committed `.jaiship/config.yaml`
   and `config.local.yaml` byte-identical; no new member in any closed set or envelope key; TDR-0062 boundary
   reconciled or superseded; PR open against `main-tools`), and assert it in the validation checklist.

8. [minor] ac_quality — spec#§2.1 (selection bullet), §5.1 `F-3`, §17 `AC-F3-1`.
   Gap: AC-F3-1's triggers are "an active pacing rung or an agent override", presented as the production
   route by which a seat escapes the profile's provider list. In the delivered tree `evaluatePacing` is
   called only from tests — no production caller supplies `options.seatModels` — and every committed seat
   names a provider inside its profile's `providers`, so neither trigger is reachable in production, and the
   "second door" is theoretical. Meanwhile the general case (a *declared* seat model on a provider outside
   `providers`, with no rung and no override) is the shape most likely to occur and is not named in any AC
   precondition, although AC-F3-2 covers it generically.
   Remediation target: specification
   Suggested fix: state that the re-check applies to every effective seat model — declared, rung-derived and
   override-targeted — and either add the plain declared-seat case as an AC-F3-1 trigger or note that the
   rung arm is a contract-level arm exercised by supplying pacing output (not a present production path).

9. [minor] test_traceability — test-plan#1.2 `GAP-T3`, #5.2 `TC-PROFILE-059`.
   Gap: GAP-T3 asserts "the injected file system was asked for the local path zero times, so 'not required'
   is not confused with 'not consulted'". The delivered acquisition always stat-probes the project-local
   layer (`packages/adapters/src/file/config-source.ts`, `readEligibleLayer("project-local",
   "config.local.yaml")` calls `fs.exists(currentFile)`); only the *content* read is skipped when the file is
   absent. Implemented literally, the assertion fails for a reason unrelated to the defect.
   Remediation target: test_planning
   Suggested fix: assert zero `readText` (content) reads of any `config.local.yaml` path and, separately,
   that no local layer contributed a source/value; treat the existence probe as delivered acquisition
   behaviour rather than as "consulting" the override.

10. [minor] cross_artifact_consistency — spec#§2.1 ("Two consumers share one probe"), §16 (dispatch
    nomination "Inherits — wired to the same probe"), §22 ("The profile-resolve surface and the dispatch
    nomination predicate must keep sharing one composed probe"), `RSK-6`; plan#phases 1 and 3.
    Gap: the delivered code does not share one probe instance. It shares one *factory*: the CLI handler
    constructs its own, `resolveProfileContextFrom` constructs its own, and `nominationPredicate` constructs
    its own (and `resolveProfileContext` memoizes its context once per composition, while nomination re-reads
    per admission). The plan enumerates the three sites correctly, so spec and plan disagree about the same
    mechanism, and RSK-6's regression claim ("both consumers are wired to one composed probe") is not the
    thing that would break.
    Remediation target: specification
    Suggested fix: replace "one composed probe / two consumers" with "one probe factory, three call sites,
    one verified fold read per resolution", and restate the RSK-6 regression as "no fourth call site and no
    second availability derivation", which is what a test can actually assert.

11. [minor] test_traceability — test-plan#5.1 `TC-PROFILE-074` (row layer "Pure domain" vs. §7 row file
    `tests/behaviour/provider-nomination-admission.test.ts` and type "Integration"), and its "unsatisfiable
    fact set".
    Gap: the layer/type labels contradict each other, and the case never says whether the "unsatisfiable" set
    is the committed policy (which cannot express the seat-level refusal — see finding 6) or a fixture, so
    the parity assertion may be vacuous for the refusal arm.
    Remediation target: test_planning
    Suggested fix: label the case Integration / `tests/behaviour/provider-nomination-admission.test.ts`, and
    name the fixture whose selected profile is eligible while a seat model names a parked provider.

12. [nit] delivery_planning — plan#phase 4 `scope.files` (`doc/spec/features/feature-provider-profiles.md`,
    `feature-provider-engine.md`, `feature-peak-pausing.md`, `doc/guides/provider-conditions-and-parks.md`).
    Gap: the four documentation paths are declared inside a `kind: delivery` (lease-taking) phase whose own
    summary says delivery does not author them and that phase 7 owns the reconciliation. The declaration is
    therefore simultaneous assignment and disclaimer: it makes the phase's commit lease look like it
    authorizes doc edits that NG-7 forbids. The GH-310 precedent keeps the documentation obligation in a
    plan-level block and out of any delivery phase's `scope.files`.
    Remediation target: delivery_planning
    Suggested fix: move the four paths into a plan-level documentation-coverage block (as GH-310 does) or
    state in the phase summary that they are declared for diff coverage only and are excluded from that
    phase's commit; either way keep the plan-diff coverage the plan-writer intended.

Persistent findings: none (first iteration; no prior readiness records exist in this change folder).
