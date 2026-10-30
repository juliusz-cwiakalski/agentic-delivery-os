---
id: TDR-0003
decision_type: tdr
status: Proposed
created: 2026-10-30
decision_date: null
last_updated: 2026-10-30
summary: "Propose line-preserving YAML and JSON Schema validation, existing config acquisition/export seams, bootstrap separation, and code-qualified config failures within ADR-0003."
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os configuration
decision_scope: repo
review_date: null
classification:
  domains: [tooling, configuration, security, licensing]
  archetype: selection
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: medium
  blast_radius: local
  recurrence: one-off
governance:
  driver: "@pm"
  decider: "Juliusz Ćwiąkalski (human acceptance pending)"
  contributors: ["@decision-advisor", "@spec-writer"]
  reviewers: ["Human dependency/license approver", "@readiness-reviewer", "@reviewer"]
  performers: ["@spec-writer", "@test-plan-writer", "@plan-writer", "@coder"]
  informed: []
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "Dependency or license approval is refused, or the locked dependency closure changes."
  - "A real consumer needs typed config fields, defaults, or source restrictions."
  - "A host forbids validator code generation or a selected runtime import fails portability checks."
links:
  related_changes: [GH-173, GH-172, GH-171, GH-170]
  supersedes: []
  superseded_by: []
  spec: ["doc/changes/2026-10/2026-10-30--GH-173--config-layer/chg-GH-173-spec.md"]
  contracts: []
  diagrams: []
  decisions: [ADR-0003]
---

# TDR-0003: Config Parser, Schema, and Acquisition

## Context

- **FACT:** ADR-0003 is Accepted (2026-10-24). DEC-4 already decides the seven layers, merge/reset semantics, typed environment mapping, source restrictions, discovery, and provenance. This record does not reopen that architecture.
- **FACT:** GH-173's specification needed concrete parser/validator, acquisition, bootstrap and classifier refinements before test planning. License determination remains an owner **PR-review/merge gate**, not a blocker to writing artifacts, implementation on the feature branch or opening the unmerged PR.
- **Classification:** TDR/R2, a reversible implementation selection within the accepted model, local to the configuration slice. No new package, core subpath, layer, or primitive interface is proposed. A change to those boundaries would need architectural escalation instead.
- **Evidence observed:** initial dependency analysis through 2026-10-30T06:18:54Z; policy clarification and PM confirmation at 2026-10-30T06:21:06Z (actual UTC). PM notes contain later historical timestamps; this record does not rewrite their chronology.

## Problem Framing (Clarified)

Make DEC-4 implementable and testable without inventing consumer settings or weakening existing boundaries. The problems are loss of source positions, an ungoverned promotion of development/transitive dependencies, circular brand-based discovery, and a kind-only classifier that cannot distinguish nine config failures.

## Constraints (Hard Requirements)

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | Preserve DEC-4 and the existing package/tier matrix; core resolution has no ambient I/O or runtime imports. | ADR-0003 DEC-1/2/4, C-9 | Boundary/ambient guards, injected-fact and Node/Bun tests | no |
| C-2 | Feature-branch dependency/registry/allow-list changes may carry explicitly proposed verdicts; truthful accounting and fail-closed checks accompany them. Human compatibility determination and acceptance occur at owner PR review before merge/adoption; release obligations apply at release, not as new pre-PR requirements. | ADR-0003 C-2; GH-170 DEC-10/OQ-1; registry lines 3–8; local decision instructions | Branch license/closure checks; human PR approval before merge; release checks when applicable | no |
| C-3 | Keep the branding contract unchanged, derive names only through it, and introduce no default product name. | ADR-0003 C-3/DEC-8; GH-171 | Bootstrap/rename tests and literal scan | no |
| C-4 | Reject prohibited sources without leaking values, including on errors; no credential resolution or sidecar implementation. | DEC-4; GH-173 F-4/F-6/NG-1; CEO direction | Restriction and output canaries, scope review | no |
| C-5 | Preserve GH-172's envelope, containment and exit projection; all nine config identities round-trip through synchronized machine/documented rows. | GH-173 §8.3; GH-172 current contract | Classification, golden and bidirectional sync tests | no |

## Decision Drivers

1. Minimize bespoke parsing/validation code and maintenance for a solo maintainer.
2. Make schema/catalog evolution and upgrades reproducible and easy to review.
3. Keep adapter replacement and future consumer adoption inexpensive.

These rank feasible choices; provenance, security, licensing and boundaries are gates above, not duplicated scoring factors.

## Decision Rights (DACI)

- **Driver:** @pm; **accountable human decider/escalation authority:** Juliusz Ćwiąkalski; **contributors:** decision advisor and spec writer.
- **Required review:** human dependency/license approver, readiness reviewer, delivery reviewer. **Performers:** artifact writers and coder. No independent critic has been invoked in this session.
- **Timing:** refine the specification before test planning. Artifacts, implementation, tests, proposed dependency/registry/allow-list extensions and opening an unmerged PR may proceed with human approval pending. The requesting workflow stops at that open PR for CEO/owner approval; it does not merge. The PM may resolve reversible implementation details within delegated policy, but neither an AI PM nor this record accepts licenses or this R2 record for the owner.
- **Acceptance/review:** no owner approval is claimed. Set decision/review dates only on human acceptance; schedule the first review within two weeks after implementation.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false / confidence |
|---|---|---|---|
| `yaml` 2.9.1 is a root direct **dev** dependency, registry license ISC; its installed manifest has no runtime dependencies. AST ranges, `parseDocument`, `LineCounter`, and source-token retention exist. | FACT | Root manifest/lockfile; installed `yaml` manifest/types/LICENSE | Parser/closure choice changes; high, local evidence |
| Its Node-selected entry imports `process`; parser/composer read `LOG_TOKENS`/`LOG_STREAM` and print tokens independently of `logLevel`. | FACT | Installed `yaml/dist/parse/parser.js`, `compose/composer.js`, `log.js`; manifest conditional exports | Normal entry is unsuitable for neutral core and can leak source from adapter parsing unless guarded; high |
| Ajv 8.20.0 is installed transitively through dependency-cruiser, not declared by core and not registered. Its manifest says MIT. | FACT | Lockfile; installed Ajv manifest/LICENSE | Cannot treat an available transitive as an approved direct dependency; high |
| Ajv's locked closure is `fast-deep-equal` 3.1.3 (MIT), `fast-uri` 3.1.9 (BSD-3-Clause), `json-schema-traverse` 1.0.0 (MIT), `require-from-string` 2.0.2 (MIT). | FACT | Lockfile snapshot and each installed manifest; fast-uri LICENSE also inspected | Human review must include a license absent from the allow-list; high |
| Registry scope says direct-dev-dependencies; audit actually enumerates all four dependency fields across all manifests, but requires every registry row's source to be `dev-dependency` and indexes rows by package name. | FACT | `doc/legal/dependency-licenses.yaml`; `scripts/checks/license-audit.ts:28–64,155–170` | Adding runtime dependencies without correcting accounting produces misleading governance; high |
| Registry rows are proposed at delivery and confirmed by the owner at PR review. GH-170 DEC-10 places human license verdicts at owner PR review; OQ-1 resolves the missing-registry stop condition by supplying entries and a fail-closed audit, not by requiring pre-PR human approval. Local decision instructions require R2/R3 records to remain Proposed until a human decides. | FACT | Registry lines 3–8; GH-170 spec §14 OQ-1 / §15 DEC-10; `.ai/agent/decision-instructions.md:67–75` | Proposed rows and green mechanical checks must not be represented as human acceptance; high |
| Adapters may import core `./contracts` only; runtime APIs are allowed under adapters `repo/file/host/session/legacy`, not a new `src/config` or `src/io` runtime directory. Core has no public `./config`. | FACT | Manifests; dependency-cruiser; workspace-entrypoints check | Placement/export proposals otherwise fail gates; high |
| `classifyDomainKind` uses `.find(domainKind)`; docs/tests assume one entry per kind. Sync requires code namespace to equal domain kind. | FACT | CLI classifier; GH-172 spec/tests; error-table-sync | Nine rows with kind=config otherwise silently select the first; high |
| Supplied working name plus neutral override can establish discovery identity before config acquisition. | FACT (mechanism) | GH-171 resolver and feature spec | No need to select a product name or change branding; high |
| Selected imports remain portable in the final packed core artifact. | ASSUMPTION | Node experiment below; installed code inspection only | Must prove under Node/Bun and packaging gates; medium |
| License compatibility/acceptance, current advisories, release cadence and adoption metrics are not established by installation. | TO-CONFIRM | Human review / bounded external research if needed | Do not adopt on inferred approval or claim a clean security scan |

### Technical-Selection Evidence Pack (archetype: selection)

Local-only evidence, as of **2026-10-30**. `@external-researcher` delegation is unavailable in this session; no direct network access was used. Canonical URLs identify upstreams, not remotely verified observations. License strings are facts, **not compatibility verdicts**.

| Candidate | Observed license / source | Integration fit | Approval/activity/security status |
|---|---|---|---|
| `yaml` 2.9.1 | ISC; local manifest/LICENSE; <https://github.com/eemeli/yaml> | AST ranges and line counter; Node entry reads diagnostic environment switches; place behind I/O port | Dev registry row exists; runtime use needs human review; activity/advisories TO-CONFIRM |
| Ajv 8.20.0 | MIT; local manifest/LICENSE; <https://github.com/ajv-validator/ajv> | JSON Schema validator; four locked runtime dependencies; normal draft-07 path distinct from Node-dependent `standalone/instance` | No registry row; compatibility/acceptance TO-CONFIRM |
| `js-yaml` 4.3.2 | MIT; local manifest; <https://github.com/nodeca/js-yaml> | Installed transitively; manifest depends on argparse; not selected because the inspected `yaml` API already exposes the required node/line model | No registry row; equivalent provenance integration not demonstrated; other signals TO-CONFIRM |

Dependency canonical sources: [fast-deep-equal](https://github.com/epoberezkin/fast-deep-equal), [fast-uri](https://github.com/fastify/fast-uri), [json-schema-traverse](https://github.com/epoberezkin/json-schema-traverse), [require-from-string](https://github.com/floatdrop/require-from-string).

**Local experiment:** Node imported the installed `yaml` and Ajv draft-07 entry, reported a nested scalar on actual line 3, accepted a boolean and rejected its string equivalent with coercion/default insertion disabled. This establishes an API fit, not full YAML conformance, portability, security or license approval.

## Mental Models & Techniques Used

- Eligibility-first comparison; separate bootstrap identity from the object it locates; inversion against source-loss and error-leak paths; opportunity cost of handwritten parsers and generated-validator tooling.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| Alternative | C-1 | C-2 | C-3 | C-4 | C-5 | Eligibility |
|---|---|---|---|---|---|---|
| ALT-0: retain placeholder / leave spec ambiguous | fail | pass (no adoption) | pass | incomplete | fail | Not eligible |
| ALT-1: `yaml` AST + runtime Ajv, existing adapter seams | designed to pass | branch proposals permitted; human merge gate pending | designed to pass | designed to pass | designed to pass | Eligible for proposed branch implementation/review, subject to checks; not yet accepted for merge/adoption |
| ALT-2: `yaml` AST + build-time Ajv-generated validators for production and fixture catalogs | designed to pass | branch proposals permitted; human merge gate pending | designed to pass | designed to pass | designed to pass | Eligible for proposed branch implementation/review, subject to checks; not yet accepted for merge/adoption |

### Alternative 0 — Do Nothing / Keep Current Approach

No dependency work, but no deliverable resolver or reliable test-planning contract. A handwritten YAML subset is not an acceptable shortcut to meeting the line-preserving YAML requirement.

### Alternative 1 — AST Parser and Runtime Schema Validator

**Conditional recommendation.** On the feature branch, propose exact `yaml` 2.9.1 as an adapters runtime dependency and Ajv 8.20.0 as a core runtime dependency, with matching proposed registry/allow-list changes and truthful closure accounting. No pre-PR human license approval is required; owner review gates merge/adoption. The file adapter parses text with real positions; one pure resolver/validator consumes plain facts and trusted catalogs. Lowest bespoke-tooling cost; costs a governed runtime closure, a parser diagnostic guard and trusted-schema code generation.

### Alternative 2 — AST Parser and Precompiled Validators

Use the same YAML parser at runtime and Ajv as an explicit build dependency, generating production and test validators reproducibly from the same catalog. Avoids runtime compilation, but adds generated-code drift checks and fixture generation. It does **not** evade Ajv/build-dependency license approval or automatically remove embedded runtime helpers/notices. Prefer only if actual host evidence forbids runtime code generation; no such evidence was supplied.

## Decision

- **Recommendation:** ALT-1, conditional on C-2 and delivery verification. The following are exact proposed spec refinements, not owner-approved new product requirements.
- **PM-confirmed reversible mechanics:** bootstrap-only identity before discovery; empty ordinary production catalog with typed extension/test catalogs; explicit selector at project-committed priority and project-local skipped as `selected-config` (PM follow-up, 2026-10-30).
- **Authorized human selection/license decision:** none in this session; record remains **Proposed**. PM confirmation resolves those mechanics, not human license compatibility/acceptance or R2 record acceptance.

### 1. Parser and schema contract — refine F-3, F-7, DM-3/4, §8.4

- Parse file text in `adapters/src/file` using `yaml.parseDocument`/node ranges and `LineCounter`, retaining positions before conversion. Do not use plain `parse()` followed by regex key lookup or import the Node-selected `yaml` entry into neutral core. Disable parser logging and pretty/source-snippet diagnostics; wrap parser errors into safe codes and positions.
- Before calling the Node parser, the production adapter must fail safely with `config.value.invalid` if either actual process switch `LOG_TOKENS` or `LOG_STREAM` is non-empty: those upstream debug paths print raw tokens regardless of `logLevel`. Do not mutate host environment or intercept global console streams. Test both switches with canaries before parser invocation. A browser-targeted dependency artifact could avoid this guard, but requires reproducible packaging proof; do not use unsupported deep imports to select it.
- Specify YAML 1.2, one mapping document, unique string keys, JSON-compatible values, no executable/custom tags or YAML 1.1 merge semantics. Reject unsupported/non-JSON/cyclic values fail-closed; bound alias expansion. For supported aliases preserve the referenced value's actual source position, not a guessed line at the new key. Include multiline, flow, sequence and alias cases in tests.
- Generate one draft-07 JSON Schema from a typed catalog carrying env conversion, source restrictions, deprecation and default metadata. Ajv validates trusted schemas only: no schema loading from input `$schema`, remote refs, async fetch, custom executable input, coercion, removal of unknown properties or default insertion. Disable its logger. Never import `standalone/instance` into neutral core.
- Partial-layer validation derives a recursive optional-required view from that canonical schema; final validation enforces effective required fields. The wrappers recognize input `$schema` and `reset`, validate them, then remove them before validating the effective tree. Source restrictions and interpolation rejection also run on every supplied layer **before** merge, even if later shadowed/reset. No partially valid snapshot escapes.
- Export the schema value through core `.` and ship a generated JSON artifact with core's `dist` files for local editor/CI `$schema` references; verify generation/packing parity. No new HTTP service, promised public URL, or public `./config` export is required. `$schema` in input is metadata, not authority to change validation.

### 2. Acquisition and public surface — refine F-7 and AC-F7-1/2

- Put the production filesystem/platform/environment-fact `ConfigSource` factory and line-preserving parser at `packages/adapters/src/file`, exported through existing `adapters ./file`. Its port and plain source-fact/origin/error types live in core `./contracts`; no YAML/Ajv types cross the port. File facts contain JSON-compatible values plus per-node positions/source identity, or a safe parse failure; raw parser documents/text do not enter the resolved snapshot. Core resolution/validation remains pure.
- Repository-root detection belongs in existing `adapters ./repo` (or is injected as a root fact into the file adapter). The file adapter owns eligible location selection, reads and loaded/skipped evidence, not config merge rules. Runtime APIs must remain in these allowed I/O directories.
- Keep legacy acquisition/mapping at existing `adapters ./legacy`, implementing/decorating the same port and receiving current names as parameters. Current inputs win on collision. Route its once-per-process warning through an injected structured-warning sink and the CLI chokepoint, not the existing console default.
- Expose `resolveConfig` and catalog/schema helpers from core `.`; contracts stay data/ports, not an implementation entry point. CLI edge imports allowed branding/file/legacy subpaths, supplies facts and invokes that API. Do not import branding from config/app/adapters, adapters from core, CLI from MCP, or invent an adapters `./config`/runtime `src/io` exception. Do not build unrelated state/provider services merely to activate the scaffold's declared `createRuntime` API.

### 3. Bootstrap before discovery — refine F-3/F-4 and RSK-5

- The caller/build supplies `ResolverInput.workingName`; the runtime-aware edge reads neutral `DELIVERY_OS_WORKING_NAME` into `override` and invokes the unchanged branding resolver **once before brand-derived discovery**. Missing/invalid bootstrap input uses the existing echo-free branding failure, with no guessed fallback.
- Freeze that identity for this invocation. A file found using it must not rename the identity, change its discovery prefix, or start a second discovery pass. Treat working name as a **bootstrap catalog input**, not an ordinary mutable seven-layer key; remove F-3's implication otherwise. This follows the existing runtime-aware seam rather than adding a product setting.
- Consume/exclude exactly the recognized bootstrap names before curated env-key validation: the neutral working-name override and `${environmentPrefix}CONFIG` selector, including recognized legacy mappings. Do this even if the working name makes the neutral name start with the resulting prefix. Unrelated unmapped prefixed keys must still fail; do not blanket-ignore prefixed keys.
- Selector mechanics: `--config` wins over `${environmentPrefix}CONFIG`; a selected file replaces project discovery at **project-committed priority**, skips project-local with reason **`selected-config`**, and retains file/source restrictions even outside git. The slot and skip reason are PM-confirmed. It does not enable CI-disabled ambient sources. An explicitly selected missing/unreadable file is `config.value.invalid` (unusable selector), not an optional-missing skip or a fabricated YAML line. No eighth layer. Test normal and legacy selectors and precedence.

### 4. Minimal catalogs and defaults — refine F-3, DM-4, AC-F1/F3/F4/F5

- Publish the already-grounded bootstrap descriptor (`workingName`: required string, no invented default) separately from resolved config. No ordinary built-in consumer setting is established yet; use the **PM-confirmed empty ordinary production catalog/defaults**, with typed extension/test catalogs below. `defaults.ts` is still the single typed default source, checked against the catalog. Do not disguise an injected working name as a literal default originating on an invented source line.
- The resolved schema permits `$schema`/`reset` input forms and `x-` extension data, with unknown ordinary keys rejected. Use a synthetic `x-test` extension to exercise real file/env/flag acquisition and merges without promising provider/state settings. Environment/flag access to extension values needs an explicitly supplied typed extension catalog; arbitrary `x-` input must not create an implicit env mapping.
- Supply test-only catalogs for nested maps, scalars, replace-only lists, nullable/required/defaulted/deprecated fields, environment-only canary secrets and machine paths. Test all seven levels, reset-before-set, missing-required final failure, unknown keys, conversions and restrictions against these catalogs using the **production algorithm**. Fixtures are not published built-in keys or future consumer implementations.
- For every default-bearing field, require a typed default at compile time; do not add defaults to required environment-only secrets. Empty production defaults have no leaf origin to display; exercise default-leaf provenance with real fixture declarations, not fake production values.

### 5. Real provenance — refine F-5, DM-2 and NFR-3

- File leaf origins refer to the winning value node's actual 1-based start line; array elements retain their own positions, empty collections use their collection position. Preserve origins while recursively merging, replace list origins as a unit, and delete descendant origins on reset. Metadata/directives have no effective leaf origins.
- For actual production defaults, generate/check a source-position manifest from `packages/core/src/config/defaults.ts` at build time; the prescribed display label remains `core/src/config/defaults.ts`. Check manifest drift against source, including a line-insertion mutation. Ship the manifest, so the runtime resolver never reads TypeScript or guesses a line. Test defaults use their actual fixture source locations.
- Injected bootstrap/env/flag facts never claim a file/default line. Validation errors without an actual node (for example a final missing required value) may identify layer/key but must not invent a positive line.

### 6. Nine config codes without first-row classification — refine §8.3 and GH-172 integration

- Keep all nine codes exactly as specified and add domain kind `config`; do not invent nine domain kinds, collapse to one generic config code, or change numeric exits.
- Declare a config failure discriminant `{ kind: "config", code: ConfigErrorCode, ...safeLocation }`. Extend kind classification with an explicit code discriminator, e.g. `classifyDomainKind(kind, code?)`: resolve by exact code **and verify matching kind**. Kind-only resolution remains valid only for a singleton kind (existing provider/input behavior); a multi-entry kind without a code is ambiguous, never `.find()`-classified.
- `classifyThrown` contains missing/unknown/mismatched config codes through `fallback.internal`; valid config failures, returned or thrown, retain their exact identities and exit 1. Direct classification APIs may report ambiguous programmer input; they must not leak a throw past surface containment. Static table fields remain authoritative.
- Change GH-172 docs/tests from “one entry per domain kind” to “one entry per declared failure discriminant; unique code; total over declared valid failures.” Ship machine rows, documented rows, all nine round-trips, singleton regression and mismatch/ambiguity cases together. The namespace-equals-kind and bidirectional-sync invariants remain binding.

### 7. Redaction even on prohibited file secrets — strengthen NFR-4 and RSK-2

- Never put raw YAML snippets, validator input/data, interpolation payloads, exceptions/stacks or offending values into summaries, remediation, warnings or origins. Config failure objects must construct safe summaries rather than forward untrusted `summary` fields. Parser failure can precede any secret registration, so suppression of source text is mandatory, not optional redaction polish.
- The serialization chokepoint must redact all modes, including new human success JSON and debug/get outputs. Catalog-designated environment secrets enter the invocation redaction set before inspection. Recognizable prohibited file-secret values, if collected, may enter an ephemeral **redaction-only** set before rejection, never a resolved config or credential API. Do not depend on that collection succeeding for malformed YAML.
- Add previously unregistered file canaries on parse/schema/restriction/strict failure paths, with no partial `data`, no diagnostic snippets and zero stdout/stderr occurrences; also cover JSON-escaped/multiline values. Registered-environment canaries alone do not prove this requirement. No credential fetching, caching or transport is implied.

### 8. Credential and mediated-mode boundary — retain NG-1 and §7.3

Document only: M0-S12 owns credential resolution through one port (environment-backed initially); a later sidecar can supply another implementation. Direct and mediated adapters implement unchanged primitive ports; mediated mode forwards operations over local transport instead of receiving local credentials. GH-173 supplies non-secret config facts/routing locations only. Implement no credential port, keyring, sidecar, transport or remote adapter here.

### Constraint Compliance Attestation

ALT-1 is designed to satisfy C-1/C-3/C-4/C-5, subject to tests. C-2 permits proposed branch implementation and an unmerged PR with accurate dependency entries, closure/usage accounting and passing mechanical checks. The registry's existing convention permits proposed `verdict: approved` rows and the corresponding proposed allow-list extension under an explicit “proposed at delivery; confirmed by the owner at PR review” determination; that machine verdict is **not** human license acceptance. This applies to proposing BSD-3-Clause as well: its absence today is not a documented prohibition on a feature-branch proposal. Unregistered dependencies must not remain silently uncovered or get falsely labelled development-only. **Merge/adoption remains gated** on human compatibility determination and acceptance of the runtime uses/closure, including BSD-3-Clause. No exception, legal conclusion, owner approval or completed verification is asserted.

## Trade-offs & Consequences

### Positive Outcomes

- Standard parsing and validation replace bespoke language implementations; existing subpaths and result contracts remain usable.
- Empty ordinary built-ins avoid speculative requirements while extension/test catalogs prove the full algorithm.

### Negative Outcomes

- Runtime dependencies, closure governance and schema generation add maintenance. The current license registry/audit need truthful runtime/multi-use accounting and closure coverage; their existing development-only labels are insufficient.
- The selected Node YAML entry cannot safely parse while its upstream token/stream debug switches are enabled; the adapter must reject that condition before parsing, even though it is unrelated to ordinary config keys.
- Generic config classification now requires a code; documentation and tests must evolve with the nine rows. Default-position generation and safe parser-error handling are additional delivery work.

### Unresolved Questions

- **Pending human PR-review/merge gate, not a pre-PR blocker:** compatibility determination and acceptance of exact dependency uses/closure, including fast-uri's BSD-3-Clause license. Existing ISC/MIT rows and a transitive installation are not that approval. Proposed rows/allow-list changes are permitted before review with truthful accounting and explicit pending determination. No checked source imposes a separate pre-PR human approval requirement or forbids proposing BSD-3-Clause; do not invent one.
- **Resolved PM mechanics:** bootstrap-only identity, empty ordinary production catalog with typed extension/test catalogs, and selector at project-committed priority with local skip reason `selected-config`. Encode them in the spec before test planning; no owner-only product/default question remains for those mechanics.
- **Verification pending:** current advisory scan, complete packed/import portability and provenance tests. External evidence may be gathered later using only public package/version identifiers; none was shared here.

## Implementation Plan

1. PM/spec writer incorporate the numbered refinements and PM-confirmed mechanics, link this Proposed record, and state explicitly that no pre-PR human-license question blocks planning/delivery; human dependency acceptance is pending at PR review before merge/adoption.
2. Test-plan/plan writers trace every seven-layer/restriction/error/provenance rule, including empty production defaults and richer fixture catalogs. Implement and test on the feature branch with proposed dependency rows/allow-list extensions and truthful runtime closure accounting; preserve fail-closed negative controls and ordinary quality gates.
3. Open the unmerged PR targeting `main-tools`, identify the proposed license determinations/allow-list additions and this Proposed selection for CEO/owner review, then **STOP** as directed. Do not require a separate pre-PR human approval, claim human acceptance from green CI, merge, or bypass any failing gate. Full policy hardening/SBOM/notices remain at their established M0-S18/release milestones; this slice must account truthfully for its new dependency uses/closure.

## Verification Criteria

- Before delivery completes: seven-layer fixture matrix passes; all nine config failures classify exactly; invalid/missing/mismatched code cases contain safely; documented and machine rows sync in both directions.
- Before PR handoff: proposed dependency/allow-list rows and accurate actual-use/closure accounting pass applicable mechanical/security gates; pending human determination is explicit. No pre-PR license acceptance is claimed or required. Before merge/adoption: human compatibility determination/acceptance recorded. Notices/SBOM release checks retain their established release-time applicability.
- Before PR review: Node/Bun and packed core import controls pass; no boundary/ambient/rename violations; parser/default line-insertion controls remain accurate; no invented non-file lines; both upstream YAML diagnostic switches fail safely without parser/source output.
- Before PR review: zero prohibited/registered canary occurrences in every human/machine success and failure stream; no partial success on malformed input. Review after implementation at the acceptance-scheduled date, and on any listed invalidation trigger.

## Confidence Rating

**Medium.** Local package/API and boundary evidence supports the design. Human licensing, complete dependency/runtime validation and delivery tests are outstanding; AI confidence supplies no missing evidence or authority.

## References

- [Accepted architecture](ADR-0003-oss-monorepo-structure.md), especially C-2/C-3/C-9 and DEC-1/2/4/8.
- [GH-173 specification](../changes/2026-10/2026-10-30--GH-173--config-layer/chg-GH-173-spec.md) and adjacent PM notes (read-only evidence).
- [Branding contract](../spec/features/feature-branding-seam.md); [result contract](../spec/features/feature-result-contract.md).
- [Dependency registry](../legal/dependency-licenses.yaml); repository license audit, error-table-sync, ambient-global and workspace-entrypoint checks; `.dependency-cruiser.cjs` and package manifests.
- [GH-170 spec §14 OQ-1 / §15 DEC-10](../changes/2026-10/2026-10-29--GH-170--monorepo-scaffold-toolchain/chg-GH-170-spec.md#15-decision-log): owner PR review records license verdicts; registry rows are proposed at delivery. [Local decision instructions](../../.ai/agent/decision-instructions.md#status-lifecycle): R2/R3 remains Proposed until a human decides.
- [Command registry](../planning/oss-tooling/cli-command-registry.md#global-options); [sidecar compatibility](../planning/concepts/credential-sidecar.md#compatibility-with-the-current-build) (documentation-only adoption path).
