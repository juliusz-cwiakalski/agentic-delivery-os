# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-335
Date: 2026-11-18
Pause Required: no

## Facet Summary

PASS = no critical/major gap (minor findings are still listed and must be fixed before the PR).
FAIL = at least one critical/major gap.

- spec_completeness: FAIL — C1
- ac_quality: FAIL — C1
- plan_coverage: FAIL — M1, M2
- test_traceability: FAIL — C2
- cross_artifact_consistency: FAIL — C1, C2 (+ m5, n1)
- decision_capture: PASS (TDR-0031 recorded; two Phase-1 records + pm-notes `decisions` scheduled)
- system_spec_consistency: PASS (+ m4)
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL — C3, M3
- dod_defined: PASS (+ m1, m3)

## Scope of Review

Re-critiqued from scratch; iteration 1 treated as history only.

Artifacts: `chg-GH-335-spec.md` (v1.1, 26 ACs, DEC-1..12, §17.2 DoD, Appendix C), `chg-GH-335-test-plan.md` (v1.2, 45 TCs, matrices M/V/T/C, §4.1a, §4.4a, GAP-1..7, OQ-4..12, §11 change log + erratum 1.2), `chg-GH-335-plan.yaml` (8 phases, tier full, `plan validate`/`lint plan` reported valid by PM), `chg-GH-335-pm-notes.yaml`, `readiness-review/readiness-iter-1.md`, `doc/decisions/TDR-0031-harness-dispatch-outcome-envelope-detail.md`.

Ground truth re-established read-only (not trusted from the artifacts):

- `opencode --version` → `opencode v2.2.5`, exit 0 (product token + `v` + bare semver).
- `opencode` on `PATH` is `/tmp/ados-standalone-bin/opencode`, a **98-byte** bash wrapper: `exec <node>/opencode --standalone "$@"`. Confirmed. (Through it, `opencode debug paths` fails with `Unrecognized flag: --standalone`; `session --help`, `debug agents` and `--version` work.)
- Store `~/.local/share/opencode/opencode.db` (11.6 GB, WAL). 24 tables; both generations exist: `session`(+`message`,`part`) and `session_v2`(+`session_message`,`session_part`). `session_v2(id,parent_id,version,agent,model,cost,tokens_input/output/reasoning/cache_read/cache_write,time_created,time_updated,…)`; `session_message(id,session_id,type,seq,time_created,time_updated,data)`; `session_part` **0 rows**; legacy `part` has **no** `tool` column; `message` has only `data`. **No** `work_item_ref`, **no** `harness_version` column anywhere.
- `SELECT version,count(*) FROM session_v2 GROUP BY version` → `2.2.5` 5 115; `1.19.0` 4 380; `1.19.3` 3 006. `agent` null 23; `model` null 486. `model` is a JSON object (`{"id":…,"providerID":…,"variant":…}`). `session_message` types: assistant 409 676, user, system, idle, synthetic, `agent-switched` 873, `model-switched` 37.
- `opencode run --help`: `--agent string`, `--model string` (format `provider/model#variant`), `--format`, `--session`; `--standalone` and `--server` are global flags also available on `run`. `service`, `serve`, `api`, `acp`, `session` subcommands all present.
- `opencode debug agents` returns per-agent model resolutions (each agent resolves its own model through the harness configuration).
- `strings` on the binary: no `OC_<PREFIX>_AGENT_<SEAT>_MODEL` family. The literal strings `OC_` (31×) and `_AGENT_` (43×) do appear, but only inside `BYOC_`, `ALLOC_`, `RELOC_`, `MALLOC_`, `PROC_`, `CLAUDE_AGENT_*`, `CCR_AGENT_*`, `USER_AGENT*` — see n1.
- Code read: `contracts/result.ts` (`CommandResultDetail` = `holder | suiteBreadth` only), `cli/src/index.ts` `explicitDetail` (copies only those two), `contracts/harness.ts` (`HARNESS_FAILURE_CODES` 9 codes, `HarnessVersionProbe` not there, `HarnessEnvironmentBuilder = (descriptor) => …`), `domain/harness-registry.ts` (`HarnessVersionProbe = () => Promise<string>`; no production caller), `contracts/closeout.ts` `CloseoutTelemetryRuntime.extract({workItemRef,runId})`, `domain/closeout.ts:1650-1665` (the extract call site), `cli/src/edge.ts:2093-2110` (extractor bridge), `cli/src/production.ts:1516-1570` (builder closure supplies only `{DELIVERY_WORK_PATH}`; `command:"opencode"` hardcoded; `spawnArgs:["run","--format","json"]`), `core/src/state/harness-telemetry.ts` `payloadFor` allowlist, `adapters/src/harness/telemetry-opencode.ts` (`work_item_ref`/`harness_version` SQL, per-message token columns), `testkit/src/conformance/harness.ts` (flat `HARNESS_CONFORMANCE_SCENARIOS`, no executor), `config/defaults.ts` (`stores.opencode.databasePath = ".local/state/opencode/opencode.db"`), `config/catalog.ts` (an `environment` origin layer exists), `app/dispatch.ts` (pre-session refusals exist before `claimLease`; attempt record appended before spawn).
- Coverage arithmetic re-derived: 45 unique TC ids present in both test plan and plan, no orphans either way; 26 ACs in spec/test-plan/plan with a 26-row §3.1 matrix; phase map `0+2+6+11+13+9+2+2 = 45`.
- Every `bun run scripts/checks/*.ts` and `bun test tests/…` gate path in the plan checked for existence; two exceptions are findings M1/M2.

## Findings

1. [critical] spec_completeness — `chg-GH-335-spec.md`#4.1 metric row, #5.1 F-3, #6 Flow 2, #17 AC-F3-1, #8.3 DM-8; `chg-GH-335-test-plan.md`#3.1 TC-M3-HARNESS-001 table
   Gap: the change never defines which seat a spawn is bound to, while requiring N seats to be expressed. The observed honoured surface is single-valued (`opencode run --help`: `--agent string`, `--model string`), a `session_v2` row stores exactly one `agent` and one `model`, and the only surface that can carry N agents' models in one session is the configuration document (`opencode debug agents` resolves each agent's model from it). But §4.1's metric says "every spawn carries its seat's resolved binding … zero seats unattributed", DM-8/AC-F5-5 attribute a delivery by "the run's session identity" (singular), and F-3 says the *per-seat* binding is expressed "for opencode, the per-invocation selection". With one spawn per delivery (the store, DM-8 and AC-F5-5 all assume one held session) only one seat's model can reach the harness, so "runs with the resolved profile" (ticket AC) and Appendix B's "the session reports the resolved per-seat models" are undecidable as specified. New: an iteration-1 finding (behaviour under the wrong variable family) is fixed, but the replacement carrier reproduces the same class of gap at N>1.
   Suggested remediation target phase: specification
   Suggested fix: decide and state the seat rule — either one spawn is bound to one named seat (with the selection rule and what happens to the other seats' resolved models) or the multi-seat half is carried by the configuration document (`OPENCODE_CONFIG_CONTENT`/`OPENCODE_CONFIG_DIR`, which is already described as available), with DEC-8 updated and the Phase-1 adapters-contract record following. Restate the §4.1 metric and DM-8 to match, and re-verify that the answer still satisfies the ticket AC and Appendix B.

2. [critical] test_traceability — `chg-GH-335-test-plan.md`#5.2 TC-HARNESS-011 (preconditions, step 3, binding oracle), #3.1 pinned-scenario table
   Gap: the TC that carries pinned scenario TC-M3-HARNESS-001 asserts a spawn whose recorded argv contains "3 `--agent` and 3 `--model` pairs" for a three-seat profile while `session-spawn seam calls === 1`, and asserts 3 seat-attributed rows with observed models equal to resolved (3/3). Neither the CLI (single-valued flags) nor the store (one `agent`/`model` per session row) supports it. Because the oracle reads a *recording double's* argv, the test can be green while production sends a repeated single-valued flag — the exact vacuity class this plan's §4.2 contract exists to prevent, and the same shape as iteration-1 finding 1 (fixtures encode a shape reality does not have).
   Suggested remediation target phase: test_planning
   Suggested fix: re-cut TC-011 to one bound seat per spawn (named by the seat rule that finding 1 must pin) with N spawns if the profile is exercised per seat, or move the multi-seat assertion onto the configuration-document variant; drop the "3 `--agent` pairs on one invocation" oracle and the `calls === 1` pairing that contradicts it. Keep the "no `OC_*` variable is invented" half unchanged.

3. [critical] plan_code_area_coverage — `chg-GH-335-plan.yaml`#Phase 5 (5.1, 5.5, 5.6, 5.8, 5.10) vs `packages/core/src/contracts/closeout.ts:423-429`, `packages/core/src/domain/closeout.ts:1658-1661`, `packages/cli/src/edge.ts:2093-2110`, `tests/fixtures/harness/golden/{regenerate.ts,telemetry.json}`, `tests/checks/capsule-latency.test.ts:86-103`, `tests/behaviour/closeout-composition-facts.test.ts:92`
   Gap: AC-F5-5's attribution key (the session identity the dispatch holds) cannot reach extraction within the declared scope. The capture port is `CloseoutTelemetryRuntime.extract({workItemRef, runId})` (`contracts/closeout.ts`), whose only production call site is `captureTelemetry` in `domain/closeout.ts`, bridged to the adapter by `closeoutHarnessExtractor` in `cli/src/edge.ts`. None of the three is declared in any phase. The store rebuild also breaks undeclared delivered artifacts: `tests/fixtures/harness/golden/telemetry.json` is produced from `buildOpencodeStore()` + `extract({workItemRef,runId})` by `golden/regenerate.ts`, and `tests/checks/harness-determinism.test.ts` recomputes it — the plan asserts the regenerator "compile[s] unchanged" and never declares either file; `tests/checks/capsule-latency.test.ts` calls `extract({workItemRef,runId})` and throws on zero records; `tests/behaviour/closeout-composition-facts.test.ts` passes the builder's synthetic `workItemRef` option. Consequences: Phase 5's commit cannot stage the edits it needs, `pnpm typecheck` and the determinism/golden tests cannot be green at the Phase-5 boundary, and the plan's own escalation trigger ("a semantic assertion change in a delivered suite this plan does not declare") fires inside the phase. This is the same failure mode as iteration-1 finding 3, one seam further along.
   Suggested remediation target phase: delivery_planning
   Suggested fix: declare `packages/core/src/contracts/closeout.ts`, `packages/core/src/domain/closeout.ts`, `packages/cli/src/edge.ts`, `tests/fixtures/harness/golden/regenerate.ts`, `tests/fixtures/harness/golden/telemetry.json`, `tests/checks/capsule-latency.test.ts` and `tests/behaviour/closeout-composition-facts.test.ts` in Phase 5, stating what changes in each (port input, held-identity resolution, golden regeneration, latency-suite session seeding, and the retirement of the builder's `workItemRef` option). Add the golden regeneration and `capsule-latency` to the Phase-5 gate.

4. [major] plan_coverage — `chg-GH-335-plan.yaml`#Phase 4 scope/gate vs #Phase 7 7.5
   Gap: Phase 7.5 says `tests/behaviour/dispatch-harness-verdict-mode.test.ts` is "created in Phase 4 with the refusal half, completed here", but Phase 4's `scope.files` and gate omit the file; it is declared only in Phase 7. Either the sentence is wrong or Phase 4 cannot stage the file it claims to create — and Phase 4's "suites left green" list is then incomplete. PM adjudication (a) rests on this split, so the adjudication as recorded is not supported by the plan's own scope declarations.
   Suggested remediation target phase: delivery_planning
   Suggested fix: declare the file in Phase 4's scope (and gate) if it is created there, or delete the "created in Phase 4" claim and state that the whole case lands in Phase 7, as TDR-0031's file table already says.

5. [major] plan_coverage — `chg-GH-335-plan.yaml`#Phase 7 gate and "Suites left green" list vs `tests/structure/dispatch-contract.test.ts`
   Gap: the Phase-7 gate runs `bun test tests/structure/dispatch-contract.test.ts` and lists "dispatch-contract" among the suites left green, but no such file exists in the repository and none is declared as a new file in any phase (only `tests/types/dispatch-contract.type-test.ts` exists). The Phase-7 gate cannot be green as written.
   Suggested remediation target phase: delivery_planning
   Suggested fix: replace it with the suites that actually pin the dispatch contract (`tests/structure/dispatch-attempts-taxonomy.test.ts`, `dispatch-attempts-composition.test.ts`, plus the two `dispatch-attempts-*` structure suites) or declare the new file.

6. [major] plan_code_area_coverage — `chg-GH-335-test-plan.md`#8.3 OQ-11; `chg-GH-335-spec.md`#17 AC-F3-4; `chg-GH-335-plan.yaml`#Phase 3 3.3, #Phase 4 4.3
   Gap: AC-F3-4's second half ("or that the harness does not recognise") has no production source. OQ-11's default says the recognised-model catalogue is "injected read-only data read from the harness's own declared agent/model configuration at resolution", but no phase, file or code area declares that supplier, and the only observed way to read it is a second harness invocation (`opencode debug agents`, verified working) — which would be a second pre-refusal child process and would collide with AC-N1-1/NFR-1's "the single bounded version probe is the declared exception" and TC-HARNESS-036's `probe calls <= 1`. As scoped, that half is reachable only from tests, which is the ac_quality defect iteration 1 flagged for AC-F1-4.
   Suggested remediation target phase: delivery_planning
   Suggested fix: name the production supplier (for example a read of the harness configuration document through the injected configuration layer — no child process), declare the file in Phase 3/4, and state that no additional pre-refusal child process is introduced; if no such source is available, narrow AC-F3-4 to the expressibility half and record the reduction.

7. [minor] dod_defined — `chg-GH-335-spec.md`#17.2 (clause 6)
   Gap: "Exactly one production probe point exists — the dispatch path's harness resolution — and no other production path probes the harness" has no verification among the 45 TCs. TC-HARNESS-006 asserts one invocation per dispatch; nothing asserts that no *other* production path probes. A second probe added later would pass every declared oracle and still defeat the clause.
   Suggested remediation target phase: specification
   Suggested fix: attach the clause to a concrete check (for example a structure test pinning the probe's only construction site) or drop the second half.

8. [minor] plan_coverage — `chg-GH-335-spec.md`#17.2 (clause 10); `chg-GH-335-plan.yaml`#Phase 1
   Gap: the DoD requires the two records to be "independently reviewed" and says "a record that is authored but unreviewed leaves this clause open", but no phase schedules a review or challenge activity (no `@decision-critic`/`@reviewer` step, no artifact recording the review) and no TC asserts it. Phase 10 can never close clause 10 as written, and the plan's Phase-1 deliverables stop at authoring plus index rows.
   Suggested remediation target phase: delivery_planning
   Suggested fix: schedule the independent challenge (a `@decision-critic` run or an explicit reviewer verdict recorded in the change folder) as a Phase-1/Phase-8 deliverable, or soften the clause to "authored, linked and `Proposed` pending the PR decision", which is what DEC-7 and TDR-0031 actually require.

9. [minor] dod_defined — `chg-GH-335-spec.md`#17.2 (clauses 1 and 4)
   Gap: clause 1 lets any acceptance criterion be "explicitly deferred under the live-observation clause below", and clause 4 lets the deferral be recorded with only "its reason and boundary". AC-F5-6 and the ticket's headline AC ("runs with the resolved profile") can therefore be unmet while the change is declared done, with no acceptance beyond a self-recorded reason.
   Suggested remediation target phase: specification
   Suggested fix: require the deferral to be accepted and recorded by the human/PM (and named in the change's evidence), not merely self-recorded, and state explicitly which claim the change may make when it is deferred.

10. [minor] system_spec_consistency — `chg-GH-335-spec.md`#21 (last bullet)
    Gap: "the opencode adapter's binary name and store defaults are adapter-local, not a tooling-contract branding surface" is not current truth: the binary name is hardcoded in `packages/cli/src/production.ts` (`command: "opencode"`), and the store default lives in `packages/core/src/config/defaults.ts` (`stores.opencode.databasePath`). Iteration-1 finding 17's §2.1 half is fixed (the `steer`/port-member list now matches the delivered port); this half is not.
    Suggested remediation target phase: specification
    Suggested fix: state where the binary name and the store default actually live today and that this change moves the path default (Phase 5.7) but not the name, or record the hardcoding as current truth to be addressed.

11. [minor] cross_artifact_consistency — `chg-GH-335-spec.md`#10 (second bullet) vs `doc/decisions/TDR-0031…#Decision 4` and `chg-GH-335-plan.yaml`#Phase 7 7.2
    Gap: §10 says "Every dispatch discloses the evaluated version verdict … and the selected mode as part of its recorded outcome", but a pre-session refusal appends no attempt record (delivered contract, restated in plan 7.2 and TDR decision 4), so there is no recorded outcome on that path — the envelope is the only home. A reviewer reading §10 verbatim would expect a record on refusal.
    Suggested remediation target phase: specification
    Suggested fix: add "on the refusal path the disclosure rides the failure envelope's `detail.harness`" to §10, matching TDR-0031's one-fact-one-home rule.

12. [nit] cross_artifact_consistency — `chg-GH-335-spec.md` Appendix C.1 (rows 2, 9)
    Gap: two evidence claims are false as literally written. (a) "Zero `OC_*` tokens and zero `*_AGENT_*MODEL` names" — a literal scan finds 31 `OC_` and 43 `_AGENT_` substrings (`BYOC_`, `ALLOC_`, `RELOC_`, `CLAUDE_AGENT_*`, `CCR_AGENT_*`, …); the conclusion (no per-seat model variable family) is correct, but the sentence invites a false positive. (b) "`opencode debug paths` → data/state/db" — that only holds for the real binary; through the `PATH` wrapper the subcommand aborts with `Unrecognized flag: --standalone`.
    Suggested remediation target phase: specification
    Suggested fix: phrase (a) as "no `OC_<PREFIX>_AGENT_<SEAT>_MODEL` family; no `_AGENT_*MODEL` environment name exists", and note in (b) that the subcommand was read from the installed binary while the `PATH` entry is the 98-byte `--standalone` wrapper.

## Iteration-1 findings: resolution status

1. (critical, store shape) **RESOLVED.** §2.1/§8.3/Appendix C record the observed two-generation store; DM-10 + §4.1a drive the fixtures; zero-row is now a failure criterion (AC-F5-1, TC-019 + `zero-row-as-pass` mutant). Re-verified against the live store.
2. (critical, AC-F6-1/2 surface) **RESOLVED.** DEC-10, rewritten ACs, `harness.telemetry.absent` explicitly absent everywhere (M-06/M-07, TC-023/024/044), four identities not five.
3. (critical, state payload allowlist) **RESOLVED** for `packages/core/src/state/harness-telemetry.ts` (Phase 5.5 + round-trip claim)… but the same class recurs one seam earlier — see new finding 3.
4. (major, `OC_*` family / "no replan") **RESOLVED.** OQ-2 closed as observed, DEC-8 surface-mapped, Phase-1 spike narrowed to a read-only confirmation, "no replan" replaced by an escalation trigger (plan `escalationTriggers[0]`, spec §18).
5. (major, per-spawn record seam) **RESOLVED.** Phase 2.1 additive builder context, Phase 4.3 per-spawn record map, Phase 3.3 keeps `harness-spawn-env.ts` unchanged.
6. (major, closed `detail` slot) **RESOLVED.** TDR-0031 recorded (R2, Proposed); Phase 2 declares contract, edge projection, validator, fixture, key-set, type/struct pins and the documented sentence; Phase 7 proves behaviour. Verified the delivered slot is exactly `holder|suiteBreadth` and `explicitDetail` copies only those.
7. (major, probe grammar/normalization/owner) **RESOLVED.** DEC-11, AC-F1-5, §8.2 row, grammar constant in Phase 2, parser in Phase 3, production probe point in Phase 4; V-01..V-19 includes the real `opencode v2.2.5`.
8. (major, TC-006 bound unprovable) **RESOLVED.** §4.4a seam + OQ-10 + Phase 2/3/4; the delivered one-shot runner already exposes `timeout`, so the wiring is real.
9. (major, AC-N1-1 self-contradiction) **RESOLVED.** AC-N1-1 and the metric amended to "no session-bearing child; the single bounded probe is the declared exception"; OQ-6 closed.
10. (major, no DoD) **RESOLVED.** §17.2 with 13 clauses, §17.1 traceability, plan Phase 8/phase 10. Two verifiability gaps remain (findings 7, 9).
11. (major, TC-010 vs Phase 8 link) **RESOLVED.** TC-010 is content-only, TC-041 owns the link; Phase 2 gate is green-capable.
12. (minor, `inventory.json`) **RESOLVED.** Declared in Phases 2–7.
13. (minor, conformance executor / union split) **RESOLVED.** §4.6 C-06/C-09/C-10, plan 6.1–6.4, TC-033.
14. (minor, missing doc pages) **RESOLVED.** Phase 8 adds state-layer, adapter-ports, test-spec-dispatch-engine, session-database-admin.
15. (minor, AC-F2-2 link / empty decisions) **RESOLVED.** Phase 1 spike-evidence record + pm-notes `decisions` entries + R2 body assertions + TC-041. Note: `pm-notes.decisions` is still `[]` today (the trail lives in `notes`), which Phase 1 fixes.
16. (minor, AC-F1-4 unreachable trigger) **RESOLVED.** AC-F1-4 rewritten; TC-005 asserts the config key set plus two-direction temp-copy mutants.
17. (minor, §2.1 port list and §21 claim) **PARTIALLY RESOLVED.** §2.1 fixed; §21 still misstates where the binary name and store default live — see finding 10.
18. (nit, declared controls vs Phase 6) **RESOLVED.** `harness-output-bounds.test.ts` is Phase 6's owned update and no longer a never-edited control (plan header 349-351).
19. (nit, OQ-3 open vs plan OQ-8) **RESOLVED.** OQ-3 closed with the pinned mandatory set (DEC-9); test plan OQ-6/OQ-8 agree.

## PM adjudications (pm-notes, 2026-11-18)

- (a) TDR-0031 declared in Phase 2 with behaviour split 4/7 — **challenged.** The Phase-2 half is right (declaration, projection, pins, validator, fixture, doc sentence in one commit, matching TDR C-6). But the "behaviour file spans Phases 4 and 7" half is unsupported: Phase 4 neither declares nor gates `dispatch-harness-verdict-mode.test.ts` (finding 4). TDR-0031's own file table already puts the behaviour proof in Phase 7, so the plan should adopt that reading.
- (b) `feature-dispatch-engine.md` in Phase 2 with the declaration — **accepted.** TDR-0031 requires the documented member sentence in the delivering commit; the page is declared in Phase 2 and again in Phase 8 for reconciliation. No contradiction.
- (c) Test-plan erratum superseding "unchanged suites" — **accepted.** Erratum 1.2 removes the contradiction; all four opencode-store suites are declared owned updates in Phase 5. Verified they exist and are declared.
- (d) AC-F2-2's change-side link resting on Phase-1 spike evidence + pm-notes — **accepted**, with the note that nothing in the change currently records the link (files are created in Phase 1), so AC-F2-2 is unassessable until then; the plan's `decisions` entries are the right instrument.
- (e) pm-notes authored by PM, not the coder — **accepted** (repo convention; the phase only needs the file in staging scope).
- (f) Store-override layer left as a Phase-5 obligation through the configuration environment source — **accepted in principle.** `config/catalog.ts` already has an `environment` origin layer, so an env-sourced store path is implementable without an ambient read in core. It must name the harness's override variable and the config path, otherwise the implementer guesses.
- (g) TC-011/TC-042 ownership by "the phase that first makes the suite green" — **accepted for TC-042, rejected for TC-011.** TC-011's oracle is wrong as written (finding 2), so its ownership is not a mere scheduling question.

## New delivery-blocking risks

- **Seat propagation cannot be delivered as specified** (findings 1–2). This is the ticket's headline AC and the pinned blueprint scenario; it must be re-decided in the spec before Phase 4 starts, or delivery will produce a green suite that asserts an invocation shape the installed harness cannot accept.
- **Attribution has no path from the dispatch to the extractor inside the declared scope** (finding 3). Without the plan amendment, Phase 5 either lands rows attributed by a work-item query that no longer exists (zero rows, "extraction failed") or the coder edits undeclared files and breaks the commit primitive's staging contract.

## Verdict Rationale

Iteration 1 was answered thoroughly. The store, probe, propagation-surface, DoD, decision-record and traceability gaps are closed with evidence that survives independent verification: the two-generation store, the absent work-item/harness-version columns, the `opencode v2.2.5` output, the 98-byte `--standalone` wrapper and the absent per-seat variable family all check out against the live host, and the artifacts now derive from them rather than from fixtures.

What blocks delivery is what the revision's own new design surface introduced. Choosing the per-invocation carrier fixed the "inert variable family" problem for exactly one seat, and the artifacts never closed the gap between "per-seat binding" (plural, ticket level) and "one `--agent`/`--model` per invocation" (observed, single-valued); the test plan then wrote an oracle (three flag pairs on one spawn) that only a recording double can satisfy. Separately, moving attribution to the held session identity reaches three undeclared production files and four undeclared test/golden artifacts, so Phase 5 cannot be committed green as scoped.

Delivery must not start. Reopen `specification` for findings 1, 7, 9, 10, 11, 12 (and the spec half of 3 if the seat rule changes the carrier), then `test_planning` for finding 2, then `delivery_planning` for findings 3, 4, 5, 6, 8. A third iteration should confirm three things: the seat rule is stated once and matches the observed single-valued surface, TC-HARNESS-011's oracle asserts only what the harness accepts, and Phase 5 declares every file its attribution change touches (including the goldens and `capsule-latency`).
