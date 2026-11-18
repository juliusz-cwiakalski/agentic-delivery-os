# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-335
Date: 2026-11-17
Pause Required: no

## Facet Summary
- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: FAIL

## Scope of Review

Ticket source: GitHub issue #335 loaded directly (`gh issue view 335`) — M3-S1 "opencode v2.x harness and telemetry", with the delivery conventions block. Dependency question ticket #342 loaded directly; Q-06 (opencode version window) has zero comments, so its stated default applies. Artifacts reviewed: `chg-GH-335-spec.md` (23 ACs, DEC-1..7, RSK-1..8, OQ-1..3), `chg-GH-335-test-plan.md` (41 TCs, matrices M/V/T/C, GAP-1..6, OQ-4..9), `chg-GH-335-plan.yaml` (`delivery.plan.v1`, 8 phases, tier `full`, PM-recorded `plan validate` valid / `readyForDevelopment=true`), `chg-GH-335-pm-notes.yaml` (G1..G5, observed v2.2.5). No prior readiness records; this is iteration 1.

Planning truth read: `doc/planning/oss-tooling/milestones/m3/{README,architecture,contracts,test-scenarios,backlog,open-questions}.md`. Current truth read: `doc/spec/features/{feature-harness-adapters,feature-telemetry-v2,feature-state-layer,feature-spend,feature-config-layer,feature-result-contract,feature-dispatch-engine,feature-adapter-ports}.md`, `doc/spec/nonfunctional.md`, `doc/quality/test-specs/test-spec-dispatch-engine.md`, `.ai/agent/decision-instructions.md`, `.ai/rules/{typescript,testing-strategy}.md`, `doc/guides/{definition-of-ready,definition-of-done,decision-making}.md`.

Code verified read-only: `packages/core/src/contracts/{harness,harness-telemetry,error-table,result,dispatch}.ts`; `packages/core/src/domain/{harness-registry,harness-spawn-env,harness-telemetry,dispatch-attempts}.ts`; `packages/core/src/provider/profile-env-record.ts`; `packages/core/src/state/harness-telemetry.ts`; `packages/core/src/app/{dispatch,dispatch-ledger,dispatch-attempts}.ts`; `packages/core/src/config/{defaults,catalog,harness}.ts`; `packages/adapters/src/harness/{opencode,telemetry-opencode,telemetry-session-totals,sqlite-loader}.ts`; `packages/cli/src/{index,production}.ts`; `packages/cli/src/commands/{dispatch,spend}.ts`; `packages/testkit/src/conformance/harness.ts`; `scripts/checks/error-table-sync.ts`; `tests/structure/content-inventory.test.ts`; `tests/checks/decision-record.test.ts`; `tests/fixtures/harness/opencode-store/build.ts` and `stream/*.jsonl`.

Live ground truth established read-only:
- `opencode --version` prints **`opencode v2.2.5`** (product name + `v` prefix), not a bare semver.
- The installed v2.2.5 session store is `~/.local/share/opencode/opencode.db`. Schema only (no session content read): `session(id, project_id, parent_id, slug, directory, title, version, …, time_created, time_updated, agent, model, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write, metadata)`; `message(id, session_id, time_created, time_updated, data)`. There is **no** `work_item_ref` or `harness_version` column anywhere, and **no** per-message token/agent/model/cost columns.
- The delivered default `harness.stores.opencode.databasePath` is `.local/state/opencode/opencode.db`; `~/.local/state/opencode/opencode.db` does not exist.
- Installed binary strings expose only `OPENCODE_*` variables (`OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT`, `OPENCODE_CONFIG_DIR`, `OPENCODE_MODELS_PATH`, …). No `OC_*_AGENT_*_MODEL` family exists; per-agent models are selected through opencode's own config surface (`agent`/`mode`/`model`), which is reachable env-only via `OPENCODE_CONFIG_CONTENT`/`OPENCODE_CONFIG_DIR`.

Coverage arithmetic checked: 23 AC rows (F1×4, F2×4, F3×4, F4×1, F5×4, F6×2, F7×3, N1×1 = 23); 41 TCs (`TC-HARNESS-001..041`); plan TC→phase map 0+2+5+11+11+9+2+1 = 41 with each id assigned exactly once; AC→phase matrix covers all 23. GAP-1..GAP-6 and OQ-4..OQ-9 are declared with owners/defaults. Plan schema conformance spot-checked (tier/phases/scope/interactions/escalationTriggers/doneArtifacts); no `tasks` key, no progress log.

## Findings

1. [critical] cross_artifact_consistency — `chg-GH-335-spec.md`#8.4 + #12; `chg-GH-335-test-plan.md`#4.1 rule 5 + #4.5 T-01..T-14; `chg-GH-335-plan.yaml`#Phase 5 (5.1, 5.2, 5.6)
   Gap: the telemetry design is pinned against a store that the installed harness does not have. The delivered extractor queries `SELECT id, parent_id, work_item_ref, harness_version FROM session …` and reads token/cost columns from `message`; the observed v2.2.5 store has neither `work_item_ref` nor `harness_version`, and `message` carries only `id, session_id, time_created, time_updated, data`. The real per-session facts live on `session` (`agent`, `model`, `cost`, `tokens_*`, `time_created/time_updated`), and there is no work-item attribution column at all. The delivered default store path also points at an absent file (`~/.local/state/…` vs the real `~/.local/share/…`). No AC requires the configured path or the observed shape to be reconciled; the test plan's fixture builder encodes the synthetic `work_item_ref`/`harness_version`/per-message-token shape, so all 14 telemetry viaducts can be green while production lands zero rows (or masks the mismatch as `harness.telemetry.extraction-failed`, which AC-F6-2 would count as a pass). The ticket's "telemetry rows land with schema version and per-seat models" is therefore not provable as planned.
   Suggested remediation target phase: specification
   Suggested fix: record the observed v2.2.5 store path and schema as current truth (with the attribution and duration sources), add a criterion that a real in-window store yields rows, and define the outcome when the delivered extractor cannot read it. Test-plan fixtures must then be derived from the observed shape. Owner: @spec-writer (test-plan follow-up: @test-plan-writer).

2. [critical] spec_completeness — `chg-GH-335-spec.md`#5.1 F-6, #17 AC-F6-1/AC-F6-2, #4.2 NG-9, #10; `chg-GH-335-test-plan.md`#4.3 M-06/M-07, #5.2 TC-023/TC-024; `chg-GH-335-plan.yaml`#Phase 5 AC/TC coverage
   Gap: AC-F6-1/AC-F6-2 require a per-session telemetry **request** that returns `harness.telemetry.absent` at exit 1 and `harness.telemetry.extraction-failed` at exit 2. No such surface exists: `spend` is work-item scoped and uses the untouched `spend.telemetry-absent`; closeout capture is explicitly non-gating ("a failed capture writes no zero-valued record and changes no other closeout effect") and has no exit projection; no command reads a harness session's telemetry. NG-9 forbids a new CLI command surface, and §10 restates non-gating capture, so the ACs are unsatisfiable as written and no plan phase creates the surface. M-06/M-07 and TC-023/TC-024 assert exits from a path that cannot be invoked.
   Suggested remediation target phase: specification
   Suggested fix: redefine F-6 and AC-F6-1/2 against a reachable surface (for example a work-item-scoped closeout/read classification that is disclosed without changing the delivery exit, or an explicit extension of an existing read command), reconcile NG-9 and §10, and let the test plan follow. Owner: @spec-writer.

3. [critical] plan_code_area_coverage — `chg-GH-335-plan.yaml`#Phase 2 + #Phase 5 scope files; `packages/core/src/state/harness-telemetry.ts` (`payloadFor`, `appendHarnessTelemetry`)
   Gap: `payloadFor` is an explicit field allowlist and `appendHarnessTelemetry` persists through it. The new `seat`, `resolvedModel`, `observedModel`, and `durations` fields are declared in Phase 2 and produced in Phase 5, but `packages/core/src/state/harness-telemetry.ts` appears in **no** phase scope. The fields are therefore dropped before the state append, so AC-F5-1's landed rows cannot carry them; because the commit primitive stages only declared scope, the required edit cannot even be committed in the owning phase.
   Suggested remediation target phase: delivery_planning
   Suggested fix: declare `packages/core/src/state/harness-telemetry.ts` (payload projection + parse tolerance for the additive fields) in the owning telemetry phase and add its append/read round-trip to that phase's gate. Owner: @plan-writer.

4. [major] cross_artifact_consistency — `chg-GH-335-spec.md`#11 RSK-1, #14 OQ-2, #5.1 F-3/F-4; `chg-GH-335-test-plan.md`#1.2 GAP-2; `chg-GH-335-plan.yaml`#Phase 1 deliverable 1.4 ("no replan is required")
   Gap: the installed opencode v2.2.5 exposes no `OC_*_AGENT_*_MODEL` variable family; it selects per-agent models through its own config surface, which is reachable env-only via `OPENCODE_CONFIG_CONTENT`/`OPENCODE_CONFIG_DIR`. The spec's OQ-2 dichotomy omits that third route; the declared fallback (`envName`) is the same environment mechanism and cannot rescue a config-surface harness. Phase 1's permitted observations (version/help, read-only store, one per-spawn probe with no credential and no network) cannot observe model honouring, and the plan's "the plan's Phase 3/4 obligations already cover both outcomes, so no replan is required" is not true for the negative outcome: every required seat would be unrepresentable, every dispatch would refuse, and AC-F3-1 / the ticket AC "runs with the resolved profile" would be unmet. No escalation trigger covers this outcome.
   Suggested remediation target phase: specification
   Suggested fix: pin the propagation route to the observed surface (env-injected config document, or a named alternative), state the consequence if no env-only route exists, and require an explicit human/decision escalation before delivery; the plan must add a matching escalation trigger and name the actual observation surface. Owner: @spec-writer (plan follow-up: @plan-writer).

5. [major] plan_code_area_coverage — `chg-GH-335-spec.md`#8.2; `chg-GH-335-plan.yaml`#Phase 3 3.3/3.7, #Phase 4 4.3, OQ-4; `HarnessEnvironmentBuilder` signature; `packages/cli/src/production.ts` `buildHarnessEnvironment`
   Gap: the plan's OQ-4 resolution adds each seat's declared **name** to the descriptor, but the descriptor carries names only; the resolved **values** reach `buildHarnessSpawnEnvironment` through its `record` input. The builder signature is `(descriptor) => …` with no record parameter, and production's closure supplies only `{ DELIVERY_WORK_PATH: … }`. No phase says how the per-spawn record map is supplied (per-spawn builder factory, descriptor value carriage, or an additive builder parameter), so "per-spawn data, never process-global state" has no implementation seam. TC-015/TC-016 would drive the fix, but the plan's declared code areas do not.
   Suggested remediation target phase: delivery_planning
   Suggested fix: declare the per-spawn record-carrying seam (and its file) explicitly, and state whether the additive builder contract changes; if it does, the spec §8.2 record-map carriage must be restated. Owner: @plan-writer.

6. [major] plan_code_area_coverage — `chg-GH-335-plan.yaml`#Phase 7 7.1/7.4; `packages/core/src/contracts/result.ts` `CommandResultDetail`; `packages/cli/src/index.ts` `explicitDetail`
   Gap: Phase 7 puts the refusal disclosure on the envelope-root `detail` slot as `detail.harness`. That slot is a closed, two-member type (`holder`, `suiteBreadth`) whose own comment says "A future member is a declared addition with its own bound and test". `explicitDetail` copies only those two members. Adding `detail.harness` therefore requires `packages/core/src/contracts/result.ts` and `packages/cli/src/index.ts`, neither of which is in any phase scope, plus a governed extension of the TDR-0027 slot (bound + test + declaration). Without them the disclosure is silently dropped, so TC-040's refusal half and AC-F1-1/AC-F2-1's disclosure cannot land.
   Suggested remediation target phase: delivery_planning
   Suggested fix: declare both files and the slot's additive member (with its bound and projection test) in Phase 7, and schedule the TDR-0027 extension (or a new decision record) through @decision-advisor. Owner: @plan-writer (decision: @decision-advisor).

7. [major] cross_artifact_consistency — `chg-GH-335-spec.md`#8.2 version probe, #17 AC-F1-1; `chg-GH-335-test-plan.md`#4.4 V-01..V-09, #5.2 TC-001; `chg-GH-335-plan.yaml`#Phase 3 3.4, #Phase 4 4.3
   Gap: the real probe output is `opencode v2.2.5`, while every fixture and oracle uses bare `2.2.5`. The artifacts never pin the probe command/args, the accepted output grammar (product name and `v` prefix), the normalization, or whether `observedVersion` is the raw or normalized string. Under V-09 an unparseable string is `unknown`, so a literal implementation would refuse every dispatch with `harness.version.unknown`; under a naive strip, TC-001's `observedVersion === "2.2.5"` is the only pinned representation. In addition, no production code calls `resolveHarnessInstance` today and no production version probe exists, so the "evaluated once at harness resolution" gate has no declared owner.
   Suggested remediation target phase: specification
   Suggested fix: pin the probe invocation, the accepted output form, the normalization, and the observed-version representation; assign the production probe to a phase/code area. Extend the V-table with the real `opencode v2.2.5` output. Owner: @spec-writer (test-plan follow-up: @test-plan-writer).

8. [major] test_traceability — `chg-GH-335-test-plan.md`#4.2 rule 4, #5.2 TC-006; `HarnessVersionProbe = () => Promise<string>`
   Gap: TC-006's bound assertion ("advance the fake clock by 5 001 ms without a probe answer and assert the verdict is indeterminate, invocation count still 1") has no enforcement seam. The injected probe is a bare promise function; `resolveHarnessInstance` has no clock, timer, or deadline, and the spec's NFR-2 threshold is 5 s. As written the test can only prove that the injected double rejected—i.e. the double, not the gate—or it is unimplementable. NFR-2's wall-clock half is therefore not verifiable, and the GAP-3 "bounded work in CI" claim is not tied to an implementation point.
   Suggested remediation target phase: test_planning
   Suggested fix: pin the bound's enforcement (for example the probe receives a deadline and the production probe passes the runner's `timeout: 5000`; assert the deadline argument and a `timedOut` result → `unknown`), and make the oracle assert production behaviour rather than the double. Owner: @test-plan-writer (plan follow-up: @plan-writer).

9. [major] cross_artifact_consistency — `chg-GH-335-spec.md`#17 AC-N1-1, #4.1 metric row; `chg-GH-335-test-plan.md`#8.3 OQ-6, #5.2 TC-036 note
   Gap: AC-N1-1 says "no child process has been started", and the success metric says "before a child process starts", while §8.2/F-1/NFR-2 require one bounded version-probe child process per dispatch. The test plan's OQ-6 resolves the contradiction downstream ("no session-bearing child process"), and the plan adopts it, but the spec itself remains internally inconsistent: the AC is literally unsatisfiable as written. A reviewer applying AC-N1-1 verbatim must fail a passing implementation.
   Suggested remediation target phase: specification
   Suggested fix: amend AC-N1-1 and the metric to "no session-bearing child process; the single bounded probe is the declared exception", matching OQ-6. Owner: @spec-writer.

10. [major] dod_defined — `chg-GH-335-spec.md`#17 (and the document as a whole)
    Gap: the spec defines 23 ACs, success metrics, and a validation checklist, but no Definition of Done. The repository's DoD guide requires every change to define its own concrete, testable DoD in the spec, traceable to its ACs (the GH-303 spec's §17.3 checklist is the delivered shape), and `dod_defined` is a hard DoR facet. Phase 10 cannot verify "done" against a change-specific DoD that does not exist; the GAP-2/GAP-4 boundaries are also not expressed as DoD clauses.
    Suggested remediation target phase: specification
    Suggested fix: add a §17.x "Definition of Done" checklist, traceable clause-by-clause to the ACs, including the GAP-2 live-harness boundary and the GAP-4 human-gated record. Owner: @spec-writer.

11. [major] plan_coverage — `chg-GH-335-plan.yaml`#Phase 2 AC/TC coverage + gate, #Phase 1 1.5; `chg-GH-335-test-plan.md`#5.2 TC-010 step 4
    Gap: TC-010's binding oracle includes "`feature-harness-adapters.md` contains a link to the mode record" and the index row; the feature-spec link is a Phase-8 deliverable. The plan nonetheless owns TC-010 in Phase 2 and runs `bun test tests/checks/decision-record.test.ts` in Phase 1's and Phase 2's gates, so those gates cannot be green at their boundaries. Phase 1's deliverable 1.5 ("the harness feature spec link recorded (the link itself is reconciled in Phase 8)") is self-contradictory.
    Suggested remediation target phase: delivery_planning
    Suggested fix: split TC-010's assertions so the existence/equality halves land in Phases 1–2 and the link/index half lands with Phase 8, or move the link assertion to TC-041. Owner: @plan-writer.

12. [minor] plan_coverage — `chg-GH-335-plan.yaml`#Phase 2 scope files; `tests/structure/content-inventory.test.ts` + `tests/structure/inventory.json`
    Gap: Phase 2 adds exported value constants to `packages/core/src/contracts/harness.ts` and `harness-telemetry.ts`; the content-inventory test compares the exported value set against the committed `inventory.json`. Neither file is declared in Phase 2 (they first appear in Phase 3), so the aggregate gate is red at the Phase-2 commit and the "green at its own boundary" claim holds only for the hand-picked gate list.
    Suggested remediation target phase: delivery_planning
    Suggested fix: declare `tests/structure/inventory.json` (and the inventory test if it changes) in Phase 2, or move the new export additions to the phase that updates the inventory. Owner: @plan-writer.

13. [minor] test_traceability — `chg-GH-335-plan.yaml`#Phase 6 6.1/6.3; `chg-GH-335-test-plan.md`#4.6 C-05/C-08, #5.2 TC-033; `packages/testkit/src/conformance/harness.ts`
    Gap: TC-033 says each new scenario is "executed through the registry", but the registry has only `build(io, deps)` (a session port) and a coverage check; there is no scenario executor. The five new ids also cannot join the closed `HarnessConformanceScenarioId` union without splitting `HARNESS_CONFORMANCE_SCENARIOS`, whose exact six-id identity TC-031/AC-F7-1 pins. The plan says "declared on the SAME registry" but does not name the additive executor or the union split, so TC-033's "scenario actually proves the property" half has no executable surface.
    Suggested remediation target phase: delivery_planning
    Suggested fix: declare the additive scenario executor and the floor/extension constant split in Phase 6, and align TC-033's wording. Owner: @plan-writer (test-plan follow-up: @test-plan-writer).

14. [minor] plan_doc_update_coverage — `chg-GH-335-plan.yaml`#Phase 8 scope
    Gap: Phase 8 reconciles `feature-harness-adapters`, `feature-config-layer`, `feature-telemetry-v2`, `feature-dispatch-engine`, `nonfunctional`, planning markers, index, and the changeset, but omits `doc/spec/features/feature-state-layer.md` (documents the `harness.telemetry` payload fields and its idempotency key), `doc/spec/features/feature-adapter-ports.md` (the `HarnessInstance` and port-family summary), and `doc/quality/test-specs/test-spec-dispatch-engine.md` (the attempt projection and the additive envelope `detail`). Phase 7's reconciliation would have to correct pages the plan did not authorize.
    Suggested remediation target phase: delivery_planning
    Suggested fix: add the three pages (or declare them as conditional edits) to Phase 8's scope. Owner: @plan-writer.

15. [minor] decision_capture — `chg-GH-335-spec.md`#17 AC-F2-2; `chg-GH-335-test-plan.md`#5.2 TC-010; `chg-GH-335-pm-notes.yaml` `decisions: []`
    Gap: AC-F2-2 requires the mode record to be "linked from this change", but no TC asserts a change-artifact link and no phase schedules one; `pm-notes.decisions` stays empty. The plan also does not require `@decision-advisor` authoring / `@decision-critic` challenge or the R2 body (alternatives, assumptions, verification), so a decorative record can satisfy TC-010 while the change's decision trail remains empty.
    Suggested remediation target phase: delivery_planning
    Suggested fix: add the change-artifact link and pm-notes decision entries to Phase 1/8, require @decision-advisor authoring (with the R2 body), and assert the change-side link in TC-010. Owner: @plan-writer (test-plan follow-up: @test-plan-writer).

16. [minor] ac_quality — `chg-GH-335-spec.md`#17 AC-F1-4, #16 configuration row, #5.1 F-1, DEC-1
    Gap: AC-F1-4 asserts that "when no configurable value is present or a configured value cannot be honoured" the pinned default applies, but DEC-1 and §16 say no configurable window ships and the window is "not a key". No user-reachable trigger exists: the AC can only be exercised as a unit-level property of a function no configuration path calls, so it does not describe observable product behaviour.
    Suggested remediation target phase: specification
    Suggested fix: either drop AC-F1-4 to the reachable property ("the pinned window is the only acceptance point and no configuration path widens it") or declare the read-only/defaulting configuration key. Owner: @spec-writer.

17. [minor] system_spec_consistency — `chg-GH-335-spec.md`#2.1 (fourth bullet), #21
    Gap: §2.1 says `HarnessSessionPort` "carries spawn, deliver, resume, steer, collect, classify, liveness, and read-only session listing"; the delivered port has no `steer` member (the steering payload rides `deliver`/`resume`). §21 says "the harness command and store location remain configuration", but production hardcodes `command: "opencode"` and the store-path default is the wrong directory for the observed install. The change's context therefore misstates current truth in two places that matter to the propagation and telemetry findings above.
    Suggested remediation target phase: specification
    Suggested fix: correct the port-member list and the command/store configuration claim (or record the hardcoding as current truth to be addressed). Owner: @spec-writer.

18. [nit] cross_artifact_consistency — `chg-GH-335-plan.yaml`#DECLARED CONTROLS vs #Phase 6 scope/gate
    Gap: the plan lists `tests/behaviour/harness-output-bounds.test.ts` as "DECLARED CONTROLS, NOT EDITS … (Phase-8 gate only)", while Phase 6 declares it in scope, describes an update (6.8), and runs it in the Phase-6 gate. The control list and the phase scope contradict each other.
    Suggested remediation target phase: delivery_planning
    Suggested fix: remove the file from the declared-controls list or from Phase 6's update scope, and state which gate owns it. Owner: @plan-writer.

19. [nit] decision_capture — `chg-GH-335-spec.md`#14 OQ-3 vs `chg-GH-335-plan.yaml` OQ-8
    Gap: OQ-3 remains "Open" in the spec while the plan pins the degrade-versus-failed boundary (mandatory field set) and the test plan asserts it. The decision is recorded only in the lower artifacts, so the spec's open-question register and its decision log disagree at delivery.
    Suggested remediation target phase: specification
    Suggested fix: close OQ-3 in the spec with the pinned mandatory-field set (or reference the plan's OQ-8 resolution as the decision). Owner: @spec-writer.

## Verdict Rationale

No critical or major finding can be cleared by implementation alone: three are specification-level contradictions (the absent per-session telemetry surface, the internally conflicting AC-N1-1, and the missing Definition of Done), three are plan-coverage holes where the declared phases cannot produce the ACs (the dropped telemetry payload fields, the closed `detail` slot, the missing per-spawn record seam), and the remaining majors are cross-artifact inconsistencies against observed ground truth (the v2.2.5 store path/schema, the `opencode v2.2.5` probe output, the absent per-seat variable family, and the Phase-2/Phase-8 TC-010 conflict).

The strongest positive signal is that the artifacts are unusually honest about what they do not know: GAP-2 (live-harness propagation), GAP-3 (wall-clock bound), GAP-4 (human-gated record), GAP-6 (unobserved 2.1.x shape), and pm-notes G1–G5 all name boundaries. The problem is that several of those boundaries are understated. The observed v2.2.5 store and the observed absence of the `OC_*_AGENT_*_MODEL` family are not hypothetical risks; they are the current environment, and the test plan's synthetic fixtures plus the `envName` fallback would hide both. The plan's Phase 1 spike is the right instrument, but it must be re-scoped to the real observation surface (the harness's config surface and `OPENCODE_CONFIG_CONTENT`/`OPENCODE_CONFIG_DIR`) and the spec must state the consequence of a negative outcome before delivery starts.

Delivery must not start. Reopen `specification` for findings 1, 2, 4, 7, 9, 10, 16, 17, 19 (and the spec half of 1), then `test_planning` for findings 8, 13, and the test-plan follow-ups, then `delivery_planning` for findings 3, 5, 6, 11, 12, 14, 15, 18. Re-run this gate after the authors revise; a second iteration should confirm the observed store/probe/version facts are now recorded as current truth rather than inferred from fixtures.
