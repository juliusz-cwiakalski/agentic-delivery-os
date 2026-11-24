---
ados_distribution: internal
id: SPEC-ADAPTER-PORTS
status: Current
created: 2026-10-30
last_updated: 2026-11-24
owners: ["engineering"]
service: delivery-os
summary: "The adapter-era contract substrate: nine typed provider-agnostic primitive ports in core ./contracts with capability/gap and carrier-kind declarations, the ten-operation closed adapter set including the provider-side landing and the milestone close, the additive HarnessInstance/HarnessSession/execution-environment port family, the additive optional DeliveryRequest.headSha merged-head identity and DeliveryRequest.title provider-asserted subject, the additive optional DeliveryThread root-author facts (login, normalized author kind, author association), the additive optional PipelineJob start and completion timestamps, the four optional verify-gates facts, resolve-delivery-thread, merge-delivery-request and close-milestone operations, the bounded adapter-local milestone read that adds no operation and no capability flag, the additive optional harness environment-variable marker, one credential-resolution port over the closed four-style source vocabulary (literal, environment-prefixed, command, harness-store) behind the strategy resolver at adapters ./credentials, the failure variant's three additive optional projection fields (source, reason, remedy) over the closed ten-member reason set, one-shot memoized resolution over the closed command allowlist, the live redaction registry with register-on-materialize, the provider engine's credential-port-only quota authorization, the binding secret-read boundary invariant, the read-only SessionStorePort and mutating SessionAdminPort implemented over the opencode-CLI-backed adapters ./session subpath, the dedicated git seam covering branch, checkout, precise staging, and commit-object creation plus the dispatch engine's one bounded fast-forward ensure-push act (the seam family's one remote-write operation), the declared inference network edge behind the commit primitive's transport seam, the bounded GitHub deploy-job trace, log-excerpt, and thread-discussion reads behind the existing ports, and the delivery.metadata.v1 embedded-envelope data contract with its adapter-internal codec, required injected content policy, fail-closed content-policy failure, and visible graceful degradation."
links:
  related_changes: ["GH-174", "GH-179", "GH-180", "GH-181", "GH-182", "GH-183", "GH-184", "GH-188", "GH-189", "GH-178", "GH-227", "GH-231", "GH-225", "GH-233", "GH-240", "GH-238", "GH-277", "GH-279", "GH-335", "GH-338", "GH-339", "GH-350", "GH-386", "GH-394"]
  related_decisions: ["ADR-0003", "ADR-0004", "ADR-0005", "ADR-0006", "ADR-0008", "ADR-0010", "ADR-0013", "ADR-0014", "TDR-0005", "TDR-0008", "TDR-0019", "TDR-0021", "TDR-0032", "TDR-0033", "TDR-0034", "TDR-0036", "TDR-0040", "TDR-0043", "TDR-0076", "ODR-0005"]
  contracts:
    - "packages/core/src/contracts/credentials.ts"
    - "packages/core/src/contracts/envelope.ts"
    - "packages/core/src/contracts/session.ts"
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/contracts/harness-telemetry.ts"
---

# Feature: Adapter Ports, Credential Resolution, and Embedded Metadata

## Overview

The adapter-era contract substrate is typed, provider-agnostic, and mechanically guarded. Nine primitive ports live in the runtime-neutral `@delivery-os/core/contracts` subpath as types and `as const` data only: `ExternalSystemInstance`, `AdapterContract`, `WorkItem`, `WorkflowMap`, `WorkItemRelation`, `DeliveryRequest`, `PipelineRun`, `RetryPolicy`, and `IdempotencyKey`. Each is keyed by its globally unique catalogue name; adapters implement behind the ports and never invent a parallel surface.

`AdapterContract` carries a typed capability declaration: the operations and metadata carrier kinds an adapter supports, plus explicit gap records for what it does not support. Absence of a capability flag is a machine-readable gap, never an implied parity claim.

Secret acquisition is centralized behind one `CredentialPort` in core. A caller resolves a declared credential reference to secret material at use time and receives either the material or the classified `config.credential.missing` failure carrying its three additive optional projection fields (`source`, `reason`, `remedy`). The single implementation is the strategy resolver over the closed four-style source vocabulary — `literal`, `environment-prefixed`, `command`, and `harness-store` — and it lives in the adapters package's I/O tier at the declared `./credentials` subpath, with every construction input injected (environment record, brand, active harness identity, child runner, store facts, and the register-on-materialize hook). A binding repository invariant, the secret-read boundary, fails on ambient environment access outside an enumerated allowlist, so the centralization claim is mechanical rather than conventional. The credential sidecar remains a future second implementation behind the unchanged port interface; no mediated-mode code exists.

The embedded metadata envelope v1 is a versioned data contract in core `./contracts` (`delivery.metadata.v1`). Its pure codec — serialize, parse, strip — is an adapter-internal shared module. The envelope travels in an adapter-declared carrier, round-trips with logical payload equality, and degrades visibly instead of failing when metadata is absent, malformed, of the wrong kind, or of an unknown version. Serialization requires an injected, pure content policy and fails closed with `content-policy-violation` when that policy denies the exact payload JSON.

The session-administration ports are implemented. `SessionStorePort` in core `./contracts` carries the read-only `size` and `list` surface that preserves ADR-0003's `SessionStore` semantics. `SessionAdminPort` extends that read surface with the mutating `prune` and `reboot` operations. Both are implemented in the adapters `./session` subpath over an injected `OpencodeSessionIo` seam that reaches the opencode session database only through the opencode CLI; the subpath is a production I/O home. The metadata-only guarantee and the ADR-0003 C-11 privacy sign-off gate remain binding for every field the ports surface. The delivered `db` command family is documented in [Session Database Administration](feature-session-database-admin.md).

The surrounding workspace is described in [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md); the provider engine that consumes the credential port for quota authorization in [Provider Engine](feature-provider-engine.md); the client seeds that consume this substrate in [Provider Client Seeds and Trap Catalogs](feature-provider-client-seeds.md); the normative per-operation contract those adapters implement in [Adapter Reference Behavior](feature-adapter-reference-behavior.md); the provider-agnostic flow suite that proves them in [Adapter Conformance Suite](feature-adapter-conformance.md); the closeout transaction that consumes the write path in [Closeout Transaction](feature-closeout.md); the failure identity and redaction boundary in [Result Contract and Error Table](feature-result-contract.md); declarable credential sources and configuration acquisition in [Configuration Layer and Inspection](feature-config-layer.md); brand-derived values in [Branding Seam and Working Name](feature-branding-seam.md). Package placement follows [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md). The harness adapter contract is recorded in [ADR-0008](../../decisions/ADR-0008-harness-adapter-contract.md) and implemented in M1-S11.

## Business Context

### Problem Statement

- **Problem:** Without typed ports, every provider interaction invents its own surface. Without capability flags, adapters overclaim parity or hide gaps in prose. Without one credential port, provider code reads secrets ad hoc, scattering the secret-attack surface and blocking a zero-key sidecar path. Delivery-provenance facts about provider artifacts stay heuristic because no structural carrier exists.
- **Affected Users:** Provider adapter authors, the provider engine, operators and agents consuming provider artifacts, security reviewers, and every later tracker, VCS, and CI integration.
- **Business Impact:** The ports are the contract substrate for the whole adapter era. A weak or drifting substrate fragments the adapter ecosystem and makes secrets, provenance, and provider capability unauditable.

### Goals

- Type the catalogue's nine adapter-interaction primitives at M0 as provider-agnostic core contracts.
- Make capability and gap declaration structural, including the metadata carriers an adapter can write and read.
- Centralize credential resolution behind one port whose implementation is the sole credential-material entry in the environment-read allowlist.
- Prove secret centralization mechanically through a binding boundary check with negative fixtures.
- Carry delivery provenance and linkage inside provider artifacts, with a closed, secret-free, size-bounded payload and visible degradation on unreadable metadata.

## User Experience & Functionality

### Primitive port set

The v1 port set is bounded to the catalogue's adapter-interaction rows typed at M0. The harness port family joins the delivered set as an additive layer: `HarnessInstance` (configured kind, observed version, capability declaration), `HarnessSession` (spawn, deliver, resume/steer, collect, classify, harness-agnostic liveness, and bounded session listing), and `HarnessExecutionEnvironmentDescriptor` (host execution, work directory, and the declared deny-by-default environment allowlist of variable names, each variable entry optionally carrying the additive optional marker, and credential references). These are specified in [Harness Adapters](feature-harness-adapters.md); queue/scheduling, state/audit, and non-adapter context primitives belong to their owning stories. Harnesses use the same capability/gap posture as providers: an unlisted capability is a declared gap, never implied parity.

| Port | Contract |
|------|----------|
| `ExternalSystemInstance` | Configured tracker, VCS, or CI instance: instance name, system kind, base URL, and an auth method. A credential-bearing auth method references a `CredentialReference`; it never carries inline secret material. An anonymous auth method is representable. |
| `AdapterContract` | Adapter name, system kind, and an `AdapterCapabilityDeclaration`. |
| `WorkItem` | Normalized ticket: provider-qualified identity, title, native and delivery status, labels, optional assignee, typed relations, optional comments, and optional activity timestamp. Optional fields share one absence rule: absent = the provider did not supply the signal, so the value is unknown — never derived, fabricated, or collapsed into an empty value. `comments` absent = the comment set is unknown (omitted or not fetched); present — including an explicitly empty array — = the provider-asserted set. `updatedAt` is the provider-native last-modified timestamp copied verbatim as an ISO-8601 UTC string; absent = activity unknown. |
| `WorkflowMap` | Native status to delivery-state alias mappings, each naming its transition mechanism. |
| `WorkItemRelation` | Closed relation kinds — `parent`, `child`, `blocks`, `blocked-by`, `relates-to` — targeting a provider-qualified identity. |
| `DeliveryRequest` | Delivery request (PR/MR) view: identity, source and target refs, review state, review threads, and an optional provider-resolved merged head commit (`headSha`). `headSha` absent means the provider did not supply the merged-head signal (unknown); it is never guessed or derived. Four optional gate facts — `sourceHeadSha`, `mergeableState`, `commitCount`, `changedFileCount` — are unknown when absent, never presumed mergeable or non-empty. |
| `DeliveryThread` | Review-thread view: `threadId`, `resolved`, `commentCount`, and optional root-author facts `authorLogin`, `authorKind` (`human`/`non-human`/`unknown`), and `authorAssociation`. Provider normalization maps `User` to `human`, `Bot`/`App` to `non-human`, and `Mannequin` or an absent/unrecognized author to `unknown`; unknown is treated as human by the closeout policy and is never inferred from comment text. |
| `PipelineRun` | Pipeline, job states, and trace-evidence references — never a bare status colour. A job carries the provider-asserted optional `startedAt` and `completedAt` timestamps copied verbatim; absent means unknown, and the contract carries no derived duration. |
| `RetryPolicy` | Bounded attempts and backoff for known-safe operations. Unsafe writes carry no retry policy rather than an empty or permissive one. |
| `IdempotencyKey` | Key value plus scope, making an external write safely retryable. |

Provider-qualified identity is plain typed data (`systemName` plus the provider's own `entityId`). Contracts describe normalized data and invariants; no behaviour, I/O, ambient environment, clock, or randomness enters the tier.

### Session administration ports

The session-database ports are separate from the nine primitive ports and are typed in `packages/core/src/contracts/session.ts`:

| Port | Contract |
|------|----------|
| `SessionStorePort` | Read-only `size()` and `list({ limit, nowMs })` reads over the opencode session store. It preserves ADR-0003's `SessionStore` semantics: read-only access to foreign session databases for `db` administration, metadata-only, never a mutation path. |
| `SessionAdminPort` | Extends `SessionStorePort` with `prune({ olderThanDays, limit, apply, nowMs })` and `reboot({ apply, nowMs })`. These are the only mutating operations. |

Each read returns `{ ok: true, value }` or `{ ok: false, error }` with a declared `db.*` identity. Mutation is dry-run by default and applies only when the caller sets `apply`. The implementation lives in `packages/adapters/src/session/index.ts`, an admitted I/O subpath, over an adapter-local `OpencodeSessionIo` seam; the executable and environment are injected. See [Session Database Administration](feature-session-database-admin.md) for the command surface, bounds, candidate rule, and error rows.

The public, semver-visible mutating `SessionAdminPort` is recorded in [ADR-0010](../../decisions/ADR-0010-session-admin-port-mutating-contract.md), which reconciles ADR-0003's read-only `SessionStore` clause without rewriting it.

### Capability and gap declaration

`AdapterCapabilityDeclaration` declares four typed collections:

- `supportedOperations` — the operations the adapter supports, drawn from the closed `ADAPTER_OPERATIONS` set (`read-work-item`, `write-work-item`, `transition-work-item`, `read-delivery-request`, `write-delivery-request`, `read-pipeline-run`, `write-comment`, `resolve-delivery-thread`, `merge-delivery-request`, `close-milestone`).
- `declaredGaps` — explicit `{ operation, reason }` records. Reasons are `provider-unsupported`, `adapter-not-implemented`, or `plan-restriction`.
- `writableCarriers` and `readableCarriers` — the metadata carrier kinds the adapter can write and read.

An operation absent from `supportedOperations` is unsupported. Declared gaps add the explicit reason for known limitations; they never turn an undeclared operation into a success. The declaration itself carries no parity claim: cross-adapter parity is a separate declared conformance surface — the parity matrix over the closed operations and its adjudicated difference register — that consumes these declarations as one input and adds no port, operation, capability flag, or carrier kind. Parity is proven at the primitive boundary these ports define and is specified in [Adapter Conformance Suite](feature-adapter-conformance.md). Carrier selection is typed against the adapter's declared set: `CarrierSelectionInput<Declared>` admits only `Declared[number]`, so an undeclared carrier literal or a widened `string[]` set is rejected at compile time. The closed carrier kinds are `invisible-comment-block`, `provider-custom-field`, and `compact-marker`.

### Additive harness members (GH-335)

`HarnessInstance` carries three additive optional members beside the delivered
`observedVersion` and `versionWarning`, which keep their meaning: `versionVerdict`
(the closed `inside` | `outside` | `indeterminate` window verdict, evaluated once
per resolution), `mode` (the resolved integration mode), and `modeOrigin`
(`defaults` | `configured`). The spawn and resume inputs each carry two additive
optional members: the caller's agent identity (`agent`) and the resolver's
single-seat binding (`binding`), both optional so every delivered call site keeps
compiling; the agent member's absence is the role-less `no-agent` state, never an
empty string. `HarnessEnvironmentBuilder` takes an additive optional per-spawn
context carrying the declared record map: a record value wins for a declared name
and an undeclared name changes nothing. The port family itself is unchanged.

### Additive v1 contract extensions

The contract evolves additively within v1, and a decision record governs each adapter-contract change. Two closeout extensions are delivered under [TDR-0008](../../decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md):

- **`DeliveryRequest.headSha`** — an optional provider-resolved merged-head commit copied verbatim. Absent means unknown. Consumers may compare it for exact equality with a local branch head; when it is absent, a destructive branch action refuses rather than guesses.
- **`resolve-delivery-thread`** — one member of the closed operation set, meaning "resolve one review thread on a delivery request" with canonical arguments `{ deliveryRequest, threadId }`. GitHub implements it through the existing injected transport; Jira declares `provider-unsupported`; GitLab declares `adapter-not-implemented`.

Two further additive extensions are delivered under [TDR-0033](../../decisions/TDR-0033-github-adapter-completion-contract-extensions.md):

- **`merge-delivery-request`** — the closed operation meaning "land this delivery request with a squash strategy" with canonical arguments `{ deliveryRequest, strategy: "squash", commitTitle?, commitMessage?, expectedHeadSha? }` and an outcome carrying an optional provider-supplied landing commit identity. Absent identity means unknown and is never derived. The operation is at most once per invocation and never retried, and force, branch-protection bypass, auto-merge, merge queues, rebase, and merge-commit strategies are not representable. `write-delivery-request` stays a content write that never lands. GitHub supports it; GitLab declares `adapter-not-implemented`; Jira declares `provider-unsupported`. The lifecycle `merge` transaction composes this operation as its only landing mechanism; see [Merge and Verify Deploy](feature-merge-verify-deploy.md).
- **`PipelineJob.startedAt` / `PipelineJob.completedAt`** — optional provider-asserted timestamps copied verbatim on a pipeline job. Absent means the provider did not assert the timestamp or the run has not completed; no duration is derived, and the contract carries no `durationMs`.

The milestone round adds three more surfaces under [ODR-0005](../../decisions/ODR-0005-closeout-milestone-synchronization.md), one of them a closed operation:

- **`close-milestone`** — the closed operation meaning "set this milestone record closed" with canonical arguments `{ milestone }` and one effect. The argument and effect vocabulary cannot express creating, attaching, detaching, renaming, or reopening a milestone, so those acts are structurally unrepresentable rather than prohibited. The write is read-back verified (the provider must assert the closed state), issued at most once per run, and never retried. GitHub supports it; GitLab declares `adapter-not-implemented`; Jira declares `provider-unsupported`. Its consumer is closeout's `milestone-sync` step; see [Closeout Transaction](feature-closeout.md).
- **`DeliveryRequest.title`** — an additive optional provider-asserted subject, copied verbatim. Absent means unknown and is never derived; the lifecycle merge uses it as the landing subject and falls back to the deterministic `merge(<ref>): squash <sourceRef>` only when the provider asserts none.
- **The milestone read** — one bounded adapter-local read returning the provider-neutral record (identity, title, state) and its attached items with delivery states, read as exactly one provider page at the declared page size with a truncation marker, no follow-up pagination, no poll, and no retry. It adds no closed operation and no capability flag: an adapter without the surface simply composes no such read, which the consumer reports as absence, distinct from an unavailable read, an unknown state, and truncation.

Each round's additive core surface is exactly that set: no field is removed, retyped, or made required, and no operation is removed or renamed. No extension bumps the schema version or requires a migration: the optional fields are producer-compatible, and an operation addition widens a closed compile-time union, so exhaustive consumers, the capability declarations, and the conformance flow registry update in the same change. An operation's presence in the enum never implies adapter support.

The harness execution-environment descriptor accepts a further additive extension under [TDR-0021](../../decisions/TDR-0021-additive-optional-harness-environment-marker.md): a variable entry may carry an optional boolean marker, `optional?: boolean`. Absent or `false` means required, so an absent value keeps the delivered fail-closed `harness.spawn.variable-missing` behaviour with the variable in `field`; `true` means an absent value is omitted and a present value is forwarded. The marker is variable-only: the credential entry is unchanged and never accepts it, no schema version bumps, and no failure code, delivery-result token, or error-table row is added.

The shared injectable provider transport used by the client subpaths is widened additively to carry the closed methods `GET`, `POST`, `PATCH`, `PUT`, and `DELETE`, an optional serialized request body, and an optional per-request timeout (production default: the 30 s closeout operation timeout). This is an adapter-I/O refinement: it adds no new transport, credential path, network location, or closed operation. The GitHub client is the first adapter with two implementations of that one seam — the CLI-first transport and the native-`fetch` transport — selected once at composition; both sit under the same request shaping and normalization, and a consumer sees no surface change.

The closeout reads refine the discriminated observation without changing the adapter contract. A work-item observation may carry `signals` for label and relation availability: `observed` for a provider-supplied container (including an empty array) and `unavailable` when the container is omitted. The bounded reverse-dependent read uses `CloseoutReverseDependentObservation`, whose closed set adds `no-surface` so an absent surface is a provider-level gap distinct from a currently `unavailable` signal. Both are read-observation refinements: they add no closed operation, primitive-port field, or schema-version bump.

### Bounded adapter-local reads

`verify deploy` consumes a provider job-trace read through the existing `./github` adapter subpath: `createGitHubDeployTraceReader({ instance, credentials, repository, transport, timeoutMs? })` returns `readDeployTrace(jobId, pipelineName?)`. One invocation issues exactly one `GET /repos/{owner}/{name}/actions/jobs/{jobId}` through the shared injected transport with the existing per-request timeout (default: the 30 s closeout operation timeout). The read has no retry, no pagination, and no trigger, re-run, schedule, or cancel capability; credentials resolve through `CredentialPort` and are never cached.

The normalized `GithubDeployTrace` is a closed, provider-neutral shape: `jobId`, `pipelineName`, optional `headSha` and `status`, `located`, and the executed `steps` (name plus `succeeded` \| `failed` \| `skipped` \| `unknown`) and produced `artifacts`. Log bodies never cross the boundary. A 404 is the adapter-local not-found read result; a non-2xx response or a transport failure is `provider.payload.invalid`. The read kind adds no primitive port, no closed adapter operation, and no schema-version bump: it is an adapter read behind the existing ports, consumed by the verify-deploy engine documented in [Merge and Verify Deploy](feature-merge-verify-deploy.md).

Two further adapter-local reads follow the same precedent and are stated normatively in [Adapter Reference Behavior](feature-adapter-reference-behavior.md): a bounded failure-log excerpt (one read, one fixed 8192-byte cap, a faithful byte prefix, an explicit truncation flag, and the returned byte length) and a bounded per-thread discussion read (one read, at most 50 oldest-first comments, at most 4096 bytes per body, a thread-level truncation flag, and a provider-asserted comment count). Neither adds a primitive port, a closed operation, a normalized-contract field, or a capability flag; both return provider text to the caller only and are never rendered, logged, or persisted by the adapter. `DeliveryThread` stays body-free.

### Credential resolution

`CredentialPort` exposes one operation, `resolve(reference)`, and no implementation-mode surface. A `CredentialReference` carries its own declarative source-key mapping over the closed four-style vocabulary, each style with its own explicit keys:

- `{ style: "literal", name }` uses the environment variable verbatim.
- `{ style: "environment-prefixed", suffix }` derives the environment variable from the branding seam's environment prefix plus the suffix.
- `{ style: "command", program, args, timeoutMs? }` names an allowlisted absolute program path, the pinned subcommand prefix plus its permitted parameters, and an optional per-execution timeout bounded by the declared hard bound.
- `{ style: "harness-store", harness, integrationId }` names the harness identity whose export reads the store and the integration id handed to the export's target selector.

The mapping is declared data, never guessed from an external system's name, and no style has a fallback or admits a chain: an unresolvable declaration refuses by name and never consults a second source. Resolution returns either `{ ok: true, material }` or the reified `config.credential.missing` failure. An absent key and an empty-string value fail; whitespace is a value. Resolved material is returned once through the port result and has no diagnostic channel.

The failure variant stays bound to the single error-table row and grows only by three additive optional projection fields (GH-394): `source` (style plus source identity — `literal:<NAME>`, `environment-prefixed:<SUFFIX>`, `command:<program>`, `harness-store:<integrationID>` — present whenever a declared reference was resolved), `reason` (one token from the closed ten-member set `program-unavailable`, `timeout`, `non-zero-exit`, `empty-output`, `shape-drift`, `ambiguous-account`, `oauth-excluded`, `source-not-supported`, `variable-absent`, `resolution-pending` — the last reserved for the resident composition specified forward and unobservable by shipped callers), and `remedy` (fixed `(reason, style)`-keyed table text naming the one operator act that helps, selected per allowlist entry — never interpolated from configuration or child output). The fields are projection data on the variant, never columns on the bound row.

The implementation is `createCredentialResolver(options)` at the `./credentials` subpath, built over four injected construction inputs: the environment record, the branding seam, the active harness identity, and the child runner, beside the store-facts seam and the register-on-materialize hook. `createEnvironmentCredentialPort({ environment, brand })` remains the environment-only port over the two environment styles, and `createProcessCredentialPort(brand)` is the production wrapper supplying the process environment. Resolution is one-shot per process: a reference resolves on demand at its first use and the result memoizes, so exactly one execution happens per reference and every further resolve of that reference is a memory read. Environment-style material registers for redaction at the moment it is read; command- and harness-store-material registers before parsing and before any throw.

#### Command style

A `command` declaration is accepted only when it matches the shipped closed allowlist of (absolute program path, pinned subcommand prefix) pairs — the tracker CLI's token read and the harness CLI's credential export. The two free slots are grammar-closed and validated at configuration load: a `<host>` slot matches `[A-Za-z0-9.-]+` with no leading dash and a bounded length (max 253), an `<integrationID>` slot matches `[a-z0-9][a-z0-9_-]*` with no leading dash and a bounded length (max 64). The constructed argv always inserts the `--` terminator before the positional. Validation resolves every symlink on the program path and requires a regular executable target at the end of the chain; otherwise the refusal is `program-unavailable`. Execution is direct — no shell, no interpolation — with closed stdin (a prompt fails immediately), stdout captured to a fixed bound (256 KiB), stderr reduced to size and exit status and never rendered, a reduced child environment (the path, the home directory, and the session-bus facts where a keyring-backed store requires them, each only when present — never the parent's secret-bearing environment), and a per-execution cap (15 s default, 30 s hard bound; a capped run classifies `timeout`). Material is one line: trailing line endings stripped; empty output after stripping is `empty-output`, and an interior newline is a refused `shape-drift` — neither is ever material. Interpreters and general network clients are absent from the table by construction, so no configuration can name them.

#### Harness-store style

The declared integration id reaches the allowlisted export's own target selector, so only that integration's entries return; in-process single-entry selection remains as defense in depth and the raw export is never logged, stored, re-emitted, or retained. The strategy requires exactly one entry with `active: true`: zero or more than one refuses `ambiguous-account`. An integration with no stored entry refuses `empty-output`, with no fall-through to the environment. Only `value.type: "key"` entries yield material; an `"oauth"` entry refuses `oauth-excluded` — the product never consumes, refreshes, or writes back a harness-owned OAuth grant. Any shape departure — non-array root, missing field, unexpected `value.type`, unparseable or truncated output — refuses `shape-drift` naming the harness and the offending field. A declared `harness` field must equal the active harness identity (a construction input) or the refusal is a cold `source-not-supported`; a harness with no declared support borrows nothing. The strategy is read-only against the store: no write operation exists on the store-facts seam.

#### Posture

A credential refusal rendered by a consumer is name-only: it may name the resolved source identity and the reference name, and never the material; the credential port itself exposes no diagnostic channel. The product never reads an owner's store itself, never calls a keyring API, never inherits an ambient variable implicitly, and declares no fallback — the owner-CLI invocation behind the `command` style is declared configuration, so the deny-by-default posture holds mechanically: the allowlist table, not a permission decision, closes every execution the resolver can perform. The entrypoint keeps its static registration for the two environment styles (their values exist before any command runs) and never resolves anything itself; the live redaction registry is consulted at render time and every obtained material registers at the moment of materialization, before any emit path — a log line, a throw with payload, a render, or a return to a caller that logs — can carry it. The three edge-composed command registration sites join the same registry, and malformed child output throws without ever rendering raw output. The operator's environment bridge remains the explicit export from an already-authenticated session, performed in the operator's own shell; it is not a product action. Pending-park semantics — the resident composition that would resolve asynchronously and return the reserved `resolution-pending` reason — are specified forward and are not delivered here; every shipped resolution is synchronous and every shipped failure parks or refuses through the delivered vocabulary.

The GitHub work-item read stamps the status it actually received onto a decode failure, so a malformed 2xx payload stays distinguishable from a status-absent transport throw. The adapter keeps its delivered identities: on a read, 404 is `provider.not-found`; any other non-2xx is `provider.payload.invalid` with the received status; a thrown or timed-out request is `provider.payload.invalid` without a status. The absence promotion is read-scoped: every write classifies any non-2xx, 404 included, as `provider.payload.invalid` with the received status, so a write result is never `provider.not-found`. The admission preflight classifies that outcome from the status rather than forwarding the adapter code.

### Provider quota authorization

The provider engine authorizes quota requests only through `CredentialPort`. It resolves the descriptor's declared `credentialRef` to material at use time and hands that material once to the quota transport for one request; the transport builds the authorization header in memory and stores nothing. Material is never cached, logged, persisted, or returned in evidence.

A missing or unresolvable reference parks the provider with cause `credential-missing` and failure class `config.credential.missing`; no fetch is attempted. The classified projection rides the rendered refusal and the park announcement's log line as in-process data — never a park-record field; the park-record shape, the cause set, and the announcement code set are unchanged, and no `resolution-pending` parking exists (any resolution failure parks today; the pending-park semantics are specified forward). HTTP 401/403 parks it with cause `credential-rejected`; a non-mutating quota command surfaces the `provider.auth.rejected` identity. Transport, non-auth HTTP, envelope, and parse failures become `provider-outage` parks. The provider core, the CLI provider command, and the `./provider-quota` transport add zero secret-read allowlist entries. The engine's park and announcement vocabulary is documented in [Provider Engine](feature-provider-engine.md).

### Secret-read boundary

`scripts/checks/secret-read-boundary.ts` is an AST invariant over every workspace package production source (`packages/<pkg>/src/**` TypeScript, excluding `dist` and `node_modules`). It names the rule, file, and line for each ambient environment access outside an enumerated allowlist and is fail-closed and non-vacuous: an empty scope fails, and every allowlisted path must exist with a reason.

The v1 allowlist has exactly five entries:

| Kind | Path | Class | Why |
|------|------|-------|-----|
| directory | `packages/adapters/src/credentials` | `credential-material` | The single credential-port implementation directory: the strategy resolver, the closed command allowlist, and the command and harness-store strategies. |
| file | `packages/core/src/state/driver/runtime-edge.ts` | `configuration-environment-source` | The state driver's Windows owner-identity resolution for icacls ACL verification. |
| file | `packages/adapters/src/file/yaml-parser.ts` | `configuration-environment-source` | The file-tier parser host-switch guard. |
| file | `packages/adapters/src/legacy/index.ts` | `configuration-environment-source` | The legacy-name adapter environment reader. |
| file | `packages/mcp/src/serve.ts` | `configuration-environment-source` | The MCP serve composition root's one startup configuration-environment read. |

Exactly one entry may carry the `credential-material` class, and it must be the credential implementation directory. Wildcards, prefixes, absolute paths, trailing separators, duplicate paths, and reasonless entries fail registry validation. Allowlist growth is a reviewed change. The provider engine adds no entry: its core policy and CLI command read no ambient environment, and its quota transport receives credential material as data.

The invariant detects `process.env`, `Bun.env`, and `Deno.env` property reads; element access to `env` or an ambient global by string-literal key; element access with a computed or template-literal key on `process`, `Bun`, `Deno`, or `globalThis`; runtime imports of `process` or `bun`; and aliased ambient globals. A non-literal key cannot be resolved statically, so it fails closed by name instead of being silently accepted. Identifier positions such as property names, import specifiers, and type declarations are ignored. Negative fixtures cover the literal, computed-key, and template-key forms. The invariant runs as a stage of `check:boundaries` and as a binding step in the CI `ts-invariants` job; no advisory or bypass construct is accepted.

### Embedded metadata envelope

The v1 envelope is a closed data contract:

```ts
type MetadataEnvelopeV1 = {
  schema: "delivery.metadata.v1";
  kind: "work-item-comment";
  payload: {
    comment: { producingAgent: string; operatorAuthority: string };
    delivery: { workItemRef: string; runId: string };
  };
};
```

`ENVELOPE_SCHEMA_ID` is `delivery.metadata.v1`, `ENVELOPE_MAX_BYTES` is `2048`, and `ENVELOPE_KINDS` contains `work-item-comment`. The payload field set is closed at v1; unknown or missing fields are rejected. The payload admits no secret, credential, or private-identifier field.

The pure codec lives in the adapters package as an adapter-internal shared module (`#io/*`), not in core and not as a public subpath. Core `./contracts` carries only the envelope data contract and the content-policy contract types. The codec provides:

- `serializeEnvelope({ envelope, carrier, humanContent, policy })` — returns the serialized carrier and its byte length, or a refusal for `payload-not-closed`, `size-bound-exceeded`, or `content-policy-violation`. The byte length is measured on the serialized JSON against the 2048-byte bound. `policy` is required; there is no default-open overload.
- `parseEnvelope({ carrier, text?, fieldValue?, expectedKind? })` — returns the v1 envelope plus the stripped human content, or visible degradation evidence plus the stripped human content.
- `stripEnvelope(carrier, text)` — removes every envelope marker from human-readable carrier text with no residue or extra blank line. The provider custom-field carrier keeps human content separate and is returned unchanged.

**Serialization content policy.** `serializeEnvelope` validates in a fixed order: closed-payload validation, serialized byte-size bound, content policy over the exact compact JSON that would be embedded (payload included, so escaping cannot hide a match), then carrier construction. The injected policy is a pure, total, non-throwing function from that JSON to `{ ok: true }` or `{ ok: false, ruleOrEntryId }`. A denial returns `{ ok: false, failure: "content-policy-violation", byteLength, ruleOrEntryId }`, produces no carrier, and never carries content. The failure is codec-local and has no result-contract error row. The policy builder in the same I/O tier combines the shared generic privacy rules with injected hashed entries through an injected hash; it validates that hash and those entries at construction time and fails closed before returning a policy. The emitter policy intentionally does not apply documentation-placeholder suppression, because machine-generated metadata has no documentation context, so a marker-carrying guarded payload is still denied. The structural single-serialization audit covers `packages/`, `scripts/`, and `tools/`. The codec imports only contract types and keeps its no-`node:*`/`bun:*`, no-ambient-read, no-clock, no-randomness purity. Human-readable comment content is outside the policy input and is never scanned at this boundary. The rule set, registry, and no-echo reporting are documented in [Privacy and No-Cloud Guards](feature-privacy-guard.md).

Marker scanning is bounded: a marker payload span is capped at `ENVELOPE_MAX_BYTES` characters (a valid v1 envelope is byte-bounded below that), so marker-dense hostile carrier text is scanned linearly rather than quadratically. A marker whose payload exceeds the cap does not match and degrades as `missing`.

Marker-shaped text in plain human content is stripped as if it were an envelope: `See docs [delivery.metadata.v1:{"x":1}] for details` loses the bracketed span. This is inherent to text-marker carriers; adapter authors keep marker-shaped text out of human content. A marker lookalike inside an envelope payload is payload content and does not disturb stripping of trailing human content.

Carrier forms are brand-neutral:

- `invisible-comment-block` — an HTML comment `<!-- delivery.metadata.v1 {...} -->` appended after human content.
- `provider-custom-field` — the serialized JSON in the provider custom field named `delivery.metadata.v1`.
- `compact-marker` — an inline `[delivery.metadata.v1:{...}]` marker.

The agent-facing surface exposes `CommentWriteRequest` (human body plus requested provenance and delivery linkage) and `CommentReadView` (body, provenance, optional degradation evidence). Agents never construct raw carriers; `readRawCarrier` is the single audited escape hatch. The write path is adapter-only and uses a carrier the adapter declared.

### Graceful degradation

A metadata read never fails the flow. The closed degradation reason set is mechanically detectable only:

| Reason | Meaning |
|--------|---------|
| `missing` | No envelope is present. Absent and externally stripped metadata are observationally equivalent. |
| `malformed` | An envelope is present but its payload is unparsable or invalid. |
| `wrong-kind` | The envelope kind is unknown or differs from the expected kind. |
| `unknown-version` | The schema version is outside the known set (older or newer). |

A degraded read returns the primitive view with account-based heuristic provenance (`source: "account-heuristic"`, `structural: false`) and visible degradation evidence naming the reason. Heuristic provenance cannot masquerade as structural provenance.

### Error integration

An unresolvable credential carries the synchronized error-table row `config.credential.missing`: domain kind `config`, category `user`, retryable `false`, consequence `not_landed`, projection class `user-validation` (exit `1`). The machine table and the documented table in [Result Contract and Error Table](feature-result-contract.md) agree in both directions under the binding sync invariant. Malformed metadata deliberately has no error code; degradation is returned view state, not a failure.

### Flows

1. **Adapter operation:** The engine holds an `ExternalSystemInstance`; the credential port resolves its declared reference; the adapter consults its capability flags, represents undeclared operations as gaps, applies `RetryPolicy` and `IdempotencyKey` discipline, and returns normalized primitive views.
2. **Metadata write:** An agent constructs a primitive view with requested provenance; the adapter serializes the envelope into a carrier it declared and keeps human-readable content intact.
3. **Metadata read:** The adapter parses the carrier, strips the envelope, and returns the primitive view with metadata-derived fields, or with heuristic provenance and visible degradation evidence.
4. **Boundary violation:** A direct environment read in a provider module fails the secret-read invariant naming rule, file, and line; the fix routes acquisition through the credential port.

## Technical Architecture & Codebase Map

### Core components and directory structure

| Path | Responsibility |
|------|----------------|
| `packages/core/src/contracts/ports.ts` | The nine v1 primitive port types and their supporting normalized value types. |
| `packages/core/src/contracts/adapter-capabilities.ts` | `ADAPTER_OPERATIONS`, `CARRIER_KINDS`, capability/gap types, and declared-carrier selection types. |
| `packages/core/src/contracts/closeout.ts` | The `delivery.closeout.v1` plan/operation/outcome vocabulary, the work-item and reverse-dependent read observations (`CloseoutReadObservation`, `CloseoutReverseDependentObservation`, `CLOSEOUT_REVERSE_DEPENDENT_OBSERVATIONS`), and the closeout runtime contracts; types and `as const` data only. |
| `packages/core/src/contracts/credentials.ts` | `CredentialPort`, `CredentialReference`, the closed four-style `CredentialSourceKey`, the resolution result, the closed ten-member failure reason set, the three-field failure projection, and the reified missing-credential failure. |
| `packages/core/src/contracts/envelope.ts` | Envelope schema id, size bound, kinds, closed payload types, degradation reasons, agent-facing comment views, and the `ContentPolicyVerdict` / `EnvelopeContentPolicy` contract types. |
| `packages/core/src/contracts/session.ts` | `delivery.session-admin.v1` vocabulary, bounds, item/result shapes, read-only `SessionStorePort`, and mutating `SessionAdminPort`; types and `as const` data only. |
| `packages/core/src/domain/session-admin.ts` | Pure session-admin policy: cutoff, live boundary, cold/live/leaf predicate, ordering, capping, and deterministic human rendering. |
| `packages/adapters/src/session/index.ts` | Production `OpencodeSessionIo` and the `SessionStorePort` / `SessionAdminPort` implementations over the opencode CLI. |
| `packages/adapters/src/git/index.ts` | The dedicated git seam: fixed-argv, no-shell child processes with bounded timeouts; checkout facts, branch reads, worktree and cleanliness checks, checkout restore, local branch deletion, plus the commit operations — porcelain status with per-file facts, budget-capped diffs, pathspec staging, commit-object creation, head reads, and a mixed reset for clean abort. The merge-transaction mutations (one rebase-refresh attempt, one squash landing, branch deletion) are declared local-only — no network, no remotes — and the push operation (GH-386, TDR-0076) is the seam family's one remote-write act: a single fast-forward-only push of the change branch to its configured upstream, fixed argv, literal non-shell spawn, 60 000 ms injectable timeout, one attempt with no retry and no force-capable variant. It is separate from the read-only repository metadata reader. |
| `packages/adapters/src/inference/index.ts` | The core-owned inference transport and the declared network-I/O edge for the commit primitive: schema-constrained message generation over the shared provider HTTP transport with credentials resolved through the credential port, classified failures, and token-spend extraction. It never reads the environment, caches a credential, or calls fetch directly. |
| `packages/adapters/src/file/secret-scan.ts` | The deterministic secret scanner over content and filename patterns plus the forbidden-path and binary size guards; findings carry class and path only, and a read failure reports the scan as unavailable. |
| `packages/adapters/src/file/commitlint.ts` | Repository commitlint discovery and the bounded `--edit` probe; absent configuration reports `absent` so validation degrades to the deterministic checks. |
| `packages/adapters/src/session/commit-one-shot.ts` | The harness one-shot transport: a temporary empty project directory, a prompt file as the only input, a sanitized environment, a bounded headless invocation, and temp removal including on failure. |
| `packages/adapters/src/session/delivery-session-facts.ts` | Edge-injected delivery-session facts over declared environment keys; a non-empty declared key marks an active session. |
| `packages/core/src/contracts/index.ts` | The `core ./contracts` export surface for the ports, capability, closeout, credential, envelope, and session-admin contracts. |
| `packages/adapters/src/credentials/index.ts` | The strategy resolver over the closed four-style source vocabulary: the four injected construction-input seams, the per-process memo of exactly one execution per reference, register-on-materialize, the environment-backed port and its production process-environment wrapper, and source-key derivation. |
| `packages/adapters/src/credentials/allowlist.ts` | The shipped closed command allowlist: the two pinned (program, subcommand prefix) entries, grammar-closed slot validators and their named bounds, the `--`-terminating argv constructor, and the fixed `(reason, style)`-keyed remedy tables. |
| `packages/adapters/src/credentials/command-strategy.ts` | The `command` strategy and the bounded child seam: allowlist matching, symlink resolution to a regular executable target, direct execution with closed stdin, bounded stdout, the reduced child environment, the per-execution cap, and the one-line material rule. |
| `packages/adapters/src/credentials/harness-store-strategy.ts` | The `harness-store` strategy: the injected store-facts seam, the pinned export-shape parser, exactly-one-active selection, key-only materialization, oauth exclusion, shape-drift classification, and declared-harness match or refuse. |
| `packages/adapters/src/github/deploy-trace.ts` | The bounded deploy-job trace read: one `GET /actions/jobs/{jobId}` over the injected transport and credential port, closed normalization of steps and artifacts (no log bodies), and classified not-found/payload failures; no trigger, retry, or pagination capability. |
| `packages/adapters/src/github/cli-transport.ts` | The declared second `ProviderTransport` implementation: the transport matrix, the composition-time CLI probe with its closed refusal codes, the selection resolver and its selection type, the exported host-identity mapping that supplies the required `--hostname` construction value, the absolute isolated child environment and config-directory resolver, the injected fixed-argv child runner, and status recovery from the first status block. |
| `packages/adapters/src/github/workflow-map.ts` | The declared Issues transition seed, the construction-time map validator, the read resolver, and the mechanism-scoped transition planner. |
| `packages/adapters/src/github/log-excerpt.ts` | The bounded failure-log excerpt read and its one fixed byte cap. |
| `packages/adapters/src/github/thread-discussion.ts` | The bounded per-thread discussion read, its two fixed caps, and the closed discussion normalization. |
| `packages/adapters/src/io/envelope-codec.ts` | Pure envelope codec: serialize, parse, strip, closed-payload validation, required content-policy evaluation, raw-carrier escape hatch, and carrier constants. |
| `packages/adapters/src/io/privacy-rules.ts` | Pure, dependency-free privacy rule definitions, suppression classes, normalization, matchers, caps, and identifier fingerprint. |
| `packages/adapters/src/io/envelope-content-policy.ts` | Pure policy builder combining shared generic rules with injected hashed entries and hash. |
| `packages/adapters/src/io/index.ts` | Internal `#io/*` alias target re-exporting the codec and the policy builder. |
| `packages/core/src/contracts/provider.ts` | Provider descriptors, the zone grammar and zone-bound facts, the three-member zone port, budget declarations and the spend-totals port, conditions, parks, announcements, decisions, skip reasons, error codes, and the quota transport contract. |
| `packages/core/src/provider/**` | Pure provider validation, chain resolution, offset-aware peak arithmetic with the named expiry derivation, quota evaluation, budget evaluation, simulation payload assembly, legacy mapping, park/announcement projection, and the re-evaluation loop. |
| `packages/adapters/src/provider-quota/index.ts` | Injectable quota transport and native-fetch production wrapper at the declared `./provider-quota` subpath. |
| `packages/adapters/src/time-zone/index.ts` | The single `Intl`-backed `ProviderZonePort` implementation at the declared `./time-zone` subpath: the only workspace module that reads zone data for provider policy, with no I/O, network, or extra environment read. |
| `packages/adapters/src/file/pm-notes-parser.ts` | pm-notes file edge: locates a change ref's committed notes under the change-artifact convention, parses YAML 1.2 core with bounded size/nodes/depth/aliases, and stages in-memory phase-entry edits; runtime file access stays at the adapter I/O edge. |
| `scripts/checks/secret-read-boundary.ts` | The secret-read boundary invariant, allowlist registry, scoped-file scan, and fixture-coverage helpers. |
| `tests/types/tsconfig.json` | The type-probe project chained into the root `typecheck`. |
| `tests/fixtures/ports/**` | Fixture adapters, capability declarations, and the exact v1 contract inventory. |
| `tests/fixtures/envelope/**` | Golden payloads, degradation matrix, schema cases, and version cases. |
| `tests/fixtures/credentials/**` and `tests/fixtures/secret-boundary/**` | Credential resolution cases and boundary allowlist/planted-read fixtures. |

### Data architecture and constants

| Constant | Value | Rule |
|----------|-------|------|
| `ENVELOPE_SCHEMA_ID` | `delivery.metadata.v1` | Brand-neutral `delivery.*.v1` schema identifier; the only v1 version. |
| `ENVELOPE_MAX_BYTES` | `2048` | Serialized JSON byte ceiling. |
| `ENVELOPE_KINDS` | `work-item-comment` | Closed v1 kind set. |
| `DEGRADATION_REASONS` | `missing`, `malformed`, `wrong-kind`, `unknown-version` | Closed, mechanically detectable reason set. |
| `CARRIER_KINDS` | `invisible-comment-block`, `provider-custom-field`, `compact-marker` | Closed carrier-kind set. |
| `ADAPTER_OPERATIONS` | ten operations | Closed adapter operation set, including `resolve-delivery-thread`, `merge-delivery-request`, and `close-milestone`; the set appends and is never reordered. |
| `CREDENTIAL_FAILURE_REASONS` | ten reasons | Closed credential-failure reason set; `resolution-pending` is reserved and unobservable by shipped callers. |
| `COMMAND_TIMEOUT_DEFAULT_MS` / `COMMAND_TIMEOUT_MAX_MS` | `15_000` / `30_000` | Per-execution cap default and hard bound; a capped run classifies `timeout`. |
| `COMMAND_STDOUT_MAX_BYTES` | `262_144` | The child stdout capture bound. |
| `HOST_SLOT_MAX_LENGTH` / `INTEGRATION_ID_MAX_LENGTH` | `253` / `64` | The grammar-closed slot length bounds; the load-time validators use the same named bounds. |

Version policy: v1 is the only schema version, so any version string outside the known set binds to the `unknown-version` degradation path. The standing read window is current-plus-all-older; narrowing it or retiring a version requires a future specification change.

### API and interface contracts

- **`CredentialPort.resolve(reference)`** returns `CredentialResolution` synchronously. There is no diagnostic channel and no implementation mode. The failure variant carries the delivered row-bound fields plus the three optional projection fields `source`, `reason`, and `remedy`; the success variant is unchanged.
- **`serializeEnvelope(input)`** requires `policy: EnvelopeContentPolicy` and returns `{ ok: true, carrier, byteLength }`, `{ ok: false, failure: "payload-not-closed" | "size-bound-exceeded", byteLength }`, or `{ ok: false, failure: "content-policy-violation", byteLength, ruleOrEntryId }`.
- **`parseEnvelope(input)`** returns `{ ok: true, envelope, humanContent }` or `{ ok: false, reason, humanContent }`.
- **`stripEnvelope(carrier, text)`** returns the text with every envelope marker removed.
- **`isClosedV1Payload(value)`** is the closed-payload type guard used by both serialization and parsing.
- **`ContentPolicyVerdict` / `EnvelopeContentPolicy`** are the pure allow/deny verdict and injected predicate contract types declared in core `./contracts`.
- **`buildEnvelopeContentPolicy(inputs)`** builds an `EnvelopeContentPolicy` from a pure hash function and hashed entries carrying `{ id, hash, length }` plus an optional `algorithm` declaration fixed to `sha256`. Malformed, duplicate, or over-cap inputs throw at construction; the returned policy itself never throws.

## Security and Boundaries

- Secret material is reachable only through the credential port. The adapters `./credentials` directory is the sole `credential-material` allowlist entry: the strategy resolver, its closed command allowlist, and both execution strategies live inside it, and the resolver's executions run with closed stdin, a reduced child environment, bounded capture, and a per-execution cap through one injected child seam.
- The session-database ports remain metadata-only: identifiers, counts, byte sizes, timestamps, booleans, and the runtime-resolved store path; no titles, prompts, message bodies, part data, credentials, environment values, or command arguments. The ADR-0003 C-11 privacy sign-off is required before the `db` administration engine ships and remains an owner merge gate.
- The session adapter adds no secret-read allowlist entry and reads no ambient environment; the executable and environment are injected through the composition.
- The secret-read boundary closes the ambient channel that runtime-API confinement does not cover. Runtime-API confinement admits the `core` state driver edge (`packages/core/src/state/driver/`), the adapters I/O subpaths `repo`, `file`, `host`, `session`, `legacy`, and `credentials`, the provider client subpaths `github`, `gitlab`, and `jira`, the provider quota transport `provider-quota`, the inference transport `inference`, and the dedicated git seam `git`, all as exact, reason-bearing entries per the ADR-0005 reviewed-allowance precedent; it also admits the `cli` build and `opencode` host integration. The provider core tier is runtime-neutral, the provider registry subpath and the remaining adapter subpaths stay non-I/O, the git seam is local-process-only except the dispatch ensure-push act's one fast-forward push of the change branch to its configured upstream (GH-386, TDR-0076; the merge-transaction mutations stay declared no-network and no-remotes), the inference subpath is the declared network edge for the commit primitive's one constrained call, and the credential subpath is the only one that may resolve secret material.
- The `github` entry carries two admitted meanings under one exact path: provider network I/O, and one bounded, no-shell, fixed-argv `gh` child invocation in `packages/adapters/src/github/cli-transport.ts`. [TDR-0032](../../decisions/TDR-0032-github-adapter-cli-first-provider-transport.md) is the reviewed extension the ADR-0005 pointer routes to for that meaning. The entry's exactness, the secret-read allowlist, and the set of production child-process import sites are unchanged: the site set is pinned in both directions by a structure test and this transport is the only provider-subpath site in it.
- Resolved material never enters diagnostics, logs, error payloads, or metadata; the existing redaction chokepoint governs any surfaced payload.
- The envelope payload is closed, compact, size-bounded, and secret-free; carrier markers and namespaces use brand-neutral constants with no committed product token.
- Every serialized envelope is scanned by the required content policy over the exact embedded JSON. The policy and hash are injected pure inputs; a denial fails closed with a rule or entry id only and produces no carrier. The shared rule definitions and the hashed-literal registry are documented in [Privacy and No-Cloud Guards](feature-privacy-guard.md).
- Capability data is declarative; enforcement of undeclared operations belongs to adapter implementations consulting the flags.

## Non-Functional Requirements

| Concern | Current guarantee |
|---------|-------------------|
| Contracts-tier neutrality | Types and `as const` data only; no ambient environment, I/O, clock, randomness, or runtime-API imports. |
| Secret centralization | Zero non-allowlisted ambient environment reads in workspace production sources; exactly one credential-material entry; planted violations fire. |
| CI bindingness | The secret-read invariant is a binding `check:boundaries` stage and `ts-invariants` step with no bypass construct. |
| Envelope boundedness | Every golden round-trip case serializes within 2048 bytes; metadata never displaces human-readable content. |
| Content-policy scan | Every serialization call supplies a policy; a guarded payload returns `content-policy-violation` with one rule or entry id and no carrier; clean payloads round-trip across every declared carrier. |
| Emitter purity | 0 `node:*`/`bun:*` imports and 0 ambient environment, clock, randomness, filesystem, or network accesses in the codec; the policy and hash are injected. |
| Degradation totality | Every degradation case returns a view with visible evidence naming a mechanically detectable reason; no case fails the flow. |
| Error-table sync | `config.credential.missing` agrees with the documented table in both directions; existing classification behavior is unchanged. |
| Fixture discipline | The invariant has firing negative fixtures and clean controls; fixture coverage and allowlist non-vacuity are proven. |

## Quality Assurance Strategy

| Level | Scope | Evidence |
|-------|-------|----------|
| Structure | Exact v1 contract inventory in both directions, neutral-tier purity, carrier typing, credential surface and the closed style/reason vocabularies, envelope constants, error-table row | `tests/structure/port-contract-inventory.test.ts`, `port-neutrality.test.ts`, `port-carrier-types.test.ts`, `port-credential-surface.test.ts`, `envelope-contract.test.ts`, `credential-constants.test.ts`, `credential-vocabulary-invariants.test.ts`, `error-table.test.ts` |
| Behaviour | Capability/gap declarations, declared-carrier selection, credential resolution and failure across the four styles, one-shot memo and execution posture, live-registry redaction, remedy propagation, compatibility goldens, envelope round-trip, parse/strip, degradation matrix, adapter-only write path | `tests/behaviour/port-capabilities.test.ts`, `credential-port.test.ts`, `credential-strategies-command.test.ts`, `credential-strategies-harness-store.test.ts`, `credential-strategies-reasons.test.ts`, `credential-strategies-remedies.test.ts`, `credential-composition-proof.test.ts`, `credential-redaction-live-registry.test.ts`, `credential-compatibility.test.ts`, `credential-hermeticity-guard.test.ts`, `envelope-roundtrip.test.ts`, `envelope-degradation.test.ts`, `envelope-write-path.test.ts` |
| Emitter policy | Denial across field and carrier cases, validation order, totality, clean round-trip, shared-rule parity, human-content exclusion, no emitter-side placeholder suppression, construction-time input validation, and the single-serialization audit over `packages/`, `scripts/`, and `tools/` | `tests/behaviour/envelope-content-policy.test.ts`, `tests/structure/privacy-imports.test.ts`, `tests/structure/envelope-contract.test.ts` |
| Type level | Undeclared carriers and widened sets rejected at compile time; a policy-less serialization call rejected at compile time | `tests/types/port-carrier-types.type-test.ts`, `tests/types/envelope-policy.type-test.ts` through the root `typecheck` |
| Checks | Planted boundary violations, allowlist mutations, non-vacuity, CI wiring and bindingness, command-allowlist tripwire, error-table sync | `tests/checks/secret-read-boundary.test.ts`, `ci-checks.test.ts`, `allowlist-tripwire.test.ts`, `error-table-sync.test.ts`; `bun run scripts/checks/secret-read-boundary.ts`, `bun run scripts/checks/allowlist-tripwire.ts` |
| Boundaries | Fixture coverage and the credentials subpath in the entrypoint matrix | `tests/boundaries/**`, `tests/checks/secret-read-boundary.test.ts` |
| Aggregate | The whole workspace | `pnpm check` |

Evidence details are recorded in the change test plan at `doc/changes/2026-10/2026-10-30--GH-181--primitive-ports-credential-metadata/chg-GH-181-test-plan.md`.

## Operational & Support

### Configuration

Credential source keys are declared on the reference over the closed four-style vocabulary; every style's explicit keys, the slot grammars, and the declarable tracker credential reference are specified in [Configuration Layer and Inspection](feature-config-layer.md). Environment-prefixed keys derive their prefix from the branding seam's `environmentPrefix` and literal keys use their declared name verbatim. The resolver's construction inputs are injected; the production composition wires the process environment, the branding identity, the active harness identity, the child runner, and the store-facts seam at the runtime-aware adapters `./credentials` edge, and tests inject every input and never depend on the host environment, a real store, or a real owner CLI.

### Observability

Capability flags and gap records are inspectable data. Degradation evidence names its reason on every degraded read. The secret-read invariant's failure output names the rule, file, and line. Credential failures carry classified error identity; resolved secret material is never observable through any diagnostic path.

## Dependencies & Risks

- **Depends on** the monorepo scaffold for package tiers, boundary enforcement, the ambient guard, and the aggregate check.
- **Depends on** the result contract for the error table, classification chain, projection, and redaction chokepoint.
- **Depends on** the configuration layer for the declarable credential source keys and environment facts as injected adapter data.
- **Depends on** the branding seam for environment-prefixed source keys and brand-neutral constants.
- **Depends on** the privacy guard's pure rule-definition module for the required envelope content policy; the shared definitions keep file scanning and emitter scanning in agreement.
- **Consumed by** the provider engine, the tracker, VCS, and CI adapters, the delivered client seeds at `adapters ./jira`, `adapters ./gitlab`, and `adapters ./github`, and the envelope content policy.
- **Consumed by** the provider engine ([Provider Engine](feature-provider-engine.md)) for credential-port-only quota authorization, the tracker, VCS, and CI adapters, and the delivered client seeds at `adapters ./jira`, `adapters ./gitlab`, and `adapters ./github`.
- **Risk — contract churn:** The first real adapters may reveal port-shape gaps. Mitigation: contracts derive from the catalogue's semantic rows, evolution is additive within v1, and a decision record governs adapter-contract changes. The first additive round executed under ADR-0004 (optional `updatedAt`) and ADR-0006 (optional `comments`); further evolutions stay additive within v1 and remain decision-record governed.
- **Risk — allowlist erosion:** Credential reads could migrate into allowlisted configuration readers. Mitigation: reason-bearing entries, exact paths, mutation tests, and non-vacuity checks.
- **Risk — carrier mangling:** Providers may reformat or strip carriers. Mitigation: graceful degradation with visible evidence and a compact-marker fallback carrier.
- **Risk — metadata leakage:** Public provider artifacts could expose private identifiers. Mitigation: a closed secret-free payload, brand-neutral carrier constants, and the required content policy that scans the exact embedded JSON before any carrier is produced.

## Glossary & References

| Term | Definition |
|------|------------|
| Primitive port | A typed, provider-agnostic contract in core `./contracts` for one catalogue primitive; adapters implement behind it. |
| `SessionStorePort` | The read-only session-store port with `size` and `list`; preserves ADR-0003's read-only `SessionStore` semantics and the metadata-only guarantee. |
| `SessionAdminPort` | The admin port that extends `SessionStorePort` with `prune` and `reboot`; the only mutating session-database surface. |
| Session I/O seam | The adapter-local `OpencodeSessionIo` seam: path resolution, single-statement queries, official delete, one checkpoint, injected clock, and bounded file metadata. |
| Capability declaration | Typed flags naming supported operations and carrier kinds, with explicit gap records. |
| Gap record | An adapter's explicit declaration that it does not support a capability; parity is never implied. |
| `headSha` | The optional provider-resolved merged-head commit on `DeliveryRequest`; absent means unknown and a destructive branch action refuses. |
| `resolve-delivery-thread` | The additive closed adapter operation that resolves one review thread on a delivery request with canonical arguments `{ deliveryRequest, threadId }`. |
| `merge-delivery-request` | The additive closed adapter operation that lands one delivery request with a squash strategy, optional crafted commit title and message, and an optional expected head; at most once per invocation, never retried. |
| `close-milestone` | The closed adapter operation that sets one milestone record closed, naming only the milestone identity; read-back verified, at most once per run, never retried, and unable to express create, attach, detach, rename, or reopen. |
| Credential reference | A declared mapping from an external system's auth method to its source key over the closed four-style vocabulary; resolved only through the credential port. |
| Command allowlist | The shipped closed table of (absolute program path, pinned subcommand prefix) pairs a `command` source may execute, with grammar-closed slots, the `--` terminator before the positional, and per-entry remedy selection; any widening is a reviewed allowlist addition guarded by the CI tripwire. |
| Live redaction registry | The register/values registry consulted at render time: the entrypoint registers the environment styles statically and never resolves; the resolver registers obtained material at the moment of materialization, before any parse or throw. |
| Secret-read boundary | The mechanically enforced property that ambient secret acquisition occurs only in the enumerated allowlist. |
| Quota transport | The injectable provider quota request edge at `adapters ./provider-quota`: one bounded GET, in-memory authorization header, no credential storage. |
| Metadata envelope | The versioned `delivery.metadata.v1` data contract embedded in provider artifacts by adapters. |
| Carrier | The adapter-chosen, capability-flagged form the envelope takes inside a provider artifact. |
| Content policy | The required, injected pure predicate at `serializeEnvelope`: it scans the exact compact JSON that would be embedded and returns allow or a denial carrying one rule or entry id. |
| `content-policy-violation` | The fail-closed codec-local serialization failure produced when the content policy denies a payload; it carries no content and no carrier. |
| Graceful degradation | Heuristic fallback with visible degradation evidence, never a flow failure. |

See also: [Session Database Administration](feature-session-database-admin.md), [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md), [Provider Client Seeds and Trap Catalogs](feature-provider-client-seeds.md), [Adapter Conformance Suite](feature-adapter-conformance.md), [Closeout Transaction](feature-closeout.md), [Result Contract and Error Table](feature-result-contract.md), [Configuration Layer and Inspection](feature-config-layer.md), [Branding Seam and Working Name](feature-branding-seam.md), [Privacy and No-Cloud Guards](feature-privacy-guard.md), the [repository glossary](../../overview/glossary.md), and [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md).

**Change record:** `doc/changes/2026-10/2026-10-30--GH-181--primitive-ports-credential-metadata/`.
**Contract-extension change record:** `doc/changes/2026-10/2026-10-31--GH-188--client-seeds-trap-catalogs/`.
**Closeout contract-extension change record:** `doc/changes/2026-11/2026-11-01--GH-183--closeout-v1-branch-cleanup/`.
**Provider engine change record:** `doc/changes/2026-10/2026-10-31--GH-182--provider-v1/`.
**Session-admin change record:** `doc/changes/2026-10/2026-10-31--GH-180--db-session-admin-port/`.
**Credential-strategies change record:** `doc/changes/2026-11/2026-11-23--GH-394--credential-owner-strategies/` (ADR-0014).

## Related
- [Adapter Reference Behavior](feature-adapter-reference-behavior.md) states the normative per-operation contract these adapters implement.
- [Verify Gates](feature-verify-gates.md) consumes the optional `DeliveryRequest` gate facts; absence is unknown.
- [Harness Adapters](feature-harness-adapters.md) joins the port family with `HarnessInstance`, `HarnessSession`, and the execution-environment descriptor; [ADR-0008](../../decisions/ADR-0008-harness-adapter-contract.md) is the binding contract.

## GH-238 additive daemon subpath

`@delivery-os/adapters/daemon` is the declared non-provider local-I/O subpath: stdio/unix transports, the detached process supervisor, the event-log wake source, the clock edge, the lane executor, and the platform supervisor adapters. It owns no commit-effect wrapper and is admitted by the runtime-API confinement allowlist.
