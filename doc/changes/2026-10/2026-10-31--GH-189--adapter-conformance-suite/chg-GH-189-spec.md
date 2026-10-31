---
change:
  ref: GH-189
  type: test
  status: Proposed
  slug: adapter-conformance-suite
  title: "M0-S20: Adapter conformance suite v1"
  owners: [engineering]
  service: delivery-os provider adapters
  labels: [change, planning]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: medium
  dependencies:
    internal: [provider client seeds (GH-188), primitive ports and credential port (GH-181), monorepo scaffold (GH-170), result contract (GH-172), testkit, CI topology]
    external: [GitHub API, GitLab API, Jira API]
links:
  decisions: ["ADR-0003", "ADR-0005"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Deliver the provider-agnostic conformance flow suite that proves the same primitives — change lifecycle, comment provenance, and label semantics — against every shipped provider adapter, runs deterministically on mock tenants inside the existing CI test path, records read-only scheduled live evidence as a versioned artifact, and makes an adapter change that breaks a covered flow fail CI.

## 1. SUMMARY

Deliver the M0-S20 adapter conformance suite in the private testkit package. One flow registry, written against the primitive ports, is executed against the three shipped provider adapter contracts (GitHub, GitLab, Jira) with capability-gated steps: a supported `ADAPTER_OPERATIONS` operation runs against a deterministic mock tenant and is asserted at the primitive boundary; an unsupported operation records an explicit skip carrying the adapter's declared gap reason. Structural and runtime coverage gates fail on a supported-but-uncovered operation, a declared gap that is never encountered, a new provider adapter contract that is not registered, or a declared carrier that is never exercised.

The mock tier runs inside the existing `pnpm test` path — therefore inside the existing `ts-test` and `ts-aggregate` CI jobs — with zero live network calls. The live tier is scheduled read-only evidence, not a merge gate: weekly and on demand, it runs the same read steps and primitive assertions against configured scratch GitHub/GitLab tenants and a Jira sandbox, records a versioned machine-readable result artifact with `passed`, `failed`, or `not-configured`, uploads that artifact, and asserts zero mutation requests and zero created artifacts in v1. A deliberately broken adapter control proves the suite fails by provider, flow, and step name.

## 2. CONTEXT

### 2.1 Current State Snapshot

The three provider client seeds delivered by GH-188 are current truth: GitHub (`adapters ./github`), GitLab (`adapters ./gitlab`), and Jira (`adapters ./jira`) implement behind the primitive ports and expose real `AdapterContract` declarations. All three are read slices. Jira supports `read-work-item`; GitLab supports `read-delivery-request` and `read-pipeline-run`; GitHub supports `read-work-item`, `read-delivery-request`, and `read-pipeline-run`. Every unsupported operation is an explicit declared gap with a closed reason. No adapter declares a metadata carrier.

The seeds already ship trap catalogs: named, four-field data entries replayed offline against sanitized hand-authored fixtures through the production clients with an injected transport. The trap harness is unit-level per provider, not a cross-provider primitive flow suite. The testkit package is private and dev-only; its current conformance content is the result-envelope validator. The testkit boundary admits imports from `core` (`.` and `./contracts`) and every declared adapters subpath, and it forbids `node:*` runtime imports in testkit source. The secret-read boundary scans every `packages/<pkg>/src/**` production source and currently holds exactly four allowlist entries.

CI topology is pinned. `tests/checks/ci-checks.test.ts` asserts the exact bash and TypeScript job sets, and `scripts/checks/ci-topology.ts` rejects removals from `ci.yml` while requiring every `scripts/checks/*.ts` to be wired. The `ts-test` and `ts-aggregate` jobs both execute the workspace test battery. Scanner scope is layered: `ci-supply-chain` and `ci-bindingness` are `ci.yml`-scoped, while repository-wide structure invariants scan every `.github/workflows/*.yml`. The scheduled-workflow area has no conformance workflow: there is no live conformance run and no live result artifact.

ADR-0003 requires a provider-agnostic conformance suite in testkit that runs against every adapter, with a new adapter needing the suite, a trap catalog, and secrets-free mock fixtures; a live `e2e` run is additional evidence, not the gate. The concept document `doc/planning/concepts/adapter-conformance.md` names the v1 flow families and the mock/live tiers. The M0-S20 story fixes the v1 scope: change lifecycle, comment provenance roundtrip, and label semantics, with mock tenants in CI plus scheduled live runs and strict teardown. M0-S19 (GH-188) is delivered, so the story's dependency is satisfied.

### 2.2 Pain Points / Gaps

- Adapter changes are currently gated by trap-catalog unit tests and review vigilance, not by end-to-end primitive flows. A trap can pass while a full read path still returns a semantically wrong primitive view.
- There is no single place that proves every shipped adapter responds to the same primitive flow in the same vocabulary. Adapter-specific test code and fixture setup can drift without any gate noticing.
- Capability gaps are declared honestly but are not exercised as exits: nothing currently fails when a supported operation has no flow, or when a declared gap has silently become stale.
- A new provider adapter contract can appear without conformance registration; review is the only detection.
- There is no scheduled live evidence that provider response shapes still normalize correctly; fixture drift is detected only when a downstream delivery breaks.
- A live run today would have no safe shape: no read-only guarantee, no zero-mutation proof, no bounded artifact, and no clean not-configured behavior before tenants exist.
- There is no machine-readable conformance result that a maintainer or a future automation can consume without reading test logs.
- **Affected users:** provider adapter maintainers; the status, verify-change, closeout, and full-adapter authors who consume provider facts; PR reviewers who currently carry adapter behavior in their heads; operators relying on scheduled evidence; security reviewers responsible for credential centralization and fixture hygiene.
- **Business impact:** the adapter layer is the input surface for every downstream engine. A conformance suite that is absent, vacuous, or falsely green converts provider behavior into untrustworthy input for the whole delivery loop; a suite that is offline, capability-honest, and non-vacuous makes adapter changes safe to review and gives the later write adapters a gate to satisfy.

## 3. PROBLEM STATEMENT

Because the repository has no provider-agnostic primitive flow suite, every adapter change is gated by per-provider trap tests and human review rather than by observable end-to-end behavior, so a change can preserve unit expectations while breaking the change-lifecycle, comment-provenance, or label-semantics contract; and because there is no read-only scheduled live evidence, provider-shape drift surfaces only when a delivery depends on it. This change delivers the conformance flow suite, its mock tenants, its coverage gates, and a bounded read-only live evidence tier, so every shipped adapter is gated by the same primitive behavior and adapter changes that break a flow fail CI.

## 4. GOALS

- **G-1**: Define one provider-agnostic conformance flow registry in testkit covering the three v1 flow families: change lifecycle, comment provenance roundtrip, and label semantics.
- **G-2**: Execute every step according to the adapter's declared capabilities: supported operations run against a mock tenant with primitive-level assertions; unsupported operations record an explicit skip carrying the declared gap reason.
- **G-3**: Register the three shipped provider adapters (GitHub, GitLab, Jira) in a conformance adapter registry, with a structural gate that fails when a new provider `*_ADAPTER_CONTRACT` source exists without registration.
- **G-4**: Provide deterministic, declarative mock tenants — exact URL to payload — replayed through the production clients with zero live network calls and a throwing-fetch guard.
- **G-5**: Provide structural and runtime coverage gates: every closed operation appears in at least one flow step; every supported operation executes at least one step; every declared gap is encountered; every declared carrier is exercised or the adapter declares none; the suite is non-vacuous.
- **G-6**: Run the mock conformance suite inside the existing `pnpm test` path so `ts-test` and `ts-aggregate` gate adapter changes, without adding a `ci.yml` job.
- **G-7**: Provide a scheduled read-only live tier (weekly plus `workflow_dispatch`) against configured scratch tenants, with the same flows and primitive assertions and a versioned result artifact.
- **G-8**: Prove strict teardown for v1 as zero mutation requests and zero created artifacts, with write-flow create/teardown explicitly deferred to M1-S4.
- **G-9**: Preserve the security and boundary posture: no secret material in fixtures or artifacts, no ambient secret reads in `packages/*/src`, no new secret-read allowlist entry, no `node:*` import in testkit source, and no live tenant configuration inside production packages.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Shipped provider adapters registered and green in the mock suite | 3/3 (GitHub, GitLab, Jira) |
| Closed `ADAPTER_OPERATIONS` represented in the flow registry | 7/7 |
| Supported operations executing at least one mock step per adapter | 100% |
| Declared gaps encountered by at least one gated step per adapter | 100% |
| Declared metadata carriers exercised, or adapter declares none | 100% |
| Live network calls during the mock suite | 0 |
| Repeated mock runs producing identical step outcomes and order | 100% |
| Deliberately broken adapter control failing by provider/flow/step | 1/1 |
| New `ci.yml` jobs added for conformance | 0; `ci.yml` byte-unchanged |
| Scheduled or dispatched live runs recording a result artifact | 100% |
| Live v1 mutation requests and created artifacts | 0 and 0 |
| Secret-read boundary allowlist entries after the change | Exactly 4 (0 growth) |
| Ambient environment reads in `packages/*/src` outside the allowlist | 0 |
| Sanitization findings in committed conformance fixtures | 0 |
| Mock suite wall-clock budget on CI | ≤ 60 s |
| Live run wall-clock budget per invocation | ≤ 10 min |

### 4.2 Non-Goals

- **NG-1**: No full write conformance, merge flow, deploy-trace flow, or pipeline-flow expansion — those join the suite in M1-S4.
- **NG-2**: No provider write adapters and no full GitHub adapter — write operations remain declared gaps until M0-S14 and M3-S3.
- **NG-3**: No core-contract change. The suite consumes the existing `WorkItem`, `DeliveryRequest`, `PipelineRun`, `AdapterContract`, and `ADAPTER_OPERATIONS` contracts.
- **NG-4**: No new `ci.yml` job, no weakening of `tests/checks/ci-checks.test.ts`, and no removals from the pinned CI topology.
- **NG-5**: The live tier is not a merge gate, and a failed scheduled live run does not auto-create a tracker ticket in v1.
- **NG-6**: No tenant-provisioning automation; tenants remain manually provisioned sandboxes, and the run records `not-configured` until their documented settings exist.
- **NG-7**: No conformance coverage for placeholder `azure`/`ci` subpaths or non-provider I/O adapters; provider-primitive flows apply only to adapters with a real provider `AdapterContract`.
- **NG-8**: No secrets, credentials, live tenant identifiers, or personal data in committed fixtures or result artifacts; no new dependencies and no secret-read allowlist growth.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Provider-agnostic flow registry with three v1 flows and a typed step model | Flows are written once against the primitive ports; adapter-specific code is limited to registry wiring and mock tenant data. |
| F-2 | Capability-gated execution with explicit declared-gap skips | Honest behavior for read-only M0 adapters: supported operations execute; unsupported operations are visible skips, never invented parity. |
| F-3 | Adapter registry for GitHub, GitLab, and Jira with a registration coverage gate | Every shipped provider contract is exercised; a new contract without registration fails structurally. |
| F-4 | Deterministic declarative mock tenants replayed through production clients | Fast, offline, reproducible flow evidence with zero live network and no provider SDK. |
| F-5 | Structural and runtime coverage gates | The suite cannot pass vacuously, silently lose an operation, or keep a stale declared gap. |
| F-6 | Mock conformance inside the existing `pnpm test` path | Adapter changes are gated by the existing `ts-test`/`ts-aggregate` jobs without changing CI topology. |
| F-7 | Scheduled read-only live evidence tier | Provider-shape drift is detected before a delivery depends on it, while ADR-0003 keeps live evidence out of the merge gate. |
| F-8 | Versioned machine-readable result artifact | Scheduled evidence is inspectable by humans and usable by future automation without parsing logs. |
| F-9 | No-mutation and strict-teardown proof for v1 | Live runs cannot silently mutate a provider; write create/teardown is explicitly deferred. |
| F-10 | Failure diagnostics and a deliberately broken adapter control | A conformance failure names provider, flow, step, operation, and assertion, so the suite is actionable and non-vacuous. |

### 5.1 Capability Details

- **F-1**: The suite lives in `@delivery-os/testkit`. The v1 flow registry has exactly three flows: `change-lifecycle`, `comment-provenance`, and `label-semantics`. Each flow is an ordered set of steps. A step carries a stable id, the `ADAPTER_OPERATIONS` operation it proves, the primitive assertion family it applies, and optional carrier requirements. Flow and step ids are data, stable across provider adapters, and are the names used in failures and in the result artifact. The change-lifecycle flow carries the read steps for `read-work-item`, `read-delivery-request`, and `read-pipeline-run` and the gated write steps for `write-work-item`, `transition-work-item`, `write-delivery-request`, and `write-comment`. The comment-provenance flow carries the comment read half and the carrier roundtrip step. The label-semantics flow carries label reads plus replace and sweep write steps. Together the registry represents all seven closed `ADAPTER_OPERATIONS` at least once. This is the smallest registry that satisfies the ticket's three named flow families and D2's operation coverage; merge, deploy-trace, and dedicated transition-mapping flows are deferred to M1-S4.

- **F-2**: Execution is capability-gated per adapter. For a step whose operation is in the adapter's `supportedOperations`, the suite executes the step against the adapter's mock tenant and applies the step's primitive assertions. For a step whose operation is not supported, the suite records an explicit skip carrying the adapter's declared gap reason for that operation. An operation absent from `supportedOperations` must have a matching `declaredGaps` record; an undeclared unsupported operation fails the suite rather than producing an anonymous skip. A supported operation with no executing step in mock mode, or a declared gap whose operation is never encountered by a step, fails the suite. A carrier step executes only when the adapter declares a carrier; an adapter with no declared carrier records a declared-gap skip when its write-comment operation is unsupported, or a `no-declared-carrier` capability skip when write-comment is supported but both carrier arrays are empty. Skips are green outcomes only when they are declared or capability-absent as above; they are never silent passes.

- **F-3**: The adapter registry contains exactly the shipped provider adapters with real `AdapterContract`s: GitHub, GitLab, and Jira. Each registration binds the adapter name, the imported contract, a client builder that accepts the conformance tenant (instance, credential port, injected transport, addressing), and the addressing needed by the flows. The registry is the single source of adapter participants. A structural gate scans the adapters package for exported `*_ADAPTER_CONTRACT` bindings and fails when a provider contract source exists without a registration, or when a registration names no matching contract. Placeholder `azure`/`ci` subpaths and non-provider I/O subpaths are not registrations because they expose no provider `AdapterContract`.

- **F-4**: A mock tenant is declarative data for one provider: a provider-native-example instance, the credential reference name, the addressing data the flows need, and an ordered route table from exact request URL to response status and body, plus the expected normalized primitive projection for each executed read step. Replay goes through the production client factories with an injected transport; no test reimplements provider access. The route table is exact-match and unfixtured requests fail. Mock fixture hosts use example-only hosts, fixture provenance is declared, and no live tenant, token, personal datum, or private identifier is present. The mock tier installs a throwing-`fetch` guard for the duration of flow execution and asserts zero calls, so the fixture transport is the only provider input path. The same mock data is replayed twice and must produce identical step outcomes, order, and failures.

- **F-5**: Coverage gates run at two levels. The structural gate proves the flow registry is non-empty and complete: unique flow and step ids; every step operation is in the closed operation set; every closed operation appears in at least one step; every adapter's supported operations and declared gaps each have at least one step; every adapter declaring a carrier has a carrier step; no provider contract is unregistered. The runtime gate proves execution is non-vacuous per adapter: at least one step executed, every supported operation executed at least one step, every declared gap encountered at least once with the declared reason, every declared carrier exercised through a carrier roundtrip, and no executed step returned a non-primitive failure classified as success. Coverage failures name the provider, flow, step, and operation.

- **F-6**: The mock conformance suite is a TypeScript test under `tests/conformance`. It is discovered by `bun test` (and therefore by `pnpm test`) and runs in the existing `ts-test` and `ts-aggregate` jobs. No new `ci.yml` job is added, no job is removed, and the pinned topology and bindingness checks stay unchanged. A change that breaks a covered adapter flow fails `pnpm test`, which fails the existing CI jobs. This is the mechanism that satisfies the ticket's "an adapter change that breaks a flow fails CI" without weakening the topology invariant.

- **F-7**: The live tier runs the same flow registry and the same primitive invariant assertions against configured scratch GitHub and GitLab tenants and a Jira sandbox. It uses a native-fetch transport wrapped by a recording transport and the process credential port; the flow registry, assertion code, clock, run id, and artifact writer are injected, so the live entrypoint is a composition edge, not a fork of the suite. Live v1 executes read steps only. An unsupported non-read step still records its declared-gap skip; a supported non-read step is recorded as a `live-read-only` deferral; the mock tier remains the capability gate for supported operations. Every live run records a result artifact. A scheduled live failure does not create a tracker ticket in v1: the failing workflow run plus its uploaded artifact are the signal.

- **F-8**: The result artifact is versioned as `delivery.conformance.v1` and is machine-readable JSON. It carries the run id, tier (`mock` or `live`), the injected generation time, overall status (`passed`, `failed`, or `not-configured`), one provider result per configured or not-configured provider, one flow result per executed flow, one step result per step with `executed`/`skipped`/`failed`, skip reasons, assertion counts, bounded failure diagnostics, and mutation counters. It never contains raw provider payloads, authorization headers, credential material, live tenant tokens, or personal data. The artifact is bounded in size and provider/flow/step counts. Mock conformance uses the same report shape in memory; the live entrypoint persists it.

- **F-9**: Strict teardown in v1 is a zero-mutation property of the live tier, not a cleanup procedure. The live recording transport captures every request method and URL and fails the run on any non-`GET` request. The live runner also asserts zero created artifacts, since no create operation executes. The artifact records `mutationRequests: 0` and `createdArtifacts: 0`. Write-flow create/teardown, prefix-scoped cleanup, and idempotent re-runs after writes are deferred to M1-S4; for v1 every live run is read-only and therefore idempotent by construction. The mock tier may replay simulated write requests only through the fixture transport; those requests never reach a network and are not a provider mutation.

- **F-10**: Every failure is a first-class diagnostic. A failed step reports provider, flow id, step id, operation, assertion name, expected versus received primitive-level values, and the fixture reference or request descriptor used. Expected/received values are normalized primitive data, never raw payloads or headers. The suite includes a deliberately broken adapter control — a test-only wrapper around a production client that corrupts one normalized outcome — which must fail naming the affected flow and step; the unmodified control passes. This proves the suite is not merely executing steps but asserting their behavior.

## 6. USER & SYSTEM FLOWS

1. **Mock conformance in CI**: `pnpm test` discovers the conformance suite → the adapter registry supplies GitHub, GitLab, and Jira → for each adapter, the runner builds the production client with the mock transport, fake credential port, and mock tenant → each step executes or records a declared-gap skip → primitive assertions run → coverage gates evaluate the report → the suite is green only when every executed step passes and every declared gap is encountered.
2. **Capability-gated skip**: A flow step declares `transition-work-item` → the adapter's `supportedOperations` does not contain it and its `declaredGaps` names a reason → the step records `skipped` with that exact reason → the coverage gate counts the gap as encountered → no provider call is attempted for that step.
3. **Scheduled live evidence**: The scheduled workflow starts → the live entrypoint reads non-secret tenant configuration and credential reference names, resolves token material only through the credential port, builds native-fetch recording transports, executes the read steps with injected clock/run id, writes the `delivery.conformance.v1` artifact, and exits 0 for `passed` or `not-configured`, 1 for `failed` → the workflow uploads the artifact even on failure.
4. **Live not-configured**: The workflow runs before any tenant settings or token source keys exist → each provider is recorded as `not-configured` with the missing variable names → the overall status is `not-configured`, the run exits 0, and the artifact is still uploaded → no false alarm and no merge impact.
5. **Coverage failure**: A new provider `*_ADAPTER_CONTRACT` appears without registration, or a supported operation loses its only step, or a declared gap becomes stale → the structural or runtime gate fails naming the provider and operation → `pnpm test` fails in CI before review can waive it.
6. **Broken adapter control**: A test-only control adapter wraps a production client and corrupts a normalized primitive view → the suite fails naming the provider, flow, and step → the unmodified adapter passes the same flow, proving the assertion is live.
7. **Local operator run**: A maintainer runs the mock suite through the normal test command; optionally sets the documented live tenant variables and runs the live entrypoint locally to produce the same artifact shape as CI.

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The testkit conformance flow registry: change lifecycle, comment provenance, and label semantics, with a typed step model covering all seven closed `ADAPTER_OPERATIONS`.
- Capability-gated execution and explicit declared-gap skips, including the complete-gap-coverage and supported-operation-coverage gates.
- The conformance adapter registry for GitHub, GitLab, and Jira, plus the structural registration gate for provider `*_ADAPTER_CONTRACT` sources.
- Deterministic mock tenants under the existing provider fixture area, with exact URL routes, expected primitive projections, provenance, example-only hosts, and sanitized placeholders.
- Mock conformance tests under `tests/conformance`, wired into the existing `pnpm test` battery and therefore the existing `ts-test`/`ts-aggregate` jobs.
- The versioned `delivery.conformance.v1` report/artifact schema and its validator.
- The scheduled read-only live workflow, its triggers, least-privilege permissions, SHA-pinned actions, secret scoping, artifact upload, and Bun pin.
- The live entrypoint under `tests/` that reads tenant configuration, composes native fetch plus the process credential port, and writes the artifact.
- The no-mutation proof, determinism proof, non-vacuity proof, and deliberately broken adapter control.
- Structural and workflow-contract tests in the existing `tests/structure` and `tests/checks` layers.
- Testkit content-inventory registration and per-file executable allowances for the new testkit modules.
- Documentation synchronization: a new feature specification for adapter conformance and updates to the provider-client-seeds and monorepo feature specifications and glossary.

### 7.2 Out of Scope

- [OUT] Full change-lifecycle write execution (create, plan, transition, comment write, label write, deliver, merge, close out) — the steps exist but remain capability-gated skips until write adapters land.
- [OUT] Merge, deploy-trace, pipeline-trace, and dedicated transition-mapping conformance flows — M1-S4.
- [OUT] Full GitHub adapter and provider write adapters — M3-S3 and M0-S14.
- [OUT] Tenant provisioning automation, scratch-tenant lifecycle management, and secret rotation automation — manual sandbox maintenance remains.
- [OUT] Automatic tracker tickets on scheduled live failure — requires `write-work-item`, which is a declared gap on all shipped adapters.
- [OUT] Conformance for `azure`/`ci` placeholders, the provider registry, or non-provider I/O adapters.
- [OUT] Any new `ci.yml` job, any change to `tests/checks/ci-checks.test.ts`, or any weakening of CI bindingness.
- [OUT] Any core-contract change, new package, new subpath, new dependency, or secret-read allowlist entry.
- [OUT] Live tenant identifiers, tokens, or personal data in committed files or artifacts.

### 7.3 Deferred / Maybe-Later

- Write-flow create/teardown, stable artifact prefixes, and cleanup assertions — M1-S4.
- Merge and deploy-trace flows, pipeline-flow expansion, and comment-omission/pagination edge cases beyond the v1 primitive assertions — M1-S4 and incident-driven additions.
- Automated ticket creation on scheduled live failure — when a write adapter exists and ADR-0003's evidence-only stance is revisited.
- Tenant provisioning automation and cost/rate-budget policy for live runs — open planning questions in the concept document.
- Coverage of additional providers — when their real `AdapterContract` ships, the registration gate forces suite participation.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

No ADOS-owned HTTP surface is delivered. The suite consumes provider HTTP APIs only through the existing provider clients and their injected `ProviderTransport` seam:

| Flow step family | Provider surface consumed | Primitive returned |
|------------------|---------------------------|--------------------|
| Work-item reads | GitHub issue, Jira issue | `WorkItem` |
| Delivery-request reads | GitHub pull request, GitLab merge request | `DeliveryRequest` |
| Pipeline-run reads | GitHub check runs per SHA, GitLab pipelines per SHA | `PipelineRun` set |
| Comment reads | Work-item comment payload where supplied | `WorkItem.comments` presence/absence |
| Label reads | Work-item label payload | `WorkItem.labels` |

The mock tier replaces the transport with exact-URL fixture replay. The live tier uses native `fetch` through a recording transport. The suite never exposes provider-native HTTP shapes, headers, or payloads to assertions or artifacts.

### 8.2 Events / Messages

None. The result artifact is a file, not an event or message schema. No new persisted runtime event, state record, or queue message is introduced. Mock conformance reports are in-memory; live artifacts are written by the test entrypoint.

### 8.3 Data Model Impact

| ID | Element | Contract |
|----|---------|----------|
| DM-1 | Conformance flow definition | Stable flow id, display name, ordered step ids; exactly three v1 flows. Data only. |
| DM-2 | Conformance step | Stable step id, `ADAPTER_OPERATIONS` operation, primitive assertion family, optional carrier requirement; ids unique within the registry. |
| DM-3 | Adapter registration | Provider name, imported `AdapterContract`, client builder over a conformance tenant, and addressing needed by the flows. The registry is the sole participant list. |
| DM-4 | Mock tenant | Provider, example-host instance, credential reference name, addressing, ordered exact-URL routes, expected normalized primitive projections, and `provenance`; no live data. |
| DM-5 | Conformance report | Tier, run id, injected generation time, provider/flow/step outcomes, skip reasons, assertion counts, bounded failure diagnostics, mutation counters, overall status. |
| DM-6 | Live result artifact | `schema: "delivery.conformance.v1"` plus the report, `notConfigured` entries (provider and missing variable names only), and mutation counters; JSON, bounded, secret-free. |
| DM-7 | Live tenant configuration | Non-secret settings (base URLs, seeded ids, addressing) and credential reference names; token material is not part of the configuration model and resolves only through the credential port. |
| DM-8 | Capability-gated skip record | Step id, operation, declared gap reason, and a status of `skipped`; distinct from a `live-read-only` deferral. |

**Assertion model**: Mock execution asserts the declared expected primitive projection in addition to the provider-agnostic invariants. Live execution asserts the same invariants but not exact fixture values. Invariants include: identity matches the requested entity and configured instance; closed enums stay closed; required strings are non-empty; labels are an array; relations use closed kinds; `comments` absence means unknown and present-empty means genuinely none; `updatedAt`, when present, is an ISO-8601 UTC string; review states and job states stay in their closed sets; trace evidence references have a name and location; no raw provider key or native type appears in a normalized view.

### 8.4 External Integrations

| Provider | Live tenant kind | Read operations exercised by v1 flows | Secret input |
|----------|------------------|----------------------------------------|--------------|
| GitHub | Scratch repository | issue read, pull-request read, check-runs-per-SHA read | `CONFORMANCE_LIVE_GITHUB_TOKEN` |
| GitLab | Scratch project | merge-request read, pipelines-per-SHA read | `CONFORMANCE_LIVE_GITLAB_TOKEN` |
| Jira | Jira sandbox | issue read | `CONFORMANCE_LIVE_JIRA_TOKEN` |

All token material resolves through the adapters `./credentials` credential port. Under `tests/`, the live entrypoint reads non-secret configuration names and credential reference names, and inspects each documented token source key only for non-empty occupancy, never storing, returning, logging, or emitting its value. The mock tier uses a non-secret canary credential and exact fixture responses.

### 8.5 Backward Compatibility

Additive and test-only. The adapters package's production surfaces do not change; no core contract, package, subpath, or export map changes. The testkit root export gains conformance helpers, but testkit is private and dev-only. The new testkit files must be added to `tests/structure/inventory.json`, and their exported executables to the per-file allowances in `tests/structure/content-inventory.test.ts`. The testkit `workspaceImports` already admits `core` (`.` and `./contracts`) and every declared adapters subpath, so no manifest edge changes. `ci.yml` stays byte-unchanged; the scheduled live workflow is a separate workflow file. The secret-read allowlist stays exactly four entries. All existing gates remain green.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism | 100% of mock runs replay identical step order, outcomes, skip reasons, and diagnostics; clock, run id, ordering, and credentials are injected; no ambient time, randomness, or environment in testkit source. |
| NFR-2 | Offline mock execution | 100% of mock steps use the fixture transport; 0 live network calls; a throwing-`fetch` guard observes 0 calls; an unfixtured request fails by URL. |
| NFR-3 | Non-vacuity and coverage | ≥3 registered provider adapters; all 7 closed operations represented; 100% supported operations executed; 100% declared gaps encountered; 100% declared carriers exercised or none declared; 0 empty registry/flow/step sets. |
| NFR-4 | CI bindingness | 0 new `ci.yml` jobs; mock suite runs in `ts-test` and `ts-aggregate` via `pnpm test`; 0 `continue-on-error`, bypass, or advisory constructs; CI topology and bindingness checks stay green. |
| NFR-5 | Live no-false-alarm | `not-configured` exits 0; `passed` exits 0; `failed` exits 1; a run with no configured tenant never fails CI; an artifact is produced on every scheduled/dispatch run. |
| NFR-6 | Security and boundaries | Exactly 4 secret-read allowlist entries; 0 ambient environment reads in `packages/*/src` outside the allowlist; 0 `node:*` imports in testkit source; 0 secret or personal data in fixtures or artifacts; 0 live tenant config in production packages. |
| NFR-7 | Artifact integrity | 100% of artifacts validate against `delivery.conformance.v1`; artifact ≤ 256 KiB; no raw payloads, headers, tokens, or credential material; bounded provider, flow, and step counts. |
| NFR-8 | Bounded execution and mutation | Mock suite ≤ 60 s on CI; live run ≤ 10 min; live v1 mutation requests = 0 and created artifacts = 0; any non-`GET` request in the live tier fails the live run. |
| NFR-9 | Repository gate integrity | `pnpm check`, boundary matrix, secret-read invariant, fixture sanitization audit, doc-distribution guard, and existing CI checks stay green; no existing invariant weakened. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

No new runtime event schema or sink. Observability is artifact- and diagnostic-shaped:

- The result artifact records provider, flow, step, operation, status, skip reason, assertion count, and bounded failure detail.
- A failure names the provider, flow id, step id, operation, assertion, expected versus received primitive values, and the fixture reference or request descriptor.
- Coverage-gate failures name the missing provider registration, the uncovered operation, the stale declared gap, or the unexercised carrier.
- The live artifact records `notConfigured` as provider plus missing variable names only; it never records values.
- Resolved secret material never enters diagnostics, logs, artifacts, errors, or fixtures. The existing redaction chokepoint governs any surfaced payload.
- Mutation counters (`mutationRequests`, `createdArtifacts`) are always present in the live artifact so a reviewer can verify strict teardown without reading logs.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | All shipped adapters are read slices, so v1 proves only read behavior; a write-path regression can still escape until M1-S4/M3-S3 | M | M | Every supported read operation executes with primitive assertions; declared write gaps are exercised and visible; write flows join with the first write adapter; coverage gates prevent silent operation loss. | M — accepted v1 boundary, explicitly deferred |
| RSK-2 | Live tenants are not provisioned or their settings drift, producing repeated `not-configured` runs that look green but prove nothing | M | M | The artifact lists missing variable names; the run records `not-configured` rather than passed; tenant setup is documented; owner follow-up is tracked in OQ-1. | M — evidence quality depends on tenant maintenance |
| RSK-3 | A live run accidentally mutates a provider | H | L | Live v1 executes read steps only; non-read steps are `live-read-only` deferrals; the recording transport fails any non-`GET`; the artifact asserts zero mutations and zero created artifacts. | L |
| RSK-4 | Hand-authored mock fixtures drift from provider behavior, so the suite proves stale truth | M | M | Fixtures carry provenance and stay under the sanitization audit; the scheduled live tier re-validates shape and invariants against real providers; fixture updates are ordinary reviewed changes. | M — drift detection depends on live runs |
| RSK-5 | The suite becomes vacuous or stale: a step stops executing, a gap goes stale, or a new adapter is unregistered | M | L | Structural and runtime coverage gates, non-vacuity floors, the registration scan, and the deliberately broken adapter control all fail closed. | L |
| RSK-6 | A fixture, artifact, workflow, or diagnostic leaks a secret or personal datum | H | L | Sanitization audit with provenance and placeholders; artifact schema excludes raw payloads and headers; tokens resolve only through the credential port; workflow secrets are scoped away from PR triggers; redaction chokepoint remains authoritative. | L |
| RSK-7 | Testkit boundary creep: runtime APIs or secret reads enter testkit source, or the new modules bypass inventory rules | M | L | No `node:*` imports; no ambient environment reads; fixture loading stays in `tests/`; inventory and per-file executable allowances updated; dependency-cruiser and secret-read checks stay binding. | L |
| RSK-8 | Provider API instability or rate limits make scheduled live runs flaky and noisy | M | M | Live is evidence-only and never blocks merges; runs are bounded and read-only; failures produce an artifact; rate-budget policy remains an open planning question. | M — live noise accepted as evidence |
| RSK-9 | The scheduled workflow drifts from the supply-chain/least-privilege contract | M | L | A workflow-contract test parses the scheduled workflow and asserts triggers, permissions, SHA pins, secret scoping, upload, and Bun pin; the workflow is separate from the pinned `ci.yml` topology. | L |
| RSK-10 | The suite is slow or flaky enough that maintainers disable it | M | L | Mock runs are offline, deterministic, bounded to ≤60 s, and use exact fixture routes; no real clock, network, or sleeps. | L |

## 12. ASSUMPTIONS

- The three GH-188 provider seeds remain the only shipped provider adapters during M0; a new provider contract activates the registration gate.
- Shipped adapters remain read-only; every write operation is a declared gap until its consuming story lands.
- The injected `ProviderTransport` and `CredentialPort` remain the construction seams; no production client requires a module-level transport or credential.
- The existing `bun test` discovery and `pnpm test` path remain the CI test entry; `ts-test` and `ts-aggregate` continue to run it.
- Example-only hosts accepted by the fixture sanitization audit are sufficient for mock tenants.
- Live scratch repositories and the Jira sandbox are provisioned manually by the owner; until then the run records `not-configured`.
- GitHub Actions repository variables and secrets are available for scheduled/dispatch runs.
- The artifact upload action and retention policy are available on the repository plan.
- The testkit root export can gain conformance helpers without a new subpath or package export change.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M0-S19 / GH-188 (provider client seeds) — delivered | Supplies the three real `AdapterContract`s, production client factories, capability/gap declarations, transport seam, and fixture/trap precedent. |
| Depends on | M0-S12 / GH-181 (primitive ports, credential port, envelope) | Supplies `WorkItem`, `DeliveryRequest`, `PipelineRun`, `ADAPTER_OPERATIONS`, capability/gap declarations, and the credential port. |
| Depends on | M0-S1 / GH-170 (monorepo scaffold) | Supplies testkit placement, dependency-cruiser rules, runtime-API confinement, content inventory, secret-read boundary, and the aggregate check. |
| Depends on | M0-S3 / GH-172 (result contract) | Supplies classified failure identity and redaction discipline used by diagnostics. |
| Depends on | Pinned CI topology (`ci-topology`, `ci-bindingness`, `ci-supply-chain`, `tests/checks/ci-checks.test.ts`) | The mock suite must ride existing jobs; the scheduled workflow must not disturb `ci.yml`. |
| Depends on | Fixture sanitization audit and placeholder registry | New conformance fixtures must stay inside the audited provider fixture root. |
| Blocks | M3-S3 (adapter completion) | M0-S20 is the conformance gate the full GitHub adapter must satisfy. |
| Extended by | M1-S4 (merge, deploy trace, pipeline flows; write create/teardown) | Adds flows and write-tier teardown without reworking the v1 registry. |

## 14. OPEN QUESTIONS

- **OQ-1**: Which concrete scratch GitHub repository, scratch GitLab project, and Jira sandbox the owner will provision, and which repository secrets/variables will hold their settings. Non-blocking: the workflow is tenant-agnostic, the variable names are fixed in §22, and the run records `not-configured` until they are supplied. Decision needed on tenant ownership only when live evidence is expected to be non-empty.
- **OQ-2**: Whether scheduled live runs should eventually move behind a protected GitHub environment or a dedicated service account with stricter secret scoping. Non-blocking for v1; the workflow already has no PR trigger and job-scoped read permissions.
- **OQ-3**: Whether the existing CI supply-chain/bindingness scanners should be widened to scan non-`ci.yml` workflows, or whether the new workflow-contract test is the permanent enforcement point. Default decision in DEC-15: `ci-supply-chain` and `ci-bindingness` stay `ci.yml`-scoped in this change; repository-wide structure invariants still apply to the new workflow, and the new workflow-contract test is the dedicated enforcement for its triggers, permissions, pins, secrets, and upload.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | "Every shipped adapter" means the provider adapters with a real `AdapterContract`: GitHub, GitLab, Jira. `azure`/`ci` placeholders and non-provider I/O adapters are excluded. A structural registration gate fails when a new `*_ADAPTER_CONTRACT` source exists without conformance registration. | These are the only adapters with provider-primitive surfaces; registering placeholders would create fake coverage, while leaving future contracts ungated would let the matrix silently shrink. | 2026-10-31 |
| DEC-2 | Capability-gated execution: each step declares the `ADAPTER_OPERATIONS` operation it proves; supported operations execute against mock tenants; unsupported operations record an explicit declared-gap skip; a supported-but-uncovered operation or a declared gap never encountered fails the suite. | Honest shape for M0's read-only adapters: parity is never invented, and stale gaps or lost coverage fail closed. | 2026-10-31 |
| DEC-3 | Mock conformance runs inside the existing `pnpm test` path (`ts-test` and `ts-aggregate`). No new `ci.yml` job. | `tests/checks/ci-checks.test.ts` pins the exact job set and `ci-topology` is additions-only; the existing test jobs already gate adapter changes. | 2026-10-31 |
| DEC-4 | Live tier v1 is read-only evidence, not a merge gate. Weekly plus `workflow_dispatch`. Statuses are `passed`, `failed`, `not-configured`; `not-configured` exits 0 and `failed` exits 1. Strict teardown is zero mutation requests and zero created artifacts; write create/teardown is deferred to M1-S4. | ADR-0003: "A live e2e run is additional evidence, not the gate." Read-only v1 is the only safe live shape before write flows exist. | 2026-10-31 |
| DEC-5 | No automatic tracker ticket on scheduled live failure in v1. The failing run plus its artifact are the signal. | Creating a ticket requires `write-work-item`, a declared gap on every shipped adapter; ADR-0003 makes live evidence-only. | 2026-10-31 |
| DEC-6 | Comment provenance roundtrip executes per capabilities: the read half runs wherever `WorkItem.comments` is supplied; the carrier roundtrip runs only for adapters declaring carriers. No shipped adapter declares a carrier, so the carrier step records a declared-gap skip. The flow stays registered for the first carrier/write-capable adapter. | Preserves honest skip evidence and avoids suite rework when carriers arrive. | 2026-10-31 |
| DEC-7 | GitHub `state_reason`/`canceled` stays unmodeled (`closed` → `done`); live-shape revalidation is delivered by the live tier. No core-contract change. | The v1 contract has no destination for the distinction; the scheduled live tier catches shape drift without speculative contract work. | 2026-10-31 |
| DEC-8 | Live tenant configuration (base URLs, seeded ids, addressing, token credential references) is read only by the scheduled entrypoint under `tests/`; token material resolves only through the adapters `./credentials` credential port. No new secret-read allowlist entry and no ambient environment read in `packages/*/src`. | The secret-read scan scopes production sources; the test entrypoint is the composition edge; credential-port centralization stays mechanical. | 2026-10-31 |
| DEC-9 | The v1 registry is exactly three flows and covers all seven operations by placing the read operations in the change-lifecycle flow and the comment and label specifics in their own flows. Merge, deploy-trace, pipeline-trace, and dedicated transition-mapping flows are deferred to M1-S4. | Matches the ticket's three named flow families and D2's full-operation coverage with the smallest non-vacuous registry. | 2026-10-31 |
| DEC-10 | Live v1 executes read steps only. An unsupported non-read step records its declared-gap skip; a supported non-read step is recorded as a `live-read-only` deferral. The mock tier remains the capability gate. | Keeps the live tier zero-mutation by construction while preserving gap evidence and the same flow registry and read assertions. | 2026-10-31 |
| DEC-11 | The scheduled live workflow is a separate `.github/workflows/conformance-live.yml`, triggered weekly (Monday 05:17 UTC) and by `workflow_dispatch`, with no `pull_request` trigger. Non-secret settings come from repository variables; tokens come from repository secrets; actions are SHA-pinned; Bun comes from `.bun-version` (1.4.4); the artifact uploads with `if: always()` and 90-day retention. | Avoids the pinned `ci.yml` job set; keeps secrets away from PR-triggered runs; preserves the single Bun pin source. | 2026-10-31 |
| DEC-12 | `not-configured` semantics: a provider is configured only when every documented non-secret setting is present **and non-empty (non-whitespace)** and its token source key is present **and non-empty (non-whitespace)** in the injected environment record; `undefined`, the empty string, and whitespace-only values are MISSING, so the present-but-empty GitHub Actions no-tenant shape yields `not-configured`. If no provider is configured, overall is `not-configured` and exit is 0. A configured provider that fails makes overall `failed` and exit 1. A run with at least one configured provider and no failures is `passed`, with unconfigured providers listed separately. The entrypoint inspects the token source key only for occupancy and never stores, returns, logs, or emits its value; material resolves exclusively through the adapters `./credentials` credential port. | Gives a clear no-false-alarm behavior before tenants exist while surfacing real configuration once a tenant is claimed. | 2026-10-31 |
| DEC-13 | The artifact schema is `delivery.conformance.v1`, defined and validated in testkit; mock reports stay in memory and live entrypoints persist the same shape. | One versioned contract prevents the mock and live tiers from diverging and gives future automation a stable surface. | 2026-10-31 |
| DEC-14 | New conformance fixtures live under `tests/fixtures/providers/conformance/{provider}/**`, inside the existing fixture-sanitization audit. No parallel fixture root. | Keeps provenance, example-host, and placeholder rules binding without creating an unaudited fixture island. | 2026-10-31 |
| DEC-15 | The scheduled workflow contract is enforced by a new `tests/checks/conformance-workflow.test.ts`; `ci-supply-chain` and `ci-bindingness` stay `ci.yml`-scoped in this change. Repository-wide structure invariants still apply to the new workflow, and the workflow-contract test is the dedicated enforcement for its triggers, permissions, pins, secrets, and upload. | Enforces the new workflow without widening the pinned scanner surface or changing `ci.yml`; repository-wide structure invariants continue to bind the new workflow, and the workflow test rides the existing test battery. | 2026-10-31 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `@delivery-os/testkit` | New conformance modules: flow registry, step/assertion model, adapter registry, mock-tenant replay, capability-gated runner, coverage gates, artifact schema/validator; root export re-exports the public helpers. |
| `tests/conformance/**` | New mock suite over all registered adapters, artifact tests, live entrypoint, and the deliberately broken adapter control. |
| `tests/structure/**` | New flow/registry coverage test; `inventory.json` and per-file executable allowances updated for the new testkit source files. |
| `tests/checks/**` | New scheduled-workflow contract test. |
| `tests/fixtures/providers/conformance/{github,gitlab,jira}/**` | New deterministic mock tenants, exact URL routes, expected primitive projections, provenance markers; sanitization placeholder registry updated. |
| `.github/workflows/conformance-live.yml` | New scheduled/dispatch live-evidence workflow with least privilege, SHA pins, secret scoping, artifact upload, Bun pin. |
| `doc/spec/features/feature-adapter-conformance.md` | New always-resolve feature spec for the conformance suite, mock/live tiers, coverage gates, and artifact contract (doc-sync phase). |
| `doc/spec/features/feature-provider-client-seeds.md` | Update: live revalidation is now delivered; fixture-drift mitigation and consumed-by list reflect the conformance suite. |
| `doc/spec/features/feature-monorepo-scaffold-toolchain.md` | Update: testkit now carries the provider conformance suite; no package/subpath/edge change. |
| `doc/overview/glossary.md`, `doc/00-index.md` | New conformance-suite terms and feature entry (doc-sync phase). |
| `packages/adapters/**`, `packages/core/**`, `ci.yml` | Unchanged. No production adapter, contract, dependency, export map, or CI job change. |

**Intended path map:**

| Path | Responsibility |
|------|----------------|
| `packages/testkit/src/conformance/types.ts` | Flow, step, adapter registration, mock tenant, report, failure, and artifact types. |
| `packages/testkit/src/conformance/flows.ts` | The three-flow registry as data, with stable step ids and operation declarations. |
| `packages/testkit/src/conformance/adapters.ts` | Registrations for GitHub, GitLab, and Jira: contract import, client builder, addressing. |
| `packages/testkit/src/conformance/mock-tenant.ts` | Declarative tenant model, exact-URL route replay, and expected-projection comparison. |
| `packages/testkit/src/conformance/runner.ts` | Capability-gated execution, primitive assertions, live-read-only mode, and report construction. |
| `packages/testkit/src/conformance/coverage.ts` | Structural and runtime coverage gates: registration, operation coverage, gap encounter, carrier coverage, non-vacuity. |
| `packages/testkit/src/conformance/artifact.ts` | `delivery.conformance.v1` schema constants, serialization, and validation. |
| `packages/testkit/src/index.ts` | Re-exports the public conformance helpers; no new package subpath. |
| `tests/conformance/mock-conformance.test.ts` | Mock suite over all registered adapters, offline with the throwing-fetch guard. |
| `tests/conformance/broken-adapter-control.test.ts` | Deliberately broken adapter control proving failures name provider, flow, and step. |
| `tests/conformance/artifact.test.ts` | Artifact schema, bounds, redaction, and status validation. |
| `tests/conformance/live/config.ts` | Live tenant configuration reader: non-secret settings and credential reference names, plus non-empty occupancy of each documented token source key (the value is never stored, returned, logged, or emitted). |
| `tests/conformance/live/run-live.ts` | Live composition entrypoint: native-fetch recording transport, process credential port, injected clock/run id/writer, exit code. |
| `tests/conformance/support/fixtures.ts` | Test-side fixture loading and tenant decoding (runtime APIs stay out of testkit source). |
| `tests/structure/conformance-coverage.test.ts` | Provider-contract registration scan, closed-operation representation, and registry shape. |
| `tests/checks/conformance-workflow.test.ts` | Scheduled workflow contract: triggers, permissions, SHA pins, secret scoping, artifact upload, Bun pin. |
| `tests/fixtures/providers/conformance/github/tenant.json` | GitHub mock tenant: example host, credential reference, addressing, exact routes, expected projections, provenance. |
| `tests/fixtures/providers/conformance/gitlab/tenant.json` | GitLab mock tenant in the same shape. |
| `tests/fixtures/providers/conformance/jira/tenant.json` | Jira mock tenant in the same shape. |
| `tests/fixtures/providers/sanitization/placeholders.json` | Declared placeholder registry extended for any new conformance-fixture placeholder. |
| `.github/workflows/conformance-live.yml` | Scheduled/dispatch read-only live evidence workflow with artifact upload. |
| `tests/structure/inventory.json` | Adds every new testkit source file. |
| `tests/structure/content-inventory.test.ts` | Adds per-file executable allowances for the new testkit modules. |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the delivered flow registry, **when** it is inspected structurally, **then** it contains exactly the three v1 flows (`change-lifecycle`, `comment-provenance`, `label-semantics`), every step declares an operation from the closed `ADAPTER_OPERATIONS` set, every closed operation appears in at least one step, and all flow/step ids are unique. | F-1, NFR-3 |
| AC-F1-2 | **Given** the change-lifecycle flow, **when** it runs against an adapter that supports the read operations, **then** the read-work-item, read-delivery-request, and read-pipeline-run steps execute and assert normalized `WorkItem`, `DeliveryRequest`, and `PipelineRun` views, while write steps are capability-gated. | F-1, F-2, NFR-3 |
| AC-F2-1 | **Given** an adapter contract, **when** the mock runner executes the registry, **then** every supported operation executes at least one step with primitive assertions, and every unsupported operation records an explicit skip carrying the matching declared gap reason. | F-2, DM-2, DM-8, NFR-3 |
| AC-F2-2 | **Given** a supported operation with no executing step in mock mode, an operation absent from both supported and declared gaps, or a declared gap never encountered, **when** the coverage gate runs, **then** the suite fails naming the adapter and operation. | F-2, F-5, NFR-3 |
| AC-F2-3 | **Given** the comment-provenance flow, **when** an adapter supplies `WorkItem.comments`, **then** the read half asserts the absence/presence semantics; the carrier roundtrip executes only for an adapter declaring carriers, otherwise it records the matching declared-gap skip when `write-comment` is unsupported, or a `no-declared-carrier` capability-absent skip when `write-comment` is supported with no declared carrier; the flow remains registered. | F-2, DM-2, DM-8 |
| AC-F3-1 | **Given** the adapters package source tree, **when** a new provider `*_ADAPTER_CONTRACT` exists without a conformance registration, **then** the structural gate fails naming the source and adapter. | F-3, NFR-3 |
| AC-F3-2 | **Given** the conformance adapter registry, **when** compared with the real provider contracts, **then** it registers exactly GitHub, GitLab, and Jira, each registration binds the matching contract, and no placeholder or non-provider adapter is registered. | F-3, NFR-3 |
| AC-F4-1 | **Given** the mock tenants, **when** the suite replays them through the production client factories, **then** every request resolves by exact URL, an unfixtured request fails, the throwing-`fetch` guard observes zero calls, and no live network is used. | F-4, NFR-2 |
| AC-F4-2 | **Given** two mock runs over the same registry and tenants, **when** their reports are compared, **then** step order, outcomes, skip reasons, and diagnostics are identical, proving injected clock/run-id determinism. | F-4, NFR-1 |
| AC-F4-3 | **Given** the new conformance fixtures, **when** the fixture sanitization audit runs, **then** there are zero findings: each fixture has a top-level provenance marker, uses example-only hosts and declared placeholders, sits under the existing `tests/fixtures/providers/**` audit root, and contains no live tenant identifier or personal data. | F-4, NFR-6 |
| AC-F5-1 | **Given** the coverage gates, **when** all shipped adapters run in mock mode, **then** supported operations are executed, declared gaps are encountered, declared carriers are exercised or the adapter declares none, and the registry/flow/step sets are non-empty; any failure names the provider, flow, step, or operation. | F-5, NFR-3 |
| AC-F5-2 | **Given** the deliberately broken adapter control, **when** the suite runs, **then** the control fails naming provider, flow, and step, while the unmodified adapter passes the same flow. | F-10, NFR-3 |
| AC-F6-1 | **Given** the three shipped provider adapters, **when** `pnpm test` runs in the existing `ts-test` and `ts-aggregate` jobs, **then** the mock conformance suite is green for GitHub, GitLab, and Jira, with declared-gap skips treated as green only when declared. | F-6, NFR-4 |
| AC-F6-2 | **Given** an adapter change that breaks a covered flow, **when** CI runs, **then** the existing test jobs fail through `pnpm test`; no new `ci.yml` job is present and the topology/bindingness checks stay green. | F-6, NFR-4 |
| AC-F7-1 | **Given** a scheduled or dispatched live run, **when** it completes in any status, **then** a `delivery.conformance.v1` artifact is written and uploaded, with overall status `passed`, `failed`, or `not-configured`. | F-7, F-8, NFR-5 |
| AC-F7-2 | **Given** no live tenant is configured, **when** the scheduled run executes, **then** the overall status is `not-configured`, the exit code is 0, the artifact lists the missing variable names, and the workflow does not raise a false failure. | F-7, NFR-5 |
| AC-F7-3 | **Given** at least one configured live provider, **when** an executed read step fails, **then** the overall status is `failed`, the exit code is 1, the artifact is still uploaded, and no tracker ticket is created automatically. | F-7, NFR-5 |
| AC-F7-4 | **Given** the scheduled workflow, **when** inspected, **then** it has only the weekly schedule and `workflow_dispatch` triggers, no `pull_request` trigger, job-scoped least-privilege permissions, SHA-pinned actions, token secrets only in scheduled/dispatch runs, an always-run artifact upload, and the Bun 1.4.4 pin resolved from `.bun-version`. | F-7, NFR-4, NFR-6 |
| AC-F7-5 | **Given** the live entrypoint, **when** it reads tenant configuration, **then** under `tests/` it reads non-secret settings and credential reference names and inspects each documented token source key only for non-empty occupancy, without storing, returning, logging, or emitting its value; actual token material resolves only through the adapters `./credentials` credential port; and no `packages/*/src` ambient environment read or new secret-read allowlist entry is introduced. | F-7, NFR-6 |
| AC-F8-1 | **Given** the result artifact, **when** validated, **then** it conforms to `delivery.conformance.v1`, contains per-provider/flow/step outcomes and bounded failure diagnostics, stays within the size and count bounds, and contains no raw provider payload, header, token, credential, or personal datum. | F-8, DM-5, DM-6, NFR-7 |
| AC-F9-1 | **Given** any live v1 run, **when** the run completes, **then** the recording transport reports zero non-`GET` requests and zero created artifacts, and the artifact records `mutationRequests: 0` and `createdArtifacts: 0`; a mock run reaches no network. | F-9, NFR-8 |
| AC-F10-1 | **Given** any failed step, **when** the diagnostic is inspected, **then** it names provider, flow id, step id, operation, assertion, expected versus received primitive values, and the fixture reference or request descriptor, with no secret or raw payload content. | F-10, NFR-7 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

Land the suite in one change so the registry, adapter registrations, mock tenants, coverage gates, tests, workflow, and artifact schema are reviewed together. Delivery build order inside the change: schema and flow/step types → adapter registry and mock tenants → capability-gated runner and coverage gates → mock suite and broken-adapter control → artifact validator → live entrypoint and scheduled workflow → documentation sync. The mock suite must be green on the three shipped adapters before the workflow lands.

No migration or user-facing behavior change. `ci.yml` is untouched; the scheduled workflow is additive; all existing gates stay green. A scheduled live failure is visible as a red workflow run and an uploaded artifact, not as a merge block.

**Definition of Done predicates:** all ACs have passing, traceable evidence; the mock suite is green in `ts-test` and `ts-aggregate` with zero live network calls; the structural registration and operation-coverage gates fire on their negative controls; the broken adapter control fails by provider/flow/step; the live entrypoint produces `not-configured` in the absence of tenants and a valid artifact in every status; the scheduled workflow contract test passes; zero mutation requests and zero created artifacts are recorded; the secret-read allowlist remains exactly four entries; fixture sanitization is green; `pnpm check` passes; `ci.yml` is byte-unchanged; documentation is synchronized (new feature spec and the listed updates); an open unmerged pull request targets `main-tools` with all required CI jobs green on the pushed HEAD.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. No persisted runtime state, store schema, or configuration key is introduced. New committed test assets are the mock tenants and conformance fixtures under the existing provider fixture root. Live tenant settings are environment configuration, not migrated data. No live tenant is seeded or mutated by this change.

## 20. PRIVACY / COMPLIANCE REVIEW

The privacy-sensitive surfaces are committed conformance fixtures, the result artifact, and live tenant configuration. Fixtures are synthetic, provenance-marked, sanitized, and confined to example-only hosts and declared placeholders; the existing sanitization audit and privacy guards scan them. Artifacts contain primitive-level identifiers and assertions only, never raw provider payloads, authorization headers, tokens, or personal data. Live tenant configuration stores non-secret settings and credential reference names under `tests/`; token material resolves only through the credential port and never enters diagnostics or artifacts. No cloud names, designs, or pricing enter committed files. Provider reads surface only the normalized primitive data the existing seeds already expose; the conformance suite adds no new personal-data surface.

## 21. SECURITY REVIEW HIGHLIGHTS

This change strengthens the adapter security posture by making behavior mechanically gated. The secret-read boundary stays exactly four entries: the testkit conformance code imports no runtime API, no testkit module reads the ambient environment, and the live entrypoint's configuration read is under `tests/` where the production-source scan does not apply. Token material resolves exclusively through the adapters `./credentials` credential port; the live entrypoint reads only reference names and, for the `not-configured` decision, each documented token source key's non-empty occupancy, and it never stores, returns, logs, or emits the token value. The scheduled workflow has no PR trigger, job-scoped `contents: read`, SHA-pinned actions, and token secrets scoped to scheduled/dispatch runs only. Mock and live tiers reject non-`GET` requests, and the artifact forbids raw payloads and headers. Fixture sanitization, provenance, example-only hosts, and the placeholder registry prevent secret or personal-data leakage. The runtime-API confinement remains unchanged: testkit source imports only `core` and adapters, and the live entrypoint sits outside package production source.

## 22. MAINTENANCE & OPERATIONS IMPACT

Maintainers own three surfaces: the flow registry (a new provider incident adds a flow step and a mock expectation, not a prompt note), the adapter registrations (a new provider contract forces suite participation through the structural gate), and the live tenants (manual sandbox maintenance, credential rotation, and the documented settings). The mock fixtures are dated and provenance-marked; live runs are the drift detector. The artifact schema is versioned; a change to its shape requires a new schema version and a coordinated validator update.

**Live tenant configuration (documented names, no values committed):**

| Provider | Non-secret repository variables | Token repository secret |
|----------|--------------------------------|-------------------------|
| GitHub | `CONFORMANCE_LIVE_GITHUB_BASE_URL`, `CONFORMANCE_LIVE_GITHUB_OWNER`, `CONFORMANCE_LIVE_GITHUB_REPO`, `CONFORMANCE_LIVE_GITHUB_ISSUE_NUMBER`, `CONFORMANCE_LIVE_GITHUB_PULL_NUMBER`, `CONFORMANCE_LIVE_GITHUB_COMMIT_SHA` | `CONFORMANCE_LIVE_GITHUB_TOKEN` |
| GitLab | `CONFORMANCE_LIVE_GITLAB_BASE_URL`, `CONFORMANCE_LIVE_GITLAB_PROJECT_PATH`, `CONFORMANCE_LIVE_GITLAB_MR_IID`, `CONFORMANCE_LIVE_GITLAB_COMMIT_SHA` | `CONFORMANCE_LIVE_GITLAB_TOKEN` |
| Jira | `CONFORMANCE_LIVE_JIRA_BASE_URL`, `CONFORMANCE_LIVE_JIRA_ISSUE_KEY` | `CONFORMANCE_LIVE_JIRA_TOKEN` |

Credential references use the literal source-key style with the token variable names above; the live entrypoint passes only the reference name and the process credential port resolves the material.

**Configured decision:** a provider is configured only when every documented non-secret setting for that provider is present **and non-empty (non-whitespace)** and that provider's token source key is present **and non-empty (non-whitespace)** in the injected environment record. `undefined`, the empty string, and whitespace-only values are MISSING. The present-but-empty shape is the real GitHub Actions no-tenant shape — an unset repository variable or secret materialises as a present, empty-string environment key — and it must yield `not-configured` with exit 0, never a configured provider that fails.

The entrypoint inspects the token source key only to test occupancy for the `not-configured` decision; it never stores, returns, logs, or emits the token value, and actual authorization resolves exclusively through the adapters `./credentials` CredentialPort. Once the source key is non-empty, the credential port resolves it.

**Missing-name reporting:** for a fully absent or present-but-empty environment the artifact lists 15 names — GitHub 7 (six settings plus the token source key), GitLab 5 (four settings plus the token source key), and Jira 3 (two settings plus the token source key). Names only, never values.

**How to run:**

- Mock, local: `bun test tests/conformance` for the narrow suite, or `pnpm test` / `pnpm check` for the full battery.
- Mock, CI: existing `ts-test` and `ts-aggregate` jobs; no new job.
- Live, local: set the documented variables and token secrets in the environment, then run the live entrypoint under `tests/conformance/live/` with an output path; it exits 0 for `passed`/`not-configured` and 1 for `failed`.
- Live, CI: weekly schedule plus manual `workflow_dispatch`; the artifact uploads under the `conformance-live` artifact name with 90-day retention.

**Operational signals:** a red scheduled workflow is the live-failure signal; the artifact names the provider, flow, step, and assertion. A `not-configured` artifact lists missing variable names and is not an alarm. No automatic ticket is created in v1.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Conformance flow | A provider-agnostic sequence of primitive steps executed against an adapter to prove observable behavior. |
| Flow step | One ordered unit in a flow, carrying a stable id, an `ADAPTER_OPERATIONS` operation, and a primitive assertion family. |
| Capability-gated execution | Executing a step only when its operation is supported; otherwise recording an explicit declared-gap skip. |
| Declared-gap skip | A green-but-visible skip that carries the adapter's declared gap reason for an unsupported operation. |
| Live-read-only deferral | A live-tier skip for a supported non-read step, used to keep v1 live evidence zero-mutation. |
| Mock tenant | Declarative, sanitized provider data mapping exact request URLs to responses and expected primitive projections. |
| Adapter registration | The binding between a provider adapter contract and its conformance client builder and addressing. |
| Coverage gate | Structural or runtime check that fails on missing registration, uncovered operation, stale gap, unexercised carrier, or vacuous execution. |
| Result artifact | The versioned `delivery.conformance.v1` JSON record of a live run. |
| Strict teardown | In v1, the zero-mutation/zero-created-artifact property enforced by read-only execution and request-method recording. |
| Broken adapter control | A test-only adapter wrapper that corrupts a normalized outcome to prove the suite's assertions fail non-vacuously. |
| Scratch tenant | A read-only GitHub repository, GitLab project, or Jira sandbox used for scheduled live evidence. |
| Not-configured | The live status when the documented tenant settings are absent or present-but-empty/whitespace-only; exits 0 and never alarms. |

## 24. APPENDICES

**Sources:** issue GH-189 (M0-S20); backlog story M0-S20 and backlog-ranking row 19; `doc/planning/concepts/adapter-conformance.md`; `doc/spec/features/feature-adapter-ports.md`; `doc/spec/features/feature-provider-client-seeds.md`; `doc/spec/features/feature-monorepo-scaffold-toolchain.md`; ADR-0003 (conformance suite in testkit; live e2e as additional evidence; testkit dev edges; runtime-API confinement); ADR-0005 (provider client subpaths); GH-189 pm-notes (D1–D8); current adapters contracts and testkit precedent; `.github/workflows/ci.yml`; CI topology/bindingness/supply-chain/secret-read/inventory checks; `.ai/rules/testing-strategy.md` and `.ai/rules/typescript.md`.

**Ticket acceptance-criterion traceability:**

| Ticket AC | Covered by | Evidence boundary |
|-----------|------------|-------------------|
| AC-1: the suite runs green on mocks in CI for every shipped adapter | AC-F6-1, AC-F1-1, AC-F2-1, AC-F3-2, AC-F4-1, AC-F5-1 | GitHub, GitLab, and Jira run the mock suite under `pnpm test` in `ts-test`/`ts-aggregate`; supported operations execute and declared gaps skip explicitly. |
| AC-2: a scheduled live run records a result artifact | AC-F7-1, AC-F7-2, AC-F7-3, AC-F7-4, AC-F8-1 | Weekly/dispatch workflow writes and uploads a `delivery.conformance.v1` artifact for `passed`, `failed`, or `not-configured`; `not-configured` exits 0. |
| AC-3: an adapter change that breaks a flow fails CI | AC-F6-2, AC-F2-2, AC-F5-2, AC-F10-1 | The mock suite is in the existing test path; structural/runtime coverage and the broken-adapter control fail by provider/flow/step; no new CI job. |

**Operation coverage matrix (v1):**

| Operation | Flow step(s) | Jira | GitLab | GitHub |
|-----------|--------------|------|--------|--------|
| `read-work-item` | `change-lifecycle.read-work-item`, `comment-provenance.read-comments`, `label-semantics.read-labels` | executes | declared-gap skip | executes |
| `write-work-item` | `change-lifecycle.open-change`, `label-semantics.replace`, `label-semantics.sweep` | declared-gap skip | declared-gap skip | declared-gap skip |
| `transition-work-item` | `change-lifecycle.transition` | declared-gap skip | declared-gap skip | declared-gap skip |
| `read-delivery-request` | `change-lifecycle.read-delivery-request` | declared-gap skip (`provider-unsupported`) | executes | executes |
| `write-delivery-request` | `change-lifecycle.create-delivery-request` | declared-gap skip (`provider-unsupported`) | declared-gap skip | declared-gap skip |
| `read-pipeline-run` | `change-lifecycle.read-pipeline-run` | declared-gap skip (`provider-unsupported`) | executes | executes |
| `write-comment` | `change-lifecycle.comment`, `comment-provenance.carrier-roundtrip` | declared-gap skip | declared-gap skip | declared-gap skip |

**Result artifact shape (normative fields):** `schema` (`delivery.conformance.v1`), `runId`, `tier`, `generatedAt`, `status`, `providers[]` (provider, adapterName, status, missing settings, and `flows[]` flow summaries carrying `flowId`, `name`, `status`), `flows[]` (canonical per-flow results, each carrying `provider`, `flowId`, `name`, `status`, and ordered nested `steps[]`), `steps[]` (a flat index of the same step results: `provider`, `flowId`, `stepId`, `operation`, `status`, `skipReason`, `skipKind`, `assertionCount`, `failure`), `mutationRequests`, `createdArtifacts`, and `totals`. `skipKind` is a closed set: `declared-gap`, `capability-absent`, `live-read-only`. `providers[].flows[]` are summaries only; the canonical per-flow results with nested `steps[]` live in top-level `flows[]`. Failure details are bounded and carry primitive-level expected/received values only.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31 | Change Spec Writer | Initial GH-189 specification from the ticket, PM clarify_scope decisions D1–D8, the adapter-conformance concept, the current adapter-port/client-seed/monorepo specs, ADR-0003/ADR-0005, the delivered testkit and CI/inventory mechanisms. |
| 1.1 | 2026-10-31 | Change Spec Writer | DoR iteration-1 remediation: B-1 configures `not-configured` on non-empty (non-whitespace) occupancy, so the present-but-empty GitHub Actions shape exits 0, with the 15-name missing list and credential-port exclusivity (§22, DEC-12); advisory 6 adds `skipKind` and the provider-flow-summary distinction to the normative artifact shape (§24); advisory 8 narrows the scanner-scope claim to `ci-supply-chain`/`ci-bindingness` (§14 OQ-3, DEC-15). |
| 1.2 | 2026-10-31 | Change Spec Writer | DoR iteration-2 remediation: blocking item permits token source-key occupancy inspection without storing/returning/logging/emitting the value (AC-F7-5, §8.4, §21, §16 path map, §23 glossary); glossary "Not-configured" now covers present-but-empty/whitespace-only; §24 flat `steps[]` carries `provider` and `flowId`, matching plan D-9; AC-F2-3 distinguishes the declared-gap skip (`write-comment` unsupported) from the `no-declared-carrier` capability-absent skip (`write-comment` supported with no declared carrier). |

---

## AUTHORING GUIDELINES

Grounded in the ticket and planning-session context only. The three flow families come verbatim from the ticket task line; the capability-gated execution, adapter scope, CI placement, live read-only evidence, no-auto-ticket, comment-provenance, GitHub `state_reason`, and live-config decisions come from the PM-confirmed D1–D8 in `chg-GH-189-pm-notes.yaml`. The testkit placement, dev-edge rules, and live-evidence-only stance come from ADR-0003; the provider contracts and read-slice posture come from `feature-adapter-ports.md` and `feature-provider-client-seeds.md`; the CI topology, secret-read, runtime-API, inventory, fixture-sanitization, and test-layer constraints come from the delivered checks and `.ai/rules`. Mechanically verifiable acceptance criteria were enforced per AC: every criterion names an observable structural gate, mock-suite outcome, workflow property, artifact property, or boundary invariant. No implementation tasks are included; paths are given at module/test/fixture/workflow granularity as the codebase map required for downstream planning.

## VALIDATION CHECKLIST

- [x] `change.ref` matches `GH-189`; `owners` has one entry; `status` is Proposed.
- [x] All sections present in order (1–25 + authoring guidelines + checklist).
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-).
- [x] Every AC is Given/When/Then, references at least one F-/DM-/NFR- ID, and is mechanically verifiable.
- [x] NFRs include measurable thresholds; risks include impact and probability with mitigations and residual risk.
- [x] Out-of-scope items marked `[OUT]`; non-goals explicit per the ticket and backlog.
- [x] All three ticket ACs traced in the appendix with evidence boundaries.
- [x] D1–D8 encoded in the decision log and reflected in capabilities, flows, NFRs, and ACs.
- [x] Structural registration, operation coverage, gap encounter, carrier coverage, determinism, no-mutation, and broken-adapter controls specified.
- [x] Live workflow contract, environment names, artifact schema, and no-false-alarm behavior specified.
- [x] Security/boundaries specified: secret-read, runtime-API, fixture sanitization, artifact redaction, workflow secret scoping.
- [x] Documentation impacts recorded (new feature spec; provider-client-seeds and monorepo updates; glossary/index).
- [x] Only this spec file was written; no other files modified; no git operations performed.
