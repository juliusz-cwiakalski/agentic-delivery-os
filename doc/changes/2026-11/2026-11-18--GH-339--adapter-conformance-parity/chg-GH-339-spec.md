---
change:
  ref: GH-339
  type: feat
  status: Proposed
  slug: adapter-conformance-parity
  title: "M3-S5: Adapter conformance and parity suite (M3)"
  owners: ["engineering"]
  service: delivery-os adapter conformance (testkit) and provider adapters
  milestone: "M3: Harness and tracker integrations"
  labels: ["adapters", "conformance", "parity", "testkit", "m3-s5"]
  version_impact: none
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal:
      - core adapter contracts (closed operation set, capability declaration)
      - provider client seeds (GitHub, GitLab, Jira)
      - adapter conformance testkit
      - adapter reference behavior
      - trap catalogs and provider fixtures
      - fixture sanitization audit
      - TypeScript test job and the pinned CI topology
    external:
      - GitHub, GitLab, and Jira response shapes (fixture-only, no live calls)
---

# CHANGE SPECIFICATION

> **PURPOSE**: Turn cross-adapter parity from a claim into a declared, enforced property of the adapter conformance suite — one parity matrix with adjudicated differences, one tracker error taxonomy proven by per-adapter trap families, one deterministic simulated tracker double for offline write-then-read proof, and one registration-only plug-in proof — so switching trackers can never change the lifecycle contract without a gate failing.

## 1. SUMMARY

This change extends the delivered M0-S20 adapter conformance suite along the four dimensions the ticket names: it declares a cross-adapter parity matrix over the nine closed adapter operations with a reference adapter and a closed difference-class vocabulary, and adds a gate that fails on any capability or behavior difference that is not recorded and adjudicated; it adds a conformance-level tracker error taxonomy that maps the milestone's four tracker error classes onto the already-delivered structured failure identities and proves each class with per-adapter trap-family fixtures; it adds a deterministic, runtime-neutral simulated stateful tracker double so write-then-read flows are provable inside the offline mock tier; and it proves registration-only extensibility so a new adapter is added by supplying five declared items without touching any lifecycle, port, flow-registry, runner, coverage, or artifact module.

Nothing is widened: no adapter is completed, no closed operation is added, no error-table row or domain kind is added, the `delivery.conformance.v1` artifact keeps its schema and bounds, and no workflow file or CI job changes — the gate rides the existing TypeScript test job through the existing aggregate test path.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The conformance flow registry is exactly three flows and fourteen ordered steps over the nine closed adapter operations (`read-work-item`, `write-work-item`, `transition-work-item`, `read-delivery-request`, `write-delivery-request`, `read-pipeline-run`, `write-comment`, `resolve-delivery-thread`, `merge-delivery-request`). The registry is data; capability gating is applied by the runner.
- Execution is capability-gated per adapter: a supported operation executes against the adapter's mock tenant and applies its step assertion family; a declared gap records an explicit `declared-gap` skip carrying the reason; a carrier-less comment capability records a `capability-absent` skip; an unsupported operation with no declared gap fails closed.
- Two coverage gates exist and are per-adapter, not cross-adapter. The structural gate proves the registry and each adapter declaration are complete (unique ids, membership in the closed set, all nine operations represented, supported and gap sets disjoint and together covering the closed set, declared carriers backed by a carrier step). The runtime gate proves execution is non-vacuous (at least one executed step, every supported operation executed, every declared gap encountered with its exact reason, no failed step counted as passed).
- The capability model states explicitly that parity is never implied: an operation absent from `supportedOperations` is unsupported, and gap records carry one of three closed reasons (`provider-unsupported`, `adapter-not-implemented`, `plan-restriction`).
- The flow registry, coverage gates, artifact module, and harness registry contain no adapter identity literal. The runner does: it derives an expected entity identity from tenant addressing with five provider comparisons, and the tenant decoder plus the addressing types carry provider-tagged shape. Extensibility is therefore bounded by an honest, enumerated set of identity homes rather than by an absolute claim.
- The conformance adapter registry is pinned to exactly the three shipped provider contracts — GitHub, GitLab, Jira. A structure test rejects a registration whose name matches no declared provider contract and rejects a declared provider contract with no registration; the `azure` and `ci` subpaths are deliberately not registered.
- Authoritative capability posture today: GitHub supports all nine operations with zero gaps; GitLab supports `read-delivery-request` and `read-pipeline-run` and declares the other seven `adapter-not-implemented`; Jira supports `read-work-item`, `write-work-item`, and `transition-work-item`, declares `write-comment` `adapter-not-implemented`, and declares `read-delivery-request`, `write-delivery-request`, `read-pipeline-run`, `resolve-delivery-thread`, and `merge-delivery-request` `provider-unsupported`.
- Mock tenants are declarative data: a provenance marker, an example-only instance, a credential reference, provider addressing, an ordered route table keyed by method plus exact URL (with `GET` as the default and an optional exact request body), and one expected projection per executed step. Replay goes through the production client factories with an injected transport; an unfixtured request throws naming method and URL. Replay is stateless: a route returns a fixed status and body, and no request mutates what a later request observes.
- The only stateful transport in the repository is a single-issue test helper under the provider test support area; it answers `GET` with a current issue document and applies an issue `PATCH` body. It is not shared, not part of the conformance contract, and not exercised by the conformance suite.
- The `delivery.conformance.v1` artifact carries `schema`, `runId`, `tier`, `generatedAt`, `status`, `providers[]`, `flows[]`, `steps[]`, `mutationRequests`, `createdArtifacts`, and `totals`, with closed status sets, closed skip kinds (`declared-gap`, `capability-absent`, `live-read-only`), bounded diagnostics, and fixed caps (16 providers, 16 flows, 64 steps per flow, 512 total steps, 1024 characters of failure detail, 256 KiB serialized). It carries no parity information.
- The mock tier installs a throwing-`fetch` guard and a child-process guard and asserts zero calls on each. A live read-only tier runs on a schedule behind a separate workflow and is not a merge gate; the workflow contract test pins its triggers, permissions, pins, secret scope, upload path, and retention, and the delivered statement is that no workflow job is added to the pinned CI topology.
- Trap catalogs are per-provider, four-field entries (`trapName`, `providerBehavior`, `expectedNormalizedOutcome`, `fixtureReference`) committed as data: 37 GitHub entries, 3 GitLab entries, 7 Jira entries, each proven against committed sanitized synthetic fixtures by provider-level replay suites. There is no closed family vocabulary, no per-adapter family-coverage requirement, and no conformance-level use of the catalogs.
- Provider failure identities remain adapter-local: `provider.payload.invalid` (with an optional structured `httpStatus`, which the GitHub slice supplies and the Jira and GitLab slices leave absent, and which is omitted for a transport failure), `provider.not-found` (read-scoped definitive absence), and `config.credential.missing`. The error table carries no `tracker.`-prefixed identity; `provider.auth.rejected` is the AI provider engine's identity and is not a tracker classification.
- Two unrelated `tracker.*` vocabularies already exist in production and are not lifecycle failure identities: the daily-status observation codes (`tracker.owner-gate-escalated`, `tracker.stalled-ticket`, and the `tracker.hygiene.*` family) with their owner map, and the doctor diagnostic codes (`tracker.credential-unavailable`, `tracker.credential-rejected`, `tracker.read-failed`, `tracker.not-attempted`) with their domain mapping. The status-collector row `status.collector.tracker.unavailable` and many `tracker` field names also exist across core, CLI, and MCP. This change neither extends nor renames any of them, and they are out of scope for the taxonomy literal scan described below.
- Within the change's own package surface — the testkit and adapters source trees — no string literal beginning `tracker.` exists today, so a literal scan over exactly those trees with an exact allowlist starts from zero and is satisfiable.
- `packages/testkit` is dev-only, private, and runtime-neutral: no `node:*` or `bun:*` import, no ambient environment, clock, or randomness. Filesystem fixture loading, the process environment read, native fetch, the child-process module substitution that backs the guard, and artifact writing live only under `tests/`.
- Pinned structural surfaces already exist and must move with any new module: a per-file executable-export inventory, a package export-discipline check, and a structure test that pins the provider-contract registration scan.
- CI runs the TypeScript test suite in the `ts-test` job through the aggregate test path; `tests/structure` also runs inside the exports job. No conformance-specific job exists, and a CI topology check guards the pinned job set.
- Binding invariants that constrain this change: additive-within-v1 contract evolution; an exact, reason-bearing runtime-API confinement allowance; an exact secret-read boundary allowlist; provider-native types never cross a subpath; runtime-neutrality for testkit; offline determinism with both network and child-process containment.

### 2.2 Pain Points / Gaps

- **Parity is asserted, not proven.** The suite validates each adapter against its own declaration. Nothing compares an adapter's capability and observed behavior with the reference adapter, so a divergence is detectable only by a human reading two reports, and the milestone's "one adapter contract, provable across adapters" is unmet.
- **Behavior differences have no representation.** A genuine provider difference — for example a structured `httpStatus` present on one adapter's failures and absent on another's, or one adapter returning several pipeline runs for a commit where another returns one per run — cannot be recorded, reviewed, or bounded. It is invisible, which is indistinguishable from an undeclared difference.
- **The tracker error taxonomy is scattered.** The milestone names four tracker error classes and four trap families; today the closest thing is per-adapter failure assertions inside provider unit suites, with no closed class vocabulary, no conformance-level classification check, and no completeness requirement, so an adapter that never exercises a family is silent.
- **Write-then-read cannot be proven offline.** The mock tenants are stateless, so no conformance flow can show that a write is observable through the same adapter surface, and the one stateful helper is a provider-test convenience rather than a contract.
- **Extensibility is only structural.** Adding an adapter is proven by a structure test over the three shipped contracts, not by a registration-only proof; the ticket's "new adapters plug in without lifecycle changes" is therefore an assertion about today's code rather than an enforced property.
- **Trust erosion compounds.** Because parity, difference, classification, and plug-in are all unrepresented, every later adapter (Jira, GitLab, and any future provider) is compared against a bar that is partly prose, and there is no gate that can fail when the bar moves.
- **Affected users:** the maintainers of the provider adapters who must add and evolve adapters; the conformance and test-toolkit owners who own the suite; the readiness and review roles who must decide whether a parity claim is evidence-backed; the delivery lifecycle itself, which depends on tracker swaps not changing its contract; and operators only indirectly, through honest capability and failure reporting.

## 3. PROBLEM STATEMENT

Because the conformance suite evaluates every adapter against its own declaration and replays only stateless tenants, the delivery system cannot prove that switching trackers leaves the lifecycle contract unchanged: an adapter can diverge from the reference adapter, classify a tracker failure under a different identity, or fail to exercise an entire trap family without any check failing, so the milestone's adapter-conformance exit criterion and the ticket's "fails on undeclared behavior differences / plugs in without lifecycle changes" acceptance remain unproven claims rather than enforced properties.

## 4. GOALS

- **G-1**: Cross-adapter parity is declared data with a reference adapter and adjudicated differences, and a gate fails on every undeclared capability or behavior difference.
- **G-2**: The milestone's four tracker error classes and its four trap families are a closed, conformance-level vocabulary proven per adapter by offline fixtures, with no new failure identity; two further families make the transport and malformed-payload classes provable.
- **G-3**: A deterministic simulated stateful tracker double makes write-then-read flows provable inside the offline mock tier, with zero network and zero child processes.
- **G-4**: Registration-only extensibility is proven: a new adapter supplies a fixed, declared set of items and requires no lifecycle, port, flow-registry, runner, coverage, or artifact change.
- **G-5**: The change stays additive and honest: no adapter completion, no policy engine, no new closed operation, no error-table row, no artifact schema change, and no CI topology change.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Parity matrix completeness | Exactly one cell per (registered adapter × closed operation) pair; 0 missing, 0 duplicate, 0 out-of-set cells; each adapter column covers all nine operations |
| Undeclared-difference escapes | 0 — one register entry per `declared-difference` cell and one cell per register entry, enforced in both directions; 0 orphan entries, 0 duplicate entries per adapter and operation |
| Reference-adapter purity | 0 declared differences in the reference adapter column |
| Difference-evidence freshness | 100% of register entries reproduce their recorded difference class from a committed evidence fixture |
| Taxonomy mapping completeness | 4/4 tracker error class ids mapped to exactly one delivered identity and decided only by structured fields; 0 new error-table rows and 0 new domain kinds |
| Taxonomy classification agreement | 100% of family fixtures per adapter satisfy their declared outcome — a class, the bounded-observation assertion, a gap, or a recorded difference |
| Trap-family completeness | 6/6 families accounted for per adapter as covered, gap-backed, or recorded difference; 0 silent families |
| Offline containment | 0 live network calls and 0 live child processes across the parity gate and double-backed flows |
| Determinism | 2/2 replays of the same declared input and request order produce identical canonicalized state, identical normalized reads, and identical violations and ordering |
| Registration-only cost | 0 edits to lifecycle, port, flow-registry, runner, coverage, or artifact modules for a new adapter; 0 new entries in the provider-identity allowlist; the synthetic control registration passes the whole gate |
| Topology and schema invariance | 0 workflow files changed, 0 jobs added, 0 artifact fields added, 0 closed operations added, 0 error-table rows added |
| Testkit purity | 0 `node:*`/`bun:*` imports, 0 ambient environment/clock/randomness reads in testkit source |

### 4.2 Non-Goals

- **NG-1**: Completing or changing any adapter's behavior, operations, or capability posture — GitHub, GitLab, and Jira keep their delivered declarations. Adapter completion is M3-S2 / M3-S3 / M3-S4.
- **NG-2**: The policy engine or any former-M3 leftover; OQ-M3-10 keeps them unplanned.
- **NG-3**: New provider kinds, cloud or hosted-product integrations, or any presentation-layer surface.
- **NG-4**: Adding, removing, renaming, or retyping a closed adapter operation, port, capability flag, carrier kind, or normalized-view field.
- **NG-5**: New error-table identities, new domain kinds, or any change to projection classes and exit codes.
- **NG-6**: Changing the `delivery.conformance.v1` schema, its field set, its bounds, or its skip-kind vocabulary; adding a second artifact kind; or serializing parity into the artifact.
- **NG-7**: Adding a workflow job, changing a workflow trigger, or moving the live tier onto the merge path.
- **NG-8**: Network-gated parity, a sandbox tier, or any relaxation of the offline requirement (OQ-M3-09).
- **NG-9**: Publishing the parity matrix as a CLI command, report, or rendered surface; it is inspectable data and a gate verdict only.
- **NG-10**: Adding fields to trap-catalog entries (they stay exactly four-field), migrating the provider trap suites onto the conformance suite, or retiring them.
- **NG-11**: Parity for the adapter-local evidence reads (log excerpt, thread discussion, deploy trace) that sit outside the closed operation set; their posture stays "same behavior or explicitly absent".

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Declared cross-adapter parity matrix with a reference adapter, a closed difference-class vocabulary, and an adjudicated difference register | The ticket's first acceptance clause is that the suite fails on undeclared behavior differences; today no cross-adapter comparison exists. |
| F-2 | Conformance-level tracker error taxonomy with per-adapter trap-family coverage | The ticket names a typed error taxonomy and trap catalogs per adapter; today that knowledge is scattered across provider unit suites with no completeness requirement. |
| F-3 | Deterministic simulated stateful tracker double inside the offline mock tier | The ticket names a simulated tracker for offline tests; stateless tenants cannot prove a write is observable through the same surface. |
| F-4 | Registration-only extensibility contract with a synthetic registration proof | The ticket's second acceptance clause is that new adapters plug in without lifecycle changes; today that is asserted structurally, not proven. |
| F-5 | Parity gate integration into the existing test path with bounded, deterministic diagnostics | The ticket names a parity matrix gate in CI; the delivered topology forbids a new job, so the gate must enter through the existing test path and be diagnosable. |

### 5.1 Capability Details

**F-1 — Declared parity.** One matrix, declared as data, relates every registered adapter to the reference adapter across the nine closed operations. Each cell carries exactly one closed value: the adapter behaves as the reference does on that operation, the adapter carries a declared gap for that operation, or the adapter differs and the difference is recorded. The reference adapter is a single declared value, and its column is uniformly "behaves as the reference" — an adapter cannot declare a difference from itself, a gap, or an absence there. Parity is defined over four provider-independent dimensions, never over byte equality of normalized views: the same steps participate for the operation (or the skip carries the same declared reason), the same named primitive assertion families apply and pass, the same tracker error class results for the same trap family, and the same declared absence and truncation signals hold. A difference carries exactly one class from a closed vocabulary — identity scheme, pipeline model, state vocabulary, pagination model, carrier absence, or failure classification — and free-text difference descriptions are never a cell value. Each recorded difference is keyed by adapter and operation, and the cell and its register entry are a strict one-to-one: a difference without an entry fails, an entry naming no cell fails, and two entries for the same adapter and operation fail. The register names the class, the rationale, the evidence that reproduces the observed behavior, and the adjudication reference. Parity is therefore three-way consistent — matrix, capability declaration, and observed conformance outcome — and a disagreement is a gate failure that names the provider, the operation, and the clause, never a warning and never a silent skip.

The state-vocabulary class is deliberately narrow, because the delivered workflow-map injection already makes status *mapping* a construction concern inside an adapter: a difference is recorded only when the native state model diverges in a way the adapter's declared mapping cannot express — a different mechanism for the same alias, or a state the map has no row for — and never merely because two adapters spell their map rows differently. Where the delivered mapping can express the reference behavior, the cell is "behaves as the reference".

Because the shipped adapters are not being completed in this change, the initial adjudication will legitimately record differences where a delivered adapter genuinely differs; those records are evidence-backed data reviewed like any other declared surface, and a record whose evidence no longer reproduces it, or whose evidence shows reference-equal behavior, fails.

**F-2 — Tracker error taxonomy and trap families.** The four tracker error classes named by the milestone become conformance vocabulary only, each with a fixed class id and exactly one already-delivered structured identity: `tracker.capability.unsupported` is the declared capability gap (operation plus closed reason — structured data, never an adapter failure and never a skip without a reason); `tracker.auth.rejected` is the adapter-local payload failure carrying status 401 or 403 (a missing credential stays the credential-resolution identity, outside the taxonomy); `tracker.transport.failed` is the same payload identity carrying no status; `tracker.payload.invalid` is the payload identity with any other status, an adapter-local named refusal with zero provider requests, or an undecodable success body. Discrimination is structural on the fields each adapter actually returns, and the delivered slices are asymmetric: only the GitHub slice supplies `httpStatus` on a non-2xx payload failure, while the GitLab and Jira slices build theirs without one, so on those two adapters an authentication rejection is not structurally distinguishable from a transport failure and a dispatched-request payload failure carrying no status classifies as `tracker.transport.failed` (an adapter refusal raised before dispatch, with zero provider requests, stays `tracker.payload.invalid`). That asymmetry is delivered behavior: this change neither normalizes nor fixes it, and the affected family is adjudicated as an evidence-backed `failure-classification` declared difference instead of being silently reclassified. Classification is a total projection over five observable outcomes in fixed order — capability gap, adapter refusal, no response, a read's explicit 404, then any other status or undecodable success — with no prose input and no provider branch; a read's 404 is a truthful absence outside the taxonomy, and a write's 404 stays the payload class. The class ids never appear in a normalized view, a failure result, an error-table row, a domain kind, a projection class, or an artifact: they are the vocabulary in which the suite states what it proved, not a second error system. They are declared in exactly one module on the change's own surface; every other source file under the testkit and adapters packages carries zero string literals beginning `tracker.`, and such a literal outside that one declaration module fails a scan whose scope is exactly those two source trees and whose allowlist is exactly that one file, naming file and construct. Pre-existing `tracker.*` vocabulary elsewhere — the daily-status observation codes and their owner map, the doctor diagnostic codes and their domain mapping, the status-collector row, and the `tracker` field names across core, CLI, and MCP — is outside the scan, unchanged by this change, and neither evidence for nor against the taxonomy.

Six trap families form the closed vocabulary, and every adapter must account for every one of them. The milestone's four are present — `rate-limit`, `auth-shape`, `pagination-truncation`, and `workflow-state-mismatch` — and two are added so the transport class and the malformed-payload branch are provable rather than unproven: `transport-failure` and `payload-shape`. Five families prove a class; `pagination-truncation` is not an error class but a bounded-observation assertion over the declared page limit and truncation signal. Per adapter and family the posture is exactly one of covered — at least one committed offline fixture replayed through the production client for a declared operation the family is meaningful for — gap-backed by the exact declared gap reason on that operation, or a recorded difference whose class is the failure-classification class. Silence is a gate failure, and a family never has both a fixture and a gap posture. Trap-catalog entries keep their four-field shape; the family mapping is separate declared data that references entry names, so no catalog migration and no schema growth occurs.

**F-3 — Simulated stateful tracker double.** A simulated tracker double joins the conformance suite as a runtime-neutral, purely in-memory implementation of the existing transport seam: declared initial state, declared routes, and a closed effect vocabulary applied by the matched route, so a later read observes what an earlier write declared. A request sequence of write-then-read therefore becomes provable through the production client factory, without any change to flows, step ids, assertion families, or registrations. Determinism is structural: identity and ordering come from declared data, never from a clock, randomness, or an ambient counter, so the same declared input and request order produce identical canonicalized state and identical normalized reads. Failure is closed and loud: an undeclared request, an undeclared effect, or an effect naming a missing resource fails naming method, URL, and effect, and never degrades to a silent no-op or a live call. The delivered stateless tenant behavior is unchanged and is the default when no state is declared; the extension is additive. Fixture loading and both offline guards stay under `tests/`, while the double itself lives with the suite so future adapters are tested with it rather than re-inventing a local helper.

**F-4 — Registration-only extensibility.** The participation contract states exactly what a new adapter supplies: a contract drawn from the closed operation set, one registration binding a client builder over tenant, credential port, and injected transport, one parity-matrix column, one mock-tenant fixture set, and one trap catalog. Nothing else — no lifecycle port, no phase hook, no flow, no step id, no assertion family, no coverage rule, no runner branch, and no artifact field. The proof is twofold. First, a provider-identity-free invariant over a named module set — the flow registry, the coverage gates, the artifact module, the harness registry, the parity engine, the tracker taxonomy table, and the double — which must contain zero adapter identity literals, with every permitted home of identity enumerated exactly (the registration list, the matrix column keys, provider fixtures, the provider-tagged addressing types and derived read-failure union, the addressing decode, and one pinned engine exception recorded rather than concealed: the delivered runner derives an expected entity identity from tenant addressing with five provider comparisons). The scan is pinned to that exact allowlist by file and construct, so it cannot absorb a new branch quietly. Second, a synthetic registration: a conformance-only control adapter injected through the delivered adapter list, never added to the shipped registry, must produce a passing run with a complete matrix column and full family accounting. Because the delivered suite forbids comparing against a moving base ref, the "no module changed" half of that proof is proof-by-construction — the run cannot be green without the seam — confirmed by review of the change's touched modules, not by a diff assertion. The shipped registry remains exactly the three shipped provider contracts, and a structure check continues to reject a non-shipped registration added to it.

**F-5 — Gate integration and diagnostics.** The parity gate is a check, not a platform: it runs inside the existing aggregate test path in the existing TypeScript test job, adds no workflow file or job, and leaves the pinned topology contract green. Its verdict is a deterministic, ordered violation list in which every entry names the provider, the operation, and the failing clause, with bounded scalar detail and an evidence or fixture reference. It is offline and in-process: it spawns nothing and reaches nothing, and it is re-runnable with the same result. Parity outcome is not written into the conformance artifact; the artifact remains bounded run evidence under its delivered schema.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Parity adjudication and gate
  Maintainer declares a matrix column for an adapter
    → the gate compares every cell with the adapter's capability declaration
    → a supported operation with a differing observed outcome needs a register entry
    → a register entry needs a closed class, a rationale, an evidence fixture, and an adjudication reference
    → the gate fails naming provider, operation, and clause for any gap in that chain
```

```
Flow 2: Tracker failure classification parity
  The suite replays a trap-family fixture through the production client
    → the adapter classifies the stimulus into its structured identity and discriminator
    → the suite compares the classification with the declared class for that family
    → agreement passes; a different class is a recorded difference or a gate failure
    → a family the adapter cannot exercise must be gap-backed or recorded, never silent
```

```
Flow 3: Offline write-then-read
  A conformance scenario declares initial state and an ordered request sequence
    → the double matches each declared route and applies its declared effect
    → a later read observes the resulting state through the same adapter surface
    → the guards observe zero network calls and zero child processes
    → a second identical replay produces identical canonicalized state and identical reads
```

```
Flow 4: New adapter plug-in
  A new adapter supplies five items: contract, registration, matrix column, tenants, trap catalog
    → the synthetic-registration proof runs the whole suite over it
    → no lifecycle, port, flow-registry, runner, coverage, or artifact module changes
    → a requirement outside the closed set or the participation contract is refused by name
```

```
Flow 5: Gate in CI
  CI runs the existing TypeScript test job
    → the aggregate test path executes the parity gate and the double-backed flows
    → a violation fails the job with an ordered, bounded diagnostic
    → no workflow file, job, trigger, or artifact upload changes
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The declared parity matrix over the nine closed operations and the registered adapters, with one declared reference adapter and a closed cell vocabulary.
- The declared-difference register with a closed difference-class vocabulary, required rationale, required evidence, and required adjudication reference.
- The parity gate: three-way consistency between matrix, capability declaration, and observed conformance outcome, with bidirectional register/cell coverage and closed-set validation.
- The declared tracker error taxonomy: four class ids, each resolving to one delivered identity and decided only by structured fields, with a total decision rule over five observable outcomes and the rule that the ids never become emitted failure identities.
- The declared trap-family vocabulary and per-adapter family accounting, with offline fixtures per covered family and gap-backed or recorded alternatives.
- The simulated stateful tracker double, its declared effect vocabulary, its declared initial-state and response contract, and its determinism and fail-closed requirements.
- The additive extension of the declared tenant data that carries initial state and route effects, with the delivered stateless behavior as the default.
- The registration participation contract and its two proofs: the adapter-identity-free core invariant and the synthetic control registration.
- The structural, behaviour, and check-level evidence for all of the above, including mutation controls that fail by name.
- Updates to pinned surfaces required by new exports and modules: the per-file executable-export inventory, the export-discipline expectation, and the conformance structure tests.
- Decision records TDR-0036 through TDR-0039, authored on the change branch and cited here as DEC-1 through DEC-4.

### 7.2 Out of Scope

- [OUT] Any adapter behavior, operation set, or capability-posture change for GitHub, GitLab, or Jira.
- [OUT] The policy engine and every former-M3 leftover (OQ-M3-10).
- [OUT] New provider kinds, cloud or hosted-product integrations, and presentation work.
- [OUT] Any new closed operation, port, capability flag, carrier kind, or normalized-view field.
- [OUT] Any new error-table row, domain kind, projection class, or exit-code change.
- [OUT] Any change to the `delivery.conformance.v1` schema, bounds, skip kinds, or to the set of artifact kinds.
- [OUT] Any workflow file, job, trigger, permission, or upload change, and any parity evidence on the live tier.
- [OUT] Network-gated parity, sandbox tenants, or relaxed offline containment.
- [OUT] A CLI command, report, or rendered surface for the parity matrix.
- [OUT] New fields on trap-catalog entries, or migration/retirement of the provider trap suites.
- [OUT] Parity for the adapter-local evidence reads outside the closed operation set.

### 7.3 Deferred / Maybe-Later

- Extending the closed difference-class vocabulary beyond the six declared classes (identity scheme, pipeline model, state vocabulary, pagination model, carrier absence, failure classification); a new class is a new decision.
- Parity for the adapter-local evidence reads once a second adapter implements one.
- Serializing parity into a versioned artifact once a consumer exists for it.
- Promoting the parity matrix to an operator-visible report or command surface.
- Family-level parity for the harness conformance registry (a separate registry with its own six-scenario floor).
- Automating adjudication of new differences (today adjudication is a recorded human reference).
- Reconciling the stateless provider-test stateful helper with the new double; the helper stays where it is in this change.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

No inbound HTTP endpoint is added, changed, or removed, and no outbound provider surface changes. This change's interfaces are in-process conformance contracts:

| ID | Surface | Contract |
|----|---------|----------|
| API-1 | Parity gate | One pure validation over declared matrix data, the registered adapters' capability declarations, the register, and the observed conformance outcome. It returns clause-tagged violations (empty means pass); every violation names the provider, the operation, and the failing clause. It performs no I/O, reads no ambient input, and is deterministic for the same input. |
| API-2 | Tracker classification assertion | One comparison between a declared tracker error class and the structured result a replayed fixture produced, resolved from the delivered identity plus the structural discriminator (status presence and value, or absence). It never inspects prose and never introduces an identity. |
| API-3 | Simulated double transport | The existing conformance transport seam: a request (method, exact URL, optional serialized body) returns a status and an untrusted body. Behaviour is declared state plus the matched route's declared effect; an undeclared request, undeclared effect, or missing resource is a named failure. |
| API-4 | Declared tenant extension | The delivered tenant document may carry an optional declared initial state and per-route optional declared effects drawn from the closed effect vocabulary. Absence means the delivered stateless exact-URL replay. Malformed or out-of-vocabulary declarations are rejected by name at decode time. |
| API-5 | Registration participation | The declared set of items a new adapter supplies (contract, registration, matrix column, tenant fixture set, trap catalog) plus the refusal for anything outside it (an operation outside the closed set, a lifecycle hook, a per-adapter runner branch). |

### 8.2 Events / Messages

None. No event, message, telemetry record, or state-schema record is added. The conformance artifact remains an evidence record under its delivered schema and gains no parity field; the gate verdict is a test outcome, not a recorded event.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Parity matrix | Declared data with one row per closed operation and one cell per registered adapter. A cell is exactly one of `{ kind: "same-as-reference" }`, `{ kind: "declared-difference", differenceClass, registerId }`, or `{ kind: "gap", reason }`, where `reason` is the adapter's own declared gap reason for that operation and is a reference to the capability declaration, not a copy. The matrix has no free-text cell value. Parity for a cell is judged on four provider-independent dimensions: step participation, primitive assertion families, tracker error class per trap family, and declared absence and truncation semantics. |
| DM-2 | Declared-difference register entry | Keyed by exactly `(adapter, operation)` — one entry per declared-difference cell, never two: `{ differenceId, adapter, operation, differenceClass, rationale, evidence, adjudicatedBy }`. `differenceClass` is drawn from the closed set `identity-scheme` \| `pipeline-model` \| `state-vocabulary` \| `pagination-model` \| `carrier-absent` \| `failure-classification`, additive only by a recorded extension. `evidence` references a committed fixture or trap entry that reproduces the recorded difference; an entry whose evidence is missing, does not resolve, or shows reference-equal behavior fails. `adjudicatedBy` references the decision record or review that accepted the difference. |
| DM-3 | Tracker error taxonomy | Four declared class ids, each resolving to exactly one delivered identity and decided only by structured fields: `tracker.capability.unsupported` → the capability-gap declaration (operation plus closed reason; never a failure and never a fixture family); `tracker.auth.rejected` → the adapter-local payload failure with `httpStatus` 401 or 403 (a missing credential stays the credential-resolution identity and is outside the taxonomy); `tracker.transport.failed` → the adapter-local payload failure carrying no `httpStatus`; `tracker.payload.invalid` → the payload failure with any other status, an adapter-local named refusal with zero provider requests, or an undecodable success body. Classification is a total projection over five observable outcomes in fixed order — capability gap, adapter refusal, no response, a read's explicit 404, then any other status or undecodable success — with no prose input and no provider branch; a read's 404 is a truthful absence outside the taxonomy, and a write's 404 stays the payload class. Discrimination is structural on the fields the adapter actually returns: a dispatched-request payload failure carrying no `httpStatus` classifies as `tracker.transport.failed` (an adapter refusal raised before dispatch, with zero provider requests, stays `tracker.payload.invalid`), and the delivered slices are asymmetric — the GitHub slice supplies `httpStatus` on a non-2xx payload failure, while the GitLab and Jira slices do not — so on the latter two an authentication rejection is not structurally distinguishable from a transport failure. That asymmetry is delivered behavior, is not normalized by this change, and is adjudicated per family as an evidence-backed `failure-classification` declared difference. The four ids are testkit-local labels: no error-table row, no domain kind, no emitted failure code, no projection class, and no normalized-view or artifact occurrence. They are declared in exactly one module within the testkit and adapters source trees; a string literal beginning `tracker.` elsewhere in those trees fails a scan whose scope and single-file allowlist are exact. Pre-existing `tracker.*` vocabulary outside those trees (daily-status observation codes and their owner map, doctor diagnostic codes and their domain mapping, the status-collector row, and `tracker` field names) is out of scope and unchanged. |
| DM-4 | Trap-family accounting | Two declared vocabularies and their wiring. The closed family set is six: `auth-shape` (→ `tracker.auth.rejected`), `transport-failure` (→ `tracker.transport.failed`), `rate-limit` (→ `tracker.payload.invalid`), `payload-shape` (→ `tracker.payload.invalid`), `workflow-state-mismatch` (→ `tracker.payload.invalid`, asserted with zero provider requests), and `pagination-truncation` (not an error class: a bounded-observation assertion over the declared page limit and truncation signal). The milestone's four families are all present; transport-failure and payload-shape are added so the transport class and the malformed-decode branch are provable rather than unproven. Per adapter and family the posture is exactly one of `covered` (at least one committed fixture replayed through the production client for a declared operation the family is meaningful for, with the trap-catalog entry names that prove it), `gap-backed` (that operation is a declared gap for the adapter, with the exact reason), or `recorded-difference` (referencing the register entry, which must carry the `failure-classification` class; this is the posture that carries a status-less adapter's authentication classification, where the declared class is structurally unreachable). A family names its operation; an unaccounted family fails the gate, and a family never holds both a fixture and a gap posture. Trap-catalog entries keep their delivered four-field shape; family wiring is separate data referencing entry names. |
| DM-5 | Simulated double contract | Declared scenario data: an optional declared initial state, the delivered route table, and an optional declared effect per route drawn from the closed five-effect vocabulary — `set-field` (set one named field to a declared value), `reset-field` (restore a named field to its declared baseline), `replace-collection` (replace a named collection with declared entries), `append-entry` (append one declared entry using the next identity from a declared sequence), and `mark-resolved` (mark one named sub-resource resolved) — whose operands are declared per tenant. Every identity is declared: resource identities from the tenant, created-entry identities from a declared sequence, ordering by declaration order. A route with no declared effect performs no state change and returns its declared body, which is the delivered stateless behavior. Absence of a declared initial state means the delivered stateless replay. The vocabulary is closed and grows only by a recorded extension with its own fixture. |
| DM-6 | Registration participation record | The declared five-item participation set, plus the two invariants it is checked against. First, the provider-identity-free bound set — flow registry, coverage gates, artifact, harness registry, parity engine, taxonomy table, double — contains zero adapter identity literals, and every permitted home of identity is enumerated exactly: the registration list, the matrix column keys, provider fixtures, the provider-tagged addressing types and derived read-failure union, the addressing decode, and the one pinned engine exception (the runner's addressing-derived expected entity identity with five provider comparisons, recorded as delivered and not as an approved pattern). Second, the shipped registry is exactly the three shipped provider contracts. The synthetic control registration is injected through the delivered adapter list and is never a shipped entry. |
| DM-7 | Reference adapter designation | One declared value naming the adapter whose behavior is the parity reference (GitHub for this milestone). The reference column is constrained to `same-as-reference` and carries no register entry. |

### 8.4 External Integrations

No live external integration is added or changed. The double and all new fixtures are offline: provider shapes are committed synthetic fixtures with the delivered sanitization discipline, example-only hosts, and stable placeholders. The live read-only tier is untouched and remains outside the parity gate. OQ-M3-09's answer — a simulated double is required and CI runs it offline — is the authority for the containment requirement.

### 8.5 Backward Compatibility

- The change is additive. No closed operation, port, capability flag, carrier kind, normalized-view field, error-table row, domain kind, projection class, or exit code is added or changed.
- The delivered stateless tenant contract is unchanged and remains the default: a tenant with no declared state and no declared effects replays exactly as today, producing identical projections, skip reasons, and diagnostics.
- The shipped conformance registry stays exactly the three shipped provider contracts; the control adapter is injected through the adapter list, so no shipped registration is added or removed.
- The flows, step ids, assertion families, and skip-kind vocabulary are unchanged. A double-backed scenario is additional declared evidence, not a new flow.
- The `delivery.conformance.v1` artifact keeps its field set, closed statuses, skip kinds, and bounds. Parity is not serialized into it, and no artifact validator changes meaning.
- The trap-catalog entry contract keeps exactly four fields; the family mapping is a separate declared surface, so no existing catalog is migrated.
- The delivery failure identities are unchanged in behavior: the previously absent structured status on the GitLab and Jira slices remains absent, and where that absence makes a declared class structurally unreachable — the authentication class on those two adapters — the family is a recorded `failure-classification` difference. This change does not silently normalize the asymmetry and does not treat it as a defect to fix.
- Adapter identity is data. A shipped adapter gains a matrix column and family accounting in this change; a future adapter gains the same five declared items and no code change outside its own registration and fixtures.
- The pinned CI topology is unchanged: no workflow file, job, trigger, permission, or upload changes, and the workflow contract test and topology check remain authoritative.
- Pinned structural surfaces (the per-file executable-export inventory and the export-discipline expectation) are updated exactly for the new modules and exports, and the structure tests are not weakened or made vacuous.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Offline containment and determinism | 0 live network calls and 0 live child processes across the gate and double-backed flows, enforced by both delivered guards; the same declared input and request order replayed twice yields identical canonicalized state, identical normalized reads, and an identical violation set and ordering |
| NFR-2 | Parity completeness and non-vacuity | Cells exactly equal adapters × closed operations (0 missing, duplicate, or extra); 100% of violations name provider, operation, and clause; every gate rule has a mutation control that fails by name |
| NFR-3 | Taxonomy fidelity | 4/4 class ids mapped to exactly one delivered identity and decided only by structured fields; 100% of replayed family fixtures satisfy their declared outcome (class, bounded observation, gap, or recorded difference); 0 new failure identities and 0 prose-based classification; classification is decided only by the structure the adapter actually returns, so a status-less payload failure never satisfies the status-bearing authentication class and that family is accounted as a recorded difference where the class is unreachable; 0 string literals beginning `tracker.` in the testkit and adapters source trees outside the single taxonomy declaration module, with the scan's scope and allowlist fixed exactly |
| NFR-4 | Trap-family completeness | 6/6 families accounted for per adapter; 0 silent families; 0 families holding both a fixture and a gap posture; 0 catalog entries with anything other than four fields; 0 unresolvable fixture references; family wiring and catalog coverage are bidirectional |
| NFR-5 | Double determinism and closure | 0 clock, randomness, or ambient-counter dependence; 100% of state changes declared by one effect from the fixed five-effect vocabulary; 0 effects inferred from a URL, a method, or a payload shape; 100% of undeclared requests, undeclared effects, and effects naming a missing target fail by name; identical canonicalized state and identical normalized reads across two runs of the same input |
| NFR-6 | CI topology invariance | 0 workflow files changed, 0 jobs added, 0 triggers changed; the gate and double suites execute inside the existing TypeScript test job through the existing aggregate test path; the workflow contract test and the CI topology check stay green |
| NFR-7 | Testkit purity | 0 `node:*`/`bun:*` imports and 0 ambient environment, clock, or randomness reads in testkit source; filesystem, environment, native fetch, child-process substitution, and artifact writing remain confined to `tests/` |
| NFR-8 | Additive compatibility and pinned surfaces | 0 removed, retyped, or newly required contract fields; 0 state migrations; 0 artifact schema changes; the per-file executable-export inventory and export-discipline expectation updated exactly and not vacuously; typecheck, lint, build, and the aggregate gate green |
| NFR-9 | Secret hygiene and fixture safety | 0 occurrences of credential material in gate diagnostics, double state, fixtures, or reports; the existing sanitization audit and planted-secret canary stay green; 0 new secret-read allowlist entries; fixture hosts stay example-only |
| NFR-10 | Registration-only extensibility | 0 edits to lifecycle, port, flow-registry, runner, coverage, or artifact modules for a new adapter; 0 new entries in the provider-identity allowlist beyond the one recorded runner derivation; the synthetic control registration passes the whole gate with a complete matrix column and full family accounting |
| NFR-11 | Bounded diagnostics | Violation detail ≤ 1024 characters, expected and received values scalar only, every violation carrying a fixture or evidence reference; 0 credential material, 0 provider-native payloads, and 0 unbounded collections in a diagnostic |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- No new telemetry row, metric, event, state record, or artifact field is introduced. Parity, taxonomy, family accounting, and double state are inspectable data and test outcomes.
- The parity matrix, the difference register, the taxonomy table, the family accounting, the reference-adapter designation, and the declared double scenario data are reviewable as data, so a reviewer can see the parity claim without reading test code.
- The gate reports a deterministic, ordered violation list naming provider, operation, and clause; the conformance report keeps its delivered step statuses, skip kinds, and bounded diagnostics.
- Contract-conformance runs continue to record their delivered evidence; no parity verdict is written into an artifact, a log stream, or persisted state.
- Failure identity observability is unchanged: classification stays resolvable from structured data, and the tracker class ids are test vocabulary only — declared in one module and absent from every other file in the testkit and adapters source trees, so no consumer can observe them.
- Operator-visible behavior does not change: no command gains output, no diagnostic line is added, and no capability report changes shape.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The matrix becomes documentation that rots away from the declarations it describes | M | M | Three-way consistency (matrix, declaration, observed outcome) is a gate rule, not a review habit; bidirectional register/cell coverage; mutation controls | L |
| RSK-2 | The difference register becomes a loophole where every divergence is "declared" and the gate goes quiet | H | M | Closed difference-class vocabulary; reference adapter cannot declare differences; each entry needs a rationale, evidence, and an adjudication reference; evidence must reproduce the class; gap cells cannot be re-labelled as differences | M |
| RSK-3 | The tracker taxonomy becomes a parallel error system that competes with the delivered identities | M | M | The four classes map onto delivered identities and are asserted to be absent from production code and from the error table; classification reads structured status only | L |
| RSK-4 | The stateful double becomes a second, buggy implementation of provider semantics | M | M | Declared data plus a closed effect vocabulary only; no provider-specific branching; determinism and fail-closed tests; the client under test is unchanged | M |
| RSK-5 | The plug-in proof is vacuous (a control adapter that passes because nothing is checked) | M | M | The synthetic registration must produce a complete matrix column and full family accounting, and the identity-free core invariant is checked mechanically; a mutation control removes one supplied item and must fail | L |
| RSK-6 | Trap-family coverage is declared but its fixtures do not actually exercise the family | M | M | Each covered family names its catalog entries and fixture references, and replay must classify as declared; bidirectional wiring is validated | L |
| RSK-7 | The gate slows or destabilizes the existing test job | M | L | In-process pure validation over declared data; no new job; determinism and bounded diagnostics; no network or process work | L |
| RSK-8 | Scope creep into adapter completion, error-table growth, or the policy engine | H | M | Explicit non-goals; additive non-decisions in the decision records; acceptance criteria that assert invariance of the operation set, error table, artifact, and topology | L |
| RSK-9 | New exports and modules break the pinned inventories or the export discipline, or the pins are loosened to make them pass | M | M | Inventory and export expectations updated exactly for the new modules; the pin checks are proven non-vacuous by a mutation | L |
| RSK-10 | New fixtures carry sensitive or provider-identifying material | M | L | Example-only hosts, stable placeholders, the committed sanitization audit, and the planted-secret canary remain binding | L |
| RSK-11 | A recorded difference is stale because the adapter changed underneath it | M | M | Evidence reproduction is part of the gate; a stale entry fails naming the entry | L |

## 12. ASSUMPTIONS

- GitHub remains the parity reference for this milestone; the milestone names it the reference adapter and the other adapters are parity-tested against it.
- Parity is expressible per closed operation at the primitive boundary: the normalized view, the classified failure, and the identity/ordering behavior are sufficient to state "same as reference" for every operation.
- The delivered capability declarations are the authority on support and gaps; the matrix never overrides them, and a `gap` cell is a reference to the declaration rather than a second statement of it.
- The delivered workflow-map injection makes status *mapping* a construction concern inside one adapter; it does not make two different native state models parity-equivalent, so a state-vocabulary difference is recorded only when the adapter's declared mapping cannot express the reference behavior.
- The delivered intersection count is small enough to adjudicate per cell: 27 cells today (9 operations × 3 adapters), 13 of them `gap`, 14 supported, 9 of those the reference column, leaving 5 non-reference supported intersections to adjudicate.
- The four tracker error classes are decidable from the delivered structured results without new identities or prose parsing.
- Each of the six trap families is expressible offline for at least one operation each shipped adapter supports, or is gap-backed by that adapter's declared gap; no family is left unproven by circumstance.
- The initial adjudication will record real differences between delivered adapters rather than converging them, because adapter completion is out of scope; a difference record is therefore a reviewable declaration, not a defect.
- The delivered stateless tenants can be extended additively with declared state and effects without changing any existing projection.
- The existing TypeScript test job has the capacity for the added in-process checks, and no new CI job or workflow file is needed.
- Pinned structural surfaces can be updated in the same change without weakening their checks.
- The live read-only tier and its workflow remain untouched and outside the gate.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M0-S20 adapter conformance suite | The flow registry, capability gating, coverage gates, tenant replay, mock tier, artifact, and live tier this change extends. |
| Depends on | Core adapter contracts | The nine-operation closed set, the capability/gap declaration, and the closed gap reasons. No change is made to them. |
| Depends on | Provider client seeds (GitHub, GitLab, Jira) | The clients whose behavior is compared; their behavior is unchanged, and their delivered divergences become recorded differences. |
| Depends on | Adapter reference behavior | The normative per-operation contract that states what "same as reference" means for failure classification, absence, and caps. |
| Depends on | Trap catalogs and provider fixtures | The four-field entries and the sanitized fixtures the family accounting references. |
| Depends on | Fixture sanitization audit and secret-read boundary | Unchanged and binding; the change adds no allowlist entry. |
| Depends on | TypeScript test job and the pinned CI topology | The gate enters through the existing test path; the topology contract and its check remain authoritative. |
| Depends on | Decision records TDR-0036 through TDR-0039 | Authored on the change branch; cited as DEC-1 through DEC-4. |
| Blocks | M3-S2 Jira adapter and M3-S3 GitLab adapter | Both are parity-tested against the reference through this harness. |
| Blocks | M3-S6 multi-tracker composition | Multi-tracker correctness depends on tracker swaps not changing the lifecycle contract. |
| Blocks | Any future adapter | Registration-only participation is the entry cost, proven by this change. |

## 14. OPEN QUESTIONS

No open questions remain. Every contract-level question this change raises is settled by the four decision records cited in the decision log, and the milestone's answered questions decide the remaining inputs (OQ-M3-04 for the reference order and parity bar; OQ-M3-09 for the required offline double; OQ-M3-10 for the policy engine staying unplanned). The non-blocking milestone question ticket (#342) carries no answer relevant to this change's surface: credential names and bounded pipeline evidence belong to the live tier and adapter completion, neither of which moves here, so the stated defaults apply without effect.

| ID | Question | Context | Status |
|----|----------|---------|--------|
| — | None | Scope, parity representation, difference adjudication, taxonomy mapping, double placement, and plug-in proof are decided (DEC-1…DEC-4). | Closed |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Declare one parity matrix over the nine closed operations and the registered adapters, with GitHub as the reference, a closed cell vocabulary, a closed difference-class set, and an adjudicated difference register; enforce three-way consistency and bidirectional coverage in a gate; do not serialize parity into the artifact and do not change the operation set. | A parity claim needs data and a failure mode; a bounded, adjudicated difference set is the only honest way to represent real provider divergence without completing adapters. Source: TDR-0036. | 2026-11-18 |
| DEC-2 | Map the four tracker error classes onto the delivered structured identities and capability-gap data, declare six trap families (the milestone's four plus a transport-failure and a payload-shape family), require per-adapter family accounting, and add no new identity, error-table row, or domain kind. | The delivered identities already classify these stimuli; a second closed identity set would create a competing error system and a migration burden. Source: TDR-0037. | 2026-11-18 |
| DEC-3 | Add one deterministic, runtime-neutral, in-memory simulated tracker double to the conformance suite, driven by declared state and a closed effect vocabulary, with fixture loading and guards still under `tests/`. | Write-then-read proof requires state; testkit placement makes it part of the shared contract and keeps it runtime-neutral, while the delivered stateless tenants stay the default. Source: TDR-0038. | 2026-11-18 |
| DEC-4 | Define registration-only participation as five declared items, prove it with an adapter-identity-free core invariant and a composition-injected synthetic registration, and keep the shipped registry at exactly the three shipped contracts. | "Plug in without lifecycle changes" is only credible as a mechanical property; injecting the control adapter avoids weakening the shipped-registry invariant. Source: TDR-0039. | 2026-11-18 |
| DEC-5 | The parity gate enters CI by riding the existing aggregate test path inside the existing TypeScript test job; no workflow file, job, trigger, or upload changes. | The delivered conformance specification states that no workflow job is added to the pinned CI topology, and the workflow contract test enforces it; in-process validation needs no platform surface. Source: delivered conformance quality-assurance statement; TDR-0036 non-decision. | 2026-11-18 |
| DEC-6 | Keep the round additive: no new closed operation, no new capability flag, no new failure identity, no error-table row, no artifact schema change, no persisted-state migration; update the pinned structural surfaces exactly in the same change. | The delivered additive-evolution discipline and the absence of any consumer that needs a new contract surface; a test-only extension must not widen the product contract. Source: existing contract-evolution precedent (TDR-0008) and the DEC-1…DEC-4 non-decisions. | 2026-11-18 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Adapter conformance suite (testkit): flow registry, coverage gates, runner, artifact | Unchanged in shape; gains the parity engine, the taxonomy declaration, the family accounting, the double, and the participation contract as new declared modules |
| Conformance adapter registry | Unchanged membership (three shipped contracts); the synthetic control registration is composition-injected only |
| Capability declarations (GitHub, GitLab, Jira) | Unchanged; they become one input to the parity gate |
| Trap catalogs (GitHub, GitLab, Jira) | Unchanged shape and entries; family accounting references entry names |
| Mock tenant data and decoder | Additive: optional declared initial state and per-route effects; stateless replay remains the default |
| Conformance fixtures | New stateful scenarios and family fixtures; existing fixtures unchanged |
| Testkit export surface and package surface | Additive exports for the new declared data and the double; private package, no public product surface |
| Pinned structural surfaces (per-file executable-export inventory, export discipline) | Updated exactly for new modules and exports |
| Conformance structure, behaviour, and check tests | Extended with the gate, classification, determinism, mutation controls, topology invariance, and the exact provider-identity allowlist scan |
| CI topology and the scheduled live workflow | Unchanged (deliberate) |
| Core adapter contracts, error table, artifact schema | Unchanged (deliberate) |
| Adapter behavior (GitHub, GitLab, Jira) | Unchanged (deliberate) |
| Documentation: adapter conformance, provider client seeds, adapter reference behavior, adapter ports, glossary, indexes | Reconciled in the documentation phase |

## 17. ACCEPTANCE CRITERIA

### 17.1 Declared parity matrix and gate (F-1)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the declared parity matrix and the registered adapters, **when** the gate enumerates cells through its declared validation contract, **then** there is exactly one cell per (registered adapter × closed operation) pair, no cell names an unregistered adapter or an operation outside the closed set, and every adapter column covers all nine operations. | F-1, API-1, DM-1, NFR-2 |
| AC-F1-2 | **Given** the declared reference adapter, **when** its column is inspected, **then** every cell is `same-as-reference` and no difference-register entry names the reference adapter. | F-1, DM-1, DM-7 |
| AC-F1-3 | **Given** any `gap` cell, **when** compared with the adapter's capability declaration, **then** the cell's reason equals the declared reason for that operation; and no operation is `supported` in the declaration while carrying a `gap` cell, or `gap`-declared while carrying a `same-as-reference` or `declared-difference` cell. | F-1, DM-1 |
| AC-F1-4 | **Given** the difference register and the matrix, **when** compared in both directions, **then** every `declared-difference` cell has exactly one register entry and every register entry names an existing cell; two entries for one adapter and operation fail; and each entry carries a class from the closed set, a non-empty rationale, a resolvable evidence reference, and an adjudication reference. | F-1, DM-2, NFR-2 |
| AC-F1-5 | **Given** a `same-as-reference` cell whose observed conformance outcome differs from the reference adapter's outcome on the same operation in step participation, assertion-family outcome, tracker error class, or absence/truncation semantics, **when** the gate runs, **then** it fails naming the provider, the operation, and the differing dimension, and the difference is not absorbed into a pass. | F-1, DM-1, NFR-2 |
| AC-F1-6 | **Given** a register entry under a `declared-difference` cell, **when** the gate runs, **then** its recorded class names the differing parity dimension, its evidence reference reproduces that difference, and evidence showing reference-equal behavior fails naming the entry. | F-1, DM-2, NFR-2 |
| AC-F1-7 | **Given** a mutated declaration — a missing cell, a duplicate cell, an extra cell, an out-of-set cell value, an out-of-set difference class, a support/gap contradiction, a cell for an unregistered adapter, a `declared-difference` cell with no register entry, a register entry naming no cell, two entries for one adapter and operation, or a non-uniform reference column — **when** the gate runs, **then** each mutation is rejected with a violation naming the provider, the operation, and the failing clause. | F-1, API-1, NFR-2 |
| AC-F1-8 | **Given** the conformance artifact contract, **when** inspected after the change, **then** `delivery.conformance.v1` carries the same field set, closed statuses, skip kinds, and bounds, and no parity field or parity verdict. | F-1, DM-1, NFR-8 |

### 17.2 Tracker error taxonomy and trap families (F-2)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** the declared tracker error taxonomy, **when** inspected, **then** exactly four class ids are declared (`tracker.capability.unsupported`, `tracker.auth.rejected`, `tracker.transport.failed`, `tracker.payload.invalid`), each resolving to exactly one delivered identity and decided only by structured fields; no class adds an error-table row, a domain kind, an emitted failure code, a projection class, or a normalized-view or artifact occurrence; and the four ids are declared in exactly one module inside the testkit and adapters source trees, so a scan over exactly those trees with that single-file allowlist fails naming file and construct when a string literal beginning `tracker.` appears anywhere else — while the pre-existing `tracker.*` vocabulary in core, CLI, and MCP is outside the scan's scope and unchanged. | F-2, API-2, DM-3, NFR-3 |
| AC-F2-2 | **Given** an `auth-shape` fixture (401 or 403), **when** replayed through the production client on a supported operation, **then** an adapter whose payload failures carry a structured status classifies it as `tracker.auth.rejected` with that status and the class is distinguishable from `tracker.transport.failed` from structured data alone — or, where the adapter's delivered payload failures carry no status and its family accounting is a recorded `failure-classification` difference, matches that recorded class instead; an unavailable credential remains the credential-resolution identity outside the taxonomy in both cases, and the family accounting records `covered` or `recorded-difference`, never silence. | F-2, DM-3, DM-4 |
| AC-F2-3 | **Given** a transport-failure fixture, **when** replayed through the production client, **then** the result classifies as `tracker.transport.failed` carrying no status — or, where the adapter's family accounting is a recorded `failure-classification` difference, matches that recorded class — and, for an adapter whose payload failures carry a structured status, the class is distinguishable from every status-bearing class from structured data alone; where the adapter emits no status-bearing payload failure, that distinguishability obligation is carried by the recorded difference and its evidence. | F-2, DM-3, DM-4 |
| AC-F2-4 | **Given** a rate-limit fixture, **when** replayed through the production client on a supported operation, **then** the result classifies as `tracker.payload.invalid` with its structured status, on every such adapter — or, where the adapter's family accounting is a recorded difference, matches that recorded class — and the classification never reads provider prose. | F-2, DM-3, DM-4 |
| AC-F2-5 | **Given** a payload-shape fixture (an undecodable success body, and a non-2xx body whose prose contradicts its status), **when** replayed through the production client, **then** each classifies as `tracker.payload.invalid` from the structured fields alone — or, where the adapter's delivered payload failures carry no status and its family accounting is a recorded `failure-classification` difference, matches that recorded class instead. | F-2, DM-3, DM-4 |
| AC-F2-6 | **Given** a workflow-state-mismatch fixture (an unresolvable native state on read, and a transition the declared mechanism cannot perform), **when** replayed through the production client, **then** each classifies as `tracker.payload.invalid` with zero provider requests for the transition case, or the adapter records the declared gap for that operation, or carries a recorded difference — never silence. | F-2, DM-3, DM-4 |
| AC-F2-7 | **Given** a pagination-truncation fixture, **when** replayed through the production client on a supported operation that reads a bounded page or set, **then** the assertion is a bounded-observation check over the declared page limit and truncation signal, not an error class, with no new page bound, retry, or pagination behavior. | F-2, DM-3, DM-4 |
| AC-F2-8 | **Given** the five observable outcomes — a capability gap, an adapter refusal with zero requests, no response, a read's explicit 404, and any other status or undecodable success — **when** each is presented, **then** the classification is total and deterministic in the declared order, the read 404 stays the read-scoped not-found identity outside the taxonomy, a write's 404 stays `tracker.payload.invalid`, and no new identity or error-table row appears. | F-2, DM-3, NFR-3 |
| AC-F2-9 | **Given** the capability-unsupported class, **when** it is proven, **then** it is proven structurally by the coverage gates plus the runtime declared-gap encounter rule, with no fixture family and never as an adapter failure. | F-2, DM-3, DM-4 |
| AC-F2-10 | **Given** any adapter and any of the six families, **when** its accounting is inspected, **then** it is exactly one of `covered` (with at least one resolvable fixture for a declared operation, plus the catalog entries that prove it), `gap-backed` (with that exact declared gap reason), or `recorded-difference` (referencing a `failure-classification` register entry); no family holds both a fixture and a gap posture, and an unaccounted family fails the gate naming adapter and family. | F-2, DM-4, NFR-4 |
| AC-F2-11 | **Given** the trap catalogs, **when** validated, **then** every entry keeps exactly four fields, every fixture reference resolves, every family reference names an existing entry, and catalog-to-family and family-to-catalog coverage is bidirectional with no orphan assertion. | F-2, DM-4, NFR-4 |

### 17.3 Simulated stateful tracker double (F-3)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** a declared scenario with an initial state and an ordered write-then-read sequence, **when** replayed through the registered client factory and the declared tenant extension, **then** the read observes the state the declared effect produced, and no flow, step id, assertion family, step count, or registration changes to accommodate it. | F-3, API-3, API-4, DM-5, NFR-1 |
| AC-F3-2 | **Given** the same declared scenario and the same ordered request sequence replayed twice, **when** the results are compared, **then** the canonicalized state is identical, the normalized reads are identical, and the reported results and their ordering are identical. | F-3, DM-5, NFR-1, NFR-5 |
| AC-F3-3 | **Given** an undeclared request, an undeclared effect, or a declared effect naming a missing resource, **when** the request is sent, **then** the double fails closed naming method, URL, and effect, and never returns a silent no-op and never falls back to a live call. | F-3, DM-5, NFR-5 |
| AC-F3-4 | **Given** the mock tier with double-backed flows, **when** the suite runs, **then** the network guard and the child-process guard both observe zero calls across the whole run. | F-3, NFR-1 |
| AC-F3-5 | **Given** the committed stateless tenants, **when** replayed after the change, **then** their projections, step order, skip kinds, skip reasons, and diagnostics are identical to the delivered behavior, because absence of declared state and effects means the delivered stateless replay. | F-3, DM-5, NFR-8 |
| AC-F3-6 | **Given** the testkit source, **when** scanned, **then** the double imports no `node:*` or `bun:*` module and reads no ambient environment, clock, or randomness, and all fixture loading plus both guards remain outside the testkit package. | F-3, NFR-7 |
| AC-F3-7 | **Given** the double's declared shape, **when** a tenant declares an effect outside the five-effect vocabulary, more than one effect on one route, an effect whose declared operands do not resolve, or a created-entry identity with no declared sequence, **then** decoding or the request fails naming the offending declaration. | F-3, DM-5, NFR-5 |

### 17.4 Registration-only extensibility (F-4)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** the participation contract, **when** inspected, **then** exactly five supplied items are declared — a contract drawn from the closed operation set, one registration, one matrix column, one tenant fixture set, and one trap catalog — and no sixth lifecycle, port, phase, or runner artifact is required. | F-4, API-5, DM-6, NFR-10 |
| AC-F4-2 | **Given** a conformance-only control adapter injected through the delivered adapter list, **when** the suite runs, **then** it produces a passing run with a complete matrix column consistent with its capability declaration and full family accounting, the run is impossible without the delivered participation seam, and no lifecycle, port, flow-registry, coverage, runner, or artifact module is edited as part of adding the control. | F-4, DM-6, NFR-10 |
| AC-F4-3 | **Given** the shipped conformance registry, **when** inspected, **then** exactly the three shipped provider contracts are registered, the control adapter is absent, and a registration that names no declared provider contract is still rejected by name. | F-4, DM-6 |
| AC-F4-4 | **Given** the provider-identity-free bound set — flow registry, coverage gates, artifact, harness registry, parity engine, taxonomy table, and double — **when** scanned, **then** zero adapter identity literals occur; identity occurs only in the enumerated permitted homes (registration list, matrix column keys, provider fixtures, provider-tagged addressing types and derived read-failure union, addressing decode, and the one pinned runner exception), and a literal appearing outside that exact allowlist fails the scan naming file and construct. | F-4, DM-6, NFR-10 |
| AC-F4-5 | **Given** a candidate adapter that would require an operation outside the closed set, a lifecycle phase hook, or a per-adapter runner branch, **when** registration is attempted, **then** the gate refuses naming the unsupported requirement, and the closed operation set and the lifecycle contract remain unchanged. | F-4, DM-6, NFR-8 |

### 17.5 Gate integration and diagnostics (F-5)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** the repository's CI configuration, **when** the change lands, **then** the parity gate and the double-backed flows execute inside the existing TypeScript test job through the existing aggregate test path, zero workflow files change, no job, trigger, permission, or upload is added, and both the workflow contract test and the CI topology check pass. | F-5, NFR-6 |
| AC-F5-2 | **Given** any gate failure, **when** it is reported, **then** the violation names the provider, the operation, and the failing clause, carries a fixture or evidence reference, keeps detail within the declared bound, uses scalar expected/received values only, and contains no credential material. | F-5, NFR-11, NFR-9 |
| AC-F5-3 | **Given** two consecutive runs of the gate and the double-backed flows, **when** their outputs are compared, **then** the violation set and its ordering are identical. | F-5, NFR-1, NFR-2 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered as one change on its own branch, targeting the tooling integration branch; merge authority stays outside this change.
- Sequenced by outcome so each declaration lands with the evidence that proves it: the taxonomy and family vocabulary first (they are inputs to fixture authoring), then the parity matrix and gate, then the double and its scenarios, then the participation contract and the synthetic proof, then the documentation reconciliation.
- No feature flag is required. The gate is additive evidence in the existing test path, no runtime behavior changes, and no operator-facing surface moves. A repository that needs to land an adapter quickly still must declare its matrix column and family accounting — that is the intended cost of the property.
- Decision records TDR-0036 through TDR-0039 are authored as `Proposed` and cited, not duplicated; their index entries update with this change, and the human owner accepts them at review.
- Release impact is none in product terms: the testkit package is private and dev-only, no shipped command, contract, error identity, artifact, or workflow changes, and the version impact is recorded as `none` for exactly that reason.
- Communication is internal to the adapter and conformance owners. Reviewers should read the difference register as adjudicated data, not as a defect list.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

Not applicable. No persisted-state schema, record kind, or migration is introduced. The matrix, the register, the taxonomy, the family accounting, the reference designation, and the double's scenario data are declared source data and committed fixtures, not persisted project state. Existing tenants are not migrated: the tenant extension is optional, and its absence preserves the delivered behavior.

## 20. PRIVACY / COMPLIANCE REVIEW

- No personal data is introduced. New fixtures are synthetic, sanitized, example-only, and carry provenance; the committed sanitization audit and the planted-secret canary remain binding.
- Failure diagnostics carry provider-neutral scalar values and an evidence reference, never provider-native payloads, never resolved credential material, and never free-text provider prose beyond the bounded detail.
- The double holds only declared synthetic state; it never contains a live capture, a credential, or a real provider identity.
- No telemetry is added, so no new personal-data flow exists.
- No cloud service, hosted product, or vendor-specific naming is added.
- The change adds no secret-read allowlist entry; the credential boundary is untouched.

## 21. SECURITY REVIEW HIGHLIGHTS

- **No new I/O edge.** The double is in-memory and runtime-neutral; it adds no network, process, filesystem, environment, clock, or randomness dependency. The two delivered offline guards remain the enforcement, and the change asserts zero calls on both.
- **Fail closed, not silent.** An undeclared request, effect, or resource fails by name. A parity gap fails the gate. A family with no accounting fails the gate. Silent degradation is the primary failure mode this change exists to remove.
- **No second error system.** The tracker class vocabulary cannot become an emitted identity: the four literals exist in exactly one declaration module and are never returned as a failure code, a status, or a projection; the error table is unchanged; diagnostics carry the delivered identity plus its structured discriminator; and any other `tracker.`-prefixed literal in the testkit or adapters source trees fails the scan.
- **Difference adjudication is auditable.** Every recorded difference carries a class, a rationale, evidence, and an adjudication reference, and stale evidence fails. This prevents "declared" from becoming a way to hide a security-relevant classification change such as treating a rejected credential as a payload fault.
- **Secret hygiene.** The gate and the double never read ambient configuration and never emit credential material; the existing allowlist keeps exactly its delivered entries.
- **Fixture integrity.** Provider shapes remain synthetic and sanitized; no new host, credential, or personal identifier is committed.
- **Topology integrity.** The gate cannot be bypassed by adding a job or relaxing a trigger, because no workflow change is permitted and the topology contract test enforces the pinned set.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **New ongoing declared surfaces**: the parity matrix, the difference register, the taxonomy table, the family accounting, the reference designation, and the double's five-effect vocabulary and declared shape. Each is data or documentation, so a change is reviewable without discovering a convention.
- **Adding an adapter** now has a fixed, declared cost: the five participation items — one of which is the matrix column — plus the per-family accounting. That cost is the property the milestone asks for, and it replaces per-adapter test conventions.
- **Evolving an adapter** is visible: a behavior change either stays `same-as-reference`, or needs a register entry with evidence and adjudication, or fails the gate. A reviewer no longer has to infer divergence from two reports.
- **A difference becomes obsolete** when the adapters converge; the gate then fails the stale entry by name, so the register self-cleans rather than accreting.
- **No new operational surface**: no new command, job, artifact, alert, or configuration key. On-call sees an ordinary test failure with a named violation.
- **Cost**: the added checks are in-process and bounded; they add no CI minutes beyond the existing test job and no process spawns.
- **Coexistence**: the provider trap suites remain where they are and keep their four-field catalogs; the conformance-level family accounting references them rather than duplicating them.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Parity matrix | Declared data stating, per closed operation and registered adapter, whether the adapter behaves as the reference, carries a declared gap, or carries an adjudicated difference. |
| Reference adapter | The adapter whose behavior is the parity bar for the milestone; its column carries no differences. |
| Declared difference | A recorded, adjudicated divergence between an adapter and the reference on one operation and one dimension, backed by evidence. |
| Difference class | One of the closed labels a declared difference must carry: identity scheme, pipeline model, state vocabulary, pagination model, carrier absence, or failure classification. |
| Difference register | The committed set of declared differences, each with class, rationale, evidence, and adjudication reference. |
| Tracker error taxonomy | The four-class conformance vocabulary that maps a tracker failure stimulus onto one delivered structured identity and its discriminator. |
| Trap family | One of the six closed stimulus groups the taxonomy proves: `auth-shape`, `transport-failure`, `rate-limit`, `payload-shape`, `workflow-state-mismatch`, and `pagination-truncation` (the last a bounded-observation assertion, not an error class). |
| Family accounting | The per-adapter statement that a trap family is covered by fixtures, gap-backed by a declared gap, or recorded as a difference. |
| Simulated tracker double | A deterministic in-memory transport that applies declared effects to declared state so a later read observes an earlier write, offline. |
| Declared effect | One entry from the closed vocabulary describing how a matched route changes the double's state. |
| Registration-only participation | The property that a new adapter is added by supplying a fixed declared set of items and requires no lifecycle, port, flow, coverage, runner, or artifact change. |
| Synthetic registration | A conformance-only control adapter injected through the adapter list to prove registration-only participation; never a shipped registration. |
| Parity gate | The check that compares matrix, capability declaration, register, and observed conformance outcome and fails on any undeclared difference. |
| Capability gap | An adapter's explicit `{ operation, reason }` statement that it does not support an operation; parity is never implied. |
| Violation | One deterministic, ordered gate failure naming provider, operation, and clause with bounded detail and an evidence reference. |

## 24. APPENDICES

### 24.1 Appendix A — Phase-7 documentation impacts

| Document | Required reconciliation |
|----------|-------------------------|
| `doc/spec/features/feature-adapter-conformance.md` | Add the parity matrix and its gate (reference designation, cell vocabulary, difference classes, register, three-way consistency, bidirectional coverage), the tracker taxonomy and family accounting, the simulated double and its declared state/five-effect contract with the stateless default preserved, the registration-only participation contract with both proofs and the enumerated provider-identity allowlist (including the pinned runner derivation), the diagnostics and ordering guarantees, and the unchanged CI-topology and artifact statements. |
| `doc/spec/features/feature-provider-client-seeds.md` | Record that the trap catalogs now feed conformance-level family accounting while keeping their four-field shape; state that delivered adapter divergences are adjudicated in the parity register rather than silently normalized. No capability posture changes. |
| `doc/spec/features/feature-adapter-reference-behavior.md` | State that the reference behavior is the parity bar and name the matrix and register as the machine-readable record of where an adapter deliberately differs; keep every delivered value unchanged. |
| `doc/spec/features/feature-adapter-ports.md` | Confirm no port, operation, capability flag, or carrier change; note that parity is proven at the primitive boundary the ports define. |
| `doc/spec/features/feature-result-contract.md` | Confirm no row, domain kind, projection class, or exit change; record that the tracker class vocabulary is conformance-only and never an emitted identity. |
| `doc/overview/glossary.md` and the documentation index | Add the new terms (parity matrix, declared difference, trap family, simulated double, registration-only participation) and index the updated conformance page. |
| Decision index | Add TDR-0036, TDR-0037, TDR-0038, and TDR-0039 entries. |
| Help/reference coverage | Checked: no prompt-required command is added or changed, so help coverage is unaffected. |

### 24.2 Appendix B — Ticket-to-spec traceability

| Ticket element | Where satisfied |
|---|---|
| "extend the adapter conformance suite (M0-S20) to the tracker primitives" | F-1 (parity across all nine operations, including the tracker primitives) and F-2 (tracker error classes and families); AC-F1-*, AC-F2-*; the delivered nine-operation registry is extended in meaning, not in size |
| "typed error taxonomy and trap catalogs per adapter" | F-2; AC-F2-1…AC-F2-11; DEC-2 |
| "simulated tracker double for offline CI" | F-3; AC-F3-1…AC-F3-7; DEC-3 |
| "parity matrix gate in CI" | F-1 and F-5; AC-F1-*, AC-F5-*; DEC-1, DEC-5 |
| AC: "the suite fails on undeclared behavior differences" | F-1 (three-way consistency, register, closed classes, stale-evidence failure); AC-F1-4…AC-F1-7 |
| AC: "new adapters plug in without lifecycle changes" | F-4; AC-F4-1…AC-F4-5; DEC-4 |
| "Depends on: M0-S20" | Section 2.1 and section 13; the delivered suite is extended, never replaced |
| Milestone EC-4 (parity, error taxonomy, trap catalogs, offline double) | F-1, F-2, F-3; section 4.1 metrics |

### 24.3 Appendix C — Deliberate non-decisions (binding on the plan)

These are recorded so delivery planning cannot widen them silently:

1. No adapter is completed or changed: no operation, capability flag, gap record, normalized-view field, or provider behavior moves for GitHub, GitLab, or Jira.
2. No closed operation is added, removed, renamed, or retyped; the nine-operation set is the universe of parity.
3. No failure identity, error-table row, domain kind, projection class, or exit code is added; the tracker class vocabulary is conformance-only and is never emitted.
4. The `delivery.conformance.v1` schema, field set, closed statuses, skip kinds, and bounds are unchanged, and parity is not serialized into the artifact.
5. No workflow file, job, trigger, permission, or upload changes; the live tier stays read-only and outside the gate.
6. The flows, step ids, step count, assertion families, carrier behavior, and skip-kind vocabulary are unchanged; the double is additional evidence, not a new flow.
7. Trap-catalog entries stay exactly four fields; the family mapping references entries and does not extend them.
8. The shipped conformance registry stays exactly the three shipped provider contracts; the synthetic control adapter is injected only.
9. Testkit stays runtime-neutral; fixture loading, the process environment read, native fetch, the child-process substitution, and artifact writing stay under `tests/`.
10. No CLI command, report, rendered surface, or operator configuration is introduced for parity.
11. The provider trap suites are neither migrated onto the conformance suite nor retired in this change.
12. The initial adjudication records real delivered differences instead of converging them; convergence is adapter completion and out of scope.
13. The tracker error class set (four ids) and the trap-family set (six, including the pagination bounded-observation family) are closed and grow only by a recorded extension; no class id becomes an emitted identity, and no family is added to cover a fixture gap.
14. The delivered runner's addressing-derived expected entity identity is recorded as the single pinned engine exception to the provider-identity-free invariant; it is not fixed, generalized, or moved into declared tenant data here, and the allowlist does not grow for anything else.

### 24.4 Appendix D — Fixture-decided and implementation-decided details

The following are explicitly left to fixtures and implementation and do not reopen any decision, class, shape, bound, or scope: the exact payload shape of each trap-family stimulus per provider; which operation each family exercises per adapter (constrained only by what the adapter declares supported); the exact operand names and values each declared effect carries per tenant; the exact response projection each double-backed route returns; the exact wording of a violation detail beyond its required named elements; and the precise serialized form each declared effect and declared initial state take.

Two items are **not** fixture-decided: whether a difference is recorded (that is an adjudication recorded in the register, not a fixture convenience), and whether a family is accounted for (that is a gate requirement, never a fixture omission).

Also not fixture-decided: whether an adapter's payload failures carry a structured status. That is delivered code — the GitHub slice supplies it on a non-2xx payload failure, the GitLab and Jira slices do not — so a fixture or an expectation cannot assume a status-bearing classification where the adapter cannot produce one.

Whether the five declared effects cover every delivered write member's observable landing — in particular the provider-supplied landing identity — is settled during delivery with evidence. If one operation needs a sixth effect, it is a recorded extension with its own fixture, never an implicit effect and never a URL-shape inference.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-18 | @spec-writer | Initial specification for GH-339, grounded in the M3 blueprint (README, contracts, answered open questions), the GH-339 planning notes, the delivered M0-S20 conformance suite and its current-truth specifications, and decision records TDR-0036 through TDR-0039. |
| 1.1 | 2026-11-18 | @spec-writer | Specification-phase remediation raised by test planning. Added the status-absence escape to AC-F2-2 and AC-F2-3 — an adapter whose delivered payload failures carry no `httpStatus` carries a recorded `failure-classification` difference instead of an unreachable status-bearing class — and stated the delivered asymmetry (GitHub supplies `httpStatus` on a non-2xx payload failure; GitLab and Jira do not) in F-2 and DM-3, carried through DM-4, NFR-3, §8.5, §24.4 and the glossary. Applied the identical escape to AC-F2-5, whose payload-shape family is unreachable on the same status-less adapters, so the document is not self-contradictory against DM-3. Aligned the family id to `auth-shape` per TDR-0037. No requirement, AC count (34), or decision (DEC-1…DEC-6) changed. |

---

## AUTHORING GUIDELINES

- **Sources.** The M3 blueprint (`doc/planning/oss-tooling/milestones/m3/`), the GH-339 planning notes (scope, current-state facts, gap analysis, milestone, applied decisions), the ticket body and acceptance criteria, the delivered conformance suite and its current-truth specifications, and the four decision records authored on this branch (TDR-0036 through TDR-0039). No behavior is invented; details the records leave open are listed as fixture-decided or implementation-decided in Appendix D.
- **Approach.** The spec is organized around outcomes rather than implementation: capabilities state behavior and rationale, interfaces state contracts, and acceptance criteria are mechanically checkable and non-overlapping. The parity matrix, register, taxonomy, family accounting, and participation contract are treated as declared data because the ticket's acceptance clauses are about provable properties.
- **Constraints applied.** Additive-within-v1 discipline; no new closed operation, error identity, artifact field, or CI job; testkit runtime-neutrality; offline determinism with both network and child-process containment; exact pinned structural surfaces; no cloud or hosted-product naming.
- **Deliberate omissions.** No code file paths, no step-by-step implementation tasks, no merge or commit instructions, and no technology tuning beyond what the outcomes require.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (`GH-339`)
- [x] `owners` has at least one entry (`engineering`)
- [x] `status` is `Proposed`
- [x] `change.milestone` is the tracker milestone title verbatim and equals the planning-notes milestone (`M3: Harness and tracker integrations`)
- [x] All sections present in order (1–25 + authoring guidelines + checklist)
- [x] ID prefixes consistent and unique (`F-`, `API-`, `DM-`, `NFR-`, `AC-`, `RSK-`, `DEC-`)
- [x] Acceptance criteria reference at least one `F-`/`API-`/`DM-`/`NFR-` ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact and Probability with mitigation and residual risk
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] Out-of-scope items are prefixed `[OUT]`
- [x] Open questions are empty and every routed question is settled by a cited decision
- [x] Deliberate non-decisions are recorded and binding on the plan
