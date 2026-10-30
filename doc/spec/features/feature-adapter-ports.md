---
id: SPEC-ADAPTER-PORTS
status: Current
created: 2026-10-30
last_updated: 2026-10-30
owners: ["engineering"]
service: delivery-os
summary: "The adapter-era contract substrate: nine typed provider-agnostic primitive ports in core ./contracts with capability/gap and carrier-kind declarations, one credential-resolution port with an environment-backed implementation at adapters ./credentials, the binding secret-read boundary invariant, and the delivery.metadata.v1 embedded-envelope data contract with its adapter-internal codec and visible graceful degradation."
links:
  related_changes: ["GH-181"]
  related_decisions: ["ADR-0003"]
---

# Feature: Adapter Ports, Credential Resolution, and Embedded Metadata

## Overview

The adapter-era contract substrate is typed, provider-agnostic, and mechanically guarded. Nine primitive ports live in the runtime-neutral `@delivery-os/core/contracts` subpath as types and `as const` data only: `ExternalSystemInstance`, `AdapterContract`, `WorkItem`, `WorkflowMap`, `WorkItemRelation`, `DeliveryRequest`, `PipelineRun`, `RetryPolicy`, and `IdempotencyKey`. Each is keyed by its globally unique catalogue name; adapters implement behind the ports and never invent a parallel surface.

`AdapterContract` carries a typed capability declaration: the operations and metadata carrier kinds an adapter supports, plus explicit gap records for what it does not support. Absence of a capability flag is a machine-readable gap, never an implied parity claim.

Secret acquisition is centralized behind one `CredentialPort` in core. A caller resolves a declared credential reference to secret material at use time and receives either the material or the classified `config.credential.missing` failure. The single implementation is environment-backed and lives in the adapters package's I/O tier at the declared `./credentials` subpath, with an injectable environment record for tests. A binding repository invariant, the secret-read boundary, fails on ambient environment access outside an enumerated allowlist, so the centralization claim is mechanical rather than conventional. The credential sidecar remains a future second implementation behind the unchanged port interface; no mediated-mode code exists.

The embedded metadata envelope v1 is a versioned data contract in core `./contracts` (`delivery.metadata.v1`). Its pure codec — serialize, parse, strip — is an adapter-internal shared module. The envelope travels in an adapter-declared carrier, round-trips with logical payload equality, and degrades visibly instead of failing when metadata is absent, malformed, of the wrong kind, or of an unknown version.

The surrounding workspace is described in [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md); the failure identity and redaction boundary in [Result Contract and Error Table](feature-result-contract.md); environment-only secrets and configuration acquisition in [Configuration Layer and Inspection](feature-config-layer.md); brand-derived values in [Branding Seam and Working Name](feature-branding-seam.md). Package placement follows [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md).

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

The v1 port set is bounded to the catalogue's adapter-interaction rows typed at M0. No other catalogue primitive is typed here; harness, queue/scheduling, state/audit, and non-adapter context primitives belong to their owning stories.

| Port | Contract |
|------|----------|
| `ExternalSystemInstance` | Configured tracker, VCS, or CI instance: instance name, system kind, base URL, and an auth method. A credential-bearing auth method references a `CredentialReference`; it never carries inline secret material. An anonymous auth method is representable. |
| `AdapterContract` | Adapter name, system kind, and an `AdapterCapabilityDeclaration`. |
| `WorkItem` | Normalized ticket: provider-qualified identity, title, native and delivery status, labels, optional assignee, typed relations, comments. |
| `WorkflowMap` | Native status to delivery-state alias mappings, each naming its transition mechanism. |
| `WorkItemRelation` | Closed relation kinds — `parent`, `child`, `blocks`, `blocked-by`, `relates-to` — targeting a provider-qualified identity. |
| `DeliveryRequest` | Delivery request (PR/MR) view: identity, source and target refs, review state, review threads. |
| `PipelineRun` | Pipeline, job states, and trace-evidence references — never a bare status colour. |
| `RetryPolicy` | Bounded attempts and backoff for known-safe operations. Unsafe writes carry no retry policy rather than an empty or permissive one. |
| `IdempotencyKey` | Key value plus scope, making an external write safely retryable. |

Provider-qualified identity is plain typed data (`systemName` plus the provider's own `entityId`). Contracts describe normalized data and invariants; no behaviour, I/O, ambient environment, clock, or randomness enters the tier.

### Capability and gap declaration

`AdapterCapabilityDeclaration` declares four typed collections:

- `supportedOperations` — the operations the adapter supports, drawn from the closed `ADAPTER_OPERATIONS` set (`read-work-item`, `write-work-item`, `transition-work-item`, `read-delivery-request`, `write-delivery-request`, `read-pipeline-run`, `write-comment`).
- `declaredGaps` — explicit `{ operation, reason }` records. Reasons are `provider-unsupported`, `adapter-not-implemented`, or `plan-restriction`.
- `writableCarriers` and `readableCarriers` — the metadata carrier kinds the adapter can write and read.

An operation absent from `supportedOperations` is unsupported. Declared gaps add the explicit reason for known limitations; they never turn an undeclared operation into a success. Parity beyond the flags is not representable. Carrier selection is typed against the adapter's declared set: `CarrierSelectionInput<Declared>` admits only `Declared[number]`, so an undeclared carrier literal or a widened `string[]` set is rejected at compile time. The closed carrier kinds are `invisible-comment-block`, `provider-custom-field`, and `compact-marker`.

### Credential resolution

`CredentialPort` exposes one operation, `resolve(reference)`, and no implementation-mode surface. A `CredentialReference` carries its own declarative source-key mapping:

- `{ style: "literal", name }` uses the key verbatim.
- `{ style: "environment-prefixed", suffix }` derives the key from the branding seam's environment prefix plus the suffix.

The mapping is declared data, never guessed from an external system's name. Resolution returns either `{ ok: true, material }` or the reified `config.credential.missing` failure. An absent key and an empty-string value fail; whitespace is a value. Resolved material is returned once through the port result and has no diagnostic channel.

The environment-backed implementation is `createEnvironmentCredentialPort({ environment, brand })`, where the environment record is injected. `createProcessCredentialPort(brand)` is the production wrapper that supplies the process environment. The port exposes no mode flag, so the future credential sidecar becomes a second implementation: adapters forward operations to the sidecar over local transport instead of executing with local credentials, and the interface does not change. No sidecar or forwarded-execution code exists.

### Secret-read boundary

`scripts/checks/secret-read-boundary.ts` is an AST invariant over every workspace package production source (`packages/<pkg>/src/**` TypeScript, excluding `dist` and `node_modules`). It names the rule, file, and line for each ambient environment access outside an enumerated allowlist and is fail-closed and non-vacuous: an empty scope fails, and every allowlisted path must exist with a reason.

The v1 allowlist has exactly three entries:

| Kind | Path | Class | Why |
|------|------|-------|-----|
| directory | `packages/adapters/src/credentials` | `credential-material` | The single environment-backed credential-port implementation. |
| file | `packages/adapters/src/file/yaml-parser.ts` | `configuration-environment-source` | The file-tier parser host-switch guard. |
| file | `packages/adapters/src/legacy/index.ts` | `configuration-environment-source` | The legacy-name adapter environment reader. |

Exactly one entry may carry the `credential-material` class, and it must be the credential implementation directory. Wildcards, prefixes, absolute paths, trailing separators, duplicate paths, and reasonless entries fail registry validation. Allowlist growth is a reviewed change.

The invariant detects `process.env`, `Bun.env`, and `Deno.env` property reads, element access to `env` or an ambient global, runtime imports of `process` or `bun`, and aliased ambient globals, while ignoring identifier positions such as property names, import specifiers, and type declarations. It runs as a stage of `check:boundaries` and as a binding step in the CI `ts-invariants` job; no advisory or bypass construct is accepted.

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

The pure codec lives in the adapters package as an adapter-internal shared module (`#io/*`), not in core and not as a public subpath. Core `./contracts` carries only the envelope data contract. The codec provides:

- `serializeEnvelope({ envelope, carrier, humanContent })` — returns the serialized carrier and its byte length, or a refusal for `payload-not-closed` or `size-bound-exceeded`. The byte length is measured on the serialized JSON against the 2048-byte bound.
- `parseEnvelope({ carrier, text?, fieldValue?, expectedKind? })` — returns the v1 envelope plus the stripped human content, or visible degradation evidence plus the stripped human content.
- `stripEnvelope(carrier, text)` — removes every envelope marker from human-readable carrier text with no residue or extra blank line. The provider custom-field carrier keeps human content separate and is returned unchanged.

Marker scanning is bounded: a marker payload span is capped at `ENVELOPE_MAX_BYTES` characters (a valid v1 envelope is byte-bounded below that), so marker-dense hostile carrier text is scanned linearly rather than quadratically. A marker whose payload exceeds the cap does not match and degrades as `missing`.

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
| `packages/core/src/contracts/credentials.ts` | `CredentialPort`, `CredentialReference`, `CredentialSourceKey`, resolution result, and the reified missing-credential failure. |
| `packages/core/src/contracts/envelope.ts` | Envelope schema id, size bound, kinds, closed payload types, degradation reasons, and agent-facing comment views. |
| `packages/core/src/contracts/index.ts` | The `core ./contracts` export surface for the ports, capability, credential, and envelope contracts. |
| `packages/adapters/src/credentials/index.ts` | Environment-backed credential port, injected-environment factory, production process-environment wrapper, and source-key derivation. |
| `packages/adapters/src/io/envelope-codec.ts` | Pure envelope codec: serialize, parse, strip, closed-payload validation, raw-carrier escape hatch, and carrier constants. |
| `packages/adapters/src/io/index.ts` | Internal `#io/*` alias target re-exporting the codec. |
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
| `ADAPTER_OPERATIONS` | seven operations | Closed adapter operation set. |

Version policy: v1 is the only schema version, so any version string outside the known set binds to the `unknown-version` degradation path. The standing read window is current-plus-all-older; narrowing it or retiring a version requires a future specification change.

### API and interface contracts

- **`CredentialPort.resolve(reference)`** returns `CredentialResolution` synchronously. There is no diagnostic channel and no implementation mode.
- **`serializeEnvelope(input)`** returns `{ ok: true, carrier, byteLength }` or `{ ok: false, failure, byteLength }`.
- **`parseEnvelope(input)`** returns `{ ok: true, envelope, humanContent }` or `{ ok: false, reason, humanContent }`.
- **`stripEnvelope(carrier, text)`** returns the text with every envelope marker removed.
- **`isClosedV1Payload(value)`** is the closed-payload type guard used by both serialization and parsing.

## Security and Boundaries

- Secret material is reachable only through the credential port. The environment-backed implementation is the sole `credential-material` allowlist entry.
- The secret-read boundary closes the ambient channel that runtime-API confinement does not cover. Runtime-API confinement admits the adapters I/O subpaths `repo`, `file`, `host`, `session`, `legacy`, and `credentials`; the credential subpath is the only one that may resolve secret material.
- Resolved material never enters diagnostics, logs, error payloads, or metadata; the existing redaction chokepoint governs any surfaced payload.
- The envelope payload is closed, compact, size-bounded, and secret-free; carrier markers and namespaces use brand-neutral constants with no committed product token.
- Capability data is declarative; enforcement of undeclared operations belongs to adapter implementations consulting the flags.

## Non-Functional Requirements

| Concern | Current guarantee |
|---------|-------------------|
| Contracts-tier neutrality | Types and `as const` data only; no ambient environment, I/O, clock, randomness, or runtime-API imports. |
| Secret centralization | Zero non-allowlisted ambient environment reads in workspace production sources; exactly one credential-material entry; planted violations fire. |
| CI bindingness | The secret-read invariant is a binding `check:boundaries` stage and `ts-invariants` step with no bypass construct. |
| Envelope boundedness | Every golden round-trip case serializes within 2048 bytes; metadata never displaces human-readable content. |
| Degradation totality | Every degradation case returns a view with visible evidence naming a mechanically detectable reason; no case fails the flow. |
| Error-table sync | `config.credential.missing` agrees with the documented table in both directions; existing classification behavior is unchanged. |
| Fixture discipline | The invariant has firing negative fixtures and clean controls; fixture coverage and allowlist non-vacuity are proven. |

## Quality Assurance Strategy

| Level | Scope | Evidence |
|-------|-------|----------|
| Structure | Exact v1 contract inventory in both directions, neutral-tier purity, carrier typing, credential surface, envelope constants, error-table row | `tests/structure/port-contract-inventory.test.ts`, `port-neutrality.test.ts`, `port-carrier-types.test.ts`, `port-credential-surface.test.ts`, `envelope-contract.test.ts`, `credential-constants.test.ts`, `error-table.test.ts` |
| Behaviour | Capability/gap declarations, declared-carrier selection, credential resolution and failure, envelope round-trip, parse/strip, degradation matrix, adapter-only write path | `tests/behaviour/port-capabilities.test.ts`, `credential-port.test.ts`, `envelope-roundtrip.test.ts`, `envelope-degradation.test.ts`, `envelope-write-path.test.ts` |
| Type level | Undeclared carriers and widened sets rejected at compile time | `tests/types/port-carrier-types.type-test.ts` through the root `typecheck` |
| Checks | Planted boundary violations, allowlist mutations, non-vacuity, CI wiring and bindingness, error-table sync | `tests/checks/secret-read-boundary.test.ts`, `ci-checks.test.ts`, `error-table-sync.test.ts`; `bun run scripts/checks/secret-read-boundary.ts` |
| Boundaries | Fixture coverage and the credentials subpath in the entrypoint matrix | `tests/boundaries/**`, `tests/checks/secret-read-boundary.test.ts` |
| Aggregate | The whole workspace | `pnpm check` |

Evidence details are recorded in the change test plan at `doc/changes/2026-10/2026-10-30--GH-181--primitive-ports-credential-metadata/chg-GH-181-test-plan.md`.

## Operational & Support

### Configuration

Credential source keys are declared on the reference. Environment-prefixed keys derive their prefix from the branding seam's `environmentPrefix`; literal keys use their declared name verbatim. The production wrapper reads the process environment at the runtime-aware adapters `./credentials` edge; tests inject an environment record and never depend on the host environment.

### Observability

Capability flags and gap records are inspectable data. Degradation evidence names its reason on every degraded read. The secret-read invariant's failure output names the rule, file, and line. Credential failures carry classified error identity; resolved secret material is never observable through any diagnostic path.

## Dependencies & Risks

- **Depends on** the monorepo scaffold for package tiers, boundary enforcement, the ambient guard, and the aggregate check.
- **Depends on** the result contract for the error table, classification chain, projection, and redaction chokepoint.
- **Depends on** the configuration layer for the environment-only secrets precedent and environment facts as injected adapter data.
- **Depends on** the branding seam for environment-prefixed source keys and brand-neutral constants.
- **Consumed by** the provider engine and the tracker, VCS, and CI adapters.
- **Risk — contract churn:** The first real adapters may reveal port-shape gaps. Mitigation: contracts derive from the catalogue's semantic rows, evolution is additive within v1, and a decision record governs adapter-contract changes.
- **Risk — allowlist erosion:** Credential reads could migrate into allowlisted configuration readers. Mitigation: reason-bearing entries, exact paths, mutation tests, and non-vacuity checks.
- **Risk — carrier mangling:** Providers may reformat or strip carriers. Mitigation: graceful degradation with visible evidence and a compact-marker fallback carrier.
- **Risk — metadata leakage:** Public provider artifacts could expose private identifiers. Mitigation: a closed secret-free payload and brand-neutral carrier constants.

## Glossary & References

| Term | Definition |
|------|------------|
| Primitive port | A typed, provider-agnostic contract in core `./contracts` for one catalogue primitive; adapters implement behind it. |
| Capability declaration | Typed flags naming supported operations and carrier kinds, with explicit gap records. |
| Gap record | An adapter's explicit declaration that it does not support a capability; parity is never implied. |
| Credential reference | A declared mapping from an external system's auth method to its source key; resolved only through the credential port. |
| Secret-read boundary | The mechanically enforced property that ambient secret acquisition occurs only in the enumerated allowlist. |
| Metadata envelope | The versioned `delivery.metadata.v1` data contract embedded in provider artifacts by adapters. |
| Carrier | The adapter-chosen, capability-flagged form the envelope takes inside a provider artifact. |
| Graceful degradation | Heuristic fallback with visible degradation evidence, never a flow failure. |

See also: [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md), [Result Contract and Error Table](feature-result-contract.md), [Configuration Layer and Inspection](feature-config-layer.md), [Branding Seam and Working Name](feature-branding-seam.md), the [repository glossary](../../overview/glossary.md), and [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md).

**Change record:** `doc/changes/2026-10/2026-10-30--GH-181--primitive-ports-credential-metadata/`.
