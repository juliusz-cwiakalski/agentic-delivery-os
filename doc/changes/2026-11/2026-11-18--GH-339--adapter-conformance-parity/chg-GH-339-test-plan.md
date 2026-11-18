---
id: chg-GH-339-test-plan
status: Proposed
created: 2026-11-18T12:20:00Z
last_updated: 2026-11-18T12:20:00Z
owners: ["engineering"]
service: "delivery-os adapter conformance (testkit) and provider adapters"
labels: ["adapters", "conformance", "parity", "testkit", "m3-s5"]
version_impact: none
summary: "Prove that switching trackers cannot change the lifecycle contract without a gate failing: one declared parity matrix over the nine closed operations with GitHub as reference and an adjudicated difference register (three-way consistent with the capability declarations and the observed conformance outcome, bidirectional cell↔entry coverage, closed cell and class vocabularies, and both adjudication arms each with its own falsifying mutation); one conformance-level tracker error taxonomy of four class ids resolved to delivered identities by structured fields only, proven by six trap families with per-adapter accounting and offline replay classification agreement; one deterministic runtime-neutral simulated stateful tracker double whose write-then-read causality, replay equality, fail-closed refusals and zero-call offline containment are asserted rather than observed; one registration-only participation contract proven by a provider-identity-free scan with an exact file-plus-construct allowlist (including the one pinned runner exception) and a composition-injected synthetic control registration whose five-item minimality is mutation-proven; and gate integration inside the existing TypeScript test job with zero workflow change, canonical-order deterministic diagnostics, bounded detail, and no parity payload in the artifact."
links:
  change_spec: ./chg-GH-339-spec.md
  implementation_plan: ./chg-GH-339-plan.yaml
  testing_strategy: ../../../../.ai/rules/testing-strategy.md
---

# Test Plan - M3-S5: Adapter conformance and parity suite (M3)

## 1. Scope and Objectives

This change adds four *declarations* and one *enforcement*: a parity matrix with a difference register, a tracker error taxonomy with trap-family accounting, a simulated stateful double, a participation contract, and a gate that fails when any of them stops being true. The verification risk is therefore not "a module is missing" but **a property that exists only in prose**: a matrix that is complete in shape and never compared with the adapters it describes, a difference register that licenses every divergence, a taxonomy that becomes a second error system, a family list that is "covered" by fixtures which never exercise the family, a double whose write-then-read passes because the read never happened, a "registration-only" claim whose control adapter passes because nothing is checked, a workflow guarantee that is only a stated intent, and a `tracker.*` literal scan whose scope is wrong in exactly the direction that makes it vacuous.

Every case below is an oracle over *observable* things: cell multisets and their set equality, violation objects with named clauses, classes computed from structured status presence, canonicalized state compared across two runs against a committed golden, guard counters, exported allowlists compared as exact sets, pinned check-name inventories, and recorded gate exit codes. Absence claims (zero parity field in the artifact, zero provider literals in the bound modules, zero `tracker.` literals outside one file, zero workflow files added, zero adapter deltas) are each paired with a **positive in the same case** and, where a scan or pin is the mechanism, with a **mutation that must make the mechanism fail by name** — never a re-read of the declaration the claim is about.

Two constraints shape the whole plan. First, `.ai/rules/testing-strategy.md` forbids permanent suites from asserting a diff against a moving base ref; therefore every "nothing changed" claim is a **tree invariant** (golden, exact-set pin, pinned check-name inventory, export/inventory equality) or a **recorded gate result**, and the residual "this change's diff touched no workflow file" half is explicitly classified as review-verified evidence in §3/§10 rather than dressed up as a suite. Second, the delivery is **autonomous and additive**: no adapter may be completed or changed, so the parity conclusion itself is *adjudicated during delivery*, and this plan refuses to bake in a verdict for the five non-reference supported intersections (§1.2 GAP-TP-1).

This document is a verification map, not an execution claim. No case has been run at authoring time; every case is authored failing-first against the phase that owns it, and §10 is populated during delivery and the quality gates.

### 1.1 In Scope

- **Declared parity and its gate (F-1)**: one matrix over the nine closed operations × the registered adapters; one declared reference adapter whose column is uniformly `same-as-reference` and carries no register entry; three closed cell kinds and six closed difference classes; a `(adapter, operation)`-keyed register with class, rationale, resolvable evidence, and an adjudication reference; three-way consistency (matrix ↔ capability declaration ↔ observed conformance outcome) with bidirectional cell↔entry coverage; ordered clause-tagged violations naming provider, operation, and clause; and the two structurally distinct adjudication arms (`same-as-reference` contradicted by observation, `declared-difference` falsified by reference-equal evidence) each with its own falsifying mutation.
- **Tracker error taxonomy and trap families (F-2)**: four class ids resolving to exactly one delivered identity each, decided only by structured fields, total over five observable outcomes in fixed order, never emitted; the exact two-tree `tracker.` literal scan with a single-file allowlist; six closed trap families with per-adapter × per-family accounting (`covered` / `gap-backed` / `recorded-difference`, never two, never silent); offline replay agreement per covered family; and unchanged four-field catalog entries with bidirectional catalog↔family wiring.
- **Simulated stateful double (F-3)**: write-then-read causality through the registered client factory with no flow, step id, assertion family, step count, or registration change; replay-and-compare determinism over canonicalized state, normalized reads, results and ordering, against a committed golden; three named fail-closed refusals; both offline guards asserted at zero across double-backed flows; the delivered stateless tenants byte-identical; testkit runtime neutrality; and the five closed effects each proven, with four malformed-declaration refusals.
- **Registration-only participation (F-4)**: the declared five-item participation set and the refusal of anything outside it; a composition-injected synthetic control adapter producing a passing run with a complete column and full family accounting; the shipped registry pinned at exactly three contracts; and the provider-identity-free invariant over a named module set with an exact file-plus-construct allowlist that records the delivered runner derivation as a pinned exception.
- **Gate integration and diagnostics (F-5)**: the gate and the double-backed flows discovered by the existing `pnpm test` path inside the existing `ts-test` job; exact workflow file-set, job-set, and trigger pins with mutations; bounded scalar diagnostics carrying provider, operation, clause and a resolvable reference; canonical, order-stable verdicts across consecutive runs.
- **Regression floor**: the delivered conformance, provider, structure, boundary and check suites stay green and unweakened; the delivered capability postures are byte-identical (no adapter behaviour change); the closed operation set, port surface, error table, domain kinds, projection classes, exit codes, artifact schema, and message contracts do not move; the pinned inventory/export surfaces are updated exactly and non-vacuously; fixture hygiene and the secret-read boundary are unchanged.

### 1.2 Out of Scope & Known Gaps

- [OUT] **Adapter-local evidence-read parity** (log excerpt, thread discussion, deploy trace) per NG-11 and spec §7.3: these are not closed operations, so no matrix row and no family is defined for them. Their posture stays "same behaviour or explicitly absent", asserted only by the delivered suites (`TC-FLOOR-001`). A case here would invent a row the spec deliberately excludes.
- [OUT] **Parity serialized into an artifact** per NG-6/§24.3(4): `TC-ART-001`/`TC-ART-002` assert its absence; no case reads a parity artifact because none may exist.
- [OUT] **Family-level parity for the harness conformance registry** per spec §7.3 (a separate registry with its own six-scenario floor). `TC-FLOOR-001` keeps `tests/conformance/harness-classification.test.ts` and `harness-liveness.test.ts` green; no family accounting is authored for harnesses.
- [OUT] **Automating adjudication** per spec §7.3: a register entry's `adjudicatedBy` is a recorded human reference. No case asserts an automated adjudicator; the cases assert that the reference exists, resolves, and that stale evidence fails.
- [OUT] **Adapter completion, convergence of the five intersections, the policy engine, a CLI/report surface, a new job, or a second reference adapter** per NG-1..NG-10. No case drives them.
- [OUT] **Retiring or migrating the provider trap suites** per NG-10/§24.3(11): `TC-FLOOR-001` requires them green and unedited; the conformance-level family accounting references them.
- **GAP-TP-1 — the five non-reference supported intersections are adjudicated during delivery, and their outcome is unknown today.** GitLab `read-delivery-request`, GitLab `read-pipeline-run`, Jira `read-work-item`, Jira `write-work-item`, Jira `transition-work-item` are supported, non-reference cells. This plan does **not** predict any of them. `TC-PARITY-007` asserts the adjudication record is *total and consistent* over exactly those five; `TC-PARITY-008` runs the arm the record declares and proves **both** arms exist as mechanisms every run, so the suite cannot drift into "everything is the same" or "everything is recorded" without a named failure. A delivery that changes an adapter to make an intersection `same-as-reference` violates NG-1 and fails `TC-FLOOR-002`, not `TC-PARITY-008`.
- **GAP-TP-2 — the `auth-shapes` family is not provable as `tracker.auth.rejected` on the two adapters whose failure envelope carries no `httpStatus`, and the ACs that require it carry no recorded-difference alternative.** `packages/adapters/src/gitlab/client.ts` and `packages/adapters/src/jira/client.ts` construct `providerPayloadFailure(detail)` with no status on every non-2xx path (including the write path in `jira/client.ts`), while `packages/adapters/src/github/client.ts` passes `response.status`. Under the spec's own total decision rule (DM-3 / TDR-0037 §2) a status-less payload failure is `tracker.transport.failed`, so a 401/403 on GitLab or Jira classifies as a transport failure and is **indistinguishable from a genuine transport failure on the same adapter under the taxonomy** — identical `code`, identical absence of `httpStatus`; only the free-text `detail` differs, and the taxonomy is forbidden to read it. `TC-TAX-003`/`TC-TAX-004` therefore assert the **declared-posture agreement** rule (declared class, or a recorded `failure-classification` difference naming `httpStatus` presence as the deciding field) and never assert a class the adapter cannot emit. This needs the spec fix recorded in §8.3 OQ-TP-1 before delivery planning; it is not a workaround this plan may invent.
- **GAP-TP-3 — "zero workflow files changed / zero jobs added" is diff-shaped, and the delivered topology check does not enforce additions.** `scripts/checks/ci-topology.ts` `validate()` asserts that the pinned `BASH_JOBS`/`TS_JOBS` ids are **present**, that the triggers target `main-tools`, and that `ci.yml` removes no base line versus `origin/main-tools`; it does **not** fail when a new job is added, and no suite pins the workflow file set. `TC-GATE-002` therefore authors the missing control (exact file-set, exact job-id set per file, exact trigger set per file, plus a pinned check-name inventory of the two delivered workflow suites) with mutations. The last mile — that *this change's diff* touched no workflow file — is recorded as review-verified evidence in §3.4/§10, because a permanent base-ref diff assertion is forbidden by `.ai/rules/testing-strategy.md`.
- **GAP-TP-4 — the family identifier `auth-shapes` is not spelled the same way in the spec and in the binding decision.** Spec §8.3 DM-4 (also AC-F2-10, F-2 prose) uses `auth-shapes`; TDR-0037 §3 uses `auth-shape`. This plan binds the vocabulary through one exported constant so the choice is one line, and asserts the set by **position and class mapping** rather than by spelling everywhere; the spelling must be reconciled (§8.3 OQ-TP-2) because a fixture key and a spec table that disagree is exactly the drift this change exists to prevent.
- **GAP-TP-5 — parity has no artifact and therefore no persisted evidence.** Parity evidence is test outcomes, committed declared data, and the committed evidence fixtures referenced from the register. A reviewer cannot inspect a parity verdict after CI has run; `TC-GATE-003` therefore requires every violation to carry a resolvable fixture or evidence reference so the failing statement is reproducible from the repository, not from a log.
- **GAP-TP-6 — fixture-decided details are not test-decided.** Spec §24.4 leaves the per-provider stimulus payload shape, which operation each family exercises per adapter, the effect operand names and values, the double-backed response projections, violation wording beyond its named elements, and the serialized form of declared state to delivery. Every case below pins **shape, class, cap, ordering and absence rules** — which the spec fixes — and reads the chosen surface through exactly one declared fixture or declared table. A different surface updates that one fixture; a different shape or class fails the named case.
- **GAP-TP-7 — no permanent diff-against-a-moving-base assertion exists in this plan.** Every case is a tree invariant, a suite assertion, a golden/fixture comparison, or a recorded gate. "No module was edited to add the control adapter" (F-4) is proof-by-construction plus review, exactly as TDR-0039 §3 states; the mechanical half is `TC-REG-002`/`TC-REG-006`.
- [GAP-TP-8 — classification needs a production-client replay seam that the delivered family fixtures may not yet supply] The family replay in `TC-TAX-013` requires one committed fixture per covered family per adapter, replayed through the production client with an injected transport. Where an existing provider fixture already produces the stimulus, the accounting must name that catalog entry and no new fixture is authored; where it does not (a 429, a thrown transport, an undecodable 2xx, an unresolvable native state, a page-limited read), a new fixture and a new four-field catalog entry are authored in the phase that owns that fixture. A family whose posture is `covered` but whose fixture is absent fails `TC-TAX-011` by name; it never degrades to `gap-backed` to make the run green.

## 2. References

| Reference | Role in this plan |
|---|---|
| [`chg-GH-339-spec.md`](./chg-GH-339-spec.md) v1.0 | Binding source: F-1..F-5, **34 ACs** (`AC-F1-1..8`, `AC-F2-1..11`, `AC-F3-1..7`, `AC-F4-1..5`, `AC-F5-1..3`), API-1..API-5, DM-1..DM-7, NFR-1..NFR-11, §17 criteria, §24.3 deliberate non-decisions, §24.4 fixture-decided details. Section references in this plan are to this file. |
| [`chg-GH-339-pm-notes.yaml`](./chg-GH-339-pm-notes.yaml) | Delivery mode (autonomous), milestone, the binding expectation that **no adapter behaviour changes**, the five intersections to be adjudicated rather than converged, the invariants the delivery may not widen, the TDR staging note, and the `TMPDIR=$PWD/tmp/tmpdir` convention. |
| [`chg-GH-339-plan.yaml`](./chg-GH-339-plan.yaml) — **not yet authored** | Prospective: authored in `delivery_planning` (phase 4). This plan binds cases to *delivered* files and to the modules the spec names; §7.6 records the phase/file bindings that plan must carry. No case here depends on a plan artifact existing. |
| [TDR-0036](../../../decisions/TDR-0036-cross-adapter-parity-matrix-declared-difference-register.md) (DEC-1) | The matrix home (`packages/testkit/src/conformance/parity.ts`), the closed cell and class vocabularies, the register shape and bijection, the six gate clauses (a)–(f) and the four-dimension parity basis, gate placement in `pnpm test`, and the non-decisions this plan asserts (no artifact change, no operation change, no new job). |
| [TDR-0037](../../../decisions/TDR-0037-tracker-error-taxonomy-delivered-identities.md) (DEC-2) | The class table, the total five-outcome decision rule and its order, the six families with their declared outcomes, the fixture-per-family-per-adapter rule, and the reconciliation note that the family list is six. **Authority** for every classification assertion; no case here is the authority for a rule this record does not declare. |
| [TDR-0038](../../../decisions/TDR-0038-simulated-stateful-tracker-double-declared-effects.md) (DEC-3) | Double placement in testkit, the five-effect vocabulary, declared identity and ordering, replay equality on canonicalized state, the three named fail-closed failures, the wiring through `RunConformanceInput.transportFactory`, and the unchanged stateless contract. |
| [TDR-0039](../../../decisions/TDR-0039-registration-only-adapter-extensibility-proof.md) (DEC-4) | The five participation items, the bound set and the **enumerated** permit list including the pinned `runner.ts` derivation (five provider comparisons), the synthetic control adapter injected through `RunConformanceInput.adapters`, the exact-three registry invariant, and the honest statement that "no module edited" is construction plus review. |
| [`.ai/rules/testing-strategy.md`](../../../../.ai/rules/testing-strategy.md) | Layer model, module-to-test mapping (`packages/testkit/src/conformance/**` → `tests/structure/conformance-coverage.test.ts` and `bun test tests/conformance`; the mock tier rides `pnpm test` with no new job), invariant-test authoring (no moving-base diffs), fixture naming, and the aggregate gate. |
| [`.ai/rules/typescript.md`](../../../../.ai/rules/typescript.md) | Strict types, data-only contracts, injected clock/environment, injected fakes over `mock.module`, adapters own I/O — the rules the double, the engine, and every new test must satisfy. |
| [`feature-adapter-conformance.md`](../../../spec/features/feature-adapter-conformance.md) | Delivered current truth this change extends: three flows / fourteen steps, the adapter registry and its declaration scan, capability gating, both coverage gates, the mock tier with both guards, the live tier, the artifact contract and caps, security boundaries, and the QA statement that no workflow job is added. |
| [`feature-provider-client-seeds.md`](../../../spec/features/feature-provider-client-seeds.md) | The trap-catalog contract (four fields, per-provider minima, replay harness) the family accounting references without migrating. |
| [`feature-adapter-ports.md`](../../../spec/features/feature-adapter-ports.md) | The nine closed operations, capability/gap vocabulary, carrier kinds, normalized-view fields, additive-v1 rule, runtime-API confinement, and the secret-read boundary. |
| [`feature-adapter-reference-behavior.md`](../../../spec/features/feature-adapter-reference-behavior.md) | The normative per-operation behaviour that *is* the parity bar; the matrix and register become its machine-readable divergence record, and every delivered value in it stays unchanged. |
| **Delivered suites consumed as anchors** | `tests/conformance/{mock-conformance,artifact,broken-adapter-control,github-transport-parity,harness-classification,harness-liveness}.test.ts`; `tests/conformance/live/live-entrypoint.test.ts`; `tests/conformance/support/{fixtures,testkit-source-scan}.ts`; `tests/structure/{conformance-coverage,trap-catalog,content-inventory,port-contract-inventory,provider-surface}.test.ts`; `tests/checks/{conformance-workflow,ci-checks,error-table-sync,fixture-sanitization,fixture-privacy,exit-code-literals}.test.ts`; `tests/behaviour/providers/{trap-harness,github-trap,gitlab-trap,jira-trap,support}.ts`; `scripts/checks/{ci-topology,secret-read-boundary,exports-discipline,testkit-exclusion,ambient-globals}.ts`. |

## 3. Coverage Overview

Evidence classes: **Suite** (a committed assertion in `pnpm check`), **Suite + mutation** (its detection power is proven by a named in-place mutation or negative control), **Golden** (a committed fixture compared exactly), **Quality gate** (an execution record), **Review-verified** (a content/diff inspection recorded in §10).

### 3.1 Functional Coverage (F-#, AC-#)

| AC ID | Criterion (abridged) | TC ID(s) | Evidence class | Status |
|-------|----------------------|----------|----------------|--------|
| AC-F1-1 | Exactly one cell per (registered adapter × closed operation); no unregistered adapter; no out-of-set operation; every column covers all nine. | TC-PARITY-001, TC-PARITY-007 | Suite + mutation | Covered |
| AC-F1-2 | Reference column is uniformly `same-as-reference`; no register entry names the reference adapter. | TC-PARITY-002 | Suite + mutation | Covered |
| AC-F1-3 | Every `gap` cell's reason equals the declared reason; no supported-while-gap or gap-declared-while-non-gap contradiction. | TC-PARITY-003 | Suite + mutation | Covered |
| AC-F1-4 | Register ↔ cell bijection both directions; one entry per cell; no duplicate `(adapter, operation)`; closed class, non-empty rationale, resolvable evidence, adjudication reference. | TC-PARITY-004 | Suite + mutation | Covered |
| AC-F1-5 | A `same-as-reference` cell contradicted by the observed outcome on any of the four dimensions fails naming provider, operation, dimension; never absorbed. | TC-PARITY-005, TC-PARITY-008 | Suite + mutation | Covered |
| AC-F1-6 | A `declared-difference` entry's class names the differing dimension, its evidence reproduces the difference, and reference-equal evidence fails naming the entry. | TC-PARITY-006, TC-PARITY-008 | Suite + mutation | Covered |
| AC-F1-7 | Eleven named mutations are each rejected with a violation naming provider, operation, and failing clause. | TC-PMUT-001 … TC-PMUT-011 | Suite + mutation | Covered |
| AC-F1-8 | `delivery.conformance.v1` keeps its field set, closed statuses, skip kinds and bounds; no parity field or verdict. | TC-ART-001, TC-ART-002 | Suite + mutation | Covered |
| AC-F2-1 | Exactly four class ids, one delivered identity each, structured-field-only decision, no error-table row / domain kind / emitted code / projection / normalized-view / artifact occurrence; declared in exactly one module with an exact two-tree scan and single-file allowlist. | TC-TAX-001, TC-TAX-002 | Suite + mutation | Covered |
| AC-F2-2 | An auth stimulus (401/403) classifies as `tracker.auth.rejected` with the structured status; a missing credential stays the credential-resolution identity; the two are distinguishable from structured data. | TC-TAX-003 | Suite + mutation | Covered — see OQ-TP-1 for the status-less-adapter alternative this AC text lacks |
| AC-F2-3 | A transport stimulus classifies as `tracker.transport.failed` carrying no status, distinguishable from every status-bearing class. | TC-TAX-004 | Suite + mutation | Covered — see OQ-TP-1 |
| AC-F2-4 | A rate-limit stimulus classifies as `tracker.payload.invalid` with its status, or matches the recorded class where accounting records a difference; never reads prose. | TC-TAX-005 | Suite + mutation | Covered |
| AC-F2-5 | An undecodable 2xx and a contradictory-prose non-2xx both classify as `tracker.payload.invalid` from structured fields alone. | TC-TAX-006 | Suite + mutation | Covered |
| AC-F2-6 | An unresolvable native state and an unperformable transition classify as `tracker.payload.invalid` (zero provider requests for the transition), or gap-backed, or recorded — never silence. | TC-TAX-007 | Suite + mutation | Covered |
| AC-F2-7 | A pagination-truncation stimulus is a bounded-observation assertion over the declared page limit and truncation signal, not an error class, with no new bound, retry, or pagination behaviour. | TC-TAX-008 | Suite + mutation | Covered |
| AC-F2-8 | The five observable outcomes are classified totally and deterministically in declared order; a read's 404 stays `provider.not-found` outside the taxonomy; a write's 404 stays the payload class; no new identity. | TC-TAX-009 | Suite + mutation | Covered |
| AC-F2-9 | `tracker.capability.unsupported` is proven structurally by the coverage gates plus the runtime declared-gap encounter rule, never as an adapter failure and never by a fixture family. | TC-TAX-010 | Suite + mutation | Covered |
| AC-F2-10 | Per adapter × family exactly one posture (`covered` with resolvable fixture and catalog entries, `gap-backed` with the exact reason, `recorded-difference` referencing a `failure-classification` entry); no dual posture; an unaccounted family fails naming adapter and family. | TC-TAX-011, TC-TAX-013 | Suite + mutation | Covered |
| AC-F2-11 | Every catalog entry keeps exactly four fields, every fixture reference resolves, every family reference names an existing entry, and catalog↔family coverage is bidirectional with no orphan. | TC-TAX-012 | Suite + mutation | Covered |
| AC-F3-1 | A declared write-then-read scenario is observable through the registered client factory and the declared tenant extension, with no flow, step id, assertion family, step count, or registration change. | TC-DOUBLE-001, TC-DOUBLE-007 | Suite + mutation | Covered |
| AC-F3-2 | Two replays of the same declared input and request order yield identical canonicalized state, identical normalized reads, and identical results and ordering. | TC-DOUBLE-002 | Suite + mutation + Golden | Covered |
| AC-F3-3 | An undeclared request, an undeclared effect, and an effect naming a missing resource each fail closed naming method, URL, and effect; never a silent no-op; never a live call. | TC-DOUBLE-003 | Suite + mutation | Covered |
| AC-F3-4 | With double-backed flows, the network guard and the child-process guard both observe zero calls across the whole run. | TC-DOUBLE-004 | Suite + mutation | Covered |
| AC-F3-5 | Committed stateless tenants replay with identical projections, step order, skip kinds, skip reasons, and diagnostics. | TC-DOUBLE-005 | Suite + mutation + Golden | Covered |
| AC-F3-6 | The double imports no `node:*`/`bun:*` module and reads no ambient environment, clock, or randomness; fixture loading and both guards stay outside testkit. | TC-DOUBLE-006 | Suite + mutation | Covered |
| AC-F3-7 | Four malformed double declarations each fail naming the offending declaration: out-of-vocabulary effect, two effects on one route, unresolvable operands, created-entry identity with no declared sequence. | TC-DMUT-001 … TC-DMUT-004 | Suite + mutation | Covered |
| AC-F4-1 | Exactly five supplied items are declared; no sixth lifecycle, port, phase, or runner artifact is required. | TC-REG-001 | Suite + mutation | Covered |
| AC-F4-2 | A composition-injected control adapter produces a passing run with a complete column consistent with its declaration and full family accounting; the run is impossible without the seam; no lifecycle, port, flow-registry, coverage, runner, or artifact module is edited to add it. | TC-REG-002, TC-REG-006 | Suite + mutation + Review-verified | Covered |
| AC-F4-3 | The shipped registry is exactly the three shipped contracts, the control is absent, and a registration naming no declared contract is still rejected. | TC-REG-003 | Suite + mutation | Covered |
| AC-F4-4 | Zero adapter identity literals in the seven-module bound set; identity only in the enumerated permit list; a literal outside the exact allowlist fails naming file and construct. | TC-REG-004 | Suite + mutation | Covered |
| AC-F4-5 | An out-of-set operation, a lifecycle phase hook, or a per-adapter runner branch is refused by name; the closed operation set and lifecycle contract are unchanged. | TC-REG-005 | Suite + mutation | Covered |
| AC-F5-1 | The gate and double-backed flows execute in the existing `ts-test` job through `pnpm test`; zero workflow files change; no job, trigger, permission, or upload is added; the workflow contract test and the topology check pass. | TC-GATE-001, TC-GATE-002 | Suite + mutation + Review-verified | Covered — see GAP-TP-3 for the review-verified residue |
| AC-F5-2 | Every violation names provider, operation and clause, carries a fixture/evidence reference, keeps detail within the declared bound, uses scalar expected/received values, and contains no credential material. | TC-GATE-003 | Suite + mutation | Covered |
| AC-F5-3 | Two consecutive runs of the gate and the double-backed flows produce an identical violation set and ordering. | TC-GATE-004 | Suite + mutation | Covered |

**All 34 acceptance criteria are mapped to named cases; none is unmapped, deferred, or case-less.** Capability coverage is transitive and complete: F-1 → PARITY 001–008 + PMUT 001–011 + ART 001–002; F-2 → TAX 001–013; F-3 → DOUBLE 001–007 + DMUT 001–004; F-4 → REG 001–006; F-5 → GATE 001–004.

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

The spec declares no `EVT-` identifiers (§8.2: no event, message, telemetry record, or state-schema record). The interfaces under test are in-process conformance contracts.

| ID | Element | Observable contract | TC ID(s) |
|---|---|---|---|
| API-1 | Parity gate | One pure validation over matrix data, the registered capability declarations, the register, and the observed outcome; clause-tagged violation list (empty means pass); every violation names provider, operation, clause; no I/O, no ambient input; deterministic for the same input. | TC-PARITY-001..008, TC-PMUT-001..011, TC-GATE-003, TC-GATE-004 |
| API-2 | Tracker classification assertion | Compares a declared class with the class resolved from the delivered identity plus the structural discriminator (status presence and value, or absence); never inspects prose; never introduces an identity. | TC-TAX-001, TC-TAX-003..009, TC-TAX-013 |
| API-3 | Simulated double transport | The existing conformance transport seam: a request returns a status and an untrusted body; behaviour is declared state plus the matched route's declared effect; undeclared request, undeclared effect, and missing resource are named failures. | TC-DOUBLE-001, TC-DOUBLE-003, TC-DOUBLE-007, TC-DMUT-001..004 |
| API-4 | Declared tenant extension | Optional declared initial state and per-route optional declared effect drawn from the closed vocabulary; absence means the delivered stateless exact-URL replay; malformed or out-of-vocabulary declarations rejected by name at decode time. | TC-DOUBLE-001, TC-DOUBLE-005, TC-DMUT-001..004 |
| API-5 | Registration participation | The five supplied items plus refusal of anything outside them (out-of-set operation, lifecycle hook, per-adapter runner branch). | TC-REG-001, TC-REG-005, TC-REG-006 |
| DM-1 | Parity matrix | One row per closed operation, one cell per registered adapter; cell exactly `same-as-reference` \| `declared-difference` \| `gap`; no free-text cell; parity judged on four provider-independent dimensions. | TC-PARITY-001..008, TC-PMUT-001..011 |
| DM-2 | Register entry | Keyed exactly by `(adapter, operation)`: `differenceId`, `adapter`, `operation`, `differenceClass`, `rationale`, `evidence`, `adjudicatedBy`; six closed classes; evidence must reproduce the difference. | TC-PARITY-004, TC-PARITY-006, TC-PARITY-008 |
| DM-3 | Tracker error taxonomy | Four class ids → one delivered identity each, decided by structured fields; total projection over five outcomes in fixed order; declared in one module; never emitted. | TC-TAX-001..010, TC-TAX-013 |
| DM-4 | Trap-family accounting | Six closed families with declared outcomes; per adapter × family exactly one posture; family names its operation; four-field catalogs unchanged; separate wiring data. | TC-TAX-011, TC-TAX-012, TC-TAX-013 |
| DM-5 | Simulated double contract | Declared initial state, the delivered route table, one optional declared effect per route from five effects (`set-field`, `reset-field`, `replace-collection`, `append-entry`, `mark-resolved`); every identity declared; no-effect route is stateless. | TC-DOUBLE-002, TC-DOUBLE-007, TC-DMUT-001..004 |
| DM-6 | Registration participation record | The five-item set plus two invariants: the provider-identity-free bound set with its enumerated permit list (including the pinned runner derivation) and the exactly-three shipped registry; control is injected only. | TC-REG-001..006 |
| DM-7 | Reference adapter designation | One declared value naming the reference (GitHub); its column constrained to `same-as-reference` and carrying no register entry. | TC-PARITY-002, TC-PARITY-007 |

### 3.3 Non-Functional Coverage (NFR-#)

| NFR | Requirement (abridged) | TC ID(s) | Status |
|---|---|---|---|
| NFR-1 | 0 live network calls and 0 live child processes across the gate and double-backed flows under both guards; two replays of the same input yield identical canonicalized state, normalized reads, and an identical violation set and ordering. | TC-DOUBLE-002, TC-DOUBLE-004, TC-GATE-004 | Covered |
| NFR-2 | Cells exactly adapters × closed operations (0 missing/duplicate/extra); 100% of violations name provider, operation, clause; every gate rule has a mutation control that fails by name. | TC-PARITY-001, TC-PARITY-004, TC-PARITY-005, TC-PARITY-007, TC-PMUT-001..011, TC-GATE-004 | Covered |
| NFR-3 | 4/4 class ids mapped to exactly one identity each and decided by structured fields; 100% of replayed family fixtures satisfy their declared outcome; 0 new identities; 0 prose classification; 0 `tracker.` literals in the two source trees outside the one declaration module with exact scope and allowlist. | TC-TAX-001, TC-TAX-002, TC-TAX-009, TC-TAX-013 | Covered |
| NFR-4 | 6/6 families accounted per adapter; 0 silent; 0 dual posture; 0 catalog entries other than four fields; 0 unresolvable fixture references; wiring and catalog coverage bidirectional. | TC-TAX-011, TC-TAX-012, TC-TAX-013 | Covered |
| NFR-5 | 0 clock/randomness/ambient-counter dependence; 100% of state changes declared by one of five effects; 0 effects inferred from URL, method, or payload shape; 100% of undeclared requests/effects/missing targets fail by name; identical canonicalized state and reads across two runs. | TC-DOUBLE-002, TC-DOUBLE-003, TC-DOUBLE-007, TC-DMUT-001..004 | Covered |
| NFR-6 | 0 workflow files changed, 0 jobs added, 0 triggers changed; the gate and double suites execute in the existing `ts-test` job through `pnpm test`; the workflow contract test and the topology check stay green. | TC-GATE-001, TC-GATE-002, TC-FLOOR-001 | Covered (review-verified residue recorded in §3.4) |
| NFR-7 | 0 `node:*`/`bun:*` imports and 0 ambient environment/clock/randomness reads in testkit; filesystem, environment, native fetch, child-process substitution, and artifact writing remain under `tests/`. | TC-DOUBLE-006, TC-FLOOR-004 | Covered |
| NFR-8 | 0 removed/retyped/newly-required contract fields; 0 state migrations; 0 artifact schema changes; inventory and export-discipline expectations updated exactly and not vacuously; typecheck, lint, build, and the aggregate gate green. | TC-ART-001, TC-FLOOR-003, TC-FLOOR-004, TC-FLOOR-006 | Covered |
| NFR-9 | 0 credential material in gate diagnostics, double state, fixtures, or reports; sanitization audit and planted-secret canary green; 0 new secret-read allowlist entries; fixture hosts example-only. | TC-GATE-003, TC-FLOOR-005 | Covered |
| NFR-10 | 0 edits to lifecycle, port, flow-registry, runner, coverage, or artifact modules for a new adapter; 0 new provider-identity allowlist entries beyond the one recorded runner derivation; the control passes with a complete column and full family accounting. | TC-REG-002, TC-REG-004, TC-REG-005, TC-REG-006 | Covered |
| NFR-11 | Violation detail ≤1024 characters; expected/received scalar only; every violation carries a fixture or evidence reference; 0 credential material, 0 provider-native payloads, 0 unbounded collections in a diagnostic. | TC-GATE-003 | Covered |

### 3.4 Traceability Closure

- **Acceptance criteria**: 34 declared, 34 mapped, 0 unmapped, 0 deferred.
- **Test cases**: 61 declared — `TC-PARITY-001..008` (8), `TC-PMUT-001..011` (11), `TC-ART-001..002` (2), `TC-TAX-001..013` (13), `TC-DOUBLE-001..007` (7), `TC-DMUT-001..004` (4), `TC-REG-001..006` (6), `TC-GATE-001..004` (4), `TC-FLOOR-001..006` (6). Every case names at least one AC or NFR; the AC column of §5.1 is the reverse map.
- **Orphans**: 0. Every case is either a positive proof of an AC/NFR or a negative/mutation control proving the same AC cannot pass vacuously; no case asserts a behaviour outside the spec, and no case asserts a behaviour the spec leaves to delivery as a verdict (the five intersections are asserted for *totality and consistency*, never for a pre-chosen outcome).
- **Invariant ACs have controls, not re-reads**: `AC-F1-8` (artifact unchanged) → exact key-set equality plus a mutation that adds `parity` (`TC-ART-001`) and a byte scan with a paired positive (`TC-ART-002`); `AC-F4-3` (registry stays three) → exact provider list plus an `azure`-registration mutation; `AC-F5-1` (no workflow change) → exact file-set/job-set/trigger-set pins with add/remove mutations plus a pinned check-name inventory of the two workflow suites (`TC-GATE-002`); `AC-F3-6` (testkit purity) → dependency-cruiser `runtime-apis-confinement` + the ambient source scan + a planted `node:fs` mutation; `AC-F4-4` (identity-free) → exact allowlist equality plus one planted literal per bound module and a planted sixth runner comparison.
- **Evidence classes that are not suites**: the "this change's diff touched no workflow file" and "no module was edited to add the control" halves of `AC-F5-1`/`AC-F4-2` are **review-verified** and recorded in §10, per TDR-0039 §3 and `.ai/rules/testing-strategy.md`'s prohibition on base-ref assertions. They are named here rather than hidden, and they are never the only evidence for the AC.
- **No-skip rule**: no `test.skip`, `test.todo`, conditional `if (!seam) return`, or environment-gated pass is permitted in any delivered suite touched by this change. A case that cannot resolve its seam throws naming the missing contract. A reviewer treats any silent skip in the touched suites as a blocking finding — a skipped family is precisely the failure mode `AC-F2-10` exists to remove.

## 4. Test Types and Layers

| Layer | Type | Location | Pattern / runner | Applies to |
|---|---|---|---|---|
| Structure / contract | Contract, static scan, declared-data completeness | `tests/structure/**` | `*.test.ts`, `bun test tests/structure` | Matrix/register shape, family accounting and wiring, participation record, identity-free allowlist scan, registry pins, flow/step golden, inventory/export pins, workflow pins |
| Offline conformance | Contract and in-process E2E | `tests/conformance/**` | `*.test.ts`, `bun test tests/conformance` | Derived conformance matrices, gate over a real mock report, both adjudication arms, the eleven parity mutations, family replay classification, write-then-read through the double, replay equality, fail-closed refusals, guards |
| Repository invariants | Static scan and mutation | `tests/checks/**` | `*.test.ts`, `bun test tests/checks` | The two-tree `tracker.` literal scan, gate wiring/discovery, workflow invariance pins, diagnostics bounds, fixture sanitization/privacy, error-table sync, secret-read boundary |
| Provider behaviour | Integration (in-process replay) | `tests/behaviour/providers/**` | `*.test.ts`, `bun test tests/behaviour/providers` | Production-client family replays, delivered trap suites, capability postures, the existing stateful single-issue helper (unchanged) |
| Boundaries | Static/graph | `tests/boundaries/**` | `*.test.ts`, `bun test tests/boundaries` | `runtime-apis-confinement`, depcruise testkit edges, fixture-coverage meta-check |
| Compile-time probes | Type | `tests/types/**` | `pnpm typecheck` (`tsc -p tests/types/tsconfig.json`) | Registration shape (no lifecycle hook), cell/effect vocabulary exactness, closed-set operation typing |
| Quality gate | Execution record | repository root | `pnpm check` | Lint, format, typecheck, test, boundaries, memory, prompt/help/exports parity |

Mocking and isolation: every provider interaction is an injected `ConformanceTransport` (the stateless exact-URL transport or the new stateful double); credentials are non-secret canaries; time is an injected constant (`2026-10-31T00:00:00Z`, matching the delivered suites) and the run id is injected; the mock tier installs the throwing-`fetch` guard and the child-process guard and asserts zero calls on both. No case reads the ambient environment, the network, or a real credential. Mutation controls that need a writable tree copy into `mkdtemp` and clean up; no case mutates a committed file or exposes module-level mutable state.

## 5. Test Scenarios

### 5.1 Scenario Index

| TC ID | Title | Type | Layer | Priority | AC Coverage |
|-------|-------|------|-------|----------|-------------|
| TC-PARITY-001 | Exactly one cell per adapter × closed operation, with no unregistered or out-of-set key | Contract | Structure + conformance | Critical | AC-F1-1, DM-1, NFR-2 |
| TC-PARITY-002 | The reference column is uniformly `same-as-reference` and carries no register entry | Contract | Structure | Critical | AC-F1-2, DM-7 |
| TC-PARITY-003 | Every `gap` cell agrees with the capability declaration in both directions | Contract | Structure | Critical | AC-F1-3, DM-1 |
| TC-PARITY-004 | Register ↔ cell bijection with all four required fields and a closed class | Contract | Structure + types | Critical | AC-F1-4, DM-2, NFR-2 |
| TC-PARITY-005 | A `same-as-reference` cell contradicted by observation fails naming the dimension | Negative | Conformance | Critical | AC-F1-5, NFR-2 |
| TC-PARITY-006 | A `declared-difference` entry whose evidence shows reference-equal behaviour fails naming the entry | Negative | Conformance | Critical | AC-F1-6, DM-2 |
| TC-PARITY-007 | The initial 27-cell census and a total adjudication record over exactly the five intersections | Contract | Structure + conformance | Critical | AC-F1-1..AC-F1-6, DM-7, NFR-2 |
| TC-PARITY-008 | Both adjudication arms are proven for every declared posture and neither can silently disappear | Contract | Conformance | Critical | AC-F1-5, AC-F1-6, NFR-2 |
| TC-PMUT-001 | Missing cell is rejected naming provider, operation, and `cell-set` | Negative | Conformance | High | AC-F1-7, API-1, NFR-2 |
| TC-PMUT-002 | Duplicate cell is rejected naming provider, operation, and `cell-set` | Negative | Conformance | High | AC-F1-7, API-1, NFR-2 |
| TC-PMUT-003 | Extra cell (unknown row key) is rejected naming the row and `cell-set` | Negative | Conformance | High | AC-F1-7, API-1, NFR-2 |
| TC-PMUT-004 | Out-of-set cell value is rejected naming provider, operation, and `cell-vocabulary` | Negative | Conformance | High | AC-F1-7, API-1, NFR-2 |
| TC-PMUT-005 | Out-of-set difference class is rejected naming the entry and `difference-class` | Negative | Conformance | High | AC-F1-7, API-1, NFR-2 |
| TC-PMUT-006 | Support/gap contradiction is rejected naming provider, operation, and `declaration-agreement` | Negative | Conformance | Critical | AC-F1-7, API-1, NFR-2 |
| TC-PMUT-007 | A cell for an unregistered adapter is rejected naming the column and `column-registration` | Negative | Conformance | High | AC-F1-7, API-1, NFR-2 |
| TC-PMUT-008 | A `declared-difference` cell with no register entry is rejected naming provider, operation, and `register-bijection` | Negative | Conformance | Critical | AC-F1-7, API-1, NFR-2 |
| TC-PMUT-009 | A register entry naming no cell is rejected naming the entry and `register-bijection` | Negative | Conformance | Critical | AC-F1-7, API-1, NFR-2 |
| TC-PMUT-010 | Two register entries for one adapter and operation are rejected naming both ids and `register-bijection` | Negative | Conformance | Critical | AC-F1-7, API-1, NFR-2 |
| TC-PMUT-011 | A non-uniform reference column is rejected naming the reference, the operation, and `reference-purity` | Negative | Conformance | Critical | AC-F1-7, API-1, NFR-2 |
| TC-ART-001 | The artifact schema, closed sets, and caps are unchanged, and an added parity field fails by name | Regression | Conformance | Critical | AC-F1-8, NFR-8 |
| TC-ART-002 | No parity vocabulary or parity verdict appears in the serialized artifact | Regression | Conformance + checks | High | AC-F1-8, NFR-3 |
| TC-TAX-001 | Exactly four class ids, one identity each, structured-only, and never emitted | Contract | Structure + conformance + checks | Critical | AC-F2-1, DM-3, NFR-3 |
| TC-TAX-002 | The `tracker.` literal scan has an exact two-tree scope and a single-file allowlist | Contract | Checks | Critical | AC-F2-1, DM-3, NFR-3 |
| TC-TAX-003 | An auth stimulus classifies as `tracker.auth.rejected` with status, distinguishable from credential absence | Happy Path | Behaviour | Critical | AC-F2-2, DM-3, DM-4 |
| TC-TAX-004 | A transport stimulus classifies as `tracker.transport.failed` with no status and is distinguishable | Happy Path | Behaviour | Critical | AC-F2-3, DM-3, DM-4 |
| TC-TAX-005 | A rate-limit stimulus classifies as the payload class with its status and never from prose | Happy Path | Behaviour | High | AC-F2-4, DM-3, DM-4 |
| TC-TAX-006 | An undecodable 2xx and a prose-contradicted non-2xx both classify from structured fields | Edge Case | Behaviour | High | AC-F2-5, DM-3, DM-4 |
| TC-TAX-007 | A workflow-state mismatch classifies with zero provider requests, or is gap-backed or recorded | Edge Case | Behaviour | High | AC-F2-6, DM-3, DM-4 |
| TC-TAX-008 | A page-limited read is a bounded observation, not an error class, with no new bound or retry | Edge Case | Behaviour | High | AC-F2-7, DM-3, DM-4 |
| TC-TAX-009 | The five-outcome decision rule is total, ordered, and deterministic, with read-404 outside the taxonomy | Contract | Behaviour | Critical | AC-F2-8, DM-3, NFR-3 |
| TC-TAX-010 | The capability class is proven structurally and never as an adapter failure | Contract | Conformance + structure | High | AC-F2-9, DM-3, DM-4 |
| TC-TAX-011 | Per adapter × family exactly one posture; silence and dual posture both fail by name | Contract | Structure | Critical | AC-F2-10, DM-4, NFR-4 |
| TC-TAX-012 | Catalog↔family wiring is bidirectional and every entry keeps four fields with a resolving fixture | Contract | Structure | Critical | AC-F2-11, DM-4, NFR-4 |
| TC-TAX-013 | Every covered family stimulus replays through the production client and satisfies its declared outcome | Contract | Conformance + behaviour | Critical | AC-F2-10, DM-3, NFR-3 |
| TC-DOUBLE-001 | Write-then-read is observable through the client factory with the registry census unchanged | Happy Path | Conformance | Critical | AC-F3-1, API-3, API-4, DM-5 |
| TC-DOUBLE-002 | Two replays produce identical canonical state, reads, results and ordering, and match the golden | Contract | Conformance | Critical | AC-F3-2, DM-5, NFR-1, NFR-5 |
| TC-DOUBLE-003 | Undeclared request, undeclared effect, and missing resource each fail closed by name | Negative | Conformance | Critical | AC-F3-3, DM-5, NFR-5 |
| TC-DOUBLE-004 | Both guards observe zero calls across the double-backed flows and are provably armed | Negative | Conformance | Critical | AC-F3-4, NFR-1 |
| TC-DOUBLE-005 | Committed stateless tenants replay identically, and a no-effect route never mutates state | Regression | Conformance | Critical | AC-F3-5, DM-5, NFR-8 |
| TC-DOUBLE-006 | The double is runtime-neutral and all I/O and guards stay under `tests/` | Contract | Boundaries + checks | Critical | AC-F3-6, NFR-7 |
| TC-DOUBLE-007 | Each of the five effects is applied by its matched route and never inferred | Contract | Conformance | Critical | AC-F3-1, DM-5, NFR-5 |
| TC-DMUT-001 | An effect outside the five-effect vocabulary fails at decode naming route and effect | Negative | Conformance | High | AC-F3-7, DM-5 |
| TC-DMUT-002 | Two effects on one route fail at decode naming the route | Negative | Conformance | High | AC-F3-7, DM-5 |
| TC-DMUT-003 | An effect whose operands do not resolve fails naming the offending declaration | Negative | Conformance | High | AC-F3-7, DM-5 |
| TC-DMUT-004 | A created-entry identity with no declared sequence fails naming the declaration | Negative | Conformance | High | AC-F3-7, DM-5 |
| TC-REG-001 | Exactly the five participation items are declared and a sixth is refused | Contract | Structure + types | Critical | AC-F4-1, API-5, DM-6 |
| TC-REG-002 | The injected control adapter passes with a complete column and full family accounting | Happy Path | Conformance | Critical | AC-F4-2, DM-6, NFR-10 |
| TC-REG-003 | The shipped registry stays exactly three contracts and still rejects an unknown registration | Regression | Structure + conformance | Critical | AC-F4-3, DM-6 |
| TC-REG-004 | The bound set carries zero provider literals outside an exact file-plus-construct allowlist | Contract | Structure | Critical | AC-F4-4, DM-6, NFR-10 |
| TC-REG-005 | An out-of-set operation, a lifecycle hook, and a runner branch are each refused by name | Negative | Structure + types | Critical | AC-F4-5, DM-6, NFR-8 |
| TC-REG-006 | Dropping any one of the five supplied items makes the control run fail by name | Negative | Conformance | Critical | AC-F4-2, NFR-10 |
| TC-GATE-001 | The gate is discovered by the existing aggregate test path in the existing `ts-test` job | Contract | Checks | Critical | AC-F5-1, NFR-6 |
| TC-GATE-002 | Workflow file set, job set, and triggers are pinned, and the two delivered suites are unweakened | Regression | Checks | Critical | AC-F5-1, NFR-6 |
| TC-GATE-003 | Diagnostics name provider, operation, clause and reference, and stay bounded and secret-free | Contract | Conformance + checks | Critical | AC-F5-2, NFR-11, NFR-9 |
| TC-GATE-004 | Consecutive runs produce an identical, canonically ordered violation list | Contract | Conformance | Critical | AC-F5-3, NFR-1, NFR-2 |
| TC-FLOOR-001 | The delivered conformance, harness and workflow suites stay green and unweakened | Regression | Structure + conformance + checks | Critical | NFR-6, §24.3(4)(6) |
| TC-FLOOR-002 | No adapter's capability posture or behaviour changed | Regression | Behaviour | Critical | §24.3(1), pm-notes binding expectation |
| TC-FLOOR-003 | No closed operation, port, capability flag, carrier kind, error row, domain kind, projection or exit code moved | Regression | Structure + checks | Critical | NFR-8, §24.3(2)(3) |
| TC-FLOOR-004 | The pinned inventory, export and boundary surfaces are updated exactly and not vacuously | Regression | Structure + boundaries | Critical | NFR-7, NFR-8 |
| TC-FLOOR-005 | Fixture hygiene and the secret-read boundary are unchanged | Regression | Checks | Critical | NFR-9, §24.3(9) |
| TC-FLOOR-006 | The aggregate gate is green | Quality gate | Repository | Critical | NFR-8 |

### 5.2 Scenario Details

#### TC-PARITY-001 - Exactly one cell per adapter × closed operation, with no unregistered or out-of-set key

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-1, API-1, DM-1, NFR-2
**Target Layer / Location**: `tests/conformance/parity-gate.test.ts` (new) calling the pure gate from `packages/testkit/src/conformance/parity.ts` · **Tags**: @conformance @parity @contract
**Fixtures**: the exported `PARITY_MATRIX`, `CONFORMANCE_ADAPTERS`, `ADAPTER_OPERATIONS`.

**Given** the declared matrix and the live registration list, **When** the gate enumerates cells, **Then** the cell multiset equals `ADAPTER_OPERATIONS × providers(CONFORMANCE_ADAPTERS)` exactly (27 for three adapters), each column contains nine distinct operation rows, `matrix.providers` set-equals the registration providers in both directions, no cell names an operation outside `ADAPTER_OPERATIONS`, and the violation list is empty.
**Pass criterion**: multiset cardinality 27 plus **set equality both directions** plus per-column count 9 — not a length check on one side. Mutations: a removed cell (`TC-PMUT-001`), a duplicated `(provider, operation)` (`TC-PMUT-002`), a tenth row key (`TC-PMUT-003`), and an `azure` column (`TC-PMUT-007`) each fail naming provider, operation and clause; a matrix whose `providers` list omits a registered adapter fails naming the missing registration.

#### TC-PARITY-002 - The reference column is uniformly `same-as-reference` and carries no register entry

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-2, DM-1, DM-7
**Target Layer / Location**: `tests/conformance/parity-gate.test.ts` · **Tags**: @conformance @parity @contract

**Given** the declared reference adapter (`github`), **When** its column and the register are inspected, **Then** the reference value is a single declared string that is a member of the registered provider set, all nine of its cells are `{ kind: "same-as-reference" }`, and no register entry has `adapter` equal to the reference.
**Pass criterion**: exact cell-kind equality for nine rows plus zero register matches plus reference ∈ registrations. Mutations: a `gap` cell in the reference column and a `declared-difference` cell in the reference column (`TC-PMUT-011`) both fail with clause `reference-purity`; a reference value naming an unregistered adapter fails naming the value; a register entry naming the reference fails naming `differenceId`.

#### TC-PARITY-003 - Every `gap` cell agrees with the capability declaration in both directions

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-3, DM-1
**Target Layer / Location**: `tests/conformance/parity-gate.test.ts` · **Tags**: @conformance @parity @capability

**Given** every registration's `contract.capabilities`, **When** each cell is compared with that adapter's declaration, **Then** a `gap` cell's `reason` is identical to the declared `CapabilityGapReason` for that operation (character equality, not a category match), a `supported` operation never carries a `gap` cell, and a `gap`-declared operation never carries `same-as-reference` or `declared-difference`.
**Pass criterion**: 27 comparisons with zero mismatch, asserting the reason as a string and the direction in both senses; the cell is a *reference* to the declaration, so the case fails if the matrix restates a reason the declaration does not carry. Mutation `TC-PMUT-006` covers both contradiction directions and fails naming provider, operation and `declaration-agreement`; one extra case-level mutation changes a single character of one reason and must fail.

#### TC-PARITY-004 - Register ↔ cell bijection with all four required fields and a closed class

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-4, API-1, DM-2, NFR-2
**Target Layer / Location**: `tests/conformance/parity-gate.test.ts`; `tests/types/conformance-participation.type-test.ts` (cell/entry vocabulary probe) · **Tags**: @conformance @parity @contract @types
**Fixtures**: the exported register plus `differenceId`-addressed evidence fixtures under `tests/fixtures/providers/conformance/parity/evidence/`.

**Given** every `declared-difference` cell and every register entry, **When** compared in both directions, **Then** each such cell has exactly one entry, each entry names an existing cell, `(adapter, operation)` is unique across entries, `differenceClass` is a member of the six-class set, `rationale.trim()` is non-empty, `evidence` resolves to a committed fixture (file plus optional JSON pointer), and `adjudicatedBy` is a non-empty reference that resolves to an existing decision record id or a recorded review reference.
**Pass criterion**: bijection asserted as two set-differences that must both be empty, plus field-level assertions with the offending field named. Mutations `TC-PMUT-008/009/010` cover the three bijection failures; case-level mutations for an empty rationale, an unresolvable evidence pointer, a missing `adjudicatedBy`, and an empty-string `differenceClass` each fail naming the field and the `differenceId`; a type probe asserts a free-text cell value and a seventh class are not representable.

#### TC-PARITY-005 - A `same-as-reference` cell contradicted by observation fails naming the dimension

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-5, API-1, DM-1, NFR-2
**Target Layer / Location**: `tests/conformance/parity-gate.test.ts` over a real `runConformance` mock report · **Tags**: @conformance @parity @mutation

**Given** a mock report produced by the delivered runner over the three committed tenants, **When** the gate compares each supported `same-as-reference` cell with the reference adapter's outcome on that operation, **Then** the four provider-independent dimensions are each compared and each must agree: (1) step participation — the set of `executed` `stepId`s for that operation; (2) assertion families — the set of `assertionFamily` values applied, and both sides passed; (3) tracker error class — the class resolved by the taxonomy for the families accounted against that operation, or an explicit "not applicable because the accounting declares no family" (never a silent skip); (4) absence and truncation — the declared absence signal and truncation flag.
**Pass criterion**: equality on all four dimensions for every such cell, with the report unmutated producing zero violations. Four independent mutations, one per dimension (a differing executed-step set; a differing assertion-family name; a differing resolved class; a differing truncation flag injected into the non-reference provider's report entry), each fail with a violation naming **that provider, that operation, and that dimension**. A fifth mutation hides a divergence by turning the operation's step into a skip: the gate must fail naming the cell's clause (`observed-contradiction`), proving the difference is not absorbed.

#### TC-PARITY-006 - A `declared-difference` entry whose evidence shows reference-equal behaviour fails naming the entry

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-6, API-1, DM-2, NFR-2
**Target Layer / Location**: `tests/conformance/parity-gate.test.ts` · **Tags**: @conformance @parity @mutation
**Fixtures**: one evidence document per recorded difference; one deliberately reference-equal evidence document used only by the mutation.

**Given** every register entry, **When** its evidence is replayed through the production client with an injected transport, **Then** the recorded `differenceClass` names a dimension that actually differs, the replay reproduces that difference on that dimension, and an entry whose evidence shows reference-equal behaviour fails with clause `evidence-reproduction`.
**Pass criterion**: for each entry, the class→dimension mapping is asserted against the replayed observation (e.g. `identity-scheme` must show a differing identity value while the primitive shape is equal; `pipeline-model` a differing pipeline vehicle; `failure-classification` a differing resolved class with the deciding structured field named). Mutation: point one entry's `evidence` at the reference-equal document (and separately at a non-resolving pointer) → both fail naming `differenceId`, adapter, operation, clause `evidence-reproduction`. This case is the *only* falsification of an honest difference; it is never merged into `TC-PARITY-005`.

#### TC-PARITY-007 - The initial 27-cell census and a total adjudication record over exactly the five intersections

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-1, AC-F1-2, AC-F1-3, AC-F1-4, AC-F1-5, AC-F1-6, DM-7, NFR-2
**Target Layer / Location**: `tests/conformance/parity-gate.test.ts` · **Tags**: @conformance @parity @adjudication
**Fixtures**: `tests/fixtures/providers/conformance/parity/adjudication.json` (authored in delivery, so it records *whichever* outcome the evidence shows).

**Given** the delivered declarations and the declared matrix, **When** the census is computed, **Then** the counts are exactly: 27 cells; 13 `gap` cells matching the 13 declared gaps (GitHub 0, GitLab 7, Jira 6); 14 supported cells; 9 of those in the reference column; exactly **5** non-reference supported intersections — GitLab `read-delivery-request`, GitLab `read-pipeline-run`, Jira `read-work-item`, Jira `write-work-item`, Jira `transition-work-item`; and the adjudication record's key set **set-equals** that computed intersection set in both directions.
**Pass criterion**: the computed intersection set is derived from the contracts and the matrix (not hard-coded as a name list), then compared with the record; a missing entry or a sixth entry fails naming the intersection. Each record entry carries provider, operation, the chosen posture, the four dimension observations, and an evidence/adjudication reference, and its posture deep-equals the matrix cell's kind for that pair — so the record cannot disagree with the matrix it describes. **This case asserts totality and consistency only; it neither predicts nor requires any particular verdict for the five.**

#### TC-PARITY-008 - Both adjudication arms are proven for every declared posture and neither can silently disappear

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-5, AC-F1-6, NFR-2
**Target Layer / Location**: `tests/conformance/parity-gate.test.ts` · **Tags**: @conformance @parity @adjudication @mutation

**Given** the adjudication record from `TC-PARITY-007`, **When** each of the five intersections is exercised, **Then** exactly one arm runs per intersection and it runs *with its own falsifying mutation*:
- **`same-as-reference` arm** — the four-dimension comparison is equality and the gate passes; injecting a one-dimension divergence on that cell makes the gate fail naming provider, operation, and dimension (the `AC-F1-5` mechanism).
- **`declared-difference` arm** — a register entry exists whose class names the differing dimension, its evidence reproduces it, and substituting reference-equal evidence makes the gate fail naming the entry (the `AC-F1-6` mechanism).
**Pass criterion**: the executed arm per intersection is reported in the test name so review can read the adjudication from a test run; the case additionally asserts a **suite-level invariant independent of the record's contents**: the mutation registry declares four `AC-F1-5` dimension mutations and one `AC-F1-6` falsified-evidence mutation, and all five execute on every run. Therefore neither adjudication path can be deleted, weakened, or made unreachable by a record that happens to declare one posture five times. If the delivery changes an adapter so an intersection becomes `same-as-reference`, that is an adapter delta and fails `TC-FLOOR-002` — not this case.

#### TC-PMUT-001 - Missing cell is rejected naming provider, operation, and `cell-set`

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-7, API-1, NFR-2 · **Target**: `tests/conformance/parity-gate.test.ts`; inputs from `tests/fixtures/providers/conformance/parity/mutations.ts` · **Tags**: @conformance @parity @mutation

**Given** a deep copy of the production matrix with one `(gitlab, read-work-item)` cell removed, **When** the gate runs, **Then** exactly the expected violation appears: `provider: "gitlab"`, `operation: "read-work-item"`, `clause: "cell-set"`. The unmutated copy returns `[]` in the same case (paired positive).

#### TC-PMUT-002 - Duplicate cell is rejected naming provider, operation, and `cell-set`

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-7, API-1, NFR-2 · **Target**: same file and mutation source · **Tags**: @conformance @parity @mutation

**Given** a copy with two cells for the same `(jira, transition-work-item)`, **When** the gate runs, **Then** one violation names provider `jira`, operation `transition-work-item`, clause `cell-set`, and the detail states the duplicate count. A copy that is complete and unique returns `[]`.

#### TC-PMUT-003 - Extra cell (unknown row key) is rejected naming the row and `cell-set`

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-7, API-1, NFR-2 · **Target**: same file and mutation source · **Tags**: @conformance @parity @mutation

**Given** a copy carrying a tenth row keyed `read-attachment` (a well-formed cell for an operation outside the closed set), **When** the gate runs, **Then** the violation names operation `read-attachment` and clause `cell-set`, and the cell count is reported as 28 against the required 27.

#### TC-PMUT-004 - Out-of-set cell value is rejected naming provider, operation, and `cell-vocabulary`

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-7, API-1, NFR-2 · **Target**: same file and mutation source · **Tags**: @conformance @parity @mutation

**Given** a copy in which one cell is `{ kind: "reference-equal" }` (a kind outside the three-member vocabulary), **When** the gate runs, **Then** the violation names that provider, that operation, and clause `cell-vocabulary`, and the received kind is quoted as a scalar.

#### TC-PMUT-005 - Out-of-set difference class is rejected naming the entry and `difference-class`

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-7, API-1, NFR-2 · **Target**: same file and mutation source · **Tags**: @conformance @parity @mutation

**Given** an entry whose `differenceClass` is `timing-model` (outside the six), **When** the gate runs, **Then** the violation names the `differenceId`, the adapter, the operation, and clause `difference-class`; the reference-equal six-member set passes. The closed class set is read from one exported constant, so a seventh class added to the constant without a decision fails this case's set assertion.

#### TC-PMUT-006 - Support/gap contradiction is rejected naming provider, operation, and `declaration-agreement`

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-7, API-1, NFR-2 · **Target**: same file and mutation source · **Tags**: @conformance @parity @mutation

**Given** two copies — one where `(gitlab, read-delivery-request)` carries a `gap` cell although the declaration supports it, one where `(jira, write-comment)` carries `same-as-reference` although it is declared `adapter-not-implemented` — **When** the gate runs, **Then** each produces a violation naming that provider, that operation, and clause `declaration-agreement`, in both directions. A third copy carrying a `gap` cell whose reason differs by one character from the declaration also fails, naming the expected and received reasons.

#### TC-PMUT-007 - A cell for an unregistered adapter is rejected naming the column and `column-registration`

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-7, API-1, DM-6, NFR-2 · **Target**: same file and mutation source · **Tags**: @conformance @parity @mutation

**Given** a copy with an added `azure` column (nine cells) while the registration list stays at three, **When** the gate runs, **Then** a violation names provider `azure` and clause `column-registration`. The inverse copy — a registered provider whose column is absent — fails naming the provider and the same clause; both are asserted so a one-sided check cannot pass.

#### TC-PMUT-008 - A `declared-difference` cell with no register entry is rejected

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-7, API-1, NFR-2 · **Target**: same file and mutation source · **Tags**: @conformance @parity @mutation

**Given** a copy whose `(jira, read-work-item)` cell is `declared-difference` with a `registerId` that exists in no entry, **When** the gate runs, **Then** the violation names provider `jira`, operation `read-work-item`, clause `register-bijection`, and quotes the dangling `registerId`. A second variant with a cell whose `registerId` is present but whose entry is keyed to a different pair also fails.

#### TC-PMUT-009 - A register entry naming no cell is rejected naming the entry and `register-bijection`

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-7, API-1, NFR-2 · **Target**: same file and mutation source · **Tags**: @conformance @parity @mutation

**Given** a copy with an added entry for `(github, write-comment)` — a pair whose cell is `same-as-reference` — **When** the gate runs, **Then** the violation names that `differenceId`, the adapter, the operation, and clause `register-bijection`. A variant whose entry names an operation no adapter column carries fails naming the operation.

#### TC-PMUT-010 - Two register entries for one adapter and operation are rejected

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-7, API-1, NFR-2 · **Target**: same file and mutation source · **Tags**: @conformance @parity @mutation

**Given** a copy with two entries keyed `(gitlab, read-pipeline-run)` and distinct ids, **When** the gate runs, **Then** one violation names both `differenceId`s, the adapter, the operation, and clause `register-bijection`. A variant with the same `differenceId` twice also fails, naming the duplicated id.

#### TC-PMUT-011 - A non-uniform reference column is rejected naming the reference and operation

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-7, API-1, DM-7, NFR-2 · **Target**: same file and mutation source · **Tags**: @conformance @parity @mutation

**Given** a copy in which `(github, write-comment)` is `declared-difference` with a well-formed entry, **When** the gate runs, **Then** the violation names the reference provider `github`, operation `write-comment`, and clause `reference-purity`, and no other cell is reported (so the check localizes). A variant where the reference cell is `gap` with the declared reason fails with the same clause, proving purity is not only a difference check.

#### TC-ART-001 - The artifact schema, closed sets, and caps are unchanged, and an added parity field fails by name

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-8, NFR-8
**Target Layer / Location**: `tests/conformance/artifact.test.ts` (extend the existing `TC-CHECK-010` key-set case and the `TC-CONF-018/019` bounds cases) · **Tags**: @conformance @artifact @regression

**Given** a mock artifact produced after the change, **When** inspected, **Then** `Object.keys(artifact).sort()` equals exactly the eleven delivered names (`createdArtifacts`, `flows`, `generatedAt`, `mutationRequests`, `providers`, `runId`, `schema`, `status`, `steps`, `tier`, `totals`), provider and overall statuses are the three-member closed set, step statuses are three, flow statuses are three, `skipKind` is the three-member closed set with `null` exactly on executed/failed steps, and the caps are unchanged (16 providers, 16 flows, 64 steps/flow, 512 steps, 16 missing settings, 1024 detail characters, 262144 serialized bytes).
**Pass criterion**: exact key-set equality is the control — a delivered `parity` field makes this case fail naming the extra key even though `validateConformanceArtifact` does not reject unknown top-level keys (it rejects unknown **summary** fields only). Mutation: add `parity: {}` at top level → this case fails naming `parity`; add `parity` inside a provider flow summary → the delivered validator fails naming the summary field. Caps are asserted as exported constants, so a tightened or loosened number is a named failure.

#### TC-ART-002 - No parity vocabulary or parity verdict appears in the serialized artifact

**Scenario Type**: Regression · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-1, AC-F1-8, DM-3, NFR-3
**Target Layer / Location**: `tests/conformance/artifact.test.ts` (extend) · **Tags**: @conformance @artifact @parity @scan

**Given** the serialized artifact bytes, **When** scanned, **Then** none of the four tracker class ids, none of `same-as-reference` / `declared-difference` / the six difference-class ids, and no `differenceId` or matrix cell kind occurs.
**Pass criterion**: zero occurrences, paired with a **positive** in the same case (the artifact does contain the injected `runId`, the schema id, and the nine step operations), so the scan cannot pass by scanning nothing. Mutation: inject one class id and one cell kind into a step's failure `detail` → the scan fails naming the field path and the literal; injecting a `differenceId` fails likewise.

#### TC-TAX-001 - Exactly four class ids, one identity each, structured-only, and never emitted

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-1, API-2, DM-3, NFR-3
**Target Layer / Location**: `packages/testkit/src/conformance/tracker-error-taxonomy.ts` (declared data + total decision function) exercised by `tests/conformance/tracker-taxonomy.test.ts` (new); `tests/structure/conformance-coverage.test.ts` (module/export pin) · **Tags**: @conformance @taxonomy @contract

**Given** the declared taxonomy, **When** inspected, **Then** it exports exactly four class ids (`tracker.capability.unsupported`, `tracker.auth.rejected`, `tracker.transport.failed`, `tracker.payload.invalid`), each resolving to exactly one delivered identity (`provider.payload.invalid` for three, the capability-gap declaration for the fourth), each with a declared structured discriminator (status presence and value, or absence; operation membership) and a named proving family or `structural`; the table contains **zero provider names**; `ERROR_TABLE`'s row count, `DOMAIN_KINDS`, the projection-class map, and the exit-code map contain **zero** `tracker.` literal; and a replayed family stimulus returns a `code` drawn from the delivered identity set (`provider.payload.invalid`, `provider.not-found`, `config.credential.missing`) and never a class id.
**Pass criterion**: exact four-member id set plus one-identity-per-class plus zero provider literals in the table plus zero `tracker.` occurrences in the four production vocabulary surfaces. Mutations: a fifth id; a second identity for one class; a provider name added to the table; a class id returned as a failure `code`; each fails naming the class, the file, or the identity.

#### TC-TAX-002 - The `tracker.` literal scan has an exact two-tree scope and a single-file allowlist

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-1, DM-3, NFR-3
**Target Layer / Location**: `tests/checks/tracker-literal-scan.test.ts` (new), scanning `packages/testkit/src/**` and `packages/adapters/src/**` · **Tags**: @checks @taxonomy @scan @mutation

**Given** the two source trees, **When** scanned for string literals beginning `tracker.`, **Then** the allowlist is exactly `packages/testkit/src/conformance/tracker-error-taxonomy.ts`, the live tree yields zero hits outside it, and the scan reports file plus construct (string-literal expression) for each hit.
**Pass criterion**: the scope and allowlist are asserted as **exact** collections (a third tree added to the scan, or a second allowlisted file, fails a set-equality assertion), and the baseline scan is asserted empty **before** mutation. Mutations: plant `"tracker.payload.invalid"` in an in-memory copy of `packages/adapters/src/jira/client.ts` and in `packages/testkit/src/conformance/coverage.ts` → both fail naming file and construct. Scope-exactness control in the opposite direction: a copy of `packages/core/src/contracts/status.ts` carrying its eight pre-existing `tracker.*` codes must **not** fail the scan (the core/CLI/MCP vocabulary is out of scope and unchanged), which proves the scan neither over-reaches nor was silently widened to a repo-wide claim.

#### TC-TAX-003 - An auth stimulus classifies as `tracker.auth.rejected` with status, distinguishable from credential absence

**Scenario Type**: Happy Path · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-2, API-2, DM-3, DM-4
**Target Layer / Location**: `tests/conformance/tracker-taxonomy.test.ts` with production-client replay through the injected transport · **Tags**: @conformance @taxonomy @family

**Given** an auth-shape stimulus (status 401 and, separately, 403) replayed through the production client on a supported operation, **When** the result is classified, **Then** it resolves to `tracker.auth.rejected`, carries `code: "provider.payload.invalid"` and `httpStatus ∈ {401, 403}`, and a credential-resolution stimulus on the same operation resolves to `config.credential.missing` and is reported as **outside the taxonomy**.
**Pass criterion**: the two stimuli are distinguished from structured data alone (code plus status presence/value), with no reference to `detail` prose; the case asserts the exact class per stimulus and the "outside" resolution for the credential case. **Declared-posture arm (required by GAP-TP-2)**: for an adapter whose non-2xx path emits `providerPayloadFailure(detail)` with no status (`packages/adapters/src/gitlab/client.ts`, `packages/adapters/src/jira/client.ts`), the case asserts that the accounting's posture for `auth-shapes` is `recorded-difference` with class `failure-classification` and an entry naming `httpStatus` **presence** as the deciding field, and that the observed class equals the recorded class. It never asserts `tracker.auth.rejected` for an adapter that cannot emit the discriminator, and it never lets the absence of a status pass silently. Mutation: make the classifier read `detail` prose → a stimulus whose prose says "unauthorized" with status 500 flips class → the case fails naming the stimulus.

#### TC-TAX-004 - A transport stimulus classifies as `tracker.transport.failed` with no status and is distinguishable

**Scenario Type**: Happy Path · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-3, API-2, DM-3, DM-4
**Target Layer / Location**: `tests/conformance/tracker-taxonomy.test.ts` · **Tags**: @conformance @taxonomy @family

**Given** a transport-failure stimulus (the injected transport throws) replayed through the production client, **When** classified, **Then** it resolves to `tracker.transport.failed`, the failure object **does not own** an `httpStatus` property (`Object.hasOwn(result, "httpStatus") === false`, not merely `undefined`), and it differs from every status-bearing class on the same adapter.
**Pass criterion**: absence is proven three ways — the paired 500-status stimulus on the same operation classifies as the payload class and *does* own `httpStatus`; the hasOwn assertion distinguishes absent from a null-coerced value; and the class pair differs. Where the same adapter emits a status-less 401 (GAP-TP-2), the case asserts the accounting records the resulting indistinguishability as a `failure-classification` difference naming the deciding field, rather than claiming distinguishability the adapter cannot provide.

#### TC-TAX-005 - A rate-limit stimulus classifies as the payload class with its status and never from prose

**Scenario Type**: Happy Path · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-4, API-2, DM-3, DM-4
**Target Layer / Location**: `tests/conformance/tracker-taxonomy.test.ts` · **Tags**: @conformance @taxonomy @family

**Given** a 429 stimulus (and a provider-specific throttling status where one is declared) replayed on a supported operation, **When** classified, **Then** it resolves to `tracker.payload.invalid` with `httpStatus` equal to the stimulus status, on every adapter whose accounting is `covered`; where the accounting is `recorded-difference`, the observed class equals the recorded class and the entry names the deciding structured field.
**Pass criterion**: class and status asserted per adapter, with a **prose-independence pair**: the same status with benign prose and with "rate limited" prose produce the identical class, and a 200 body whose prose says "rate limited" does not classify as a tracker error (it is either a decoded success or an undecodable payload, decided by structure). Mutation: swap the two bodies' prose → classes unchanged; make the classifier read prose → classes flip → fails.

#### TC-TAX-006 - An undecodable 2xx and a prose-contradicted non-2xx both classify from structured fields

**Scenario Type**: Edge Case · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-5, API-2, DM-3, DM-4
**Target Layer / Location**: `tests/conformance/tracker-taxonomy.test.ts` · **Tags**: @conformance @taxonomy @family

**Given** (a) a 200 response whose body does not decode into the declared shape and (b) a 500 response whose body prose asserts success, **When** each is classified, **Then** both resolve to `tracker.payload.invalid` — (a) from the decode outcome, (b) from the status — and neither classification depends on the prose.
**Pass criterion**: the two stimuli differ only in status/decodability, and their prose is deliberately contradictory in both directions (success prose on 500, failure prose on the undecodable 200), so any prose-reading implementation flips at least one class. Mutation: exchange the two bodies → both classes unchanged.

#### TC-TAX-007 - A workflow-state mismatch classifies with zero provider requests, or is gap-backed or recorded

**Scenario Type**: Edge Case · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-6, API-2, DM-3, DM-4
**Target Layer / Location**: `tests/conformance/tracker-taxonomy.test.ts` · **Tags**: @conformance @taxonomy @family @requests

**Given** (a) a read whose native state does not resolve through the declared mechanism and (b) a transition the declared mechanism cannot perform, **When** each is replayed, **Then** each resolves to `tracker.payload.invalid`, the transition case carries **zero provider requests** (the recorded transport request count is unchanged across the call), or the operation is a declared gap for that adapter with its exact reason, or the accounting records a `failure-classification` difference — never silence.
**Pass criterion**: for (b) the assertion is on the transport's recorded request list length before and after the call (exactly equal), plus the class; a delivery that dispatches first and refuses after fails this case. Mutations: make the transition dispatch (requests becomes 1 → case fails); drop the family from the accounting (fails `TC-TAX-011` by name).

#### TC-TAX-008 - A page-limited read is a bounded observation, not an error class, with no new bound or retry

**Scenario Type**: Edge Case · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-7, API-2, DM-3, DM-4
**Target Layer / Location**: `tests/conformance/tracker-taxonomy.test.ts` · **Tags**: @conformance @taxonomy @family @bounds

**Given** a stimulus that reads a page-limited collection, **When** replayed, **Then** the declared outcome is a **bounded observation**: the returned page length equals the declared page limit, the truncation signal is `true` exactly when the provider's total exceeds the returned page, and the classification function returns the pagination family's `bounded-observation` outcome rather than any error class.
**Pass criterion**: the assertion is over the declared limit and the truncation flag, both read from data; exact-boundary cases (limit−1, limit, limit+1) are asserted so an off-by-one is named; the case also asserts **no new bound** (the artifact/tenant caps are unchanged) and **no retry or follow-up pagination** (exactly one request for the read). Mutation: change the truncation flag on the exact-limit case → fails naming the boundary case.

#### TC-TAX-009 - The five-outcome decision rule is total, ordered, and deterministic, with read-404 outside the taxonomy

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-8, API-2, DM-3, NFR-3
**Target Layer / Location**: `tests/conformance/tracker-taxonomy.test.ts` · **Tags**: @conformance @taxonomy @contract

**Given** one stimulus per observable outcome — a capability gap, an adapter refusal with zero requests, no response, a read's explicit 404, and any other status or undecodable success — **When** each is classified, **Then** the projection is total (every stimulus yields exactly one class or the declared `outside-taxonomy` resolution), deterministic (the same stimulus twice yields the identical value), and **ordered**: (1) capability gap → `tracker.capability.unsupported` and a `declared-gap` skip, never a failure; (2) adapter refusal with zero requests → `tracker.payload.invalid`; (3) no response → `tracker.transport.failed`; (4) read 404 → `provider.not-found`, outside the taxonomy; (5) otherwise 401/403 → `tracker.auth.rejected`, any other status or undecodable 2xx → `tracker.payload.invalid`; and a write's 404 stays `tracker.payload.invalid`.
**Pass criterion**: an **ambiguity set** proves the order rather than the membership: a refusal that would also present as a status-less failure resolves to the refusal rule (earlier), and a write 404 resolves to the payload rule while the read 404 resolves outside. Mutation: swap rules (2) and (3) → the ambiguity stimulus flips → the case fails naming the stimulus and both candidate classes. A second mutation makes a write 404 resolve to `provider.not-found` → fails naming the operation.

#### TC-TAX-010 - The capability class is proven structurally and never as an adapter failure

**Scenario Type**: Contract · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-9, DM-3, DM-4
**Target Layer / Location**: `tests/conformance/tracker-taxonomy.test.ts`; `tests/structure/conformance-coverage.test.ts` (read-only control) · **Tags**: @conformance @taxonomy @coverage

**Given** the declared gaps of the three adapters, **When** the class is proven, **Then** it is proven by the structural coverage gate (every gap operation is in the closed set, has a step, and is disjoint from the supported set) **plus** the runtime declared-gap encounter rule (each gap encountered as `skipped` with `skipKind: "declared-gap"` and the exact `skipReason`), no fixture family is attached to the capability class, and no step for a gapped operation has `status: "failed"`.
**Pass criterion**: the two mechanism assertions run over the live report; the taxonomy's table declares the capability class's proving mechanism as `structural` and its family field as absent (asserted exactly). Mutation: record a gapped operation as a failure → the runtime gate fails naming provider and operation; attach a family to the capability class → the case fails naming the class.

#### TC-TAX-011 - Per adapter × family exactly one posture; silence and dual posture both fail by name

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-10, DM-4, NFR-4
**Target Layer / Location**: `tests/structure/conformance-family-accounting.test.ts` (new) over `tests/fixtures/providers/conformance/families/accounting.json` and the pure gate · **Tags**: @structure @taxonomy @accounting @mutation

**Given** the accounting fixture and the registrations, **When** validated, **Then** its key set equals `providers(CONFORMANCE_ADAPTERS) × TRACKER_TRAP_FAMILIES` exactly (18 cells), each cell declares exactly one posture, and: `covered` names ≥1 existing catalog entry in that provider's catalog plus ≥1 resolvable fixture for an operation that adapter declares supported; `gap-backed` names the family's operation and it appears in that adapter's `declaredGaps` with the identical reason; `recorded-difference` names a `registerId` that resolves to an entry with `differenceClass: "failure-classification"`. No cell holds a fixture **and** a gap; an unaccounted family fails naming adapter and family.
**Pass criterion**: set-equality on 18 cells plus per-posture field assertions plus the mutual exclusion. Mutations: remove each of the 18 cells in turn (18 parameterized mutations) → each fails naming adapter and family; declare a `covered` posture whose operation is a declared gap → fails naming the contradiction; declare both a fixture and a gap → fails naming the dual posture.

#### TC-TAX-012 - Catalog↔family wiring is bidirectional and every entry keeps four fields with a resolving fixture

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-11, DM-4, NFR-4
**Target Layer / Location**: `tests/structure/conformance-family-accounting.test.ts`, reusing `loadCatalogs`/`validateCatalogs` from `tests/structure/trap-catalog.test.ts` (read-only control) · **Tags**: @structure @taxonomy @catalog @mutation

**Given** the three committed catalogs and the accounting, **When** validated, **Then** every entry name referenced by the accounting exists in that provider's catalog; every catalog entry that the accounting wires to a family is referenced from exactly one `(adapter, family)` cell (no orphan, no double-wiring); every catalog entry still has exactly the four DM-2 fields; and every `fixtureReference` resolves to a committed file with a resolvable JSON pointer.
**Pass criterion**: bidirectionality asserted as two empty set-differences over the wired subset, so a new catalog entry that claims a family without an accounting cell fails and an accounting name with no entry fails. The four-field and fixture-resolution assertions are the **delivered** validator, unchanged — this case adds no schema. Mutations: a renamed family id; an accounting name absent from the catalog; a catalog entry whose `fixtureReference` points at a missing file; a fifth field added to an entry; each fails naming the entry and the offending field.

#### TC-TAX-013 - Every covered family stimulus replays through the production client and satisfies its declared outcome

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-2, AC-F2-10, API-2, DM-3, NFR-3
**Target Layer / Location**: `tests/conformance/family-classification.test.ts` (new), production client factories from `@delivery-os/adapters/*` with an injected transport · **Tags**: @conformance @taxonomy @family @replay
**Fixtures**: one stimulus fixture per covered (adapter, family); the catalog entries that name them.

**Given** every `covered` accounting cell, **When** its stimulus is replayed through the production client and classified by the taxonomy's decision function, **Then** the observed outcome equals the declared outcome (a class for the five error families, a bounded observation for the pagination family; for `gap-backed` the declared skip with the exact reason; for `recorded-difference` the recorded class).
**Pass criterion**: the number of replays equals the number of `covered` postures (no covered cell without a replay, no replay without a covered cell), so the case cannot pass by replaying nothing; a mismatch fails naming adapter, family, fixture, expected class, received class. Mutation: change one declared outcome for one cell → fails naming that triple; change a stimulus status so the class must move → fails naming the same triple.

#### TC-DOUBLE-001 - Write-then-read is observable through the client factory with the registry census unchanged

**Scenario Type**: Happy Path · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-1, API-3, API-4, DM-5, NFR-1
**Target Layer / Location**: `tests/conformance/stateful-double.test.ts` (new); `tests/structure/conformance-coverage.test.ts` (census golden extension); `packages/testkit/src/conformance/stateful-double.ts` (new) · **Tags**: @conformance @double @happy-path
**Fixtures**: `tests/fixtures/providers/conformance/stateful/{provider}/tenant.json` (declared initial state plus per-route effects).

**Given** a stateful tenant carrying a declared initial state and an ordered write-then-read sequence, **When** the registry runs with `transportFactory` returning the stateful transport for that provider (stateless for the others), **Then** the later read's normalized projection equals the declared expectation for the state the effect produced, and the run's step census is unchanged: three flows, fourteen steps with the exact delivered `stepId`/`operation`/`assertionFamily`/`requiresCarrier` values, one registration per shipped provider, and one step result per provider per registry step.
**Pass criterion**: the read observes the *declared* consequence (asserted against the tenant's `expected` entry), and the census is compared as a golden (no flow added, no step renamed, no assertion family changed, no registration changed). Mutations: add a step to the registry → the census fails naming it; make the read's projection ignore the effect → the projection assertion fails naming the step; change the registration list → `TC-REG-003` fails naming the provider.

#### TC-DOUBLE-002 - Two replays produce identical canonical state, reads, results and ordering, and match the golden

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-2, DM-5, NFR-1, NFR-5
**Target Layer / Location**: `tests/conformance/stateful-double.test.ts` · **Tags**: @conformance @double @determinism @golden
**Fixtures**: `tests/fixtures/providers/conformance/stateful/{provider}/expected-state.json` (canonicalized sorted-key golden).

**Given** the same declared input and the same ordered request sequence, **When** replayed twice with the injected clock, run id, and transport, **Then** three comparisons are deep-equal: (1) canonicalized state (recursively key-sorted JSON of the double's declared resources), (2) the normalized reads (per-step projections), (3) the full report including step order, skip kinds/reasons, and the violation list with its ordering. The canonicalized state additionally deep-equals the committed golden.
**Pass criterion**: **replay-and-compare**, not a single run: the two runs are compared and the golden is compared, so a double that is wrong *and* consistent fails the golden comparison while a double that is nondeterministic fails the run comparison. Mutations: introduce a `Date.now()`-derived identity → run comparison fails; change one declared baseline field → golden comparison fails naming the path; reorder two declared sequence entries → both fail naming the entry index.

#### TC-DOUBLE-003 - Undeclared request, undeclared effect, and missing resource each fail closed by name

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-3, API-3, DM-5, NFR-5
**Target Layer / Location**: `tests/conformance/stateful-double.test.ts` · **Tags**: @conformance @double @negative @fail-closed

**Given** the stateful transport, **When** (a) a request matches no route, (b) the matched route names an effect outside the closed vocabulary (or omits an operand), and (c) an effect addresses a resource/field/collection/sub-resource that does not exist, **Then** each fails by name: (a) `unfixtured provider request {METHOD} {URL}` (the delivered message, preserved); (b) a decode-time failure naming the route index and the effect name; (c) a send-time failure naming the method, the URL, and the effect.
**Pass criterion**: each failure is an `Error` whose message contains the three named elements; the case additionally asserts that the request log shows **no** fallback attempt (no live `fetch`, no spawn — guards still armed) and that state is unchanged after each failure (a failed effect never half-applies). Mutation: make the double treat an unknown effect as a no-op → (b) fails naming the effect.

#### TC-DOUBLE-004 - Both guards observe zero calls across the double-backed flows and are provably armed

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-4, NFR-1
**Target Layer / Location**: `tests/conformance/stateful-double.test.ts`; guards from `tests/behaviour/providers/support.ts` reinstalled via `tests/conformance/support/fixtures.ts` · **Tags**: @conformance @double @hermetic @guards

**Given** the throwing-`fetch` guard and the child-process guard installed for the run, **When** the whole mock tier plus every double-backed flow executes, **Then** the network guard's recorded call count is `0` and the child-process guard's recorded call count is `0` across the run, asserted **after** the run.
**Pass criterion**: both counters are read from the guards, not from the absence of an error; the case is paired with an **arming positive** in the same suite — an attempted `fetch` and an attempted `Bun.spawn` under the guards each throw naming the call — so a guard that was never installed cannot make the zero-call assertion vacuous. Mutation: route one request through a real `fetch` → the count assertion fails naming the URL.

#### TC-DOUBLE-005 - Committed stateless tenants replay identically, and a no-effect route never mutates state

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-5, DM-5, NFR-8
**Target Layer / Location**: `tests/conformance/stateful-double.test.ts`; `tests/conformance/mock-conformance.test.ts` (read-only control) · **Tags**: @conformance @double @regression @stateless

**Given** the three committed stateless tenants unchanged, **When** replayed after the change, **Then** the projections, step order, skip kinds, skip reasons, per-step `assertionCount`, diagnostics, and totals are deep-equal to the delivered golden, and a route with no declared effect performs no state change even when the request body looks mutating (the post-request canonicalized state deep-equals the pre-request state).
**Pass criterion**: the golden comparison runs over the **delivered** tenants (not re-authored ones); the no-effect assertion uses a deliberately write-shaped body so an effect inferred from method or payload shape is caught. Mutations: add an effect to a delivered tenant route → the golden fails naming the step; infer an effect from a `PATCH` method on an effect-less route → the state comparison fails naming the route.

#### TC-DOUBLE-006 - The double is runtime-neutral and all I/O and guards stay under `tests/`

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-6, NFR-7
**Target Layer / Location**: `tests/conformance/stateful-double.test.ts`; `tests/conformance/live/live-entrypoint.test.ts` (existing `scanTestkitSource`); `tests/boundaries/boundaries.test.ts` (existing runtime-confinement rule) · **Tags**: @conformance @double @purity @boundaries

**Given** the testkit package source after the change, **When** inspected, **Then** the double module imports no `node:*` or `bun:*` specifier (the delivered `runtime-apis-confinement` dependency-cruiser rule is green), the ambient source scan over `packages/testkit/src` reports zero hits for `Date.now`, `new Date()`, `Math.random`, `process.env`, `Bun.env`, `Deno.env` (and the new modules are explicitly included in the scanned file list), a source scan of `packages/testkit/src` finds no filesystem read, `fetch` call, or `child_process` reference, and both guards plus all fixture loading are imported only from `tests/**`.
**Pass criterion**: three independent mechanisms plus an explicit inclusion assertion (the scanned file list must contain the new double module — so a scan that silently skips it fails). Mutation: add `import { readFileSync } from "node:fs"` to the double module → the dependency rule and the source scan both fail naming file and construct; add `Date.now()` → the ambient scan fails naming file and pattern.

#### TC-DOUBLE-007 - Each of the five effects is applied by its matched route and never inferred

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-1, DM-5, NFR-5
**Target Layer / Location**: `tests/conformance/stateful-double.test.ts` · **Tags**: @conformance @double @effects

**Given** a tenant exercising each effect, **When** the matched route is requested, **Then** each effect is applied and observed by a later read: `set-field` sets exactly the named field to the declared value and leaves its siblings untouched; `reset-field` restores the named field to its declared baseline; `replace-collection` replaces exactly the named collection with the declared entries (order = declaration order); `append-entry` appends one declared entry using **the next identity from the declared sequence** (the first call takes the first declared identity, the second the second — asserted on both calls); `mark-resolved` marks exactly one named sub-resource resolved. The exported effect vocabulary is exactly five members.
**Pass criterion**: per-effect positive assertions over the read projection plus the exported five-member set; **no inference** is proven by three negatives in the same case — a mutating body on an effect-less route, a URL that looks like a write on a `GET` route with no effect, and a payload field named like a state field on an effect-less route all leave canonicalized state unchanged. Mutations: swap the sequence order → the `append-entry` identity assertion fails; add a sixth effect id → the set assertion fails naming it.

#### TC-DMUT-001 - An effect outside the five-effect vocabulary fails at decode naming route and effect

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-7, API-4, DM-5 · **Target**: `tests/conformance/stateful-double.test.ts`; inputs from `tests/fixtures/providers/conformance/stateful/invalid-effects.ts` · **Tags**: @conformance @double @mutation @decode

**Given** a tenant whose route declares `{ effect: "append-item" }`, **When** decoded, **Then** decode fails with a detail naming the route index and the effect name, and the valid baseline tenant in the same case decodes `ok: true` (paired positive).

#### TC-DMUT-002 - Two effects on one route fail at decode naming the route

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-7, API-4, DM-5 · **Target**: same file and inputs · **Tags**: @conformance @double @mutation @decode

**Given** a route declaring two effects, **When** decoded, **Then** decode fails naming the route index and stating that one effect per route is the declared shape; the baseline decodes `ok: true`. A variant declaring an array of two effects fails identically, so the refusal is about the cardinality and not the syntax.

#### TC-DMUT-003 - An effect whose operands do not resolve fails naming the offending declaration

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-7, API-4, DM-5 · **Target**: same file and inputs · **Tags**: @conformance @double @mutation

**Given** an effect naming a collection absent from every declared resource, **When** decoded (or, if the resource is declared but absent at send time, when requested), **Then** the failure names the offending declaration — the effect, the target resource, and the field/collection — and no state changes; the baseline decodes and applies.

#### TC-DMUT-004 - A created-entry identity with no declared sequence fails naming the declaration

**Scenario Type**: Negative · **Impact Level**: High · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-3, AC-F3-7, API-4, DM-5 · **Target**: same file and inputs · **Tags**: @conformance @double @mutation @identity

**Given** an `append-entry` effect whose collection requires a created identity but whose tenant declares no identity sequence, **When** decoded, **Then** decode fails naming the route index, the effect, and the missing sequence; the baseline tenant with a declared sequence decodes and appends the declared identity. This case proves the double never invents an identity — the same property `TC-DOUBLE-007` asserts behaviourally.

#### TC-REG-001 - Exactly the five participation items are declared and a sixth is refused

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-1, API-5, DM-6, NFR-10
**Target Layer / Location**: `tests/structure/registration-participation.test.ts` (new); `tests/types/conformance-participation.type-test.ts` (new) · **Tags**: @structure @participation @contract @types

**Given** the declared participation record, **When** inspected, **Then** it exports exactly five items — contract, registration, matrix column, tenant fixture set, trap catalog — as an exact ordered or keyed set, and the registration type accepts exactly `{ provider, contract, buildClient, writeHandler? }` with a `@ts-expect-error` probe proving a `lifecyclePhase`, `port`, or `phaseHook` member is not assignable.
**Pass criterion**: exact five-member equality on the declared record (an added sixth item fails naming it) plus the type probe compiling under `pnpm typecheck` (a probe that stops erroring fails the typecheck). Mutation at runtime: add a sixth item id to the record → the set assertion fails naming it.

#### TC-REG-002 - The injected control adapter passes with a complete column and full family accounting

**Scenario Type**: Happy Path · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-2, DM-6, NFR-10
**Target Layer / Location**: `tests/conformance/control-registration.test.ts` (new) · **Tags**: @conformance @participation @control
**Fixtures**: `tests/fixtures/providers/conformance/control/tenant.json`, `tests/fixtures/providers/conformance/control/traps.json`, `tests/fixtures/providers/conformance/control/column.ts` (the control's own namespace, deliberately **outside** `tests/fixtures/providers/traps/` so the three-provider catalog scan and its minima are untouched).

**Given** a conformance-only control adapter supplying only the five items, injected through `RunConformanceInput.adapters`, **When** the suite runs, **Then** the control's provider status is `passed`, every closed operation has either an executed step or a declared-gap skip with the exact reason, its matrix column has nine cells and agrees with its capability declaration (checked by the same gate as the shipped adapters), its family accounting has six postures, and `CONFORMANCE_ADAPTERS` neither contains it before nor after the run.
**Pass criterion**: the assertions are the **delivered** runner and coverage gates applied to an injected adapter — nothing control-specific is checked, which is what makes the proof non-vacuous. The "no module edited" half is proof-by-construction plus review: the case asserts the imported modules are the committed ones (module fingerprint constants exported by each) and §10 records the review-verified touched-file list. Mutations are `TC-REG-006`'s five removals.

#### TC-REG-003 - The shipped registry stays exactly three contracts and still rejects an unknown registration

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-3, DM-6
**Target Layer / Location**: `tests/structure/conformance-coverage.test.ts` (existing `TC-CONF-002`/`TC-CONF-003`, extended only with the control-absence assertion) · **Tags**: @structure @participation @regression

**Given** the live `CONFORMANCE_ADAPTERS`, **When** inspected, **Then** its providers deep-equal `["github", "gitlab", "jira"]` in a **set** comparison, each `contract.adapterName` matches its registration key, the control adapter's provider id appears nowhere in it, and the declaration scan still finds exactly three provider declarations from three files with both-direction resolution (a declaration with no registration and a registration with no declaration both fail).
**Pass criterion**: three-member set equality plus the delivered scan unchanged plus zero control occurrences. Mutations: add an `azure` registration → fails naming `azure`; add a fourth `*_ADAPTER_CONTRACT` declaration with no registration → fails naming file and adapter; move the control into the shipped list → fails naming the provider (this is the mutation that makes the "injected only" claim real).

#### TC-REG-004 - The bound set carries zero provider literals outside an exact file-plus-construct allowlist

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-4, DM-6, NFR-10
**Target Layer / Location**: `tests/structure/registration-participation.test.ts` scanning the seven bound modules; allowlist in `tests/fixtures/providers/conformance/parity/identity-scan-allowlist.json` · **Tags**: @structure @participation @scan @mutation

**Given** the bound set — `flows.ts`, `coverage.ts`, `artifact.ts`, `harness.ts`, `parity.ts`, `tracker-error-taxonomy.ts`, the stateful double module — **When** scanned for adapter identity literals (`"github"`, `"gitlab"`, `"jira"` and any provider-shaped string), **Then** zero hits occur in those modules, and the allowlist declares exactly the enumerated permits: the registration list (`adapters.ts`), the matrix column keys, provider fixtures under `tests/fixtures/`, the provider-tagged addressing types and derived read-failure union (`types.ts`), the addressing decode (`mock-tenant.ts`), and **one** pinned engine exception in `runner.ts` with exactly five provider comparisons recorded by construct.
**Pass criterion**: the allowlist is compared as an **exact** collection of `(file, construct)` entries with a count equality, so growth fails a named assertion; the runner exception is asserted at exactly five comparison sites, so a sixth comparison fails naming the file and construct. Mutations: plant a provider literal in each of the seven bound modules (7 parameterized mutations) and add a sixth `addressing.provider === …` comparison to the runner → each fails naming file and construct. A wildcard or prefix allowance in the fixture is rejected by an assertion that no allowlist entry contains `*`.

#### TC-REG-005 - An out-of-set operation, a lifecycle hook, and a runner branch are each refused by name

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-5, API-5, DM-6, NFR-8
**Target Layer / Location**: `tests/structure/registration-participation.test.ts`; `tests/types/conformance-participation.type-test.ts`; `tests/structure/port-contract-inventory.test.ts` (read-only control) · **Tags**: @structure @participation @negative @types

**Given** a candidate adapter that would need more than the five items, **When** each requirement is presented, **Then** (i) a registration declaring a supported operation outside `ADAPTER_OPERATIONS` is refused by the structural coverage gate naming provider and operation; (ii) a registration carrying a lifecycle phase hook is refused at the type level (`@ts-expect-error` under `pnpm typecheck`) and at the value level by the exact key-set assertion on the registration object; (iii) a per-adapter runner branch is refused by the identity scan (`TC-REG-004`) and by an explicit assertion that the only provider conditionals in `runner.ts` are the five pinned addressing comparisons.
**Pass criterion**: three independent refusals, each naming the unsupported requirement. The case also asserts the closed set and lifecycle contract are unchanged (nine operations in order; port-contract inventory green), which is the "remains unchanged" half. Mutation: add a tenth operation to the candidate contract → the case fails naming the operation.

#### TC-REG-006 - Dropping any one of the five supplied items makes the control run fail by name

**Scenario Type**: Negative · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-4, AC-F4-2, NFR-10
**Target Layer / Location**: `tests/conformance/control-registration.test.ts` · **Tags**: @conformance @participation @mutation @control

**Given** the control adapter from `TC-REG-002`, **When** each supplied item is removed in turn, **Then** the run or the gate fails naming the missing item: (a) no contract → the registration binding fails naming the provider; (b) no registration → the matrix's column-registration check fails naming the column; (c) no column → the cell-set check fails naming the provider and operation; (d) no tenant → the run fails naming the provider's missing tenant (no silent `not-configured`); (e) no trap catalog → family accounting fails naming adapter and family.
**Pass criterion**: each of the five removals produces a **distinct** named failure (asserted by clause/name, not merely by "an error"), which is what proves the control exercises the seam rather than passing beside it. Mutation: make the control's column optional in the gate → (c) stops failing → the case fails, proving the case, not the gate, is load-bearing.

#### TC-GATE-001 - The gate is discovered by the existing aggregate test path in the existing `ts-test` job

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-5, AC-F5-1, NFR-6
**Target Layer / Location**: `tests/checks/parity-gate-wiring.test.ts` (new) · **Tags**: @checks @ci @wiring

**Given** the repository's test wiring, **When** inspected, **Then** (i) `.github/workflows/ci.yml`'s `ts-test` job runs exactly `pnpm test` with no path filter or extra flag, and `package.json`'s `test` script is exactly `bun test`; (ii) `bunfig.toml`'s discovery root is `.` and no `pathIgnorePatterns` entry matches any new suite path, asserted by evaluating each new suite's relative path against the ignore patterns; (iii) the gate actually ran over the production matrix in this run — the case asserts the gate's verdict over `PARITY_MATRIX` is `[]` and that the matrix object it received is the exported production value (identity comparison), and the double-backed suite asserts a non-zero executed-step count.
**Pass criterion**: the chain is mechanical end to end (workflow step → script → discovery → executed assertion), so "it runs in the existing job" is not a claim but a re-derivable fact. Mutations: change the `ts-test` run step to `bun test tests/conformance` (a filter) → fails naming job and step; move a suite under `tmp/` → the ignore-pattern assertion fails naming the file; make the gate return `[]` without being called → the identity/spy assertion fails.

#### TC-GATE-002 - Workflow file set, job set, and triggers are pinned, and the two delivered suites are unweakened

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-5, AC-F5-1, NFR-6
**Target Layer / Location**: `tests/structure/ci-topology-pin.test.ts` (new); pin data in `tests/fixtures/pins/workflow-topology.json`; `tests/checks/ci-checks.test.ts` and `tests/checks/conformance-workflow.test.ts` as read-only controls · **Tags**: @structure @ci @pin @mutation

**Given** `.github/workflows/`, **When** inspected, **Then** (i) the workflow file set equals the pinned five names exactly; (ii) per file, the job id set equals the pinned set **exactly** (equality, not presence); (iii) per file, the `on:` trigger keys and their values equal the pinned set (weekly cron plus dispatch-only for `conformance-live.yml`; the delivered breakpoint/push sets for `ci.yml`); (iv) `ci-topology.validate(ROOT)` returns `[]` and `conformance-workflow.validateWorkflowRoot(ROOT)` returns `[]`; and (v) the **check-name inventory** of `tests/checks/conformance-workflow.test.ts` and `tests/checks/ci-checks.test.ts` equals the pinned list, so a weakened or deleted workflow assertion fails by name without pinning formatting.
**Pass criterion**: (ii) is the control the delivered topology check lacks (GAP-TP-3): adding a job to `ci.yml` currently passes `ci-topology.validate`, and this case must fail naming file and job. Mutations: add a `purge-cache` job to `ci.yml` → fails naming the file and the job; add a sixth workflow file → fails naming it; add a `push:` trigger to `conformance-live.yml` → the workflow contract test fails naming the trigger block; delete one check from `conformance-workflow.test.ts` → the inventory comparison fails naming the missing check.

#### TC-GATE-003 - Diagnostics name provider, operation, clause and reference, and stay bounded and secret-free

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-5, AC-F5-2, NFR-11, NFR-9
**Target Layer / Location**: `tests/conformance/parity-gate.test.ts` and `tests/checks/parity-gate-wiring.test.ts` · **Tags**: @conformance @parity @diagnostics @secret

**Given** a set of induced violations spanning every clause, **When** reported, **Then** each violation carries non-empty `provider`, `operation`, `clause` (from the closed clause set), a `detail` of at most 1024 characters, scalar-only expected/received values (never an object, array, or `undefined`), and a `reference` that resolves to a committed fixture path or a register `differenceId`; and no violation, serialized verdict, or thrown error contains credential material.
**Pass criterion**: every asserted element is read from the violation object, and the reference is **resolved on disk** (a path that does not exist fails). Secret-freedom is asserted with the delivered canary `conformance-canary-credential-value` plus a planted provider-native marker, each with a **paired positive** proving the detection works (a deliberately-crafted diagnostics object containing the canary must be detected). Mutations: emit a 1025-character detail → the bound fails naming the clause; emit an array as `received` → the scalar assertion fails; embed the canary → the secret assertion fails.

#### TC-GATE-004 - Consecutive runs produce an identical, canonically ordered violation list

**Scenario Type**: Contract · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: F-5, AC-F5-3, API-1, NFR-1, NFR-2
**Target Layer / Location**: `tests/conformance/parity-gate.test.ts` · **Tags**: @conformance @parity @determinism

**Given** a mutating input set that produces several violations, **When** the gate runs twice in a row, **Then** the two lists are deep-equal including order, the order equals the **declared canonical order** (clause rank, then provider, then operation), and shuffling the input's cell insertion order leaves the violation order unchanged.
**Pass criterion**: equality across two runs **plus** equality against the canonically expected sequence, so identical-but-arbitrary order fails; the purity half asserts the gate module is in the ambient scan scope and clean (no clock, environment, or randomness), so "same input, same result" is structural. Mutations: sort by insertion order → the shuffled-input case fails; iterate a `Set` keyed by object identity → a second run's order differs → fails.

#### TC-FLOOR-001 - The delivered conformance, harness and workflow suites stay green and unweakened

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: NFR-6, §24.3(4)(6)
**Target Layer / Location**: read-only controls: `tests/conformance/{mock-conformance,artifact,broken-adapter-control,github-transport-parity,harness-classification,harness-liveness}.test.ts`, `tests/conformance/live/live-entrypoint.test.ts`, `tests/structure/conformance-coverage.test.ts`, `tests/checks/conformance-workflow.test.ts` · **Tags**: @regression @conformance

**Given** the delivered suites, **When** the change lands, **Then** all of them pass, the flow/step/skip-kind census is unchanged (3 flows, 14 steps, three skip kinds), the live tier's read-only set is unchanged, and the **check-name inventory** of each delivered conformance suite is unchanged — no test removed, renamed, or reduced.
**Pass criterion**: green plus an inventory equality, because "the suite passes" is worth nothing if the assertion that mattered was deleted. Mutation: delete the `TC-CONF-011` runtime-coverage case → the inventory comparison fails naming the missing check.

#### TC-FLOOR-002 - No adapter's capability posture or behaviour changed

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: §24.3(1), pm-notes binding expectation
**Target Layer / Location**: `tests/behaviour/providers/provider-capabilities.test.ts` and the provider suites (read-only controls); `tests/fixtures/ports/capabilities.ts` (read-only) · **Tags**: @regression @provider @capability

**Given** the three shipped declarations, **When** compared with the delivered postures, **Then** GitHub supports all nine with zero gaps; GitLab supports `read-delivery-request` and `read-pipeline-run` and declares the other seven `adapter-not-implemented`; Jira supports `read-work-item`, `write-work-item`, `transition-work-item` and declares `write-comment` `adapter-not-implemented` plus `read-delivery-request`, `write-delivery-request`, `read-pipeline-run`, `resolve-delivery-thread`, `merge-delivery-request` `provider-unsupported`; and every provider behaviour suite is green with no changed expected value.
**Pass criterion**: **set and reason equality per adapter**, not a count, and zero diffs in the expected-posture fixture. This is the case that makes the "no adapter completion" expectation mechanical: a delivery that "fixes" an intersection by implementing an operation fails here naming the operation and reason. Mutation: change one Jira gap reason → fails naming it; add GitLab `write-comment` support → fails naming the operation.

#### TC-FLOOR-003 - No closed operation, port, capability flag, carrier kind, error row, domain kind, projection or exit code moved

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: NFR-8, §24.3(2)(3)
**Target Layer / Location**: `tests/structure/port-contract-inventory.test.ts`, `tests/checks/error-table-sync.test.ts`, `tests/checks/exit-code-literals.test.ts`, `tests/structure/provider-surface.test.ts` (all read-only controls) · **Tags**: @regression @contract @invariant

**Given** the repository after the change, **When** the contract surfaces are compared, **Then** `ADAPTER_OPERATIONS` is exactly the nine delivered ids in the delivered order; the port-contract inventory is unchanged; `ERROR_TABLE`'s row count and code set are unchanged with zero `tracker.*` rows; `DOMAIN_KINDS` is unchanged; the projection-class and exit-code maps are unchanged; the carrier-kind vocabulary is unchanged; and the `DeliveryThread`/`DeliveryRequest` field sets are unchanged.
**Pass criterion**: every assertion is an exact collection or count equality against committed fixtures, so an addition fails by name. Mutation: add a `tracker.payload.invalid` row to the error table → `error-table-sync` fails naming the code; add a tenth operation → the inventory fails naming it; add an exit class → `exit-code-literals` fails naming it.

#### TC-FLOOR-004 - The pinned inventory, export and boundary surfaces are updated exactly and not vacuously

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: NFR-7, NFR-8
**Target Layer / Location**: `tests/structure/content-inventory.test.ts`; `tests/structure/inventory.json`; `EXECUTABLE_ALLOWANCES`; `tests/checks/exports-parity.test.ts`; `tests/boundaries/boundaries.test.ts` (all read-only controls after the exact update) · **Tags**: @regression @structure @pins

**Given** the new modules, **When** the pinned surfaces are inspected, **Then** the testkit inventory list gains **exactly** the new module paths and no other entry changes; `EXECUTABLE_ALLOWANCES` gains exactly the new modules with the exact exported executable names and contains no wildcard; the file-set equality, executable-discipline, exports-discipline, exports-parity, `testkit-exclusion`, `ambient-globals`, and `runtime-apis-confinement` checks are green.
**Pass criterion**: both-direction equality on the inventory and an exact allowance list per new file, so "update the pin until green" fails: an unlisted new file fails naming it, and an allowance listing a name the file does not export fails naming the symbol. Mutation: add an export to a new module without updating its allowance → fails naming the symbol; add an inventory entry for a file that does not exist → fails naming it; add `*` to an allowance → fails the no-wildcard assertion.

#### TC-FLOOR-005 - Fixture hygiene and the secret-read boundary are unchanged

**Scenario Type**: Regression · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Automated
**Related IDs**: NFR-9, §24.3(9)
**Target Layer / Location**: `tests/checks/fixture-sanitization.test.ts`, `tests/checks/fixture-privacy.test.ts`, `tests/checks/secret-read-boundary.test.ts` (read-only controls); `scripts/checks/secret-read-boundary.ts` · **Tags**: @checks @fixtures @secret

**Given** every new and extended fixture, **When** the audit runs, **Then** each new JSON fixture carries a provenance marker of the form `hand-authored-synthetic YYYY-MM-DD`, hosts are example-only, no credential material, bearer header, PEM key, provider token shape, email, avatar URL, or absolute filesystem path appears, the planted-secret canary is still detected, and the secret-read allowlist has the delivered entry count with **zero** new entries.
**Pass criterion**: the audit's own findings list is empty for the new files **and** the planted-secret canary is still caught (paired positive); the secret-read allowlist is compared as an exact count and entry list. Mutation: embed a token-shaped value in a new tenant fixture → the sanitization audit fails naming file and line; add an allowlist entry → the boundary check fails naming the entry.

#### TC-FLOOR-006 - The aggregate gate is green

**Scenario Type**: Quality gate · **Impact Level**: Critical · **Priority**: High · **Automation Level**: Semi-automated
**Related IDs**: NFR-8
**Target Layer / Location**: repository root · **Tags**: @gate @quality

**Given** the completed change, **When** `TMPDIR=$PWD/tmp/tmpdir pnpm check` runs, **Then** it exits 0 through lint → format → typecheck → test → boundaries → memory → prompt/help/exports parity, with the new suites included in the `test` stage.
**Pass criterion**: exit 0 and the recorded command in §10; a narrow-suite pass never substitutes for this gate. Recorded additionally as a pm-notes `notes:` entry so the DoD check can cite it.

## 6. Environments and Test Data

- **Execution environment**: local dev / CI, fully offline. No network, no live credential, no real child process, no live provider. The mock tier's two guards are the enforcement, and `TC-DOUBLE-004` asserts their counters rather than the absence of an error.
- **Runner and shell**: `bash`/`zsh` from the repository root; `bun` pinned by `.bun-version`; `pnpm` pinned by `packageManager`. Every gate command uses a repository-local temp root via `TMPDIR=$PWD/tmp/tmpdir` (`tmp/` is git-ignored), and `bunfig.toml` excludes `tmp/**` from discovery — which is exactly why `TC-GATE-001` asserts the new suites are *not* under an ignored path.
- **Clock and identifiers**: the injected constant `2026-10-31T00:00:00Z` (matching the delivered conformance suites) and an injected `runId`; no real UUIDs, no `Date.now()`, no `Math.random()` anywhere in the asserted path. `TC-DOUBLE-002` compares canonicalized state, so ordering and identity come from declared data only.
- **Credentials**: the non-secret canary `conformance-canary-credential-value` (delivered precedent) plus a token-shaped canary constructed at runtime in a temp tree for the redaction cases. Canaries are non-secret and must not match the sanitization scanner's token/PII shapes at rest; the audit scans `tests/fixtures/providers/**`.
- **Fixtures**: hand-authored synthetic JSON under `tests/fixtures/providers/**` with the top-level provenance marker `"provenance": "hand-authored-synthetic 2026-11-18"`; example-only hosts; declared placeholders only; no email, avatar URL, private repository reference, bearer header, PEM key, or provider token shape; no absolute filesystem path.
- **Malformed declarations are TS case literals, not committed invalid JSON**: the eleven parity mutations live in `tests/fixtures/providers/conformance/parity/mutations.ts` and the four double malformations in `tests/fixtures/providers/conformance/stateful/invalid-effects.ts`. They are typed literal builders over the production shapes so a mutation cannot silently stop being a mutation when a type changes (a compile error, not a passing no-op), and they never enter the sanitization scan's JSON tree.
- **Fixture-decided surfaces** (spec §24.4): the per-provider stimulus payload shape; which supported operation each family exercises per adapter; the effect operand names and values per tenant; the double-backed response projections; the exact violation wording beyond its named elements; the serialized form of declared state. Each is decided in exactly one fixture or declared table, referenced from the accounting or the register, and never re-stated in an assertion.
- **Isolation**: mutation controls copy what they need into `mkdtemp` and clean up; no case mutates a committed file; no module-level mutable state; the guards are installed per suite and asserted after the run; the control adapter is constructed per test and never registered globally.

## 7. Automation Plan and Implementation Mapping

### 7.1 Suite Mapping

| Area | Test file(s) | Status | Cases |
|---|---|---|---|
| Parity gate (declared data + pure engine) | `tests/conformance/parity-gate.test.ts` (new) over `packages/testkit/src/conformance/parity.ts` (new) | New | TC-PARITY-001, TC-PARITY-002, TC-PARITY-003, TC-PARITY-004, TC-PARITY-005, TC-PARITY-006, TC-PARITY-007, TC-PARITY-008, TC-GATE-003, TC-GATE-004 |
| Parity mutation controls | `tests/conformance/parity-gate.test.ts`; inputs from `tests/fixtures/providers/conformance/parity/mutations.ts` (new) | New | TC-PMUT-001, TC-PMUT-002, TC-PMUT-003, TC-PMUT-004, TC-PMUT-005, TC-PMUT-006, TC-PMUT-007, TC-PMUT-008, TC-PMUT-009, TC-PMUT-010, TC-PMUT-011 |
| Artifact invariance | `tests/conformance/artifact.test.ts` (extend the key-set and bounds cases) | Existing – Update | TC-ART-001, TC-ART-002 |
| Tracker taxonomy | `tests/conformance/tracker-taxonomy.test.ts` (new) over `packages/testkit/src/conformance/tracker-error-taxonomy.ts` (new) | New | TC-TAX-001, TC-TAX-003, TC-TAX-004, TC-TAX-005, TC-TAX-006, TC-TAX-007, TC-TAX-008, TC-TAX-009, TC-TAX-010 |
| `tracker.` literal scan | `tests/checks/tracker-literal-scan.test.ts` (new) | New | TC-TAX-002 |
| Family accounting and wiring | `tests/structure/conformance-family-accounting.test.ts` (new) over `tests/fixtures/providers/conformance/families/accounting.json` (new) | New | TC-TAX-011, TC-TAX-012 |
| Family replay classification | `tests/conformance/family-classification.test.ts` (new) | New | TC-TAX-013 |
| Stateful double | `tests/conformance/stateful-double.test.ts` (new) over `packages/testkit/src/conformance/stateful-double.ts` (new); census golden in `tests/structure/conformance-coverage.test.ts` | New + Existing – Update | TC-DOUBLE-001, TC-DOUBLE-002, TC-DOUBLE-003, TC-DOUBLE-004, TC-DOUBLE-005, TC-DOUBLE-006, TC-DOUBLE-007 |
| Double malformed declarations | `tests/conformance/stateful-double.test.ts`; inputs from `tests/fixtures/providers/conformance/stateful/invalid-effects.ts` (new) | New | TC-DMUT-001, TC-DMUT-002, TC-DMUT-003, TC-DMUT-004 |
| Participation contract | `tests/structure/registration-participation.test.ts` (new); `tests/types/conformance-participation.type-test.ts` (new) | New | TC-REG-001, TC-REG-004, TC-REG-005 |
| Synthetic control registration | `tests/conformance/control-registration.test.ts` (new) | New | TC-REG-002, TC-REG-006 |
| Shipped registry invariant | `tests/structure/conformance-coverage.test.ts` (extend `TC-CONF-002`/`TC-CONF-003` with the control-absence assertion only) | Existing – Update | TC-REG-003 |
| Gate wiring in CI | `tests/checks/parity-gate-wiring.test.ts` (new) | New | TC-GATE-001 |
| Workflow invariance | `tests/structure/ci-topology-pin.test.ts` (new) over `tests/fixtures/pins/workflow-topology.json` (new) | New | TC-GATE-002 |
| Regression floor | `tests/conformance/*`, `tests/structure/*`, `tests/checks/*`, `tests/behaviour/providers/*`, `tests/boundaries/*` (all read-only controls) | Existing – No Change (must stay green) | TC-FLOOR-001, TC-FLOOR-002, TC-FLOOR-003, TC-FLOOR-004, TC-FLOOR-005 |
| Aggregate gate | repository root | Quality gate | TC-FLOOR-006 |

### 7.2 Fixtures to Author

All new JSON fixtures are sanitized, hand-authored synthetic documents with the provenance marker `"provenance": "hand-authored-synthetic 2026-11-18"`; every fixture reference in a register entry, trap-catalog entry, or accounting cell must resolve (asserted by `TC-PARITY-004`, `TC-TAX-012`).

| Path | Purpose | Cases |
|---|---|---|
| `packages/testkit/src/conformance/parity.ts` (module, not a fixture) | Declared matrix + declared register + the pure gate and the closed cell/class constants. Runtime-neutral; no provider literal (identity lives in the column keys, which is an enumerated permit). | TC-PARITY-001..008, TC-PMUT-001..011 |
| `packages/testkit/src/conformance/tracker-error-taxonomy.ts` (module) | The four-class table, the six-family vocabulary with declared outcomes, and the total decision function. Provider-name-free. | TC-TAX-001, TC-TAX-003..010, TC-TAX-013 |
| `packages/testkit/src/conformance/stateful-double.ts` (module) | `createStatefulTenantTransport({ tenant, initialState })`: declared state, matched-route effects from the five-effect vocabulary, declared identity and ordering, fail-closed refusals. Runtime-neutral. | TC-DOUBLE-001..007, TC-DMUT-001..004 |
| `tests/fixtures/providers/conformance/parity/evidence/{differenceId}.json` | One evidence document per recorded difference, reproducing the class's named dimension (plus one reference-equal document used only by the falsification mutation). | TC-PARITY-006, TC-PARITY-008 |
| `tests/fixtures/providers/conformance/parity/adjudication.json` | The five-intersection adjudication record: provider, operation, chosen posture, the four dimension observations, evidence/adjudication reference. Authored **during delivery** from the evidence, so it records whichever outcome is true. | TC-PARITY-007, TC-PARITY-008 |
| `tests/fixtures/providers/conformance/parity/mutations.ts` | The eleven parity mutations (missing/duplicate/extra cell, out-of-set value, out-of-set class, contradiction, unregistered column, unregistered difference, orphan entry, duplicate entry, non-uniform reference) plus dimension-divergence and falsified-evidence builders. Typed builders over the production shapes. | TC-PMUT-001..011, TC-PARITY-005, TC-PARITY-006 |
| `tests/fixtures/providers/conformance/families/accounting.json` | Per adapter × 6 families: exactly one posture, the family's operation, the catalog entry names, the gap reason or `registerId`. Kept under `tests/fixtures` (a permitted identity home) so the taxonomy table stays provider-free. | TC-TAX-011, TC-TAX-012, TC-TAX-013 |
| `tests/fixtures/providers/{provider}/families/{family}.json` | One committed stimulus per covered family per adapter, replayed through the production client. Authored only where no existing provider fixture already produces the stimulus; where one does, the accounting names that catalog entry and no new fixture is added (GAP-TP-8). | TC-TAX-003..008, TC-TAX-013 |
| `tests/fixtures/providers/traps/{provider}.traps.json` (extend) | Appended four-field entries referencing the new family fixtures. Delivered trap names and `fixtureReference`s are frozen; minima and the four-field shape are unchanged; no entry is migrated or retired. | TC-TAX-012, TC-TAX-013, TC-FLOOR-001 |
| `tests/fixtures/providers/conformance/stateful/{provider}/tenant.json` | Stateful tenants: declared initial state plus per-route declared effects. Separate documents from the committed stateless tenants, which must stay byte-identical. | TC-DOUBLE-001..007 |
| `tests/fixtures/providers/conformance/stateful/{provider}/expected-state.json` | The canonicalized sorted-key state golden, so a consistent-but-wrong double fails. | TC-DOUBLE-002 |
| `tests/fixtures/providers/conformance/stateful/invalid-effects.ts` | The four malformed declarations of `AC-F3-7` as typed case literals. | TC-DMUT-001..004 |
| `tests/fixtures/providers/conformance/control/tenant.json`, `.../control/traps.json`, `.../control/column.ts` | The synthetic control adapter's tenant fixture set, trap catalog, and matrix column. Kept in the control's own namespace so the three-provider catalog scan and its minima are untouched. | TC-REG-002, TC-REG-006 |
| `tests/fixtures/providers/conformance/parity/identity-scan-allowlist.json` | The exact `(file, construct)` allowlist for `AC-F4-4`, including the pinned `runner.ts` exception recorded as five provider comparisons. | TC-REG-004, TC-REG-005 |
| `tests/fixtures/pins/workflow-topology.json` | The pinned workflow file names, per-file job id sets, per-file trigger sets, and the pinned check-name inventory of the two delivered workflow suites. | TC-GATE-002 |

### 7.3 Fixture Sets Extended vs Authored

- **Authored**: the parity/adjudication/evidence/mutation data, the family accounting and family stimuli, the stateful tenants plus their state goldens and invalid-effect cases, the control adapter's namespace, the identity-scan allowlist, and the workflow pin.
- **Extended (appended only)**: `tests/fixtures/providers/traps/{github,gitlab,jira}.traps.json` — entries appended with the four-field shape; delivered names, `fixtureReference`s, minima, and outcomes frozen; **no** amendment to any delivered entry in this change (unlike GH-338's single declared amendment). `tests/structure/inventory.json` (`testkit` list) and `EXECUTABLE_ALLOWANCES` — exactly the new modules and their exact exports.
- **Unchanged by obligation**: the three committed stateless tenants `tests/fixtures/providers/conformance/{github,gitlab,jira}/tenant.json`; `tests/fixtures/ports/capabilities.ts`; `tests/fixtures/ports/v1-contract-inventory.json`; `tests/fixtures/providers/sanitization/placeholders.json`; every delivered GitHub/GitLab/Jira provider fixture; `tests/checks/conformance-workflow.test.ts`; `scripts/checks/ci-topology.ts`. A change to any of these outside an explicitly declared additive expectation is a review finding, and `TC-FLOOR-001`/`TC-FLOOR-002`/`TC-DOUBLE-005` fail on the ones that matter.
- **Sanitization obligations for every new fixture**: provenance marker, declared placeholders only, example/reserved hosts only, no bearer header/PEM key/token shape/email/avatar URL/private repository reference, no absolute path. Enforced by `tests/checks/fixture-sanitization.test.ts` and `fixture-privacy.test.ts`, run in the same gate pass (`TC-FLOOR-005`).

### 7.4 Gate Battery and Failure Triaging

Every command runs from the repository root with the temp root inside the tree.

| # | Command | Expected signal on success | Failing signal |
|---|---|---|---|
| G1 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/conformance` | exit 0; parity gate, both arms, the eleven mutations, taxonomy classification, family replay, the double and its four malformed cases, artifact invariance | a violation naming provider/operation/clause, or a class disagreement naming adapter/family/fixture |
| G2 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/structure` | exit 0; flow/step census golden, family accounting and wiring, participation record, identity allowlist, registry pins, inventory/export pins, workflow pins | a named set-equality mismatch (`missing cell`, `unaccounted family`, `literal in a named file`, `job set`) |
| G3 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/checks` | exit 0; `tracker.` scan, gate wiring, diagnostics bounds, fixture sanitization/privacy, error-table sync, secret-read boundary, delivered workflow contract | a file+construct hit, a bound/secret finding, or the offending field |
| G4 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/providers` | exit 0; capability postures unchanged, family stimuli replayed through production clients, delivered trap suites green | a named trap/case failure with its fixture reference |
| G5 | `TMPDIR=$PWD/tmp/tmpdir bun test tests/boundaries` | exit 0; depcruise rules, `runtime-apis-confinement`, fixture-coverage meta-check | the rule name and the violating import/file |
| G6 | `TMPDIR=$PWD/tmp/tmpdir pnpm typecheck` | exit 0; workspace typecheck plus the `tests/types` probes (participation shape, cell/effect vocabulary) | a type error naming the probe file and the missing/excess/unsatisfied member |
| G7 | `TMPDIR=$PWD/tmp/tmpdir bun run scripts/checks/ci-topology.ts` | `OK ci-topology: …`; requires `origin/main-tools` to be fetched | a named job/trigger/wiring finding, or `origin/main-tools is unavailable` |
| G8 | `TMPDIR=$PWD/tmp/tmpdir bash scripts/.tests/test-doc-distribution.sh` | exit 0; every changed distributable doc declares `ados_distribution` correctly | the offending file and marker |
| G9 | `TMPDIR=$PWD/tmp/tmpdir git diff --check` | no output, exit 0 | whitespace/conflict-marker finding |
| G10 | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | exit 0 for lint → format → typecheck → test → boundaries → memory → prompt/help/exports parity | the first failing stage with its output |

G1–G9 are the narrow loop; **G10 is the binding completion gate** and is recorded in §10 plus a pm-notes `notes:` entry. G8 applies because phase 7 changes docs under `doc/spec/features/**` and `doc/overview/**`. No command requires network access or a live credential; a command that attempts either fails through the guards rather than hanging.

**Failure-triaging rule** (applies to every row):

1. **Read the named element first.** A violation names provider, operation, and clause; a scan names file and construct; a pin names the extra/missing member. Triage starts from that name, not from the failing file's stack trace.
2. **A failing mutation control is a control defect, not a declaration defect.** If a mutation stops producing its named failure, the control has gone vacuous (or the gate lost a rule); it is never "fixed" by deleting the mutation or relaxing its expected clause.
3. **Never widen a scope or an allowlist to go green.** Growing the `tracker.` scan scope, the identity allowlist, the artifact key set, the workflow job set, or an executable allowance is a scope decision that must be recorded, not a repair. `TC-TAX-002`, `TC-REG-004`, `TC-ART-001`, `TC-GATE-002`, and `TC-FLOOR-004` each pin those collections exactly and fail on growth by name.
4. **Never regenerate a golden to pass.** The state golden, the stateless-projection golden, the flow/step census, and the workflow pins are compared exactly; a diff means a behaviour or topology change, which must be justified by the AC that permits it (and for adapters, none does — `TC-FLOOR-002`).
5. **`origin/main-tools` missing is an ERROR, never a skip.** Fetch the base and re-run G7; a SKIP verdict is not a pass and is not recorded as one.
6. **A green suite is not evidence a control ran.** If a new suite is not discovered, `TC-GATE-001` fails naming the path; if a control adapter passes without exercising the seam, `TC-REG-006` fails naming the missing item.
7. **Escalate after two narrow loops.** A failure that survives a narrow run plus one targeted fix is reported with the command, exit code, and the named element; no third blind attempt.

### 7.5 Non-Vacuity and Mutation Control Register

Every gate rule and every invariant in §3 has at least one control here. Each row states the exact failure the mutation must produce; a mutation that produces a different failure, or none, is a blocking finding.

| # | Mutation | Case | Required failure (named elements) |
|---|---|---|---|
| M1 | Remove one matrix cell | TC-PMUT-001 | provider, operation, clause `cell-set` |
| M2 | Duplicate one `(provider, operation)` cell | TC-PMUT-002 | provider, operation, clause `cell-set`, duplicate count |
| M3 | Add a tenth row key | TC-PMUT-003 | row key, clause `cell-set`, count 28 vs 27 |
| M4 | Replace one cell with an unknown kind | TC-PMUT-004 | provider, operation, clause `cell-vocabulary`, received kind |
| M5 | Set an unknown `differenceClass` | TC-PMUT-005 | `differenceId`, adapter, operation, clause `difference-class` |
| M6 | `gap` cell on a supported operation, and `same-as-reference` on a gapped one | TC-PMUT-006 | provider, operation, clause `declaration-agreement`, both directions |
| M7 | Add an `azure` column / drop a registered column | TC-PMUT-007 | provider, clause `column-registration`, both directions |
| M8 | `declared-difference` with no entry | TC-PMUT-008 | provider, operation, clause `register-bijection`, dangling `registerId` |
| M9 | Register entry naming no cell | TC-PMUT-009 | `differenceId`, adapter, operation, clause `register-bijection` |
| M10 | Two entries for one pair | TC-PMUT-010 | both ids, adapter, operation, clause `register-bijection` |
| M11 | Non-uniform reference column (difference or gap) | TC-PMUT-011 | reference provider, operation, clause `reference-purity` |
| M12 | Inject a one-dimension divergence on a `same-as-reference` cell (4 mutations) | TC-PARITY-005 | provider, operation, the differing dimension |
| M13 | Substitute reference-equal evidence for one entry; and a non-resolving evidence pointer | TC-PARITY-006 | `differenceId`, adapter, operation, clause `evidence-reproduction` |
| M14 | Add `parity` to the artifact top level | TC-ART-001 | the extra key `parity` |
| M15 | Inject a class id / cell kind / `differenceId` into a failure detail | TC-ART-002 | field path and the literal (with the paired non-empty scan positive) |
| M16 | Plant `"tracker.x"` in `packages/adapters/src` and in a testkit module; and verify a core-file `tracker.*` does **not** fail | TC-TAX-002 | file + construct for the two hits; zero hits for the out-of-scope core file |
| M17 | Make the classifier read `detail` prose (prose says "unauthorized" with status 500) | TC-TAX-003 | the stimulus and the flipped class |
| M18 | Make a write 404 resolve to `provider.not-found`; swap rules (2) and (3) | TC-TAX-009 | the stimulus, both candidate classes, the operation |
| M19 | Record a gapped operation as a failure; attach a family to the capability class | TC-TAX-010 | provider + operation; the class |
| M20 | Remove each of the 18 accounting cells (18 mutations); declare dual posture; declare `covered` on a gapped operation | TC-TAX-011 | adapter + family; `dual posture`; the contradiction |
| M21 | Rename a family id; reference a nonexistent entry; break a fixture pointer; add a fifth field | TC-TAX-012 | entry name, offending field |
| M22 | Change one declared family outcome; change a stimulus status so the class must move | TC-TAX-013 | adapter, family, fixture, expected class, received class |
| M23 | Introduce a clock-derived identity; change a baseline field; reorder the declared sequence | TC-DOUBLE-002 | the run comparison, the golden path, the entry index |
| M24 | Treat an unknown effect as a no-op; dispatch a transition before refusing | TC-DOUBLE-003, TC-TAX-007 | method, URL, effect; request count 1 vs 0 |
| M25 | Route one request through real `fetch` (with the guard armed) | TC-DOUBLE-004 | the guard's count and the URL |
| M26 | Infer an effect from `PATCH` on an effect-less route; add an effect to a delivered tenant | TC-DOUBLE-005, TC-DOUBLE-007 | the route and the state comparison |
| M27 | Add `import "node:fs"` and `Date.now()` to the double module | TC-DOUBLE-006 | file + construct / file + pattern |
| M28 | Add a sixth effect id; swap the append sequence order | TC-DOUBLE-007 | the id; the entry index |
| M29 | The four malformed declarations (out-of-vocabulary, two effects, unresolvable operands, no sequence) | TC-DMUT-001..004 | route index + effect; route index; the operand; the missing sequence |
| M30 | Add a sixth participation item; add a `lifecyclePhase` member | TC-REG-001 | the item id; the type probe's assignability error |
| M31 | Move the control into `CONFORMANCE_ADAPTERS`; add `azure`; add a declaration with no registration | TC-REG-002, TC-REG-003 | the provider; the declaration file + adapter |
| M32 | Plant one provider literal in each bound module (7); add a sixth runner comparison; widen the allowlist | TC-REG-004 | file + construct; count equality |
| M33 | Remove each of the five supplied control items (5 mutations) | TC-REG-006 | the missing item, its named clause, and a distinct failure per removal |
| M34 | Filter the `ts-test` run step; move a suite under `tmp/` | TC-GATE-001 | job + step; the file and the ignore pattern |
| M35 | Add a job to `ci.yml`; add a sixth workflow file; add a `push:` trigger to the live workflow; delete one pinned check | TC-GATE-002 | file + job; the file; the trigger block; the missing check name |
| M36 | Emit a 1025-character detail; emit an array as `received`; embed the canary | TC-GATE-003 | the clause; the scalar assertion; the secret finding |
| M37 | Sort violations by insertion order; iterate an identity-keyed `Set` | TC-GATE-004 | the shuffled-input order; the second-run order |
| M38 | Delete a delivered conformance check; change one adapter gap reason; add GitLab `write-comment` support | TC-FLOOR-001, TC-FLOOR-002 | the missing check name; the operation + reason; the operation |
| M39 | Add an error-table row; add a tenth operation; add an exit class | TC-FLOOR-003 | the code; the operation; the exit class |
| M40 | Add an unlisted module; list a nonexistent file; add `*` to an allowance | TC-FLOOR-004 | the file; the file; the wildcard assertion |

### 7.6 Plan Coordination — Phase/File Bindings the Delivery Plan Must Carry

This plan binds each case to a file and to a module the spec or a TDR names; it assumes no plan artifact. The following bindings must appear in `chg-GH-339-plan.yaml` so plan and test plan cannot diverge:

| Case(s) | Owning phase (by outcome, per spec §18) | Editable targets the phase must declare | Read-only controls |
|---|---|---|---|
| TC-TAX-001, TC-TAX-003..010 | Taxonomy + family vocabulary (first: they are inputs to fixture authoring) | `packages/testkit/src/conformance/tracker-error-taxonomy.ts`, `tests/conformance/tracker-taxonomy.test.ts` | delivered coverage gates, error table, projection/exit maps |
| TC-TAX-002 | Taxonomy | `tests/checks/tracker-literal-scan.test.ts` | the two source trees (scan-only) |
| TC-TAX-011..013 | Taxonomy + family vocabulary | `tests/structure/conformance-family-accounting.test.ts`, `tests/conformance/family-classification.test.ts`, `tests/fixtures/providers/conformance/families/accounting.json`, family stimulus fixtures, the appended catalog entries | `tests/structure/trap-catalog.test.ts` (reused, unedited), delivered trap fixtures |
| TC-PARITY-001..008, TC-PMUT-001..011 | Parity matrix and gate (second) | `packages/testkit/src/conformance/parity.ts`, `tests/conformance/parity-gate.test.ts`, `tests/fixtures/providers/conformance/parity/{evidence,adjudication.json,mutations.ts}` | delivered capability declarations (input only), `ADAPTER_OPERATIONS` |
| TC-ART-001, TC-ART-002 | Parity matrix and gate (artifact invariance half) | `tests/conformance/artifact.test.ts` | `packages/testkit/src/conformance/artifact.ts` (**must not change** — AC-F1-8) |
| TC-DOUBLE-001..007, TC-DMUT-001..004 | Double and its scenarios (third) | `packages/testkit/src/conformance/stateful-double.ts`, `tests/conformance/stateful-double.test.ts`, stateful tenants, state goldens, `invalid-effects.ts`, the census golden extension in `tests/structure/conformance-coverage.test.ts` | `mock-tenant.ts` (additive decode member only), the delivered stateless tenants (**byte-identical**) |
| TC-REG-001..006 | Participation contract + synthetic proof (fourth) | `tests/structure/registration-participation.test.ts`, `tests/conformance/control-registration.test.ts`, `tests/types/conformance-participation.type-test.ts`, the control fixture namespace, `tests/fixtures/providers/conformance/parity/identity-scan-allowlist.json`, the control-absence extension in `tests/structure/conformance-coverage.test.ts` | `adapters.ts`, `flows.ts`, `coverage.ts`, `runner.ts`, `artifact.ts` (**no edit for the control**) |
| TC-GATE-001, TC-GATE-002 | Participation contract + synthetic proof (wiring half) | `tests/checks/parity-gate-wiring.test.ts`, `tests/structure/ci-topology-pin.test.ts`, `tests/fixtures/pins/workflow-topology.json` | `.github/workflows/**`, `scripts/checks/ci-topology.ts`, `tests/checks/{ci-checks,conformance-workflow}.test.ts` (**unedited**) |
| TC-GATE-003, TC-GATE-004, TC-FLOOR-001..006 | Quality gates | — (control runs) | all delivered suites |

Two obligations the plan text must carry verbatim, because they are the difference between a proof and a slogan: (i) `TC-GATE-002` **adds** the job-set and file-set equality that `ci-topology.validate` does not perform (GAP-TP-3), so "no job added" is enforced rather than asserted; (ii) `TC-PARITY-008` runs both adjudication arms unconditionally, so the five intersections can be adjudicated either way during delivery without either mechanism disappearing (GAP-TP-1). Neither may be described in the plan as already covered by a delivered check.

## 8. Risks, Assumptions, and Open Questions

### 8.1 Risks

| ID | Risk to the test strategy | Impact | Mitigation (how the plan fails visibly) |
|---|---|---|---|
| RSK-TP-1 | The gate passes vacuously because it is never given a violation, or a rule has no failing control. | H | Every clause has a named mutation with its required failure (§7.5); `TC-PMUT-001..011` assert both the failure and the paired clean pass; a mutation that stops failing is a blocking finding (triage rule 2). |
| RSK-TP-2 | The difference register becomes a waiver: every divergence is "declared" and the gate goes quiet. | H | Closed six-class set; reference column cannot differ; every entry needs class + rationale + **resolving evidence that reproduces the class** + adjudication; `TC-PARITY-006` fails a reference-equal evidence document naming the entry. |
| RSK-TP-3 | The tracker taxonomy becomes a competing error system. | H | `TC-TAX-001` asserts one identity per class, zero `tracker.` in the error table / domain kinds / projections / exits, and no class id ever returned as a `code`; `TC-TAX-002` bounds the literals to one file in two trees. |
| RSK-TP-4 | The double becomes a second, buggy provider implementation whose tests pass because both sides agree. | M | Only declared data plus five closed effects (no provider branching); `TC-DOUBLE-002` compares against a **committed golden**, so a consistent-but-wrong double fails; `TC-DOUBLE-007` asserts declared identity/ordering and no inference. |
| RSK-TP-5 | The plug-in proof is vacuous — a control adapter that passes because nothing is checked. | M | `TC-REG-002` applies the *delivered* runner and coverage gates to the control; `TC-REG-006` removes each of the five items in turn and requires five **distinct** named failures. |
| RSK-TP-6 | Family coverage is declared but the fixtures do not exercise the family. | H | `TC-TAX-013` replays each covered stimulus through the production client and asserts the class; the replay count must equal the `covered` count; `TC-TAX-012` forbids orphan wiring in either direction. |
| RSK-TP-7 | The gate slows or destabilizes the existing test job. | L | In-process pure validation, no I/O, no spawn, bounded diagnostics; `TC-GATE-004` asserts determinism and canonical order; `TC-DOUBLE-004` asserts zero processes. |
| RSK-TP-8 | Scope creep into adapter completion to make an intersection `same-as-reference`. | H | `TC-FLOOR-002` pins every posture and reason per adapter; `TC-FLOOR-003` pins the operation set, error table, domain kinds, projections and exits; `TC-PARITY-008` never requires a verdict. |
| RSK-TP-9 | Pinned surfaces are "updated until green": the inventory gains a wildcard, the allowlist absorbs a new branch, the scan scope grows. | H | `TC-FLOOR-004` requires an exact allowance list per new file and forbids wildcards; `TC-REG-004` and `TC-TAX-002` assert their collections with count equality; triage rule 3. |
| RSK-TP-10 | A new fixture carries sensitive or provider-identifying material. | M | `TC-FLOOR-005` runs the delivered sanitization/privacy audits with a paired planted-secret positive; example-only hosts; provenance markers; zero new secret-read entries. |
| RSK-TP-11 | A recorded difference is stale because an adapter changed underneath it. | M | Evidence reproduction is a gate rule (`TC-PARITY-006`); a stale entry fails naming `differenceId`; the register self-cleans rather than accreting. |
| RSK-TP-12 | The two adjudication paths collapse into one — everything becomes `same-as-reference` (differences hidden) or everything becomes `declared-difference` (gaps licensed). | **H** | `TC-PARITY-008` runs the four `AC-F1-5` dimension mutations **and** the `AC-F1-6` falsified-evidence mutation on every run, independent of the record's contents; `TC-PARITY-004` requires evidence to resolve; `TC-PARITY-005` proves an observed divergence is never absorbed into a pass. |
| RSK-TP-13 | Determinism is asserted run-vs-run only, so a double that is consistently wrong passes. | M | `TC-DOUBLE-002` compares **both** runs against each other **and** against a committed canonicalized golden. |
| RSK-TP-14 | Stateless-tenant regression is masked by editing the committed tenants or their projections. | H | `TC-DOUBLE-005` compares against the delivered golden over the **unchanged** fixtures; §7.3 lists the tenants as unchanged-by-obligation; an edit is a review finding and fails the golden. |
| RSK-TP-15 | "No workflow change" is claimed while the delivered topology check cannot detect an added job or file. | H | `TC-GATE-002` adds exact file-set/job-set/trigger-set equality plus a pinned check-name inventory; the diff residue is recorded as review-verified (GAP-TP-3), not as a suite. |
| RSK-TP-16 | The family identifier drifts between the decision record, the spec table, the accounting keys and the fixtures. | M | One exported vocabulary constant is the single source; the accounting and fixtures are keyed off it; `TC-TAX-011` fails naming an unknown family; the spec/TDR spelling divergence is raised as OQ-TP-2 rather than silently normalized. |
| RSK-TP-17 | "No adapter behaviour changed" is asserted in the pm-notes but never checked. | H | `TC-FLOOR-002` turns it into set-and-reason equality per adapter with a mutation that flips one reason and one support flag. |

### 8.2 Assumptions

- `CONFORMANCE_ADAPTERS` remains the sole participant list and the matrix's column source; the matrix therefore cannot be authored against anything but shipped adapters, and the control adapter reaches the gate only through `RunConformanceInput.adapters` (TDR-0039 §3).
- The gate can consume a `ConformanceReport` as its observed-outcome input without changing the runner's report shape: step status, `stepId`, `operation`, `assertionFamily`, `skipKind`, `skipReason`, and the per-step projection are all already carried (spec §8.3 DM-1's four dimensions map onto them).
- The production client factories accept an injected `ConformanceTransport`, so a family stimulus and a stateful scenario are both replayable offline without a live provider — already true for the delivered mock tier.
- The decoded `MockTenant` can gain one optional additive member (the per-route declared effect) and an optional declared initial state without changing any existing projection; the stateless transport ignores the member, so delivered fixtures and their projections stay byte-identical (TDR-0038 §2/§7).
- The taxonomy's total decision function can be implemented over the delivered result union (`ProviderReadFailure` | success) without a new identity, because `code` plus `httpStatus` presence/value already discriminate the five outcomes (TDR-0037 §2).
- The identity scan can read TypeScript source as text plus AST in the style of the delivered `scripts/checks/*.ts` checks and `tests/conformance/support/testkit-source-scan.ts`; the five-comparison runner exception is countable by construct.
- `tests/types` is a working compile-time probe harness (`tsc -p tests/types/tsconfig.json` runs inside `pnpm typecheck`), so registration-shape and vocabulary refusals can be type-level.
- The `ts-test` job continues to run `pnpm test` (`bun test`) with no path filter, so a new suite under `tests/conformance`/`tests/structure`/`tests/checks` is discovered without any workflow or script change.
- `origin/main-tools` is fetchable in the quality-gate environment, because `ci-topology.ts` and its suite require it; a missing base is an ERROR (triage rule 5), never a skip.

### 8.3 Open Questions

No blocking question remains: the specification declares none, and TDR-0036..TDR-0039 settle the contract choices. The following are non-blocking but **must be resolved before delivery planning closes**, because each is a place where this plan deliberately refuses to invent a rule.

| ID | Question / finding | Blocking? | Owner | Resolution path |
|---|---|---|---|---|
| OQ-TP-1 | **AC-F2-2 and AC-F2-3 are unsatisfiable for GitLab and Jira as written.** Their failure envelope never carries `httpStatus` (`packages/adapters/src/gitlab/client.ts` — `providerPayloadFailure(\`GitLab returned HTTP ${response.status}\`)`; `packages/adapters/src/jira/client.ts` — same shape; only `packages/adapters/src/github/client.ts` passes the status), and DM-3/TDR-0037 §2 classify a status-less payload failure as `tracker.transport.failed`. So a 401/403 on GitLab or Jira is *not* `tracker.auth.rejected`, and it is indistinguishable from a genuine transport failure on the same adapter — while `AC-F2-2` has no "or a recorded `failure-classification` difference" clause, although `AC-F2-4`, `AC-F2-6`, DM-4, `AC-F2-10` and spec §8.5 all provide exactly that escape. Fixing it by changing the adapters contradicts NG-1 and §24.3(1). | **Yes — spec fix** | @spec-writer (with @pm) | Add the recorded-difference alternative to AC-F2-2 and to AC-F2-3's distinguishability clause (the same wording AC-F2-4/AC-F2-6 already use), so the AC reads "…or the adapter's family accounting records a `failure-classification` difference naming the deciding structured field". Until then `TC-TAX-003`/`TC-TAX-004` assert the declared-posture agreement and never a class the adapter cannot emit. |
| OQ-TP-2 | **The family identifier differs between the spec and its authority.** Spec DM-4 (and AC-F2-10) name the family `auth-shapes`; TDR-0037 §3 names it `auth-shape`. One literal must win, because the accounting keys, the fixture names, and the taxonomy table all key off it. | **Yes — naming reconciliation** | @spec-writer + @decision-advisor (TDR-0037 §3) | Pick one literal and correct the other, before the accounting fixture is authored. This plan binds the set through one exported constant so the change is one line; it asserts the six-member set and each family's class mapping rather than scattering the spelling. |
| OQ-TP-3 | Does the delivery's adjudication of the five intersections require an amendment to any delivered value? If an intersection turns out to need an adapter fix to be `same-as-reference`, that is adapter completion and out of scope. | No | delivery + review | `TC-PARITY-007`/`TC-PARITY-008` accept either outcome; `TC-FLOOR-002` fails an adapter delta; nothing is amended silently. |
| OQ-TP-4 | Which operation each family exercises per adapter, and the exact stimulus shape, are fixture-decided (§24.4). | No | delivery | Declared once in the accounting and the stimulus fixture; `TC-TAX-013` asserts only the class agreement, and `TC-TAX-011` asserts the operation is declared supported (or exactly gap-backed). A different choice updates data, not assertions. |
| OQ-TP-5 | Whether the five declared effects cover every delivered write member's observable landing (in particular the provider-supplied landing identity) is settled during delivery (§24.4). | No | delivery | `TC-DOUBLE-007` asserts the five effects; if one operation needs a sixth, it is a **recorded extension with its own fixture**, and `TC-DOUBLE-007`'s five-member set assertion fails until that extension is declared — which is the intended friction, not a gap. |
| OQ-TP-6 | The exact violation `detail` wording beyond the required named elements is implementation-decided. | No | delivery | `TC-GATE-003` asserts the required elements, the bound, scalar-only values, and a resolving reference; wording beyond that is free. |
| OQ-TP-7 | Whether a control-adapter trap catalog under `tests/fixtures/providers/conformance/control/` can supply the family accounting without tripping the three-provider catalog scan. | No | delivery | It is deliberately placed outside `tests/fixtures/providers/traps/` (whose loader validates every `*.traps.json` as a provider and applies minima), so the shipped scan is untouched; `TC-TAX-012` operates on the three shipped catalogs only, and the control's catalog is read by `TC-REG-002`. |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-18 | @test-plan-writer | Initial test plan for GH-339. 61 cases across nine groups covering all 34 acceptance criteria (`AC-F1-1..AC-F1-8`, `AC-F2-1..AC-F2-11`, `AC-F3-1..AC-F3-7`, `AC-F4-1..AC-F4-5`, `AC-F5-1..AC-F5-3`), the five in-process interfaces (API-1..API-5), the seven data-model elements (DM-1..DM-7), and NFR-1..NFR-11; traceability closed both directions with zero orphans. The eleven `AC-F1-7` mutations and the four `AC-F3-7` malformed declarations are one case each with the exact named failure they must produce; the two adjudication arms are separate cases with unconditional mutations so neither can be deleted; the five non-reference supported intersections are asserted for totality and consistency only (no verdict baked in); the workflow-invariance control is authored here because the delivered topology check is presence-only; and three spec-level findings are raised as OQ-TP-1..OQ-TP-3 (status-less GitLab/Jira failure envelopes versus AC-F2-2/AC-F2-3, the `auth-shapes`/`auth-shape` identifier divergence, and the review-verified residue of the zero-workflow-change claim). |

## 10. Test Execution Log

No case has been executed at authoring time: this file was produced in `test_planning` (phase 3), before delivery. Rows are populated during delivery and the quality gates with the exact command, exit code, and a one-line result summary; `G10` evidence is also recorded as a pm-notes `notes:` entry. Two rows are **review-verified** by construction and are marked as such rather than being given a fake suite.

| TC ID(s) | Run date | Command | Result | Notes |
|---|---|---|---|---|
| TC-PARITY-001..008, TC-PMUT-001..011, TC-GATE-003, TC-GATE-004 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/conformance/parity-gate.test.ts` | Not run | Pending delivery — both adjudication arms per intersection; the arm that ran is reported per test name |
| TC-TAX-001, TC-TAX-003..010 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/conformance/tracker-taxonomy.test.ts` | Not run | Pending delivery — blocked in part on OQ-TP-1 for the status-less-adapter arm |
| TC-TAX-002 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/checks/tracker-literal-scan.test.ts` | Not run | Pending delivery — scope and allowlist asserted exact; baseline must be empty |
| TC-TAX-011, TC-TAX-012 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/structure/conformance-family-accounting.test.ts` | Not run | Pending delivery — 18 accounting cells, bidirectional wiring |
| TC-TAX-013 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/conformance/family-classification.test.ts` | Not run | Pending delivery — replay count must equal `covered` count |
| TC-DOUBLE-001..007, TC-DMUT-001..004 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/conformance/stateful-double.test.ts` | Not run | Pending delivery — determinism compares runs **and** the committed golden |
| TC-REG-001, TC-REG-004, TC-REG-005 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/structure/registration-participation.test.ts` | Not run | Pending delivery — allowlist count equality; five pinned runner comparisons |
| TC-REG-002, TC-REG-006 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/conformance/control-registration.test.ts` | Not run | Pending delivery — five removal mutations must produce five distinct named failures |
| TC-REG-003 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/structure/conformance-coverage.test.ts` | Not run | Pending delivery — exact three-provider set; control absent |
| TC-GATE-001 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/checks/parity-gate-wiring.test.ts` | Not run | Pending delivery — workflow step → `pnpm test` → discovery chain |
| TC-GATE-002 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/structure/ci-topology-pin.test.ts` | Not run | Pending delivery — file/job/trigger equality plus the pinned check-name inventory |
| TC-ART-001, TC-ART-002 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/conformance/artifact.test.ts` | Not run | Pending delivery — exact eleven-key set; parity-absence scan with a positive |
| TC-DOUBLE-006, TC-FLOOR-004 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/boundaries` | Not run | Pending delivery — `runtime-apis-confinement`, ambient scan inclusion, inventory/allowance equality |
| TC-FLOOR-001, TC-FLOOR-003, TC-FLOOR-005 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/conformance tests/structure tests/checks tests/behaviour/providers` | Not run | Pending delivery — delivered suites green with unchanged check-name inventories |
| TC-FLOOR-002 | — | `TMPDIR=$PWD/tmp/tmpdir bun test tests/behaviour/providers` | Not run | Pending delivery — the no-adapter-change expectation, as set-and-reason equality |
| TC-REG-001, TC-REG-005, TC-PARITY-004 | — | `TMPDIR=$PWD/tmp/tmpdir pnpm typecheck` | Not run | Pending delivery — `tests/types` probes must still raise their expected errors |
| TC-GATE-002 (topology half) | — | `TMPDIR=$PWD/tmp/tmpdir bun run scripts/checks/ci-topology.ts` | Not run | Pending delivery — requires `origin/main-tools`; a missing base is an ERROR, never a skip |
| — (docs) | — | `TMPDIR=$PWD/tmp/tmpdir bash scripts/.tests/test-doc-distribution.sh` | Not run | Pending phase 7 — applies to the changed `doc/spec/**` and `doc/overview/**` pages |
| TC-FLOOR-006 (all) | — | `TMPDIR=$PWD/tmp/tmpdir pnpm check` | Not run | Binding completion gate; also recorded as a pm-notes `notes:` entry |
| TC-REG-002 (review half) | — | review of the change's touched files | Not run | **Review-verified** by construction (TDR-0039 §3): the control adapter adds no edit to lifecycle, port, flow-registry, coverage, runner, or artifact modules |
| TC-GATE-002 (diff half) | — | review of the change's touched files | Not run | **Review-verified** (GAP-TP-3, `.ai/rules/testing-strategy.md`): the change's diff contains no `.github/workflows/**` path |
