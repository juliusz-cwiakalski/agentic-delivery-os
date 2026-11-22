# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-377
Date: 2026-11-22
Pause Required: no

Scope read: ticket body + the owner-authored implementation-pointer comment of 2026-11-22 (as read in
iteration 1, treated as binding), `chg-GH-377-spec.md` v1.1, `chg-GH-377-test-plan.md` v1.1 (39 cases,
`TC-PROFILE-059..097`), `chg-GH-377-plan.yaml` (5 phases), `chg-GH-377-pm-notes.yaml`,
`readiness-review/readiness-iter-1.md`, `doc/decisions/TDR-0075-watch-stale-as-profile-eligibility-blocker.md`,
`doc/decisions/TDR-0062`, `doc/decisions/00-index.md`,
`doc/spec/features/{feature-provider-profiles,feature-provider-engine,feature-peak-pausing,feature-dispatch-engine,feature-config-layer,feature-result-contract}.md`,
`doc/guides/provider-conditions-and-parks.md`, `packages/core/src/{contracts/provider-profile,contracts/error-table,contracts/plan,provider/profile,provider/engine,provider/quota}.ts`,
`packages/cli/src/{edge,production,commands/provider,commands/commit,index}.ts`,
`tests/behaviour/{provider-policy-adoption,provider-profile-edge-wiring}.test.ts`, `tests/golden/provider-profile-resolve.test.ts`.

## Facet Summary

- spec_completeness: PASS
- ac_quality: FAIL
- plan_coverage: PASS
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: FAIL
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Disposition of iteration-1 findings

| # | Finding (short) | Disposition | Evidence |
|---|---|---|---|
| 1 | `capability-denied` vs `unavailable` for a capability-inadequate substitute | **CLOSED** | AC-F3-1 now says an inadequate candidate "is not used as a source at all … the unsupplied seat is governed by AC-F3-2"; AC-F3-2's Given explicitly includes "declares it only on a capability-inadequate model" and refuses `provider.profile.unavailable`; F-3/DEC-4 reserve `capability-denied` for the selected profile's own seat; TC-069 splits into inadequate-substitute (→ `unavailable`), adequate-substitute (→ substitution), and the delivered `TC-PROFILE-010` control (→ `capability-denied`). AC-F3-1/2/3 are non-overlapping on their *outcome*; verified against `ERROR_TABLE` (`capability-denied` user-validation exit 1 non-retryable vs `unavailable` platform-provider exit 2 retryable). |
| 2 | Refusal evidence position unrepresentable without a verdict flip | **CLOSED** | DM-2, §10, DEC-8, AC-F3-2 and TC-068/070/071/074 all state one rule: the delivered list is carried unchanged (selected `eligible`, later `shadowed`, no blocker appended, no flip), the bounded `summary` names seat + provider, no new key, and a substitution candidate stays `shadowed` so substitute eligibility is not readable. Feasible: `resolveProfileForSpawn`'s refusal arm already returns `{code, summary, eligibility, events}`. |
| 3 | No watch-observation seam specified | **CLOSED** | §8.6 fixes the seam (per-provider `{condition, observedAtMs}`, DM-7), the exact per-declared-target rule (`floor((nowMs−observedAtMs)/1000) >= maxAgeSeconds`, bound stale), no-target-never-stale, live-read age 0, absent-observation inert, freshness-only consumption, production honesty, and the three excluded readings; A-10/A-11 added; TDR-0075 cited as authority. Pinned by TC-062..065, 095..097. |
| 4 | Seat guarantee widened past parks, contradicting §8.5/NFR-7 | **CLOSED** | F-3/§7.2 scope the seat gate to recorded unavailability; §8.5 and NFR-7 now say "with zero parks/observations … **including** seat models on an undeclared, disabled or peak-parked provider"; AC-F3-3 + TC-094 are the regression boundary; TC-066/067 say declaration/enablement/peak are `TC-PROFILE-094`'s boundary. |
| 5 | TDR-0062 D2 narrowing unrecorded | **CLOSED** | TDR-0075 exists, is committed (`8c73bec1`), indexed (`doc/decisions/00-index.md:100`, committed in `59499f82`), `status: Proposed`, `supersedes: []`; TDR-0062 is untouched (`status: Proposed`, empty `superseded_by`); no `TDR-0076` file or index row. The record narrows only "never enters profile eligibility", keeps the watch surface/predicate/clamp/closed sets, and states the zero-acquisition cost model and the production-honesty limit. |
| 6 | TC-071 driven by the committed policy (cannot reach seat refusal) | **CLOSED** | GAP-T4 + TC-071/TC-074 now use an injected fixture policy whose selected profile is `eligible` on its `providers` while a seat model names a parked provider outside the list; the committed document is scoped to AC-F1-1/AC-F1-2 (TC-059/060/089/090), and §6 restates it. |
| 7 | No Definition of Done | **CLOSED** | `## 26. DEFINITION OF DONE` carries DOD-1..DOD-8 traced to ACs and delivery conventions, asserted in the validation checklist; test plan §3.4 maps every DOD to a case or a declared gate (DOD-6..DOD-8 correctly marked gate evidence). |
| 8 | Rung/override triggers only; no plain declared-seat arm | **PARTIAL** | Spec side fixed: F-3 "Reach" names the declared and override arms as production-reachable and the rung arm as a contract-level arm; AC-F3-1 names "declared". Test side not fixed: no case substitutes a **plain declared** seat model on a parked provider (TC-066 = rung, TC-067 = override; TC-094 exercises declared seats only at the AC-F3-3 boundary with zero parks). See new finding 4. |
| 9 | GAP-T3 counted the `exists` probe | **CLOSED** | GAP-T3, TC-059 and §6 assert zero `readText` (content) reads of any `config.local.yaml` path plus "no local layer contributed a source or value", and explicitly exclude the delivered existence probe; RSK-T6 restated to match. |
| 10 | "One probe / two consumers" misstatement | **CLOSED** | §2.1 "One probe factory serves three call sites", §16, §22, RSK-6 and DOD-4 now state one factory, three call sites, one verified fold read per resolution, and restate the regression as "no fourth call site and no second availability derivation"; TC-087 carries the construction census. |
| 11 | TC-074 layer/type labels and unspecified fact set | **CLOSED** | TC-074 is Integration on `tests/behaviour/provider-nomination-admission.test.ts`, with both fixture families named (committed-policy selection parity arms; the TC-070 seat-level fixture for the refusal arm) and both parity arms asserted. |
| 12 | Doc paths declared inside a `delivery` (lease-taking) phase | **CLOSED** | New phase 5 (`kind: planning`, lease-free) owns the four pages + TDR-0075 + the decision index, with the declaration-only comment; `git diff 05f4a719..8c73bec1` shows the paths moved out of phases 1 and 4 with no other scope change. |

Positive checks re-verified (not to be re-litigated):

- `plan validate GH-377` → `verdict=valid`, `artifact=yaml`, `tier=full`, `readyForDevelopment=true`.
- Phase summaries sanitized without scope drift: every summary starts lowercase; `[A-Z][A-Z0-9]*-\d+` matches zero tokens in all five summaries; TC ownership lives only in `#` comments (diff above shows summaries lowercase-only and paths relocated, TC comments unchanged except the two new identifiers).
- TC ownership arithmetic is exact: 39 identifiers in the comments, each exactly once; union equals the test-plan's 39 case headings; phase 1 = 059–065, 087, 088, 091, 095–097; phase 2 = 066–070, 092–094; phase 3 = 071–075, 089, 090; phase 4 = 076–086; delivered maximum is `TC-PROFILE-058`, so the namespace continues.
- Plan code areas reconcile with test-plan §7 for every TC (the only unlisted file is `tests/behaviour/provider-cli.test.ts`, an **unedited** control per TC-084, so no coverage gap).
- `planning` is a declared `PLAN_PHASE_KINDS` member and `LIFECYCLE_PLAN_KINDS` maps it to `delivery_planning`; `phase complete delivery` reads only `delivery`-kind phases (`planPhaseForLifecycle`), so phase 5 cannot block the delivery boundary.
- Delivered facts the artifacts lean on still hold: `ProfileProviderAvailability.condition` is an open string; `PROVIDER_RECORD_KINDS` is park/announcement only; `ProviderComposition.watchObservedAtMs` is an instant; `createResolvedProviderProbe(entries, nowMs, zoneFactsFor)` is extensible at `edge.ts`; the composition holds the state store at all three call sites; `isWatchObservationStale` / `PROVIDER_WATCH_DEFAULT_MAX_AGE_SECONDS = 900` are delivered.

## Findings

1. [major] test_traceability — test-plan#5.2 `TC-PROFILE-071` (**Expected Outcome**, bullets 1–3)
   Gap: the case pins the seat-level refusal's exit-2 projection as an `error` envelope — "`error.code === "provider.profile.unavailable"`", "`data` is absent", "`error` carries the unchanged eligibility list … plus a bounded `summary`". The delivered projection is the opposite: `packages/cli/src/commands/provider.ts` returns a **`data`** envelope (`outcome: "refused"`, `code`, `summary`, `eligibility`, `events`) for exactly this identity, projected to exit 2 through `projectionClass: "platform-provider"` (`exitProjection` at line 368), and the delivered suite `tests/behaviour/provider-policy-adoption.test.ts` (`TC-POL-NOM-002`, lines 1543–1560) already asserts `exitCode === 2` with `data.outcome === "refused"` and `data.eligibility`. Implemented as written, the only edge case for AC-F3-2 either fails or forces an edit to that projection, which spec §8.5 forbids ("refusal identities and their exit projections are unchanged") and neither AC nor DM-2 asks for. This is the same case iteration-1 finding 6 concerned and it remains unimplementable in a different way.
   Suggested remediation target phase: test_planning
   Suggested fix: restate the expectations against the delivered refusal envelope — exit 2; `data.outcome === "refused"`; `data.code === "provider.profile.unavailable"`; `data.summary` names the seat and the parked provider within the profile caps; `data.eligibility` is the unchanged list (selected `eligible`, later `shadowed`, no blocker, no flip); no `envRecord` and no serialized `data-v1` record on any stream; zero park/announcement/target writes. (Optionally have the spec state "the delivered `data` refusal envelope" once in §8.5 so the three artifacts name the same surface.)

2. [major] cross_artifact_consistency — spec#§5.1 `F-3` vs. spec#§8.3 `DM-2`, §10, `AC-F3-2`, §15 `DEC-8`; test-plan#5.2 `TC-PROFILE-070`
   Gap: `F-3` requires the substitute to be "the next profile in `preferenceChain` order **that is eligible**", and `AC-F3-2`'s Given enumerates "every later profile … **is ineligible**" as a disqualifier — both require evaluating candidate profiles' declared providers. Four other places state the opposite in absolute terms: "later profiles stay `shadowed` and **are not probed**" (DM-2, §10), "later profiles remain `shadowed` and are not probed" (AC-F3-2), "later profiles stay `shadowed` and unprobed" (DEC-8), "every later profile remains `shadowed` and is not probed" (TC-070). Those cannot both hold: eligibility of a later profile is unknown without probing its providers (the delivered `selectProfile` marks post-selection profiles `shadowed` *without* probing, which is what makes the current list stable). A coder reading DM-2/AC-F3-2/TC-070 literally must skip the candidate check and substitute into a profile that may itself be ineligible — or probe and fail the "not probed" assertion. `AC-F3-2` is therefore internally contradictory (failing `ac_quality` as well as this facet).
   Suggested remediation target phase: specification
   Suggested fix: state one rule in one place: the substitution search **does** evaluate candidate profiles' declared providers under the same memoized probe (one probe per distinct provider, as NFR-4 already allows), and no candidate verdict is written into the eligibility list — replacing "are not probed" with "are not re-verdicted in the list" (the wording `DM-2`/TC-068 already use for "inspected as a substitution candidate"). Then align `AC-F3-2`, `DEC-8` and TC-070 with that wording, and say explicitly whether candidate probing is bounded (e.g. declared order in full, first valid source wins).

3. [major] plan_doc_update_coverage — plan#phase 5 `scope.files`; spec#§22 / `DOD-8`
   Gap: the change makes `provider.profile.unavailable` reachable for a refusal in which a profile **is** eligible (the seat-level refusal), and `doc/spec/features/feature-dispatch-engine.md:87` defines that identity's cause as "the nomination when **every candidate is ineligible**, `provider.profile.unavailable`" (see also lines 92, 624, 885, which stay true only because they do not repeat the cause). After this change that parenthetical is false: a dispatch nomination can refuse at exit 2 with a selected, eligible profile whose seat no profile supplies — which is exactly what `AC-F4-1`, `TC-PROFILE-074`'s refusal-parity arm and `feature-provider-profiles.md:54` ("when no profile is eligible … otherwise `unavailable`") describe. The dispatch-engine page is in no phase's declared scope and is not named in §22, so phase 7 will leave a contradicted current-truth page, and `DOD-8` can still pass because its sweep enumerates only the three-check probe and the absolute `watch-stale` exclusion.
   Suggested remediation target phase: delivery_planning
   Suggested fix: add `doc/spec/features/feature-dispatch-engine.md` to plan phase 5's declared scope and to §22's page list, and extend `DOD-8`'s residual-gap sweep to include the refusal-cause wording (that `unavailable` projects both the all-candidates-ineligible refusal and the seat-level refusal). In the same pass, decide whether `feature-result-contract.md`'s static `provider.profile.unavailable` description ("No provider profile is eligible under the current conditions") and `feature-peak-pausing.md:38`'s "(all candidates ineligible)" are reconciled or explicitly judged still-generic.

4. [minor] test_traceability — test-plan#5.2 (no case); spec#`AC-F3-1` first trigger
   Gap: `AC-F3-1` triggers on an effective seat model that is "declared, set by a pacing rung …, or set by an agent override", and the spec now states the plain declared-seat arm is production-reachable. Only the rung (TC-066) and override (TC-067) arms have substitution cases; a **plain declared** seat model on a parked provider outside `providers` has no case (TC-094 exercises declared seats only with zero parks, at the AC-F3-3 boundary). Iteration-1 minor 8 is therefore closed on the spec side and open on the test side.
   Suggested remediation target phase: test_planning
   Suggested fix: add the declared-seat substitution arm to TC-066 (or as a fourth arm in the same file/case family) using `selection/fixtures.ts`, and list it in §3.1's AC-F3-1 row.

5. [minor] spec_completeness — spec#§17 `AC-F3-2`, §8.2 `EVT-1`/`EVT-2`
   Gap: the seat-level refusal's event set is unspecified. Every other refusal path emits a defined event (`profile.ineligible`), and `EVT-1`/`EVT-2` do not say what a seat-level refusal carries (the delivered `profile.selected` event, `profile.ineligible` with a non-eligibility meaning, or none). No case asserts it, so the choice is currently invisible — but it is also unconstrained, and `DOD-3` requires zero new event codes without saying which delivered event the arm reuses.
   Suggested remediation target phase: specification
   Suggested fix: one sentence in `AC-F3-2`/`EVT-2`: the seat-level refusal carries the delivered selection events unchanged (or carries no event), with no new code, condition or evidence key — then have TC-070/071 assert that event set.

6. [nit] cross_artifact_consistency — `doc/decisions/TDR-0075…` "Implementation Plan" step 1 vs. spec#§4.2 `NG-8`, §15 `DEC-7`
   Gap: the record instructs "retire DEC-7 and NG-8 in favour of the record", while the spec keeps both with new content (DEC-7 now records the TDR-0075 narrowing; NG-8 now forbids a *second* record). The instruction points at statement ids whose meaning changed, so a reader comparing the two artifacts sees a step that was not performed.
   Suggested remediation target phase: specification (authoring route: `@decision-advisor`)
   Suggested fix: either update the record's step to "cite this record from DEC-7 and bound the change to one record in NG-8" or reword the spec ids; do not retire either statement.

7. [nit] test_traceability — test-plan#5.2 `TC-PROFILE-071` **Preconditions**, bullet 2
   Gap: the committed-document enumeration reads "`TC-PROFILE-059`, `TC-PROFILE-060`, `TC-PROFILE-089`" and omits `TC-PROFILE-090`, while §1.2 GAP-T4 and §6 name all four.
   Suggested remediation target phase: test_planning
   Suggested fix: use the same four-id list everywhere the committed-policy scope is stated.

Persistent findings: none carried over from iteration 1 — findings 1–7 are CLOSED, 8–12 are CLOSED except
minor 8 (PARTIAL, re-raised as finding 4 with the test-side gap).

Plan validation: `bun packages/cli/bin/jaiship.ts plan validate GH-377` → `verdict=valid`,
`readyForDevelopment=true` (re-run after this review; no plan edit required by findings 1, 2, 4–7).

Remediation routing: `specification` (findings 2, 5, 6) → `@spec-writer`, with finding 6 routed to
`@decision-advisor`; `test_planning` (findings 1, 4, 7) → `@test-plan-writer`; `delivery_planning`
(finding 3) → `@plan-writer`. Delivery is not reopened, and no pause is required.
