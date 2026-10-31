---
ados_distribution: internal
id: SPEC-PROVIDER-CLIENT-SEEDS
status: Current
created: 2026-10-31
last_updated: 2026-10-31
owners: ["engineering"]
service: delivery-os
summary: "The first real provider clients behind the primitive ports: GitLab, Jira, and a minimal GitHub read slice in the adapters package's per-provider subpaths, with normalized primitive views, honest capability/gap declarations, offline trap catalogs proven against sanitized hand-authored synthetic fixtures, credential-port-exclusive auth, declared custom-field and merge-status mappings, uniform absence semantics, bounded GitHub collection reads under the existing operations, and the reviewed runtime-API confinement admission."
links:
  related_changes: ["GH-188", "GH-175"]
  related_decisions: ["ADR-0003", "ADR-0004", "ADR-0005", "ADR-0006"]
---

# Feature: Provider Client Seeds and Trap Catalogs

## Overview

The tracker and VCS client layer begins with three provider seeds in the adapters package's per-provider subpaths: Jira (`adapters ./jira`), GitLab (`adapters ./gitlab`), and GitHub (`adapters ./github`). Each is a factory-built client that implements behind the delivered primitive ports and returns only normalized views — `WorkItem`, `DeliveryRequest`, and `PipelineRun` — plus an `AdapterContract` capability declaration. Provider-native payload types never cross the subpath surface.

The seeds are read slices. Jira resolves issues and search-shaped tracker queries; GitLab reads merge requests and the pipelines reported for a commit; GitHub reads issues, pull requests, check runs per commit SHA, one bounded page of open issues, and one bounded page of open pull requests. Write operations are declared gaps rather than implied parity: Jira and GitHub gap every write, and GitLab gaps writes and work-item reads. The Jira read slice answers the four M0-S6 tracker-collector query families — owner hand-backs, blocked dependencies, stalls, and ticket hygiene — from normalized `WorkItem` data alone. The GitHub collection reads are the query-shaped form of the existing read operations, so the closed operation set and capability declaration stay unchanged.

Every known provider quirk is captured as a trap-catalog entry: a named data record pairing the provider behavior, the expected normalized outcome at the port boundary, and one or more fixture references. The catalogs and the fixtures they cite are committed test assets; trap suites replay the fixtures through the production clients with zero live network calls. Fixtures are hand-authored synthetic captures modeled on recorded provider response shapes, sanitized before commit, and marked with their provenance.

Authentication is credential-port exclusive. Each client receives an `ExternalSystemInstance`, a `CredentialPort`, and an injectable transport; it resolves the instance's declared credential reference on every request and never reads the ambient environment. The runtime-API confinement allowance admits the three provider client subpaths as exact, reason-bearing entries while the provider registry stays non-I/O; the secret-read allowlist remains exactly four entries. Provider truth is carried as declared data where the v1 contract has no destination: custom-field mapping rules and merge-status tables live beside the normalized view, and optional `WorkItem` fields use one uniform absence rule.

The port substrate is described in [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md); the surrounding workspace and boundary mechanism in [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md); failure identity in [Result Contract and Error Table](feature-result-contract.md). Package placement follows [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md); the contract extensions follow [ADR-0004](../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md) and [ADR-0006](../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md); the confinement refinement follows [ADR-0005](../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md).

## Business Context

### Problem Statement

- **Problem:** No provider client can read a tracker or VCS system behind the primitive ports, so status, verify, closeout, and conformance stories have no provider facts to consume. When clients arrive without trap discipline, provider quirks — label replacement, custom-field typing, data-driven transitions, comment omission, pipeline multiplicity, and asynchronous merge status — leak into higher layers as silent misinterpretations of provider state.
- **Affected Users:** The status collector, verify-change gates, closeout, conformance suite, and full GitHub adapter authors; operators and agents consuming provider facts; security reviewers responsible for credential centralization and the I/O boundary.
- **Business Impact:** The seeds are the first real consumers of the adapter contracts. A seed that overclaims capability, flattens a quirk, or reads a secret outside the credential port converts the whole adapter layer into untrustworthy input for every downstream engine.

### Goals

- Return normalized primitive views from three provider read slices behind the delivered ports.
- Declare supported operations and explicit gaps from the closed operation set, with no implied parity.
- Prove every ticket-named provider quirk offline against committed sanitized fixtures, with a firing negative control.
- Answer the four M0-S6 tracker query families from normalized `WorkItem` data.
- Resolve every credential through the credential port, with zero growth of the secret-read allowlist.
- Keep provider network I/O in its declared home with an exact, reason-bearing runtime-API confinement admission.

## User Experience & Functionality

### Client seeds

Each seed is a factory result, never a module-level singleton. Construction takes the instance, the credential port, an optional transport (defaulting to native `fetch` inside the provider subpath), and the provider-specific addressing data.

| Seed | Public surface | Supported operations | Addressing input |
|------|----------------|----------------------|------------------|
| Jira | `createJiraClient`, `JiraClient`, `JiraClientOptions`, `JIRA_ADAPTER_CONTRACT` | `read-work-item` | Issue key passed to `readWorkItem`; JQL passed to `searchWorkItems`. |
| GitLab | `createGitLabClient`, `GitLabClient`, `GitLabClientOptions`, `GITLAB_ADAPTER_CONTRACT` | `read-delivery-request`, `read-pipeline-run` | `projectPath` plus the merge-request IID or commit SHA. |
| GitHub | `createGitHubClient`, `GithubClient`, `GithubClientOptions`, `GithubRepositoryRef`, `GITHUB_ADAPTER_CONTRACT` | `read-work-item`, `read-delivery-request`, `read-pipeline-run` | `repository` (`owner`, `name`) plus the issue/PR number or commit SHA. |

Client operations:

- **Jira:** `readWorkItem(issueKey)` returns one `WorkItem`; `searchWorkItems(jql)` returns a `WorkItem` set from a search-shaped response.
- **GitLab:** `readDeliveryRequest(mergeRequestIid)` returns one `DeliveryRequest`; `readPipelineRun(commitSha)` returns every pipeline the provider reports for that commit as a `PipelineRun` set.
- **GitHub:** `readWorkItem(issueNumber)`, `readDeliveryRequest(pullNumber)`, and `readPipelineRun(commitSha, limit?)` return the corresponding normalized views. `listWorkItems(limit)` returns one bounded page of open issues with pull-request objects filtered out; `listDeliveryRequests(limit)` returns one bounded page of open pull requests. Both list reads report the raw page size alongside the normalized items.

### Capability and gap posture

| Seed | Declared supported | Declared gaps |
|------|--------------------|---------------|
| Jira | `read-work-item` | `write-work-item`, `transition-work-item`, `write-comment` — `adapter-not-implemented`; `read-delivery-request`, `write-delivery-request`, `read-pipeline-run` — `provider-unsupported`. |
| GitLab | `read-delivery-request`, `read-pipeline-run` | `write-delivery-request`, `read-work-item`, `write-work-item`, `transition-work-item`, `write-comment` — `adapter-not-implemented`. |
| GitHub | `read-work-item`, `read-delivery-request`, `read-pipeline-run` | `write-work-item`, `write-delivery-request`, `transition-work-item`, `write-comment` — `adapter-not-implemented`. |

Every gap `{ operation, reason }` uses one of the closed reasons (`provider-unsupported`, `adapter-not-implemented`, `plan-restriction`). An operation absent from `supportedOperations` is unsupported; no seed declares an envelope-carrier surface (`writableCarriers` and `readableCarriers` are empty).

### Normalization behavior

**Jira.** An issue normalizes to `WorkItem` with provider-qualified identity, title, native status plus the delivery alias from the declared `WorkflowMap`, labels, optional assignee, typed relations, optional comments, and optional `updatedAt`. The workflow map covers `Backlog` → `backlog`, `To Do` → `ready`, `In Progress` → `in-progress`, `In Review` → `in-review`, `Done` → `done`, and `Won't Do` → `canceled`, each naming its transition mechanism (`manual`, `field-update`, `api-transition`, or `label-swap`). A native status outside the map fails the read visibly instead of flattening. Issue links normalize to the closed relation kinds `blocks`, `blocked-by`, and `relates-to`; unrelated link types are not represented.

**Jira custom fields.** The seed declares which provider custom fields feed normalized labels and the type each value is read as: `customfield_10020` as a `select` value rendered with the `team:` prefix, and `customfield_10021` as a `number` rendered with the `story-points:` prefix. A declared numeric value arriving as a numeric string is parsed to a number before rendering; a value that does not match its declared type is skipped. Unmapped custom fields are visibly unrepresented — no raw `customfield_*` key and no unmapped value crosses the boundary.

**Jira tracker queries.** The read slice answers the four M0-S6 query families from normalized data: owner hand-backs from assignee/ownership signals, blocked dependencies from `blocks`/`blocked-by` relations, stalls from `updatedAt` (absent = activity unknown), and ticket hygiene from label/status conformance plus custom-field conformance for mapped fields. No query requires a provider-native payload.

**GitLab.** A merge request normalizes to `DeliveryRequest` with identity, source and target refs, review state, and review threads. Merge status resolves through a declared rule table: `merged`, `closed`, and `locked` states are terminal; a draft request is `draft`; otherwise `detailed_merge_status` is authoritative when present and `merge_status` is the fallback, and a positive approvals count promotes a rule whose open-state mapping is `open` to `approved`. Asynchronous values such as `checking`, `unchecked`, `ci_still_running`, and `approvals_syncing` map to non-terminal states only; an unknown native value fails visibly.

**GitLab pipelines.** `readPipelineRun(commitSha)` returns every pipeline the provider reports for the commit, each with a distinct identity, closed-set job states, and trace-evidence references where the provider records a trace. Pipeline multiplicity is preserved; nothing is collapsed to a newest-wins singleton.

**GitHub.** A pull request normalizes to `DeliveryRequest` with identity, head/base refs, review state, and review threads. Merged, closed, and draft flags take precedence; otherwise the native review decision maps `APPROVED` → `approved`, `CHANGES_REQUESTED` → `changes-requested`, and `REVIEW_REQUIRED` → `open`, defaulting to `open`. Check runs per SHA normalize to one `PipelineRun` per run, each carrying one job; a failed run is never hidden behind a check-suite roll-up, and each run's identity includes the commit SHA. Issues normalize to `WorkItem` with labels, optional assignee, `open` → `ready` and `closed` → `done`, typed issue links, `updatedAt` from `updated_at` when present, and `comments` absent because this slice does not fetch the comment set.

### Absence semantics

Optional `WorkItem` fields follow one rule: absence means the provider did not supply the signal, so the value is unknown — never derived, fabricated, or collapsed into an empty value.

- `updatedAt` is the provider-native last-modified timestamp copied verbatim as an ISO-8601 UTC string. Absent means activity is unknown, not "no activity"; consumers must report "cannot determine" for absence.
- `comments` is the provider-asserted comment set. Absent means the comment set is unknown (omitted for permission or paging causes, or not fetched). Present — including an explicitly empty array — means the provider asserted that set, so an empty present array means genuinely no comments. An omitted payload never collapses into `[]`.
- `relations` is the provider-asserted relation set. The GitHub issue list does not supply structured issue links, so list-read issues carry `relations: []` only as the normalized value of an absent provider signal; consumers that need dependency truth must treat GitHub relations as unavailable rather than as an observed empty set. The same rule applies to review state and review threads on the GitHub pull-request list: the list payload carries no review decision or thread data, so those item signals are unknown, never open or zero.

### Credential resolution and error integration

Each client resolves the instance's declared credential reference through the injected `CredentialPort` on every request. An anonymous auth method sends unauthenticated headers; a credential-bearing method resolves the reference and attaches the material to the request headers. Resolved material is never stored on the client, logged, or returned in a normalized view.

An unresolvable credential surfaces the synchronized `config.credential.missing` failure (domain kind `config`, category `user`, retryable `false`, consequence `not_landed`, projection class `user-validation`). Provider payload and transport failures surface as the adapter-local `provider.payload.invalid` read failure with a detail string, never as a silent flattening or a raw provider error; these failures are not new error-table rows.

### Flows

1. **Read:** A consumer constructs an `ExternalSystemInstance`; the seed resolves its credential reference through the credential port; the injected transport issues the request; normalization returns a primitive view or a classified failure.
2. **Tracker query:** A collector supplies a JQL query; the Jira seed returns normalized `WorkItem` views; the four query families are evaluated from normalized fields only.
3. **Trap replay:** A trap entry names a quirk and its fixture; the suite replays the fixture through the production client with an injected transport; the expected normalized outcome is asserted without any network call.
4. **Fixture authoring:** A maintainer authors a synthetic fixture modeled on a documented provider response shape, applies the sanitization rules, records its provenance, commits it, and references it from one or more trap entries.

## Technical Architecture & Codebase Map

### Core components and directory structure

| Path | Responsibility |
|------|----------------|
| `packages/adapters/src/jira/index.ts` | The `adapters ./jira` public surface: client factory, types, and adapter contract. |
| `packages/adapters/src/jira/client.ts` | Jira read-slice factory, credential resolution per request, native-`fetch` transport, and HTTP failure mapping. |
| `packages/adapters/src/jira/normalize.ts` | Jira issue and search normalization to `WorkItem`. |
| `packages/adapters/src/jira/custom-fields.ts` | Declared custom-field mapping table and typed value reading. |
| `packages/adapters/src/jira/workflow-map.ts` | The Jira `WorkflowMap`, its closed-set validation, and native-status lookup. |
| `packages/adapters/src/jira/capabilities.ts` | The Jira `AdapterContract` capability declaration. |
| `packages/adapters/src/gitlab/index.ts` | The `adapters ./gitlab` public surface. |
| `packages/adapters/src/gitlab/client.ts` | GitLab read-slice factory and per-request credential resolution. |
| `packages/adapters/src/gitlab/normalize.ts` | Merge-request and pipeline-set normalization to `DeliveryRequest` and `PipelineRun`. |
| `packages/adapters/src/gitlab/merge-status.ts` | Declared merge-status rule table and review-state resolver. |
| `packages/adapters/src/gitlab/capabilities.ts` | The GitLab `AdapterContract` capability declaration. |
| `packages/adapters/src/github/index.ts` | The `adapters ./github` public surface. |
| `packages/adapters/src/github/client.ts` | GitHub read-slice factory and per-request credential resolution. |
| `packages/adapters/src/github/normalize.ts` | Pull-request, check-run, and issue normalization. |
| `packages/adapters/src/github/review-state.ts` | Declared review-decision and issue-status tables. |
| `packages/adapters/src/github/capabilities.ts` | The GitHub `AdapterContract` capability declaration. |
| `packages/adapters/src/io/provider-transport.ts` | The shared injectable transport seam: request/response types, read-result types, and the reified payload failure. Imported by the seeds through their relative `../io/` path; not a public subpath. |
| `tests/fixtures/providers/traps/{jira,gitlab,github}.traps.json` | The trap catalogs as four-field data entries with provenance. |
| `tests/fixtures/providers/{jira,gitlab,github}/**` | The sanitized hand-authored synthetic fixtures referenced by trap entries. |
| `tests/behaviour/providers/trap-harness.ts` | Catalog loading, schema validation, bidirectional coverage, and replay keyed by trap name. |
| `tests/fixtures/providers/sanitization/**` | The declared placeholder set and the planted-secret canary cases. |

### Data architecture and constants

| Element | Value / rule |
|---------|--------------|
| Trap-catalog entry | Exactly four fields: `trapName`, `providerBehavior`, `expectedNormalizedOutcome`, `fixtureReference` (one reference or a non-empty list). |
| Trap-catalog coverage | GitLab 3 entries, Jira 5 entries, GitHub 7 entries; every entry has a matching assertion and every assertion has an entry. |
| Fixture reference | A repository-relative `path` or `path#/json-pointer`, so references survive fixture re-authoring. |
| Fixture provenance | Every fixture and catalog carries a `provenance` marker naming its synthetic origin and date. |
| Fixture set | 21 committed JSON fixtures under the provider fixture area, including four GitHub list fixtures. |
| GitHub collection reads | One bounded page per read: `state=open`, the declared `per_page` limit, and updated-descending sort. Issue-list pull-request objects are filtered before normalization while the raw page size is preserved; the pull-request list reports refs, draft, and state only. |
| Check-runs page limit | One bounded page at `per_page=STATUS_SOURCE_PIPELINE_LIMIT` (20), no pagination; the client returns the raw page size with the normalized runs. |
| Jira custom-field mappings | `customfield_10020` (`select`, `team:` prefix) and `customfield_10021` (`number`, `story-points:` prefix). |
| Jira workflow states | Six native statuses mapped to the closed delivery-alias set. |
| GitLab merge-status rules | A declared table over the observed native values, with a terminal flag and an open-state review mapping per row. |
| GitHub review decisions | `APPROVED`, `CHANGES_REQUESTED`, `REVIEW_REQUIRED`, with merged/closed/draft flags taking precedence. |
| GitHub issue statuses | `open` → `ready`, `closed` → `done`. |

### API and interface contracts

- **`createJiraClient({ instance, credentials, transport? })`** returns `{ readWorkItem, searchWorkItems }`; each operation returns `ProviderReadResult<T>`.
- **`createGitLabClient({ instance, credentials, projectPath, transport? })`** returns `{ readDeliveryRequest, readPipelineRun }`.
- **`createGitHubClient({ instance, credentials, repository, transport? })`** returns `{ readWorkItem, readDeliveryRequest, readPipelineRun, listWorkItems, listDeliveryRequests }`.
- **`readPipelineRun(commitSha, limit?)`** reads one check-runs page, defaulting `limit` to `STATUS_SOURCE_PIPELINE_LIMIT`, and returns `{ items, pageItemCount }`; `listWorkItems(limit)` and `listDeliveryRequests(limit)` each read one bounded page and return `{ items, pageItemCount }`.
- **`ProviderTransport.send(request)`** returns a provider response with a status and an untrusted body; tests inject a fixture transport, and production defaults to native `fetch` inside each provider subpath.
- **`ProviderReadResult<T>`** is either `{ ok: true, value }` or a `CredentialResolutionFailure` or `ProviderPayloadFailure` (`provider.payload.invalid` with a detail).

All three subpath surfaces export only the client factory, its core-built input/return types, and the adapter contract. The GitHub subpath exports five names: `createGitHubClient`, `GithubClient`, `GithubClientOptions`, `GithubRepositoryRef`, and `GITHUB_ADAPTER_CONTRACT`. The shared transport module is internal, imported relatively; the package's `#io/*` alias remains an internal import map, not a published export.

### Collection-read operation rule

Collection reads are the query-shaped form of the existing read operations, following the Jira `searchWorkItems` precedent. `listWorkItems` stays `read-work-item`; `listDeliveryRequests` stays `read-delivery-request`; the page-limited check-runs read stays `read-pipeline-run`. `GITHUB_ADAPTER_CONTRACT.supportedOperations` and every declared write gap are unchanged, no new list operation joins the closed operation set, and no declared read gap becomes supported. A future collection read follows the same rule and extends the trap catalog with fixtures and matching assertions in the same change.

### Intra-package imports and packed exports

Shared adapter support modules under `src/io/` are imported by the provider seeds through relative `../io/*.js` specifiers, not through the `#io/*` imports alias. The alias is src-mapped (`./src/io/*.ts`), which resolves only in the repository; a packed adapter tarball ships `dist` only, so the alias would dangle after install. The relative `.js` specifier resolves to the built sibling in both the workspace and the tarball, so it is the only spelling that preserves packed-export parity. This is a deliberate, narrow exception to the alias-only intra-package import rule; `src/io/provider-transport.ts` states the same reason in its module header so a future reader does not "fix" the specifiers. A dist-conditioned `#io` alias would be a reviewed change, not a local rewrite.

## Security and Boundaries

- Credential material is reachable only through `CredentialPort`; no client module reads `process.env`, `Bun.env`, `Deno.env`, or any other ambient source.
- The secret-read allowlist remains exactly four entries: the credential implementation directory and the three configuration environment readers. The provider client subpaths add no entry and no `credential-material` reader.
- Runtime-API confinement admits the `core` state driver edge, the non-provider adapter I/O subpaths (`repo`, `file`, `host`, `session`, `legacy`, `credentials`), the three provider client subpaths (`github`, `gitlab`, `jira`) as exact, reason-bearing entries per ADR-0005, the `cli` build, and the `opencode` host integration. The provider registry subpath and the remaining adapter subpaths stay non-I/O; the allowance is never widened by pattern.
- Provider-native types and raw provider keys never cross a subpath surface. Normalization is the only place untrusted provider payloads are read.
- Committed fixtures contain no secret, token, credential, private-corpus identifier, personal data, or non-example provider host; placeholders are declared and stable.
- Resolved credential material never enters diagnostics, logs, failure payloads, or fixtures.

## Non-Functional Requirements

| Concern | Current guarantee |
|---------|-------------------|
| Normalized-view purity | 100% of returned artifacts are `WorkItem`, `DeliveryRequest`, or `PipelineRun`; 0 provider-native types exported past a subpath surface. |
| Capability honesty | 100% of capabilities come from the closed operation set; every unimplemented operation carries a declared gap with a valid reason. |
| Offline determinism | 100% of trap suites run against committed fixtures with 0 live network calls; replay is deterministic and re-runnable. |
| Bounded collection reads | 100% of issue, pull-request, and check-runs reads issue exactly one bounded page; the raw page size is reported and pull-request objects never enter the issue-list result. |
| Absent-signal honesty | 100% of absent GitHub relation, review-state, and review-thread signals surface as empty normalized relations or unknown consumer signals, never as fabricated dependencies, review states, or zero thread counts. |
| Trap-catalog completeness | Every catalog entry has exactly four fields, a resolvable fixture reference, and a matching assertion in both directions. |
| Fixture hygiene | 0 secrets, tokens, private identifiers, personal data, or non-example provider hosts in committed fixtures; placeholders and references are stable. |
| Credential centralization | Exactly 4 secret-read allowlist entries; 0 ambient environment reads in client code; planted violations still fire. |
| Confinement exactness | Only `github`, `gitlab`, and `jira` are admitted as provider I/O subpaths; `registry`, `azure`, and `ci` remain non-I/O and fail runtime-import negative controls. |
| Error visibility | Credential failures carry `config.credential.missing`; payload failures carry `provider.payload.invalid` with a detail; no failure is silently flattened. |

## Quality Assurance Strategy

| Level | Scope | Evidence |
|-------|-------|----------|
| Structure | Trap-catalog schema, four-field completeness, per-provider minima, stable fixture references; provider export-surface purity; `WorkItem` field shape | `tests/structure/trap-catalog.test.ts`, `tests/structure/provider-surface.test.ts`, `tests/structure/port-contract-inventory.test.ts` |
| Behaviour | Per-provider trap replay; Jira query families; GitHub status/verify input set; bounded GitHub collection reads and their negative controls; capability/gap inspection; credential classification | `tests/behaviour/providers/gitlab-trap.test.ts`, `jira-trap.test.ts`, `github-trap.test.ts`, `github-collection.test.ts`, `jira-queries.test.ts`, `github-inputs.test.ts`, `provider-capabilities.test.ts`, `provider-credentials.test.ts`, `trap-harness.test.ts` |
| Type level | Optional/readonly `updatedAt` and `comments`; normalized-view assignability without provider-native types | `tests/types/workitem-updated-at.type-test.ts`, `tests/types/workitem-comments.type-test.ts`, `tests/types/provider-views.type-test.ts` through the root `typecheck` |
| Checks | Fixture sanitization audit and planted-secret canary; secret-read boundary; boundary fixture coverage | `tests/checks/fixture-sanitization.test.ts`, `tests/checks/secret-read-boundary.test.ts`, `tests/boundaries/fixture-coverage.test.ts` |
| Boundaries | Confinement admission and non-exempt negative controls; fixture-coverage registry | `tests/boundaries/boundaries.test.ts`, `tests/boundaries/fixtures/cases.ts`, `tests/boundaries/fixture-registry.json` |
| Conformance | Three primitive flows against every shipped provider contract, capability-gated skips, exact-URL mock replay, structural/runtime coverage, and the broken-adapter control | `tests/conformance`, `tests/structure/conformance-coverage.test.ts`; see [adapter conformance suite](feature-adapter-conformance.md) |
| Aggregate | The whole workspace | `pnpm check` |

Evidence details are recorded in the change test plan at `doc/changes/2026-10/2026-10-31--GH-188--client-seeds-trap-catalogs/chg-GH-188-test-plan.md`.

## Operational & Support

### Configuration

Each client is constructed with a configured `ExternalSystemInstance` (instance name, system kind, base URL, auth method), the credential port, and provider addressing data: the Jira issue key or JQL at call time, the GitLab `projectPath`, or the GitHub `repository` (`owner`, `name`). The transport is an optional construction input; production omits it and receives the native-`fetch` transport. No ambient configuration, clock, or credential cache participates in a read.

### Observability

Capability declarations and gap records are inspectable data. Trap failures name the trap entry and its fixture reference, so a normalization regression is diagnosable without reading test code. Credential failures carry classified identity; payload failures carry a readable detail. Resolved secret material is never observable through a diagnostic path.

### Maintenance

Four surfaces grow deliberately: trap catalogs (new quirks join as four-field entries with fixtures; fixture references stay stable across re-authoring), the confinement allowance (further I/O claims are exact, reason-bearing reviewed extensions), capability declarations (a gap becomes supported only when its consuming story lands, with trap coverage extended in the same change), and collection reads (a list-shaped read stays a query-shaped form of an existing operation and extends the trap catalog in the same change). Fixtures age; scheduled read-only live revalidation is delivered by the [adapter conformance suite](feature-adapter-conformance.md). A transport or implementation-basis swap behind the port boundary requires no consumer change.

## Dependencies & Risks

- **Depends on** the monorepo scaffold for package tiers, subpath exports, boundary enforcement, and the aggregate check.
- **Depends on** the adapter ports for the primitive contracts, capability/gap mechanism, credential port, and secret-read boundary.
- **Depends on** the result contract for failure identity and the redaction chokepoint, and on the configuration and branding layers for injected environment facts and brand-neutral credential source keys.
- **Consumed by** the status collector (including its bounded GitHub collection reads), verify-change gates, closeout, the [adapter conformance suite](feature-adapter-conformance.md), and the full GitHub adapter.
- **Risk — fixture drift:** hand-authored fixtures can diverge from live provider behavior. Mitigation: dated provenance, stable references, and the scheduled read-only live revalidation delivered by the [adapter conformance suite](feature-adapter-conformance.md).
- **Risk — sanitization miss:** a committed fixture could leak a secret or personal data. Mitigation: declared placeholders, example-only hosts, a committed sanitization audit, and a planted-secret canary.
- **Risk — catalog rot:** a catalog can look complete while its assertions stop firing. Mitigation: bidirectional entry↔assertion coverage, a negative control that names the failing entry, and per-provider minima.
- **Risk — allowlist creep:** provider I/O could widen beyond the admitted subpaths. Mitigation: exact reason-bearing entries, registry/`azure`/`ci` negative controls, and a guard that rejects pattern widening.
- **Risk — secret-boundary erosion:** client code could acquire credentials ambiently. Mitigation: credential-port-only construction, the binding secret-read invariant, and a fixed four-entry allowlist.
- **Risk — capability drift:** a read-only seed could be invoked for writes. Mitigation: declared gaps for every unsupported operation and structure tests that pin the posture.
- **Risk — port-shape gap:** the first real adapters may expose contract-shape gaps. The first additive round — optional `updatedAt` and optional `comments` — executed under ADR-0004 and ADR-0006; further evolution stays additive within v1 and is governed by a decision record.

## Glossary & References

| Term | Definition |
|------|------------|
| Client seed | The first real provider client implementation behind the primitive ports for one provider, scoped to the operations its consuming stories need. |
| Read slice | The read-operation subset of a client, delivered before any write path. |
| Trap catalog | A named, data-reviewable set of entries pairing a provider quirk with the expected normalized outcome and its fixture; the durable record of each normalization rule. |
| Trap-catalog entry | One record with exactly four fields: trap name, provider behavior, expected normalized outcome, fixture reference. |
| Fixture provenance | The marker on a committed fixture or catalog naming its synthetic origin and date, distinguishing it from a live capture. |
| Sanitization | Authoring-time removal or stable-placeholder substitution of secrets, tokens, private-corpus identifiers, and personal data in fixtures. |
| Declared gap | An adapter's explicit `{ operation, reason }` record for an operation it does not support; parity is never implied. |
| Pipeline-per-commit normalization | Resolving provider pipeline multiplicity (branch/merge pipelines, per-SHA check runs) into a truthful per-commit `PipelineRun` set. |
| Tracker-collector queries | The four M0-S6 tracker query families: owner hand-backs, blocked dependencies, stalls, ticket hygiene. |

See also: [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md), [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md), [Result Contract and Error Table](feature-result-contract.md), the [repository glossary](../../overview/glossary.md), and [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md), [ADR-0004](../../decisions/ADR-0004-workitem-activity-timestamp-additive-v1.md), [ADR-0005](../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md), [ADR-0006](../../decisions/ADR-0006-workitem-custom-fields-and-comment-omission-representation.md).

**Change records:** `doc/changes/2026-10/2026-10-31--GH-188--client-seeds-trap-catalogs/` (the client seeds) and `doc/changes/2026-10/2026-10-31--GH-175--status-v1/` (the bounded collection reads and trap-catalog extension).
