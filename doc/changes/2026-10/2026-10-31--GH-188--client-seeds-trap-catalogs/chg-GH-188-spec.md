---
change:
  ref: GH-188
  type: feat
  status: Proposed
  slug: client-seeds-trap-catalogs
  title: "M0-S19: Client seeds with trap catalogs"
  owners: [engineering]
  service: delivery-os provider adapters
  labels: [change, planning]
  version_impact: minor
  audience: internal
  security_impact: medium
  risk_level: medium
  dependencies:
    internal: [primitive ports and credential port (GH-181), monorepo scaffold (GH-170), result contract (GH-172), config layer (GH-173), branding seam (GH-171)]
    external: [GitHub API, GitLab API, Jira API]
links:
  decisions: ["ADR-0004", "ADR-0005", "ADR-0006"]
---

# CHANGE SPECIFICATION

> **PURPOSE**: Seed the tracker and VCS client layer — GitLab, Jira, and a minimal GitHub read slice behind the delivered primitive ports — so higher layers (status, verify, closeout, conformance) read providers through one truthful normalized interface, with every known provider quirk captured as a trap-catalog test proven against recorded sanitized fixtures, offline, and every credential resolved exclusively through the credential port.

## 1. SUMMARY

Deliver the first real provider client seeds in the adapters package's per-provider subpaths, implementing behind the M0-S12 primitive ports: a GitLab client (MRs, pipelines per commit, merge-status quirks), a Jira client with the read slice first (label replace, custom fields, transitions as data, comment omission — feeding the M0-S6 tracker collector), and a minimal GitHub read slice (PRs, pipelines, issues) so this repository dogfoods the inputs of status and verify change from M0. Each client ships its provider quirks as a trap catalog: named entries pairing the provider's actual behavior with the expected normalized outcome and a fixture reference, tested offline against recorded, sanitized fixtures committed with the change. Operations a seed does not implement are declared capability gaps, never implied parity. All credentials resolve through the delivered credential port; the secret-read boundary allowlist stays at exactly four entries. The per-client implementation basis (provider CLI vs direct API for GitHub/GitLab; existing OSS/MCP client vs custom for Jira) is evaluated during planning, recorded in the ticket, and rendered invisible to consumers by the port boundary.

## 2. CONTEXT

### 2.1 Current State Snapshot

The adapter-era contract substrate is delivered (GH-181): nine typed primitive ports in the runtime-neutral core contracts tier with `AdapterCapabilityDeclaration` over the closed `ADAPTER_OPERATIONS` set and explicit gap records; one credential-resolution port in core with the environment-backed implementation as the sole `credential-material` entry in the binding secret-read boundary allowlist (exactly four entries); the `delivery.metadata.v1` embedded-envelope contract with its adapter-internal pure codec. The adapters package declares per-provider subpaths (GitHub, GitLab, Jira, Azure, CI) and a provider registry — all type-only placeholders from the scaffold. Boundary rules mechanically enforce the package matrix, core subpath permissions, and runtime-API confinement over an enumerated runtime edge. The dependency-license registry is committed with a fail-closed policy. Backlog dependencies: the M0-S6 status collector, M0-S8/M0-S9 verify change and gates, M0-S14 closeout, and the M0-S20 conformance suite all depend on this story; GH-181 closed 2026-10-30, so this story's dependency is satisfied.

### 2.2 Pain Points / Gaps

- No client can read a provider: every downstream story that needs tracker or VCS facts (status collectors, verify gates, closeout) is blocked on the first provider implementations behind the ports.
- Provider quirks are documented folklore (Jira label replace, custom-field typing, data-driven transitions, comment omission; GitLab pipeline-per-commit multiplicity, merge-status async semantics). Unchecked, these quirks leak into higher layers as silent misinterpretations of provider state.
- The port shapes have never faced a real provider; the first adapters are where contract-shape gaps surface.
- The runtime-API confinement allowlist was written when provider subpaths were placeholders: its "provider/registry subpaths are not I/O" wording is the scaffold's concretization (.dependency-cruiser.cjs comment; scaffold-spec confinement bullet) of ADR-0003 DEC-6 — not ADR-0003 verbatim — and real clients performing network I/O are representable only through the reviewed refinement now recorded as ADR-0005.
- No recorded provider fixtures exist, so adapter behavior cannot be proven offline, deterministically, or in CI without live credentials.

## 3. PROBLEM STATEMENT

Because no provider client exists behind the primitive ports, the status, verify, closeout, and conformance stories cannot read trackers or VCS systems at all; and when clients arrive without trap-catalog discipline, provider quirks (label replace semantics, custom-field typing, data-driven transitions, comment omission, pipeline-per-commit multiplicity, asynchronous merge status) will be misread as normalized truth by every higher layer. This change seeds the first three clients with their quirks captured as fixture-proven trap catalogs, so providers are read through one truthful interface from the first consumer onward.

## 4. GOALS

- **G-1**: Implement client seeds behind the primitive ports in the adapters package's per-provider subpaths — GitLab, Jira, GitHub — returning normalized primitive views (`WorkItem`, `DeliveryRequest`, `PipelineRun`) and declaring capabilities and gaps through `AdapterCapabilityDeclaration`.
- **G-2**: Ship the Jira read slice first, answering the four M0-S6 tracker-collector query families (owner hand-backs, blocked dependencies, stalls, ticket hygiene) from normalized `WorkItem` data.
- **G-3**: Ship the minimal GitHub read slice (PRs, pipelines, issues) providing the reads the M0-S6 status collector and M0-S8/M0-S9 verify change consume as inputs.
- **G-4**: Capture every ticket-named provider quirk as a trap-catalog entry (name, provider behavior, expected normalized outcome, fixture reference) proven by tests that pass against recorded fixtures with zero live network calls in CI.
- **G-5**: Create hand-authored synthetic provider fixtures at authoring time — modeled on recorded provider response shapes (public API documentation) — under sanitization rules that admit no secret, credential, private-corpus identifier, or personal data, and commit them with the change.
- **G-6**: Resolve all client credentials exclusively through the credential port, preserving the secret-read boundary allowlist at exactly four entries with zero growth.
- **G-7**: Define and record the per-client implementation-basis evaluation (GitHub/GitLab: provider CLI vs direct API; Jira: official/well-maintained OSS API or MCP client vs custom) so the outcome is decided and recorded in the ticket during planning, with the port boundary keeping the basis invisible to consumers.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Client seeds implementing behind the primitive ports | 3/3 (GitLab, Jira, GitHub), each with a capability declaration from the closed operation set |
| Ticket-named quirk families covered by trap-catalog entries | GitLab ≥3, Jira ≥4, GitHub ≥3 — 100%, each entry with all four required fields and a fixture reference |
| Trap-catalog tests passing offline against recorded fixtures in CI | 100%; live network calls in CI: 0 |
| Secrets, credentials, private-corpus identifiers, or personal data in committed fixtures | 0 |
| Secret-read boundary allowlist entries after the change | Exactly 4 (zero growth); client-code ambient reads: 0 |
| Provider-native types exported past the port surface | 0 |
| M0-S6 tracker-collector query families answerable from the Jira read slice | 4/4 |
| New dependencies absent from the committed license registry | 0 |

### 4.2 Non-Goals

- **NG-1**: No full GitHub adapter — write operations, full issue lifecycle, releases, and the complete operation set stay with M3-S3; this change delivers only the minimal read slice.
- **NG-2**: No adapter conformance suite — the mock-tenant/live-run conformance flow suite is M0-S20; this change supplies the fixture-based trap catalogs it will later gate on.
- **NG-3**: No status or verify commands — M0-S6 (status v1) and M0-S8/M0-S9 (verify change and gates) are downstream consumers; this change provides only the provider reads they consume.
- **NG-4**: No live-network testing in this change's CI — recorded fixtures only; scheduled live runs arrive with M0-S20 (scratch repos, Jira sandbox, strict teardown).
- **NG-5**: No closeout write path — the ticket write operations M0-S14 needs (ticket-to-done, label sweep, comment resolution) are beyond this change's read-slice-first scope; the Jira seed declares them as gaps until that story extends the seed.
- **NG-6**: No provider engine routing, no new CLI/MCP surface exposure, and no changes to the bash delivery stack.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Client seeds behind the primitive ports with honest capability declarations | One truthful normalized interface per provider; parity never pretended — unsupported operations are explicit gaps. |
| F-2 | GitLab client seed (MRs, pipelines per commit, merge-status quirks) | VCS read facts for status and verify: delivery requests, per-commit pipeline evidence, truthful merge state. |
| F-3 | Jira client seed with read slice first (label replace, custom fields, transitions as data, comment omission) | Feeds the M0-S6 tracker collector; the four tracker queries are answered from normalized `WorkItem` data. |
| F-4 | Minimal GitHub read slice (PRs, pipelines, issues) | This repository dogfoods status and verify change from M0; the full adapter stays in M3-S3. |
| F-5 | Trap catalogs: named quirk entries with expected normalized outcomes and fixture references | Provider quirks become executable, reviewable expectations instead of folklore. |
| F-6 | Hand-authored synthetic fixture authoring and sanitization | Trap tests run offline and deterministically in CI; committed fixtures leak nothing. |
| F-7 | Credential-port-exclusive credential resolution in every client | The secret-centralization invariant extends to the first real network clients; the allowlist does not grow. |
| F-8 | Implementation-basis evaluation recorded in the ticket | The CLI-vs-API and library-vs-custom choices are decided deliberately, with criteria, before custom code is written. |

### 5.1 Capability Details

- **F-1**: Each seed lives in its provider subpath of the adapters package, implements behind the core primitive ports, and exposes only normalized primitive views and the delivered agent-facing comment views — provider-native types never cross the port surface. Each seed ships an `AdapterCapabilityDeclaration`: supported operations drawn from the closed `ADAPTER_OPERATIONS` set, and a declared gap (`provider-unsupported`, `adapter-not-implemented`, or `plan-restriction`) for every operation it does not implement. The Jira seed's default posture is read-only with `write-work-item`, `transition-work-item`, and `write-comment` declared as gaps; if the planning evaluation requires proving the transitions-as-data quirk through execution, a minimal data-driven transition is admissible (per the planning decision recorded in the ticket), but the full write path (label replace semantics, comment writes) stays a gap until the consuming story lands. The GitHub seed declares every write operation as a gap.
- **F-2**: The GitLab seed reads merge requests (normalized to `DeliveryRequest`: identity, source/target refs, review state) and pipelines per commit (normalized to `PipelineRun` with job states and trace-evidence references — never a bare status color). Trap coverage addresses the ticket-named quirks: multiple pipelines per commit (branch/merge pipeline multiplicity resolved into a truthful per-commit pipeline set) and merge-status values whose native semantics are asynchronous and multi-valued, normalized to delivery-meaningful states without silent flattening.
- **F-3**: The Jira seed's read slice resolves issues (normalized to `WorkItem`: provider-qualified identity, native and delivery status, labels, assignee, typed relations, comments) and answers the four M0-S6 tracker-collector query families — owner hand-backs (assignee/ownership signals), blocked dependencies (`blocks`/`blocked-by` relations), stalls (optional `WorkItem.updatedAt` per ADR-0004; absent = activity unknown, distinguishable from no activity), and ticket hygiene (label/status/field conformance) — from the normalized data alone. Trap coverage addresses the ticket-named quirks: label updates replace the whole set rather than append (read views must reflect replace semantics truthfully); provider-specific custom fields normalize per documented mapping rules — a custom field that feeds a normalized field is read as typed data at the boundary, and unmapped custom fields are visibly unrepresented on `WorkItem` (never silently retained, never leaked as raw provider keys; ADR-0006); workflow transitions are read as data (the `WorkflowMap` maps native statuses to delivery-state aliases naming each transition mechanism); comments may be omitted from responses (permission/paging causes) and omission is represented by `WorkItem.comments` absence — the field is optional (ADR-0006): absent = comment set unknown (omitted or not fetched), present (including an explicitly empty array) = the provider-asserted comment set, so omission is never mistaken for "no comments".
- **F-4**: The GitHub seed's minimal read slice covers PRs (`DeliveryRequest`), pipeline/check-run state per commit (`PipelineRun`), and issues (`WorkItem`) — exactly the reads the M0-S6 status collector and the M0-S8/M0-S9 verify-change gate battery consume (per the planning interpretation: the slice serves those commands' inputs; the commands themselves are downstream stories). Scope is the provider surface of this repository's host; no write operations.
- **F-5**: Each client ships a trap catalog — a named, reviewable set of entries, one per quirk or quirk variant. Each entry carries exactly: the trap name, the observed provider behavior, the expected normalized outcome at the port boundary, and a reference to the recorded fixture that demonstrates it. Trap tests replay recorded fixtures through the client and assert the expected normalized outcome. Entries are data, reviewable without reading test code; the catalog is the durable record of why each normalization rule exists.
- **F-6**: Fixtures are hand-authored synthetic captures modeled on recorded provider response shapes (public API documentation); no live or controlled tenant is accessed in this change. Before commit they are sanitized: credentials, tokens, private-corpus identifiers, personal data (names, emails, avatars, account identifiers), and private repository references are removed or replaced with stable placeholders; fixture references used by trap entries remain stable across re-recording. Live-tenant revalidation of the modeled behavior is deferred to the M0-S20 conformance suite (RSK-2). Fixtures are committed with the change in the workspace dev-test fixture area and are the only provider input the CI trap suite consumes.
- **F-7**: Every client receives credential material only through the delivered `CredentialPort`, resolving its declared `ExternalSystemInstance` reference at use time; unresolvable credentials carry the classified `config.credential.missing` failure. No client module reads the ambient environment; the secret-read boundary allowlist keeps exactly its four entries and the invariant stays green — mechanically proven by the delivered check, not by convention.
- **F-8**: During planning, each client's implementation basis is evaluated and the outcome recorded in the ticket as a decision comment. Evaluation criteria: mid-term maintenance burden versus control and trap coverage (GitHub/GitLab: provider CLI versus direct API); for Jira, official or well-maintained open-source API or MCP client implementations are evaluated before any custom client is written; for all bases additionally — compatibility with offline fixture-driven testing, credential-port fit (no ambient secret reads, no independent credential caches), compatibility with the committed fail-closed license registry, and runtime compatibility with the pinned toolchain. The spec fixes the evaluation requirements and record-place, not the outcome; the primitive port boundary makes the chosen basis invisible to consumers, so a later basis swap is not a breaking change.

## 6. USER & SYSTEM FLOWS

1. **Tracker collector consumption (M0-S6, downstream)**: The status collector resolves the tracker instance → the Jira seed resolves its credential through the port → the read slice returns normalized `WorkItem` views → the four tracker query families (owner hand-backs, blocked deps, stalls, ticket hygiene) are answered from the normalized data, never from provider-native payloads.
2. **Verify-gate consumption (M0-S8/M0-S9, downstream)**: Verify change needs CI evidence on a pushed commit → the GitHub seed's `read-pipeline-run` per commit returns a `PipelineRun` with job states and trace-evidence references; the issue and PR reads serve the owner-gate and delivery-request evidence.
3. **Trap test (CI, no network)**: A trap-catalog entry names a quirk and its fixture → the test replays the recorded fixture through the client seed → the test asserts the expected normalized outcome at the port boundary; a regression in normalization fails CI naming the trap entry.
4. **Credential resolution**: A client requiring provider auth resolves its declared reference through `CredentialPort` → material is returned once for the request, never logged or persisted → an absent/empty source fails as `config.credential.missing`, classified, never silent.
5. **Fixture authoring (authoring time only)**: A maintainer hand-authors the synthetic fixture for a quirk, modeling it on the recorded provider response shape (public API documentation) → applies the sanitization rules → commits the sanitized fixture → registers the trap entry referencing it. Live provider behavior is re-validated later by the M0-S20 conformance suite's scheduled live runs (RSK-2).

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- GitLab client seed: MR reads (`DeliveryRequest`), pipeline-per-commit reads (`PipelineRun`), merge-status normalization; capability declaration with write operations declared as gaps; trap catalog for its quirks.
- Jira client seed, read slice first: issue reads (`WorkItem`) answering the four M0-S6 tracker-collector query families; label-replace, custom-field, transitions-as-data, and comment-omission trap coverage; write/transition operations declared as gaps (a minimal data-driven transition admissible only per the planning decision recorded in the ticket).
- Minimal GitHub read slice: PR, pipeline-per-commit, and issue reads serving status and verify-change inputs; all write operations declared as gaps; trap catalog for its read-slice families.
- Trap catalogs as data (name, provider behavior, expected normalized outcome, fixture reference) with offline fixture-driven test suites wired into the workspace test battery.
- Hand-authored synthetic-fixture authoring procedure and sanitization rules; sanitized fixtures committed with the change.
- Credential-port integration for all three clients; zero growth of the secret-read boundary allowlist.
- The implementation-basis evaluation conducted during planning with the outcome recorded in the ticket; evaluation criteria fixed by this spec.
- The reviewed runtime-API confinement allowance for the provider client subpaths performing network I/O (see DEC-1; ADR-0005 is the reviewed record governing the extension), with reason-bearing entries and fixture discipline consistent with the existing invariant.
- License-registry entries for any dependency the chosen bases introduce (fail-closed registry policy).

### 7.2 Out of Scope

- [OUT] Full GitHub adapter with write operations and complete lifecycle coverage (M3-S3).
- [OUT] The adapter conformance flow suite, mock tenants in CI, and scheduled live runs (M0-S20).
- [OUT] Status and verify commands and their collectors/gates (M0-S6, M0-S8, M0-S9); this change supplies their provider-read inputs only.
- [OUT] Closeout write operations on Jira/GitHub — ticket-to-done, label sweep, comment resolution, owed-flip (M0-S14 extends the seeds).
- [OUT] Azure DevOps and generic CI client seeds (later stories; their subpath placeholders stay untouched).
- [OUT] Provider engine routing and provider availability/park logic (M0-S13 concern).
- [OUT] Embedded-metadata envelope writes or envelope parsing on read paths beyond what the delivered codec already provides.
- [OUT] Changes to the bash delivery stack, public naming, or the branding resolver contract.

### 7.3 Deferred / Maybe-Later

- Jira write path (label replace execution, comment writes) and full data-driven transition execution — extended when M0-S14 closeout and later tracker-write stories land; the transitions-as-data `WorkflowMap` delivered now is their foundation.
- GitHub write operations and full issue lifecycle — M3-S3.
- Enriched provider telemetry (latency, rate-limit accounting) — with engine telemetry (M0-S13) or the conformance suite.
- Catalogue bookkeeping for provider-client seeds beyond the existing nine typed primitives — reviewed with the M0-S17 adapter-contract decision record.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None delivered. The seeds expose no ADOS-owned HTTP surface; they consume provider HTTP APIs (GitHub, GitLab, Jira) behind the primitive ports. Consumers see only port operations; the underlying API family and the implementation basis (CLI vs direct API vs client library) are invisible past the boundary.

### 8.2 Events / Messages

None. No new persisted or emitted event schema. Trap catalogs and fixtures are committed test assets, not runtime events; normalization failures surface as classified results through the delivered result contract, not as new event kinds.

### 8.3 Data Model Impact

| ID | Element | Contract |
|----|---------|----------|
| DM-1 | Per-seed capability declarations | `AdapterCapabilityDeclaration` instances over the closed `ADAPTER_OPERATIONS` set; every unimplemented operation carries a declared gap with a valid reason value; parity beyond flags is not representable. |
| DM-2 | Trap-catalog entry | Named record with exactly four fields: trap name, provider behavior (observed), expected normalized outcome (at the port boundary), fixture reference. |
| DM-3 | Recorded sanitized fixture | A committed, hand-authored synthetic capture of a provider response, modeled on recorded provider response shapes (public API documentation), sanitized per F-6, referenced stably by one or more trap entries; carries no secret, credential, private-corpus identifier, or personal data. Live-tenant revalidation of the modeled shapes is deferred to M0-S20 (RSK-2). |
| DM-4 | Jira `WorkflowMap` | Native-status to delivery-state alias mappings, each naming its transition mechanism — the data-driven representation of Jira transitions; write execution stays a declared gap at this seed. |
| DM-5 | Pipeline-per-commit normalization | A truthful per-commit pipeline set (`PipelineRun` with job states and trace-evidence references) resolving provider multiplicity (GitLab branch/merge pipelines; GitHub check runs per SHA) without silent flattening. |
| DM-6 | `WorkItem.updatedAt` (additive, optional) | Per ADR-0004: optional ISO-8601 UTC activity-timestamp field added to the v1 `WorkItem` port contract; the provider-native value is normalized verbatim; absent = activity unknown (distinguishable from no activity; never derived or fabricated). The contract-inventory structure test and its fixture update ride in this change. |
| DM-7 | `WorkItem.comments` optionality (additive relaxation) | Per ADR-0006: `comments` becomes optional on the v1 `WorkItem`; absent = comment set unknown (omitted/not fetched), present-empty = genuinely no comments; seeds populate it only from actually-obtained payloads; the contract-inventory field-shape probe (with DM-6) pins the optionality in this change. |
| DM-8 | Jira custom-field normalization mapping | Declared, reviewable adapter data naming which provider custom fields feed which normalized fields (typed at the boundary per the declared type) and that unmapped custom fields are visibly unrepresented — no raw provider key crosses the boundary; evidenced by the `JIRA-CUSTOM-FIELD-TYPING` trap entry; no v1 contract change (ADR-0006). |

**Normalization rules**: provider-native types never cross the port surface; merge-status and review-state values map to delivery-meaningful states through declared mappings; label reads reflect replace semantics; custom fields normalize per documented mapping rules (mapped fields typed at the boundary; unmapped fields visibly unrepresented — no raw provider key crosses); omitted comments are represented by `WorkItem.comments` absence (absent = comment set unknown; a present empty array = genuinely no comments — ADR-0006).

### 8.4 External Integrations

| Provider | Consumed surface (read) | Quirk families trapped |
|----------|------------------------|------------------------|
| GitLab | Merge requests; pipelines per commit; merge status | Pipeline multiplicity per commit; asynchronous/multi-valued merge status |
| Jira | Issues, labels, custom fields, transitions (as data), comments | Label replace semantics; provider-specific custom fields; transitions as data; comment omission |
| GitHub | Pull requests; check runs/pipelines per commit; issues | Review-state normalization; per-commit pipeline/check-run mapping; issue-to-`WorkItem` mapping |

Implementation basis per client is decided by the F-8 evaluation recorded in the ticket (CLI vs direct API for GitHub/GitLab; existing OSS/MCP client vs custom for Jira). Any adopted dependency (CLI, API client library) must appear in the committed dependency-license registry with an approved verdict before merge (fail-closed policy; denied license classes are rejected). All provider credentials resolve through the credential port; bases that require ambient secret reads or independent credential caches are disqualified by the evaluation criteria.

### 8.5 Backward Compatibility

Additive: provider subpaths gain implementations replacing type-only placeholders that have no consumers; no existing export changes. The runtime-API confinement allowlist gains the provider client subpaths as a reviewed, reason-bearing extension (registry subpath stays non-I/O); the secret-read allowlist does not change. All pre-existing gates (boundary matrix, ambient-globals guard, naming firewall, error-table sync, doc-distribution guard) remain green. The bash stack is untouched.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Normalized-view boundary purity | 0 provider-native types exported past the port surface; 100% of returned artifacts are primitive views (`WorkItem`, `DeliveryRequest`, `PipelineRun`) plus delivered agent-facing comment views; boundary matrix green. |
| NFR-2 | Trap-catalog coverage | 100% of ticket-named quirk families covered (GitLab ≥3, Jira ≥4, GitHub ≥3); every entry carries all four required fields and references ≥1 committed fixture. |
| NFR-3 | Offline determinism | 100% of trap tests run against recorded fixtures; 0 live network calls in CI; the suite is deterministic and re-runnable with identical results. |
| NFR-4 | Credential centralization | Secret-read boundary allowlist: exactly 4 entries (0 growth); 0 ambient environment reads in client code; invariant proven still to fire on its planted-violation fixtures. |
| NFR-5 | Capability honesty | 100% of seeds declare capabilities from the closed operation set; every unsupported operation declared as a gap with a valid reason; 0 implied-parity claims. |
| NFR-6 | License compliance | 100% of new dependencies registered in the committed license registry with approved verdicts; 0 unknown or denied licenses at merge. |
| NFR-7 | Repository gate integrity | `pnpm check`, boundary matrix, naming firewall (0 new product tokens), and doc-distribution guard green; bash jobs byte-unchanged; existing invariants unweakened. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

No new event schema or sink. Observability comes from artifact shape: capability declarations and gap records are inspectable data naming what each seed supports; trap-catalog entries name, per quirk, the provider behavior and the expected normalization, so a normalization regression is diagnosable from the failing entry without archaeology; credential failures carry the classified `config.credential.missing` identity. Resolved secret material never enters diagnostics, logs, error payloads, or fixtures (the delivered redaction chokepoint governs anything surfaced).

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The Jira evaluation finds no official or well-maintained OSS/MCP client meeting the criteria, forcing a custom client with higher cost | M | M | Read-slice-first bounds the first scope; evaluation criteria fixed now (F-8) so the outcome is deliberate and recorded; port boundary makes a later basis swap non-breaking. | M — a custom client is plausible; scoped to reads first |
| RSK-2 | Recorded fixtures drift from live provider behavior as providers evolve, so trap suites prove the wrong truth | M | M | Fixtures are dated and re-recordable with stable references; M0-S20's scheduled live runs (scratch tenants, strict teardown) re-validate against reality and gate future adapter changes. | M — drift detected only at the next live run |
| RSK-3 | Sanitization misses leak a secret, private identifier, or personal data through a committed fixture | H | L | Sanitization rules applied at authoring (F-6) with placeholder substitution; privacy/no-cloud guards (M0-S15) scan committed files; PR review checklist includes fixture audit; canary-style negative check in the test plan. | L |
| RSK-4 | The runtime-API confinement extension for provider client subpaths erodes the I/O-tier discipline (allowlist creep) | M | M | Exact, reason-bearing subpath entries; the registry subpath stays non-I/O; mutation tests prove fail-closed behavior; extension reviewed as a change, mirroring the secret-read allowlist discipline. | L |
| RSK-5 | The first real adapters reveal primitive-port shape gaps (e.g., missing activity-timestamp signal for the stall query), forcing contract churn | M | M | Contracts evolve additively within v1 per the delivered discipline; consumer story (M0-S6) reviews before implementation; the tracked activity-signal gap is resolved by ADR-0004 (additive optional `WorkItem.updatedAt`) — the anticipated first additive round is executed within this change; the decision-record path remains for further adapter-contract changes. | L — known candidate gap resolved; any further shape gap follows the same additive path |
| RSK-6 | A CLI-based implementation basis couples delivery to CLI availability/licensing in CI or introduces an independent credential cache | M | L | Evaluation criteria disqualify bases requiring ambient secret reads or credential caches; offline fixture testing is basis-independent; a basis swap behind the port is non-breaking. | L |

## 12. ASSUMPTIONS

- Hand-authored synthetic fixtures faithfully model the recorded provider response shapes (public API documentation) for the quirks covered at authoring time; they make no claim about current live tenant behavior — live-tenant revalidation is deferred to M0-S20 (RSK-2).
- The M0-S6 tracker-collector query set (owner hand-backs, blocked deps, stalls, ticket hygiene) is stable enough to define the Jira read-slice contract now.
- This repository's GitHub host is representable for the read slice that dogfoods status and verify-change inputs.
- Clients receive all credential material through the port; no seed needs a new ambient-environment read, so the secret-read allowlist does not grow.
- The provider subpath placeholders have no consumers, so replacing them with implementations is observationally additive.
- Ticket-comment recording is an accepted decision-record place for the implementation-basis outcomes (per the ticket's own mandate).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | M0-S12 / GH-181 (primitive ports, credential port, envelope) — delivered | The port contracts, capability mechanism, credential port, and boundary invariant this change implements against. |
| Depends on | M0-S1 / GH-170 (monorepo scaffold) | Package tiers, boundary matrix, runtime-API confinement, aggregate check. |
| Depends on | M0-S3 / GH-172 (result contract) | Classified failure identity (`config.credential.missing`), result envelope. |
| Depends on | M0-S4 / GH-173 (config layer) + M0-S2 / GH-171 (branding seam) | Environment-facts-as-data precedent; brand-neutral constants; environment-prefixed credential source keys. |
| Depends on | Dependency-license registry (fail-closed policy) | Any dependency introduced by the chosen bases must be registered and approved before merge. |
| Blocks | M0-S6 / GH-175 (status v1) | The tracker collector consumes the Jira read slice; "the Jira read slice from M0-S19 precedes this story". |
| Blocks | M0-S8 / GH-177 and M0-S9 / GH-178 (verify change and gates) | Both depend on M0-S19 for provider reads (CI green, PR/issue evidence). |
| Blocks | M0-S14 / GH-183 (closeout v1) | Depends on M0-S19; will extend the Jira seed with write operations (NG-5). |
| Blocks | M0-S20 / GH-189 (conformance suite) | Runs against every shipped adapter; the seeds are its first subjects. |

## 14. OPEN QUESTIONS

- **OQ-1** (Resolved 2026-10-31 — outcome: ADR-0004): Does the v1 `WorkItem` contract carry the activity/updated signal the stall query needs, or must the slice derive it from comments/ordering — or is an additive v1 extension required? Resolved: an additive v1 extension — the optional `WorkItem.updatedAt` field (ISO-8601 UTC; provider-native value normalized verbatim; absent = activity unknown, never derived from comments/ordering or fabricated).
- **OQ-2** (Resolved 2026-10-31 — outcome: spec default stands, per ticket-recorded outcome): the transitions-as-data quirk is covered read-only via the `WorkflowMap` plus its trap entry; Jira write/transition operations are declared gaps. The implementation-basis evaluation recorded in ticket GH-188 fixes write operations (label-replace execution, data-driven transitions, comment writes) as arriving with M0-S14 — including the recorded `jira.js` re-evaluation fallback trigger — so no transition execution ships in this change.
- **OQ-3**: Trap-entry granularity — one entry per quirk family or per concrete provider behavior variant (e.g., each distinct GitLab merge-status value)? Default: family-level entries with variant sub-cases inside fixtures; the test plan may refine. Non-blocking.
- **OQ-4** (Resolved 2026-10-31 — outcome: ADR-0005): ADR-0003's confinement wording ("provider/registry subpaths are not I/O") predates real provider clients; does the DEC-1 extension require an ADR wording amendment (via the documentation-sync phase or a small decision-record update), or is the reviewed invariant-allowlist change sufficient? Resolved: ADR-0005 refines ADR-0003 via a refining decision record plus an editorial pointer in ADR-0003 (no in-place semantic rewrite); the doc-sync phase applies the scaffold-spec confinement bullet, the feature-adapter-ports boundaries section, and the ADR-0003 pointer.
- **OQ-5** (Resolved 2026-10-31 — outcome: ADR-0006): Where do provider-specific custom fields normalize to, given v1 `WorkItem` has no custom-field field? Resolved: documented mapping semantics only — mapped fields feed normalized fields as typed data; unmapped fields are visibly unrepresented; no v1 contract change; a purpose-shaped additive extension waits for a named consumer.
- **OQ-6** (Resolved 2026-10-31 — outcome: ADR-0006): How is comment omission represented, given `comments` is a required array? Resolved: `comments` becomes optional with truthful-absence semantics (absent = comment set unknown; present-empty = genuinely none), pinned by the contract-inventory field-shape probe in this change.

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Client seeds live in the adapters package's per-provider subpaths and are admitted to the runtime-API confinement allowance as reason-bearing entries; the provider registry subpath stays non-I/O. | ADR-0003's per-provider subpath structure is the declared home for provider adapters; real clients perform network I/O, which only the runtime edge permits. The alternative — routing provider I/O through existing non-provider I/O subpaths — inverts the declared structure and was rejected. ADR wording alignment resolved via ADR-0005. | 2026-10-31 |
| DEC-2 | Read slices first, per ticket sequencing: the Jira read slice precedes everything (it feeds M0-S6), the GitHub seed is a minimal read slice only, and GitLab ships reads with write operations as declared gaps; Jira write/transition defaults to declared gaps with a minimal data-driven transition admissible only per the planning outcome recorded in the ticket (OQ-2). | The ticket's own ordering ("read slice first — it feeds the M0-S6 tracker collector") plus the AC set: only read slices are AC'd; write paths arrive with their consuming stories (M0-S14, M3-S3). | 2026-10-31 |
| DEC-3 | Trap catalogs are fixture-based and offline: fixtures are captured at authoring time, sanitized, committed; CI runs the trap suite with zero live network calls; live provider validation belongs to M0-S20's conformance suite. | Matches the ticket AC ("pass against recorded fixtures") and the PM clarification; keeps CI deterministic, credential-free, and fast. | 2026-10-31 |
| DEC-4 | The implementation-basis evaluation is conducted during planning against criteria fixed in F-8, with the outcome recorded in the ticket as a decision comment; this spec fixes requirements, not the outcome, and the port boundary keeps the basis invisible to consumers. | The ticket mandates the evaluation and its record-place; pre-judging CLI-vs-API or library-vs-custom here would bypass the mandated flow and the @decision-advisor delegation planned by the PM. | 2026-10-31 |
| DEC-5 | "The GitHub read slice serves status and verify change on this repository" is interpreted as: the slice provides the PR/pipeline/issue reads that the M0-S6 status collector and M0-S8/M0-S9 verify change consume as inputs; the status and verify commands themselves are downstream stories. | PM clarification of 2026-10-31; the backlog confirms M0-S6 and M0-S9 depend on M0-S19 and that M0-S6's Jira slice precedes it — the dependency direction proves the slice-feeds-commands relationship. | 2026-10-31 |
| DEC-6 | All client credentials resolve exclusively through the credential port; the secret-read boundary allowlist remains at exactly four entries with zero growth in this change. | The ticket AC ("no client reads a secret outside the credential port") is already mechanically enforced by the delivered invariant; the only honest target is zero allowlist growth, proven by the invariant staying green. | 2026-10-31 |
| DEC-7 | Jira custom fields follow documented mapping semantics with no v1 `WorkItem` change: mapped fields typed at the boundary; unmapped fields visibly unrepresented (no raw key leak). | No M0 consumer names a need for custom-field values beyond mapped normalized fields; a generic custom-field record would be a speculative, unclosable provider-native bag on a closed contract (ADR-0006). | 2026-10-31 |
| DEC-8 | `WorkItem.comments` becomes optional (additive relaxation): absent = comment set unknown; present (incl. empty) = the provider-asserted set. | ADR-0004's truthful-absence precedent applies one-to-one; zero in-repo consumers read `comments` today, so the relaxation breaks nobody while the reversibility window is open (ADR-0006). | 2026-10-31 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Adapters package, per-provider subpaths (GitHub, GitLab, Jira) | New: client seed implementations behind the primitive ports, capability declarations, trap catalogs; placeholders replaced. |
| Core contracts (`packages/core/src/contracts/ports.ts`) | `WorkItem` gains the optional `updatedAt` field (additive, per ADR-0004) and `comments` becomes optional (absent = comment set unknown, per ADR-0006); contract-inventory structure test and field-shape probe updated in this change. |
| Runtime-API confinement allowance | Reviewed extension: the three provider client subpaths join as reason-bearing entries (DEC-1); registry stays non-I/O; fixture discipline per the existing invariant. |
| Workspace dev-test fixture area | New: recorded, sanitized provider fixtures referenced by trap entries. |
| Workspace test battery | New: offline trap-catalog suites per client, wired into the aggregate check. |
| Dependency-license registry | Entries for any CLI/library dependency the chosen bases introduce; fail-closed gate stays authoritative. |
| System documentation (sync phase) | New feature spec for provider client seeds and trap catalogs (always-resolve); possible feature-adapter-ports.md updates (consumed-by/risks); ADR-0005 alignment via doc-sync (scaffold-spec confinement bullet, feature-adapter-ports boundaries section, ADR-0003 editorial pointer). |
| Ticket GH-188 | Implementation-basis evaluation outcomes recorded as decision comments during planning. |
| Bash stack, CLI/MCP/opencode surfaces | Unchanged. |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the three delivered client seeds, **when** their capability declarations are inspected, **then** each declares supported operations exclusively from the closed `ADAPTER_OPERATIONS` set, every unimplemented operation appears as a declared gap with a valid reason value, and no declaration implies parity beyond its flags (GitHub: all write operations gapped; Jira: write/transition/comment-write gapped or minimal-transition per the ticket-recorded planning outcome). | F-1, DM-1, NFR-5 |
| AC-F1-2 | **Given** any client seed's public surface, **when** boundary and type checks run, **then** 0 provider-native types cross the port boundary: all returned artifacts are normalized primitive views, and the boundary matrix stays green including the DEC-1 confinement extension. | F-1, NFR-1, NFR-7 |
| AC-F2-1 | **Given** the GitLab client seed and its recorded fixtures, **when** MR reads and pipeline-per-commit reads execute, **then** `DeliveryRequest` and `PipelineRun` views return normalized — the per-commit pipeline set is truthful under pipeline multiplicity, and merge-status values map to delivery-meaningful states without silent flattening. | F-2, DM-5, NFR-2 |
| AC-F3-1 | **Given** the Jira read slice and its recorded fixtures, **when** each of the four tracker-collector query families executes (owner hand-backs, blocked dependencies, stalls, ticket hygiene), **then** each query is answerable from the normalized `WorkItem` data the slice returns — stalls read the optional `WorkItem.updatedAt` field (ADR-0004), with absent-`updatedAt` represented as activity unknown, distinguishable from no activity — and no query requires provider-native payloads. | F-3, DM-4, DM-6, NFR-2 |
| AC-F3-2 | **Given** the Jira quirks (label replace, provider-specific custom fields, transitions as data, comment omission), **when** their trap-catalog tests replay the recorded fixtures, **then** label reads reflect replace semantics, custom fields normalize per documented mapping rules (mapped fields read as typed data; unmapped fields visibly unrepresented with no raw provider key crossing the boundary), the `WorkflowMap` names each transition mechanism, and omitted comments are represented by `WorkItem.comments` absence — distinguishable from a present empty array. | F-3, F-5, DM-4, DM-7, DM-8, ADR-0006 |
| AC-F4-1 | **Given** the GitHub read slice and its recorded fixtures, **when** the reads required by the status collector and verify change execute (PR reads, pipeline-per-commit reads, issue reads), **then** `DeliveryRequest`, `PipelineRun`, and `WorkItem` views return normalized, constituting the complete input set those downstream commands consume from GitHub. | F-4, DM-5, NFR-2 |
| AC-F5-1 | **Given** the delivered trap catalogs, **when** entries are inspected, **then** every ticket-named quirk family has ≥1 entry carrying exactly the four required fields (name, provider behavior, expected normalized outcome, fixture reference) with coverage meeting NFR-2 minima, and entries are reviewable as data without reading test code. | F-5, DM-2, NFR-2 |
| AC-F5-2 | **Given** the trap-catalog test suites, **when** CI runs, **then** 100% of trap tests pass against recorded fixtures with 0 live network calls, and a deliberately corrupted normalization expectation (negative control) fails the suite naming its trap entry. | F-5, F-6, NFR-3 |
| AC-F6-1 | **Given** the committed fixtures, **when** audited against the sanitization rules, **then** they contain 0 secrets, credentials, tokens, private-corpus identifiers, or personal data (names, emails, avatars, account identifiers), with placeholders stable across re-recording and fixture references stable for trap entries. | F-6, DM-3, NFR-3 |
| AC-F7-1 | **Given** any client seed requiring provider auth, **when** it acquires credential material, **then** the material resolves exclusively through the credential port; the secret-read boundary invariant stays green with exactly the four allowlist entries (0 growth) and still fires on its planted-violation fixtures. | F-7, NFR-4 |
| AC-F7-2 | **Given** a client whose declared credential reference is unresolvable, **when** the client resolves it, **then** the failure carries the classified `config.credential.missing` identity through the result contract — never containment, silence, or a raw provider error. | F-7, NFR-4 |
| AC-F8-1 | **Given** the planning session, **when** delivery begins, **then** each client's implementation basis (GitHub: CLI vs direct API; GitLab: CLI vs direct API; Jira: OSS/MCP client vs custom) is evaluated against the F-8 criteria and the outcome is recorded in the ticket as a decision comment before custom client code is written. | F-8, DEC-4 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

Ship the three seeds, their trap catalogs, fixtures, capability declarations, and the confinement allowance together in one change so the first provider clients land complete, trap-proven, and credential-clean before any downstream story consumes them. Delivery build order inside the change: implementation-basis evaluations first (recorded in the ticket), then the Jira read slice (unblocks M0-S6 planning), then GitLab and GitHub read slices, then the trap suites. No migration or user-facing behavior change: the bash stack is untouched, provider subpath placeholders had no consumers, and all gates remain green. **Definition of Done predicates:** all 12 ACs have passing, traceable evidence; the trap suite passes offline in CI with its negative control firing; the secret-read invariant is green with exactly four entries and still fires on planted violations; `pnpm check` passes; any new dependency is license-registered and approved; documentation is synchronized (new feature spec; feature-adapter-ports.md updates; ADR-0005 alignment (pointer note + spec sync) per resolved OQ-4); the ADR-0004 `updatedAt` field is present with the contract-inventory structure test green; the ADR-0006 semantics are implemented (`WorkItem.comments` optional with absent-means-unknown pinned by the contract-inventory field-shape probe; the Jira custom-field mapping declared as reviewable data and evidenced by its trap entry with no raw provider key crossing the boundary); an open unmerged pull request targets `main-tools` with all required CI jobs green on the pushed HEAD.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

None. No persisted user state, store schema, or configuration keys are introduced. Trap fixtures are new committed test assets seeded in this change; provider accounts referenced by fixtures are sanitized placeholders, never live tenants.

## 20. PRIVACY / COMPLIANCE REVIEW

Committed fixtures are the privacy-sensitive surface of this change: sanitization rules (F-6) remove or placeholder credentials, tokens, private-corpus identifiers, and personal data before commit, and the privacy/no-cloud guard (M0-S15) plus PR review provide the durable scan. The no-cloud boundary is unaffected: GitHub/GitLab/Jira are external providers consumed by declared adapters, not ADOS cloud scope; no cloud names, designs, or pricing enter committed files. Reads surface no new personal data beyond what provider responses already contain, normalized into port views; resolved credential material never enters diagnostics, logs, errors, or fixtures. Any provider client library/CLI adoption is license-checked against the fail-closed registry before merge.

## 21. SECURITY REVIEW HIGHLIGHTS

This change extends the credential-centralization property to the first network-capable clients: every seed resolves credentials exclusively through the credential port, the secret-read boundary allowlist does not grow, and the invariant's planted-violation fixtures keep proving it fires. The implementation-basis evaluation explicitly disqualifies any basis requiring ambient secret reads or independent credential caches. Trap fixtures are sanitized at authoring and scanned by the privacy guard; resolved material is never recorded into fixtures. The confinement extension is exact-path and reason-bearing with the registry subpath excluded, keeping the I/O-tier discipline auditable. Declared capability gaps prevent a read-only seed from being invoked for writes, and gap records make overclaim mechanically visible.

## 22. MAINTENANCE & OPERATIONS IMPACT

Maintainers own three growing surfaces: (1) trap catalogs — new provider quirks join as data entries with fixtures, and fixture re-recording keeps references stable; fixtures age, and M0-S20's scheduled live runs become the drift detector. (2) The confinement allowance — further I/O claims are reviewed, reason-bearing extensions; the registry subpath stays excluded. (3) Capability declarations — write operations move from declared gaps to supported only when their consuming story (M0-S14 closeout, M3-S3 full GitHub adapter) lands, with trap coverage extended in the same change. A basis swap behind the port boundary requires no consumer change. No operational runbook changes; the bash-era workflow is unaffected.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Client seed | The first real provider client implementation behind the primitive ports for one provider, scoped to the operations its consuming stories need now. |
| Read slice | The read-operation subset of a client (work items, delivery requests, pipeline runs) delivered before any write path. |
| Quirk | A documented provider behavior that diverges from naive expectations (label replace, comment omission, pipeline multiplicity, asynchronous merge status). |
| Trap catalog | A named, data-reviewable set of entries pairing a provider quirk with the expected normalized outcome and its fixture; the durable record of each normalization rule. |
| Trap-catalog entry | One record with four fields: trap name, provider behavior, expected normalized outcome, fixture reference. |
| Recorded fixture | A hand-authored synthetic capture of a provider response, modeled on recorded provider response shapes (public API documentation), sanitized, and committed as a test asset; the only provider input CI consumes. |
| Sanitization | The authoring-time removal or stable-placeholder substitution of secrets, tokens, private-corpus identifiers, and personal data in fixtures. |
| Implementation basis | The chosen execution substrate for a client (provider CLI, direct API, or adopted client library/MCP client), invisible to consumers behind the port boundary. |
| Declared gap | An adapter's explicit `{ operation, reason }` record for an operation it does not support; parity is never implied. |
| Pipeline-per-commit normalization | Resolving provider pipeline multiplicity (branch/merge pipelines, per-SHA check runs) into a truthful per-commit `PipelineRun` set. |
| Tracker-collector queries | The four M0-S6 tracker query families: owner hand-backs, blocked dependencies, stalls, ticket hygiene. |

## 24. APPENDICES

Sources: issue GH-188 (M0-S19); backlog story M0-S19 and consumer stories M0-S6, M0-S8, M0-S9, M0-S14, M0-S20; feature-adapter-ports.md (current port/credential/boundary truth); ADR-0003 (package placement, runtime-API confinement, per-provider subpaths); GH-188 pm-notes (GitHub-AC interpretation, evaluation flow, doc impacts); adapters package layout and boundary rules inspection (provider subpath placeholders, runtime-edge allowlist).

**Ticket acceptance-criterion traceability:**

| Ticket AC | Covered by | Evidence boundary |
|-----------|------------|-------------------|
| AC-1: each client's trap-catalog tests pass against recorded fixtures | AC-F5-1, AC-F5-2, AC-F2-1, AC-F3-2, AC-F4-1 | Trap suites pass offline in CI; every entry four-field complete with fixture reference; negative control fires. |
| AC-2: the Jira read slice answers the tracker-collector queries named in M0-S6 | AC-F3-1, AC-F3-2 | All four query families answered from normalized `WorkItem` data against recorded fixtures, with custom-field mapping and comment-omission representations per ADR-0006. |
| AC-3: the GitHub read slice serves status and verify change on this repository | AC-F4-1 (interpretation per DEC-5) | PR/pipeline/issue reads return the complete normalized input set the M0-S6 collector and M0-S8/M0-S9 gates consume. |
| AC-4: no client reads a secret outside the credential port | AC-F7-1, AC-F7-2, AC-F6-1 | Invariant green with exactly four allowlist entries, planted violations still fire; fixtures sanitized; failures classified. |

**M0-S6 tracker-collector query coverage (backlog lines 183–184):**

| Query family | Jira read-slice source |
|--------------|------------------------|
| Owner hand-backs | Assignee/ownership signals on normalized `WorkItem` |
| Blocked deps | `blocks`/`blocked-by` `WorkItemRelation`s |
| Stalls | Optional `WorkItem.updatedAt` (ADR-0004) |
| Ticket hygiene | Label and status conformance plus custom-field conformance for mapped fields on normalized `WorkItem` (unmapped-field conformance awaits a named consumer — ADR-0006) |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31 | Change Spec Writer | Initial GH-188 specification from PM clarify_scope context, the backlog story, feature-adapter-ports.md, ADR-0003, adapters package inspection, and the delivered GH-181 substrate. |
| 1.1 | 2026-10-31 | Change Spec Writer | Correction pass after decision resolution: front-matter decision links added (ADR-0004, ADR-0005); §2.2 confinement quote re-attributed to the scaffold's concretization of ADR-0003 DEC-6, refined by ADR-0005; F-3, AC-F3-1, and the §24 traceability table pin optional `WorkItem.updatedAt` (ADR-0004) as the stall signal with unknown-activity representation; DM-6 added (contract-inventory structure test + fixture ride in this change); §7.1 and §16 cite ADR-0005 as the governing reviewed record for the confinement extension; RSK-5 residual lowered to low; OQ-1 and OQ-4 marked resolved with their outcomes; §18 DoD predicates updated (ADR-0005 alignment per resolved OQ-4; ADR-0004 field with inventory test green); implementation basis (GitHub/GitLab: direct REST API native fetch; Jira: custom minimal read-slice client with jira.js fallback trigger at M0-S14 write ops) recorded in ticket GH-188. |
| 1.2 | 2026-10-31 | Change Spec Writer | Correction pass after decision resolution (ADR-0006): front-matter decision link added; F-3 and AC-F3-2 custom-field clause pinned to documented mapping semantics (mapped fields typed; unmapped visibly unrepresented) and comment-omission clause pinned to optional `WorkItem.comments` absence semantics; DM-7 (comments optionality) and DM-8 (custom-field mapping) added; §8.3 normalization rules updated; OQ-5/OQ-6 added as resolved; DEC-7/DEC-8 added; §16 core-contracts row, §18 DoD predicates, and §24 hygiene/AC-2 traceability rows updated. |
| 1.3 | 2026-10-31 | Change Spec Writer | DoR remediation: fixture provenance stated honestly — hand-authored synthetic captures modeled on recorded provider response shapes, sanitized per F-6, live-tenant revalidation deferred to M0-S20 (RSK-2); replaces captured-against-tenant wording across F-6/DM-3/flows/§12. |

---

## AUTHORING GUIDELINES

Grounded in the ticket and the planning-session context only: the three seeds and their quirk lists come verbatim from the ticket task line; the tracker queries come from the M0-S6 backlog entry; the GitHub-AC interpretation, evaluation flow, and fixture semantics come from the PM decisions recorded in pm-notes; placement and boundary rules come from feature-adapter-ports.md, ADR-0003, and inspection of the delivered adapters package. The implementation basis was evaluated during planning and recorded in ticket GH-188 (F-8 criteria; the spec fixes the record-place, not the outcome). Mechanical verifiability was enforced per AC: every criterion names an observable check (capability inspection, offline trap suite with negative control, query-family coverage, invariant greenness with allowlist count, sanitization audit). No implementation tasks are included; placement is expressed at package/subpath granularity consistent with the delivered architecture documents.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-188); `owners` has one entry; `status` is Proposed.
- [x] All sections present in order (1–25 + authoring guidelines + checklist).
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-).
- [x] Every AC is Given/When/Then, references at least one F-/DM-/NFR- ID, and is uniquely, mechanically verifiable at delivery.
- [x] NFRs include measurable thresholds; risks include impact and probability with mitigations and residual risk.
- [x] Out-of-scope items marked `[OUT]`; non-goals explicit per the ticket and backlog (full GitHub adapter M3-S3, conformance suite M0-S20, status/verify commands M0-S6/M0-S8/M0-S9, closeout writes M0-S14).
- [x] All four ticket ACs traced in the appendix with evidence boundaries.
- [x] Trap-catalog definition, synthetic fixture authoring/sanitization rules, credential-port integration, and per-client operation-vs-gap requirements specified.
- [x] Documentation impacts recorded (new feature spec in sync phase; feature-adapter-ports.md updates; ADR-0005 alignment via resolved OQ-4).
- [x] Only this spec file was written; no other files modified; no git operations performed.
