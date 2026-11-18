---
ados_distribution: internal
id: SPEC-ADAPTER-CONFORMANCE
status: Current
created: 2026-11-01
last_updated: 2026-11-18
owners: ["engineering"]
service: delivery-os provider adapters
summary: "The provider-agnostic adapter conformance suite: one three-flow, fourteen-step registry over the nine closed adapter operations, capability-gated execution with explicit declared-gap and capability-absent skips, production write execution in the mock tier including the provider-side landing, the comment write, and the delivery-request content write, deterministic exact-URL mock tenants, cross-transport normalization parity, structural and runtime coverage gates, a declared cross-adapter parity matrix over a six-dimension basis with derived columns, an adjudicated class-set difference register and a pure parity gate over a gate-local observation record, a conformance-level tracker error taxonomy with a six-family trap vocabulary and per-adapter family accounting, a runtime-neutral simulated stateful tracker double with a closed effect vocabulary, the registration-only participation contract with its identity-construct scan and composition-injected control registration, the throwing-fetch and child-process guards, the delivery.conformance.v1 artifact, a scheduled read-only live evidence tier, and the harness conformance registry with its streaming-starter registration, six-scenario classification floor, and liveness read."
links:
  related_changes: ["GH-189", "GH-183", "GH-231", "GH-225", "GH-233", "GH-275", "GH-338", "GH-339"]
  related_decisions: ["ADR-0003", "ADR-0005", "TDR-0008", "TDR-0032", "TDR-0033", "TDR-0036", "TDR-0037", "TDR-0038", "TDR-0039"]
---

# Feature: Adapter Conformance Suite

## Overview

The adapter conformance suite proves that every shipped provider adapter responds to the same three primitive flow families in the same vocabulary: change lifecycle, comment provenance, and label semantics. It lives in the private, dev-only `@delivery-os/testkit` package. The flow registry is provider-agnostic; provider-specific behavior enters only through the conformance adapter registry and the declarative mock tenants.

The suite has two tiers. The mock tier runs inside the existing `pnpm test` path — and therefore inside the existing TypeScript test jobs — with zero live network calls and zero live child processes. The live tier is scheduled read-only evidence against configured scratch tenants, not a merge gate; it records a versioned `delivery.conformance.v1` artifact in every terminal status.

Beyond per-adapter coverage the suite declares cross-adapter parity: one matrix over the nine closed operations and the registered adapters, one adjudicated register for the differences it names, and one pure gate that compares matrix, capability declarations, and observed outcome. Parity is declared data with a failure mode, never a claim that the adapters happen to agree.

## Flow registry

The registry is exactly three flows and fourteen ordered steps. Flow and step ids are stable data used in failures and in the artifact.

| Flow | Steps | Operations |
|---|---|---|
| `change-lifecycle` | read-work-item, read-delivery-request, read-pipeline-run, open-change, transition, create-delivery-request, comment, resolve-delivery-thread, merge-delivery-request | `read-work-item`, `read-delivery-request`, `read-pipeline-run`, `write-work-item`, `transition-work-item`, `write-delivery-request`, `write-comment`, `resolve-delivery-thread`, `merge-delivery-request` |
| `comment-provenance` | read-comments, carrier-roundtrip | `read-work-item`, `write-comment` |
| `label-semantics` | read-labels, replace, sweep | `read-work-item`, `write-work-item` |

Together the registry represents all nine closed adapter operations. The provider-side landing sits **inside** the `change-lifecycle` flow as its last step and executes against the mock tenant; pipeline-trace and dedicated transition-mapping flows remain deferred. The deploy-trace read and the two bounded evidence reads sit outside the three-flow registry because none of them is a closed operation. See [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md) for the bounded adapter-local reads, [Adapter Reference Behavior](feature-adapter-reference-behavior.md) for the operations they support, and [Merge and Verify Deploy](feature-merge-verify-deploy.md) for the deploy-trace consumer.

## Adapter registry

The conformance adapter registry is the sole participant list. It registers exactly the three shipped provider contracts — GitHub, GitLab, and Jira — and each registration binds the imported contract, the addressing the flows need, and a client builder over the tenant instance, credential port, and injected transport. Placeholder `azure`/`ci` subpaths and non-provider I/O adapters are not registered. A structural scan of exported `*_ADAPTER_CONTRACT` bindings under `packages/adapters/src` fails when a provider contract has no registration or a registration names no declared contract.

## Harness conformance registry

The harness conformance registry lives beside the provider registry in the testkit package (`packages/testkit/src/conformance/harness.ts`). `HARNESS_CONFORMANCE_REGISTRY` is the sole participant list for harness flows and registers exactly the two shipped harness kinds — `opencode` and `claude-code`. Each registration carries the adapter's capability declaration, a spawn/collect builder over injected harness I/O and injected seams (environment builder, classifier, liveness assembler, streaming spawn starter, clock, timeout), and its supported scenario ids.

`HARNESS_CONFORMANCE_SCENARIOS` is the fixed six-scenario classification floor: `completed`, `tool-failure`, `premature-end`, `harness-failure`, `spawn-refusal`, and `timeout`. Classification runs through the one shared harness-neutral classifier, so the same injected scenario yields the same delivery-result token for either harness. The registry imports the delivery-result token type from core contracts and never re-declares the taxonomy. A coverage meta-check fails a registered harness with a missing scenario, a duplicate registration, an unregistered closed-vocabulary kind, or a kind that is registered but absent from the vocabulary. A liveness read over injected facts proves the harness-agnostic liveness shape and its declared absences without adding a runtime signal source.

The provider registry remains the sole participant list for provider conformance flows; the harness registry is a separate registry for the harness port family. The harness contract is specified in [Harness Adapters](feature-harness-adapters.md).

## Capability gating

Execution is capability-gated per adapter. A step whose operation is in the adapter's `supportedOperations` executes against the adapter's mock tenant and applies the step's primitive assertion family. A step whose operation is unsupported records an explicit `skipped` result carrying the adapter's declared gap reason. An unsupported operation with no declared gap fails closed rather than producing an anonymous skip.

A supported operation with no executing step, or a declared gap whose operation is never encountered, fails the coverage gate. The comment-provenance carrier roundtrip executes only when the adapter declares both a writable and a readable carrier. A shipped adapter with no carrier records the `write-comment` declared-gap skip when that operation is unsupported, or a `no-declared-carrier` capability-absent skip when `write-comment` is supported with empty carrier arrays. GitHub is the second case: it supports `write-comment` with empty carrier arrays, so its carrier roundtrip records a `capability-absent` skip and the `change-lifecycle.comment` step executes through the production client's comment write in the same run.

Production registrations execute supported writes through their adapter client's write members (`writeWorkItem`, `transitionWorkItem`, `resolveDeliveryThread`, `writeComment`, `writeDeliveryRequest`, and `mergeDeliveryRequest`) against the mock tenant. A test-only `writeHandler` overrides execution for controls but is never set by a production registration. A supported non-read step with neither a client write member nor a test-only handler fails closed naming the provider, flow, step, and operation; controls are injected only through the runner's adapter list. An unsupported operation never dispatches, whether or not a handler exists.

## Coverage gates

The structural gate proves the registry and every adapter declaration are complete: unique flow and step ids, membership in the closed operation set, all nine operations represented, per-adapter supported operations and declared gaps each backed by a step and together covering every closed operation, declared carriers backed by a carrier step, and no adapter that declares no operations. The runtime gate proves execution is non-vacuous: at least one executed step per adapter, every supported operation executed (or, in live mode only, recorded as a `live-read-only` deferral), every declared gap encountered with its exact reason, every declared carrier exercised, and no failed step counted as passed. Every violation names the registry, provider, flow, step, or operation at fault.

## Cross-adapter parity matrix and difference register

Parity is declared once, as data, in `packages/testkit/src/conformance/parity.ts`. The matrix has one row per closed operation — the nine `ADAPTER_OPERATIONS` entries, imported and never re-declared — and one column per registered adapter. Columns are derived from the conformance registration list, so the module authors no provider-name key, lookup operand, or comparison; a hand-authored column key fails the identity-construct scan, and each authored column and register entry is bound to its imported contract rather than to a list position. GitHub is the single declared reference adapter (the first registration), and its column is uniformly `same-as-reference`.

| Cell value | Meaning |
|---|---|
| `same-as-reference` | All six observations agree for the pair. |
| `declared-difference` | The pair differs, and the cell carries exactly the `registerId` of its adjudicated entry. |
| `gap` | The operation is unsupported, so no observation exists; the cell cites the adapter's own declared gap reason. |

A cell carries no difference class and no free text, so a pair that differs on several dimensions stays one cell with one entry. The register entry is keyed by exactly `(adapter, operation)` and carries a non-empty **set** of classes drawn from the closed vocabulary, a rationale, one resolving evidence reference **per class**, and an adjudication reference. Adjudication is per entry, not per class; the cell and its entry are a strict bidirectional one-to-one.

### Parity basis: six dimensions, one per class

Parity is the agreement of six provider-independent observations, never byte equality of normalized views. The class set **is** the dimension set: one class per dimension, one dimension per class, so the register's vocabulary and the gate's observed-divergence vocabulary are one closed set, and a class without a dimension or a dimension without a class is a `difference-class` failure.

| Dimension = class id | Offline oracle |
|---|---|
| `identity-scheme` | The scheme of the normalized entity identity for the operation's read — a provider numeric id, a project-scoped `iid`, an issue `key`, a `<commitSha>:<runId>` item identity — never the identity value. |
| `pipeline-model` | The pipeline observation's granularity unit and per-item composition for one commit; item counts are diagnostic only. |
| `state-vocabulary` | The state-resolution signal, refusal rule, and reachable aliases for a declared native value on `read-work-item` and `read-delivery-request`; never row spelling. |
| `pagination-model` | The read's declared page bound plus whether a page count is reported; the numeric bound and count are diagnostic only. |
| `carrier-absent` | The adapter's declared carrier arrays, observed once per adapter, plus the carrier step's participation, observed only on the `write-comment` pair. |
| `failure-classification` | The tracker error class a trap-family stimulus classifies into, resolved from structured fields only. |

The `carrier-absent` observation is two-halved. The declaration half is an adapter-level fact compared per column. The participation half exists only on the pair whose operation is `write-comment`: on every other pair it is `not-observable` and agrees with another `not-observable`, and a `write-comment` declared gap has no participation observation at all, because the gap is the declaration's own fact. All three shipped adapters declare empty carrier arrays, so their `carrier-absent` observations agree — a recorded negative outcome rather than a silent one.

Assertion-family outcome and non-carrier step participation are deliberately **not** parity dimensions: the assertion family is declared on the shared registry step and is therefore identical in every column, and in the mock tier a step skips only for a declared unsupported operation, the live-only deferral, or a missing declared carrier. A divergence there is a defect, policed by the coverage gates, not a provider-model fact.

### Delivered adjudication

Five non-reference supported intersections exist, and each is adjudicated rather than converged: three carry declared differences and two are `same-as-reference`.

| Pair | Posture | Classes |
|---|---|---|
| `(gitlab, read-delivery-request)` | declared difference | `identity-scheme`, `state-vocabulary`, `failure-classification` |
| `(gitlab, read-pipeline-run)` | declared difference | `identity-scheme`, `pipeline-model`, `pagination-model` |
| `(jira, read-work-item)` | declared difference | `identity-scheme`, `state-vocabulary`, `failure-classification` |
| `(jira, write-work-item)`, `(jira, transition-work-item)` | same as reference | none — both columns report the analogous write surface as `not-observable` and both declare empty carrier arrays |

A `failure-classification` class is recorded only where the difference is real and observable. Where the reference has no family fixture on that operation — GitLab on `read-delivery-request` — the entry states "unobservable on the reference" and records the adapter's structural status absence rather than claiming a provider divergence. Where the reference does have a family fixture — Jira on `read-work-item` — the entry records the delivered asymmetry: the GitLab and Jira slices build payload failures without `httpStatus`, so an authentication rejection is not structurally distinguishable from a transport failure.

## Parity gate

The gate is one pure function over the matrix, its register, the registered adapters' capability declarations, and a **gate-local observation record**. The record carries one observation per dimension per `(adapter, operation)` pair, each either `{ state: "observed", value }` or `{ state: "not-observable", why }`; a declared-gap pair has no observation at all. `not-observable` is never agreement by default — two `not-observable` observations agree only when both report it, and an `observed` against a `not-observable` is a difference that must be recorded. The record is an input to the gate only: it is never a report property, never a `delivery.conformance.v1` field, and never persisted. The gate performs no I/O, reads no ambient input, and is deterministic for the same input.

The gate returns clause-tagged violation records — empty means pass — ordered canonically by clause, then provider, then operation, then dimension. Each record names the provider, the operation, one of exactly nine closed clause ids, the implicated dimension(s), a bounded scalar detail, and a resolving fixture or evidence reference.

| Clause id | What it observes |
|---|---|
| `declaration-agreement` | A cell disagrees with the adapter's capability declaration, in either direction, including a `gap` reason that differs from the declared one. |
| `observed-contradiction` | An observation contradicts its cell: a differing dimension on a `same-as-reference` cell, or a differing dimension missing from an entry's class set. |
| `register-bijection` | A `declared-difference` cell with no resolvable entry, an entry naming no cell, or two entries for one pair. |
| `column-registration` | A registered adapter has no column, or a column names no registration. |
| `cell-set` | The cell set is not exactly nine operations × registered adapters (missing, duplicate, or extra cell). |
| `reference-purity` | The reference column is not uniformly `same-as-reference`, or a register entry names the reference. |
| `cell-vocabulary` | A cell kind outside the three-member closed set, or a cell carrying a class. |
| `difference-class` | An entry whose class set is empty or holds a class outside the closed vocabulary. |
| `evidence-reproduction` | A class whose evidence does not resolve or does not reproduce that dimension's observation, including evidence showing the dimension agreeing. |

A violation carrying any other clause id is an engine defect, not a new finding. Parity is therefore three-way consistent — matrix, capability declaration, and observed outcome — and a disagreement is a gate failure with a diagnosable record, never a warning and never a silent skip.

## Tracker error taxonomy and trap families

The taxonomy maps the milestone's four tracker error classes onto already-delivered structured identities. It is conformance vocabulary: the class ids are the language in which the suite states what it proved, and they never appear in a normalized view, a failure result, an error-table row, a domain kind, a projection class, or the artifact. They are declared in exactly one module inside the testkit and adapters source trees (`tracker-error-taxonomy.ts`); a string literal beginning `tracker.` elsewhere in those two trees fails a scan naming file and construct, while the pre-existing `tracker.*` vocabulary in core, CLI, and MCP stays outside the scan and unchanged.

| Class id | Delivered identity and discriminator |
|---|---|
| `tracker.capability.unsupported` | The capability-gap declaration — operation plus closed reason. Proven structurally by the coverage gates and the declared-gap encounter rule, never by a fixture family and never as an adapter failure. |
| `tracker.auth.rejected` | The adapter-local payload failure carrying `httpStatus` 401 or 403. A missing credential stays the credential-resolution identity, outside the taxonomy. |
| `tracker.transport.failed` | The same payload identity carrying no `httpStatus`. |
| `tracker.payload.invalid` | The payload failure with any other status, an adapter-local refusal with zero provider requests, or an undecodable success body. |

Classification is a total projection over five observable outcomes in fixed order: capability gap, adapter refusal, no response, a read's explicit 404 (a truthful absence outside the taxonomy), then any other status or undecodable success. A write's 404 stays the payload class. Classification reads structured fields only — status presence and value, or absence — and never provider prose.

Six closed trap families form the vocabulary, and every adapter accounts for every one: `auth-shape`, `transport-failure`, `rate-limit`, `payload-shape`, `workflow-state-mismatch`, and `pagination-truncation`. The first five prove a class. `pagination-truncation` is not an error class: it is a bounded observation over a declared page bound and the read's reported page count.

Per adapter and family the posture is exactly one of three values, stated against the operation that family exercises:

- **covered** — at least one committed offline fixture replayed through the production client for an operation that declares the structure the family observes, plus the catalog entries that prove it.
- **gap-backed** — that operation is a declared gap for the adapter, cited with its exact reason.
- **recorded-difference** — referencing the `(adapter, operation)` register entry whose class set explains why the family is unobservable.

The delivered square is 18 cells: 9 covered, 7 recorded-difference, 2 gap-backed.

| Adapter | Covered | Recorded difference | Gap-backed |
|---|---|---|---|
| github | all six families | — | — |
| gitlab | `transport-failure` | `auth-shape`, `rate-limit`, `payload-shape`, `pagination-truncation` (via `pagination-model` on `read-pipeline-run`) | `workflow-state-mismatch` (`transition-work-item`) |
| jira | `transport-failure`, `workflow-state-mismatch` | `auth-shape`, `rate-limit`, `payload-shape` | `pagination-truncation` (`read-pipeline-run`, `provider-unsupported`) |

A family never holds both a fixture and a gap posture, an unaccounted family fails naming adapter and family, and a vacuous `covered` is a failure. Trap-catalog entries keep their four-field shape; the family mapping is separate declared data that references entry names, so no catalog migration and no schema growth occurs.

## Simulated stateful tracker double

`createStatefulTenantTransport` in `stateful-double.ts` is a runtime-neutral, purely in-memory implementation of the existing conformance transport seam. A tenant may declare an optional initial state, a route table as delivered, and one optional effect per route drawn from a closed five-effect vocabulary — `set-field`, `reset-field`, `replace-collection`, `append-entry`, and `mark-resolved` — applied when the route matches. A write-then-read sequence therefore observes through the production client factory what an earlier write declared, with no change to flows, step ids, assertion families, or registrations.

Determinism is structural: resource identities come from the declared tenant, created-entry identities from a declared sequence, and ordering from declaration order — never a clock, randomness, or an ambient counter. The canonical state is sorted-key JSON, so two identical replays produce identical canonicalized state, identical normalized reads, and identical reported results. Failure is closed and loud: an unfixtured request, an undeclared effect, an effect whose operands do not resolve, or an `append-entry` with no declared identity sequence fails by name and never degrades to a silent no-op or a live call.

The extension is additive. A tenant with no declared state and no route effect replays exactly as before, so the committed stateless tenants keep identical projections, step order, skip kinds, skip reasons, and diagnostics. The double lives with the suite in testkit; fixture loading and both offline guards stay under `tests/`, and the double imports no `node:*` or `bun:*` module and reads no ambient environment, clock, or randomness.

## Registration-only participation

A new adapter supplies exactly five declared items and no sixth lifecycle, port, phase, or runner artifact: a contract drawn from the closed operation set, one registration binding a client builder over tenant, credential port, and injected transport, one parity-matrix column, one mock-tenant fixture set, and one trap catalog. A requirement outside that set — an operation outside the closed set, a lifecycle hook, a per-adapter runner branch — is refused by name.

The proof is twofold. First, an invariant over a named module set — the flow registry, the coverage gates, the artifact module, the harness registry, the parity engine, the taxonomy table, and the double — requires zero adapter identity constructs under the binding definition: a full-value provider-name or provider-contract string literal wherever it appears, including a comparison operand, or a provider-discriminant comparison or branch. The artifact's redaction labels and provider-host URL patterns are not constructs, because they name a content family to redact rather than an adapter to dispatch. Permitted homes are enumerated exactly: the registration list, the parity matrix's columns as values derived from the registration list, provider fixtures, the provider-tagged addressing types and derived read-failure union, the addressing decode, and one pinned engine exception — the runner's addressing-derived expected entity identity with its five provider comparisons, recorded as delivered rather than as an approved pattern. The scan is pinned to that allowlist by file, construct, and occurrence count, so a new branch cannot be absorbed quietly.

Second, a composition-injected control adapter — passed through the runner's adapter list, never added to the shipped registry — produces a passing run with a complete matrix column consistent with its capability declaration and a complete six-family accounting validated by the delivered accounting rules: the four families its `read-work-item` operation exercises are `covered` by its own catalog and fixture set, and the two whose operation it declares unsupported are `gap-backed` with that exact `provider-unsupported` reason. Because the suite forbids comparing against a moving base ref, the "no module changed" half is proof-by-construction: the run cannot be green without the delivery participation seam. The shipped registry stays exactly the three shipped provider contracts, and a registration that names no declared provider contract is still rejected by name.

## Mock tier

Mock tenants are declarative data under `tests/fixtures/providers/conformance/{github,gitlab,jira}/tenant.json`. Each tenant carries a provenance marker, an example-only instance, a credential reference, provider addressing, an ordered route table (method plus exact URL, with `GET` as the default method), and one expected projection per executed step — the normalized read view, the write's returned identity or normalized view, or the landing outcome. Write routes cover the supported writes on GitHub and Jira: the closeout writes including the GraphQL thread-resolution endpoint, the GitHub issue-comment create (projected as the returned comment identity), the delivery-request content-write create (`POST /pulls`) and update (`PATCH /pulls/{n}`, projected as the normalized delivery-request view), and the provider-side landing (`PUT /pulls/{n}/merge`, projected as the provider-supplied squash identity). Replay goes through the production client factories with an injected transport; an unfixtured request throws naming the method and URL. A tenant may additionally declare an optional initial state and one declared effect per route, replayed through the stateful double; a tenant that declares neither replays exactly as the stateless exact-URL tenant. The suite installs a throwing-`fetch` guard and a child-process guard and asserts zero calls on each: every CLI path takes an injected runner, so a live spawn can only mean a composition mistake. The same tenant data replayed twice produces identical reports, step order, skip reasons, and diagnostics.

GitHub's transport is also proven for parity rather than only for reachability: the same replayed tenant routes are driven through the CLI transport and through the native-`fetch` transport, and the normalized views, failure identities, structured statuses, and page counts must be identical. The probe and the selection value belong to the composition edge and are asserted there — one probe for a composing invocation and none on a self-description path — so no probe runs in this tier.

The mock suite performs zero live network calls and spawns zero live child processes. Fixture hosts use example-only domains and declared placeholders; the fixtures stay inside the committed sanitization audit.

## Live tier

The live tier runs the same registry and primitive invariants against configured scratch GitHub and GitLab tenants and a Jira sandbox. It uses a native-fetch transport wrapped by a recording transport and the process credential port. The flow registry, assertion code, clock, run id, transport, and artifact writer are injected, so the entrypoint is a composition edge rather than a fork of the suite.

Live v1 executes read steps only. A supported non-read step is recorded as a `live-read-only` deferral and never dispatches; an unsupported non-read step records its declared gap. Every recorded request must be `GET`; a non-`GET` request fails the run. The artifact always records `mutationRequests` and `createdArtifacts`; v1 records zero for both. Strict teardown in v1 is this zero-mutation property rather than a cleanup procedure: no live step creates a provider artifact, and write create/teardown is deferred.

A run with no configured provider is `not-configured`, exits `0`, and does not raise a false failure. A configured provider failure is `failed` and exits `1`. A configured run with no failures is `passed` and exits `0`. Every terminal status writes exactly one artifact.

## Artifact contract

The artifact schema is `delivery.conformance.v1`. Top-level fields are `schema`, `runId`, `tier`, `generatedAt`, `status`, `providers[]`, `flows[]`, `steps[]`, `mutationRequests`, `createdArtifacts`, and `totals`.

- `providers[]` entries carry `provider`, `adapterName`, `status`, `missingSettings`, and `flows[]`. Each provider flow entry is a summary carrying exactly `flowId`, `name`, and `status`; it carries no `steps`.
- Top-level `flows[]` carries the canonical per-flow results: `provider`, `flowId`, `name`, `status`, and ordered nested `steps[]`.
- Top-level `steps[]` is the flat index of the same step results: `provider`, `flowId`, `stepId`, `operation`, `status`, `skipReason`, `skipKind`, `assertionCount`, and optional `failure`.
- Provider and overall statuses are the closed set `passed`, `failed`, `not-configured`.
- Step statuses are `executed`, `skipped`, `failed`.
- Flow statuses are `passed`, `failed`, `skipped`.
- `skipKind` is the closed set `declared-gap`, `capability-absent`, `live-read-only`. An executed or failed step carries `null`; a skipped step must carry one.
- Failure diagnostics carry an assertion name, scalar expected and received values, a fixture or request reference, and bounded free-text detail. The validator rejects authorization headers, bearer and provider tokens, private keys, email addresses, avatar URLs, and the `raw-provider-payload` marker.

The artifact is bounded. The finite positive caps are 16 providers, 16 flows, 64 steps per flow, 512 total steps, 16 missing settings per provider, 1024 characters of failure detail, and 262144 bytes (256 KiB) of serialized artifact. The serializer redacts the forbidden shape families, truncates free text with a visible `…[truncated]` marker, and rejects non-scalar expected/received values.

Parity is not serialized into the artifact. The schema keeps its field set, closed statuses, skip kinds, and bounds; it carries no parity dimension, no cell or register reference, and no parity verdict, and no artifact validator changes meaning. A parity verdict is a gate result with its own diagnostics.

## Live configuration

A provider is configured only when every documented non-secret setting and its token source key are present and non-empty (non-whitespace) in the injected environment record. An unset GitHub Actions repository variable or secret materialises as a present empty-string key; that present-but-empty shape is `not-configured` with exit `0`.

| Provider | Non-secret repository variables | Token repository secret |
|---|---|---|
| GitHub | `CONFORMANCE_LIVE_GITHUB_BASE_URL`, `CONFORMANCE_LIVE_GITHUB_OWNER`, `CONFORMANCE_LIVE_GITHUB_REPO`, `CONFORMANCE_LIVE_GITHUB_ISSUE_NUMBER`, `CONFORMANCE_LIVE_GITHUB_PULL_NUMBER`, `CONFORMANCE_LIVE_GITHUB_COMMIT_SHA` | `CONFORMANCE_LIVE_GITHUB_TOKEN` |
| GitLab | `CONFORMANCE_LIVE_GITLAB_BASE_URL`, `CONFORMANCE_LIVE_GITLAB_PROJECT_PATH`, `CONFORMANCE_LIVE_GITLAB_MR_IID`, `CONFORMANCE_LIVE_GITLAB_COMMIT_SHA` | `CONFORMANCE_LIVE_GITLAB_TOKEN` |
| Jira | `CONFORMANCE_LIVE_JIRA_BASE_URL`, `CONFORMANCE_LIVE_JIRA_ISSUE_KEY` | `CONFORMANCE_LIVE_JIRA_TOKEN` |

The live configuration reader lives under `tests/`, outside the production-source secret-read scan. It retains only a non-empty occupancy classification for each token source key and never stores, returns, logs, or emits a token value. Token material resolves exclusively through the adapters `./credentials` credential port. The missing-name list carries 15 names (GitHub 7, GitLab 5, Jira 3) when tenants are absent. No production source imports the reader.

## Security and boundaries

The conformance suite adds no secret-read allowlist entry. Testkit source imports no `node:*` or `bun:*` module and reads no ambient environment, clock, or randomness. Filesystem fixture loading, the process environment read, native fetch, the child-process module substitution that backs the guard, and artifact writing live only under `tests/`. The suite adds no package, subpath, dependency, or export-map edge, and `@delivery-os/adapters/io` remains undeclared. The scheduled workflow has no pull-request or push trigger, job-scoped `contents: read`, SHA-pinned actions, token secrets scoped to the live step, an always-run artifact upload, and Bun resolved from `.bun-version`.

## Quality assurance

The mock suite rides `pnpm test` in the existing TypeScript jobs; no workflow job is added to the pinned CI topology. The parity gate and the double-backed flows ride the same aggregate test path inside the existing TypeScript test job, so the topology contract stays green with zero workflow file, job, trigger, permission, or upload changes. Structure tests cover the registry, adapter binding, declaration-only provider-contract scan, structural coverage, the 18-cell family accounting with its catalog-to-family bijection, and the registration-participation scan. Conformance tests cover the per-provider matrices, runtime coverage, determinism, exact-URL replay, cross-transport parity, the broken-adapter control, the parity matrix and its nine-clause gate, the tracker taxonomy and family classification, the stateful double and its fail-closed refusals, the composition-injected control registration, the artifact contract, and the live entrypoint. The workflow contract test rejects every drift, including trigger, permission, pin, secret-scope, upload-path, and retention mutations, and a topology pin asserts the exact workflow file, job-id, trigger, and check-name sets.

The evidence lives in `tests/conformance/mock-conformance.test.ts`, `tests/conformance/github-transport-parity.test.ts`, `tests/conformance/broken-adapter-control.test.ts`, `tests/conformance/artifact.test.ts`, `tests/conformance/parity-gate.test.ts`, `tests/conformance/tracker-taxonomy.test.ts`, `tests/conformance/family-classification.test.ts`, `tests/conformance/stateful-double.test.ts`, `tests/conformance/control-registration.test.ts`, `tests/conformance/harness-classification.test.ts`, `tests/conformance/harness-liveness.test.ts`, `tests/conformance/live/`, `tests/structure/conformance-coverage.test.ts`, `tests/structure/conformance-family-accounting.test.ts`, `tests/structure/registration-participation.test.ts`, `tests/structure/ci-topology-pin.test.ts`, `tests/checks/parity-gate-wiring.test.ts`, `tests/checks/tracker-literal-scan.test.ts`, and `tests/checks/conformance-workflow.test.ts`. The broken-adapter control wraps the production client, corrupts one normalized view, and must fail naming provider, flow, step, operation, and assertion while the unmodified client passes the same flow. The parity gate loads the committed matrix, the register, and the observation record, applies the structural mutation set plus at least one observation mutation per dimension, and asserts each failure names its provider, operation, and clause.

## Related documentation

- [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md)
- [Adapter Reference Behavior](feature-adapter-reference-behavior.md)
- [Provider Client Seeds and Trap Catalogs](feature-provider-client-seeds.md)
- [Closeout Transaction](feature-closeout.md)
- [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md)
- [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md)
- [ADR-0005](../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md)
- [TDR-0008](../../decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md)
- [TDR-0036](../../decisions/TDR-0036-cross-adapter-parity-matrix-declared-difference-register.md) declares the parity matrix, the class-set difference register, the six-dimension basis, and the gate's nine clause ids.
- [TDR-0037](../../decisions/TDR-0037-tracker-error-taxonomy-delivered-identities.md) maps the four tracker error classes onto delivered structured identities and declares the six trap families.
- [TDR-0038](../../decisions/TDR-0038-simulated-stateful-tracker-double-declared-effects.md) declares the simulated stateful tracker double and its five-effect vocabulary.
- [TDR-0039](../../decisions/TDR-0039-registration-only-adapter-extensibility-proof.md) declares registration-only participation, the identity-construct scan, and the synthetic registration proof.
- [Harness Adapters](feature-harness-adapters.md) adds the harness conformance registry beside the provider registry: exactly the two shipped harnesses, each covering the six-scenario classification floor and a liveness read over injected facts.
