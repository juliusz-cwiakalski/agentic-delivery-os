---
id: TOOLING-INCEPTION-FSE-AUDIT
status: Draft
created: 2026-11-01
last_updated: 2026-11-01
owners: [engineering]
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Bounded Phase 3 audit of ten AI-friendly environment attributes, with evidence limits and validation proposals."
---

# Full-Stack Environment audit

## Scope and evidence semantics

This is the legacy-reconstruction audit required by Phase 3 of the
[inception guide](../../guides/project-inception.md#phase-3--tech-stack--architecture).
Phase 2 approval permits this draft; OPEN-Q7 through OPEN-Q11 remain deferred.
The [scope reconciliation](phase-2-scope-and-coverage.md), [risks](risks.md), and
[assumptions](assumptions.md) retain their existing authority and uncertainty.
The missing documentation profile invokes the handbook's engineering-repo default.

The sample covers workspace configuration, package manifests, CI wiring, selected
command/domain/parser/output modules, feature contracts, and representative tests.
It is not a whole-repository code review, production pilot, or platform certification.
The separately owned tech-stack and architecture drafts are not evidence of acceptance.
Existing Proposed decision records remain proposals, including foundational records
listed in Phase 2; merged text and machine approval fields do not ratify decisions.

Evidence labels used below:

| Label | Meaning |
|---|---|
| existing | A specific contract, implementation mechanism, or assertion was inspected. |
| not-reverified | Execution, operational effectiveness, or broader coverage was not checked in this audit. |
| gap | Missing evidence, unresolved scope, or a concrete mismatch needs a routed follow-up. |

These labels may coexist for one attribute. No attribute receives a broad PASS
merely because a file exists. No branch-wide CI-green claim is made.
Phase 2 records branding-guard document-membership failures on inception content;
unregistered content is not thereby certified scanned or clean (XC-012).

## Ten attributes

### FSE-01: Explicit typing

- Evidence: existing. `tsconfig.base.json` enables strict typing, checked indexed
  access, exact optional properties, unused checks, explicit returns, and ESM
  syntax discipline. `skipLibCheck` excludes third-party declaration checking.
- Sample: `packages/core/src/contracts/session.ts` declares closed command/mode
  sets, readonly metadata shapes, and separate read/admin ports. The status
  command's `StatusCommandRuntime` makes read dependencies explicit.
- Boundary: TypeScript cannot validate a remote payload at runtime. Provider
  normalization and configuration schema validation supply separate checks.
- Gap: sampled renderer/redaction code uses casts; their presence alone does not
  prove a violation, but generic return-shape and narrowing assumptions need review.
- Validation: engineering reviews new public types and unsafe narrowing; runner
  uses `pnpm typecheck` on implementation changes. Execution not-reverified here.

### FSE-02: Single-responsibility modules

- Evidence: existing. `.dependency-cruiser.cjs` separates contracts, neutral core
  tiers, adapters, and surfaces. Provider peak/quota/chain/park modules divide policy;
  `packages/core/src/domain/ci-result.ts` centralizes shared CI classification.
- Sample: the status command collects injected facts; pure aggregation and human
  rendering live in `packages/core/src/domain/status.ts`; stream writes live outside.
- Gap: status and queue-ready domain modules combine classification, ranking,
  evidence projection, output budgeting, and rendering. CLI edge and session
  adapter composition also deserve responsibility review when changed.
- Size is a navigation signal, not proof of an SRP violation. Review reasons to
  change, dependency cohesion, and test isolation before proposing extraction.
- Validation: engineering/reviewer owns a responsibility map on the next relevant
  feature change; import-rule execution and whole-module cohesion are not-reverified.

### FSE-03: Conventions over configuration

- Evidence: existing. Root `package.json` supplies aggregate scripts; package
  manifests declare ESM, exports, imports, and workspace edges. Tests use the
  `tests/` layer structure and Bun naming described in the testing strategy.
- Configuration precedence and source restrictions are explicit in
  [configuration](../../spec/features/feature-config-layer.md), not ambient guesses.
- Contextual exception: `packages/adapters/src/io/provider-transport.ts` explains
  relative built-sibling imports needed by packed consumers. Applying an alias
  convention blindly could break that documented packaging contract.
- Gap: `.ai/rules/typescript.md` is narrower than some delivered feature exceptions;
  policy reconciliation belongs to a separately approved conventions change.
- Validation: reviewer checks imports against actual checker configuration and
  packed-consumer evidence on export changes; execution not-reverified.

### FSE-04: Semantic names

- Evidence: existing. `classifyPipelineRuns`, `collectStatusFacts`, and
  `readProviderParkViews` identify their operations; closed readiness conditions
  distinguish satisfied, unsatisfied, and unknown evidence.
- Caveat: `merge-ready` is a bounded close class, not merge authorization;
  `provider-available` includes `engine-not-run`, not a live capacity check.
  `db reboot` checkpoints and requests manual host restart, rather than restarting.
- Gap: `MAX_SOURCE_BYTES` in `packages/adapters/src/file/yaml-parser.ts` is checked
  against `text.length`. This is a character-unit check, not a UTF-8 byte proof.
- Validation: engineering resolves the parser unit contract with non-ASCII inputs;
  owner/reviewer walks caller terminology at pilot review (RSK-002, XC-007).
  Caller comprehension and parser byte semantics are not-reverified.

### FSE-05: Automated tests

- Evidence: existing. Status performance tests assert request counts and a pure
  aggregation median; queue-ready performance tests assert capped evaluation and
  injected read counts. Golden, behavior, structure, type, and mutation suites
  complement those sampled assertions.
- [Conformance](../../spec/features/feature-adapter-conformance.md) replays production
  client factories with exact-URL fixtures and a broken-adapter control. Coverage
  gates distinguish supported reads, declared gaps, and live-read-only deferrals.
- Limits: fixtures are synthetic; live infrastructure is not a successful configured
  run. Unsupported writes and absent carriers are not tested production mutations.
  Windows ACL enforcement is not established by Linux state tests.
- Gap: direct owner-attention outcomes and independent pilot exposure are absent
  from the current baseline; test population is not field effectiveness.
- Validation: runner selects suites by touched surface; owner reviews pilot evidence
  (XC-005/009/010). Product suites were not executed for this docs-only audit.

### FSE-06: Linters and formatters

- Evidence: existing. Root scripts invoke Biome lint/format, typecheck, tests,
  boundaries, and exports parity. `biome.json` scopes workspace files and explicitly
  exempts selected fixtures. It does not format these Markdown documents.
- CI independently wires TypeScript invariants, privacy, branding, license,
  vulnerability, exports, and commitlint jobs. `pnpm check` is not all CI checks.
- Shellcheck is configured at error severity; the workflow records warning debt.
  Some legacy action references use mutable versions, unlike pinned TS jobs.
- Gap: known document-membership failures prevent a branch-wide green statement;
  guard routing remains deferred under OPEN-Q11. No weakening is implied.
- Validation: runner checks the applicable jobs after integration; reviewer checks
  source and generated prompt parity when tooling changes. Execution not-reverified.

### FSE-07: Readable Git history

- Evidence: existing. A ten-entry local log sample contains scoped Conventional
  Commit subjects, change references, integration history, and Phase 2 approval.
  CI invokes commitlint against PR and integration ranges.
- Counterexample to inference: Phase 2 reconciles a gate-delivery commit subject
  with planning-only artifacts and missing runnable command implementation.
- Gap: subject readability is not behavioral evidence, review acceptance, or
  a milestone exit. Full historical consistency was not audited.
- Validation: reviewer follows claims to actual diffs, source, tests, and human
  gate records; PM reconciles delivery status before acceptance (RSK-003/005).

### FSE-08: Contextual comments

- Evidence: existing. Provider transport comments explain the packed-import
  exception; YAML parser comments explain host-switch rejection before parsing;
  serializer comments explain the single output/redaction boundary.
- These explain constraints rather than merely restating statements. The shared
  CI classifier also documents its pure responsibility and consumer relationship.
- Limits: comments are not proof that every call site obeys a boundary. Casting
  after recursive redaction warrants behavioral review independently of comments.
- Gap: broad comment freshness is not-reverified. Keep durable rationale in
  decisions/specs and avoid making ticket labels the only explanation.
- Validation: engineering/reviewer checks comments against changed code and
  negative fixtures whenever a documented exception or boundary changes.

### FSE-09: Popular, supportable stack

- Evidence: existing. The workspace uses TypeScript, ESM, pnpm, Bun, Biome,
  dependency-cruiser, YAML, and Ajv with committed pins and a lockfile.
  State documents built-in SQLite support and an explicit unsupported fallback.
- Familiar TypeScript/JSON contracts aid AI navigation; popularity alone does not
  establish maintenance viability or compatibility of every selected version.
- Limits: Bun-specific tests and runtime bindings require explicit Node/package
  parity evidence; session administration depends on an external harness CLI/schema.
- Gap: offline setup and long-term solo-operator maintenance cost are not measured.
  Configured tracker/model requests remain expected external dependencies.
- Validation: engineering checks packed/runtime matrices on upgrades; owner reviews
  license determination and maintenance friction (RSK-007/008, XC-008/013).

### FSE-10: AI instructions and rules

- Evidence: existing. `AGENTS.md` gives package ownership, delivery gates, generated
  plugin rules, and memory trust boundaries. `.ai/rules/typescript.md` supplies
  typing/purity/error constraints; `.ai/rules/testing-strategy.md` maps changes to checks.
- The canonical prompt home and generated-plugin CI check make ownership explicit.
  Memory is advisory data, not an authority overriding rules or current evidence.
- Limits: instruction presence does not prove that agents load them, observe human
  gates, avoid stale context, or correctly interpret proposed decisions.
- Gap: current delivered exceptions and older prose need Phase 4/5 reconciliation;
  this audit does not claim framework verification is complete.
- Validation: reviewer tests instruction consistency during later phase gates and
  real deliveries; runtime compliance is not-reverified (RSK-005, XC-011).

## Bounded follow-up and pre-mortem

Failure scenario: locally green fixtures conceal provider drift; a caller treats
`merge-ready` as permission; recovery repeats an unknown external mutation; missing
guard membership is mistaken for clean content. These remain plausible despite
the substantial mechanical baseline. See [NFR collection](../../spec/nonfunctional.md).

Proposed validation assumptions, not new accepted requirements:

| ID | Assumption | risk_type | validation_status | Proposed owner / trigger |
|---|---|---|---|---|
| FSE-ASM-01 | A responsibility map can reduce change-review effort without speculative module splitting. | feasibility | unvalidated | Engineering; next status/queue-ready change, compare change reasons and isolation. |
| FSE-ASM-02 | A bounded operator/agent walkthrough exposes harmful terminology confusion. | usability | unvalidated | Owner/reviewer; pilot protocol review, record next-action errors and extra probes. |

Suggested gate topics: parser character/byte semantics, responsibility-review scope,
reference-environment performance evidence, and supported-platform validation ownership.
Route these as candidate OPEN-Q12+ questions without resolving deferred Phase 2 issues.
Read-only authoring validation passed relative-path existence, dash-character and
whitespace checks, with manual frontmatter and ten-attribute review. The focused
`bun run scripts/checks/privacy-literals.ts` working-tree scan returned zero
violations and explicitly reported both hashed classes vacuous. This checks the
configured tip scope, not unknown private literals or history. Product execution
remains not-reverified. Phase 6 must revisit gaps rather than turn this inventory into PASS.
