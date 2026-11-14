# Readiness Review Iteration 1

Verdict: **NOT_READY**
Work Item: GH-310
Date: 2026-11-14
Pause Required: no

Artifacts reviewed (read-only): `chg-GH-310-spec.md` v1.2, `chg-GH-310-test-plan.md` v1.2,
`chg-GH-310-plan.yaml` revision 1.1, `chg-GH-310-pm-notes.yaml`; source ticket
`juliusz-cwiakalski/agentic-delivery-os#310`; `doc/planning/oss-tooling/milestones/m2/{contracts,architecture,test-scenarios}.md`;
current truth in `doc/spec/features/{feature-plan-schema,feature-verify-gates,feature-closeout,feature-scheduling-engine,feature-project-groups,feature-result-contract}.md`;
and spot checks of `packages/core/src/contracts/{verify-gates,plan,projects,closeout}.ts`,
`packages/core/src/domain/{queue-graph,verify-gates}.ts`, `packages/cli/src/commands/{verify-gates,verify,queue,closeout}.ts`.
No source, spec, test-plan, plan, or pm-notes file was modified.

## Facet Summary

| Facet | Result |
|---|---|
| spec_completeness | **FAIL** |
| ac_quality | PASS (minor findings) |
| plan_coverage | PASS (37/37 ACs and 51/51 TCs owned; scope-path gaps separately below) |
| test_traceability | **FAIL** |
| cross_artifact_consistency | **FAIL** |
| decision_capture | PASS |
| system_spec_consistency | **FAIL** |
| plan_doc_update_coverage | PASS |
| plan_code_area_coverage | **FAIL** |
| dod_defined | PASS (DoD-5 needs the B-2 reconciliation) |

Requested additional rubric facets:

| Facet | Result |
|---|---|
| scope discipline | **FAIL** (NG-7 vs DEC-18, B-2) |
| risk coverage | PASS (adequate; missing risk for B-2/B-4 — see observations) |
| non-goals / supersession clarity | PASS |
| testability | **FAIL** (B-4, B-5, B-6, B-7) |
| decision pinning | **FAIL** (B-1, B-5, B-6, B-12) |

## Mechanical Reconciliation (verified, good)

- Specification §17 declares **37 ACs** (`AC-F1-1..AC-F1-6`, `AC-F2-1..AC-F2-5`, `AC-F3-1..AC-F3-8`,
  `AC-F4-1..AC-F4-2`, `AC-F5-1..AC-F5-4`, `AC-F6-1..AC-F6-4`, `AC-F7-1`, `AC-NFR1-1..AC-NFR7-1`).
- Test plan cites **37/37** ACs in the §3.1 matrix and §5.1 index; §3.4 counts 36 automated + 1 gate-only = 37.
- Test plan declares **51 TCs**; §5.1 index has 51 rows, §5.2 has 51 detail headings, §7 has 51 rows —
  exact match, no orphan TC. Family sums: XPLAN 7 + XQUEUE 6 + XDOD 9 + XDEP 2 + XCLOSE 4 + XREV 6 +
  XPAR 3 + XCTR 7 + XHERM 2 + XBOUND 4 + XGATE 1 = 51.
- Plan AC ownership sums to 37 (6 + 7 + 13 + 4 + 7) and plan TC ownership sums to 51 (8 + 9 + 18 + 6 + 10).
- Ticket AC1–AC4 map to at least one spec AC (Appendix B), and SC-M2-S19-01..05 are inherited by name.
- `repoKey` grammar in DEC-15/F-1 matches the delivered `PROJECT_KEY_PATTERN` exactly
  (`packages/core/src/contracts/projects.ts:51`).
- Parity provenance is explicitly specified in test plan §6.4 (pre-change goldens read unchanged,
  branch base `404e9bf8`, only envelope `runId`/`timing` normalized, `reviewFlow.runId` pinned).
- OQ-3 and OQ-6 are explicitly resolved-with-deferral and non-blocking; no AC depends on the
  deferred durable carrier. The named seams (`ReviewObservation`, `CrossRepositoryCloseoutObservation`) are pinned.
- NFR-7 identity reuse is coherent on paper (no new error-table row, no new domain kind; delivered
  identities only), and the plan has an explicit STOP/escalation trigger if an identity proves necessary.

## Findings

### B-1 [critical] spec_completeness / decision_pinning — cross-repository report's delivered `gates[]` and `summary` are undefined

- Artifact/location: `chg-GH-310-spec.md` §5.1 F-3, §8.3 DM-2/DM-7, §17 AC-F3-1..AC-F3-8;
  `chg-GH-310-test-plan.md` TC-XDOD-001, TC-XDOD-008, TC-XBOUND-004; delivered
  `packages/core/src/contracts/verify-gates.ts:323-336`.
- Gap: the cross-repository report "keeps the delivered report identity" (`plan.yaml` 3.1), so the
  required delivered fields `summary` and `gates[]` remain. The spec never defines their
  cross-repository contents. `VerifyGateRecord` carries only `id/verdict/reason/citation` — no member
  identity — so per-member gate records cannot be attributed; yet TC-XDOD-008 requires "the resolved
  gate's record is still reported normally for `web`", and TC-XDOD-001 pins a member-form golden that
  will become the de facto shape. The spec also does not say whether `gates[]` is the change-level
  battery, the union of member records, or empty, nor how `summary` counts members. This is an
  unpinned required-field contract that the implementer must invent.
- Suggested remediation target phase: **specification** (then test_planning).
- Suggested fix: pin the cross-repository `gates[]`/`summary` semantics in DM-2/F-3 — e.g., add a
  bounded per-member gate-record projection with a `repoKey` discriminator, or explicitly state that
  `gates[]` remains the change-level battery and member gate evidence lives only in
  `definitionOfDone.members[]`; align TC-XDOD-001/TC-XDOD-008/TC-XBOUND-004.

### B-2 [critical] system_spec_consistency / cross_artifact_consistency / scope discipline — DEC-18 contradicts delivered `overall` type and fail/unknown exit behaviour

- Artifact/location: `chg-GH-310-spec.md` §15 DEC-18, §8.5, §4.2 NG-7, §17 AC-F3-4, §17.1 DoD-5;
  `chg-GH-310-test-plan.md` TC-XDOD-004; `chg-GH-310-plan.yaml` phase 3; delivered
  `packages/core/src/contracts/verify-gates.ts:332`, `packages/cli/src/commands/verify-gates.ts:323-350`,
  `doc/spec/features/feature-verify-gates.md:27,44,118-119`.
- Gap: DEC-18 says "the delivered `overall` field and its `pass`/`fail`/`unknown` vocabulary are kept"
  and maps `incomplete => overall: unknown (exit 1)`. Delivered truth is different:
  `VerifyGatesReport.overall` is the single literal `"pass"` (`contracts/verify-gates.ts:332`);
  `verify gates --json` emits **no `data` on failure** (`feature-verify-gates.md:44`);
  `verify.gates.failed` is exit 1 and `verify.gates.unavailable` (overall unknown) is
  `platform-provider` **exit 2** (`feature-verify-gates.md:118-119`). Widening a required report field
  from `"pass"` to `pass|fail|unknown`, making `blocked`/`incomplete` data-bearing, and remapping the
  unknown exit from 2 to 1 is a contract/exit-semantics change. It contradicts NG-7 ("no change to
  delivered exit meanings") and §8.5's claim that "every extension is an additive optional key under
  `data` or an additive optional record field". DEC-18's premise ("the delivered report type already
  fixes `overall` ... mapping status 1:1 keeps one meaning per token") is factually wrong for the
  report type.
- Suggested remediation target phase: **specification** (then test_planning/delivery_planning if the
  mapping changes).
- Suggested fix: reconcile DEC-18 with delivered truth — either (a) explicitly declare the report-field
  widening and the cross-repository exit override (with consumer impact and the supersession of the
  delivered unknown exit 2), update NG-7/§8.5/DoD-5, and add an escalation trigger for
  "cross-repository exit mapping diverges from delivered projection"; or (b) preserve the delivered
  unknown exit 2 for `incomplete` and adjust AC-F3-4/TC-XDOD-004/plan phase 3. Do not ship both the
  "keeps delivered vocabulary" claim and the contradictory mapping.

### B-3 [major] cross_artifact_consistency / plan_code_area_coverage — test-plan-mapped/owned paths missing from the owning phase's scope

- Artifact/location: `chg-GH-310-test-plan.md` §2, §5.2 (TC-XPLAN-002/004, TC-XQUEUE-004,
  TC-XREV-005), §7 mapping; `chg-GH-310-plan.yaml` phases 1–5 `scope.files`.
- Gap: concrete mismatches between where a TC is owned/described and where its files are declared:
  - TC-XQUEUE-004 (phase 2) "extends `tests/behaviour/queue-cli.test.ts` / `queue-graph.test.ts`" —
    neither file is in any phase's `scope.files`.
  - TC-XPLAN-002 §7 names `tests/behaviour/plan-lint.test.ts` (extend patterns) — not in phase 1 scope.
  - TC-XREV-005 (phase-3-owned) "extends `tests/behaviour/entrypoint-help.test.ts`" — that file is
    declared only in phase 5.
  - TC-XPLAN-004 (phase-1-owned) §5.2 names `tests/structure/cross-repository-contract.test.ts` — that
    file is declared only in phase 5.
  - §2 "existing suites to extend" names `plan-validate.test.ts`, `plan-validate-rejections.test.ts`,
    `plan-determinism.test.ts`, `verify-gates-target.test.ts` — none appear in the plan.
  This breaks the plan's own TC-ownership rule ("the phase where the TC's verdict is first fully
  green") and is a delivery-time scope-drift risk: a phase will need to edit an undeclared path or a TC
  cannot be green in its owning phase.
- Suggested remediation target phase: **delivery_planning** (with test_planning if the §2/§5.2/§7
  mapping is the wrong side to change).
- Suggested fix: add each needed path to the owning phase's `scope.files`, or correct the test-plan
  mapping to the files the plan declares; keep ownership and scope aligned.

### B-4 [major] test_traceability / plan_code_area_coverage — member-less `queue add` parity golden is required but absent and undeclared

- Artifact/location: `chg-GH-310-test-plan.md` §6.4 and TC-XPAR-003; `chg-GH-310-plan.yaml` phase 5
  `scope.files`/`folders`; existing `tests/fixtures/queue/golden/` (no `queue-add` golden).
- Gap: TC-XPAR-003 and §6.4 require a pre-change member-less `queue add` payload golden for
  AC-F7-1/DEC-21, but no such golden exists and no path/phase declares its creation and commit. The
  plan's generic capture rule ("capture at the branch base BEFORE the first production edit, commit it
  in the owning phase") does not name the artifact or its folder, so the parity proof risks a
  post-change regeneration (a tautology) or an undeclared scope edit.
- Suggested remediation target phase: **delivery_planning** (with test_planning to name the path).
- Suggested fix: name the golden (e.g., `tests/fixtures/queue/golden/queue-add.json`), declare it in
  the owning phase and/or the pre-phase-1 capture step, and record the capture command in pm-notes.

### B-5 [major] decision_pinning / spec_completeness — DEC-19's verify-gates landing/merge observation carrier is unnamed

- Artifact/location: `chg-GH-310-spec.md` §15 DEC-19, §8.3 DM-4; `chg-GH-310-plan.yaml` phase 3.2;
  `chg-GH-310-test-plan.md` §6.3, TC-XDOD-007.
- Gap: DEC-19 requires `landed`/`landingPosition` as "injected observation facts alongside the
  member's `landed` flag — the same injected per-member observation that carries merge truth", but it
  names no input type/shape/DM row (contrast DEC-17's `ReviewObservation` DM-7 and DEC-20's
  `CrossRepositoryCloseoutObservation` DM-8). The delivered `DeliveryRequest` has no merged/landing-
  position field, and the closeout observation is explicitly a closeout-composition input. TC-XDOD-007
  asserts an injection that has no committed contract, so a coder/test author must invent the carrier.
- Suggested remediation target phase: **specification** (then test_planning).
- Suggested fix: pin the carrier (name, shape, composition seam) as a DM row and a test-plan fixture
  contract, or explicitly reuse a named observation type.

### B-6 [major] ac_quality / decision_pinning — DEC-8's `runId` digest does not cover PR-less members, contradicting AC-F6-3

- Artifact/location: `chg-GH-310-spec.md` §15 DEC-8 vs §17 AC-F6-3; `chg-GH-310-plan.yaml` 3.3;
  `chg-GH-310-test-plan.md` TC-XREV-003.
- Gap: AC-F6-3 says "a member set that changes between runs => `runId` differs", but DEC-8 defines
  `runId` as a digest over the sorted member **pull-request** identities. A declared member with no
  `pullRequest` is not in that digest, so adding/removing a PR-less member would leave `runId`
  unchanged and violate AC-F6-3. TC-XREV-003 only exercises PR-bearing member sets, so the gap is
  untested.
- Suggested remediation target phase: **specification** (then test_planning).
- Suggested fix: decide whether `runId` covers all declared `repoKey`s (with an explicit absent-PR
  marker) or narrow AC-F6-3 to pull-request-set changes; align TC-XREV-003.

### B-7 [minor] ac_quality — invalid-plan `members[]` echo is not pinned

- Artifact/location: `chg-GH-310-spec.md` AC-F1-2; `chg-GH-310-test-plan.md` TC-XPLAN-002 step 4.
- Gap: the spec says "no invalid member is echoed as valid" but does not pin whether an invalid plan
  emits no `members` key at all or a partial echo; TC-XPLAN-002 accepts either alternative. A
  deterministic contract/test should choose one.
- Suggested remediation target phase: **specification/test_planning**.
- Suggested fix: pin the invalid-plan echo behaviour (recommended: no `members` key on an invalid
  verdict) and make TC-XPLAN-002 single-valued.

### B-8 [minor] cross_artifact_consistency — test plan still calls the implementation plan "pending"

- Artifact/location: `chg-GH-310-test-plan.md` §2 line 53.
- Gap: the test plan describes `chg-GH-310-plan.yaml` as "**pending** (phase 4 of the lifecycle)"
  although plan revision 1.1 exists and is authored against test-plan v1.2. The reference is stale and
  weakens the claim that the test plan and plan are reconciled.
- Suggested remediation target phase: **test_planning**.
- Suggested fix: update §2 to reference plan revision 1.1 and confirm the (a)–(i) constraints were
  honoured; add a §9 revision row.

### B-9 [minor] test_traceability — member-form closeout plan mode and plan-time no-config are untraced assertions

- Artifact/location: `chg-GH-310-test-plan.md` TC-XCLOSE-004 / AC-F5-1; TC-XPLAN-005 / AC-F1-1,
  AC-F3-7; `chg-GH-310-spec.md` §1.1.
- Gap: TC-XCLOSE-004 asserts "closeout plan mode reports members", but AC-F5-1 is an `--apply`
  criterion and AC-NFR4-1 only asserts zero writes; no AC explicitly requires member-form plan-mode
  reporting. TC-XPLAN-005 asserts "plan validation reads no configuration", but AC-F1-1 is a happy
  path and AC-F3-7 is a verify-time criterion; no AC owns the plan-time no-config rule. §1.1 also omits
  the v1.1 ACs (AC-F1-5/6, AC-F2-5, AC-F3-7/8, AC-F6-4, AC-NFR6-1/7-1) although §1.2/§3 cover them.
- Suggested remediation target phase: **specification/test_planning**.
- Suggested fix: broaden AC-F5-1 to both closeout modes or add a plan-mode clause; add an AC for
  "plan validate reads no configuration"; refresh §1.1 to the 37-AC set.

### B-10 [minor] cross_artifact_consistency — phase-5 commit type understates its content

- Artifact/location: `chg-GH-310-plan.yaml` commit convention (lines 136–142) vs phase 5 scope.
- Gap: phase 5's commit subject is `docs(GH-310)`, but the phase adds three new test suites
  (`cross-repository-contract`, `cross-repository-readonly`, `cross-repository-hermetic`), a
  `.changeset`, and planning-corpus edits. `docs` understates a commit that ships test code and a
  release artifact.
- Suggested remediation target phase: **delivery_planning**.
- Suggested fix: retitle the phase-5 subject (e.g., `test(GH-310): ...` with a separate `docs(GH-310)`
  bookkeeping commit) or justify `docs` explicitly.

### B-11 [minor] ac_quality / decision_pinning — per-member `cleanup`/`issueClosure` derivation from one aggregate step outcome is not pinned

- Artifact/location: `chg-GH-310-spec.md` F-5/DM-5; `packages/core/src/contracts/closeout.ts:365-375`.
- Gap: `cleanup`/`issueClosure` are described as "the member branch-cleanup step's delivered outcome
  value", but a delivered `CloseoutStep` has one `outcome` and only an optional additive `detail` map.
  The derivation of per-member values from one aggregate step outcome (especially mixed outcomes: one
  member `refused`, another `applied`) is not pinned.
- Suggested remediation target phase: **specification**.
- Suggested fix: pin the per-member outcome derivation and the aggregate step outcome rule (or add a
  bounded per-member detail field).

### B-12 [minor] decision_pinning — plan-time gate-identifier "shape" is not pinned

- Artifact/location: `chg-GH-310-spec.md` F-1/DEC-9; `chg-GH-310-plan.yaml` 1.2;
  `chg-GH-310-test-plan.md` TC-XPLAN-005.
- Gap: "gate identifiers are shape-validated only" is not pinned to a shape; the plan says non-empty
  strings, TC-XPLAN-005 only exercises empty/non-string, and no AC owns the plan-time no-configuration
  assertion.
- Suggested remediation target phase: **specification**.
- Suggested fix: pin the gate-identifier shape (reuse the delivered kebab-case id rule or state
  "non-empty string") and add the corresponding AC/assertion.

## Non-Blocking Observations

- **Member-ref identity**: consistent across DEC-2/DM-6/F-2, plan 2.2–2.3/4.4, and TC-XQUEUE-004. The
  delivered `<PREFIX>-<digits>` form is unchanged (`canonicalQueueRef` at
  `packages/core/src/domain/queue-graph.ts:62-68`); the member form is additive and bounded by
  `QUEUE_MAX_REF_CHARS`. No path found that narrows the delivered grammar. Note that the canonicalizer
  will accept a well-formed member ref globally, not only when a plan declares it — deliberate per
  DEC-2, but worth a review note.
- **Closeout non-goal retirement** is explicit (§7.3, §8.5, plan phase-7 handoff, DoD-13) and carried
  to `doc/spec/features/feature-closeout.md` phase 7. Supersession clarity is good.
- **Risk register** RSK-1..9 is solid but lacks a risk for the B-2 `overall`-field widening/exit
  override and the B-4 `queue add` golden provenance. Adding both would sharpen the delivery guard.
- **DoD-1..15** exist with verification methods and plan-phase ownership; DoD-13/DoD-15 correctly
  point to lifecycle phase 7/11. DoD-5 will need the B-2 reconciliation.
- **`plan validate`** is reported green in the intake context; I did not re-run it (read-only review).
- **No human input is required** to remediate the findings; all are artifact-authoring changes. If the
  team cannot choose between "align `incomplete` to delivered exit 2" and "declare a cross-repository
  exit override" for B-2, that choice may be escalated to the PM/human as a decision, but it is not a
  blocker to starting remediation.

## Iteration Notes

- This is iteration 1; no prior readiness record exists, so no dedup/superset decisions were needed.
- The two prior sequential-authoring revision cycles (spec v1.0→v1.1 and v1.1→v1.2) closed the SG-1..SG-7
  gaps and pinned DEC-18..DEC-21, but they did not reconcile DEC-18 with the delivered report type/exit
  projection (B-2) and did not pin the verify-gates landing observation carrier (B-5).
- DoR findings never reopen `delivery`; the remediation targets above are `specification`,
  `test_planning`, and `delivery_planning` only.
