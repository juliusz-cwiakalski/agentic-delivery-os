---
ados_distribution: internal
id: SPEC-ADAPTER-REFERENCE-BEHAVIOR
status: Current
created: 2026-11-18
last_updated: 2026-11-18
owners: ["engineering"]
service: delivery-os provider adapters
summary: "The normative reference behavior of the closed adapter contract: per-operation preferred and fallback transports, primary failure identities, absence semantics, the two bounded evidence reads with their fixed caps and truncation signals, the CLI probe and composition-edge transport selection value, the mechanism-scoped GitHub Issues transition mapping with its injected seeded map and four read outcomes, and the deliberate limitations of both."
links:
  related_changes: ["GH-338", "GH-339"]
  related_decisions: ["ADR-0005", "TDR-0032", "TDR-0033", "TDR-0034", "TDR-0035", "TDR-0036"]
  contracts:
    - "packages/core/src/contracts/adapter-capabilities.ts"
    - "packages/core/src/contracts/ports.ts"
    - "packages/adapters/src/github/cli-transport.ts"
    - "packages/adapters/src/github/workflow-map.ts"
    - "packages/adapters/src/github/log-excerpt.ts"
    - "packages/adapters/src/github/thread-discussion.ts"
---

# Feature: Adapter Reference Behavior

## Overview

This page states the normative reference behavior of the closed adapter contract and the two bounded evidence reads that sit outside it. The GitHub adapter is the reference implementation: every other adapter is compared against these declarations, and a documented value that disagrees with the shipped data is a defect in either the document or the declaration, never in the reader of this page.

These declarations are also the parity bar. The conformance suite's declared matrix records, per closed operation and registered adapter, whether that adapter behaves as this reference does; its difference register is the machine-readable record of every adjudicated divergence, carrying the differing dimensions, a rationale, per-class evidence, and an adjudication reference. A divergence is therefore a reviewed entry rather than undocumented drift, and an entry whose evidence stops reproducing the declared difference fails the parity gate. The matrix, the six-dimension basis, and the gate are specified in [Adapter Conformance Suite](feature-adapter-conformance.md).

The document is current truth, not a migration record. The values here are mechanically compared with the exported transport matrix, the three capability declarations, the exported workflow seed, and the fixed evidence caps.

## Transport matrix

Every closed operation declares a preferred transport and an API fallback. The CLI transport acts as an authenticated API caller over one fixed argv; both transports share the client's request shaping and normalization, so a consumer sees no surface change. The matrix is uniform because the CLI is transport-level, not primitive-level.

| Operation | Preferred | Fallback |
|---|---|---|
| `read-work-item` | `gh` | `api` |
| `write-work-item` | `gh` | `api` |
| `transition-work-item` | `gh` | `api` |
| `read-delivery-request` | `gh` | `api` |
| `write-delivery-request` | `gh` | `api` |
| `read-pipeline-run` | `gh` | `api` |
| `write-comment` | `gh` | `api` |
| `resolve-delivery-thread` | `gh` | `api` |
| `merge-delivery-request` | `gh` | `api` |
| `close-milestone` | `gh` | `api` |

## Capability posture

A declaration is honest: an operation is either supported or carries exactly one declared gap reason. No operation's presence implies support for another adapter. GitHub declares the whole closed set with no gaps; GitLab and Jira declare the same closed set with their own gaps and keep their delivered postures.

| Adapter | Supported | Gaps | Gap reasons |
|---|---|---|---|
| github | 10 | 0 | none |
| gitlab | 2 | 8 | adapter-not-implemented |
| jira | 3 | 7 | adapter-not-implemented; provider-unsupported |

## Failure identities

A failure is classifiable from structured data, never from prose. A read distinguishes definitive absence from a classified payload or transport failure; a write classifies the same way and never silently flattens. Only a read promotes an explicit `404` to `provider.not-found`; every write classifies any non-2xx, `404` included, as `provider.payload.invalid` with the structured `httpStatus`, so a deleted or renumbered resource is not mistaken for a definitive absence by a write.

| Operation | Primary failure identities |
|---|---|
| `read-work-item` | 404 -> `provider.not-found`; other non-2xx -> `provider.payload.invalid` with `httpStatus`; transport failure -> `provider.payload.invalid` without status; credential -> `config.credential.missing` |
| `write-work-item` | any non-2xx (404 included) -> `provider.payload.invalid` with `httpStatus`; transport failure -> `provider.payload.invalid` without status; an unavailable label signal refuses |
| `transition-work-item` | any non-2xx (404 included) -> `provider.payload.invalid` with `httpStatus`; transport failure -> `provider.payload.invalid` without status; an undeclared alias, a declared non-terminal `field-update` alias, an unavailable label signal on a `label-swap` row, and a `done`-resolving current read are named refusals with zero provider requests |
| `read-delivery-request` | 404 -> `provider.not-found`; other non-2xx -> `provider.payload.invalid` with `httpStatus`; transport failure -> `provider.payload.invalid` without status; credential -> `config.credential.missing` |
| `write-delivery-request` | any non-2xx (404 included) -> `provider.payload.invalid` with `httpStatus`; transport failure -> `provider.payload.invalid` without status; a missing required input is a named refusal with zero provider requests; a create never lands and an update never creates |
| `read-pipeline-run` | 404 -> `provider.not-found`; other non-2xx -> `provider.payload.invalid` with `httpStatus`; transport failure -> `provider.payload.invalid` without status; credential -> `config.credential.missing` |
| `write-comment` | any non-2xx (404 included) -> `provider.payload.invalid` with `httpStatus`; transport failure -> `provider.payload.invalid` without status; carrier-free text only |
| `resolve-delivery-thread` | any non-2xx (404 included) -> `provider.payload.invalid` with `httpStatus`; transport failure -> `provider.payload.invalid` without status; a mutation that leaves the thread unresolved is a failure |
| `merge-delivery-request` | a guard rejection and any non-2xx are classified -> `provider.payload.invalid` with `httpStatus`; a transport failure -> `provider.payload.invalid` without status; already-merged is success only after a read-back that observes provider-asserted merged truth; no retry |
| `close-milestone` | any non-2xx (404 included) -> `provider.payload.invalid` with `httpStatus`; transport failure -> `provider.payload.invalid` without status; success requires a read-back that observes the closed state; at most one write per run, never retried |

## Absence semantics

An absent optional field means the provider did not assert the signal: the value is unknown. It is never derived, defaulted, or collapsed into an empty or zero observed value.

| Signal | Absent means | Never |
|---|---|---|
| `PipelineJob.startedAt` and `PipelineJob.completedAt` | the provider did not assert the timestamp or the run has not completed | derived, defaulted, or collapsed to zero; `durationMs` is not part of the contract |
| `DeliveryRequest.headSha` | the provider did not supply the merged-head identity | guessed from a local commit or a branch head |
| `DeliveryThread` author facts | the provider did not expose the root author | inferred from body text |
| `WorkItem.comments` and `WorkItem.updatedAt` | the provider omitted the signal or the read did not fetch it | collapsed to an empty set or a zero timestamp |
| `WorkItem` relation availability (`signals.relations`) | an `unavailable` signal means the dependency read did not observe relations | replaced by an empty observed set when the read failed |
| `pageItemCount` | not applicable; supplied whenever a page is read | replaced by a header-derived or synthesized value |
| merge commit identity (`mergeCommitSha`) | the provider did not supply it | derived from a local commit or a branch head |

## Evidence read: review-thread discussion

One bounded per-thread read returns the thread identity, its resolution state, the provider's asserted comment total, at most the first 50 comments in provider (oldest-first) order, and one thread-level truncation signal. Each comment carries an identity, optional author facts, its body as a byte prefix of at most 4096 UTF-8 bytes, and a per-body truncation flag. The truncation flag is true exactly when fewer comments were returned than the provider total or any body was truncated.

| Surface | Cap | Truncation signal | Classification | Persistence |
|---|---|---|---|---|
| Review-thread discussion | 50 comments per thread; 4096 bytes per body; no override | thread-level `truncated` true exactly when returned comments are fewer than the provider count or any body is truncated | 404 or a provider-absent thread -> not-found; other non-2xx, transport failure, malformed 2xx -> `provider.payload.invalid`; zero count with an empty list is observed empty | returned to the caller only; never rendered, logged, or persisted by the adapter |

`DeliveryThread` keeps its field set: the thread contract carries identity, resolution, and the comment count, and no body or reply field. A discussion body is evidence.

## Evidence read: failure log excerpt

One bounded read returns the job identity, a faithful byte prefix of the provider's log text, one explicit truncation flag, and the returned byte length. The cap is one fixed 8192-byte constant with no caller-tunable option, and the read performs one request with no pagination, no retry, and no archive download.

| Surface | Cap | Truncation signal | Classification | Persistence |
|---|---|---|---|---|
| Failure log excerpt | 8192 bytes; one read; no pagination or retry | `truncated` is the sole authority; `byteLength` equals the returned bytes | 404 -> not-found; other non-2xx or transport failure -> `provider.payload.invalid`; an empty 2xx is observed empty; a malformed 2xx is `provider.payload.invalid` with its status | returned to the caller only; never rendered, logged, or persisted by the adapter |

Bodies and log excerpts are evidence, never lifecycle truth, and carry no write authority. The adapter never persists, renders, logs, or captures an excerpt or a comment body in the conformance artifact; any consumer surface that renders provider text routes it through the single redaction chokepoint.

GitLab and Jira take an explicit same-behavior-or-absent position outside the closed set: neither implements these evidence reads, so a consumer that needs them receives an absent capability rather than a silent empty result.

## CLI transport, probe, and composition selection

`gh` is an optional runtime dependency of the preferred transport. It is version-windowed at the probe, never invoked through a shell, never asked to paginate or transform output, and never allowed to use an operator's stored login. The direct REST/GraphQL API remains the declared fallback and the offline deterministic default.

`gh api --hostname` takes a host identity, never the REST endpoint host. The mapping is exact and frozen, and the mapped value is required construction data computed once from the declared instance address, so no request can re-derive a host.

| Instance host | CLI `--hostname` |
|---|---|
| `api.github.com` | `github.com` |
| `github.com` | `github.com` |
| `ghes.example.com` | `ghes.example.com` |
| `api.ghes.example.com` | `api.ghes.example.com` |

The mapping is a single exact pair, `api.github.com` -> `github.com`. Every other host is unchanged because a GitHub Enterprise Server host identity is already the host; there is no generic `api.` prefix strip, so an enterprise host that begins with `api.` keeps its host.

| Aspect | Reference behavior |
|---|---|
| Probe | One bounded version invocation at composition time only. The probe runs at composition time only; it never runs at module load, never per request, never on a self-description path that does not compose, and never in the mock tier. |
| Result | Closed: success with a version, or exactly one refusal code. |
| Policy | Closed `prefer-cli` (default) or `api-only`; the selection is a composition decision, not a request decision. An absent composition fact selects the delivered native-`fetch` transport with no probe, no policy claim, and no selection value. |
| Degradation | When the preferred CLI is unusable, the API transport serves. A fallback carries exactly one composition-scoped `GithubTransportSelection` value whose `policy`, `selected: "api"`, and `degradation.code` name the probe refusal; the value is never persisted and renders exactly one diagnostic line naming the refusal code, and no new readable surface exists on the composed program object. |
| Failover | There is no per-request failover: a mid-run CLI failure is a classified transport failure and a write is never re-issued on the other transport. |
| Host identity | The `--hostname` value is the declared host identity from the mapping above, never the request URL's host. |
| Status recovery | The FIRST `--include` status block is authoritative: a body line shaped like a status line can never override the real status, and a status block whose body region begins with another status line is an intermediate response (a proxy preamble or a bodyless redirect hop) rather than the answer. An absent or unparsable status block is refused, never assumed to be a success. |
| Child execution | Fixed argv, no shell, no pagination, no interactive prompt, bounded timeout and output, an adapter-constructed environment, an isolated configuration directory, and prompt suppression. |
| Child environment | Absolute in every case: the isolated base is the injected temporary directory when that value is absolute and the operating system's temporary directory otherwise. `GH_CONFIG_DIR` and `XDG_CONFIG_HOME` share `<base>/jaiship-gh-config`; `XDG_STATE_HOME` is `<base>/jaiship-gh-state` and `XDG_CACHE_HOME` is `<base>/jaiship-gh-cache`. `HOME` is not forwarded, nothing is derived from the working directory, and the adapter creates no directory: the base is created on demand under a temporary root. |
| Credential | Credential material arrives from the credential port as child-environment data; it never appears in argv, stdout, stderr, diagnostics, or a failure detail. |

The probe returns exactly one of the following closed refusal codes:

| Refusal code | Meaning |
|---|---|
| `provider.cli.unavailable` | the binary is absent or cannot be executed |
| `provider.cli.version-unsupported` | the reported version is outside the declared window |
| `provider.cli.capability-unsupported` | the binary is present but cannot provide the declared capability |

## Workflow mapping

Issue reads and transition writes resolve through one injected `WorkflowMap`, seeded with this repository's lifecycle conventions. A status token is either a native issue state or a lifecycle label name exactly as the provider spells it. Rows are declared in precedence order, most specific first, and the order is load-bearing for read resolution.

| Precedence | Token | Delivery alias | Mechanism |
|---|---|---|---|
| 1 | `closed` | `done` | `field-update` |
| 2 | `review` | `in-review` | `label-swap` |
| 3 | `in-progress` | `in-progress` | `label-swap` |
| 4 | `open` | `ready` | `field-update` |

Read resolution has exactly one refusal class and four declared outcomes: a `closed` issue resolves to `done` regardless of labels; otherwise the first row in declared precedence whose token equals a present label name exactly wins; otherwise a label differing from a declared `label-swap` token by case alone is a visible normalization failure carried by `provider.payload.invalid`, naming the label and the declared token; otherwise the issue resolves through its native-state row. An unrecognized label, an issue carrying no lifecycle label, and an unavailable label signal never refuse a read. Only the absence of a row for the resolved native state refuses, naming that state.

Only a `label-swap` transition changes labels and refuses on an unavailable label signal. Its write is one issue `PATCH` carrying the computed target set: every present declared `label-swap` token is removed, the row's token is added, and every other label in the supplied current read is preserved. It never sends a single-token array, never removes an undeclared label, and never invents a label it was not given. The preserved set is the caller's read, so a label another actor adds between that read and the write is not preserved — a declared read-to-write limitation of this mechanism, not a hidden guarantee. A `field-update` transition writes provider state only, performs no label read and no label write, and gains no label-signal refusal. The writable aliases are `done` plus each declared `label-swap` row's alias; a declared non-terminal `field-update` alias is readable but read-only. A `label-swap` transition is resolved against the issue's current read result, which the caller supplies as adapter-local input data; the adapter issues no read to obtain it, so every refusal costs zero provider requests. A `label-swap` write to an issue whose current read resolves to `done` refuses with a named typed failure and zero provider requests, regardless of the issue's labels; a declared non-terminal `field-update` alias and an undeclared alias refuse the same way.

The map is validated exactly once per client construction on the resolved map, before the first operation; a failure is captured rather than thrown and every operation then refuses with the existing `provider.payload.invalid` identity with zero provider requests. The rejection set is: a non-string or empty `systemName`; `states` that is not a non-empty array of objects; a non-string or duplicate `nativeStatus`; a `deliveryState` or `transitionMechanism` outside its closed set; two rows declaring the same delivery alias; no row resolving to `done`; and a `done` row that is not the `field-update` row on the native issue state `closed`.

The deliberately unmapped tokens are `change`, `planning`, `spec-ready`, `readiness-passed`, `delivered`, `blocked`, and `backlog-capture`; the deliberately unmapped aliases are `backlog` and `canceled`.

The mapping is construction data: no configuration key, file format, settings type, or catalog branch exists for it, and a configuration file cannot change it until a later configuration story.

## Deliberate limitations

- `backlog` and `canceled` are not representable from the seed. A project that needs `backlog` supplies a row through the injected map; `canceled` needs an additive representation decision first.
- A project whose completion signal is a label rather than issue closure cannot inject a map with a `label-swap` `done` row: the validator refuses it because the delivered closeout terminal write is a state-only `field-update`.
- The two evidence reads have fixed caps and no caller-tunable bound, no pagination, no retry, and no archive download.
- The mapping is not operator-configurable yet. Until the configuration story lands, a project supplies the map as construction data.
- Transport selection is a composition decision. There is no per-request transport-in-use declaration, no `cli-only` proof mode, and no automatic re-issue of a write on the other transport.
