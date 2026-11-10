# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-280
Date: 2026-11-10
Pause Required: no

## Facet Summary
- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: FAIL
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Verification Method

Read in full: `chg-GH-280-spec.md`, `chg-GH-280-test-plan.md`, `chg-GH-280-plan.yaml`,
`chg-GH-280-pm-notes.yaml`; ticket GH-280 (`gh issue view 280`); current truth
`feature-autonomous-delivery.md`, `feature-scheduling-engine.md`,
`feature-status-digest.md`, `feature-doctor.md`, `feature-result-contract.md`,
`feature-config-layer.md`, `feature-resident-daemon.md`,
`delivery-modes.md`, `zai-peak-hours-hook.md`.

Verified against code: `packages/core/src/contracts/{queue,queue-ready,status,doctor,error-table}.ts`,
`packages/core/src/domain/{queue-readiness,queue-precedence,queue-lease,queue-lanes,status,doctor}.ts`,
`packages/core/src/app/{queue,dispatch,daemon-supervision}.ts`,
`packages/cli/src/{edge,production,daemon-compose,daemon-main,entrypoint}.ts`,
`packages/cli/src/commands/{queue,status,doctor}.ts`, `packages/mcp/src/serve.ts`,
`packages/cli/src/help/prompt-required-commands.ts`, `packages/cli/bin/delivery-os.ts`,
`scripts/{install,uninstall,deliver-ticket,ceo-loop}.sh`, `scripts/hooks/pre-opencode-iteration-zai.sh`,
`scripts/run-bash-suites.sh`, `tests/structure/{queue-scheduling-contract,status-contract,doctor-contract,provider-surface}.ts`,
`tests/fixtures/queue/vocabulary/closed-sets.json`, `.changeset/config.json`.

`delivery-os plan validate GH-280` → `verdict=valid`, `tier=full`,
`readyForDevelopment=true`.

## Findings

1. [critical] system_spec_consistency — `chg-GH-280-spec.md` §2.1 line 76, DM-9 (line 383), A-2 (line 448), RSK-7 (line 438), §22 (line 624)
   Gap: The spec states that `<PREFIX>_STATE_DIR` "wins outright when set" and that "the store identity carries the resolved directory", and the shell example therefore resolves the marker at `${ADOS_OWNER_HOLD_FILE:-${ADOS_STATE_DIR:-${HOME}/.ados-state}/owner-hold}`. The two production compositions that actually resolve the hold do **not** honour that variable: `packages/cli/src/production.ts:282` hardcodes `stateDirectory = ${homeDirectory}/${brand.stateDirectoryName}` for queue, dispatch, status and doctor, and `packages/mcp/src/serve.ts` `stateIdentity` does the same. Only `createProductionDependencies` honours `resolveStateDirectoryScope` (`packages/cli/src/edge.ts:1396-1406`, `packages/core/src/config/catalog.ts:879-902`) for the audit store. Consequence: an operator who relocates state (a documented, supported knob — `feature-config-layer.md:375-385`) and writes the marker at `$ADOS_STATE_DIR/owner-hold` gets a hook that defers while the typed engine still claims — exactly the shell/engine split that G-1, F-1 and RSK-6 exist to prevent, and exactly the GH-277 failure shape. `ADOS_OWNER_HOLD_FILE` has the same effect. The default `$HOME/.ados-state` path is consistent, so the blast radius is the non-default configuration, but the artifacts assert a coupling that the shipped code does not provide. `scripts/` has no pre-existing `ADOS_STATE_DIR` reference, so this change would introduce the affordance.
   Suggested remediation target phase: specification
   Suggested fix: Either (a) drop `ADOS_STATE_DIR` and `ADOS_OWNER_HOLD_FILE` from the shipped example's resolution and document "the env source, or the default `<home>/<stateDirectoryName>/owner-hold`, is the only authoritative declaration; the engine reads the store's directory", or (b) scope the compositions to supply the same override to the engine (a broader state-resolution change that needs an explicit decision). In both cases correct the §2.1 row, DM-9, A-2, RSK-7 and §22, and state in the guide that a shell-only marker path leaves the typed engine unheld.

2. [major] ac_quality — `chg-GH-280-spec.md` AC-F4-2 (line 559), F-4.3 (line 235); `chg-GH-280-test-plan.md` TC-HOLDQUEUE-002 (line 942), TC-HOLDE2E-001 step 3 (line 1778)
   Gap: AC-F4-2 requires that "`queue claim` runs for any ref" and refuses with the blocking-reason token `owner-hold`. The documented auto-select form `queue claim` (no ref — `doc/planning/oss-tooling/milestones/m1/commands/queue.md:21`; grammar accepts it at `packages/cli/src/commands/queue.ts:419-431`) never reaches `evaluateClaimPreconditions`: under a hold the scheduling pass returns an empty `nextActions`, so `packages/cli/src/edge.ts:4296-4310` short-circuits with `queue.precondition.unmet` / `summary: "reason=no-eligible-action"`. The hold is therefore not named on the most common operator/automation claim path, and TC-HOLDE2E-001 step 3 ("Run `queue claim` … capture `reason=owner-hold`") would fail as written. TC-HOLDQUEUE-002 only exercises `queue claim GH-XXX`, and no plan phase adds a hold short-circuit before ref selection.
   Suggested remediation target phase: specification
   Suggested fix: Decide the no-ref behaviour explicitly. Recommended: gate the claim composition before selection (phase 5, `edge.ts`) so a held claim always refuses `reason=owner-hold` with the bounded detail; alternative: scope AC-F4-2 to "a supplied ref", keep `no-eligible-action` for auto-select, and change the E2E step to `queue claim GH-XXX`. Add a no-ref TC either way.

3. [major] system_spec_consistency — `chg-GH-280-spec.md` F-4.5 (line 237), §13 (line 467), AC-F4-4 (line 561); `chg-GH-280-plan.yaml` phase 5 scope (lines 447-458)
   Gap: The spec asserts that "the resident daemon's scheduling seam derives from the same pass, so it receives no next action while held" and that no daemon-specific gate is needed. No production composition supplies those seams: `packages/cli/src/daemon-compose.ts:410-420` defaults `nextAction` to `() => undefined` and `claim` to a permanent refusal, the only constructor of `DaemonComposition` is the library export `daemon-main.ts`, nothing outside tests sets `supervision`, and `daemon` is absent from `PROMPT_REQUIRED_COMMANDS` (`packages/cli/src/help/prompt-required-commands.ts`). `feature-resident-daemon.md` already declares the production daemon entry as an open residual. Plan phase 5 lists `edge.ts` and `production.ts` only; `daemon-compose.ts` appears in no phase. So the ticket's "the daemon … claims nothing" is safe-by-absence today, not enforced-and-proven, and the artifacts claim wiring that does not exist.
   Suggested remediation target phase: specification
   Suggested fix: Record the daemon half of the acceptance as an explicitly conditional guarantee ("holds if and only if a composition supplies `supervision` from the scheduling pass"), in the spec, a test-plan GAP entry, and the change record — mirroring the resident-daemon spec's own residual — or add `daemon-compose.ts` to phase 5 and supply the seams there.

4. [major] test_traceability — `chg-GH-280-test-plan.md` TC-HOLDQUEUE-005 (lines 1011-1034), `chg-GH-280-plan.yaml` phase 5 verification (line 482)
   Gap: TC-HOLDQUEUE-005's precondition is "a supervision cycle over the held scheduling pass" with a recording next-action seam, and its expected outcome is that `nextAction` returns `undefined` and the cycle idles. That is a tautology of `packages/core/src/app/daemon-supervision.ts:109-110` (`if (action === undefined) return { mode: "idle" }`) and can pass with no hold logic at all. Nothing in the plan or test plan asserts that the seam is derived from `computeQueueSchedule`, and TC-HOLDEDGE-001's composition pin enumerates only queue, lanes, claim, watch, dispatch, status and doctor — no daemon. The reverse (mutation) direction is unproven.
   Suggested remediation target phase: test_planning
   Suggested fix: Make TC-HOLDQUEUE-005 construct `nextAction` from the held `computeQueueSchedule` result (or from the real composition helper) and assert the derivation, and add the daemon seam to TC-HOLDEDGE-001's surface list; otherwise delete the daemon claim from the AC and record the gap (see finding 3).

5. [major] cross_artifact_consistency — `chg-GH-280-spec.md` F-5.1 (line 250), DM-7 (line 381); `chg-GH-280-test-plan.md` TC-HOLDSTATUS-001 (line 1264), TC-HOLDSTATUS-002 (line 1289), A-T1 (line 1937); `chg-GH-280-plan.yaml` delivery pins (lines 103-107), phase 3 verification (line 368)
   Gap: The spec and test plan place the member at section level (`StatusSection.ownerHold?`; "a sibling of `chain`, `entries`, and `parks`"; tests read `providers.ownerHold`). The plan places it on the section *evidence* ("a sibling of `sources[]`, the `credentialPrerequisite` precedent"; "one additive optional evidence sibling `ownerHold?: …`"). Both are additive and both keep inactive bytes stable, so nothing else in the artifact set arbitrates. A coder following the plan builds `section.evidence.ownerHold` and TC-HOLDSTATUS-001/-002 fail; a coder following the test plan and the spec fails the plan's stated verification. F-5.1 itself is internally inconsistent: "sibling of `chain`/`entries`/`parks`" is section level, "exactly as `credentialPrerequisite` is a sibling of `sources[]`" is evidence level — and in code `credentialPrerequisite` is indeed on `StatusEvidence` (`packages/core/src/contracts/status.ts:428-442`, attached at `packages/core/src/domain/status.ts:1826-1836`).
   Suggested remediation target phase: specification
   Suggested fix: Choose one location (evidence-level matches the cited precedent and the plan) and align the spec F-5.1/DM-7, the test-plan assertions and A-T1, and the plan pins and verification. Add the human-suffix assertion against the chosen location.

6. [major] test_traceability — `chg-GH-280-test-plan.md` §7.1 (line 1823), §7.2 (line 1863), §7.3 (line 1876), §7.4 mutation row (line 1904); `chg-GH-280-plan.yaml` phase 2 verification (line 322)
   Gap: The "exactly one lane/blocking reason was added" pin is not asserted by the delivered structural test. `tests/fixtures/queue/vocabulary/closed-sets.json` has a `blockingReasons` list, but `tests/structure/queue-scheduling-contract.test.ts` only checks that every lane reason is contained in `QUEUE_BLOCKING_REASONS` and that six condition ids are present (lines 212-228); it never compares either array to the fixture. Editing the fixture therefore proves nothing, the plan's "closed-set equality holds in both directions" is unsupported, and the §7.4 mutation claim ("remove `owner-hold` from `QUEUE_LANE_IDLE_REASONS` → the closed-set equality fails by name") is false for the current test. This is the change's central closed-vocabulary guarantee; without an exact comparison, an accidental extra or renamed token passes.
   Suggested remediation target phase: test_planning
   Suggested fix: Make TC-HOLDQUEUE-011 add an exact two-way set assertion (e.g. `expect([...QUEUE_BLOCKING_REASONS]).toEqual(closedSets.blockingReasons)` with the fixture updated, or an explicit expected array), change §7.1/§7.2 from "existing — update fixture / no logic change" to "extend the structural test", and name the new assertion in plan phase 2 verification.

7. [minor] spec_completeness — `chg-GH-280-spec.md` NG-12 (line 167), NFR-14 (line 419), DM-4 (line 378)
   Gap: NG-12 lists `queue ready` among the read-only surfaces that "remain readable and report the hold", but `QueueReadyPayload` (`packages/core/src/contracts/queue-ready.ts:297-306`) gains no member in DM-4, F-4.7 covers only list/plan/read, and no test case exercises `queue ready` under a hold (the test plan never mentions it). An operator can therefore see a ready-set that looks runnable while delivery is held.
   Suggested remediation target phase: specification
   Suggested fix: Either add `ownerHold` (or a hold-shaped suppression) to the ready payload with a TC, or narrow NG-12/NFR-14 to the surfaces that actually report the hold and say so explicitly.

8. [minor] cross_artifact_consistency — `chg-GH-280-spec.md` RSK-4 (line 435), F-4.2 (line 231), Appendix B (line 666)
   Gap: RSK-4 states the hold is "prepended, never substituted" and that "the underlying readiness evidence is unchanged". That is true for entry `blocking[]`, but a lane carries exactly one `reason`: `packages/core/src/domain/queue-lanes.ts:92-94` renders `entry.blocking[0]?.reason`, so under a hold a `not-ready` lane's specific idle reason (`dependency-open`, `ci-failed`, `provider-chain-parked`, …) is replaced by `owner-hold` on the `lanes` surface; only `queue list` retains the full list. Appendix B's `idle-with-reason / owner-hold` row is correct; the risk statement overstates the mitigation.
   Suggested remediation target phase: specification
   Suggested fix: State the lane-level masking in RSK-4/F-4.7 (and point operators at `queue list` for the specific reason), rather than claiming substitution never happens.

9. [minor] spec_completeness — `chg-GH-280-spec.md` F-6.2 (line 262), DM-8 (line 382), `doc/spec/features/feature-doctor.md` §Closed vocabulary (line 86), §Evidence model (line 152)
   Gap: `owner-hold` is the first doctor evidence reason with **no evidence source** and the first non-`observed`/`observed-empty` reason allowed on an `ok` check. The doctor spec defines reasons as outcomes of the evidence model ("Reasons (22, declared order) … never invent values … unique per check and ordered by first occurrence") and the provider check caps reasons at four (`DOCTOR_MAX_EVIDENCE_REASONS`, `packages/core/src/contracts/doctor.ts:312`), which the healthy+neutral-park+announcement+hold combination fills exactly. The requirement to amend that model is not stated; §16.1 only says "reconciled after delivery", so doc-sync would have to invent the rule.
   Suggested remediation target phase: specification
   Suggested fix: State the amendment explicitly: `owner-hold` is a non-failing annotation reason, carries no evidence source, may co-occur with `ok`, is the fourth and last admissible provider reason, and changes no verdict/hint/exit.

10. [minor] ac_quality — `chg-GH-280-spec.md` AC-F6-1 (line 573), F-6.6 (line 266); `chg-GH-280-plan.yaml` pins (lines 109-112)
    Gap: The hold segment is appended to the existing provider detail and the combined value is clamped to `DOCTOR_MAX_DETAIL_CHARS = 200`, while `clampText` truncates with no ellipsis (`packages/core/src/domain/doctor.ts:58-60,146`). With a long existing detail (neutral parks plus announcements can approach the bound) the hold segment is cut mid-word or disappears entirely, while the `owner-hold` reason remains — so AC-F6-1's "appends … in the form `owner hold active (<source>): <reason>`" and F-6.6's "never displaces the existing detail" are ambiguous exactly where the bound bites, and no case exercises it.
    Suggested remediation target phase: test_planning
    Suggested fix: Specify the clamp outcome (drop the whole segment atomically, or truncate the existing detail to guarantee the hold segment), and add a TC-HOLDDOCTOR case with an existing detail at/near 200 characters.

11. [minor] cross_artifact_consistency — `chg-GH-280-spec.md` document history (line 707); `chg-GH-280-test-plan.md` §2 (line 64); `chg-GH-280-pm-notes.yaml` (D1-D11, including D3a)
    Gap: The spec's history calls them "the six binding PM decisions", the test plan's reference row says "Binding PM decisions D1–D6", while the PM record and the plan carry D1–D11 (twelve entries with D3a) and the spec's §15 carries DEC-1–DEC-10. D7–D11 are load-bearing (token/detail split, no model gate, reason-line grammar, poll fallback, appended detail) and are asserted by TCs, so the stale ranges misdescribe decision traceability.
    Suggested remediation target phase: specification
    Suggested fix: Align all three references to the actual decision set (D1–D11 → DEC-1–DEC-10), and keep D3a as history only.

12. [minor] cross_artifact_consistency — `chg-GH-280-spec.md` §18 ordering (line 585); `chg-GH-280-plan.yaml` ordering comment (lines 25-64) and phase 7 note (lines 57-60)
    Gap: The spec prescribes "contract and vocabulary first (… the one doctor reason and detail), then the pure gate …, then the example hook …, then the status and doctor projections". The plan runs fact → gate → status → doctor → composition → hook. The plan's order still satisfies the binding invariant ("no intermediate state may leave the wrapper deferring while the engine claims"), but the two artifacts now disagree on the prescribed sequence. Separately, the plan's ordering comment says phase 7 "also lands the one binding doc-sync edit the error-table check forces" while phase 2 already owns `doc/spec/features/feature-result-contract.md` and its verification requires updating that row in the same commit (phase 7's file list contains no such file).
    Suggested remediation target phase: specification
    Suggested fix: Restate §18 ordering as the invariant (contract → gate → surfaces → composition → hook → docs) matching the plan, and remove the stale phase-7 sentence from the plan's header comment.

13. [nit] cross_artifact_consistency — `chg-GH-280-test-plan.md` §7.3 (line 1890) vs `chg-GH-280-plan.yaml` pins (lines 121-125) and phase 1 scope (lines 216-222)
    Gap: The test plan's inventory row names two modules and hedges "(and the edge reader module if separate)", while the plan names three new modules, including `packages/adapters/src/file/owner-hold-marker.ts`, in both `inventory.json` and the executable allowances.
    Suggested remediation target phase: test_planning
    Suggested fix: Name all three modules explicitly in §7.3.

14. [nit] ac_quality — `chg-GH-280-spec.md` DM-5 (line 379), `packages/core/src/contracts/queue.ts:228`
    Gap: The new token `owner-hold` lands next to the existing `owner-gate` lane reason (the merge owner-approval gate). They denote different gates (delivery pause vs merge approval) and will read as near-synonyms in `lanes`, payloads and operator prose.
    Suggested remediation target phase: specification
    Suggested fix: Add one disambiguating sentence to the glossary and the guide; no token change is required.

15. [nit] spec_completeness — `chg-GH-280-spec.md` §4.1 metrics (line 140) vs NFR-2 (line 407)
    Gap: The metric row says "Durable queue, lease, park, incident, daemon-lane, handoff, and attempt records written while a hold is active | 0" with no qualifier, while NFR-2 scopes the same claim to records written "because of hold resolution or gating" and explicitly includes daemon heartbeats. A running resident daemon writes heartbeats/liveness records regardless of the hold, so the absolute metric is unachievable in principle and inconsistent with its own NFR.
    Suggested remediation target phase: specification
    Suggested fix: Reuse NFR-2's "caused by hold resolution or gating" qualifier in the metric row.

16. [nit] ac_quality — `chg-GH-280-spec.md` AC-F4-3 (line 560), ticket acceptance
    Gap: The ticket says a held dispatch "defers with a reason naming the hold"; the design refuses with `queue.precondition.unmet` (a non-retryable user-validation identity, exit 1, `packages/core/src/contracts/error-table.ts:1223-1232`). Refusal is a defensible reading of "does not start", and it is what the artifacts pin, but the AC never states that the ticket's "defer" is realized as a classified refusal rather than a wait — a difference an automation notices (abort vs retry).
    Suggested remediation target phase: specification
    Suggested fix: State in AC-F4-3 (and the guide) that the hold refuses with a user-validation identity at exit 1, and that a caller wanting deferral semantics must treat that token as "wait, do not abort".

## Coverage Audit

| Check | Result |
|---|---|
| ACs defined in spec §17 = 44 | PASS (44) |
| Test-plan forward table covers each AC once | PASS (44/44, no gap, no extra) |
| Plan `acCoverage` covers each AC once, in the satisfying phase | PASS (44 distinct, no duplicate, no dangling) |
| Test-plan scenario index = 58 TCs | PASS (58) |
| Every TC has a plan phase home | PASS (58 distinct; split cases TC-HOLDQUEUE-004/-009 and TC-HOLDEDGE-002, TC-HOLDNEG-002/-003 are explicitly double-homed) |
| Every AC has an automatable proof | FAIL — AC-F4-2's "any ref" branch (finding 2), AC-F4-4's daemon branch (findings 3-4) |
| Manual E2E and the six gaps explicit | PASS (TC-HOLDE2E-001 + GAP-T1..T6) — but the E2E step 3 contradicts the delivered no-ref claim (finding 2) |
| Ticket acceptance bullets → coverage | PARTIAL — dispatch refusal ✓, parked-lane non-recovery ✓, removing-hold resume ✓, docs ✓, shellcheck ✓; "daemon/queue watch claims nothing" only seam-level (finding 3); "new dispatch defers with a reason naming the hold" only for a supplied ref (finding 2) |
| Plan tree-green ordering | PASS (dependency-ordered; each phase's tests land with its code) |

## Closed-Set Audit

| Vocabulary | Delivered | This change | Verdict |
|---|---|---|---|
| Park condition types / causes / pairing / recovery states | 3 / 3 paired / 4 | unchanged | PASS |
| Queue state record kinds | 5 | unchanged | PASS |
| Queue-ready condition ids | 6 | unchanged | PASS |
| Lane idle/blocking reasons | 27 / 33 | +1 (`owner-hold`), inherited by blocking | PASS (addition only; **pin is unasserted** — finding 6) |
| Status sections / states / sources / reasons | 9 / 4 / 10 / 20 | unchanged; +1 optional member on the providers section | PASS on vocabulary; **placement contradiction** (finding 5) |
| Doctor areas / verdicts / sources / outcomes / reasons / conditions | 5 / 3 / 11 / 4 / 22 / closed | reasons +1 (`owner-hold` after `park-credential-cause`); verdicts, counts, catalog, sources, exit unchanged | PASS on counts; vocabulary rule needs an explicit carve-out (finding 9) |
| Error identities / domain kinds | closed | unchanged; `queue.precondition.unmet` hint prose only | PASS |
| Wrappers (`ceo-loop.sh`, `test-hook-regression.sh`) | SHA-256 pinned | untouched | PASS |
| State records written by the hold | n/a | none (fact is derived on read) | PASS |

## What Passes

The design's core choice is sound against the ticket: the global read-only gate preserves every closed queue vocabulary and produces the requested observables without a park record, so removal needs no repair; the hold is re-resolved per pass, so no restart is needed; the hook is a pure DM-1 gate with no loop cap, its MAX composition genuinely outranks a provider window, and both wrappers wait on the hook without a timeout (`deliver-ticket.sh:620-623`, `ceo-loop.sh:200`), so indefinite deferral is real rather than aspirational. The fail-closed marker, the 160-character sanitized reason, the per-resolution budget, and the core ambient-global boundary are specified and testable. Install/uninstall registration matches the existing inventories (`scripts/install.sh:130-135`, `scripts/uninstall.sh:425-437`), the suite is auto-discovered (`scripts/run-bash-suites.sh:32`), the wrapper pin is on the right two files (`tests/structure/provider-surface.test.ts:242-267`), the changeset set matches `.changeset/config.json`'s fixed group, and inactive-path byte stability is correctly treated as an assertion rather than a regeneration. Plan validation passes.

## Verdict Basis

Delivery must not start. Four of the five substantive findings are contradictions or unsupported claims that will produce either rework or a false green: the shell advertises a marker path the typed engine does not read (finding 1 — the exact split the change exists to prevent, and a false statement about current truth), the documented no-ref `queue claim` never reaches the hold gate and refuses as `no-eligible-action` (finding 2 — an acceptance bullet unmet and an E2E step that cannot pass), the resident-daemon guarantee is asserted against seams nothing in production supplies while the composition pin omits the daemon (findings 3-4), the status member's location is stated two incompatible ways across spec/test-plan/plan (finding 5), and the "exactly one lane reason" boundary rests on a fixture no test compares, so the plan's mutation evidence is false (finding 6). The remaining eleven findings are precision and honesty issues (the `queue ready` promise, lane-level reason masking, the doctor `ok`-plus-source-less-reason rule, detail clamping, decision-reference drift, ordering prose, inventory wording, token naming, the absolute zero-record metric, and "defer" vs classified refusal). Every finding is remediable in `specification`, `test_planning`, or `delivery_planning`; none requires reopening `delivery`, and none needs a human decision at this gate — the narrow remediations (findings 1, 2) are safe and reversible, and the broader alternative in finding 1 should be treated as a separate decision if the author prefers it. The PM's D1-D11 are recorded and mostly sound; D1's shell affordance is the one whose consequence the artifacts must fix before delivery.
