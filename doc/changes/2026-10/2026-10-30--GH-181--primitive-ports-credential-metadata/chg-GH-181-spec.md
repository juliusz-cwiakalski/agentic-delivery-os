---
change:
  ref: GH-181
  type: feat
  status: Proposed
  slug: primitive-ports-credential-metadata
  title: "M0-S12: Primitive ports, credential port, and embedded metadata"
  owners: [engineering]
  service: delivery-os adapter contracts
  labels: [change, planning]
  version_impact: minor
  audience: internal
  security_impact: high
  risk_level: medium
  dependencies:
    internal: [monorepo scaffold, result contract, config layer, branding seam]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Give the adapter era its typed contract substrate — provider-agnostic primitive ports with capability flags, one centralized credential-resolution port whose second future implementation is the credential sidecar, and an embedded metadata envelope that carries ADOS facts inside provider artifacts and degrades gracefully when providers strip it.

## 1. SUMMARY

Deliver the v1 typed primitive ports in the runtime-neutral core contracts tier: the catalogue's nine adapter-interaction primitives typed at M0, each carrying capability flags so adapters declare capabilities and gaps instead of pretending parity. Deliver one credential-resolution port in core with a single environment-backed implementation at a runtime-aware location, so adapters and the provider engine never read secrets directly and the future credential sidecar becomes the port's second implementation without interface change. Deliver the embedded metadata envelope v1 (schema version, kind, closed provenance/linkage payload) with adapter-chosen carriers driven by capability flags, round-trip integrity, and visible graceful degradation. A binding secret-read boundary invariant in CI enforces the centralization mechanically.

## 2. CONTEXT

### 2.1 Current State Snapshot

The six-package workspace is delivered: the contracts tier (core `./contracts`) is runtime-neutral (types and `as const` data only, ambient-globals guard over the neutral set), the boundary matrix is mechanically enforced with negative fixtures, and one aggregate check with CI parity gates every pull request. The result contract provides the `CommandResult` envelope, the machine-readable error table with bidirectional documentation sync, and the single redaction chokepoint. The configuration layer establishes environment-only secrets and environment facts supplied as injected data to adapters. The primitive catalogue defines the adapter-interaction primitives (all currently Planned, "typed at M0"), and two concepts — credential sidecar and embedded metadata — define the compatibility contracts the scheduled stories must keep open. No primitive port contracts, credential port, or metadata envelope exist yet; the provider engine (M0-S13) and tracker/VCS/CI adapters are the declared first consumers.

### 2.2 Pain Points / Gaps

- Without typed ports, each provider interaction (tracker, VCS, CI, provider engine) would invent its own surface, fragmenting the adapter contract before the first adapter lands.
- Without capability flags, adapters would either overclaim parity or hide gaps in prose; consumers would have no machine-readable way to branch on what an adapter actually supports.
- Without one credential port, adapters and the provider engine would read secrets ad-hoc from the environment — breaking the zero-key credential-sidecar adoption path before it exists and scattering the secret-attack surface.
- Ambient environment access in workspace package code is not today uniformly forbidden: runtime-API confinement bans runtime imports outside exempt locations, but an ambient `process.env` read inside a provider adapter module would fail no gate. The "secrets centralized" claim is currently convention, not mechanism.
- ADOS facts about provider artifacts (which agent made a comment and under whose operator authority, delivery linkage, run identifiers) have no structural carrier and remain account-identity heuristics.

## 3. PROBLEM STATEMENT

Because the adapter era has no typed contract substrate, every provider interaction would invent its own surface, secrets would be read ad-hoc by adapters (permanently complicating the future zero-key sidecar adoption), and ADOS facts about provider artifacts would stay heuristic — resulting in an adapter ecosystem that cannot be swapped, audited for secret access, or trusted for provenance classification.

## 4. GOALS

- **G-1**: Type the catalogue's adapter-interaction primitives at M0 as provider-agnostic ports in the runtime-neutral core contracts tier, keyed by their globally unique catalogue names.
- **G-2**: Make capability declaration structural: adapters declare supported capabilities and explicit gaps through typed flags, and select metadata carriers through the same mechanism.
- **G-3**: Centralize secret acquisition behind one credential-resolution port in core, with one simple environment-backed implementation at a runtime-aware location, keeping the sidecar adoption path open as a documented constraint.
- **G-4**: Enforce secret centralization mechanically: a binding CI boundary check fails on any secret read outside the credential port, proven non-vacuous by negative tests.
- **G-5**: Provide the embedded metadata envelope v1 that round-trips through adapter-chosen carriers, never carries secrets, and degrades gracefully — with visible evidence — when metadata is missing, malformed, or stripped.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Catalogue adapter-interaction primitives typed at M0 | 9/9 (fail-closed in both directions against the exact v1 set) |
| Non-allowlisted ambient environment reads in workspace package sources | 0; check proven to fire on ≥1 planted violation |
| Credential port consumers reading secrets outside the port | 0 |
| Envelope round-trip golden matrix | 100% logical payload equality across declared carriers |
| Degradation-matrix cases that fail the flow | 0; 100% carry visible degradation evidence |
| New error-code rows synchronized (machine + documented) | 1/1, both directions |
| Capability flags on ports that declare capabilities | 100% typed, none implied by prose |

### 4.2 Non-Goals

- **NG-1**: No credential-sidecar implementation and no mediated-mode code; the sidecar adoption path is a documentation constraint on the port design only, and the environment-backed implementation stays simple.
- **NG-2**: No concrete provider adapter implementations (tracker, VCS, CI) and no provider engine routing; M0-S13 and the client-seed stories consume these ports.
- **NG-3**: No typing of catalogue primitives outside the selected v1 set (harness set, queue/scheduling set, state/audit set, and the non-adapter context primitives) — each is typed by its owning story.
- **NG-4**: No local event-log mirror of provider-side metadata and no metadata retention/cleanup policy (concept open questions, parked).
- **NG-5**: No privacy-guard extension for metadata emitters (M0-S15) and no gate-battery provenance consumption (M0-S9); this change supplies the structural carrier they consume.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | v1 primitive port set typed in core `./contracts` | The provider-agnostic substrate every adapter and the provider engine build on. |
| F-2 | Capability flags and declared gaps on the adapter contract | Adapters declare what they support; parity is never pretended. |
| F-3 | One credential-resolution port with an environment-backed implementation | Secrets centralized behind one port; sidecar becomes the second implementation. |
| F-4 | Secret-read boundary invariant, binding in CI | The centralization claim is mechanical, not convention. |
| F-5 | Embedded metadata envelope v1 with carrier capability flags | ADOS facts about provider artifacts become structural and survive provider stripping. |
| F-6 | Error-table integration for credential failures | Expected credential failures carry classified identity, never containment. |

### 5.1 Capability Details

- **F-1**: The v1 set is exactly the catalogue's adapter-interaction rows typed at M0: `ExternalSystemInstance`, `AdapterContract`, `WorkItem`, `WorkflowMap`, `WorkItemRelation`, `DeliveryRequest`, `PipelineRun`, `RetryPolicy`, `IdempotencyKey`. Contracts are exported from the runtime-neutral core contracts tier, keyed by their globally unique catalogue PascalCase names (never numeric identifiers), compound-qualified per the catalogue's naming discipline. Primitives are typed as data contracts (normalized field sets with declared invariants); no behavior, I/O, ambient environment, clock, or randomness enters the tier. Provider-qualified identity fields inside adapter artifacts are plain typed data; typing of the non-adapter context primitives (for example the delivery-identity and repository-identity rows) remains with their owning stories and is not invented here. Selection is fail-closed in both directions: the delivered contract surface matches the v1 set exactly, with no extra port inventing catalogue behavior.
- **F-2**: The adapter contract carries a typed capability declaration: flags stating which operations and carrier kinds an adapter supports, plus explicit gap records for what it does not support. Absence of a capability flag is a machine-readable gap, never an implicit parity assumption. The same mechanism types the metadata carriers (invisible comment block, provider custom field, compact marker fallback): an adapter declares the carriers it can write and read, and only a declared carrier is selectable. Capability data is `as const`-style typed data in the contracts tier; fixture adapters in the dev-only test harness exercise declarations without shipping provider implementations.
- **F-3**: One credential-resolution port lives in the core contracts tier: a caller resolves a declared credential reference (an external system instance's auth method) to secret material at use time, receiving either the resolved material or a classified failure. The port exposes no implementation mode, so direct execution today and mediated (sidecar-forwarded) execution later are implementations behind an unchanged interface. The single v1 implementation is environment-backed and lives at a runtime-aware location outside the contracts tier — the adapters package's I/O tier as a new declared credentials subpath admitted to the runtime-API confinement allowlist (placement rationale and the alternative considered are recorded in the decision log; a technical decision record may be raised during delivery if warranted). The implementation resolves credentials from the process environment, with the environment source injectable for tests; the mapping from credential reference to environment source key is explicit in the reference (declared, not guessed), and any product-prefixed key derivation comes from the branding seam, never a hardcoded token. The port design documents the sidecar adoption path — in the sidecar era adapters gain a mediated mode forwarding operations to the sidecar over local transport instead of executing with local credentials — as a constraint only; no mediated code exists in this change. Adapters and the provider engine consume the port; they never read secrets directly.
- **F-4**: A new AST-based repository invariant (same style as the existing ambient-globals guard) fails on ambient environment access in workspace package production sources outside an explicitly enumerated allowlist. The v1 allowlist names exactly: the environment-backed credential implementation, and the pre-existing configuration environment-source readers delivered by earlier changes (the file-tier parser host-switch guard and the legacy-name adapter), each registered with its reason. Allowlist growth is a reviewed change, mirroring the declared-entrypoint matrix discipline. The invariant is wired bindingly into CI beside the existing static invariants and into the local boundary chain, with no advisory or bypass constructs; the CI topology invariants are extended in the same change where wiring changes. Combined with the existing runtime-API confinement (which already forbids runtime imports in provider adapter subpaths), the invariant closes the remaining ambient channel, making "no secret read outside the credential port" a mechanically proven property. Negative fixtures prove the invariant fires; clean controls prove sanctioned reads stay green.
- **F-5**: The metadata envelope v1 is a versioned data contract: a brand-neutral schema identifier (same discipline as the reserved result and telemetry schema names), a kind identifying what the metadata is about, and a closed v1 payload carrying comment provenance (which agent produced the artifact and under whose operator authority) and delivery linkage (work-item and run identifiers). The payload is compact JSON, admits no secret or credential material ever, and stays small and quiet: it renders invisibly or occupies an invisible field and never displaces human-readable content. The carrier is adapter-chosen, driven by the F-2 carrier capability flags. The write path is adapter-only: agents construct primitive views (for example a comment with requested provenance); the adapter serializes the envelope into the declared carrier; on read, the adapter parses, strips the envelope from the returned content, and attaches metadata-derived fields to the primitive view. Agents never see or construct raw carriers; tooling that edits provider artifacts outside the adapter is a policy violation surfaced by status, not a supported path. The pure codec (serialize, parse, strip) lives in the adapters package as an adapter-internal shared module: the write path is adapter-only and carriers are adapter machinery, and the declared-entrypoint matrix permits adapters to import core `./contracts` only, so core cannot host behavior reachable by adapters and no new core subpath is created. Core `./contracts` therefore carries only the envelope data contract — the schema identifier constant, kind values, payload types, carrier-kind types, and the size bound constant — types and `as const` data only; the dev-only test harness (testkit) may import the adapters codec for round-trip tests per the existing testkit boundary rules (testkit may import every declared adapters subpath; the testkit dev-edge dependency-cruiser rule permits testkit to import core and adapters, never the surfaces). Degradation is graceful and visible: degraded metadata never fails the flow — the adapter falls back to account-based heuristics and returns visible degradation evidence naming the mechanically detected reason. The reason taxonomy distinguishes only what is mechanically detectable: `missing` (carrier present, no envelope found), `malformed` (envelope found but payload unparsable or invalid), `wrong-kind` (kind mismatch), `unknown-version` (version outside the known set). Absent metadata and stripped metadata (envelope removed externally, for example a provider stripping HTML comments) are observationally equivalent at read time and share the single `missing` reason; a human-edited comment classifies as malformed or missing per what is mechanically detectable; account-based heuristic fallback applies identically in all cases. Version compatibility policy: v1 is the only schema version at delivery; the supported read window is current-plus-all-older (all older versions read forward-compatibly beside the current one). Because no older version exists at delivery, the binding behavior for any version string outside the known set — older or newer — is the existing visible-degradation path above (the unknown-version reason). Narrowing the window or retiring old versions is a future change requiring its own spec update, never silent. Provider-side metadata records provider-side facts only; the local event log remains the process ledger (sync rule restated for the adapter-contract decision record in M0-S17). The full emitter-side privacy scan and gate-battery consumption are later stories built on this envelope.
- **F-6**: A credential that cannot be resolved is an expected, operator-fixable condition and carries classified failure identity through the existing classification chain: one new error-table row under the configuration kind (whose lookups already require exact codes, so no existing kind-only classification changes), category user, non-retryable, mutation not landed, user-validation projection. The row is added to the machine table and the documented table in the same change, preserving bidirectional sync. Malformed metadata deliberately receives no error code: degradation is a returned view state, not a failure.

## 6. USER & SYSTEM FLOWS

1. **Adapter operation (consumption shape, delivered by later stories)**: Engine holds an `ExternalSystemInstance` with an auth method → credential port resolves the declared reference to secret material → adapter consults capability flags, refuses undeclared operations as declared gaps → executes with `RetryPolicy`/`IdempotencyKey` discipline → returns a normalized primitive view (`WorkItem`, `DeliveryRequest`, `PipelineRun`, …).
2. **Metadata write**: Agent constructs a primitive view carrying requested provenance → adapter serializes the envelope (schema identifier, kind, payload) into a carrier it has declared via capability flags → provider artifact carries the metadata invisibly beside human-readable content.
3. **Metadata read**: Adapter parses the carrier → strips the envelope → returns the primitive view with metadata-derived provenance/linkage fields; when metadata is absent, malformed, of unknown version, or stripped, the view returns with account-based heuristic provenance plus visible degradation evidence — the flow never fails.
4. **Boundary violation (prevented)**: A contributor writes a direct environment read inside a provider adapter module → the secret-read invariant fails CI naming rule, file, and line → the fix routes credential acquisition through the port.
5. **Sidecar adoption (future, documented only)**: The port interface is unchanged; a mediated implementation forwards operations to the sidecar over local transport; adapters switch implementations, not interfaces. No code in this change.

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Typed contracts in core `./contracts` for the nine catalogue adapter-interaction primitives typed at M0, keyed by catalogue names, with the adapter contract's capability-and-gap declaration and the carrier capability flags.
- One credential-resolution port contract in core `./contracts` plus its single environment-backed implementation in the adapters I/O tier (new declared credentials subpath, confinement allowlist and fixture updates in the same change), with the sidecar adoption path recorded as a design constraint.
- The new AST-based secret-read boundary invariant, its enumerated allowlist, binding CI wiring, negative fixtures, mutation tests, and clean controls.
- The embedded metadata envelope v1: schema identifier, kind, closed payload, and carrier kinds as data contracts in core `./contracts` (types and `as const` data only — schema identifier constant, kind values, payload types, carrier-kind types, size bound constant); the pure codec (serialize, parse, strip) in the adapters package as an adapter-internal shared module — the boundary matrix permits adapters to import core `./contracts` only, so core cannot host behavior reachable by adapters and no new core subpath is created, while the dev-only test harness imports the codec per the testkit dev-edge rules; round-trip and degradation test matrices.
- One new error-table row (machine + documented, same change) for unresolvable credentials.
- Fixture adapters in the dev-only test harness exercising capability declarations and envelope round-trips without shipping provider implementations.

### 7.2 Out of Scope

- [OUT] Credential-sidecar implementation, mediated-mode code, sidecar transport, token issuance or revocation (documented constraint only).
- [OUT] Concrete provider adapter implementations and the provider engine's use of the ports (M0-S13 and client-seed stories).
- [OUT] Typing of catalogue primitives outside the v1 set: harness set (M1+), queue/scheduling set, state/audit set, and the non-adapter context primitives — each typed by its owning story.
- [OUT] Metadata retention/cleanup after closeout and local event-log mirroring of provider-side metadata (concept open questions, parked).
- [OUT] Privacy-guard emitter scanning for metadata (M0-S15) and gate-battery provenance consumption (M0-S9).
- [OUT] Changes to the bash delivery stack, public naming, or the branding resolver contract.

### 7.3 Deferred / Maybe-Later

- Sidecar-era credential failure identities (for example transient unavailability of a mediated resolver) — introduced with the sidecar story, not invented now.
- Envelope payload extensions beyond comments/provenance/linkage when a second consumer appears, under the catalogue's INTRODUCE/EXTEND discipline.
- A catalogue card for the credential port and the envelope (the catalogue feeds the adapter-contract decision record scheduled in M0-S17).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. No network surface is delivered; adapters consume providers in later stories behind these ports.

### 8.2 Events / Messages

None. No new persisted or emitted event schema. Degradation evidence is part of the returned primitive view, not an event; the local event log remains the process ledger.

### 8.3 Data Model Impact

| ID | Element | Contract |
|----|---------|----------|
| DM-1 | `ExternalSystemInstance` | Configured tracker, VCS, or CI instance identity with its declared auth method; the auth method references credentials by declared reference, never inline secret material. |
| DM-2 | `AdapterContract` | The adapter's typed declaration: capability flags (supported operations and carrier kinds) and explicit gap records; gaps are data, parity is never implied. |
| DM-3 | `WorkItem` | Normalized ticket: provider-qualified identity, status, labels, assignee, relations, comments. |
| DM-4 | `WorkflowMap` | Native status to ADOS state alias plus the transition mechanism kind. |
| DM-5 | `WorkItemRelation` | Parent/child, blocks, relates-to as typed relation kinds. |
| DM-6 | `DeliveryRequest` | Delivery request (PR/MR): target and source refs, review state, threads. |
| DM-7 | `PipelineRun` | Pipeline, job, and trace evidence — never a bare status color. |
| DM-8 | `RetryPolicy` + `IdempotencyKey` | Only known-safe retries are representable; unsafe writes carry no retry policy; external writes carry an idempotency key for safe retries. |
| DM-9 | Credential reference + resolution result | Declared reference (external system auth method to source key mapping, brand-derived prefixes only) resolving to secret material or the classified F-6 failure; the port exposes no implementation mode so mediated execution slots in unchanged. |
| DM-10 | Metadata envelope v1 | Brand-neutral schema identifier, kind, closed v1 payload (comment provenance: producing agent + operator authority; delivery linkage: work-item and run identifiers), carrier kinds (invisible comment block, provider custom field, compact marker fallback), and degradation evidence (heuristic fallback flag + reason) attached to parsed views. |

**Envelope contract rules**: the payload field set is closed at v1 and admits no secret or credential material; the envelope is compact JSON bounded in size (v1 constant recorded in the contract at delivery; target bound ≤ 2048 bytes serialized) and never displaces human-readable content; carrier markers and namespaces are brand-neutral contract constants derived per the branding seam discipline — no product token is committed. Write is adapter-only; parse returns the primitive view with the envelope stripped and metadata-derived fields attached; the audited raw escape hatch remains the only window on carriers. Version policy: v1 is the only schema version at delivery; the supported read window is current-plus-all-older, read forward-compatibly, so any version string outside the known set — there being no older version at delivery — binds to the visible-degradation path naming the `unknown-version` reason. Window narrowing or version retirement is a future spec change, never silent.

**Credential contract rules**: the reference-to-source-key mapping is explicit and declared (no guessing from system names); the resolution source is the process environment at v1 and is injectable for tests; resolved material is returned once through the port result and never enters diagnostics, logs, or error payloads (the existing redaction chokepoint covers anything surfaced); the environment-backed implementation is the single enumerated credential entry in the F-4 allowlist.

**Error-table extension**: one new row, synchronized in both directions under the binding sync invariant: code `config.credential.missing`, domain kind `config`, category `user`, retryable `false`, consequence `not_landed`, remediation hint directing the operator to supply the credential through its declared environment source, projection class `user-validation` (standalone exit 1), summary "A required credential was not resolvable from its source." Configuration-kind discipline is unchanged: kind-only lookups already require exact codes, so no existing classification behavior changes.

### 8.4 External Integrations

No vendor API is adopted or called in this change. The envelope will ride provider artifacts (comments, custom fields) once adapters land; carriers are normalized by adapters so the same ADOS fact reads the same way on every provider. No runtime dependency is introduced by the contracts; the environment-backed implementation introduces no new package dependency (ambient environment access only). License registry entries are therefore unchanged.

### 8.5 Backward Compatibility

All contracts additions are additive: new core contracts exports, one new declared adapters subpath, one new repository invariant. The configuration-kind error row joins an already multi-row kind, so kind-only classification behavior (provider and input singletons, config requiring exact codes, fallback containment) is unchanged. Existing guards (ambient-globals neutral tiers, runtime-API confinement, workspace entrypoints, forbidden literals) remain green; the confinement allowlist gains exactly the new credentials subpath with a failing fixture in the same change. The bash stack is untouched. Envelope schema evolution is additive within the v1 schema identifier; breaking shape changes require a new schema version.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Contracts-tier runtime neutrality | Types and constant data only; 0 ambient environment, I/O, clock, or randomness accesses in the neutral set; existing neutral-tier guards green. |
| NFR-2 | Secret centralization | 0 non-allowlisted ambient environment reads in workspace package production sources; exactly one credential-material allowlist entry; invariant proven to fire on planted violations. |
| NFR-3 | CI bindingness | The new invariant runs as a binding step with 0 bypass constructs (`continue-on-error`, `|| true`, `set +e`, `exit 0` wraps); topology and bindingness invariants extended and green. |
| NFR-4 | Envelope boundedness | 100% of golden round-trip cases serialize within the v1 size bound; 0 golden cases where metadata displaces human-readable content. |
| NFR-5 | Degradation totality | 0 flow failures across the degradation matrix (absent, malformed, wrong-kind payload, unknown version, stripped, human-edited); 100% of matrix cases return visible degradation evidence naming the reason. |
| NFR-6 | Compatibility and sync | Error-table sync green in both directions with the new row; existing kind-only classification unchanged; all pre-existing gates green; bash jobs byte-unchanged. |
| NFR-7 | Fixture discipline | 1+ failing negative fixture for the confinement allowlist change and for the secret-read invariant; fixture-coverage meta-check green; non-vacuity proven for the allowlist registry. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

No new event schema or sink. Observability comes from the shape of returned views: capability flags and gap records are inspectable data; degradation evidence names its reason on every degraded read; the invariant's failure output names rule, file, and line. Credential resolution failures carry the classified error identity (F-6). Resolved secret material is never observable through any diagnostic path; the existing redaction chokepoint governs any surfaced payload.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Port shapes prove wrong when the first real adapters land (M0-S13), forcing contract churn | M | M | Contracts derived strictly from the catalogue's semantic rows and the concepts' compatibility sections; consumer stories review before implementation; additive evolution within v1; TDR path during delivery if shapes are disputed. | M — one round of additive adjustment plausible |
| RSK-2 | Secret-boundary allowlist erodes (credential reads migrate into allowlisted config readers) | H | M | Enumerated entries with recorded reasons; allowlist growth is a reviewed change; mutation tests prove fail-closed behavior; non-vacuity checks prevent silent weakening. | L |
| RSK-3 | Providers mangle or strip carriers (HTML comments reformatted, fields dropped), degrading provenance reliability | M | H | Graceful degradation with visible evidence is the specified behavior, never a failure; marker-fallback carrier exists for providers without invisible carriers; degradation matrix tested exhaustively. | M — provenance becomes heuristic where providers strip |
| RSK-4 | Private identifiers or secrets leak through metadata into public provider artifacts | H | L | Closed v1 payload field set admitting no secret material; carrier content limited to provider-visible linkage and agent/authority facts; M0-S15 emitter scan follows in-milestone; brand-neutral constants prevent token leakage. | L |
| RSK-5 | Contracts tier grows beyond cross-package language (ADR revisit trigger) | M | L | v1 set bounded to catalogue M0 adapter rows plus the two ticket-mandated contracts; INTRODUCE scrutiny recorded; set reviewed by the M0-S17 adapter-contract decision record. | L |
| RSK-6 | Placement dispute over the environment-backed credential implementation (contracts purity vs runtime-aware location) | M | M | Placement decided in this spec (decision log) with the alternative recorded; contracts tier stays pure; TDR may be raised during delivery without blocking plan or test planning. | L |
| RSK-7 | Provider-side metadata and the local event ledger drift (two sources of truth) | M | M | The sync rule is stated in the contract (provider-side metadata records provider-side facts; the local log remains the process ledger) and restated for the M0-S17 decision record to lock. | L |

## 12. ASSUMPTIONS

- The primitive catalogue's "typed at M0" rows are the authoritative scope for adapter-interaction ports; other M0 rows are typed by their owning stories, so this change neither types nor blocks them.
- The environment-backed implementation stays deliberately simple (ambient environment source, injectable for tests); sidecar-era sophistication is explicitly out of scope per the ticket.
- Degradation over failure is the correct envelope semantic: metadata is an optimization of provenance reliability, never a correctness dependency of the flow.
- The credential reference resolves against the environment exclusively at v1; source restrictions and keyring-style sources are later concerns.
- Capability flags are declarative data; enforcement of "refuse undeclared operations" belongs to adapter implementations (later stories) consulting the flags.
- The catalogue itself is updated by the documentation-sync phase and the M0-S17 decision record; this change does not edit the catalogue.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M0-S1 / GH-170 (monorepo scaffold) | Contracts tier, boundary matrix, ambient guard, aggregate check, CI parity invariants. |
| Depends on | M0-S3 / GH-172 (result contract) | Error table, classification chain, projection, redaction chokepoint. |
| Depends on | M0-S4 / GH-173 (config layer) | Environment-only secrets precedent; environment facts as injected adapter data; established config-kind error discipline. |
| Depends on | M0-S2 / GH-171 (branding seam) | Brand-derived prefixes for any product-prefixed credential source keys; brand-neutral constant discipline. |
| Blocks | M0-S13 / GH-182 (provider v1) | Provider credentials resolve through the credential port; provider routing consumes ports. |
| Blocks | M0-S19, M1-S11, client-seed adapter stories | First consumers of the primitive ports and the envelope. |

## 14. OPEN QUESTIONS

- **OQ-1**: Should the environment-backed credential implementation instead receive an environment record as injected data from each surface's composition edge (three allowlist entries) rather than reading the ambient environment inside one allowlisted adapter module? Decision needed: consult `@decision-advisor` during delivery if the recorded placement (decision log DEC-2) is disputed; a technical decision record may be raised. Not a blocker for test planning or plan writing.
- **OQ-2**: Catalogue bookkeeping for the two ticket-mandated contracts without catalogue rows (credential port, metadata envelope): add rows now versus fold them into the adapter-contract decision record scheduled in M0-S17? Decision needed: consult `@decision-advisor`; the nine typed catalogue rows get status updates in the documentation-sync phase regardless.
- **OQ-3**: Exact v1 constants — the envelope schema identifier string and the serialized size bound — are fixed in the contract at delivery within the ranges this spec requires (brand-neutral `delivery.*.v1` discipline; bound ≤ 2048 bytes). Non-blocking.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | v1 port set = the nine catalogue adapter-interaction rows typed at M0, plus the ticket-mandated credential port and metadata envelope; all other "typed at M0" rows remain with their owning stories. | The ticket scopes provider-agnostic adapter contracts; the instruction binds selection to the catalogue; inventing wider scope would violate the primitive discipline and NG-3. | 2026-10-30 |
| DEC-2 | The env-backed credential implementation lives in the adapters package's I/O tier as a new declared credentials subpath admitted to the runtime-API confinement allowlist — not in the contracts tier. | The contracts tier is ambient-neutral by enforced rule; the adapters I/O tier is the established runtime-aware home for ambient access (file and legacy precedent); a single declared subpath is automatically importable by every surface per the declared-entrypoint matrix and keeps one allowlist entry. Alternative (environment record injected from each surface edge) recorded as OQ-1. | 2026-10-30 |
| DEC-3 | One new error-table row, `config.credential.missing`, under the configuration kind — not the provider kind. | Configuration-kind lookups already require exact codes, so no existing kind-only classification changes; at v1 the credential source is the environment, which is configuration. Sidecar-era provider-kind identities are deferred. | 2026-10-30 |
| DEC-4 | The secret-read boundary check is an AST invariant over workspace package production sources with an enumerated allowlist, binding in CI beside the existing static invariants and in the local boundary chain, with negative fixtures and mutation tests. | Matches the ticket's mechanical AC; mirrors the ambient-globals guard style; combined with runtime-API confinement it closes the ambient channel that no current gate covers. | 2026-10-30 |
| DEC-5 | Metadata degradation returns a view with visible evidence instead of raising a failure; no error code for malformed metadata. | The concept mandates the flow never fails on unreadable metadata; a failure code would invite flow-breaking handling. | 2026-10-30 |
| DEC-6 | The sidecar adoption path is recorded as a port-design constraint only: uniform interface, no implementation mode, no mediated code in M0. | Ticket non-goal; keeps the port simple while the documented constraint preserves the zero-key adoption path. | 2026-10-30 |
| DEC-7 | Version compatibility policy: v1 is the only schema version at delivery; the standing supported read window is current-plus-all-older (all older versions read forward-compatibly beside the current one); any version string outside the known set — older or newer — binds to the existing visible-degradation path (the `unknown-version` reason, AC-F5-3/AC-F5-6). Window narrowing or version retirement is a future change requiring its own spec update, never silent. | No older version exists at delivery, so a wider read matrix would be untestable speculation; the standing window definition stays stable while the degradation path observably covers every unknown version. Resolves the test-plan §8.3 TODO / OQ-B part 1. | 2026-10-30 |
| DEC-8 | Degradation reason taxonomy is mechanically detectable only: `missing` (no envelope), `malformed` (envelope found but payload unparsable/invalid), `wrong-kind` (kind mismatch), `unknown-version` (version outside the known set). Absent and stripped metadata are observationally equivalent at read time and share the single `missing` reason; a human-edited comment classifies as malformed or missing per what is mechanically detectable; account-based heuristic fallback applies identically in all cases. | Read time cannot distinguish an envelope that was never written from one removed externally (for example a provider stripping HTML comments); claiming a distinction would produce unreliable evidence, so the taxonomy names only detectable causes. Resolves OQ-B part 2. | 2026-10-30 |
| DEC-9 | The pure envelope codec (serialize, parse, strip) lives in the adapters package as an adapter-internal shared module; core `./contracts` carries only the envelope data contract (schema identifier constant, kind values, payload types, carrier-kind types, size bound constant — types and `as const` data only); no new core subpath is created. | The write path is adapter-only and carriers are adapter machinery; the declared-entrypoint matrix permits adapters to import core `./contracts` only, so core cannot host behavior reachable by adapters, and the contracts tier admits types and constant data only. The dev-only test harness may import the adapters codec for round-trip tests per the testkit dev-edge rules (testkit may import every declared adapters subpath; testkit dev-edge dependency-cruiser rule per ADR-0003 DEC-2: testkit imports core and adapters, never cli/mcp/opencode). Closes the import-edge gap found by the test plan. | 2026-10-30 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Core contracts surface (runtime-neutral) | New: v1 primitive port contracts, capability/gap and carrier flag types, credential port, envelope data contract. |
| Adapters package (internal envelope codec module) | New: pure envelope codec (serialize, parse, strip), no I/O, colocated with the adapter-only write/read path; core `./contracts` carries only the envelope data contract; the dev-only test harness imports the codec per the testkit dev-edge rules. |
| Adapters I/O tier | New declared credentials subpath: environment-backed credential port implementation; confinement allowlist and fixture updates. |
| Repository invariant checks | New secret-read boundary invariant with allowlist registry; existing topology/bindingness invariants extended for wiring. |
| CI workflow | The invariant wired bindingly beside the existing static invariants; no bash job changes. |
| Result contract documentation and error catalog | One new synchronized row (`config.credential.missing`). |
| Dev-only test harness | Fixture adapters and conformance fixtures for capability declarations and envelope round-trip/degradation. |
| System documentation (sync phase) | New feature spec for the adapter/credential ports; contracts-placeholder wording and catalogue status updates; glossary terms. |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the catalogue's adapter-interaction rows typed at M0, **when** the contracts surface inventory is checked, **then** exactly the nine v1 primitives have typed contracts keyed by their catalogue PascalCase names (no numeric identifiers), and adding or removing one fails the inventory in both directions. | F-1, DM-1, NFR-1 |
| AC-F1-2 | **Given** the delivered contracts, **when** the neutral-tier guards and aggregate check run, **then** the new contracts contain types and constant data only, with 0 ambient environment, I/O, clock, or randomness accesses. | F-1, NFR-1 |
| AC-F2-1 | **Given** fixture adapter declarations, **when** inspected, **then** capabilities and gaps are typed data, an undeclared operation is representable as an explicit gap, and no declaration implies parity beyond its flags. | F-2, DM-2 |
| AC-F2-2 | **Given** carrier capability flags on an adapter declaration, **when** selecting a metadata carrier, **then** only a declared carrier kind is selectable and undeclared carriers are excluded by typing. | F-2, DM-10 |
| AC-F3-1 | **Given** a declared credential reference whose environment source key is present and non-empty, **when** resolving through the credential port, **then** the secret material is returned once through the port result and appears in no diagnostic, log, or error payload. | F-3, DM-9, NFR-2 |
| AC-F3-2 | **Given** a declared credential reference whose environment source key is absent or empty, **when** resolving, **then** the failure carries `config.credential.missing` identity (user, non-retryable, not landed, user-validation) and never falls to containment. | F-3, F-6, DM-9 |
| AC-F3-3 | **Given** the delivered credential port and its implementation, **when** the port surface is inspected, **then** it exposes no implementation mode or environment-specific typing that mediated execution would break, and the sidecar adoption path is documented as the port's second-implementation constraint. | F-3, DM-9 |
| AC-F4-1 | **Given** a planted ambient environment read in a provider adapter module (negative fixture), **when** the secret-read invariant runs, **then** it fails naming rule, file, and line; with the fixture removed (clean control), it passes. | F-4, NFR-2 |
| AC-F4-2 | **Given** the CI workflow and local boundary chain, **when** the topology and bindingness invariants run, **then** the invariant is invoked as a binding step with no bypass constructs, and the wiring is asserted by the extended invariants. | F-4, NFR-3 |
| AC-F4-3 | **Given** the enumerated allowlist registry, **when** mutation tests remove an entry or add an undeclared credential path, **then** the checks fail closed and non-vacuity of the registry is proven; the credential implementation is the sole credential-material entry. | F-3, F-4, NFR-2, NFR-7 |
| AC-F5-1 | **Given** canonical v1 provenance and linkage payloads across all declared carrier kinds, **when** the envelope is encoded into a carrier and decoded back, **then** logical payload equality holds for 100% of the golden round-trip matrix and every case serializes within the v1 size bound. | F-5, DM-10, NFR-4 |
| AC-F5-2 | **Given** a carrier carrying an envelope, **when** the adapter parses and strips, **then** the returned human-readable content is identical to the original minus the invisible envelope, and re-parsing the stripped content finds no metadata. | F-5, DM-10 |
| AC-F5-3 | **Given** the degradation matrix (metadata absent, malformed payload, wrong-kind payload, unknown schema version, stripped envelope, human-edited comment — absent and stripped being one observational case class), **when** parsing, **then** 0 cases fail the flow, every case returns the primitive view with account-based heuristic provenance, and every case carries visible degradation evidence naming the mechanically detected reason (`missing`, `malformed`, `wrong-kind`, or `unknown-version`; a human-edited comment classifies as malformed or missing per what is mechanically detectable). | F-5, NFR-5 |
| AC-F5-4 | **Given** the v1 envelope payload schema, **when** validated, **then** the field set is closed, admits no secret or credential material, and all carrier markers/namespaces are brand-neutral contract constants with 0 hardcoded product tokens. | F-5, DM-10, NFR-4 |
| AC-F5-5 | **Given** an adapter that declared its carrier capabilities, **when** it writes metadata, **then** the write path is adapter-only, uses a declared carrier, and no agent-facing contract exposes raw carrier construction. | F-2, F-5, DM-10 |
| AC-F5-6 | **Given** an envelope whose schema version is outside the known set (any unknown version string, older or newer), **when** the adapter parses, **then** the flow does not fail, provenance falls back to account-based heuristics, and the degradation evidence names the unknown version. | F-5, DM-10, NFR-5 |
| AC-F6-1 | **Given** the new error row, **when** the bidirectional sync invariant runs, **then** the machine table and documented table agree exactly, and existing classification behavior (kind-only singletons, configuration exact-code discipline, fallback containment) is unchanged. | F-6, NFR-6 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

Ship contracts, the credential implementation, the invariant, and the envelope together in one change so the substrate lands complete and mechanically enforced before any adapter consumes it. No migration or behavior change affects existing users: the bash stack is untouched, all exports are additive, and no gate weakens. The primitive catalogue status updates and the new feature documentation are reconciled in the documentation-sync phase. **Definition of Done predicates:** all 17 ACs have passing, traceable evidence; the secret-read invariant is green on the clean tree and proven to fire on planted violations (negative controls) with clean controls staying green; the round-trip and degradation matrices pass exhaustively; the error-table sync is green with the new row in both tables; all existing binding gates (bash and TypeScript) remain green; `pnpm check` passes; documentation is synchronized; an open unmerged pull request targets `main-tools` with all required CI jobs green on the pushed HEAD. If delivery disputes the recorded credential-implementation placement, raise the technical decision record per OQ-1 before merging the affected tier changes.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. No persisted state, no store schema, no configuration keys, and no installed-corpus changes are introduced. Provider artifacts gain metadata only when future adapters write them.

## 20. PRIVACY / COMPLIANCE REVIEW

The envelope payload will be embedded in provider artifacts that may be public; therefore it admits no secret or credential material ever, and its v1 field set is closed to provenance and delivery-linkage facts the provider artifact already exposes. Carrier markers use brand-neutral constants so no product token leaks through third-party services. Resolved credential material never enters diagnostics, logs, errors, or metadata; the existing redaction chokepoint governs surfaced payloads. The metadata emitter scan (no secrets, no private identifiers) and the event-classification discipline apply from M0-S15 onward; this change supplies the structural carrier and its closed schema. No personal data beyond operator-authority attribution (the account that posts the artifact anyway) is carried.

## 21. SECURITY REVIEW HIGHLIGHTS

Secret acquisition is centralized behind one port whose implementation is the sole credential entry in the enumerated boundary allowlist; the binding CI invariant plus existing runtime-API confinement close the ambient secret-read channel in provider and engine code. The credential implementation is deliberately minimal (environment source, injectable for tests) to reduce audit surface. The port exposes no implementation mode, so the future mediated (sidecar) mode cannot be bypassed through interface shopping. Envelope payloads are closed-schema and secret-free; degradation is visible so heuristic provenance can never masquerade as structural provenance in gate decisions.

## 22. MAINTENANCE & OPERATIONS IMPACT

Maintainers own one growing surface: new catalogue rows join the port set only through the primitive discipline (two consumers or a capability that cannot be expressed otherwise), reviewed against the M0-S17 adapter-contract decision record. The secret-boundary allowlist is a guarded register: growth requires a reviewed change with reasons, and its non-vacuity is mutation-tested. Envelope schema evolution follows the additive-within-version rule; the read window is current-plus-all-older read forward-compatibly (v1 being the only version at delivery, any unknown version binds to the degradation path), and narrowing the window or retiring versions is a future spec change, never silent. Degradation evidence gives operators a direct diagnostic when provenance falls back to heuristics. No operational runbook changes; the bash-era workflow is unaffected.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Primitive port | A typed, provider-agnostic contract in core `./contracts` for one catalogue primitive; adapters implement behind it. |
| Capability flag | Typed data on the adapter contract declaring a supported operation or carrier kind; absence is a machine-readable gap. |
| Gap record | An adapter's explicit declaration that it does not support a capability; parity is never implied. |
| Credential reference | A declared mapping from an external system's auth method to its source key; resolved to secret material only through the credential port. |
| Secret-read boundary | The mechanically enforced property that ambient secret acquisition occurs only in the enumerated allowlist (the credential implementation plus pre-existing config readers). |
| Metadata envelope | The versioned ADOS data contract (schema identifier, kind, closed payload) embedded in provider artifacts by adapters. |
| Carrier | The adapter-chosen, capability-flagged form the envelope takes inside a provider artifact (invisible comment block, custom field, marker fallback). |
| Graceful degradation | The specified response to unreadable metadata: heuristic fallback with visible degradation evidence, never a flow failure. |
| Mediated mode | The documented sidecar-era execution shape: adapters forward operations over local transport behind the unchanged port interface. |

## 24. APPENDICES

Sources: issue GH-181; backlog story M0-S12; concepts/primitive-catalogue.md (adapter-interaction table, naming discipline, what-a-primitive test, change classification); concepts/credential-sidecar.md ("Compatibility with the current build"); concepts/embedded-metadata.md (design, guardrails, story mapping); feature-monorepo-scaffold-toolchain.md (contracts tier rules, ambient guard, boundary matrix, CI wiring); feature-result-contract.md (error-table conventions and sync); feature-config-layer.md (environment-only secrets, environment-as-data precedent); ADR-0003 (structure, runtime neutrality, naming firewall); GH-181 pm clarify_scope notes.

**Ticket acceptance-criterion traceability:**

| Ticket AC | Covered by | Evidence boundary |
|-----------|------------|-------------------|
| AC-1: ports are typed and carry capability flags | AC-F1-1, AC-F1-2, AC-F2-1, AC-F2-2 | Inventory test fail-closed both directions; capability/gap typing proven on fixture declarations. |
| AC-2: a boundary check fails CI on any secret read outside the credential port | AC-F3-1, AC-F3-3, AC-F4-1, AC-F4-2, AC-F4-3 | Planted-violation fixtures fire with named rule/file/line; binding wiring asserted; allowlist fail-closed and non-vacuous. |
| AC-3: the metadata envelope round-trips and degrades gracefully when a provider strips it | AC-F5-1, AC-F5-2, AC-F5-3, AC-F5-4, AC-F5-5, AC-F5-6 | Golden round-trip matrix across carriers; six-case degradation matrix with 0 failures and 100% visible evidence; unknown-version reads bound to the degradation path (AC-F5-6). |

**v1 set selection traceability (catalogue "Adapters and provider interaction", typed at M0):**

| Primitive | In v1 | Note |
|-----------|-------|------|
| `ExternalSystemInstance` | Yes | Auth-method reference anchors the credential port. |
| `AdapterContract` | Yes | Carries capability flags and gap records. |
| `WorkItem` | Yes | Normalized ticket artifact. |
| `WorkflowMap` | Yes | Status aliasing contract. |
| `WorkItemRelation` | Yes | Typed relation kinds. |
| `DeliveryRequest` | Yes | PR/MR artifact contract. |
| `PipelineRun` | Yes | Job/trace evidence contract. |
| `RetryPolicy` | Yes | Known-safe retries only. |
| `IdempotencyKey` | Yes | Safe external-write retries. |
| `Compensation` | No | Typed at M1; reversible-action capability belongs to later stories. |
| `HarnessInstance` / `HarnessSession` / `HarnessPluginSurface` / `HarnessTelemetry` | No | Harness set typed at M1/M3 by their owning stories. |
| Credential port + metadata envelope | Yes (ticket-mandated) | No catalogue rows yet; bookkeeping per OQ-2. |
| All other catalogue rows | No | Owned by their stories (NG-3). |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-30 | Change Spec Writer | Initial GH-181 specification from PM clarify_scope context, the backlog story, the primitive/credential/metadata concepts, and the delivered scaffold, result, and config specifications. |
| 1.1 | 2026-10-30 | Change Spec Writer | Iteration-2 amendment from test-plan gap findings: version read-window policy defined in F-5 (current-plus-all-older; unknown versions bind to the degradation path; narrowing is a future spec change — resolves test-plan §8.3 TODO / OQ-B part 1); absent-vs-stripped reason taxonomy defined in F-5 (observationally equivalent cases share the single `missing` reason — resolves OQ-B part 2); envelope codec placed in the adapters package as an adapter-internal shared module with core `./contracts` data-only (resolves the import-edge gap). AC-F5-6 added; AC-F5-3 wording aligned to the taxonomy; §7.1, §8.3, §15 (DEC-7–DEC-9), §16, §18, §22, §24 updated. |

---

## AUTHORING GUIDELINES

Grounded in the ticket and the planning-session context only: the v1 port set follows the catalogue's typed-at-M0 adapter rows without inventing primitives; the credential placement resolves the one genuinely open structural question with the alternative recorded; the envelope design follows the concept's stated semantics (round-trip, adapter-only write path, graceful visible degradation, no secrets). Mechanical verifiability was enforced per AC: every criterion names an observable check (inventory test, planted-fixture firing, golden matrix, degradation matrix, sync invariant). No implementation tasks, file-level paths, or code instructions are included; placement is expressed at package/subpath granularity consistent with the delivered architecture documents.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-181); `owners` has one entry; `status` is Proposed.
- [x] All sections present in order (1–25 + authoring guidelines + checklist).
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-).
- [x] Every AC is Given/When/Then, references at least one F-/DM-/NFR- ID, and is mechanically verifiable at delivery.
- [x] NFRs include measurable thresholds; risks include impact and probability with mitigations and residual risk.
- [x] Out-of-scope items marked `[OUT]`; non-goals explicit per the ticket (no sidecar code, no provider adapters, no mediated mode).
- [x] Ticket ACs traced in the appendix; no invented catalogue primitives; no product tokens; no implementation details or file-level paths.
- [x] Only this spec file was written; no other files modified.
