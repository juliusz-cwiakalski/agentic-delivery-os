# Readiness Review Iteration 3

Verdict: **READY**
Work Item: GH-338
Date: 2026-11-18
Pause Required: no

Reviewer: `@readiness-reviewer` (adversarial Definition of Ready gate), independent of the three
authoring agents. This is the third and final confirmation pass: it verifies the iteration-2
findings (R1–R11), checks for defects introduced by that remediation, and does not re-litigate
iteration-1 findings that iteration 2 confirmed closed.

Inputs read in full: `readiness-iter-1.md`, `readiness-iter-2.md`; `chg-GH-338-spec.md` v1.2
(696 lines); `chg-GH-338-test-plan.md` v1.2 (1184 lines); `chg-GH-338-plan.yaml` (1643 lines);
`chg-GH-338-pm-notes.yaml`; TDR-0032, TDR-0033, TDR-0034, TDR-0035 (§1, §2, §3.1–§3.3 read in
full), ADR-0005 (editorial pointer). Code re-read only where an artefact claim is checkable:
`packages/cli/src/entrypoint.ts` (self-description returns, `EntrypointComposer`, the single
composition call site), `packages/cli/src/bin-launcher.ts` (the single
`createProductionComposer(` call), `tests/structure/entrypoint-bin.test.ts` (the launcher pins),
`tests/types/provider-views.type-test.ts` (the read-view probe), plus existence checks on every
conformance/config/trap target the plan declares.

Machine checks (read-only): `plan validate GH-338` → `verdict=valid, tier=full,
readyForDevelopment=true` (this gate overrides the flag, not the other way round); AC↔TC bijection
recomputed from v1.2 → **40/40 ACs mapped, 81/81 TCs, 81/81 scenario-index rows, 81/81 detail
sections, 0 orphans both directions**, AC and TC counts stable at 40/81 across the last four
commits (no case or criterion was silently added or dropped by the remediation); plan TC→phase map
covers all 81 ids exactly once (13+14+15+12+12+6+9), AC ownership covers all 40 exactly once
(7+6+9+4+7+5+2); every TC's named `tests/**`/`packages/**` target checked programmatically against
the owning phase's `scope.files` — see “Scope verification” below; `git status` still shows only the
four TDRs untracked, and ADR-0005's editorial pointer is committed (`f2c2ad27`), clean.

## Facet Summary

- spec_completeness: PASS (one minor scoping residual recorded, not blocking)
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS (five bookkeeping contradictions recorded as delivery notes; none
  changes a contract shape or blocks a gate)
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Iteration-2 findings — disposition

| ID | Severity then | Status | Evidence |
|---|---|---|---|
| R1 terminal-read write refusal absent downstream | major | **Resolved** | Spec carries it in F-6 (127), Flow 6 (187), Table A (284), §8.4.1 writable set (338) and the new “Write resolution against the current read” paragraph (340), §8.5 (361) and NFR-11 (381). **AC-F6-4 owns it**, AC-F6-3 cross-references (“never attempted and refuses per AC-F6-4”, 528) and AC-F6-5 declares the distinctness from the map-only refusal (530). TDR-0035 §3.2 states the same rule with the same cause. TC-BACKLOG-004 (735–737) asserts it in two variants (labelless `closed` and `closed` carrying `in-progress`/`review`) so label-independence is positive, and TC-BACKLOG-006 (753–755) asserts the two refusals by *different details* with the `labelless-open-issue` pin, plus the paired `field-update` `done` half. §7.2/obligation 3.5 carry both fixtures. |
| R2 TC-CLI-005 requires members that cannot exist in phase 2 | major | **Resolved** | TC-CLI-005 (343–351) now declares exactly the seven operations whose members exist after phase 1 (`read-work-item`, `write-work-item`, `transition-work-item`, `read-delivery-request`, `read-pipeline-run` + list page, `resolve-delivery-thread`, `merge-delivery-request`), names the two excluded writes and the exact reason (a gapped operation's write member must not exist), and declares the phase-3 extension of the **same** table under the same case id, explicitly disclaiming that the phase-2 table is final. TC-CLI-002 (321–323) makes the two gap-operation argv rows transport-level only; TC-CLI-012 (412) uses the landing/delivered write instead of a comment route. Plan 2.7/3.8 and §7.5 match line for line. |
| R3 DM-10 named an unreachable carrier | minor | **Resolved** | DM-10 (270) is now “the value produced by composition selection: returned by the resolver and consumed by the launcher”, “not a field on the client, the composed program object, or any normalized view”, “only observable surface is exactly one rendered diagnostic line”. F-2 (115), Table C (307), §10 (386), AC-F2-2 (487), glossary (604), plan refinement 7f (372–381) and obligation 2.3, and TC-CLI-011 (404–405) all restate that same observable set. TC-CLI-011 deep-equals the resolver value, counts lines at exactly 1, asserts zero persisted copies, and pins the composed object's key set with a planted-extra-key mutation. |
| R4 third composition state undeclared | minor | **Resolved** | Declared identically in spec F-2 (115), Table C Policy (306), DM-10 (270) and §8.5 (358); in test plan §1.1, §3.2 DM-10 row (149), TC-CLI-011 (`{probeSpawns: 0, lines: 0, value: none}`), §8.2 (1145); in plan refinement 7e (362–371), phase-2 header (842–849) and obligation 2.3. The “no default is inferred for a caller that omits it” clause closes the earlier contradiction with the `prefer-cli` default. |
| R5 probe placement also hits non-composing invocations | minor | **Resolved** | Plan now binds it three ways: phase-2 header “SPAWN BUDGET: PER COMPOSITION, NOT PER LAUNCHER INVOCATION” (819–826) naming the site, the assertion and the owning case; obligation 2.9 (923–933) giving the assertion method (driving the delivered entrypoint with a recording composer shows each self-description argv returns without invoking it) plus a structural scan proving the `await` sits inside the wrapper; and refinement 7c/7d explaining *why* (the entrypoint returns before `composeProgram`). Verified against the delivered code: `--version`, `--print-install-path`, root `--help`, and known command `--help` all return before the composition call, so the probe provably cannot run there. See delivery note N4 for the one residue (the test plan's own TC-CLI-010 oracle text is narrower than the plan's obligation). |
| R6 TC-PARITY-006 assertion site undeclared | minor | **Resolved** | TC-PARITY-006 (904–907) now asserts inside `tests/conformance/github-transport-parity.test.ts` (phase-2 scope), with the guard primitive in `tests/conformance/support/fixtures.ts` and the shared installer argument spelled out. The plan also declares `tests/conformance/mock-conformance.test.ts` in phase 2 (990), so both placements are stageable; see delivery note N2 for the residual wording disagreement. |
| R7 TC asserts a validator rule no artefact declares | minor | **Resolved** | TDR-0035 §1 now declares the seven-rule rejection set as an explicit amendment, including rules 6 (no `done` row) and 7 (`done` row must be the `field-update` row on native `closed`), with the rationale grounded in §3.2's binding on the delivered closeout write. Spec DM-6 restates the same seven rules and the construction-once-on-the-resolved-map timing with a captured (not thrown) failure, a named refusal on the first operation and zero provider requests; AC-F6-3 carries the seven rules verbatim. TC-BACKLOG-010 (788–790) enumerates one invalid map per rule, states “**TDR-0035 §1** and spec DM-6; this case asserts that contract and is never its authority”, and asserts one validation per construction across two operations, no throw at import, and the named first-operation refusal. Plan refinement 9 and phase-3 obligations (1044–1059) cite the record as authority and no longer say “per TC-BACKLOG-010's invalid-map set”. |
| R8 three undeclared split cases + vacuous `provider-views` note | minor | **Resolved** | TC-BACKLOG-009 now scans inside `tests/structure/config-contract.test.ts` with `tests/checks/config-default-positions.test.ts` (both phase-3 scope); TC-PARITY-001/002 name `tests/structure/conformance-coverage.test.ts` as a phase-1 read-only control; TC-PARITY-009 re-binds the contract-inventory pair to phase 1; TC-PARITY-010 drops the `provider-views` claim; TC-PARITY-005 marks the trap files phases 1–5 and re-binds its roll-up; TC-FLOOR-001 moves the catalog diff to phase 3; TC-FLOOR-002/003/004/005 and TC-THREAD-009 mark every delivered file a control with its authoring phase named. Programmatically confirmed: every remaining “undeclared by the owning phase” path is one of the four explicitly-marked read-only controls (`entrypoint-bin.test.ts`, `issues.json`, `conformance-workflow.test.ts`, the two error-table suites) or a file the case names as another phase's control. See notes N2/N3 for three residual wording disagreements that no gate depends on. |
| R9 three globally-false spec sentences | minor | **Resolved** | §8.5 (355) now says “`GithubClientOptions` gains exactly one additive optional member, `workflowMap`; every other delivered option member and the factory's return type keep their delivered shape … existing call sites keep compiling”, F-6 (123) scopes “no new operation” to the content write and names DM-1/DM-2 as the change's entire additive core surface, and AC-F6-1 (526) repeats the scoped form. TDR-0035 §1 remains the authority for the option. Residual: TDR-0032 item 8 keeps the older global phrasing — delivery note N6. |
| R10 two plan-bookkeeping nits | nit | **Resolved (one residue)** | COMMIT-BOUNDARY REALITY (101–115) now states ADR-0005 is already committed (`f2c2ad27`) and clean and that phase 1 declares nothing for it; refinement 7b/7c/obligation 2.2 name two distinct resolvers (`resolveTransportSelection` pure/sync in the adapter, `resolveCompositionTransportSelection` async at the launcher edge) and forbid an import alias. Residue: the test plan still names the old symbol once — delivery note N1. |
| R11 TC-BACKLOG-008 fixture case unasserted | nit | **Resolved** | The truth table is now seven rows (772–773) and row (2) is exactly the `open` + `CLOSED` → `ready` native-fallback observation, with a third mutation that fails if `CLOSED` on an open issue ever produces a label-derived alias. §7.2's `workflow-map-cases.json` row repeats both observations. |

No iteration-1 finding reopened. No iteration-2 finding is still open.

## Adjudication — phase-2 `packages/cli/src/entrypoint.ts` scope delta

**Legitimate additive scope delta; accepted.** The change widens `EntrypointComposer`'s return type
to `CommandProgram | Promise<CommandProgram>` and awaits the composed program at the entrypoint's one
composition call site.

- **Declared, not smuggled.** `packages/cli/src/entrypoint.ts` is in phase-2 `scope.files` (977) with
  an explicit reason, and the mechanism is stated in refinement 7c (342–348) and obligation 2.2
  (870–885). It is not a scope discovery made mid-phase.
- **Additive in the type sense.** `() => CommandProgram` remains assignable to
  `() => CommandProgram | Promise<CommandProgram>`, so every delivered synchronous injector keeps
  compiling — the repo has dozens of them across `tests/**`, and none of them is in scope because
  none needs to change. The only consumer of the return value is the entrypoint's own composition
  call site, which is adapted in the same commit.
- **Not a core contract.** `EntrypointComposer` is a CLI host-integration seam. Spec §8.5's
  additive-within-v1 rule and DEC-5 govern the core adapter contracts (DM-1/DM-2), which are
  untouched here; widening a host seam is not a normalized-view, capability or operation change.
- **No pin is violated.** `tests/structure/entrypoint-bin.test.ts` forbids `process.` and
  `output/serialize` in the launcher, forbids exported module-level string literals, and requires
  exactly one textual `createProductionComposer(` call site in
  `packages/cli/src/bin-launcher.ts`. An inline async wrapper inside `runBinLauncher` satisfies all
  three, and the plan's obligation 2.9 states the structural consequence it must preserve.
- **The alternative is worse.** With a synchronous composer the Promise-based probe cannot run
  without either probing at module load or probing per launcher invocation — both directly
  contradict spec Table C and both would leak a probe onto `--version`/`--help`.
- **One implementation constraint (delivery note N7).** The `await` must stay *inside* the existing
  `try { … } catch` around composition, so a rejected composition still yields the containment
  identity rather than an unhandled rejection. The plan says “accept and await a promised program”;
  it does not say where the `try` boundary sits, and that boundary is behaviourally load-bearing for
  the delivered synchronous path too.

## Scope verification (code-area coverage)

Every TC → owning phase → declared file mapping was checked mechanically. Result: 81/81 cases name
only paths their owning phase declares, except the four cases that explicitly declare a path a
read-only control, each of which names the authoring phase:

| Case | Undeclared-by-owner path | Status |
|---|---|---|
| TC-CLI-011 | `tests/structure/entrypoint-bin.test.ts` | Read-only control, “not edited”, pins verified to hold |
| TC-BACKLOG-011 | `tests/fixtures/providers/github/issues.json` | Read-only control (“delivered, read only — no edit, so no phase declaration is needed”) |
| TC-FLOOR-003 | `tests/checks/conformance-workflow.test.ts` | Read-only control, contract unchanged |
| TC-FLOOR-005 | `tests/structure/error-table.test.ts`, `tests/checks/error-table-sync.test.ts` | Satisfied as delivered; a case needing an edit would be re-planned, not re-scoped |

Spot-checks beyond the automated sweep (ten-plus cases across phases 1–7): TC-PARITY-006 (assertion
site in phase-2 scope), TC-PARITY-005 (per-entry authoring phases 1–5 + phase-7 roll-up in
`mock-conformance.test.ts`, both declared), TC-BACKLOG-009 (both config suites are real and in phase
3), TC-PARITY-010 (both type probes in phase 1), TC-FLOOR-001 (trap-catalog diff in phase 3, control
runs in phase 7), TC-FLOOR-002/003/004/005 (controls with authoring phases named), TC-LAND-001
(type probe + landing suite + inventory, phase 1), TC-CHECK-012 (`check-log-excerpt.type-test.ts`,
phase 4), TC-THREAD-009 (`delivery-thread.type-test.ts`, phase 5), TC-REF-001→006 (document +
locator + drift suite, phase 6), TC-FLOOR-007 (`closeout-contract.test.ts`,
`delivery-thread.type-test.ts`, `status-additive-v1.type-test.ts`, `reference-behavior.test.ts` — all
phase 7).

## Delivery notes (minor / nit — no phase reopens; the coder ships past these)

Each note names the owning plan phase and the instruction to follow. None blocks a phase gate, and
none requires the coder to guess a contract shape: in every case at least one alternative is declared
and stageable, and the observable behaviour is pinned by an accepted oracle.

| # | Severity | Facet | Artefact + location | Gap | Owning phase / instruction |
|---|---|---|---|---|---|
| N1 | nit | cross_artifact_consistency | `chg-GH-338-test-plan.md` TC-CLI-011 (402) | Names `resolveGithubTransportSelection` in `production.ts`; the plan, TDR-0032 and obligation 2.2 name `resolveCompositionTransportSelection` (async) and `resolveTransportSelection` (pure adapter) as two distinct functions. Stale symbol. | Phase 2 — implement the plan's names. Treat `resolveGithubTransportSelection` as a stale reference, not a required export. Do not import either under an alias. |
| N2 | nit | cross_artifact_consistency | `chg-GH-338-plan.yaml` obligation 2.6 (902–906) + phase-2 scope comment (987–990) vs `chg-GH-338-test-plan.md` TC-PARITY-006 (904–907) | Plan says TC-PARITY-006's assertion site is `tests/conformance/mock-conformance.test.ts` “declared here”; the test plan says that file is not named “because phase 2 does not declare it” and puts the firing-canary assertion in `github-transport-parity.test.ts`. Both files are declared in phase 2, so no gate fails either way. | Phase 2 — satisfy TC-PARITY-006 where the test plan says (firing canary in `tests/conformance/github-transport-parity.test.ts`); a per-suite counter assertion in `mock-conformance.test.ts` is permitted but not required. |
| N3 | nit | plan_code_area_coverage | `chg-GH-338-plan.yaml` split-case notes (195–197) and phase-1 acceptance (698–702) vs test plan TC-PARITY-010 (941–942) | Plan says the `provider-views` probe half lands in phase 1 and `tests/types/provider-views.type-test.ts` is declared there; the test plan says no phase declares it and the sentence must be dropped. The file exists and declares no `PipelineJob` member, so the probe compiles unchanged either way. | Phase 1 — do not edit `tests/types/provider-views.type-test.ts` unless the ninth operation or the timings actually break its assertions; a declaration left untouched is advisory only. |
| N4 | nit | test_traceability | `chg-GH-338-test-plan.md` TC-CLI-010 (389–396) vs plan obligation 2.9 (923–933) | The plan's spawn budget (one probe for a composing invocation, **zero for each of the four self-description paths**, plus a structural scan of `bin-launcher.ts`) is only partially restated in the test plan's TC-CLI-010 oracle, which says composition-only / not-module-load / not-per-request / not-mock-tier. The plan is the fuller statement and the code provably supports it. | Phase 2 — author TC-CLI-010 with the plan's full budget (four self-description paths, zero spawns each, zero provider requests) **and** the structural scan; the test plan's narrower wording is a floor, not a ceiling. |
| N5 | nit | cross_artifact_consistency | Plan split-case note (204–206) vs test plan TC-BACKLOG-009 (779–781) and §7.5 (1100) | Plan places TC-BACKLOG-009's config-surface scan in `tests/structure/reference-behavior.test.ts` (declared in phase 3); the test plan forbids that and puts the scan in `tests/structure/config-contract.test.ts`. Both are declared in phase 3. | Phase 3 — put the scan in `tests/structure/config-contract.test.ts` (test plan is the oracle) and leave `reference-behavior.test.ts` to phase 6's drift suite. |
| N6 | nit | decision_capture | `doc/decisions/TDR-0032` item 8 (283) and implementation item 2 (326) vs TDR-0035 §1 and spec §8.5 | TDR-0032 still says `createGitHubClient` and `GithubClientOptions` “keep their delivered shape … unchanged apart from documentation”, while TDR-0035 §1 adds the optional `workflowMap`. Spec §8.5 and plan refinement 1 already state the additive form unambiguously. | Phase 1 (optional) — if TDR-0032 is touched at all, align item 8/step 2 to “gains exactly one additive optional `workflowMap`; nothing else moves”. Do not treat the older sentence as a prohibition on the option. |
| N7 | nit | spec_completeness | `chg-GH-338-spec.md` §8.4.1 “Write resolution against the current read” (340), first sentence | “**A transition** is resolved against the issue's **current read** result” reads globally, but a `field-update` transition performs no read at all — the delivered closeout `done` write is one state-only `PATCH` with zero label requests and no new refusal. Added by the R1 remediation. The paragraph's own label-swap sentence, AC-F6-4, §8.5 (360–361), TDR-0035 §3.2, plan 3.7 and the TC-BACKLOG-006/TC-FLOOR-001 oracles all scope it correctly. | Phase 3 — read the sentence as `label-swap`-scoped. **Do not add a pre-write read to the `field-update` path**: request count must stay 1 with body exactly `{"state":"closed"}`. |
| N8 | nit | cross_artifact_consistency | Plan split-case note (211–214) and obligation 7.2 (1546–1554) vs test plan TC-PARITY-005 (897–898) and §7.5 (1097) | Plan says phase 7's TC-PARITY-005 assertion extension lands in `tests/behaviour/providers/github-trap.test.ts` over `github.traps.json`; the test plan says phase 7 edits no trap file and rolls up in `mock-conformance.test.ts`. Both trap files are declared in phase 7, so staging works either way. | Phase 7 — extend **assertions** only. Do not add or amend trap **entries** (they belong to phases 1–5); TC-FLOOR-001 fails on a second delivered entry amendment, and every new entry must already exist with a resolving `fixtureReference`. |
| N9 | nit | cross_artifact_consistency | Plan phase-2 “the four self-description paths” (820–826) and TC-CLI-010 acceptance (938) | A fifth non-composing path exists: a command-scoped `--version` on a known command also returns before composition. The plan's “four” is the named set, not an exhaustive one. | Phase 2 — the probe must not run on any path that returns before `composeProgram`; the four named paths are the minimum assertions, a fifth may be added. |
| N10 | nit | test_traceability | `chg-GH-338-test-plan.md` TC-CLI-013 (416–423) vs TC-CLI-011 (404–405) and plan 2.9 | TC-CLI-013 asserts “three requests ⇒ exactly three spawns”, while a composed CLI client also records one probe spawn. The mutation wording (“probe plus request under composed CLI”) hints at composition, so the arithmetic needs a stated boundary. | Phase 2 — build TC-CLI-013's three-request sequence on an already-selected CLI transport (so the count is exactly 3) and leave probe counting to TC-CLI-010/011; if the case is driven through composition, assert 3 request spawns + 1 probe and say so. |
| N11 | nit | cross_artifact_consistency | Plan obligations 3.5/3.7 (1147, 1177) vs test plan TC-BACKLOG-006 (753) and §7.2 (1056) | Plan refers to a single `workflow-map-cases.json#labelless-issue`; the test plan splits it into `labelless-open-issue` (signal refusal) and `labelless-closed-issue` (terminal refusal). | Phase 3 — use the test plan's two keys, or add `labelless-issue` as a native-`open` alias. What must not move: the signal-refusal fixture is native `open`. |
| N12 | nit | decision_capture | `chg-GH-338-pm-notes.yaml` note (95–102) and note (133–150) | No note records the iteration-2 verdict or the v1.2 artefacts; one note still describes DM-10 as “composition data on the composed runtime” (R3's superseded phrasing) and one enumerates only three production child-process sites (the delivered pin lists twelve). | `@pm` bookkeeping, not a delivery phase — append the iteration-2/iteration-3 verdict notes and the v1.2 revision note. **Coder instruction:** trust the plan's child-process pin (12 → 13) and spec §2.1's pin-guarded inventory, never the older enumeration. |

Nothing here reopens `specification`, `test_planning` or `delivery_planning`.

## What is sound (so delivery does not re-litigate)

- The four accepted decisions are used as authorities rather than paraphrased into test cases: the
  validator's rejection set and timing live in TDR-0035 §1, the four read outcomes in §3.1, the
  mechanism-scoped write and the terminal-read refusal in §3.2 — and spec, plan and test plan each
  cite them instead of inventing a rule.
- The delivered closeout terminal write is protected by four independent oracles (spec §8.5,
  AC-F6-4's `field-update` half + §24.3 #9, plan 3.7, TC-BACKLOG-006/TC-FLOOR-001's exact
  `PATCH {"state":"closed"}` with zero label requests), all with paired positives and mutations.
- Traceability is closed both directions after two remediation rounds: 40 ACs, 81 TCs, zero orphans,
  and the plan owns each id exactly once with declared split-case exceptions.
- The composition seam is fully declared (adapter resolver, production resolver, entrypoint
  composition call site, launcher wrapper) and every file it needs is in phase-2 scope, including the
  two pins that would otherwise fail the phase's own gate (`harness-imports.test.ts`,
  `mock-conformance.test.ts`) and the one file the mechanism forces open (`entrypoint.ts`).
- Documentation update coverage is named at sentence level for lifecycle phase 7 and staged in phase 7
  scope, with phase 6 authoring the normative surface it must agree with — no phase-7 discovery.
- No new decision is needed, no human input is required, and no override is in play: this change
  touches behaviour, contracts and the delivery workflow, so the triviality bypass is not available
  and is not being used.

## May delivery start?

**Yes.** Both iteration-2 blockers are genuinely closed — the terminal-read write refusal now exists
in the spec, the record, the plan and two write cases with distinguishable details and the
labelless-`open` pin, and TC-CLI-005's route table is restricted to the members that exist at its
phase boundary with the two write routes declared a phase-3 extension of the same case — and the
remediation introduced no blocker, no unprovable AC and no phase whose gates cannot pass. The twelve
remaining items are bookkeeping-level (file homes, a stale symbol, fixture keys, two over-wide
sentences) where at least one declared alternative is always stageable and the behaviour is pinned by
an accepted oracle; they are recorded above as delivery notes and must not reopen a phase. The coder
must watch five things while executing: **never** add a read or a label access to the `field-update`
`done` path (one `PATCH`, body exactly `{"state":"closed"}`, zero label requests); keep the probe
strictly behind the composition path — the `await` belongs inside the launcher's wrapper and inside
the entrypoint's existing `try`, so `--version`/`--help`/`--print-install-path`/command-help stay at
zero spawns and a rejected composition still yields the containment identity; keep DM-10 to exactly
one resolver value plus one rendered line with zero persisted copies and no new key on the composed
object; put the config-surface scan in `config-contract.test.ts` and treat the trap entries as
phases 1–5' property; and treat TDR-0035 §1/§3.1/§3.2 as the authority whenever a case and a record
seem to disagree, re-planning rather than widening scope if a pin outside phase scope must move.
