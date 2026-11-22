# Readiness Review Iteration 3

Verdict: READY
Work Item: GH-377
Date: 2026-11-22
Pause Required: no

Scope read: ticket `juliusz-cwiakalski/agentic-delivery-os#377` (body + the owner-authored
implementation-pointer comment of 2026-11-22, re-read this iteration), `chg-GH-377-spec.md` v1.2,
`chg-GH-377-test-plan.md` v1.2 (39 cases, `TC-PROFILE-059..097`), `chg-GH-377-plan.yaml` (5 phases),
`chg-GH-377-pm-notes.yaml`, `readiness-review/readiness-iter-1.md`, `readiness-iter-2.md`,
`doc/decisions/TDR-0075-watch-stale-as-profile-eligibility-blocker.md`,
`doc/spec/features/{feature-provider-profiles,feature-provider-engine,feature-peak-pausing,feature-dispatch-engine,feature-result-contract}.md`,
`doc/guides/provider-conditions-and-parks.md`, and the delivered surfaces the revision leans on:
`packages/cli/src/commands/provider.ts` (`profile-resolve` projection), `packages/cli/src/edge.ts`
(`profileResolve` handler order), `packages/core/src/provider/{profile,profile-lifecycle}.ts`,
`packages/core/src/contracts/provider-profile.ts`, and the delivered control
`TC-POL-NOM-002` in `tests/behaviour/provider-policy-adoption.test.ts`.

## Facet Summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Disposition of iteration-2 findings

| # | Finding (short) | Disposition | Evidence |
|---|---|---|---|
| 1 | TC-071 pinned an `error` envelope with absent `data` | **CLOSED** | TC-071 Expected Outcome now requires exit 2, `data` present and `error` absent, `data.outcome === "refused"`, `data.code === "provider.profile.unavailable"`, `data.summary` naming seat + parked provider within the profile caps, `data.eligibility` the unchanged selection-time list (selected `eligible`, later `shadowed`, no blocker, no flip), `data.events` empty of every profile code with any selection-time event discarded, no `data-v1` record on any stream, and a byte-identical state-key set with an unchanged target record. Verified against the delivered projection: `packages/cli/src/commands/provider.ts:474-487` returns the `data` envelope with `{outcome, code, summary, eligibility, events}` for exactly this identity, and `exitProjection` (`:368`) maps it to `platform-provider` (exit 2); the delivered control `TC-POL-NOM-002` (`provider-policy-adoption.test.ts:1543-1550`) asserts `exitCode === 2`, `data.outcome === "refused"`, `data.code`. Spec §8.5 names the same surface once ("never an `error` envelope and its `data` is never absent"), so spec, test and delivered code now agree. |
| 2 | "Not probed" asserted absolutely against a substitution search that must probe | **CLOSED** | One two-level rule, qualified everywhere it appears: F-3 ("not probed during selection" / "probing their declared providers through the same memoized probe" / "Candidate verdicts are **not** written into the eligibility list … the search is bounded by declared order and stops at the first valid source"), DM-2, §10, AC-F3-2 ("later profiles remain `shadowed` (not probed during selection; the substitution search inspects candidates separately and writes no candidate verdict into the list)"), DEC-8, §6 Flow 3, §23 glossary, Appendix D, TC-070 ("the selection pass never probed the later profiles … inspected candidates separately … without writing a candidate verdict") and test-plan §3.1/§6. AC-F3-2's Given now states the *outcome* of inspection ("no later profile is a valid supplier after substitution inspection — each … is ineligible under the same probe, does not declare that seat, or declares it only on a capability-inadequate model") instead of asserting unprobed later profiles as a premise. A repo-wide grep for `not probed`/`unprobed` in spec + test plan returns only selection-qualified statements (see observation 1 for the plan's summary). |
| 3 | Phase-5 scope and DOD-8 missed the refusal-cause pages | **CLOSED** | Plan phase 5 declares `feature-dispatch-engine.md` and `feature-result-contract.md` (plus profiles, engine, peak-pausing, the guide, TDR-0075 and the index), and its summary names "the refusal-cause wording on the dispatch-engine and result-contract pages". Spec §22 adds the dedicated "refusal-cause wording needs a second pass" bullet and names all five spec pages; §16 adds explicit rows for dispatch-engine ("becomes incomplete … states that the identity covers both …"), result-contract and peak-pausing. DOD-8's sweep now includes "an all-candidates-ineligible-only reading of `provider.profile.unavailable` (the identity covers both …)". The three contradicted delivered statements are real and in scope: `feature-dispatch-engine.md:87` ("the nomination when every candidate is ineligible"), `feature-result-contract.md:156` ("No provider profile is eligible under the current conditions."), `feature-peak-pausing.md:38` ("(all candidates ineligible)"). |
| 4 | No plain declared-seat substitution arm | **CLOSED** | TC-066 is now four arms over `selection/fixtures.ts`: plain declared-seat on a recorded-unavailable provider outside `providers` (labelled production-reachable per F-3 "Reach"), the rung arm with supplied `evaluatePacing` output, a stale-observation variant over both, and a no-park control arm; §3.1's AC-F3-1 row and the index title name the declared-seat arm; TC-067 keeps the override arm and both cases state that each reach path is owned exactly once. |
| 5 | Seat-level refusal's event set unspecified | **CLOSED** | EVT-2, §10, AC-F3-2 and DEC-8 all state the same rule: no `profile.selected`, no `profile.ineligible`, no `profile.switched`/`profile.reverted`/`profile.rung-changed`, any selection-time event computed before the seat check is not emitted, the refusal envelope is the only evidence, no new code/condition/evidence key. TC-070 asserts the absence with a recording sink; TC-071 asserts `data.events` empty plus an empty event sink. Feasible against the delivered shapes: `resolveProfileForSpawn` (`provider.ts:476-524`) already builds refusals as `{code, summary, eligibility, events}`, so the new arm returns an empty `events` without touching the envelope type. |
| 6 | TDR-0075 said "retire DEC-7/NG-8" | **CLOSED** | TDR-0075 «Implementation Plan» step 1 now reads "cite this record from DEC-7 and bound the change to one record in NG-8; do not retire either statement", matching spec NG-8 ("bounded to one decision record … Both statements stay in force") and DEC-7 ("cites TDR-0075 as the governing record"). |
| 7 | TC-071's committed-policy list omitted `TC-PROFILE-090` | **CLOSED** | TC-071 precondition and §1.2 `GAP-T4` both use the four ids `TC-PROFILE-059`, `060`, `089`, `090`. |

Persistent findings: none. No finding from iterations 1–2 remains open, and none is re-raised.

## Findings (blocking)

None.

## Residual observations (non-blocking; recorded so they are not lost)

1. [nit] cross_artifact_consistency — `chg-GH-377-plan.yaml` phase 2 `summary`
   Gap: the summary still reads "the eligibility list is carried through unchanged, with … later profiles still
   shadowed and **unprobed**". It is the only absolute "unprobed" phrasing left in the artifact set, and it sits in
   the phase that implements the substitution search. It does not gate: the same sentence instructs the substitution
   to take the seat "from the next **eligible** profile … when a provider is not recorded-unavailable and satisfies
   the required capability", which requires candidate eligibility to be evaluated; the normative statements (F-3,
   DM-2, §10, AC-F3-1/2, DEC-8) are all selection-qualified; and TC-066/068/070 fail if a candidate is skipped or
   re-verdicted, so the behaviour cannot drift on this wording.
   Suggested remediation target phase: delivery_planning (fold into the next plan touch, no reopen required)
   Suggested fix: replace "later profiles still shadowed and unprobed" with "later profiles still shadowed and not
   re-verdicted in the list".

2. [minor] test_traceability — test-plan#5.2 `TC-PROFILE-071` (**Expected Outcome**, last bullet)
   Gap: "Zero park, announcement and target writes: the state store's key set is byte-identical before and after" is
   true for the case's natural fixture, but the precondition does not pin the property that makes it true. In the
   delivered edge handler the profile-target record is evaluated and persisted *before* `resolveProfileForSpawn`
   (`edge.ts`: `evaluateProfileLifecycle` → `persistProfileTarget` → seat resolution), and `persistProfileTarget`
   appends whenever `targetProfile` **or** `reason` differs from the last record. So a fixture whose selected profile
   is not the chain base (a switch) appends a `provider.profile-target` record before the seat check, and the arm
   fails for a reason unrelated to the seat refusal. With `preferenceChain.base` selected and no prior target,
   `evaluateProfileLifecycle` returns `append: false` and the arm passes unmodified. Related spec silence: NFR-2
   permits "the delivered profile-target persistence **on change**", which is exactly the case TC-071's blanket
   "zero target writes" would forbid; AC-F3-2/§10 say the refusal envelope is the only evidence but never say whether
   a refused spawn advances the persisted target.
   Suggested remediation target phase: test_planning (one clause), optionally a one-sentence spec clarification
   Suggested fix: pin the property in the precondition — "the selected profile is the chain base and no
   `provider.profile-target` record exists, so the delivered lifecycle appends nothing" — or, if a changed-selection
   refusal is meant to be covered, have §10 state that a seat-level refusal leaves the target record at its prior
   value. Either reading is cheap; neither changes the specified user-visible behaviour for the shipped fixture.

## Positive re-verification (not to be re-litigated)

- `bun packages/cli/bin/jaiship.ts plan validate GH-377` → `verdict=valid`, `artifact=yaml`, `tier=full`,
  `readyForDevelopment=true`.
- Ownership arithmetic is exact and unchanged: 39 plan-owned TC identifiers, 39 test-plan case headings, each
  identifier exactly once, set difference empty both ways; phase 1 = 059–065, 087, 088, 091, 095–097
  (13); phase 2 = 066–070, 092–094 (8); phase 3 = 071–075, 089, 090 (7); phase 4 = 076–086 (11); phase 5 declares
  documentation only. Delivered maximum remains `TC-PROFILE-058`, so the namespace continues.
- Phase-scope ↔ test-plan §7 reconciliation holds for every case, including the two arms added this revision
  (TC-066 on `tests/behaviour/provider-profile-selection.test.ts` + `selection/fixtures.ts`, both phase 2;
  TC-071 on `tests/behaviour/provider-profile-edge-wiring.test.ts` + the injected fixture, phase 3).
- Plan phase 5 is `kind: planning` (lease-free, mapped to `delivery_planning`), so it cannot block the delivery
  boundary, and its declared file set equals the §22/DOD-8 page set exactly (profiles, engine, dispatch-engine,
  result-contract, peak-pausing, guide, TDR-0075, `00-index.md`).
- Ticket traceability still holds after the revision: body ACs → AC-F1-1/AC-F1-2/AC-F1-3/AC-F5-1/AC-F6-1/AC-F7-1;
  required behaviours 1–4 → F-1/F-2, F-3, F-4, F-5; the comment's five proof items → AC-F1-1, AC-F1-2, AC-F5-1,
  AC-F6-1, AC-F7-1; the comment's constraints (no policy edit, no operator-local requirement, GH-366 out of scope,
  PR against `main-tools`, no pre-emptive TDR) are each represented in §4.2/§18/§22.
- The revision's own claims are checkable and true: spec v1.2 history names findings 2, 3, 5, 6 and the spec side of
  4; test-plan v1.2 history names findings 1, 4, 5, 7 and keeps 39 cases; pm-notes carries the iteration-2 gate
  record and retro.
- Cost model vs the new search: NFR-4/AC-NFR1-1 bound the resolution at one park-fold read per resolution and one
  probe per distinct provider per pass, and F-3 state the substitution search reuses the same memoized probe and stops
  at the first valid source, so the candidate search adds no probe for an already-evaluated provider and no per-seat
  re-read; TC-087 pins the fold-read count, the memoization and the three-call-site census.

## Remediation routing

None. Delivery is not reopened, no artifact phase is reopened, and no human input is required. The two residual
observations are advisory: observation 1 belongs to the plan-writer's next plan touch, observation 2 to the
test-plan-writer (or a one-line spec clarification) if the case is revisited; both are within normal delivery/review
handling and neither blocks `dor_check`.
