---
change:
  ref: GH-338
  type: feat
  status: Proposed
  slug: github-adapter-completion
  title: "M3-S4: GitHub adapter completion, code host + backlog"
  owners: ["engineering"]
  service: delivery-os provider adapters (GitHub reference adapter)
  milestone: "M3: Harness and tracker integrations"
  labels: ["adapters", "github", "tracker-integration", "m3-s4"]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: medium
  dependencies:
    internal:
      - core adapter contracts
      - provider client seeds
      - adapter conformance testkit
      - CLI composition edge
      - reference-behavior documentation
    external:
      - GitHub REST and GraphQL API
      - GitHub CLI (gh)
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the GitHub adapter the complete, capability-honest reference for both code hosting and backlog management — CLI-first with a declared API fallback — so every later tracker adapter is parity-tested against a whole contract instead of a read-mostly seed.

## 1. SUMMARY

This change completes the GitHub adapter across the full closed adapter operation set, which grows from eight to nine operations with a provider-side squash landing. It adds a CLI-first provider transport (`gh` preferred, direct API fallback) selected by a bounded probe, closes the two remaining declared gaps (`write-comment`, `write-delivery-request`), adds check-failure timing and a bounded log excerpt, adds a bounded review-thread discussion read, and makes GitHub Issues transitions resolve through one injected, seeded workflow map. It then captures the resulting behavior as the adapter contract's reference-behavior surface, which is the second half of the ticket's acceptance criterion.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The closed adapter operation set is exactly eight operations: `read-work-item`, `write-work-item`, `transition-work-item`, `read-delivery-request`, `write-delivery-request`, `read-pipeline-run`, `write-comment`, and `resolve-delivery-thread`.
- The GitHub client is a direct REST/GraphQL client over an injected, fetch-shaped provider transport. The subpath has no vendor-CLI seam and no child-process edge; the delivered production child-process sites are the harness host, the local git seam, and the daemon supervisor.
- `GITHUB_ADAPTER_CONTRACT` supports six operations and declares `write-comment` and `write-delivery-request` as `adapter-not-implemented` gaps. The conformance suite therefore records both as declared-gap skips.
- Review-thread reads already exist over GraphQL (root author login, actor kind, association, a 100-thread bound) and thread resolution is delivered; the query deliberately requests one root comment node and never requests comment bodies.
- `PipelineJob` is `{ jobName, jobState }` with no timing; `PipelineRun.traceEvidence` is a reference only and carries no log body. Check runs normalize to one `PipelineRun` per run with one job each.
- The bounded deploy-trace read is the delivered precedent for an adapter-local evidence read behind the existing ports: one bounded read, a closed provider-neutral shape, no new closed operation, no log bodies.
- GitHub Issues status is inferred from a local two-row table (`open` → `ready`, `closed` → `done`) with no mechanism field, no injection, and no validation. Transition writes are narrowed to `done`.
- The lifecycle merge path lands through the local git seam; no provider-side merge capability exists anywhere in the operation set.
- The adapter conformance registry is exactly three flows and thirteen steps; structural and runtime gates pin all eight operations per adapter, require every supported operation to execute, and require every declared gap to be encountered.
- The provider subpath exports are pinned by a structure test and a per-file executable-export inventory; the surface already exceeds the five names the provider-client-seeds spec still claims, which is pre-existing documentation drift.
- The mock conformance tier installs a throwing-`fetch` guard and has no equivalent child-process guard.
- Binding invariants: additive-within-v1 contract evolution with a decision record; an exact, reason-bearing runtime-API confinement allowance; an exact secret-read boundary allowlist with exactly one credential-material entry; provider-native types never cross a subpath; packed-export parity uses relative shared-module specifiers; adapters never import each other.

### 2.2 Pain Points / Gaps

- The reference adapter is incomplete exactly where the milestone's exit criteria name depth: no CLI transport, no crafted squash landing, no check timings, no failure-log evidence, and no thread discussion content.
- GitHub Issues behaves like a status reader, not a backlog tracker: comments cannot be written, delivery-request content cannot be written, and transitions cannot express in-progress or in-review.
- Because GitLab and Jira are parity-tested against GitHub, every gap in the reference becomes a reference-level gap in the parity bar.
- The adapter's reference behavior exists only across decision records and prose; the ticket's acceptance criterion requires it in the adapter contract as inspectable, comparable behavior.
- The conformance suite cannot currently prove a CLI path at all, and cannot prove that the mock tier spawns no process.

## 3. PROBLEM STATEMENT

Because the GitHub adapter has no vendor-CLI transport, only six of the closed operations, no provider-side landing, no failure-evidence depth, and a two-row issue-status table, the delivery system cannot treat GitHub as the complete reference for code hosting and backlog management, so GitLab and Jira are parity-tested against a partial reference and the milestone's CLI-first, crafted-merge, and failure-triage commitments remain undeliverable.

## 4. GOALS

- **G-1**: GitHub is the complete, capability-honest reference adapter for code hosting and backlog management across the whole closed operation set (nine operations), with zero declared gaps.
- **G-2**: The vendor CLI is the preferred transport with a declared direct-API fallback, one normalization layer, and a capability matrix that is inspectable data rather than prose.
- **G-3**: Review-thread discussion content, check-failure timing and bounded log evidence, provider-side squash landing with crafted metadata, and GitHub Issues comments/transitions are all reachable behind the port boundary.
- **G-4**: The adapter conformance parity suite is green with GitHub's gaps closed and the new operation represented.
- **G-5**: The reference behavior is documented as part of the adapter contract and is checkable against the machine-readable declarations.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| GitHub capability completeness | 9 supported operations, 0 declared gaps; supported plus gaps equals the closed set exactly |
| Transport declaration coverage | 100% of closed operations declare a preferred `gh` transport and an `api` fallback |
| Cross-transport normalization parity | 100% of replayed tenant routes yield identical normalized views, failure identities, structured status, and page counts |
| Offline containment | 0 live network calls and 0 live child processes in the mock tier |
| Conformance coverage | Registry operation set equals the closed set; 100% of supported operations execute; 100% of declared gaps encountered |
| Evidence bounds | 0 excerpt responses exceed 8192 bytes; 0 thread reads exceed 50 comments or 4096 bytes per body; 0 evidence bytes persisted |
| Reference-behavior completeness | 100% of closed operations plus both evidence reads documented and consistent with exported declarations |
| Merge safety | 0 merge retries; 0 writes re-issued on a second transport; already-merged success only after provider-asserted read-back |

### 4.2 Non-Goals

- **NG-1**: Rewiring the lifecycle merge transaction to the provider-side merge. The delivered local-git landing path is unchanged.
- **NG-2**: Designing or adding a configuration-file schema, settings type, catalog branch, or new configuration key.
- **NG-3**: Implementing GitLab or Jira capabilities. They only gain the new operation's declared gap; no other posture changes.
- **NG-4**: Changing `DeliveryThread` or adding discussion text to the normalized contract.
- **NG-5**: Full log archives, tail-follow, log pagination, or a caller-tunable excerpt bound.
- **NG-6**: Thread pagination beyond the declared per-thread caps.
- **NG-7**: Any opencode harness work, any cloud/vendor naming, and any rewrite of the shared import alias.
- **NG-8**: Widening the operation set beyond the one named landing operation, or adding force/bypass/queue/rebase merge semantics.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Complete capability posture for the GitHub reference adapter | The reference must be whole before it can be the parity bar; the ticket's first AC is a green parity suite. |
| F-2 | CLI-first provider transport with a declared API fallback and a bounded probe | M3 EC-3 requires CLI-first with an explicit, per-primitive capability matrix. |
| F-3 | Provider-side squash landing with crafted commit metadata and an optional head guard | The ticket names squash merge with crafted title/description and squash commit message. |
| F-4 | Check-failure timing and a bounded, adapter-local log excerpt | The ticket names failure job/log/timing access; Q-07 fixes status + failed job + bounded excerpt + durations. |
| F-5 | Bounded review-thread discussion read as evidence, never lifecycle truth | The ticket names threaded discussions; bodies are evidence and stay out of the normalized contract. |
| F-6 | GitHub Issues backlog completion: comments, content writes, and mapped transitions | The ticket names GitHub Issues read/update, comments, and transitions; Q-04 fixes project-configurable, seeded mapping. |
| F-7 | Reference-behavior documentation as an inspectable adapter contract | The ticket's second AC requires reference behavior documented in the adapter contract. |
| F-8 | Conformance parity for the completed contract, proven offline | The ticket's first AC requires a green parity suite, and M3 EC-4 requires non-vacuous parity. |

### 5.1 Capability Details

**F-1 — Complete capability posture.** GitHub declares all nine closed operations supported and no gaps. The operation set grows by one: a provider-side landing operation whose arguments carry the delivery request, a squash-only strategy, optional crafted commit title and message, and an optional expected head SHA. `write-delivery-request` remains a content write and never lands. GitLab declares the new operation `adapter-not-implemented`; Jira declares it `provider-unsupported`; their other declarations are unchanged. No operation's presence implies support, and no gap reason leaves the closed reason set.

**F-2 — CLI-first transport.** The adapter prefers a vendor-CLI transport that acts as an authenticated API caller and falls back to the direct API transport. Both transports sit under the same client, request shaping, and normalization, so consumers see no surface change. Composition probes once, selects a transport under a closed policy (`prefer-cli` default, `api-only` available), and records the declared degradation when it falls back. There is no per-request failover: a mid-run CLI failure is a classified transport failure and a write is never re-issued on the other transport. The declared matrix is uniform in this change because the CLI is transport-level, not primitive-level.

**F-3 — Provider-side squash landing.** One destructive operation lands a delivery request with a squash strategy, crafted commit title and message, and an optional expected-head guard. The caller's delivery-request title and body remain content-write business. Already-merged is an observed success only after reading the request back and observing provider-asserted merged truth; a refusal alone is never success. The operation is at most once per invocation, never retried, and cannot express force, branch-protection bypass, auto-merge, merge queues, rebase, or merge-commit strategies. It returns the landing commit identity only when the provider supplies it; absence is unknown, never derived.

**F-4 — Failure evidence.** Completed check runs may carry provider-asserted start and completion timestamps as optional job fields, copied verbatim, absent when the provider did not supply them, and never turned into a derived duration. Failure log text is available only through one bounded adapter-local read that returns a closed shape: job identity, a faithful byte prefix of the provider's text, an explicit truncation signal, and the returned byte length. The cap is fixed and not caller-tunable; the read performs one request, no pagination, no retry, no archive download, and never persists the text.

**F-5 — Threaded discussion evidence.** One bounded adapter-local read returns a single review thread's discussion: thread identity, resolution state, provider-asserted comment count, a bounded oldest-first comment list, and an overall truncation signal. Each comment carries identity, optional author facts, body text, and a per-body truncation signal. Caps are fixed per thread and per body. The normalized `DeliveryThread` stays body-free; no capability, operation, or conformance projection changes. Bodies are evidence: no resolution, transition, label, merge, or closeout write may be decided from them.

**F-6 — Backlog completion.** GitHub gains a comment write that accepts carrier-free human text only (no metadata carrier is claimed) and the delivery-request content write that creates or updates title/body without landing. Issue reads and updates remain as delivered. Transitions resolve through one injected workflow map, defaulting to a declared four-row seed built from this repository's lifecycle labels (`closed` → `done` by field update, `review` → `in-review` by label swap, `in-progress` → `in-progress` by label swap, `open` → `ready` by field update, in that precedence); the same map drives read normalization and the transition write. Status tokens are native issue states or lifecycle label names. Label-based transitions remove only declared lifecycle label tokens before applying the new one, never replace the full label array, and refuse when the current label signal is unavailable. An undeclared alias is a named typed refusal with no provider write. The mapping is construction data: no configuration schema, key, or file format is added.

**F-7 — Reference behavior.** The adapter contract gains a reference-behavior surface that states, per closed operation, the preferred and fallback transport, the primary failure identities and their classification, absence semantics, caps and truncation signals, and the provider gap posture; and, for the evidence reads, their shape, caps, classification, secret discipline, and deliberate absences. The documented values must agree with the exported declarations and fixed bounds. The surface also states the probe and refusal contract and the no-failover rule.

**F-8 — Conformance parity.** The registry represents the whole closed set, including the new landing operation, and its operation set equals the closed operation set exactly. Supported writes execute through production client members against declarative mock tenants; declared gaps are encountered with their exact reasons. The mock tier proves zero live network calls and zero live child processes. Every new behavior has an offline fixture and an expected projection. Pinned structural surfaces (provider exports and per-file executable exports) are updated in the same change, and replay is deterministic.

## 6. USER & SYSTEM FLOWS

```
Flow 1: Composition selects a transport
  Operator/agent invokes a GitHub-backed command
    → composition probes the CLI once (version + capability)
    → probe returns ok or one closed refusal code
    → under prefer-cli: CLI selected, or API selected with recorded degradation
    → client receives one transport; no per-request re-decision
```

```
Flow 2: Read with transport transparency
  Consumer calls a read
    → client shapes the request once
    → selected transport sends it
    → one normalizer returns the primitive view or a classified failure
    → 404 remains definitive absence; other non-2xx keeps structured status; transport failure has none
```

```
Flow 3: Crafted squash landing
  Caller supplies request + squash + optional commit title/message + optional expected head
    → adapter sends one landing request
    → provider rejects guard / already merged / lands
    → on refusal: classified outcome; on already-merged: read back; success only on provider-asserted merged truth
    → merge commit identity returned only if the provider supplied it
```

```
Flow 4: Failure triage
  Verify/status consumer sees a failed run
    → normalized job carries provider timestamps when present
    → consumer requests one bounded log excerpt for the failing job
    → excerpt is bounded, visibly truncated, redacted at render, never persisted
```

```
Flow 5: Review discussion inspection
  Consumer holds a thread id from a delivery request
    → one bounded per-thread discussion read
    → closed shape with provider count and explicit truncation
    → bodies inform a human/agent reader; no write path consults them
```

```
Flow 6: Backlog transition
  Consumer requests a delivery alias
    → adapter resolves the alias through the one workflow map
    → removes present declared lifecycle tokens, applies the row mechanism
    → refuses an undeclared alias or an unavailable label signal
    → a subsequent read through the same map yields the written alias
```

```
Flow 7: Conformance parity
  Parity suite runs offline
    → registry covers every closed operation
    → supported steps execute against mock tenants; gaps are encountered
    → zero network and zero child processes
    → projections and reports are deterministic
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The GitHub adapter's own surface: its transport, probe, composition selection, capability declaration, new reads and writes, and its internal workflow map.
- The core contract additions exactly as decided: one new closed operation and two optional `PipelineJob` timestamps.
- Capability declarations for all three shipped adapters, limited to closing GitHub's gaps and adding the new operation's gap for GitLab and Jira.
- Conformance registry, flow step, coverage gates, mock-tenant routes, skip-kind behavior, and expected projections for the new and newly supported operations.
- Trap-catalog entries and fixtures for every new behavior.
- Structural-surface and content-inventory updates required by new exports and modules.
- The reference-behavior documentation required by the ticket's second acceptance clause.
- Decision records TDR-0031 through TDR-0034, already authored on the change branch, cited here as DEC-1 through DEC-4.

### 7.2 Out of Scope

- [OUT] Rewiring the lifecycle merge transaction to the provider-side merge; the local-git landing path stays as delivered.
- [OUT] A new configuration-file schema, settings type, catalog branch, config key, or startup validation path for the workflow mapping.
- [OUT] GitLab and Jira implementation work; they only gain the declared gap for the new operation.
- [OUT] Any change to `DeliveryThread`, `DeliveryRequest`, or another normalized contract shape.
- [OUT] Full log archives, log tail-follow, log pagination, or a caller-tunable excerpt bound.
- [OUT] Thread pagination beyond the declared caps.
- [OUT] The opencode harness, any cloud/vendor naming, and any rewrite of the shared import alias.
- [OUT] Force, branch-protection bypass, auto-merge, merge queues, rebase, or merge-commit strategies.
- [OUT] Live-tier behavior changes; the live tier's read-only posture is preserved.

### 7.3 Deferred / Maybe-Later

- A provider-native job duration field (deliberately deferred because GitHub asserts no duration; a provider that does adds it in its own additive round).
- Per-primitive transport divergence, a `cli-only` proof mode, or a transport-in-use declaration at the composition edge.
- Loading the workflow mapping from project configuration (owned by the later multi-tracker story).
- A `canceled` delivery-alias representation and a `backlog` seed row for this repository.
- Migrating the review-feedback flow onto the adapter ports.
- Promoting the workflow-map validator to a shared home once a third adapter needs it.
- Reconciling the two coexisting merge mechanisms.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

No inbound HTTP endpoint is added, changed, or removed; this change is an outbound adapter. The consumed provider surfaces are captured as interface contracts:

| ID | Consumed surface | Contract |
|----|------------------|----------|
| API-1 | Delivery-request landing | One request that accepts a squash strategy, an optional crafted commit title and message, and an optional expected head; returns provider-asserted landing identity when supplied; a guard rejection is a classified refusal. |
| API-2 | Check-run read | Returns run identity, job state, and optional provider-asserted start and completion timestamps. |
| API-3 | Failure log text | One bounded read of a job's log text; the exact provider surface is fixed by the implementing fixture without reopening the excerpt shape or cap. |
| API-4 | Review-thread discussion | One read per thread returning resolution, provider comment count, and a bounded comment list with author facts and bodies. |
| API-5 | Issue comment write | One write of carrier-free human comment text. |
| API-6 | Delivery-request content write | Create or update of the request title/body; never lands the request. |
| API-7 | Issue read/update and transition | Issue state, labels, and the mapped transition write (issue state or lifecycle label). |

### 8.2 Events / Messages

None. No event, message, or state-schema record is added. The conformance artifact remains an evidence record, not a lifecycle event, and carries no thread bodies or log excerpts.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Ninth closed operation | `merge-delivery-request` joins the closed operation set with canonical arguments `{ deliveryRequest, strategy: "squash", commitTitle?, commitMessage?, expectedHeadSha? }` and an outcome carrying an optional provider-supplied landing commit identity. |
| DM-2 | Pipeline-job timings | `PipelineJob` gains optional `startedAt` and `completedAt`, each a provider-native timestamp copied verbatim; absent means unknown; no derived duration. |
| DM-3 | Thread discussion read shape | Closed adapter-local shape `{ threadId, resolved, commentCount, comments[], truncated }` with per-comment `{ commentId, authorLogin?, authorKind?, authorAssociation?, body, bodyTruncated }`. |
| DM-4 | Log excerpt shape | Closed adapter-local shape `{ jobId, excerpt, truncated, byteLength }`; `excerpt` is a faithful byte prefix; the truncation flag is the authority. |
| DM-5 | Transport matrix | Declared data covering every closed operation with a preferred CLI transport and an API fallback. |
| DM-6 | Workflow map seed and token vocabulary | The core `WorkflowMap` reused as optional injected construction data with a four-row precedence-ordered seed; a status token is a native issue state or a lifecycle label name. |
| DM-7 | Probe and refusal result | Closed result `{ ok: true, version }` or `{ ok: false, code }` with `provider.cli.unavailable`, `provider.cli.version-unsupported`, or `provider.cli.capability-unsupported`. |
| DM-8 | `DeliveryThread` unchanged | Field set remains `{ threadId, resolved, commentCount, authorLogin?, authorKind?, authorAssociation? }`; no body and no reply field. |

### 8.4 External Integrations

#### 8.4.1 Reference-Behavior Contract (normative)

This subsection is normative and is the artifact the ticket's second acceptance clause names. It is the source F-7 and AC-F7-* verify.

**Table A — Per-operation transport, failure identities, and gap posture**

| Operation | Preferred | Fallback | Primary failure identities | GitHub posture | GitLab / Jira posture |
|---|---|---|---|---|---|
| `read-work-item` | `gh` | `api` | 404 → `provider.not-found`; other non-2xx → `provider.payload.invalid` + `httpStatus`; transport/timeout → `provider.payload.invalid` without status; credential → `config.credential.missing` | Supported | Unchanged (GitLab adapter-not-implemented; Jira supported) |
| `write-work-item` | `gh` | `api` | Classified write failure `provider.payload.invalid`; no silent flattening; unavailable label signal refuses | Supported | Unchanged |
| `transition-work-item` | `gh` | `api` | Classified write failure; undeclared alias is a named refusal; unavailable label signal refuses | Supported | Unchanged |
| `read-delivery-request` | `gh` | `api` | Same read classification as `read-work-item` | Supported | Unchanged |
| `write-delivery-request` | `gh` | `api` | Classified content-write failure; never lands | **Supported** (gap closes) | Unchanged |
| `read-pipeline-run` | `gh` | `api` | Same read classification; one bounded page, raw page size reported | Supported | Unchanged |
| `write-comment` | `gh` | `api` | Classified write failure; carrier-free text only | **Supported** (gap closes) | Unchanged |
| `resolve-delivery-thread` | `gh` | `api` | Classified write failure; provider-asserted resolved thread validated | Supported | Unchanged |
| `merge-delivery-request` | `gh` | `api` | Guard rejection is classified; already-merged is success only after read-back; any other refusal is classified; no retry | **Supported** (new) | GitLab `adapter-not-implemented`; Jira `provider-unsupported` |

**Table B — Evidence reads, caps, and truncation signals**

| Surface | Kind | Cap | Truncation signal | Classification | Persistence |
|---|---|---|---|---|---|
| Review-thread discussion | Adapter-local read, outside the closed set | 50 comments per thread; 4096 bytes per body; no override | Thread-level `truncated` is true exactly when returned comments are fewer than the provider count or any body is truncated | Explicit 404/absent thread → not-found read result; other non-2xx, transport failure, malformed 2xx → `provider.payload.invalid`; count 0 with an empty list is observed empty | Never persisted; never in the conformance artifact; redacted at the rendering chokepoint |
| Failure log excerpt | Adapter-local read, outside the closed set | 8192 bytes; one read; no pagination or retry | `truncated` is the authority; `byteLength` equals returned bytes | 404 → not-found; other non-2xx/transport → `provider.payload.invalid`; empty 2xx is observed empty | Never persisted; never in the conformance artifact; redacted at render |
| Deploy trace | Delivered adapter-local read | Unchanged | Unchanged | Unchanged | Unchanged |

**Table C — CLI probe and composition contract**

| Aspect | Reference behavior |
|---|---|
| Probe | One bounded version invocation at composition time only; never at module load; never in the mock tier |
| Result | Closed: success with a version, or exactly one refusal code (`provider.cli.unavailable`, `provider.cli.version-unsupported`, `provider.cli.capability-unsupported`) |
| Policy | Closed `prefer-cli` (default) or `api-only`; the selection is a composition decision, not a request decision |
| Degradation | When the preferred CLI is unusable, the API transport serves and the composition records the declared degradation |
| Failover | None per request; a mid-run CLI failure is a classified transport failure; a write is never re-issued on the other transport |
| Child execution | Fixed argv, no shell, no pagination, no interactive prompt, bounded timeout and output, adapter-constructed environment |
| Credential | Material arrives from the credential port as child-environment data; never in argv, stdout, stderr, diagnostics, or failure detail; the CLI configuration directory is isolated and prompt suppression is set |

**Table D — Absence semantics**

| Signal | Absent means | Never |
|---|---|---|
| `PipelineJob.startedAt` / `completedAt` | Provider did not assert it; value unknown | Derived, defaulted, or collapsed to zero; never a computed duration in the contract |
| `DeliveryRequest.headSha` | Provider did not supply merged-head identity | Guessed or derived |
| `DeliveryThread` author facts | Author unknown (fail closed) | Inferred from body text |
| `WorkItem.comments`, `relations`, `updatedAt` | Unknown (not fetched / omitted) | Collapsed to an empty or zero value |
| `pageItemCount` | Not applicable; supplied whenever a page is read | Replaced by a header-derived or synthesized value |
| Merge commit identity | Provider did not supply it | Derived from a local commit or a branch head |

The evidence reads make the same distinction: a provider-asserted empty result is observed empty, while an unavailable read is not-found or a classified failure — never an empty success. Bodies and log excerpts are evidence, never lifecycle truth, and carry no write authority.

**Table E — GitHub Issues transition mapping seed (normative)**

Status tokens are either a native issue state or a lifecycle label name. Rows are declared in precedence order, most specific first; the order is load-bearing and applies to both read normalization and transition writes.

| Precedence | Token | Delivery alias | Mechanism | Note |
|---|---|---|---|---|
| 1 | `closed` | `done` | `field-update` | Terminal truth wins over any lingering label |
| 2 | `review` | `in-review` | `label-swap` | This repository's ready-for-review label |
| 3 | `in-progress` | `in-progress` | `label-swap` | Delivery-started label |
| 4 | `open` | `ready` | `field-update` | Delivered mapping; a transition here reopens the issue |

Deliberately unmapped tokens and aliases: `change`, `planning`, `spec-ready`, `readiness-passed`, `delivered`, `blocked`, `backlog-capture`, `canceled`, and the `backlog` alias. A transition to an unmapped alias refuses with a named failure; a project that needs one supplies a map row through the construction input, except `canceled`, which needs an additive representation decision first. The seed is construction data: changing it does not require a configuration file, and a configuration file cannot change it until the later configuration story lands — the reference behavior states that limitation plainly.

#### 8.4.2 Vendor CLI

`gh` is an optional runtime dependency of the preferred transport. It is version-windowed at the probe, never invoked through a shell, never asked to paginate or transform output, and never allowed to use an operator's stored login. `api-only` composition removes the dependency entirely.

#### 8.4.3 GitHub API

The direct REST/GraphQL API remains the declared fallback and the offline deterministic default. No new host, credential source, or network location is introduced.

### 8.5 Backward Compatibility

- The change is additive within the first contract version: no field is removed, retyped, or made required; no operation is removed or renamed; no persisted-state migration exists.
- `createGitHubClient` and its options keep their delivered shape; `transport` remains the only transport seam and existing call sites keep compiling.
- Adding one member to the closed operation set intentionally fails exhaustive consumers at compile time; the registry, coverage gates, capability declarations, mock routes, and expected projections update in the same change.
- The workflow map is an optional construction input; absent means the declared seed, so current call sites are unaffected.
- One behavior changes deliberately and visibly: GitHub Issues labelled `in-progress` or `review` now normalize to `in-progress` / `in-review` instead of `ready`. Delivered consumers distinguish only `done`/`canceled` from everything else, so lifecycle behavior is unchanged while truth improves.
- `write-comment` becoming supported turns the comment-provenance carrier roundtrip into a capability-absent skip (empty carrier arrays), not a declared-gap skip.
- No new inbound interface, event, configuration key, or state record exists.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Transport declaration coverage | 100% of the closed operation set has a preferred CLI transport and an API fallback declared as data |
| NFR-2 | Offline containment and determinism | 0 live network calls and 0 live child processes in the mock tier; the same fixture replayed twice yields identical step order, projections, skip reasons, and diagnostics |
| NFR-3 | Secret hygiene | 0 occurrences of resolved credential material in recorded argv, stdout, stderr, diagnostics, or failure detail; 100% of CLI invocations carry the isolated configuration directory and prompt suppression; secret-read allowlist count unchanged with exactly one credential-material entry |
| NFR-4 | Failure-classification fidelity | 100% of replayed routes: 404 → `provider.not-found`; any other non-2xx → `provider.payload.invalid` with structured status; transport failure → `provider.payload.invalid` without status; raw page count preserved; identical across both transports |
| NFR-5 | Destructive-action safety | Merge is at most once per invocation: 0 retries; 0 writes re-issued on a second transport; already-merged success requires a read-back of provider-asserted merged truth |
| NFR-6 | Evidence bounds and non-persistence | Excerpt ≤ 8192 bytes; ≤ 50 comments per thread; ≤ 4096 bytes per body; 0 evidence bytes in persisted state; 0 evidence in the conformance artifact; 100% of rendered evidence passes the redaction chokepoint |
| NFR-7 | Conformance coverage | Registry operation set equals the closed set exactly; 100% of supported operations execute; 100% of declared gaps encountered with exact reasons; ≥1 offline fixture per new behavior |
| NFR-8 | Additive compatibility and structural exactness | 0 removed, retyped, or newly required contract fields; 0 state migrations; typecheck, lint, build, and the aggregate gate green; pinned export and inventory lists updated exactly and not vacuously |
| NFR-9 | Bounded process execution | Exactly one process per CLI request; fixed argv; no shell; no pagination or output transform; bounded timeout not exceeding the delivered operation default; bounded output buffer |
| NFR-10 | Bounded evidence-read cost | Exactly one read per log excerpt and one read per thread; 0 retries; 0 follow-up pagination |
| NFR-11 | Read/write symmetry | 100% of mapped aliases written through the map read back as the same alias |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

- No new telemetry row, metric, event, or state record is introduced.
- Capability declarations, the transport matrix, the workflow seed, and the fixed evidence caps are inspectable data.
- The conformance artifact continues to record step status, skip kind, and bounded diagnostics; it records no thread body and no log excerpt.
- Failure identities remain classifiable from structured data, never from prose; the CLI probe refusal codes are adapter-local and not lifecycle failures.
- A transport-in-use declaration beyond the composition edge is deliberately deferred; it must never be achieved by widening normalized views.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Vendor-CLI flag or output drift across `gh` versions breaks the preferred path | M | M | One bounded probe, a version window, one argv mapping, and a typed refusal that selects the API fallback | L |
| RSK-2 | Status recovery from CLI output is ambiguous (multiple status blocks, proxies) and failure classification becomes a guess | H | L | The transport treats the final status line as authoritative and refuses an unparsable block rather than reporting a false status; fixture-proven | L |
| RSK-3 | Credential material leaks through argv, child output, or a failure detail | H | L | Credential arrives as child-environment data; isolated config directory; no provider prose in failure detail; golden argv/environment assertions | L |
| RSK-4 | A provider-side landing lands twice or treats an already-merged refusal as success | H | L | At-most-once semantics, no retry, no second-transport re-issue, and success only after provider-asserted merged truth | L |
| RSK-5 | Workflow seed order, token casing, or duplicate rows make read and write disagree | M | M | Internal validator, an order-asserting seed test, one map instance for both directions, and typed refusal for undeclared aliases | L |
| RSK-6 | Thread bodies or log excerpts leak sensitive text into state, artifacts, or rendered output | M | M | Fixed caps, non-persistence, exclusion from the conformance artifact, and redaction at the single rendering chokepoint | M |
| RSK-7 | The widened conformance suite passes vacuously or its projections drift | M | M | Exact set equality, runtime coverage of executed steps and encountered gaps, new routes and projections, and replay determinism | L |
| RSK-8 | The provider's log-text surface is absent or differs per check run | M | M | The shape and cap are fixed; the surface is chosen by fixture; an absent surface is a declared not-found, never an empty success | M |
| RSK-9 | The plan quietly widens scope into the merge transaction, configuration schema, or other adapters | M | M | Explicit non-goals, recorded non-decisions, and scope-boundary acceptance criteria | L |
| RSK-10 | The mock tier spawns a real process because no child-process guard exists today | M | L | A child-process guard joins the throwing-fetch guard, and all CLI-path tests use an injected runner | L |
| RSK-11 | Narrowed write-side breadth for mapped aliases ships a declared-but-inert row | M | L | Read/write symmetry acceptance criterion; the safe reduction keeps read-side derivation and write-side for done plus mapped label swaps, with the remainder declared as the next increment | L |

## 12. ASSUMPTIONS

- `gh` exposes a generic authenticated API-caller surface with a way to recover the final HTTP status, and its documented token/host variables are sufficient for non-interactive use.
- `gh` reads its own host configuration unless redirected, so an isolated configuration directory is required for credential honesty.
- GitHub's landing surface accepts a squash strategy, crafted commit title and message, and an expected-head guard, and reports already-merged as a refusal variant.
- Completed check runs expose provider-asserted start and completion timestamps; incomplete runs may omit completion.
- A per-thread discussion surface exists and returns comments with bodies and author facts in a stable enough order that a bounded prefix is faithful.
- A provider surface for bounded log text exists for the checks this adapter reads; the exact surface is fixture-decided.
- Credentials remain environment-only; the applied default credential name is the project's GitHub token name.
- Mock tenants can express every new route offline, and the live tier remains read-only.
- The reference behavior can be stated without adding any core contract type.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Core adapter contracts and capability mechanism | The ninth operation and two optional timestamps are additive contract changes. |
| Depends on | Provider client seeds and the shared transport seam | The CLI transport is a second implementation of the existing seam. |
| Depends on | Adapter conformance testkit and mock tenants | Registry, coverage gates, routes, projections, and the new guard. |
| Depends on | Rendering/redaction chokepoint and the result contract | Evidence text is redacted there; failure identities stay unchanged. |
| Depends on | Command-line composition edge | Probe and transport selection happen there. |
| Depends on | Decision records TDR-0031 through TDR-0034 | Authored on the change branch; cited as DEC-1 through DEC-4. |
| Blocks | GitLab code-host completion | It is parity-tested against this reference behavior. |
| Blocks | Adapter conformance and parity suite completion | The registry and reference bar come from this change. |
| Blocks | Multi-tracker project composition | It depends on the completed reference and the mapping representation. |

## 14. OPEN QUESTIONS

No open questions remain. Every previously unrouted contract question is settled by the four decision records cited in the decision log, and the applied defaults cover the unanswered milestone questions that reach this change. Items deliberately left open are provider-surface `TO-CONFIRM` details that are fixture-decided inside the settled shapes (see section 24.4); they do not change scope, contract, or acceptance.

| ID | Question | Context | Status |
|----|----------|---------|--------|
| — | None | All scope, contract, evidence-tier, and mapping questions are decided (DEC-1…DEC-4); applied defaults cover the remaining inputs (DEC-6). | Closed |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Adopt one CLI-first provider transport over the vendor CLI, selected at composition by a bounded probe, with the direct API as the declared fallback, no per-request failover, an injected child runner, an isolated child environment, and status recovery preserved. | M3 EC-3; one normalization layer; write safety; reversible composition change. Source: TDR-0031. | 2026-11-17 |
| DEC-2 | Add the provider-side landing operation with squash-only crafted metadata and an optional head guard; add optional job start/completion timestamps; add a bounded adapter-local log excerpt read; do not rewire the lifecycle merge transaction. | Capability honesty without overloading a content write; truthful absence; evidence stays out of the contract. Source: TDR-0032. | 2026-11-17 |
| DEC-3 | Serve review-thread bodies through one bounded adapter-local read and keep the normalized contract body-free. | Bodies are evidence, not lifecycle truth; no named port-side consumer; no conformance projection widening. Source: TDR-0033. | 2026-11-17 |
| DEC-4 | Map GitHub Issues transitions through the core workflow-map contract as optional injected construction data with a declared seed and an internal validator; add no configuration schema. | Configurability as data at the cheapest surface; one map drives read and write; the configuration source belongs to a later story. Source: TDR-0034. | 2026-11-17 |
| DEC-5 | Evolve the adapter contract additively within the first version, governed by a decision record; no field removal, retype, or new requirement, and no state migration. | Standing discipline from the delivered additive rounds; keeps consumers compiling and behavior stable. Source: existing contract-evolution precedent. | 2026-11-17 |
| DEC-6 | Apply the milestone defaults for the unanswered inputs: environment-only credential name is the project's GitHub token name; the issues lifecycle mapping is project-configurable and seeded with this repository's label conventions; failure analytics depth is status + failed job name + bounded log excerpt + durations, with full archives out of scope. | The milestone question ticket carries no answers, so the stated defaults apply. Source: GH-338 planning notes. | 2026-11-17 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| GitHub adapter surface (transport, probe, reads, writes, mapping) | Updated |
| Core adapter contracts (operation set, job timings) | Updated additively |
| Adapter capability declarations (GitHub, GitLab, Jira) | Updated |
| Adapter conformance testkit (registry, coverage, mock routes, projections, guard) | Updated |
| Provider trap catalogs and fixtures | Updated |
| Command-line composition edge (probe, selection, degradation record) | Updated |
| Reference-behavior documentation | New |
| Decision records and decision index | Authored; index updated |
| Provider-client-seeds, adapter-ports, adapter-conformance, merge-verify-deploy specs | Updated in the documentation phase |
| Documentation index and help/reference coverage | Updated where the new reference surface is indexed |
| Lifecycle merge transaction | Unchanged (deliberate non-decision) |
| Configuration layer and catalog | Unchanged (deliberate non-decision) |
| GitLab and Jira implementation | Unchanged except the new operation's declared gap |

## 17. ACCEPTANCE CRITERIA

### 17.1 Capability posture (F-1)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the GitHub capability declaration, **when** the closed operation set is enumerated, **then** GitHub declares all nine operations supported with zero declared gaps, and supported plus gaps equals the closed set exactly. | F-1, DM-1 |
| AC-F1-2 | **Given** the GitLab and Jira declarations, **when** the new landing operation is introduced, **then** GitLab declares it `adapter-not-implemented` and Jira declares it `provider-unsupported`, and every other supported/gap posture is unchanged. | F-1, DM-1 |
| AC-F1-3 | **Given** any shipped adapter declaration, **when** inspected, **then** no operation is both supported and gap-declared, no gap reason leaves the closed reason set, and no operation's presence implies support. | F-1, DM-1 |

### 17.2 CLI-first transport (F-2)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F2-1 | **Given** the declared transport matrix, **when** compared with the closed operation set, **then** every operation declares the vendor CLI preferred and the direct API as fallback, with 100% coverage. | F-2, DM-5 |
| AC-F2-2 | **Given** composition where the CLI is absent, outside the version window, or missing a required capability, **when** the probe runs once, **then** it returns exactly one closed refusal code, and under the default policy the API transport is selected with the declared degradation recorded and no request attempted beforehand. | F-2, DM-7 |
| AC-F2-3 | **Given** any CLI invocation exercised by the change's tests, **when** argv and the child environment are asserted, **then** no resolved credential appears in argv, the isolated configuration directory and prompt-suppression variables are present, no shell or pagination output transform is used, and exactly one fixed argv array is emitted. | F-2, DM-7, NFR-3 |
| AC-F2-4 | **Given** the same tenant route table replayed through both transports, **when** normalized views and failures are compared, **then** they are identical, including 404 → definitive absence, other non-2xx → payload failure with structured status, transport failure → payload failure without status, and preserved page counts. | F-2, NFR-4 |
| AC-F2-5 | **Given** a mid-run CLI failure, **when** the request fails, **then** it surfaces as a classified transport failure with no status, no request is re-issued on the other transport, and a write is never landed twice. | F-2, NFR-5 |

### 17.3 Provider-side squash landing (F-3)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F3-1 | **Given** the closed operation set, **when** inspected, **then** it contains the landing operation in addition to the eight delivered operations, with the declared squash-only arguments and an optional provider-supplied landing identity in the outcome. | F-3, DM-1 |
| AC-F3-2 | **Given** a landing request with a crafted commit title and message, **when** it lands, **then** both values are transmitted verbatim, and a landing identity is returned only when the provider supplies it — absent stays absent. | F-3, API-1 |
| AC-F3-3 | **Given** a supplied expected head that no longer matches, **when** a landing is attempted, **then** the adapter returns a classified refusal, lands nothing, and never overrides the guard. | F-3, API-1 |
| AC-F3-4 | **Given** a provider response that the request is already merged, **when** the adapter reads the delivery request back, **then** it returns success only if the provider asserts merged truth; otherwise the classified failure stands. | F-3, NFR-5 |
| AC-F3-5 | **Given** any landing invocation, **when** it completes or fails, **then** it is never retried, and force, bypass, auto-merge, merge queue, rebase, and merge-commit strategies are not representable; the request's title and body remain the content-write operation's business. | F-3, DM-1 |

### 17.4 Failure evidence (F-4)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F4-1 | **Given** a check run whose payload supplies start and completion timestamps, **when** normalized, **then** both optional job timestamps carry the provider values verbatim; **given** their absence, **then** both stay absent and no duration is derived. | F-4, DM-2, NFR-4 |
| AC-F4-2 | **Given** a failed job with log text, **when** the bounded excerpt is read, **then** the result carries job identity, a faithful byte prefix, a truncation flag, and the returned byte length, and the excerpt never exceeds the fixed cap with no caller override. | F-4, DM-4, NFR-6 |
| AC-F4-3 | **Given** a successful read with empty text, a 404, and another non-2xx, **when** each is read, **then** empty is observed empty, 404 is the adapter-local not-found result, and any other non-2xx or transport failure is a classified payload failure. | F-4, DM-4, NFR-4 |
| AC-F4-4 | **Given** any log excerpt, **when** the change completes, **then** no excerpt appears in persisted state or the conformance artifact, and any rendered excerpt passes the redaction chokepoint. | F-4, DM-4, NFR-6 |

### 17.5 Threaded discussion evidence (F-5)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F5-1 | **Given** a thread identity and its pull number, **when** the discussion is read, **then** the closed shape returns thread identity, resolution, provider comment count, a comment list, and a truncation flag, with at most 50 oldest-first comments and at most 4096 bytes per body. | F-5, DM-3, NFR-6 |
| AC-F5-2 | **Given** a thread whose text exceeds a cap, **when** it is read, **then** the truncation flag is true exactly when the returned comments are fewer than the provider count or any body is truncated, and false otherwise. | F-5, DM-3, NFR-6 |
| AC-F5-3 | **Given** an explicit 404 or provider-asserted absent thread, another non-2xx, a transport failure, and a malformed successful payload, **when** each is read, **then** the results are respectively not-found, classified payload failure, classified payload failure, and classified payload failure; a zero-count thread with an empty list is observed empty. | F-5, DM-3, NFR-4 |
| AC-F5-4 | **Given** the discussion read, **when** the core contract and declarations are inspected, **then** `DeliveryThread`, the closed operation set, capability declarations, and conformance projections are unchanged. | F-5, DM-8 |
| AC-F5-5 | **Given** a thread body that contradicts the delivered author-kind facts, **when** the closeout resolution decision runs, **then** the outcome is identical to the same thread without the body, and no write path reads the discussion surface. | F-5, DM-3 |
| AC-F5-6 | **Given** any thread body, **when** the change completes, **then** no body appears in persisted state or the conformance artifact, and rendered bodies pass the redaction chokepoint. | F-5, DM-3, NFR-6 |

### 17.6 Backlog completion (F-6)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F6-1 | **Given** the GitHub capability declaration, **when** inspected, **then** comment and delivery-request content writes are supported; the comment write accepts carrier-free text only with empty carrier arrays, and the content write never lands the request. | F-6, DM-1 |
| AC-F6-2 | **Given** no injected workflow map, **when** a client is constructed, **then** the declared precedence-ordered seed (`closed` → `done` field update; `review` → `in-review` label swap; `in-progress` → `in-progress` label swap; `open` → `ready` field update) is used for both read normalization and transition writes. | F-6, DM-6 |
| AC-F6-3 | **Given** an injected workflow map, **when** an alias is written and the issue is read back through the same map, **then** the written alias is returned. | F-6, DM-6, NFR-11 |
| AC-F6-4 | **Given** a label-based transition, **when** applied, **then** only declared lifecycle label tokens are removed and the row's token added, no full-array replace occurs, unrelated labels survive, and an unavailable label signal refuses the write. | F-6, DM-6 |
| AC-F6-5 | **Given** an alias with no declared row, **when** a transition is requested, **then** the adapter refuses with a named typed failure and issues no provider write; the declared-unmapped aliases remain documented limitations. | F-6, DM-6 |
| AC-F6-6 | **Given** the change's construction inputs, **when** the configuration surfaces are inspected, **then** no settings type, catalog branch, configuration key, or file format is added; the mapping and transport choices are construction data only. | F-6, DM-6 |

### 17.7 Reference behavior (F-7)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F7-1 | **Given** the change is complete, **when** the reference-behavior document is inspected, **then** it states, per closed operation, the preferred and fallback transport, the primary failure identities and classification, absence semantics, caps and truncation signals, and the GitHub gap posture. | F-7, DM-5 |
| AC-F7-2 | **Given** the reference-behavior document, **when** compared to the exported transport matrix, capability declarations, and fixed bounds, **then** every declared value agrees and any divergence fails the change's checks. | F-7, DM-3, DM-4, DM-5, DM-6 |
| AC-F7-3 | **Given** the evidence reads and the other adapters' positions, **when** documented, **then** the document states that bodies and excerpts are evidence, never lifecycle truth, carry no write authority, and that the other adapters take an explicit same-behavior-or-absent position outside the closed set. | F-7, F-5 |
| AC-F7-4 | **Given** the probe and composition policy, **when** documented, **then** the document states the closed refusal codes, that the probe runs only at composition and never in the mock tier, and that no per-request failover exists. | F-7, DM-7 |
| AC-F7-5 | **Given** the GitHub Issues mapping, **when** documented, **then** the document states the token vocabulary, the precedence order, the four seed rows and their mechanisms, the deliberately unmapped tokens and aliases, and that the mapping is not yet operator-configurable — and these agree with the seed. | F-7, DM-6 |

### 17.8 Conformance parity (F-8)

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F8-1 | **Given** the conformance registry, **when** compared with the nine-operation closed set, **then** the operation sets are exactly equal, the landing step executes against the mock tenant, every supported operation executes, and every declared gap is encountered with its exact reason. | F-8, DM-1, NFR-7 |
| AC-F8-2 | **Given** the newly supported comment write with empty carrier arrays, **when** the comment-provenance carrier roundtrip runs, **then** it records a capability-absent skip rather than a declared-gap skip. | F-8, F-6 |
| AC-F8-3 | **Given** the mock tier, **when** any test runs, **then** zero live network calls and zero live child processes occur, enforced by a child-process guard beside the existing network guard. | F-8, NFR-2 |
| AC-F8-4 | **Given** each new behavior (landing, timings, log excerpt, thread discussion, comment write, content write, mapped transition), **when** the trap catalog and fixtures are inspected, **then** each has an offline fixture replayed through the production client with an expected projection. | F-8, NFR-7 |
| AC-F8-5 | **Given** the same tenant replay executed twice, **when** the reports are compared, **then** step order, skip reasons, projections, and diagnostics are identical. | F-8, NFR-2 |
| AC-F8-6 | **Given** the new exports and internal modules, **when** the pinned structural surfaces are checked, **then** the provider export list and the per-file executable-export inventory are updated exactly and the checks are not vacuous. | F-8, NFR-8 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- Delivered as one change on its own branch, targeting the tooling integration branch; merge authority stays outside this change.
- Sequenced by outcome so that every capability lands together with its conformance projection, fixtures, and structural-surface update: contract and capability declarations first, then transport and probe, then the new reads and writes, then conformance and evidence, then the reference-behavior documentation.
- No feature flag is required: the API transport remains the offline deterministic default, and `api-only` composition pins it for any environment that cannot use the CLI.
- Decision records TDR-0031 through TDR-0034 are already authored as `Proposed`; they are cited, not duplicated, and their index entries update with this change.
- Communication is internal to the adapter and conformance owners; operators see only new capability, not a new command.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

Not applicable. No persisted-state schema, record kind, or migration is introduced. The workflow-map seed is declared construction data in source, not persisted project data, and the fixed evidence caps are constants.

## 20. PRIVACY / COMPLIANCE REVIEW

- Review-thread bodies and log excerpts are untrusted provider text and may contain personal data or secret-shaped material. They are bounded, never persisted, never captured in the conformance artifact, and redacted at the single rendering chokepoint before any human surface.
- Evidence text carries no write authority; no lifecycle decision reads it.
- Credentials remain environment-only and resolve exclusively through the credential port. The child environment carries material only as data; the vendor CLI's own stored configuration is isolated so a declared credential cannot silently become a different stored account.
- No cloud service, hosted product, or vendor-specific naming is added. Fixtures remain sanitized and example-only.
- No telemetry is added, so no new personal-data flow exists.

## 21. SECURITY REVIEW HIGHLIGHTS

- **New process edge.** A bounded fixed-argv child invocation joins the GitHub provider subpath. The runtime-API confinement entry keeps its exact, reason-bearing form and gains a recorded meaning; the secret-read allowlist gains no entry and keeps exactly one credential-material entry.
- **No shell, no injection surface.** Fixed argv, no shell, no pagination, no output transform, one bounded timeout, one bounded output buffer.
- **Secret hygiene.** Credential material is removed from forwarded headers and supplied as constructed child-environment data; it never appears in argv, child output, diagnostics, or failure detail. Stderr prose never becomes a failure detail.
- **Status fidelity is security-relevant.** A transport that cannot report the final status must refuse rather than misclassify; otherwise a rejected credential could be read as a payload fault.
- **Destructive action.** The landing operation is at most once, guardable by expected head, never retried, and success on already-merged requires provider-asserted truth.
- **Evidence text.** The excerpt and discussion bodies are the highest-risk payloads; caps, non-persistence, artifact exclusion, and redaction are the controls.
- **Backlog writes.** Label transitions touch only declared lifecycle labels, refuse an unavailable label signal, and never replace the full label array.

## 22. MAINTENANCE & OPERATIONS IMPACT

- **New ongoing surfaces**: the declared transport matrix, the probe's supported version window, the argv/environment mapping, the workflow seed and its order, the fixed evidence caps, the trap/fixture catalog, and the reference-behavior document. Each is data or documentation, so a change is reviewable without discovering a convention.
- **Operator impact**: the preferred transport requires `gh` on `PATH` and in the supported version window; `api-only` removes the dependency. Every CLI request pays a process spawn, which is an accepted cost of the preferred path.
- **Upgrade path**: a `gh` version change is absorbed by the probe, the version window, and one argv mapping; a version that cannot report status makes the adapter refuse the preferred path rather than misreport.
- **No new configuration**: operators cannot change the mapping without a code change until the later configuration story; the reference behavior says so plainly.
- **Coexistence**: two merge mechanisms exist temporarily; the lifecycle path stays on the local-git landing until a separate decision.
- **On-call**: a mid-run CLI failure is visible as a classified failure with no hidden retry, so diagnosis starts from the named failure rather than an invisible fallback.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Provider transport | The injectable wire edge that sends an already-shaped provider request and returns status plus body; the only transport seam the client sees. |
| CLI-first with API fallback | The adapter prefers the vendor CLI as an authenticated API caller and uses the direct API when the CLI is unusable, with the preference declared per operation. |
| Transport matrix | Declared data naming, per closed operation, the preferred and fallback transports. |
| Probe | One bounded composition-time check of the vendor CLI's presence, version, and capability, returning a closed success or refusal code. |
| Composition policy | The closed choice of `prefer-cli` or `api-only` made once at composition, never per request. |
| Declared degradation | The recorded, visible consequence of falling back from the preferred transport. |
| Capability gap | An adapter's explicit `{ operation, reason }` statement that it does not support an operation; parity is never implied. |
| Reference behavior | The documented, checkable contract of the reference adapter: transports, failure identities, absence, caps, truncation, and gap posture. |
| Evidence read | A bounded adapter-local read that returns provider text for human or agent interpretation; it is not lifecycle truth and carries no write authority. |
| Truncation signal | The explicit boolean authority stating that a bounded read returned less than the provider holds. |
| Workflow map | Declared data mapping a native status or lifecycle label token to a delivery alias and a transition mechanism. |
| Token vocabulary | The declared set of status tokens: native issue state or lifecycle label name. |
| At-most-once landing | The property that one landing invocation lands at most one provider merge and is never retried. |
| Read-back | Re-reading provider state to confirm an asserted outcome before reporting success. |
| Conformance projection | The expected normalized result for an executed conformance step, compared exactly. |
| Child-process guard | A mock-tier control that fails when any live child process is spawned. |

## 24. APPENDICES

### 24.1 Appendix A — Phase-7 documentation impacts

| Document | Required reconciliation |
|----------|-------------------------|
| `feature-provider-client-seeds.md` | Capability table (GitHub 9 supported / 0 gaps), operation list, GitHub normalization (timings, landing, comments, content writes, workflow mapping, thread discussion), transport section (CLI-first, matrix, probe, no failover), trap-catalog minima and QA table, export list correction for the pre-existing claim that the GitHub subpath exports five names. |
| `feature-adapter-ports.md` | Closed operation set grows to nine; `PipelineJob` row gains the two optional timestamps; additive-extension section records the landing operation; confinement wording records the bounded fixed-argv child invocation in the GitHub subpath; secret-read boundary unchanged. |
| `feature-adapter-conformance.md` | Flow table and step count for the new operation; operation-set equality; mock-tenant routes and expected projections for the newly supported writes and the landing; child-process guard; skip-kind change for the carrier roundtrip; coverage-gate wording. |
| `feature-merge-verify-deploy.md` | State the coexistence plainly: a provider-side landing capability now exists, and the lifecycle merge path is deliberately unchanged and not rewired. |
| Reference-behavior surface (adapter contract reference) | New: the normative per-operation transport, failure identities, absence, caps/truncation, gap posture, evidence-read shapes, and probe/refusal contract. |
| Documentation index and help/reference coverage | Index the new reference-behavior surface and the updated decision records; confirm prompt-required command help coverage is unaffected. |
| Decision index | Add or confirm TDR-0031, TDR-0032, TDR-0033, and TDR-0034 entries. |
| `feature-closeout.md` and `feature-verify-gates.md` | Checked: no contract change required. Optional timings are consumable but add no gate; body-free thread truth and closeout policy are unchanged. |

### 24.2 Appendix B — Ticket-to-spec traceability

| Ticket element | Where satisfied |
|---|---|
| "full primitive coverage over `gh` CLI with API fallback" | F-1, F-2; AC-F1-*, AC-F2-*; DEC-1 |
| "PRs with threaded discussions and resolution" | F-5 (bodies as bounded evidence) plus the delivered resolution; AC-F5-*; DEC-3 |
| "checks with failure job/log/timing access" | F-4; AC-F4-*; DEC-2 |
| "squash merge with crafted title/description and squash commit message" | F-3; AC-F3-*; DEC-2 |
| "GitHub Issues backlog primitives (read/update, comments, transitions)" | F-6 plus delivered reads/updates; AC-F6-*; DEC-2, DEC-4, DEC-6 |
| "capture the reference behavior the other adapters are parity-tested against" | F-7; AC-F7-*; section 8.4.1 |
| AC: "parity suite green" | F-8; AC-F8-* |
| AC: "reference behavior documented in the adapter contract" | F-7; AC-F7-1…5 |

### 24.3 Appendix C — Deliberate non-decisions (binding on the plan)

These are recorded so delivery planning cannot widen them silently:

1. The lifecycle merge transaction is not rewired to the provider-side merge; two mechanisms coexist temporarily and reconciling them is a separate decision.
2. No configuration schema, settings type, catalog branch, key, or file format is added; the workflow mapping is construction data.
3. `DeliveryThread` is not reshaped and discussion text never enters the normalized contract.
4. No thread pagination, log archive, tail-follow, or caller-tunable evidence bound exists.
5. The review-feedback flow is not migrated onto the adapter ports.
6. Jira's workflow map stays a module constant; it does not migrate in this change.
7. No new telemetry, event, state record, or transport-in-use declaration is added.
8. No force, bypass, auto-merge, merge queue, rebase, or merge-commit strategy is representable.

### 24.4 Appendix D — Fixture-decided provider details

The following are explicitly left to implementation fixtures and do not reopen any decision, shape, cap, or scope: the exact CLI version window and child-environment variable set; the exact status-recovery output parsing; the exact landing response shape and the already-merged refusal variant; the exact check-run timestamp field names; which provider surface supplies the bounded log text; the exact per-thread discussion entry point and comment ordering; and whether label casing affects token matching (a mismatch is a visible refusal).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-17 | @spec-writer | Initial specification for GH-338, grounded in the milestone blueprint, the GH-338 planning notes, and decision records TDR-0031 through TDR-0034. |

---

## AUTHORING GUIDELINES

- **Sources.** The milestone blueprint (`doc/planning/oss-tooling/milestones/m3/`), the GH-338 planning notes (scope, current-state facts, applied defaults), the ticket body and acceptance criteria, and the four decision records authored on this branch (TDR-0031 through TDR-0034). No behavior is invented beyond those sources; provider-surface details left open by the records are listed as fixture-decided in Appendix D.
- **Approach.** The spec is organized around outcomes rather than implementation: capabilities state behavior and rationale, interfaces state contracts, and acceptance criteria are written to be mechanically checkable and non-overlapping. The reference-behavior subsection is deliberately normative because the ticket's second acceptance clause names it.
- **Constraints applied.** Additive contract evolution under a decision record; exact runtime-API confinement the secret-read boundary; no provider-native type across a subpath; packed-export parity; adapters do not import each other; mock-tier offline determinism with both network and child-process containment.
- **Deliberate omissions.** No code file paths, no step-by-step implementation tasks, no merge or commit instructions, and no technology tuning beyond what the outcomes require.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (`GH-338`)
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
- [x] Open questions are empty and every previously routed question is settled by a cited decision
- [x] Deliberate non-decisions are recorded and binding on the plan
