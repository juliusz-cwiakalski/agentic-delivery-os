---
ados_distribution: internal
id: SPEC-ADAPTER-CONFORMANCE
status: Current
created: 2026-11-01
last_updated: 2026-11-01
owners: ["engineering"]
service: delivery-os provider adapters
summary: "The provider-agnostic adapter conformance suite: one three-flow registry over the closed adapter operations, capability-gated execution with explicit declared-gap skips, deterministic exact-URL mock tenants, structural and runtime coverage gates, the delivery.conformance.v1 artifact, and a scheduled read-only live evidence tier."
links:
  related_changes: ["GH-189"]
  related_decisions: ["ADR-0003", "ADR-0005"]
---

# Feature: Adapter Conformance Suite

## Overview

The adapter conformance suite proves that every shipped provider adapter responds to the same three primitive flow families in the same vocabulary: change lifecycle, comment provenance, and label semantics. It lives in the private, dev-only `@delivery-os/testkit` package. The flow registry is provider-agnostic; provider-specific behavior enters only through the conformance adapter registry and the declarative mock tenants.

The suite has two tiers. The mock tier runs inside the existing `pnpm test` path — and therefore inside the existing TypeScript test jobs — with zero live network calls. The live tier is scheduled read-only evidence against configured scratch tenants, not a merge gate; it records a versioned `delivery.conformance.v1` artifact in every terminal status.

## Flow registry

The registry is exactly three flows and twelve ordered steps. Flow and step ids are stable data used in failures and in the artifact.

| Flow | Steps | Operations |
|---|---|---|
| `change-lifecycle` | read-work-item, read-delivery-request, read-pipeline-run, open-change, transition, create-delivery-request, comment | `read-work-item`, `read-delivery-request`, `read-pipeline-run`, `write-work-item`, `transition-work-item`, `write-delivery-request`, `write-comment` |
| `comment-provenance` | read-comments, carrier-roundtrip | `read-work-item`, `write-comment` |
| `label-semantics` | read-labels, replace, sweep | `read-work-item`, `write-work-item` |

Together the registry represents all seven closed adapter operations. Merge, deploy-trace, pipeline-trace, and dedicated transition-mapping flows remain deferred.

## Adapter registry

The conformance adapter registry is the sole participant list. It registers exactly the three shipped provider contracts — GitHub, GitLab, and Jira — and each registration binds the imported contract, the addressing the flows need, and a client builder over the tenant instance, credential port, and injected transport. Placeholder `azure`/`ci` subpaths and non-provider I/O adapters are not registered. A structural scan of exported `*_ADAPTER_CONTRACT` bindings under `packages/adapters/src` fails when a provider contract has no registration or a registration names no declared contract.

## Capability gating

Execution is capability-gated per adapter. A step whose operation is in the adapter's `supportedOperations` executes against the adapter's mock tenant and applies the step's primitive assertion family. A step whose operation is unsupported records an explicit `skipped` result carrying the adapter's declared gap reason. An unsupported operation with no declared gap fails closed rather than producing an anonymous skip.

A supported operation with no executing step, or a declared gap whose operation is never encountered, fails the coverage gate. The comment-provenance carrier roundtrip executes only when the adapter declares both a writable and a readable carrier. A shipped adapter with no carrier records the `write-comment` declared-gap skip when that operation is unsupported, or a `no-declared-carrier` capability-absent skip when `write-comment` is supported with empty carrier arrays.

Production registrations never carry a write handler. A supported non-read control step without a test-only handler fails closed naming the provider, flow, step, and operation; controls are injected only through the runner's adapter list.

## Coverage gates

The structural gate proves the registry and every adapter declaration are complete: unique flow and step ids, membership in the closed operation set, all seven operations represented, per-adapter supported operations and declared gaps each backed by a step and together covering every closed operation, declared carriers backed by a carrier step, and no adapter that declares no operations. The runtime gate proves execution is non-vacuous: at least one executed step per adapter, every supported operation executed (or, in live mode only, recorded as a `live-read-only` deferral), every declared gap encountered with its exact reason, every declared carrier exercised, and no failed step counted as passed. Every violation names the registry, provider, flow, step, or operation at fault.

## Mock tier

Mock tenants are declarative data under `tests/fixtures/providers/conformance/{github,gitlab,jira}/tenant.json`. Each tenant carries a provenance marker, an example-only instance, a credential reference, provider addressing, an ordered exact-URL route table, and one expected normalized projection per executed read step. Replay goes through the production client factories with an injected transport; an unfixtured request throws naming the method and URL. The suite installs a throwing-`fetch` guard and asserts zero calls. The same tenant data replayed twice produces identical reports, step order, skip reasons, and diagnostics.

The mock suite performs zero live network calls. Fixture hosts use example-only domains and declared placeholders; the fixtures stay inside the committed sanitization audit.

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

## Live configuration

A provider is configured only when every documented non-secret setting and its token source key are present and non-empty (non-whitespace) in the injected environment record. An unset GitHub Actions repository variable or secret materialises as a present empty-string key; that present-but-empty shape is `not-configured` with exit `0`.

| Provider | Non-secret repository variables | Token repository secret |
|---|---|---|
| GitHub | `CONFORMANCE_LIVE_GITHUB_BASE_URL`, `CONFORMANCE_LIVE_GITHUB_OWNER`, `CONFORMANCE_LIVE_GITHUB_REPO`, `CONFORMANCE_LIVE_GITHUB_ISSUE_NUMBER`, `CONFORMANCE_LIVE_GITHUB_PULL_NUMBER`, `CONFORMANCE_LIVE_GITHUB_COMMIT_SHA` | `CONFORMANCE_LIVE_GITHUB_TOKEN` |
| GitLab | `CONFORMANCE_LIVE_GITLAB_BASE_URL`, `CONFORMANCE_LIVE_GITLAB_PROJECT_PATH`, `CONFORMANCE_LIVE_GITLAB_MR_IID`, `CONFORMANCE_LIVE_GITLAB_COMMIT_SHA` | `CONFORMANCE_LIVE_GITLAB_TOKEN` |
| Jira | `CONFORMANCE_LIVE_JIRA_BASE_URL`, `CONFORMANCE_LIVE_JIRA_ISSUE_KEY` | `CONFORMANCE_LIVE_JIRA_TOKEN` |

The live configuration reader lives under `tests/`, outside the production-source secret-read scan. It retains only a non-empty occupancy classification for each token source key and never stores, returns, logs, or emits a token value. Token material resolves exclusively through the adapters `./credentials` credential port. The missing-name list carries 15 names (GitHub 7, GitLab 5, Jira 3) when tenants are absent. No production source imports the reader.

## Security and boundaries

The secret-read allowlist stays exactly four entries. Testkit source imports no `node:*` or `bun:*` module and reads no ambient environment, clock, or randomness. Filesystem fixture loading, the process environment read, native fetch, and artifact writing live only under `tests/`. The suite adds no package, subpath, dependency, or export-map edge, and `@delivery-os/adapters/io` remains undeclared. The scheduled workflow has no pull-request or push trigger, job-scoped `contents: read`, SHA-pinned actions, token secrets scoped to the live step, an always-run artifact upload, and Bun resolved from `.bun-version`.

## Quality assurance

The mock suite rides `pnpm test` in the existing TypeScript jobs; no workflow job is added to the pinned CI topology. Structure tests cover the registry, adapter binding, declaration-only provider-contract scan, and structural coverage. Conformance tests cover the per-provider matrices, runtime coverage, determinism, exact-URL replay, the broken-adapter control, the artifact contract, and the live entrypoint. The workflow contract test rejects every drift, including trigger, permission, pin, secret-scope, upload-path, and retention mutations.

The evidence lives in `tests/conformance/mock-conformance.test.ts`, `tests/conformance/broken-adapter-control.test.ts`, `tests/conformance/artifact.test.ts`, `tests/conformance/live/`, `tests/structure/conformance-coverage.test.ts`, and `tests/checks/conformance-workflow.test.ts`. The broken-adapter control wraps the production client, corrupts one normalized view, and must fail naming provider, flow, step, operation, and assertion while the unmodified client passes the same flow.

## Related documentation

- [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md)
- [Provider Client Seeds and Trap Catalogs](feature-provider-client-seeds.md)
- [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md)
- [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md)
- [ADR-0005](../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md)
