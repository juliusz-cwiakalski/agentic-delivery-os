# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-338
Date: 2026-11-17
Pause Required: no

Reviewer: `@readiness-reviewer` (adversarial Definition of Ready gate).
Inputs read in full: ticket GH-338 (body; zero comments via GitHub API), M3 blueprint
(`doc/planning/oss-tooling/milestones/m3/{README,architecture,contracts,test-scenarios,open-questions,backlog,ranking}.md`),
M3 questions ticket #342 (open, zero comments — defaults apply, confirmed), `chg-GH-338-spec.md` v1.0,
`chg-GH-338-test-plan.md` v1.0, `chg-GH-338-plan.yaml`, `chg-GH-338-pm-notes.yaml`,
TDR-0031..TDR-0034, and the current system truth: `doc/spec/features/feature-adapter-ports.md`,
`feature-provider-client-seeds.md`, `feature-adapter-conformance.md`, `feature-merge-verify-deploy.md`,
plus the real code in `packages/core/src/contracts/`, `packages/adapters/src/{github,gitlab,jira}/`,
`packages/testkit/src/conformance/`, `packages/cli/src/{production,bin-launcher,entrypoint}.ts`,
`tests/structure/`, `tests/conformance/`, `tests/fixtures/providers/`.

Machine checks performed (read-only): `plan validate GH-338` → `verdict=valid, tier=full,
readyForDevelopment=true`; AC/TC bijection computed from the artifacts (40/40 ACs, 81/81 TCs,
0 orphans in both directions); `bun test tests/checks/decision-record.test.ts` → 4 pass (the four
Proposed TDRs and their `doc/decisions/00-index.md` rows are already valid); `git status` confirms the
four TDRs are untracked exactly as the plan's COMMIT-BOUNDARY REALITY block states.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Findings

### F1 — `write-delivery-request` "create" has no defined argument shape (blocker)

- **Facet:** spec_completeness / ac_quality
- **Severity:** blocker
- **Artifact + location:** `chg-GH-338-spec.md` §5 F-6 (line 122), §8.1 API-6 (line 239), §17.6 AC-F6-1 (line 500); mirrored by `chg-GH-338-test-plan.md` TC-BACKLOG-002 (lines 709–716) and TC-PARITY-003 (lines 870–877).
- **Gap:** Closing the `write-delivery-request` gap is a headline capability (AC-F1-1 needs GitHub at 9/0; the `change-lifecycle.create-delivery-request` step must execute instead of skipping). F-6/API-6/TC-BACKLOG-002 require the operation to "create or update title/body", but creating a GitHub delivery request is `POST /repos/{o}/{r}/pulls` and needs at least `head` and `base` (plus optional `draft`); the adapter has no address for them. There is no canonical argument type for this operation anywhere in `packages/core/src/contracts/` (the operation is only a name in `ADAPTER_OPERATIONS`), so the delivery must invent the create inputs — exactly the "contract invented during delivery" the spec's own §24.3 forbids. `TDR-0032` item 3 asserts `createDeliveryRequest`/`updateDeliveryRequest`, so the TDR assumes a create the spec never shapes.
- **Suggested remediation target phase:** specification
- **Suggested fix:** Declare the adapter-local write shape for GitHub's `write-delivery-request` — either (a) state the create inputs (`head` ref, `base` ref, optional `draft`) plus the update path (partial title/body) and add them to the tenant addressing and TC-BACKLOG-002/TC-PARITY-003 fixtures, or (b) narrow F-6/API-6/AC-F6-1 to update-only and record the create as a declared limitation (then AC-F1-1's "zero gaps" wording must be reconciled with an operation that is "supported" for update only).

### F2 — Phase 2 cannot run the probe as specified: composition is synchronous (blocker)

- **Facet:** plan_coverage / plan_code_area_coverage
- **Severity:** blocker
- **Artifact + location:** `chg-GH-338-plan.yaml` phase 2 obligations 2.1–2.2 and refinement 5 (lines 493–558, 202–207); contrasted with `packages/cli/src/entrypoint.ts:73-77` (`EntrypointComposer = (brand, invocation?) => CommandProgram`, synchronous), `packages/cli/src/entrypoint.ts:412-430` (synchronous `composeProgram(...)` call), `packages/cli/src/bin-launcher.ts:46-69` (the only async site; it builds the composer before `runEntrypoint`), and `packages/adapters/src/git/index.ts:27-36` / TDR-0031 item 2 (the runner seam is `Promise`-returning).
- **Gap:** The probe (`gh --version` through the `execFile` runner) is asynchronous, but the composer it must run in is synchronous and is invoked synchronously. TDR-0031 requires the selection to happen "at composition time only" and the plan places it in `createProductionComposer` with the policy as `ProductionCompositionFacts`. As scoped, there is no async boundary where the probe can run: either the launcher (`packages/cli/src/bin-launcher.ts`) must await the probe and pass its result as a fact, or `EntrypointComposer` must become async (touching `entrypoint.ts` and its callers). Neither file is in phase 2's scope, and the plan's mitigation ("an injected `githubTransport` keeps bypassing the probe so every delivered composition test stays probe-free") cannot hold at launcher level, because the launcher does not see the injected transport. A lazy per-client probe would contradict spec Flow 1 ("the client receives one transport") and TDR-0031 item 6, and a `spawnSync` probe would contradict TDR-0031 item 2's Promise-shaped runner.
- **Suggested remediation target phase:** delivery_planning
- **Suggested fix:** Bind one option explicitly and declare its files: (a) probe in `bin-launcher.ts` before composition, with an injectable probe seam (add `packages/cli/src/bin-launcher.ts` and, if its statement/import assertions move, `tests/structure/entrypoint-bin.test.ts` to phase 2 scope, and state that production tests inject the probe result so zero spawns occur); or (b) make the composer async and declare `packages/cli/src/entrypoint.ts` plus every composition-test file that calls `composeProgram`. Add one sentence to the spec's Table C naming where the probe runs relative to composition so §8.4.1 and the plan agree.

### F3 — Phase 2 scope omits the exact child-process site-set pin, so the phase cannot be green (blocker)

- **Facet:** plan_code_area_coverage
- **Severity:** blocker
- **Artifact + location:** `chg-GH-338-plan.yaml` phase 2 `scope.files` (lines 564–588); `tests/structure/harness-imports.test.ts:20-32` (`DECLARED_CHILD_PROCESS_SITES`, twelve files) and `:67-78` (exact set equality over every `packages/**` TypeScript file).
- **Gap:** The new CLI transport introduces `node:child_process` inside `packages/adapters/src/github/`. `.dependency-cruiser.cjs` admits the subpath wholesale, so the boundary rule stays green — but `tests/structure/harness-imports.test.ts` pins the *delivered* spawn-site set with an exact-equality assertion covering additions *and* removals. Adding one site fails that test by name, and neither the test file nor its site list is declared in phase 2, so phase 2's own gate ("`bun test tests/structure` exit 0", plan line 554) cannot pass. Note this also disproves the spec's §2.1 claim of three delivered child-process sites (see N1).
- **Suggested remediation target phase:** delivery_planning
- **Suggested fix:** Add `tests/structure/harness-imports.test.ts` to phase 2 scope with the obligation "extend `DECLARED_CHILD_PROCESS_SITES` with the exact new file and update the scan's header comment so the set stays a declared site inventory, never a prefix or wildcard".

### F4 — A `field-update` (`closed` → `done`) transition's label behaviour is contradictory across spec and TDR, and it silently changes delivered closeout

- **Facet:** cross_artifact_consistency / ac_quality
- **Severity:** major
- **Artifact + location:** `chg-GH-338-spec.md` §5 F-6 (line 122: "Label-based transitions remove only declared lifecycle label tokens ... and refuse when the current label signal is unavailable") and §17.6 AC-F6-4 (line 503: "**Given** a label-based transition ..."); `TDR-0034` §3 "Write" (line 298: "**Every** transition then removes the declared lifecycle label tokens that are present ... An unavailable label signal refuses the write"); `chg-GH-338-plan.yaml` phase 3 obligation 3.1 (lines 626–627), which says only "keep `open`/`closed` normalization exactly as delivered" and is silent on the write; current code `packages/adapters/src/github/client.ts:100-107` (input narrowed to `deliveryState: "done"`) and `:451-458` (PATCH `{ state: "closed" }` only).
- **Gap:** Three readings exist. Spec AC-F6-4 scopes token removal and the unavailable-label refusal to *label-based* transitions; TDR-0034 applies both to *every* transition; the plan says nothing. Under the TDR reading, the delivered terminal `done` write gains a label read-modify-write (an extra `GET /issues/{n}` before the PATCH) and a brand-new refusal path — closing a ticket would now fail when the label signal is unavailable, where it currently succeeds, and `tests/behaviour/providers/github-closeout.test.ts` plus `tests/fixtures/providers/github/closeout-issues.json` (labels include `in-progress`, `review`) change behaviour that AC-F6-4 never asked to change. Under the AC reading, TDR-0034's sentence is wrong and would need narrowing. Either way the artifacts disagree, and `TC-FLOOR-001` ("delivered suites stay green") plus the plan's scope do not acknowledge it.
- **Suggested remediation target phase:** specification
- **Suggested fix:** State the rule once, explicitly, for the field-update rows: either "a field-update transition writes only the provider state and never reads or writes labels (delivered `done` behaviour preserved)" — and narrow TDR-0034's sentence to label-swap rows via `@decision-advisor` — or "every transition sweeps declared lifecycle label tokens and refuses without the label signal", in which case add the delivered closeout suite/fixture changes and the new refusal consequence to spec §8.5 and to phase 3 obligation scope.

### F5 — Read-side handling of an unmapped or case-mismatched label token is self-contradictory inside the spec and unimplementable as tested (major)

- **Facet:** cross_artifact_consistency / spec_completeness
- **Severity:** major
- **Artifact + location:** `chg-GH-338-spec.md` §24.4 Appendix D (line 631: "whether label casing affects token matching (**a mismatch is a visible refusal**)"); `TDR-0034` §3 "Read" (line 297: "otherwise the first row in declared precedence whose token matches a present label wins; **otherwise the native state row (`open`)**. An issue matching no row is a visible normalization failure, never a default"); `chg-GH-338-test-plan.md` TC-BACKLOG-008 (lines 763–770: "the result is a visible refusal (unmapped) rather than a silent case-insensitive match **or a default**").
- **Gap:** An open issue labelled `In-Progress` matches no declared token, so TDR-0034's read rule falls back to the `open` row and normalizes to `ready`; TC-BACKLOG-008 (mapped to AC-F6-5) asserts a visible refusal instead. Because the seed always contains an `open` row, "an issue matching no row is a visible normalization failure" is unreachable — the TDR's own sentence is dead. The test oracle therefore asserts behaviour the declared read rule forbids, and the spec states two different answers in two places.
- **Suggested remediation target phase:** specification
- **Suggested fix:** Decide and state the read-side rule for an unrecognized label token: (a) native-state fallback (then delete the "visible failure" sentence and re-scope TC-BACKLOG-008 to the write direction only), or (b) a visible refusal when the issue carries any label that is in the declared lifecycle label vocabulary but does not equal a declared token (then say so in F-6 and keep TC-BACKLOG-008). Add the matching correction to `TDR-0034` §3.

### F6 — AC-F2-2's "declared degradation recorded" has no declared shape or home (major)

- **Facet:** ac_quality / spec_completeness
- **Severity:** major
- **Artifact + location:** `chg-GH-338-spec.md` §5 F-2 (line 114), §8.4.1 Table C (line 294), §17.2 AC-F2-2 (line 461), §10 (line 365: "A transport-in-use declaration beyond the composition edge is deliberately deferred"), DM-1..DM-8 (lines 248–257 — no degradation record); `chg-GH-338-test-plan.md` TC-CLI-011 (lines 395–402: "degradation record present exactly once"); `chg-GH-338-plan.yaml` reported deviation (3) and refinement 5 (lines 202–207).
- **Gap:** "Recorded" is asserted as an obligation in the AC and as a case oracle, but no data-model element, no field name, no shape, and no observable surface are declared; §10 simultaneously forbids persisting or widening anything for it. The plan resolves it as "composition data on the composed runtime, never persisted", which is a delivery decision that reinterprets an AC clause. A coder and a reviewer can both be "right" about whether TC-CLI-011 passes, which is exactly what a DoR gate must prevent for a criterion the plan marks as owned by phase 2.
- **Suggested remediation target phase:** specification
- **Suggested fix:** Add one line to DM-* (e.g. "DM-9: composition transport selection facts — `{ policy, selected, degradation?: { code } }`, in-memory only, never persisted, never in the conformance artifact") and point AC-F2-2, Table C, TC-CLI-011 and the plan at it. If no such surface is wanted, delete "recorded" from F-2/AC-F2-2 and the TC-CLI-011 assertion.

### F7 — Phase 1 owns read-back cases whose declared test home is not in phase 1 scope (major)

- **Facet:** plan_code_area_coverage
- **Severity:** major
- **Artifact + location:** `chg-GH-338-plan.yaml` phase 1 acceptance (lines 417–424: TC-LAND-004/005) and refinement 3 (lines 189–194: "Read-after-write cases (TC-BACKLOG-004/010, **TC-LAND-004**) therefore use a stateful scripted transport helper **added to `tests/behaviour/providers/support.ts`**"); phase 1 `scope.files` (lines 440–484) omits `tests/behaviour/providers/support.ts`; the file is declared only in phases 2 and 3 (lines 576, 686); `packages/testkit/src/conformance/mock-tenant.ts` is stateless and body-keyed, so the read-back case genuinely needs the scripted transport.
- **Gap:** The plan states where the helper lives and then omits that file from the phase that owns the first case needing it. Under the commit primitive's declared-scope staging this makes phase 1's commit either incomplete (helper written but unstaged → stray) or impossible as described.
- **Suggested remediation target phase:** delivery_planning
- **Suggested fix:** Add `tests/behaviour/providers/support.ts` to phase 1 `scope.files` with the obligation "add the stateful scripted transport helper (reused by phases 3 and 5 read-back cases)", or bind TC-LAND-004's read-back to a helper local to `github-landing.test.ts` and say so.

### N1 — Spec §2.1 misstates the delivered child-process site set (minor)

- **Facet:** system_spec_consistency
- **Severity:** minor
- **Artifact + location:** `chg-GH-338-spec.md` §2.1 (line 41).
- **Gap:** "the delivered production child-process sites are the harness host, the local git seam, and the daemon supervisor" is false: `tests/structure/harness-imports.test.ts:20-32` enumerates twelve sites, including `adapters/src/file/commitlint.ts`, `adapters/src/session/{index,commit-one-shot}.ts`, `adapters/src/daemon/process.ts`, and `core/src/state/driver/runtime-edge.ts`. The load-bearing claim (no *provider* subpath has one) is true; the enumeration is not.
- **Suggested remediation target phase:** specification
- **Suggested fix:** Replace the enumeration with "no provider client subpath has one; the delivered child-process sites are enumerated by `tests/structure/harness-imports.test.ts`" or list them correctly.

### N2 — TC-PARITY-003's create/update oracle contradicts the one-step registry resolution (minor)

- **Facet:** cross_artifact_consistency
- **Severity:** minor
- **Artifact + location:** `chg-GH-338-test-plan.md` TC-PARITY-003 (lines 870–877) vs `chg-GH-338-plan.yaml` refinement 2 (lines 179–188) and the claim at lines 307–314 ("without ... changing ... any TC oracle").
- **Gap:** The test plan's fixtures and pass criterion describe `write-delivery-request` create **and update** steps; the plan binds a single registry step and proves update in the behaviour suite plus a direct client call. That is a reasonable resolution, but it *is* an oracle change, and the plan denies it. An implementer following the TC verbatim will look for a step that does not exist; a reviewer reading the TC will call the plan under-implemented.
- **Suggested remediation target phase:** test_planning
- **Suggested fix:** Re-word TC-PARITY-003 to "the `write-delivery-request` step executes with its declared create projection; the update path is proven by TC-BACKLOG-002 over the same tenant routes plus a direct client call", and remove the plan's "no TC oracle change" claim (or move that wording into the reworded TC).

### N3 — TC-POSTURE-001's "in order" reading is stronger than the spec and forces a gratuitous production reorder (minor)

- **Facet:** test_traceability (oracle precision) / ac_quality
- **Severity:** minor
- **Artifact + location:** `chg-GH-338-test-plan.md` TC-POSTURE-001 (line 284: "equal to `ADAPTER_OPERATIONS` **in order**"); `chg-GH-338-spec.md` AC-F1-1 (line 452, set semantics); `chg-GH-338-plan.yaml` reported deviation (2) and obligations 1.6/3.3 (lines 370–374, 399–411, 634–637); delivered pin `tests/structure/provider-surface.test.ts:157-165`.
- **Gap:** The spec never requires ordering, and the plan itself argues the order is inert. Satisfying the "in order" oracle requires reordering a delivered capability declaration twice (7 then 9) and moving a delivered structural test's expected list twice, for zero behavioural gain. The plan's resolution is executable, but it makes the delivery pay for a test-plan strengthening rather than a requirement.
- **Suggested remediation target phase:** test_planning
- **Suggested fix:** Prefer set equality ("`supportedOperations` equals the closed set as a set; the declaration order is not part of the contract") and keep the delivered order, appending the ninth operation. If the ordered reading is kept deliberately, say in TC-POSTURE-001 that the declaration is being reordered to closed-set order as an inert normalization and that `TC-STATUS-022`'s ordered assertion is re-expressed as a subset-plus-set check in phase 1 and phase 3.

### N4 — The trap catalog's delivered outcome text becomes false, but the artifacts forbid amending it (minor)

- **Facet:** cross_artifact_consistency (test-artifact truthfulness)
- **Severity:** minor
- **Artifact + location:** `tests/fixtures/providers/traps/github.traps.json` entry `GH-ISSUE-TO-WORKITEM` ("closed-set status alias (open to ready, closed to done)"); `chg-GH-338-test-plan.md` §7.3 (lines 1058–1062: "delivered entries untouched … Unchanged by obligation") and TC-FLOOR-001 (line 948: "keeps their exact trap names and outcomes").
- **Gap:** After phase 3, a labelled `in-progress`/`review` issue normalizes to `in-progress`/`in-review` (spec §8.5; AC-F6-2). The trap entry's `expectedNormalizedOutcome` becomes incomplete/false, yet the test plan forbids editing delivered entries, so the catalog silently ages into a wrong statement and TC-FLOOR-001 would reject the truthful fix.
- **Suggested remediation target phase:** test_planning
- **Suggested fix:** Allow exactly one declared amendment: append "labelled `review`/`in-progress` issues resolve to `in-review`/`in-progress` by declared precedence" to `GH-ISSUE-TO-WORKITEM`'s outcome in phase 3, and record in TC-FLOOR-001 that delivered trap *names* are frozen while this one declared outcome sentence moves.

### N5 — Phase-7 doc-update list does not name the specific sentences that become false (minor)

- **Facet:** plan_doc_update_coverage
- **Severity:** minor
- **Artifact + location:** `chg-GH-338-spec.md` §24.1 Appendix A (lines 594–601); `chg-GH-338-plan.yaml` phase 7 staging list and lifecycle handoff (lines 298–305, 988–997).
- **Gap:** `feature-adapter-conformance.md` carries five statements the change falsifies and that the reconciliation list does not name: line 9 ("one three-flow registry over the **eight** closed adapter operations"; "zero live network calls"), line 33 ("**Merge** and the deploy-trace read sit **outside** the three-flow registry"), line 53 (production writes execute through `writeWorkItem`, `transitionWorkItem`, `resolveDeliveryThread` — now six members), line 57 ("all **eight** operations represented"), lines 61/63 ("installs a throwing-`fetch` guard" / "zero live network calls" — now also zero child processes). `feature-provider-client-seeds.md:169` ("GitHub issue statuses | `open` → `ready`, `closed` → `done`") is also implied-but-unnamed.
- **Suggested remediation target phase:** delivery_planning
- **Suggested fix:** Extend the §24.1 conformance row and the plan's phase-7 handoff with an explicit sentence-level checklist (registry summary, the "merge sits outside" sentence, the executed write-member list, the eight-operation count, the guard/containment sentence, and the provider-seeds status table). The `@doc-syncer` handoff then cannot miss them.

### N6 — Phase 4 does not declare the conformance tenant, which owns the pipeline-run projection (minor)

- **Facet:** plan_code_area_coverage
- **Severity:** minor
- **Artifact + location:** `chg-GH-338-plan.yaml` phase 4 `scope.files` (lines 753–768); `tests/fixtures/providers/conformance/github/tenant.json` (`expected["change-lifecycle.read-pipeline-run"]`, currently `{ jobName, jobState }` only); TDR-0032 "Negative Outcomes" (line 366: "Timing adds two fields to every conformance expected projection for pipeline-run steps").
- **Gap:** If the delivery proves AC-F4-1 through the conformance tenant (the natural reading of "every new behavior has an offline fixture ... replayed through the production client"), the exact-equality pipeline-run projection gains `startedAt`/`completedAt` and `tenant.json` must move in phase 4. It is declared in phases 1, 3 and 6 but not 4. If instead timings are only behaviour-tested, the plan should say so, because otherwise phase 4 has an undeclared staging need.
- **Suggested remediation target phase:** delivery_planning
- **Suggested fix:** Add `tests/fixtures/providers/conformance/github/tenant.json` to phase 4 scope with the obligation "extend the check-runs payload with provider timestamps and update the pipeline-run projection exactly", or state in phase 4 that timings stay out of the conformance tenant and are proven in `github-evidence.test.ts` only.

### N7 — The `GithubClient.transitionWorkItem` input widening is unnamed in the spec and plan (minor)

- **Facet:** decision_capture
- **Severity:** minor
- **Artifact + location:** `packages/adapters/src/github/client.ts:100-107` (`deliveryState: "done"`); `chg-GH-338-spec.md` §7.1 (line 195), §8.5 (line 336), DM-1..DM-8; `TDR-0034` C-3/C-4 ("no core contract type added/retyped", "no new public export").
- **Gap:** Writing `in-review`/`in-progress` requires the exported `GithubClient` member's input union to widen beyond `"done"`. That is a public adapter-surface signature change: not forbidden by TDR-0034 (which speaks of *core* types and *new names*), but not stated anywhere either. The plan's phase 3 says "route ... the transition write through it" without naming the signature change, and does not confirm that the core `CloseoutWritePort.transitionWorkItem` stays `"done"`-narrowed (i.e. no lifecycle rewiring — NG-1/§24.3 #1). A reviewer comparing the pinned `GithubClient` type to TDR-0034 could read it as an unrecorded contract change.
- **Suggested remediation target phase:** specification
- **Suggested fix:** Add one line to §7.1/DM-6: "`GithubClient.transitionWorkItem` accepts any delivery alias; `CloseoutWritePort.transitionWorkItem` stays narrowed to `done`, so no lifecycle path gains breadth in this change." Confirm with `@decision-advisor` that this is covered by TDR-0034 C-3 rather than needing a fifth record.

### N8 — The evidence-redaction obligation is provably vacuous in the delivered surface (minor)

- **Facet:** ac_quality
- **Severity:** minor
- **Artifact + location:** `chg-GH-338-spec.md` AC-F4-4 (line 483: "any rendered excerpt passes the redaction chokepoint") and AC-F5-6 (line 494), §8.4.1 Table B ("redacted at the rendering chokepoint"), §12 (line 393); `chg-GH-338-plan.yaml` refinement 6 (lines 208–212: "no production module changes there"); test plan TC-CHECK-011 / TC-THREAD-010.
- **Gap:** No delivered command renders a log excerpt or a thread body (both are new adapter-local reads with no caller), so "rendered evidence is redacted" cannot fail if the feature were absent: the test exercises `redact()` over a synthetic string, which passes today. The paired non-persistence assertions carry the real weight; the redaction clause is conditionally true and therefore unfalsifiable against this feature.
- **Suggested remediation target phase:** specification
- **Suggested fix:** Say plainly that evidence is not rendered by any delivered command in this change, so the redaction obligation is a forward-looking invariant proven at the single chokepoint (with the paired positive), and drop the implication that a rendered-excerpt path exists. Alternatively name the one consumer that will render it and bind the case to that path.

### N9 — The constructed child environment must carry `PATH` (or an absolute binary path) from injected data (minor)

- **Facet:** plan_code_area_coverage
- **Severity:** minor
- **Artifact + location:** `chg-GH-338-spec.md` Table C "Child execution"/"Credential" (lines 296–297); `chg-GH-338-plan.yaml` phase 2 goal (lines 504–509); `scripts/checks/secret-read-boundary.ts:31-64` (allowlist cannot grow; `process.env` in `packages/**` outside the allowlist is a violation); `packages/adapters/src/git/index.ts:155-166` (delivered runner passes no `env`, so it inherits ambient — a pattern the CLI transport must *not* copy for credential honesty).
- **Gap:** `execFile("gh", ...)` resolves `gh` through the child environment's `PATH`; if the transport passes a constructed env without `PATH`, every production invocation fails `ENOENT`, and if it reads `process.env.PATH` it violates the secret-read invariant and cannot be allowlisted. The plan's environment list (token, host, `GH_CONFIG_DIR`, prompt/colour/notifier suppression) omits the lookup path and never says where the base environment comes from. `ProductionCompositionFacts.environment` is the available injection point.
- **Suggested remediation target phase:** delivery_planning
- **Suggested fix:** In phase 2, state that the child environment is constructed from the composition's injected `environment` (`PATH` plus the declared variable set) or that an absolute CLI path is injected, and add the corresponding assertion to TC-CLI-003's exact-key environment case.

### N10 — TDR-0031 refines ADR-0005's meaning with no back-pointer (minor)

- **Facet:** decision_capture
- **Severity:** minor
- **Artifact + location:** `doc/decisions/TDR-0031-...md` (Decision item 9, lines 283, 292–295); `doc/decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md` (process-access revisit trigger).
- **Gap:** ADR-0005 explicitly routes process access in a provider subpath to "a new reviewed extension"; TDR-0031 is that extension, but ADR-0005 gains no pointer and TDR-0031's `links.decisions` records only a reading relationship, not the refinement. Until the human accepts the TDR at PR review, the architecture record and the shipped code disagree about what the `github` admission means — the exact drift a confinement narrative is supposed to prevent. `@readiness-reviewer` and the human are named reviewers, so this is a documentation/decision-capture nit, not a scope defect.
- **Suggested remediation target phase:** specification (routed through `@pm` to `@decision-advisor`)
- **Suggested fix:** Add an "amended by TDR-0031" note to ADR-0005's provider-subpath paragraph (authored by `@decision-advisor`, carried by this change) and state the refinement explicitly in TDR-0031's `links` section.

## Plan-reported deviations — explicit adjudication

1. **TC-PARITY-003 create+update vs one registry step — ACCEPTED with a correction.** The registry needs one step per operation to satisfy the structural gate (`packages/testkit/src/conformance/coverage.ts` `flowViolations` + `adapterViolations`), and one step is enough for AC-F8-1; the update path is genuinely proven by TC-BACKLOG-002 (which already asserts create *and* update request method/body) plus a direct client call. The resolution is sound, but it is an oracle change and the plan must stop claiming otherwise, and TC-PARITY-003 must be re-worded so it does not demand two steps (see N2). Do not add a second `write-delivery-request` step: it would move the step pin to 15 for no coverage gain and would contradict TDR-0032's "append a `merge-delivery-request` step".
2. **`supportedOperations` ordering pin — ACCEPTED as executable, but the weak reading is preferable.** The ordered pin really does live in `tests/structure/provider-surface.test.ts:157-165`, so the plan's claim is accurate and the two-step pin move is coherent with the phase-6/phase-3 posture (7/2 → 9/0). It is nevertheless a test-plan strengthening, not a requirement (see N3). Either resolution is delivery-safe; if the strong reading is kept, phase 1 must re-express `TC-STATUS-022`'s ordered assertion rather than just appending, and `closeout-contract.test.ts:213-234` must keep `ADAPTER_OPERATIONS[7] === "resolve-delivery-thread"` while the step list gains the merge step *last* (it does, at index 8, so global index 7 stays the resolve step — verified against `tests/structure/closeout-contract.test.ts:226-242`).
3. **AC-F2-2's "declared degradation recorded" as composition data, never persisted — REJECTED as written.** The interpretation respects NG "no new telemetry/event/state record", but an AC clause without a shape, a name, or an observable surface is not mechanically verifiable, and the plan's own reported deviation admits there is "no declared home". Resolve with a DM entry or delete the clause (see F6). This is the one reported deviation that must reopen an authoring phase.
4. **Reference-behavior surface authored in delivery phase 6 instead of lifecycle phase 7 — APPROVED.** Spec §18 already sequences it last among *delivery* outcomes, and AC-F7-1..5 must be verifiable at DoD; deferring the normative surface to `@doc-syncer` would make the second ticket acceptance criterion unprovable at the DoD boundary. The plan's split (delivery authors and drift-tests the surface; lifecycle phase 7 reconciles the four feature specs and indexes it) is the correct reading. Spec Appendix A's row should be re-worded from "Phase-7 documentation impacts → New" to "authored in delivery; indexed/reconciled in lifecycle phase 7" so the two artifacts stop disagreeing — a minor spec edit, not a scope change.
5. **Bound reference-behavior document path — APPROVED.** `doc/spec/features/feature-adapter-reference-behavior.md` is the right home: it is a current-truth contract doc, it sits beside the four specs it drills into, it is indexable from `doc/00-index.md`, and it is outside the `ados_distribution` marker scope (`scripts/.tests/test-doc-distribution.sh:228-252` scans `doc/guides/**` and `doc/templates/**` only, so no new marker is required — confirmed). The single locator in `tests/fixtures/provider/reference-behavior.ts` is the right way to keep the path out of the oracle. A wrong path correctly fails `TC-REF-001` naming it rather than skipping.

## Sizing

The change is large but coherent: one adapter, one closed-set increment, seven phases, 81 TCs, ~45 declared files. It is **not** too large to deliver as one ticket — every capability shares the same normalization layer and the same conformance registry, and splitting them would leave the reference adapter in a state where the parity bar is still partial (the exact problem M3-S4 exists to fix). If the PM wants to reduce blast radius, the single defensible extraction is the **CLI transport (plan phase 2)**: it is the highest-risk item (new process edge, async-vs-sync composition, child-environment and secret hygiene, depcruise admission) and it is orthogonal to the capability additions. The tradeoff is honest but real — extracting it delays M3 EC-3 to a second ticket, leaves the reference behavior document unable to state a `gh`-preferred transport for every operation (so AC-F2-1 and half of AC-F7 would move), and makes this ticket's "CLI-first" claim a forward reference, which is precisely what the owner's blueprint forbids. My recommendation is to keep the scope coupled and fix F1–F7 instead; this is a PM proposal only, not a decision the gate takes.

## What is already sound (so the rework stays surgical)

- Ticket fidelity is otherwise faithful: every task clause and both ACs map to a named capability and AC set (`chg-GH-338-spec.md` Appendix B, lines 603–614), nothing is invented beyond the blueprint and the four records, and the one deliberate behaviour change (label-aware issue status) is declared visibly in §8.5 rather than smuggled in.
- Traceability is genuinely closed: 40/40 ACs in §17 ↔ 40 rows in test-plan §3.1 ↔ 81/81 TC headings ↔ 81 index rows; the plan's TC→phase map covers all 81 exactly once and its AC map covers all 40 exactly once (verified mechanically, ranges expanded).
- The phase-1 coupling claim is **correct against the delivered gates**: `tests/structure/conformance-coverage.test.ts:127-145` pins three flows and thirteen ordered steps and asserts registry ⊇/⊆ `ADAPTER_OPERATIONS`; `packages/testkit/src/conformance/coverage.ts` (`adapterViolations`, `runtimeCoverageViolations`) requires every adapter's supported ∪ gaps to equal the closed set, every supported operation to *execute* in the mock tier, and every declared gap to be encountered with its exact reason. A contract-only commit is indeed impossible, and closing both GitHub gaps in one phase while GitLab/Jira keep theirs is the right way to keep the gap-encounter gate non-vacuous (GAP-TP-5).
- The four recorded deviations' underlying facts all check out (delivered order pins, the untracked TDRs, the ten-step `provider-capabilities` gap/method invariant, the sync `WriteMethods` dispatch seam), which is why the remaining findings are narrow and local.
- The measurement discipline is good: byte-based caps with multi-byte boundary fixtures, truncation as the sole authority, paired absence positives, `Object.hasOwn` for absent timings, exact-set structural pins with mutation controls, and no-skip rules.

## May delivery start?

No. Delivery is blocked. Six findings need author-side remediation before `@coder` runs phase 1: two contract shapes that do not exist yet (the `write-delivery-request` create inputs and the composition degradation record), two internal contradictions the delivery would otherwise resolve by guessing (the `done` transition's label behaviour, and read-side handling of unmapped/case-mismatched label tokens), and three plan-executability defects that would make declared phase gates fail for reasons unrelated to the work (the async probe boundary, the missing child-process site-set pin, the missing read-back helper home). All seven are local and mostly one-to-several lines each: `specification` reopens for F1, F4, F5, F6 (plus minors N1, N7, N8 and the Appendix A re-wording from deviation 4), `test_planning` reopens for N2–N4, and `delivery_planning` reopens for F2, F3, F7 (plus N5, N6, N9). No human decision is required to proceed; the four `Proposed` TDRs stay accepted-at-PR-review and none of the findings asks to widen them — F4/N7 ask the records and the spec to say the same thing, which `@decision-advisor` can do on the same branch before the human review. Re-run this gate after the revisions; the underlying shape of the change is sound, so a second iteration should be a confirmation pass rather than a redesign.
