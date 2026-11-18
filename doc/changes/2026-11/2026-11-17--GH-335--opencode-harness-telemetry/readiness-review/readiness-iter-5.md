# Readiness Review Iteration 5

Verdict: NOT_READY
Work Item: GH-335
Date: 2026-11-18
Pause Required: no (every blocker is artifact-remediable; no new human decision is needed)

## Facet Summary

PASS = no critical/major gap (minor findings are listed and must be fixed before the PR).
FAIL = at least one critical/major gap.

- spec_completeness: PASS — every ticket requirement and the DEC-15 boundary are stated; 27 ACs; no requirement dropped
- ac_quality: PASS — 27 clear, testable, non-overlapping criteria; AC-F5-7 has its own AC/NFR links and AC-F5-1 is restated around it
- plan_coverage: PASS — 47/47 TCs, 27/27 ACs, 0 unassigned, 0 double-assigned; every phase gate path resolves at its owning phase (minor finding 5)
- test_traceability: PASS — 27/27 ACs map to TCs in §3.1 and the plan's AC matrix; TC-HARNESS-047 carries AC-F5-7 (minors 2, 4; nit 10)
- cross_artifact_consistency: FAIL — finding 1 (major), findings 2 and 6
- decision_capture: FAIL — finding 1: DEC-16 lives only in the change spec's decision log; the system-level record for that exact adapter contract (TDR-0036) was not amended and still describes one carrier
- system_spec_consistency: PASS — re-verified against `feature-harness-adapters`, `feature-result-contract`, `feature-dispatch-engine`, `feature-session-database-admin`, `feature-closeout`, `feature-capsule`, `feature-spend`, `config/*`, `contracts/*`, `app/dispatch*`, `state/harness-telemetry`, `cli/src/{production,edge}.ts`
- plan_doc_update_coverage: PASS — `feature-closeout.md` is now in Phase 8 scope beside `feature-session-database-admin.md`; all affected `doc/spec/**` and quality pages are declared
- plan_code_area_coverage: PASS — all 8 phases declare files (and fixture folders where used); every created path is inside declared scope; no phase requires a port-input member it cannot add
- dod_defined: PASS — 13 clauses, AC-F5-7 non-deferrable, live observation deferral rule intact (nit 7)

## Scope of Review

Re-critiqued from scratch. Iterations 1–4 and the pm-notes remediation notes were treated as claims to test. Every "what changed since iteration 4" claim was re-derived from the artifacts and then checked against the repository and the live harness.

Artifacts: `chg-GH-335-spec.md` (v1.4, 27 ACs, DEC-1..DEC-16), `chg-GH-335-test-plan.md` (rev 1.6, 47 TCs, §3.1/§4.1–§4.6/§5.1/§5.2/§11.9), `chg-GH-335-plan.yaml` (8 phases, 47/47 TCs, 27/27 ACs, 25 escalation triggers), `chg-GH-335-pm-notes.yaml`, `readiness-review/readiness-iter-{1..4}.md`, `doc/decisions/TDR-0036-*.md`, `doc/decisions/TDR-0037-*.md`.

Ground truth re-established read-only (not trusted from the artifacts):

- **Ticket and default.** `gh issue view 335` — title "M3-S1: opencode v2.x harness and telemetry (M3)", OPEN, milestone M3, labels `change`/`planning`/`human-input-needed`; headline AC "dispatch through the installed harness port runs with the resolved profile". `gh issue view 342` — Q-06 default verbatim: "current minor line at delivery time, plus one previous minor; unsupported versions refuse with a typed error".
- **Installed harness.** `opencode --version` → `opencode v2.3.2`, exit 0; both installs on `PATH` (`/tmp/ados-standalone-bin/opencode`, nvm-global) resolve to it. `opencode run --help` still exposes `--agent string` and `--model, -m string` (both single-valued), `--format`, `--session`, `--fork`, `--title`, `--worktree`, `--archived`.
- **Store (live, read-only).** `session_v2` carries `version, agent, model, cost, tokens_input/output/reasoning/cache_read/cache_write, time_created/updated`; `session_message` shape unchanged; `session_part` 0 rows; 30 tables. Version mix: `2.2.5` 5241, `1.19.0` 4380, `1.19.3` 3006, **`2.3.2` 64**; nulls `agent` 23, `model` 503, `version` 0 over 12 691 rows. DM-10's shape survives the upgrade; only the counts drift, exactly as Appendix C states.
- **Seams.** `contracts/harness.ts:268/275` — `HarnessSpawnInput = {workItemRef, prompt, descriptor}`, `HarnessResumeInput = {handle, prompt, descriptor?}`: no agent member today, so Phase 2 is the phase that must add it. `HarnessTelemetryRecord` keeps non-null `agent: string` and `model: string`; `HARNESS_WARNING_REASONS` already contains `optional-field-absent` and `invalid-session-identity`.
- **Blueprint.** `m3/test-scenarios.md` TC-M3-HARNESS-001/002 match test plan §3.1 verbatim.
- **Pinned docs.** `feature-closeout.md:212` still states the work-item-root attribution Phase 5 replaces (now in Phase 8 scope); `feature-harness-adapters.md:332` carries the sibling sentence and is in scope.
- **Arithmetic re-derived independently.** 47 detail headings = 47 index rows = 47 plan-map ids (the six extra occurrences in the plan map are the deviation notes, not double assignment); phase counts `0+2+6+10+15+10+2+2 = 47`; 27 spec AC rows = 27 test-plan rows = 27 plan-matrix nodes. All 129 gate path tokens across the 8 gates either exist today or are declared in that phase or an earlier one.
- **Validators.** `jaiship plan validate GH-335` → `verdict=valid`, `tier=full`, `readyForDevelopment=true`; `jaiship lint plan GH-335` → `verdict=valid`, 0 errors.
- **Privacy invariant.** `bun run scripts/checks/privacy-literals.ts` → 0 violations across 4 627 files, exit 0.
- **Id hygiene.** `doc/decisions/00-index.md` rows TDR-0030..0033; TDR-0031 is GH-293's engine-first record; TDR-0036/0033 are `Proposed`, `decision_date: null`, R2; `grep TDR-0031` outside `readiness-review/` hits only GH-293's own references, the two explicit "unrelated" notes and the renumbering record.

## Findings

1. [major] cross_artifact_consistency / decision_capture — `doc/decisions/TDR-0036-harness-seat-spawn-cardinality-and-seat-resolution.md`#Decision 2 "Seat resolution" and #Implementation Plan step 1; `chg-GH-335-spec.md`#15 DEC-13/DEC-16, #5.1 F-3 "Carrier", #8.3 DM-4; `chg-GH-335-plan.yaml`#Phase 2.1, #Phase 3.3, #Phase 4.3; `chg-GH-335-pm-notes.yaml`#notes[40]
   Gap: the carrier is fixed in the spec, the plan and the test plan, but the decision record that governs the same adapter contract still describes **one** carrier. TDR-0036 Decision 2 says the resolution input "is supplied per spawn **as data on the binding**", and Implementation step 1 says the binding "rides the spawn/resume input as optional data" — i.e. the caller supplies a binding that already carries the agent (and, per the record's own decision statement, the resolved seat). Under DEC-16, DM-4, Phase 2.1 and Phase 4.3 the agent identity is its own additive optional input member, the composition passes it to `resolveBinding(profile, selection, agent)`, and the `binding` member is that call's **return value** on a sibling member. As written the record has nothing to resolve and no production call site — the vacuity class iteration 4's finding 1 named, one layer down. The record contains no reference to DEC-16; Amendments A-1..A-3 address the role-less case, the refusal channel and field literals, not the carrier. DEC-13 says the seat rule "follow[s] TDR-0036", so the change ships a system-level decision that contradicts the implementation of its own headline criterion, and Phase 1.9's independent review would be reviewing that record.
   Suggested remediation target phase: specification (delegate authoring to `@decision-advisor` via `@pm`; one cross-reference sentence in Phase 2.1 afterwards)
   Suggested fix: add TDR-0036 Amendment A-4 (2026-11-18) citing DEC-16 and correcting Decision 2 and Implementation step 1: the caller supplies the agent identity on its **own** additive optional input member; the composition calls the pure resolver once per spawn with that value and the resolved profile; the sibling `binding` member carries the returned single-seat binding. Keep the binding's three facts and the "never an empty string, never inferred" rule. Then have Phase 2.1 cite A-4 beside DEC-16.

2. [minor] test_traceability / cross_artifact_consistency — `chg-GH-335-test-plan.md`#5.2 TC-HARNESS-011 binding oracle; `chg-GH-335-plan.yaml`#Phase 3.3, #Phase 3.7 (fixtures), #escalation trigger "an empty string read as `no-agent`"; `chg-GH-335-spec.md`#5.1 F-3 "Resolution input and outcomes"
   Gap: TC-011's oracle asserts "an empty-string agent is refused as the `no-agent` state rather than resolved". Every other artifact defines `no-agent` as the member's **absence only** ("never an empty string"), the plan's escalation trigger lists "an empty string read as `no-agent`" as a violation, and the empty-string outcome is otherwise undefined (Phase 3.7 deliberately encodes no `""` fixture). A coder cannot satisfy the oracle and the rule at once: either the empty string becomes `no-agent` (the prohibited mapping) or it is a named-agent value with an unspecified outcome.
   Suggested remediation target phase: test_planning
   Suggested fix: delete the clause, or state one intended outcome explicitly (e.g. a present empty string is not the no-agent state; it resolves/refuses through the three declared outcomes like any other agent name), declare its identity if it refuses, and add the fixture case if it is to be asserted.

3. [minor] cross_artifact_consistency — `chg-GH-335-test-plan.md`#5.2 TC-HARNESS-047 type pin in the binding oracle; `chg-GH-335-plan.yaml`#Phase 2.2
   Gap: the oracle says "the marker is the only added optional member" on `HarnessTelemetryRecord`. Phase 2.2 adds **four** additive optional members — `seat`, `resolvedModel`, `durations`, `absentObservedAxes`. The step's "in this area" qualifier is dropped from the oracle, so the assertion as written is unsatisfiable beside the phase it validates.
   Suggested remediation target phase: test_planning
   Suggested fix: say "the only added optional **observed-identity** member" (no `observedModel`/`agentRole`), or enumerate the four additions and pin the marker's uniqueness within the identity facts.

4. [minor] plan_coverage — `chg-GH-335-plan.yaml`#Phase 2.1 "PHASE RULE — NO LATER PHASE ADDS A CONTRACT MEMBER"; `chg-GH-335-plan.yaml`#Phase 5.6, #Phase 7 scope (`packages/core/src/contracts/dispatch.ts`)
   Gap: the rule forbids a later phase from adding "a member to `HarnessSpawnInput`, `HarnessResumeInput`, or **any other `packages/core/src/contracts/*.ts` type**", then the next sentence permits Phases 5 and 7 to add members to the dispatch attempt record — which lives in `packages/core/src/contracts/dispatch.ts`. Read literally the rule deadlocks Phases 5/7, and reopening Phase 2 cannot cure it because Phase 2 does not scope `contracts/dispatch.ts`.
   Suggested remediation target phase: delivery_planning
   Suggested fix: scope the rule to the port input types (`HarnessSpawnInput`/`HarnessResumeInput`), and state that the additive attempt-record members Phases 5 and 7 add in their own declared scope are permitted and are not port-input contract members.

5. [minor] plan_coverage — `chg-GH-335-plan.yaml`#TC -> PHASE MAP deviation for TC-HARNESS-011, #Phase 5 gate; `chg-GH-335-test-plan.md`#5.2 TC-011 "Target Layer / Location", #7 row "011, 015"
   Gap: TC-011 is owned by Phase 5 as "complete", but its complete suite set is `harness-profile-propagation.test.ts` (Phase 4's gate) **plus** `harness-telemetry-seat-attribution.test.ts`. Phase 5's gate runs only the latter, while Phase 5 edits `production.ts`, the adapter and the extraction path. The plan's own ownership rule ("the phase that first makes its COMPLETE suite set green") is therefore not enforced at Phase 5.
   Suggested remediation target phase: delivery_planning
   Suggested fix: add `bun test tests/behaviour/harness-profile-propagation.test.ts` to Phase 5's gate and its "suites left green" list, or state explicitly that the argv half is not re-run at Phase 5 and why that is safe after the `production.ts` edits.

6. [minor] cross_artifact_consistency — `chg-GH-335-plan.yaml`#Phase 5.1 (agent-divergence parenthetical); `chg-GH-335-spec.md`#5.1 F-5, #8.3 DM-5, #17 AC-F5-3/AC-F5-7; `chg-GH-335-test-plan.md`#5.2 TC-HARNESS-047
   Gap: Phase 5.1 requires "the agent-divergence warning — the unstated case included" for any group whose observed agent is not the binding's agent. F-5/DM-5/AC-F5-3 define agent divergence as `binding agent ≠ observed agent` **with both values kept**; for an unstated axis there is no observed value to keep, and AC-F5-7 prescribes the absence marker plus `optional-field-absent` for exactly that case (TC-047 asserts those and does not assert divergence). Warning divergence for an unstated agent states a comparison the store cannot support — a second classification of the same absence.
   Suggested remediation target phase: delivery_planning
   Suggested fix: make the unstated observed agent the absence classification only (null seat + `unresolved-seat` + the same-axis `optional-field-absent`), and reserve `agent-divergence` for a stated-but-different observed agent.

7. [nit] dod_defined — `chg-GH-335-spec.md`#17.2 clause 6
   Gap: "fails when a second **call site** of the probe seam appears" still blurs construction and invocation. The enforcing case (TC-HARNESS-046) pins one construction site and one invocation site and requires a mutant that adds only a second **reference** not to fail the construction count.
   Suggested remediation target phase: specification
   Suggested fix: say "a second construction site", matching TC-046 and Phase 6.10.

8. [nit] cross_artifact_consistency — `chg-GH-335-spec.md`#1 PURPOSE
   Gap: "a dispatch either runs with the resolved profile or refuses with a typed identity" is the one unqualified propagation sentence left. Under DEC-15 the shipped `dispatch` supplies no agent, binds nothing and is disclosed `unresolved-seat`; it neither runs a resolved profile nor refuses.
   Suggested remediation target phase: specification
   Suggested fix: qualify it to the harness port (e.g. "a dispatch that supplies an agent at the harness port runs its resolved profile; every refusal is a typed identity").

9. [nit] cross_artifact_consistency — `chg-GH-335-spec.md`#24 Appendix C (`SELECT version …` and the null-model rows)
   Gap: the delivery pass records `2.3.2` "52 at the review observation and 53 at re-observation" and "484 → 502 null models"; the live store at this review reads `2.3.2` **64** and nulls **23 / 503** over 12 691 rows. The spec frames every count as an observation of one moment, so this is not a false premise — but the precise "re-observation" figure is stale on the page a reader will check.
   Suggested remediation target phase: specification
   Suggested fix: drop the re-observation figure or restate it as "~50 at the delivery pass and growing" per the drift note; keep the 23-null-agent / ~500-null-model order of magnitude.

10. [nit] test_traceability — `chg-GH-335-test-plan.md`#11.5 item 1
    Gap: "Re-cut the TC→phase map for 47 TCs (the plan currently maps 41)" — the plan maps 47/47. Stale handoff text in a section that is otherwise a historical consequence list.
    Suggested remediation target phase: test_planning
    Suggested fix: update or mark the parenthetical historical.

## Iteration-4 findings: resolution status

1. (major, the caller's agent identity has no declared carrier; two artifacts name different resolvers) **PARTIAL — spec/plan/test-plan resolved; the decision record is not.** Verified: Phase 2.1 declares BOTH additive optional input members on `HarnessSpawnInput`/`HarnessResumeInput` in one commit, states the no-later-phase rule, and `contracts/harness.ts` is in Phase 2's scope (so the phase can commit what it declares). Phase 3.3 fixes `resolveBinding(profile, selection, agent)` as a pure function taking the caller-supplied value and names the composition as its only production caller. Phase 4.3 reads the member, calls the resolver once per spawn, and supplies its return on the sibling `binding` member. TC-011 step 2 and its oracle now assert the resolver's recorded `{agent, profile}` input and identity with its return value ("a binding the fixture constructed fails"); TC-015 steps 1/4/5 contrast member-present vs member-absent against the *same* single-seat fixture. So TC-011/015 can now fail if the composition does not read the member. What survives is TDR-0036's single-carrier sentence (new finding 1) plus the empty-string clause in TC-011's oracle (finding 2).
2. (major, no oracle for the observed-axis absence; AC-F5-1 unsatisfiable) **RESOLVED.** AC-F5-7 exists with the five obligations and its own AC/NFR links; AC-F5-1 is restated to satisfy an unstated axis through the marker; §4.1's telemetry metric names the unstated agent and the null-seat consequence; DM-10's field rows carry the marker/placeholder/warning on both axes; §4.5 gained T-17 and T-07 covers the unstated group; TC-028 step 3/oracle excludes the two identity axes and points at 047; TC-047 asserts the landed row, single-axis marker, declared placeholder, same-axis `optional-field-absent`, no `invalid-session-identity`, no nullable widening (`agent`/`model` still `string`), the null seat with `unresolved-seat`, an unusable-identity control, and a complete control. Phase 5.1/5.5/5.10 restate the same obligations, `payloadFor` must persist the marker and the placeholder uncoerced, and the new suite is in Phase 5's gate and file list. Verified against `HarnessTelemetryRecord` (non-null `agent`/`model`) and `HARNESS_WARNING_REASONS`. Residual: the plan's divergence parenthetical (finding 6) and TC-047's type pin (finding 3).
3. (major, the pinned window no longer contains the installed harness) **RESOLVED.** Every artifact now states the rule and its value at delivery (`2.3.x` + `2.2.x`), keeps `2.2.x`/`2.2.5` in window, and marks `2.1.x`/`2.1.7` as the out-of-window case (spec F-1/DEC-1/RSK-2/§12/§13/AC-F1-5/DoD clause 5/glossary/Appendix A–C; test-plan V-01..V-19, M-01, TC-002/004/005/040/042/045; plan 2.1/8.12). Appendix C records the intake and delivery passes separately and states the DM-10 shape survives the upgrade. Verified live: installed `2.3.2`, store `session_v2` columns unchanged, 30 tables, `2.3.2` rows present. DoD clause 4 / AC-F5-6 / TC-045 now name `v2.3.2`. Residual: stale point-in-time counts (nit 9).
4. (minor, `feature-closeout.md` omitted from doc scope) **RESOLVED.** It is in Phase 8's file list, and Phase 8.8 states the union attribution, the counted unattributed attempt, the empty-union `skipped-gap` and the sorted-union checkpoint cap. Verified `feature-closeout.md:212` is the stale sentence.
5. (nit, oracles asserted role names as fields) **RESOLVED.** TC-019/021 oracles assert `agent === "reviewer"` / `model === "synthetic/model-a"` with the role name as a gloss, and §4.5's preamble states no `agentRole`/`observedModel` member is added. `agentRole`/`observedModel` now appear only as explicit negations.
6. (nit, construction vs invocation mixed) **PARTIAL.** TC-HARNESS-046 pins one construction site and one invocation site, requires the mutant to add a **construction**, and requires a second **reference** not to fail; Phase 6.10 matches. The spec's DoD clause 6 still says "second call site" (nit 7).
7. (nit, stale null-count literal in the plan) **RESOLVED in the plan** — it now states "tens of null agents and ~500 null models and grows … (484 at intake, 502 at delivery; the figures are observations, not fixture constants)". The spec's Appendix C still records precise point-in-time figures that have drifted (nit 9).
8. (nit, empty `decisions` in pm-notes) **STILL SCHEDULED.** `decisions: []` as reviewed; Phase 1.7 requires exactly one entry per record (`id`, `path`, `status`). Structurally compatible with the pm-notes contract; verifiable only after Phase 1. Not blocking.
9. (nit, Appendix A blueprint mapping) **RESOLVED.** The mapping now states two delivered blueprint refusals, the absence-inside-the-envelope taxonomy (DEC-10), two identities added, and the "four delivered, three mapped two-for-two plus one replaced" count.
10. (nit, adjudication (k)) **RESOLVED.** The corrected (k) is recorded; Phase 5.6 states "THE DAEMON LANE CLAIMS NO SEAT"; Phase 7 names the daemon producer's assertions.

## PM adjudications (pm-notes): validation

No new adjudications were issued for iteration 5; the iteration-4 remediation is artifact-side and is validated above. The 2026-11-18 adjudications (l)–(o) still hold: (l) one additive marker + placeholder rather than nullable fields is implemented as AC-F5-7 without touching DEC-4; (m) the `invalid-session-identity` supersession and bounded-ledger truncation are stated and now tested; (n) the union cap is `CAPSULE_MAX_SESSIONS = 64` (verified in `contracts/capsule.ts` and `domain/closeout.ts`); (o) readiness history keeps the id it reviewed (verified by grep).

## Delivery-blocking risks

- **The shipped decision record contradicts the implemented carrier** (finding 1). TDR-0036 is committed on this branch, `Proposed`, and Phase 1 stages it as the change's decision. Its Decision 2 tells a reader the caller supplies the agent "on the binding", which removes the resolution input the whole change is built to prove. The spec, plan and test plan are internally correct, so delivery would not necessarily produce wrong code — but the change would merge with a self-contradictory decision trail on its headline criterion, and the independent decision review in Phase 1 would be validating the contradiction.
- **Oracle precision at the `no-agent` boundary** (finding 2). One binding oracle and the plan's own escalation trigger disagree about an empty-string agent; whichever way a coder implements it, one of them is red.
- **Two minor coverage/consistency seams** (findings 4–6) that a coder can resolve locally but that would otherwise surface as a Phase 5 gate miss or a spurious red.

Environmental note (not a DoR finding): the last recorded full `pnpm check` after the sync merge (pm-notes note 39) stopped at the `test` stage with four failures, one genuine (absolute home paths in the spec, since redacted) and three load-sensitive timeouts. The privacy-literal invariant is green at this review (0 violations, 4 627 files), but the aggregate gate has not been recorded green end to end. That is a `@runner`/quality-gate matter for Phase 8, not an artifact gap; it should be re-run before the PR.

## Verdict Rationale

The iteration-4 remediation is substantial and lands in every claim-bearing place. The window re-derivation is coherent: the rule (current minor at delivery plus one previous) is stated once, its value at delivery (`2.3.x` + `2.2.x`) contains the installed `v2.3.2` I verified on this host, `2.2.5` remains an in-window real line, and `2.1.x` is the out-of-window case in every matrix row I checked — no artifact still treats `2.1.x` as acceptable or `2.2.x` as the current line. The carrier gap is genuinely closed in the spec, the plan and the test plan: both members are declared in the one phase that can commit them, the resolver has a named production caller, and TC-011/TC-015 now fail if the composition does not read the caller's value rather than asserting a fixture-built binding. AC-F5-7 is complete and consistent with AC-F5-1, DM-5/DM-10, the absence taxonomy and the delivered non-null fields, with no duplicate value member. Phase feasibility holds: 47 TCs, 27 ACs, 8 phases, every gate path resolving at its owning phase, every created file inside declared scope, and no phase requiring a port-input member it cannot add. The arithmetic is clean, both validators are green, and id hygiene after the TDR-0031→0033 renumber is sound.

What blocks delivery is one artifact in the family this gate has failed on four times: a premise stated as true that the settled design does not support. The system-level decision record for the seat/adapter contract still describes a single carrier — the caller supplies the agent on the binding — while the change implements two distinct input members with the binding as the resolver's output. That is not a wording preference; it re-opens the vacuity on the record a human accepts at PR review and that DEC-13 points to as the authority. It is artifact-remediable without a new human decision: one dated amendment to TDR-0036 citing DEC-16, plus the small oracle/precision fixes above.

Delivery must not start. Reopen `specification` for finding 1 (decision-record authoring via `@decision-advisor`) and the two wording nits, `test_planning` for findings 2, 3 and 10, and `delivery_planning` for findings 4, 5 and 6. A sixth iteration should confirm exactly three things: TDR-0036 states the two distinct members and cites DEC-16; the empty-string and marker-only-member oracles are satisfiable beside the rules they test; and Phase 5's gate runs the complete suite set it claims.
