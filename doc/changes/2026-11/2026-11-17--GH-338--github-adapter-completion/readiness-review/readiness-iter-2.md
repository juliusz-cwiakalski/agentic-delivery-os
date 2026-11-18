# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-338
Date: 2026-11-18
Pause Required: no

Reviewer: `@readiness-reviewer` (adversarial Definition of Ready gate), independent of the
three authoring agents. This is a confirmation pass over the iteration-1 remediation, not a
re-review of the change's shape.

Inputs read in full: `readiness-iter-1.md`; `chg-GH-338-spec.md` v1.1 (692 lines);
`chg-GH-338-test-plan.md` v1.1 (1159 lines); `chg-GH-338-plan.yaml` (1345 lines);
`chg-GH-338-pm-notes.yaml`; TDR-0032, TDR-0033, TDR-0034, TDR-0035 (amended), ADR-0005
(editorial pointer); ticket GH-338 and #342 via `gh`; M3 blueprint `README.md` exit criteria.
Code re-read as needed for the residuals: `packages/cli/src/{bin-launcher,entrypoint,production}.ts`,
`packages/adapters/src/github/{client,capabilities,review-state}.ts`,
`packages/core/src/contracts/adapter-capabilities.ts`, `tests/structure/{entrypoint-bin,harness-imports,provider-surface,closeout-contract}.test.ts`,
`tests/behaviour/providers/{github-closeout,github-trap,provider-capabilities}.test.ts`,
`tests/conformance/mock-conformance.test.ts`, `tests/types/provider-views.type-test.ts`,
`tests/fixtures/providers/traps/github.traps.json`.

Machine checks (read-only): `plan validate GH-338` → `valid, tier=full, readyForDevelopment=true`
(the gate still overrides that flag); AC/TC bijection recomputed from v1.1 — 40/40 ACs mapped,
81/81 TCs, 81/81 index rows, 0 orphans both directions; plan TC→phase map covers all 81 exactly
once (the four apparent repeats are the declared split cases) and AC ownership covers all 40
exactly once (the three apparent repeats are the declared partial-verdict notes); ticket #338
body re-read (unchanged), #342 open with zero comments (defaults still apply); `git status`
confirms only the four TDRs are untracked — ADR-0005's pointer is **already committed**
(`f2c2ad27`) and the file is clean.

## Facet Summary

- spec_completeness: **FAIL**
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: **FAIL**
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS (with minors R6/R8)
- dod_defined: PASS

## Iteration-1 findings — disposition

| ID | Severity then | Status | Evidence |
|---|---|---|---|
| F1 `write-delivery-request` create/update shape | blocker | **Resolved** | DM-9 declares both variants (spec 269); F-6/API-6/AC-F6-1/Table A restate them; TC-BACKLOG-002 asserts create and update separately, required-input refusal with zero provider requests, never-lands/no-merge-state; TC-PARITY-003 declares both tenant routes + the direct update call. |
| F2 probe cannot run where placed | blocker | **Resolved** | Plan refinement 7 + obligations 2.1–2.3 bind async launcher → resolved fact → synchronous composer; `packages/cli/src/bin-launcher.ts` and `production.ts` are in phase-2 scope; the composer stays synchronous. Every file the mechanism needs is declared. |
| F3 child-process site-set pin not in phase 2 | blocker | **Resolved** | `tests/structure/harness-imports.test.ts` is in phase-2 scope (plan 793) with obligation 2.8: 12 → 13 sites, exact new file `packages/adapters/src/github/cli-transport.ts`, header comment stays a declared inventory. Delivered set is exactly 12 files (`harness-imports.test.ts:20-32`). |
| F4 `closed → done` label-rule contradiction | major | **Resolved** | Mechanism-scoped rule now stated once and identically in spec F-6 (125–127), Table A (284), AC-F6-4 (526), §8.5 (357), §24.3 #9/#10 (653–654), TDR-0035 C-6/§3.2, plan phase 3 (836–849), TC-BACKLOG-004/005/006 and TC-FLOOR-001. The delivered write is provably unchanged (`client.ts:455-460` = one `PATCH {state:"closed"}`; `github-closeout.test.ts:223-228`) and TC-FLOOR-001 pins count 1 / `PATCH` / exact body / zero label requests / success on a labelless issue. |
| F5 read-side refusal contradiction | major | **Resolved** | Spec F-6 (129), Table E read rule (336), AC-F6-2 (524), §24.4 (660) all state one refusal class / four outcomes, `CLOSED` resolving natively, and the case collision scoped to `label-swap` tokens. TC-BACKLOG-008 is the six-row truth table, re-pointed to AC-F6-2, with an anti-vacuity lower-case mutation and a `CLOSED` non-collision mutation; GAP-TP-1 and §6 say casing is decided, not fixture-decided. Consistent with TDR-0035 §3.1. |
| F6 AC-F2-2 degradation had no shape/home | major | **Resolved** | DM-10 declares `{ policy, selected, degradation? }` with exact presence rules (270); F-2, Table C, AC-F2-2, §10, §4.1 metric and §24.3 #7 point at it; TC-CLI-011 asserts the exact value per policy (`Object.hasOwn` for absent `degradation`), exactly one rendered line (count 1), zero persisted copies, zero probe spawns under `api-only`, plus mutation controls; plan 2.2/2.3 binds the delivery. |
| F7 phase-1 read-back helper home | major | **Resolved** | `tests/behaviour/providers/support.ts` is in phase-1 scope (plan 623) with obligation 1.9 and refinement 3 (one stateful scripted transport, reused by phase 3; tenant stays stateless). |
| N1 §2.1 child-process enumeration | minor | **Resolved** | Spec §2.1 (41) now states the pin-guarded inventory and that this change adds exactly one site; no false enumeration remains. |
| N2 TC-PARITY-003 vs one-step registry | minor | **Resolved** | TC-PARITY-003 (872–879) states one registry step, the create dispatch member, both tenant routes, and the direct update call, and declares itself the oracle change; plan refinement 2 and the INCONSISTENCIES block no longer claim an unchanged oracle. |
| N3 ordered `supportedOperations` | minor | **Resolved** | TC-POSTURE-001 (286–287) asserts set equality and states order is outside the contract; plan phase 1/3 keep the delivered order and append (verified: `ADAPTER_OPERATIONS[7]` stays `resolve-delivery-thread`; the delivered `provider-surface` pin is an ordered array that moves only by appending). |
| N4 trap-catalog outcome becomes false | minor | **Resolved** | Exactly one declared `GH-ISSUE-TO-WORKITEM` outcome amendment, same `trapName`/four-field shape, owned by phase 3, asserted by explicit diff in TC-FLOOR-001 and recorded in §7.3 and plan obligation 3.6; all other entries frozen. |
| N5 phase-7 doc checklist not sentence-level | minor | **Resolved** | Plan phase 7 obligation 7.4 and the header handoff name all five `feature-adapter-conformance.md` sentences, the `feature-provider-client-seeds.md:169` sentence, the ports/merge/index targets. Spec Appendix A stays higher-level; the plan is the binding staging artifact, so no discovery remains. |
| N6 conformance tenant not in phase 4 | minor | **Resolved** | `tests/fixtures/providers/conformance/github/tenant.json` is in phase-4 scope (1060) with obligation 4.3 (check-run timestamps + exact pipeline-run projection, other tenants byte-identical). |
| N7 transition-input widening unnamed | minor | **Resolved** | §7.1 (205), DM-6 (266), §8.5 (358) name the widened adapter-local input, the writable set, and the un-widened core `CloseoutWritePort`. |
| N8 vacuous redaction obligation | minor | **Resolved** | AC-F4-4/AC-F5-6 now state "the change adds no new rendering surface, and any consumer surface that renders it…"; §21 (578) states the obligation is a forward-looking invariant at the one chokepoint; plan refinement 6 binds the same. TC-CHECK-011/TC-THREAD-010 exercise the chokepoint with paired positives. |
| N9 child-environment `PATH` | minor | **Resolved** | Plan refinement 8 + obligation 2.4: base record is the composition's injected `environment` (supplies `PATH`), no ambient read, no absolute path injection, exact key set asserted in TC-CLI-003. |
| N10 ADR-0005 back-pointer | minor | **Resolved** | ADR-0005 line 177 carries the editorial pointer; TDR-0032 Decision item 9 and its related-decisions list state the refinement; `links.decisions` includes ADR-0005. |

No iteration-1 finding is still open. All severity labels for F1–F7 and N1–N10 are closed.

## Findings (iteration 2)

### R1 — The TDR's terminal-read write refusal is absent from the spec, the test plan and the plan (major)

- **Facet:** spec_completeness / cross_artifact_consistency
- **Severity:** major (blocking)
- **Artifact + location:** `TDR-0035` §3.2 (line 316: "If the current read resolves to `done`, the
  write refuses with zero provider requests: terminal truth would outrank the token it adds, so the
  write could not be observed, and reopening is not part of this mechanism.") vs
  `chg-GH-338-spec.md` §5 F-6 (129), §6 Flow 6 (187), §8.4.1 "Writable set (normative)" (338),
  AC-F6-3 (525), AC-F6-4 (526), AC-F6-5 (527), NFR-11 (378); `chg-GH-338-test-plan.md`
  TC-BACKLOG-004 (734–736), TC-BACKLOG-006 (752–754); `chg-GH-338-plan.yaml` phase 3 obligation 3.1
  (869–875) and goal text (836–849).
- **Gap:** The four decision records are binding artifacts cited by the spec (DEC-4), and TDR-0035
  now requires a fourth transition refusal: a `label-swap` write whose *current read* resolves to
  `done` must refuse with zero provider requests. None of the three downstream artifacts states it,
  and no TC asserts it. The omission is not cosmetic: without that refusal, AC-F6-3 and NFR-11
  ("100% of writable aliases written through the map read back as the same alias") are false for a
  closed issue — the write would succeed, the read would resolve `done` by terminal precedence, and
  the written alias would never be observable. The same omission leaves TC-BACKLOG-004's round-trip
  and TC-BACKLOG-006's labelless half with an unstated precondition: if the labelless fixture is
  `closed`, the first half can pass by refusing for the wrong reason (terminal state, not the
  unavailable label signal), and the pass criterion cannot distinguish them.
- **Suggested remediation target phase:** specification
- **Suggested fix:** State the rule once in F-6/§8.4.1 (and AC-F6-3 or AC-F6-4): "a `label-swap`
  transition whose current read resolves to `done` refuses with a named typed failure and zero
  provider requests, because terminal precedence would make the write unobservable." Add the
  corresponding obligation to plan phase 3, add the refusal row to TC-BACKLOG-004 (or one new case),
  and pin TC-BACKLOG-006's `labelless-issue` fixture as `open` so its refusal is unambiguously the
  unavailable-signal one. No new decision record is needed — the rule is already in TDR-0035.

### R2 — TC-CLI-005's route table requires client members that cannot exist in its owning phase (major)

- **Facet:** cross_artifact_consistency
- **Severity:** major (blocking)
- **Artifact + location:** `chg-GH-338-test-plan.md` TC-CLI-005 (343–350: fixtures "work-item,
  delivery-request, pipeline/list page, landing, comment, content write"; "the normalized results are
  deep-equal — identity, fields, `pageItemCount`…"); `chg-GH-338-plan.yaml` TC→phase map phase 2
  (line 143) and obligation 2.7 (728–730); phase-2 scope (767–803); capability suite gap rule
  `tests/behaviour/providers/provider-capabilities.test.ts:204-211` (a gapped operation's write
  method must **not** exist).
- **Gap:** Phase 2 owns TC-CLI-005 (and AC-F2-4), but its fixture set includes a comment write and a
  content write. Those client members (`writeComment`, `writeDeliveryRequest`) cannot exist in phase
  2: GitHub still declares both as gaps until phase 3, and the delivered capability suite fails if a
  gapped operation's method is present. The case does not say whether those two routes are raw
  transport-level sends or client-level normalizations, so as written it cannot pass in phase 2 and
  the plan's claim "INCONSISTENCIES: none blocking between spec v1.1 and test plan v1.1" is
  overstated. A coder hitting this mid-phase must stop and re-plan.
- **Suggested remediation target phase:** test_planning
- **Suggested fix:** Narrow the phase-2 route table to the eight operations supported after phase 1
  (landing included, comment/content-write excluded), and declare the two write routes as a
  phase-3 addition (split case with an owner note), or state explicitly that those two routes are
  transport-level `ProviderRequest` sends with status/body parity only and no client member or
  projection. Either resolution is spec-compliant (AC-F2-4 names no operation list).

### R3 — DM-10's "carried on the composed GitHub runtime" names a surface the plan forbids (minor)

- **Facet:** cross_artifact_consistency / ac_quality (oracle precision)
- **Severity:** minor
- **Artifact + location:** `chg-GH-338-spec.md` F-2 (115), DM-10 (270), Table C Degradation (307),
  §10 (383), AC-F2-2 (484); `chg-GH-338-plan.yaml` refinement 7d (277–282) and obligation 2.2
  (703–713: "never added to `GithubClient`, `GithubClientOptions`, a normalized view, a state record,
  or the conformance artifact"); `chg-GH-338-test-plan.md` TC-CLI-011 (403–404).
- **Gap:** The spec says the value is "carried on the composed GitHub runtime"; the plan binds it as
  the resolver's return value held by the composer closure, observable only through the one rendered
  line. A coder reading DM-10 could add a field to the composed program, and a reviewer reading
  DM-10 could demand one — the exact coder/reviewer disagreement a DoR gate must prevent. Every
  *testable* element (one value, exact fields, one line, zero persisted copies) is specified and
  asserted; only the carrier noun is unpinned. See adjudication (a).
- **Suggested remediation target phase:** specification
- **Suggested fix:** Add one clause naming the carrier: "carried as the composition fact that selects
  the transport for the invocation (the resolver's return value); it is not a field on the client, the
  composed program, or any normalized view, and the single diagnostic line is its only consumer-visible
  surface."

### R4 — A third composition state (absent selection fact) is not named by the closed policy (minor)

- **Facet:** spec_completeness / cross_artifact_consistency
- **Severity:** minor
- **Artifact + location:** `chg-GH-338-plan.yaml` refinement 7d (277–282: "an ABSENT selection is the
  delivered offline default (the native-fetch transport, no probe, no diagnostic line), so every
  delivered composition test and every embedder stays probe-free"); `chg-GH-338-spec.md` Table C
  Policy (306: "Closed `prefer-cli` (default) or `api-only`"), DM-10 (270), AC-F2-2 (484).
- **Gap:** The spec declares a closed two-value policy with `prefer-cli` as the default; the plan adds a
  third, unlabelled state in which no policy is asserted, no probe runs, no `GithubTransportSelection`
  exists, and the API transport is used. For this change it is inert in production (the launcher is the
  only production caller and always supplies the fact — verified by the `createProductionComposer(`
  single-call-site pin), so the state affects tests and any future embedder only), but it contradicts
  the declared default for any caller that omits the fact and makes DM-10's "one value" non-universal.
  See adjudication (b).
- **Suggested remediation target phase:** specification
- **Suggested fix:** Either declare the absent-fact default in Table C/DM-10 ("no fact = offline API
  default for tests/embedders, no policy claim, no probe, no value") or make
  `ProductionCompositionFacts.githubTransportSelection` required at the production edge and let tests
  pass `{ policy: "api-only", selected: "api" }`.

### R5 — The bound probe placement also probes invocations that never compose (minor)

- **Facet:** cross_artifact_consistency (spec invariant vs the only feasible implementation)
- **Severity:** minor
- **Artifact + location:** `chg-GH-338-spec.md` Table C Probe (304: "one bounded version invocation at
  composition time only") and AC-F2-2 (484); `chg-GH-338-plan.yaml` refinement 7b/7c (265–276) and
  obligation 2.2; `packages/cli/src/entrypoint.ts:366-390` (root `--version`,
  `--print-install-path`, root and command `--help` all return before `composeProgram` is invoked);
  test plan TC-CLI-010 (394–395) and TC-CLI-013 (421–422).
- **Gap:** Awaiting the resolver in the launcher means `gh --version` runs once per launcher
  invocation, including every self-description invocation (`--version`, `--print-install-path`,
  `--help`, command help) that never composes and never renders the diagnostic. That is not "at module load" or "per request", but it is not "at composition time only"
  either, and no case asserts the launcher's spawn budget for self-description invocations. A strict
  reviewer reading Table C can call the implementation a violation; the plan does not acknowledge the
  consequence.
- **Suggested remediation target phase:** delivery_planning
- **Suggested fix:** State the consequence in phase 2 ("one probe per launcher invocation, including
  invocations that never compose; no provider request is issued and no line is rendered then"), or
  relax Table C to "once per invocation at the composition edge, never at module load and never per
  request" — one of the two, not both silent.

### R6 — TC-PARITY-006's declared home is not in its owning phase's scope (minor)

- **Facet:** plan_code_area_coverage
- **Severity:** minor
- **Artifact + location:** `chg-GH-338-test-plan.md` TC-PARITY-006 (899–906: "`tests/conformance/support/fixtures.ts`
  (install both guards) + `tests/conformance/mock-conformance.test.ts` (extend) + `tests/behaviour/providers/support.ts`");
  `chg-GH-338-plan.yaml` phase-2 scope (767–803, which declares the first and third files but not
  `mock-conformance.test.ts`) and obligation 2.6 (726–727).
- **Gap:** The case is owned by phase 2 (AC-F8-3), and its named assertion site is a file phase 2 does
  not declare, so the commit primitive cannot stage that edit. The substantive requirement is still
  satisfiable in an in-scope file (the new `tests/conformance/github-transport-parity.test.ts` is in the
  mock tier), which is why this is minor rather than a second F7.
- **Suggested remediation target phase:** test_planning
- **Suggested fix:** Re-point the assertion half to `tests/conformance/github-transport-parity.test.ts`
  (in scope) or add `tests/conformance/mock-conformance.test.ts` to phase 2 — and say which, so the
  coder does not have to choose.

### R7 — TC-BACKLOG-010 asserts a validator rule that neither the spec nor the record declares (minor)

- **Facet:** spec_completeness / test_traceability (oracle anchored to an artifact)
- **Severity:** minor
- **Artifact + location:** `chg-GH-338-test-plan.md` TC-BACKLOG-010 (786–789: invalid maps include
  "a row set with no `done` row"); `chg-GH-338-plan.yaml` phase 3 (833–834, which adopts it "per
  TC-BACKLOG-010's invalid-map set"); `chg-GH-338-spec.md` DM-6 (266) and §8.5 (355) — no validator
  rejection set; `TDR-0035` §1 Validation (line 282) — non-empty `systemName`, ≥1 row, unique
  `nativeStatus`, closed sets, ≤1 row per alias; **no** required `done` row.
- **Gap:** The test asserts construction rejection for a map with no `done` row; neither the spec nor
  the decision record requires it, and the plan silently adopted the test's rule. An implementer
  following TDR-0035 would fail the case; an implementer following the case widens construction
  validation beyond the record. The underlying rationale is sound (the delivered closeout needs a
  `done` row), which is exactly why it belongs in the contract rather than in a case. See adjudication (e).
- **Suggested remediation target phase:** specification
- **Suggested fix:** Declare DM-6's validator rejection set explicitly (adopting the `done`-row rule and
  asking `@decision-advisor` to add it to TDR-0035 §1 in the same pass), or delete that one invalid-map
  case from TC-BACKLOG-010 and keep the record's five checks.

### R8 — Three undeclared split cases in the plan's scope map (minor)

- **Facet:** plan_code_area_coverage
- **Severity:** minor
- **Artifact + location:** `chg-GH-338-test-plan.md` TC-BACKLOG-009 (778: "a scan in
  `tests/structure/reference-behavior.test.ts`"), TC-PARITY-005 (894–897: "`tests/behaviour/providers/github-trap.test.ts`
  (extend assertions) + `tests/fixtures/providers/traps/github.traps.json` (extend)"); plan phase 3
  scope (954–983), phase 7 scope (1319–1341), split-case notes (152–163, which do not mention either).
  The plan's split note also says "the `provider-views` extension follows normalization in phase 4",
  but phase 4 does not declare `tests/types/provider-views.type-test.ts` (and that file contains no
  `PipelineJob` reference, so the note is at best vacuous).
- **Gap:** TC-BACKLOG-009 (phase 3) depends on a scan authored in phase 6; TC-PARITY-005 (phase 7)
  names two files phase 7 does not declare, while its per-phase work lands in phases 1–5; the
  provider-views note names a phase that does not declare the file. None blocks a gate, but each is a
  place where staging and ownership disagree.
- **Suggested remediation target phase:** test_planning
- **Suggested fix:** Re-point TC-BACKLOG-009's scan to `tests/structure/config-contract.test.ts` (in
  phase 3) or declare it a phase-6 split; re-point TC-PARITY-005's phase-7 assertions to
  `tests/structure/trap-catalog.test.ts`/`reference-behavior.test.ts` (in scope) or add the trap files
  to phase 7; delete the provider-views sentence unless a phase declares the file.

### R9 — Three spec sentences read globally false against the change's own data model (minor)

- **Facet:** spec_completeness
- **Severity:** minor
- **Artifact + location:** `chg-GH-338-spec.md` §8.5 (353: "`createGitHubClient` and its options keep
  their delivered shape"), F-6 (123: "No new operation and no core contract change is introduced"),
  AC-F6-1 (523, same clause); `TDR-0035` §1 (280: `GithubClientOptions` gains optional `workflowMap`),
  `TDR-0032` item 8 (283, same "keep their delivered shape" claim); spec DM-1 (261) and DM-2 (262).
- **Gap:** The change adds an optional `workflowMap` option and the ninth operation plus two optional
  `PipelineJob` fields. The three sentences are correct only in their local scope ("for the content
  write", "no breaking change"), but read globally they contradict DM-1/DM-2 and TDR-0035. A reviewer
  can legitimately flag either the option or the ninth operation as a violation of §8.5/F-6.
- **Suggested remediation target phase:** specification
- **Suggested fix:** Phrase the guarantee as additive: "existing call sites and option objects keep
  compiling; only additive optional members are introduced (no removed, retyped, or newly required
  member)" and scope F-6's "no new operation" to the content write.

### R10 — Two plan-bookkeeping nits (nit)

- **Facet:** plan_code_area_coverage / decision_capture
- **Severity:** nit
- **Artifact + location:** `chg-GH-338-plan.yaml` COMMIT-BOUNDARY REALITY (75–88: ADR-0005 is
  "tracked-and-MODIFIED in this branch state"); refinement 7a/7b (257–276: two distinct functions both
  named `resolveGithubTransportSelection`).
- **Gap:** ADR-0005's pointer is already committed (`f2c2ad27`) and the worktree is clean, so the note
  is stale and the phase-1 declaration will produce exactly the advisory `plan diff`
  `undeclared-missing` finding the PM asked about. The duplicate function name (one pure sync in the
  adapter, one async in `production.ts`) forces an import alias and invites confusion in review.
- **Suggested remediation target phase:** delivery_planning
- **Suggested fix:** Correct the note (ADR-0005 is tracked and clean; only the four TDRs are untracked)
  and rename one resolver (e.g. adapter `resolveTransportSelection`, production
  `resolveCompositionTransportSelection`).

### R11 — TC-BACKLOG-008 declares a fixture case no truth-table row asserts (nit)

- **Facet:** test_traceability (oracle completeness)
- **Severity:** nit
- **Artifact + location:** `chg-GH-338-test-plan.md` TC-BACKLOG-008 fixtures (770:
  "`case-variant-state-label`: label `CLOSED` on a `closed` issue **and on an `open` issue**") vs the
  six rows (771): only the `closed`-issue case is asserted; the open-issue `CLOSED` case is never a
  row.
- **Gap:** The fixture declares two observations and the oracle asserts one. Per the spec, `CLOSED` on
  an open issue resolves `ready` by rule 4 (not a collision); leaving it unasserted means the strongest
  statement of the `field-update` non-collision rule is not actually tested on the open path.
- **Suggested remediation target phase:** test_planning
- **Suggested fix:** Add the `open` + `CLOSED` → `ready` (non-refusal) row to the truth table, or drop
  that fixture case.

## Adjudication of the plan-reported residuals

**(a) DM-10 observability bound as resolver return + one line + zero persisted copies — sufficient for
AC-F2-2, but the spec needs one clarifying clause.** The plan's binding verifies every observably
checkable element of AC-F2-2: one value with exact fields (TC-CLI-011 deep equality including
`Object.hasOwn` for an absent `degradation`), exactly one rendered line (count 1, not `>= 1`), zero
persisted copies (no state file, capsule/event record, artifact key or schema key), no prior provider
request, and zero probe spawns under `api-only`, each with a mutation control. That is enough to
deliver and review the behaviour. What is *not* verifiable is the AC's carrier noun: the plan
explicitly refuses to attach the value to the client, a normalized view, a state record or the
artifact, and the composer holds it only as a closure value. Add the one clause in R3 so a coder does
not add a field and a reviewer does not demand one. Not a behavioural defect, hence minor.

**(b) The third composition state (absent selection fact) — an undeclared but operationally inert
state, not a widening of the delivered behaviour.** In this change the launcher is the only production
caller of `createProductionComposer` (pinned by the single-call-site scan), and it always supplies the
fact; the absent state therefore exists for composition tests and hypothetical embedders. It is what
keeps every delivered composition test probe-free with zero spawns, which is required by TC-CLI-010's
"never in the mock tier" and NFR-2. However it does contradict the spec's closed policy default
(`prefer-cli`) for any caller that omits the fact, and it makes DM-10's "one value" non-universal.
Accept it only if the spec names it (R4); do not treat it as self-approving.

**(c) `tests/structure/entrypoint-bin.test.ts` not declared in phase 2 — correct, the pins hold.**
Verified against the delivered test: it counts textual `createProductionComposer(` occurrences across
`packages/**` and requires exactly `packages/cli/src/bin-launcher.ts:1`; it forbids `process.` and
`output/serialize` in the launcher; it forbids exported module-level string-literal declarations in the
launcher; it scans working-name literals (the launcher declares none). The planned change is one
`await` of the resolver and one forwarded property on the existing facts object — no second call site,
no ambient read, no new export, no literal. The launcher remains the single composition body, and the
plan's phase-2 gate expects exactly that. Not declaring the file is the right call; the plan should
keep its "re-plan instead of widening scope" instruction, which it does.

**(d) Declarations left untouched in their phase → advisory `plan diff` `undeclared-missing`
findings — acceptable, with one correction.** Declaring a superset of paths is how the commit
primitive is given staging authority; an untouched declaration stages nothing and the advisory is
noise, not a gate failure. It becomes a defect only if it hides a required edit, which is why R6/R8
matter and why the ADR-0005 entry should be corrected (R10): that file is already committed, so phase 1
will report a declared-but-unchanged path for a file that needs no change at all. Treat the advisory
class as accepted and review it per phase; do not "fix" it by deleting declarations a later edit needs.

**(e) TC-BACKLOG-010's "invalid map with no `done` row" — the test plan asserts beyond the spec, and
beyond the decision record.** The spec's DM-6/§8.5 declare the seed, the vocabulary, the injection and
the writable set, but no validator rejection set; TDR-0035 §1 lists non-empty `systemName`, ≥1 row,
unique tokens, closed sets and ≤1 row per alias — no required `done` row. The plan adopted the test's
rule verbatim, so all three delivery-facing artifacts now carry a rule that only the test asserts. The
rule is defensible on its merits (the delivered closeout needs a `done` row to resolve), which is
precisely why it should be declared in DM-6 and in TDR-0035 §1 rather than invented by a case. Resolve
per R7.

## What is now sound (so the remaining pass stays surgical)

- Every iteration-1 blocker is genuinely closed at the level it was raised: the content-write shape is
  complete and asserted in both variants; the probe has an async home with all its files declared; the
  child-process site pin is in the owning phase with the exact 12 → 13 move; the label rule is
  mechanism-scoped in one voice across spec, record, plan and tests, with the delivered closeout write
  provably byte-identical; the read rule is one refusal class with four outcomes and a decided case
  rule; the degradation is a named, shaped, non-persisted value with a count-1 oracle; the read-back
  helper sits in the phase that first needs it.
- Traceability is still closed after the revisions: 40/40 ACs, 81/81 TCs, 0 orphans both directions,
  and the plan owns each id exactly once with declared split-case exceptions.
- The specification's current-state snapshot (§2.1) is now accurate against the delivered tree,
  including the pin-guarded child-process inventory and the pre-existing provider-surface doc drift.
- The four decisions are consistently cited (DEC-1…DEC-4 = TDR-0032…0034), the ADR-0005 pointer is
  committed, and none of the remediation asks to widen a record.

## May delivery start?

No. Two blocking majors remain and both are author-side, small, and local: the spec must carry
TDR-0035's terminal-read write refusal (R1 — without it AC-F6-3/NFR-11's symmetry claim is false for a
closed issue, and two existing TCs have unstated preconditions), and the test plan must reconcile
TC-CLI-005's route table with the phase-2 capability state (R2 — as written it requires client members
that must not exist until phase 3). `specification` reopens for R1, R3, R4, R7 and R9; `test_planning`
reopens for R2, R6, R8 and R11; `delivery_planning` needs only R5 and R10, which can ride the same
pass. No human decision is required and no pause is raised: R1's rule already exists in TDR-0035, so
the spec only has to carry it; if R7's `done`-row rule is kept, `@decision-advisor` should add it to
TDR-0035 §1 in the same edit. Everything else about the change is sound, and the remaining work is a
narrow third confirmation pass — not a redesign. If the third iteration confirms only R1/R2 closed and
the minors dispositioned, delivery can start.
