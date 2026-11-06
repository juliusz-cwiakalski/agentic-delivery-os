---
id: TOOLING-TECH-STACK
status: Draft
created: 2026-11-01
last_updated: 2026-11-06
owners: [engineering]
area: engineering
document_classification: working-analysis
links:
  related_decisions: [ADR-0003, TDR-0003, TDR-0004, TDR-0006, TDR-0007]
  related_changes: [GH-200, GH-222, GH-227, GH-231]
summary: "Phase 3 evidence-based OSS tooling stack inventory, decision rationale, existing alternatives, compatibility limits, and validation risks."
---

# OSS tooling tech stack

## Scope and evidence

**Phase 3 draft for human Gate 3.** Legacy reconstruction of `packages/` and its
delivery toolchain reconciled against integrated `main-tools` `5330809` on
2026-11-02 under OPEN-Q20, including closeout and verify-gates recovery. Gate 2 permits Phase 3
with OPEN-Q7..Q11 deferred. This is not technology selection or release approval.
The missing documentation profile invokes the engineering-repo fallback.

The [north star](01-north-star.md) fixes single-operator local scope and owner
attention per accepted delivery as the outcome. [Phase 2 coverage](../inception/analysis/phase-2-scope-and-coverage.md)
distinguishes merged stories, runnable behavior and milestone evidence.
[Architecture overview](architecture-overview.md) owns diagrams, module placement,
contracts and production-composition limits. Versions below are manifest facts,
not claims that every capability of the accepted architecture is delivered.

## Languages, runtimes and build

| Technology | Observed version / form | Role and rationale |
|---|---|---|
| TypeScript | `6.0.3` | Strict shared vocabulary and deterministic engines. `tsc` builds ESM JavaScript, declarations and source maps. |
| Bun | `1.4.4`, also `@types/bun` `1.4.4` | Pinned runtime/test and intended binary target; semantic core does not depend on Bun. |
| Node | `24.11.1` recorded state probe; not a root engine pin | Second-runtime state/import probes, including built-in SQLite. This is narrower than general application/OS support. |
| pnpm | `10.18.3` in `packageManager` | Dependency isolation, workspace graph and one frozen lockfile. Bun does not own dependency installation. |
| ESM | `type: module`, ESNext target/module, bundler resolution | Package exports expose `dist` plus types; CommonJS parity is not promised. |
| Bash and Markdown | Existing repository shell/prompt stack | Coexisting delivery automation and canonical agent instructions; replaced engine by engine only after parity. |

Sources: [root manifest](../../package.json), [Bun pin](../../.bun-version),
[compiler configuration](../../tsconfig.base.json), [workspace](../../pnpm-workspace.yaml),
[state runtime matrix](../spec/features/feature-state-layer.md).

Strictness includes `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, unused checks, explicit returns, override and
side-effect import checks. `skipLibCheck: true` exempts dependency declarations,
not first-party code. Runtime-neutral core excludes ambient filesystem/network,
environment, clock, randomness and timers; injected facts keep policy testable.

## Frameworks and libraries actually present

| Dependency / mechanism | Version | Implemented role |
|---|---|---|
| Ajv | `8.20.0`, core dependency | Trusted draft-07 schema generated from typed config catalog; partial-layer and final-tree validation. No coercion, inserted defaults or removed unknown keys. |
| `yaml` | `2.9.1`, adapters dependency | Position-preserving config and pm-notes parsing/staging; syntax failures are mapped to safe metadata. |
| Native `fetch` | Runtime built-in | GitHub/GitLab/Jira reads and supported GitHub/Jira closeout writes; injectable offline transport. Quota transport bounds GET/timeout and disables redirects with credentials. |
| Built-in SQLite bindings | Bun `bun:sqlite`, then Node `node:sqlite` | Optional state index. No third-party native SQLite dependency is declared. |
| Handwritten CLI parser | Local TypeScript | Injected `runCli` argument/stream boundary. No adopted CLI framework appears in the CLI dependencies. |
| JSON Schema / closed contracts | Generated and typed local schemas | Configuration, results, state, metadata and conformance vocabulary; each owns its version contract. |

Source manifests: [core](../../packages/core/package.json),
[adapters](../../packages/adapters/package.json), [CLI](../../packages/cli/package.json).
No MCP SDK or host-plugin peer is declared in the
[MCP](../../packages/mcp/package.json) or [OpenCode](../../packages/opencode/package.json)
manifests. The MCP package implements the pinned stdio JSON-RPC 2.0 subset
in-package with zero external dependencies; the OpenCode entry exports
placeholder types only. Planned library names in ADRs are not installed
dependencies or runnable surface evidence.

## Workspace and runtime boundaries

Six packages share version `0.0.0` and are all `private: true`. Core owns
contracts, domain/config/provider rules, branding and state through separate
exports. Adapters depend only on core contracts. CLI and MCP can consume the
declared core root/provider set and adapter subpaths; OpenCode has narrower
declared core imports. The MCP package ships a local stdio server
implementation, and the OpenCode entry remains a declaration. Testkit consumes
core/adapters only as dev dependencies and never enters production source or
the publish set.

Boundary enforcement combines actual dependencies, `exports`, manifest
`workspaceImports`, dependency-cruiser, entrypoint and ambient-global checks,
plus negative fixtures. Runtime APIs are admitted only at specific edges:

- Core state driver edge, not the whole state/domain/config tree.
- File, repository, session, legacy and credential adapters, plus the dedicated git seam for branch, checkout, and commit operations.
- Exact provider client subpaths GitHub/GitLab/Jira, the provider-quota transport, and the inference transport.
- CLI and OpenCode integration tiers, and the exact `packages/mcp/src/serve.ts` stdio edge, within the wider runtime/API rules.

The provider-client exceptions are implemented rules; their refining
[ADR-0005](../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md)
is still Proposed. Neither an allowed edge nor an empty exported module proves
host execution. `createRuntime` is declaration-only; working command composition
currently lives in CLI `edge.ts`, with optional ports supplied by its caller.
Production closeout composition bridges raw clients, real git and StateStorePort;
verify supports both `change` and `gates` after PR #217. CLI `bin` remains absent.

Sources: [boundary configuration](../../.dependency-cruiser.cjs),
[entrypoint guard](../../scripts/checks/workspace-entrypoints.ts),
[ambient guard](../../scripts/checks/ambient-globals.ts),
[composition declaration test](../../tests/structure/create-runtime.test.ts).

## Configuration and naming

Seven ascending layers: **defaults, system, user-global, project-committed,
project-local, environment, CLI**. Selected files occupy the project-committed
slot. Maps merge recursively, lists replace, explicit reset removes inherited
values/origins. Loaded/skipped sources and effective-node provenance are visible.
CI disables system/user/local files by default, with independent opt-ins.

Ordinary production configuration currently declares the provider branch.
The shipped default descriptor does not supply a usable default chain; an
operator must configure one. Test extension catalogs do not make additional
production settings shipped. Repository files cannot inject credentials or
machine paths, and interpolation is rejected. See [config feature](../spec/features/feature-config-layer.md).

Branding is pure and resolved before discovery: binary/product names,
environment prefix and configuration directory derive from one identity.
Runtime edges supply overrides as data; legacy mapping remains isolated.
The [literal registry/check](../../scripts/checks/forbidden-literals.ts) and
rename drill guard the seam. Deferred document membership routing remains
OPEN-Q11; absent registry membership must not be described as a clean scan.

## Datastores and data lifecycle

| Store / artifact | Actual ownership and behavior | Constraint / uncertainty |
|---|---|---|
| Schema-versioned JSONL ledger | Local durable truth; framed records with sequence/checksum; verified reads with torn and unknown classification, explicit terminal-tail repair, guided tail salvage with quarantine, fail-closed writes, and single-writer fences. | Only `local` level implemented. Full-history verification costs grow with history; checksum detects corruption, not adversarial tampering. |
| Optional SQLite index | Disposable derived rows over the same verified JSONL; rebuild on missing/corrupt/divergent index. | Every indexed read still verifies the ledger; no asymptotic read-scaling claim. Missing binding fails visibly, not silent in-memory fallback. |
| Derived JSON documents | Phase/provider projections, ledger-first then atomic replacement. | Rebuildable outputs are not another source of truth. A landed intent and failed projection are different outcomes. |
| Closeout operation history | Verified `closeout.operation` records, deterministic identities, fenced appends, terminal reuse and failed-outcome retry. | Real replay substrate, not a separate write-ahead-intent protocol or evidence of live crash convergence. |
| Committed pm-notes YAML | Change evidence read by lint/verify and updated by phase workflow. | Completeness is not external gate truth; ledger/document reconciliation remains explicit. |
| OpenCode session database | Upstream-owned SQLite/WAL inspected via the official CLI adapter. | Metadata-only read/admin contract; prune uses official session deletion, checkpoint requires zero live sessions. Not direct arbitrary DB mutation. |
| Conformance artifacts | Schema-versioned mock/live reports; scheduled workflow uploads read evidence. | Not a durable task queue or an end-to-end delivery ledger. |

[State implementation](../../packages/core/src/state/index.ts) and
[strategies](../../packages/core/src/state/driver/strategy.ts) implement both
JSONL-scan and SQLite-index kinds today.
[TDR-0004](../decisions/TDR-0004-state-storage-engine.md) remains Proposed;
its status does not erase implementation, and its recommendation does not
establish human acceptance. Retention direction is forever under Accepted
ADR-0003; no automatic pruning/retention engine or general export/erasure sink
is established. Project/global state levels are vocabulary only.

POSIX creation/open checks require directory `0700` and files `0600`. Windows
has an `icacls` branch with fail-closed verification, but real Windows evidence
is explicitly platform-conditional. Config path mappings for Linux/macOS/Windows
and Node import probes do not demonstrate all three operating systems tested.

## Failure, security and privacy mechanisms

- Internal `Result<T,E>` is distinct from surface `CommandResult`. Handlers
  return data/errors; only the CLI entry serializes. Under `--json`, one envelope
  carries exactly one of `data` or `error`, plus version/run/timing/exit fields.
- Declared domain kind/code resolves through the fixed error table; unknown or
  malformed failures become `fallback.internal`. Raw exceptions are not output.
  Only CLI projects numeric 0/1/2. Ledger result-token parity is distinct from
  bash numeric parity, including the documented `state-unverified` divergence.
- The credential port resolves declared references; secret material is not
  config data or diagnostics. The secret-read check has exact, reason-bearing
  configuration/identity exceptions. Registered-value CLI redaction is a final
  output boundary, not proof of universal secret discovery.
- Privacy guard scans tracked plus non-ignored untracked working-tree files
  through git enumeration, not history. The metadata emitter requires a content
  policy over exact compact JSON with shared generic rules and hashed entries;
  violations report rule/entry identity without echoing matched content.
  Both project-specific hashed-entry classes are currently empty and explicitly
  reported as vacuous; generic-rule coverage does not fill that gap.
- Capability declarations distinguish supported operations from explicit gaps.
  Missing comments/activity are unknown, not invented emptiness. Current provider
  mock conformance executes supported production writes. GitLab write gaps remain;
  live conformance is read-only, not live-write parity or create/teardown evidence.

Sources: [result](../../packages/core/src/contracts/result.ts),
[classification](../../packages/cli/src/classify.ts), [serialization](../../packages/cli/src/output/serialize.ts),
[secret boundary](../../scripts/checks/secret-read-boundary.ts),
[privacy feature](../spec/features/feature-privacy-guard.md),
[conformance feature](../spec/features/feature-adapter-conformance.md).

## Delivery, quality and observability tooling

| Tool / mechanism | Version / form | Current role and boundary |
|---|---|---|
| Biome | `2.6.4` | TS/workspace lint and format gates. Markdown overviews are outside its configured includes. |
| dependency-cruiser | `18.7.0` | Package/subpath/tier/runtime-import restrictions, alongside AST guards and negative fixtures. |
| `bun:test` | Pinned Bun | Structure, boundaries, behavior, golden outputs, checks and conformance. Most replay is injected/offline. |
| publint / attw | `0.3.25` / `0.18.5` | Built package/export/type checks with explicit ESM-only profile. |
| Changesets | `3.0.3` | Fixed version group for five intended publishables; testkit excluded. Current manifests still block publication. |
| commitlint / Husky | `21.2.4` / `9.1.7` | Conventional commit workflow and local hooks. Git history is review evidence, not implementation proof. |
| GitHub Actions | Committed workflows | Separate TypeScript gates alongside existing shell/plugin checks, Linux runners, scheduled live read-only conformance. |
| License/vulnerability guards | Local checks and YAML registry | Binding dependency-policy/deny checks and vulnerability baseline; human license determination is separate. |

`pnpm check` aggregates lint, format, typecheck, tests, boundaries and export
parity; CI also runs separate privacy, licensing, supply-chain, branding and pin
checks. It is not accurate to equate the aggregate with every repository gate.
The [CI workflow](../../.github/workflows/ci.yml) pins TypeScript job actions,
while some legacy jobs retain floating action references; no global SHA-pin
completion is inferred. [Release workflow](../../.github/workflows/release.yml)
is manual and publish-guarded, with package build/publish steps, not an implemented
signed standalone binary/MCP artifact pipeline. No deployment cluster is present.

Observability is local structured evidence: command run IDs/timing, classified
errors, ledger records, parks/announcements and conformance artifacts. The
[measurement baseline](../planning/oss-tooling/measurement-baseline.yaml) is
PARTIAL proxy data, not direct owner attention. No integrated metrics service,
distributed tracing backend or production dashboard is established.
[Scheduled live conformance](../../.github/workflows/conformance-live.yml) provides
infrastructure, not proof of configured successful live runs. Production client
factories run against mocks; unsupported writes are explicit gaps, and live
mutations/create-teardown remain deferred.

## Rationale and critical comparison of existing choices

[ADR-0003](../decisions/ADR-0003-oss-monorepo-structure.md) is Accepted: typed
boundaries, one repository, one lockstep line, injected runtime seams and
wrapper-based strangler delivery minimize duplicated behavior while retaining
fallback. Config provenance makes precedence explainable; JSONL truth keeps
state auditable; optional built-ins avoid a native dependency installation axis.

The following are three approaches already compared in ADR-0003, critically
assessed against the reconstructed tree. Costs are qualitative, not estimates.
This does not reopen the accepted stack or recommend a migration.

| Existing approach | Build/maintenance cost | Scalability | Trade-offs and when appropriate |
|---|---|---|---|
| Chosen six-package pnpm/TypeScript workspace, Bun target | Moderate: six manifests plus pnpm/Bun pins and boundary fixtures. Composition remains unfinished, so reuse benefit is not fully realized. | Good organizational seams for adapters/surfaces; local single-writer state and full scans remain operational limits. | Fits multiple intended consumers and engine-by-engine migration. Shared contract hotspots and one adapter dependency closure still need discipline. |
| ADR Alt 2: one tiered TypeScript package | Lower initial manifest/release overhead; extraction later costs more. | Adequate for a small single-surface tool, with weaker package/export isolation as consumers multiply. | Appropriate when one deployable/dependency closure is enough; this project chose stronger boundaries over first-slice simplicity. |
| ADR Alt 4: per-tier/per-provider packages | Highest manifest, type-churn and release coordination cost. | Better dependency isolation and independent extraction, not faster local ledger reads. | Appropriate with demonstrated independent consumers, heavy optional dependencies or distinct release cadences. No such change is authorized by this draft. |

## Full-stack environment audit, bounded to evidence

| AI-friendly attribute | Observed evidence / qualification |
|---|---|
| Explicit typing | Strict TS, normalized contracts and schema checks; untrusted transport bodies remain `unknown`. |
| Single-responsibility modules | Policy/I/O/presentation separation is visible; shared composition and app tier remain placeholders. |
| Conventions over configuration | Predictable six-package tree, one lockfile and common scripts; seven config layers add intentional operator complexity. |
| Semantic naming | Primitive names and hierarchical errors; naming seam guarded, document membership reconciliation deferred. |
| Automated tests | Negative fixtures, behavior/golden tests and capability conformance exist; test presence is not live-write or pilot success. |
| Linters/formatters | Biome and boundary/AST gates configured; overview prose requires separate review. |
| Readable Git history | Conventional subjects are visible; GH-178 demonstrates why commit subject/closure alone is insufficient evidence. |
| Contextual comments | Injection/purity/fault contracts documented near code; declaration-only modules must still be checked directly. |
| Familiar technology | TypeScript, pnpm, YAML and SQLite are recognizable; Bun pin and Node SQLite compatibility still need explicit probes. |
| AI instructions/rules | `AGENTS.md` and language/testing rules exist; prompt framework remains a separate coexisting execution stack. |

## Four-risk check

These validation proposals extend interpretation, not the registers or backlog.
Owners/triggers remain proposals in [assumptions](../inception/analysis/assumptions.md)
and [risks](../inception/analysis/risks.md#evidence-and-review-triggers).

| Risk type | Architecture concern | Proposed validation and register link |
|---|---|---|
| Value | Six packages and more truthful probes might not reduce owner attention. | Compare attention/interventions per accepted delivery, bypasses and rework, not proxy timing alone. ASM-001/002, RSK-001. |
| Usability | Bounded unknown/truncated/parked results and ledger completeness can be misread as merge permission. | Operator/agent J1 walkthrough with stale CI, incomplete ledger and missing observations; record extra probes. ASM-003/004, RSK-002/009. |
| Feasibility | Command-specific closeout and verify gates exist; shared composition and live convergence remain unproven. | Verify integrated capability matrix, interrupted-step replay and artifact-backed dual-run exposure; benchmark growing ledger/fence contention. ASM-005/006/010, RSK-003/004/005. |
| Viability | Local upkeep, dependency policy and privacy work may cost more than relief. | Measure maintenance friction; rerun canary/negative controls on boundary changes and reconcile owner determinations. ASM-008/009, RSK-006/007/008. |

## Compatibility, confidence and review triggers

- **High confidence:** manifest versions, placeholder exports, JSONL/index
  mechanics, optional CLI registration and supported write/capability boundaries.
  Sources and tests were inspected; runtime success is not inferred from declarations.
- **Medium confidence:** portability beyond recorded Bun/Node probes and local
  state operational behavior. Real Windows ACL verification and sustained history
  growth remain explicit uncertainty flags; macOS test coverage is not established.
- **Low confidence:** production cross-surface parity, live mutation convergence,
  attention relief and public distribution readiness. The implementation gaps in
  [architecture](architecture-overview.md#shipped-versus-planned-behavior) remain.
- Keep Bun's source pin, root engine/types, CI and release copies aligned through
  the pin-equality check. Upgrade pnpm/lockfile together; rebuild before cruising
  package-name imports because `exports` resolve to `dist`.
- Runtime/SQLite upgrades require packed Node/Bun probes for both driver kinds;
  no silent fallback or promotion of the derived index to truth. Contract/schema
  changes need version and compatibility evidence, including emitter privacy tests.
- ADR-0003 is Accepted; TDR-0003/0004/0006/0007 and refining implementation ADRs
  remain Proposed. Existing harness/release decisions are separately audited;
  no duplicate decisions or ratification is created here. Later work requires Gate 3.

Draft verification: frontmatter parses, relative source links resolve and the
privacy scan reports zero violations, with empty-class coverage explicit. The
branding guard's historical failure and authorized exact membership remediation
are tracked in the Phase 6 report; this document claims no broad green battery.
