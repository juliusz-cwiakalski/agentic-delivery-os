---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/decisions/ADR-0003-oss-monorepo-structure.md
id: ADR-0003
decision_type: adr
status: Proposed
created: 2026-10-23
decision_date: null
last_updated: 2026-10-23
summary: "Adopt a root packages/ Bun-workspace monorepo: a contracts leaf, a core package with internal ports-and-adapters tiers, thin cli/mcp surfaces, provider adapters, a local JSONL+SQLite state store, a branding seam, and a dev-only testkit; keep the existing .opencode/scripts/tools/doc layout and migrate by strangler."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os
decision_area: architecture
decision_scope: org
reversibility: moderate
review_date: null
business_impact: "Unblocks the committed M0-M3 TypeScript delivery tooling while isolating change from the running bash stack; makes the public rename a constants change instead of a migration program."
customer_impact: "ADOS users gain a deterministic CLI and MCP surface with stable contracts; existing behavior is preserved until each engine passes parity."
classification:
  domains: [architecture, operations, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: medium
  uncertainty: medium
  blast_radius: org
  recurrence: one-off
governance:
  driver: "@decision-advisor"
  decider: "Juliusz Ćwiąkalski"
  contributors:
    - "Juliusz Ćwiąkalski (owner constraints and prior decisions)"
  reviewers: []
  performers:
    - "@coder"
  informed:
    - "ADOS users"
ai_assistance:
  used: true
  roles: [researcher, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A package needs an independent release cadence, a heavy optional dependency, or a separate build target (split the adapters or providers package)"
  - "External consumers need published TypeScript libraries, forcing a branded publish manifest and a versioning tool"
  - "The MCP host or a consumer requires Node-only APIs that the contracts/core runtime-neutral rule forbids"
  - "The naming freeze lands and the branding constants change; the rename drill must pass without code archaeology"
  - "Bash parity is reached for an engine and the old tool is removed; revisit the coexistence and distribution sections"
  - "The contracts package grows beyond cross-package types and becomes a dumping ground; revisit the core/contracts split"
links:
  related_changes: ["GH-49"]
  supersedes: []
  superseded_by: []
  spec: []
  contracts: []
  diagrams: []
  decisions: ["ADR-0001", "ADR-0002"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# ADR-0003: OSS Tooling Monorepo Structure

## Context

ADOS currently delivers its own changes with a bash stack: `scripts/` (delivery automation), `tools/` (PATH utilities), `.opencode/` (canonical agent and command definitions, which are the product), and `doc/` (spec, decisions, guides). The committed delivery scope for the open-source part is milestones M0-M3: a TypeScript CLI plus MCP plus opencode integration that replaces the bash delivery stack engine by engine using a strangler pattern. Cloud work is not committed and must not appear in committed files.

The owner has decided that the OSS part is one monorepo covering processes, tooling, scripting, agents, and docs; a root `packages/` layout is acceptable. The exact structure is the open question. The existing root layout must stay: `.opencode/` remains canonical, `.ados-claude/` remains generated, `scripts/` and `tools/` keep running until the new engines replace them, and `doc/` remains the documentation home. Delivery goes through ADOS itself, and pull requests target `main-tools`.

The pattern source is the marksync-for-confluence repository: a single package with a strict tiered `src/` tree, a pinned Bun runtime, strict TypeScript, Biome, commitlint plus husky, dependency-cruiser boundaries, a `CommandResult` envelope, a stable exit-code table, tiered tests, and a release pipeline with a single binary and SBOM. That template is proven, but it is single-package. ADOS is a monorepo, so the tier boundaries must map to packages rather than one `src/` tree. A literal copy would either collapse the monorepo into one package or create an unenforced package graph.

Two facts make this decision urgent:

- The M0 scaffold is the first implementation step. Package boundaries set precedent for every later engine, adapter, and surface.
- The naming firewall is a hard constraint. The brand is not frozen, and renaming after packages, binaries, environment variables, MCP tools, and telemetry schemas are public is a migration program. The structure must make the rename mechanical.

Prior decisions constrain the answer: ADR-0001 established proportional decision records and bounded AI authority; ADR-0002 established the readiness gate. The GH-49 design work decided TypeScript, one shared core with CLI and MCP as surfaces, provider-agnostic adapters, and local-first operational state. This record decides the repository and package structure that makes those decisions enforceable.

## Problem Framing (Clarified)

The root problem is not "which folder names look tidy." It is that the new TypeScript tooling needs explicit, mechanically enforced contracts while it coexists with a running bash stack and an unfrozen brand.

The bash stack encodes its contracts in scripts, convention, and operator memory. That was sufficient for a solo operator and a small tool set. It is not sufficient for a CLI and an MCP server that share one core, several provider adapters, a persistent local state store, and a rename that must not require archaeology. Without package boundaries, the following failures are likely:

- Surfaces reach into core internals, so MCP and CLI drift into separate behavior.
- Provider quirks leak into core rules, so adapters cannot be replaced or added safely.
- Persistence and telemetry formats couple to command implementations, so cloud ingestion later requires migration.
- The brand appears in package names, environment variables, config paths, MCP tool names, and telemetry event names, so renaming is a repository-wide search-and-replace with broken consumers.
- The new stack grows inside the bash tree with no ownership boundary, so removing old tools becomes a big-bang instead of a strangler.

The decision question is: what package set and dependency rules give the strongest isolation, testability, and rename safety at the lowest cognitive cost for one developer orchestrating AI agents, while preserving the existing repository and the running bash stack?

Desired outcomes:

- One install, build, test, and release workflow for the TypeScript tooling.
- Enforceable boundaries between contracts, core, persistence, adapters, and surfaces.
- One shared implementation for CLI and MCP, with no logic in either surface.
- Provider adapters that are replaceable and testable without live credentials.
- A local state format that a future cloud sink can consume without a migration.
- A rename that changes branding constants, not behavior.
- A strangler path that keeps the bash stack authoritative until parity.

Out of scope: cloud services, pricing, final brand selection, provider-specific API design beyond the adapter contract, and the contents of the M0-M3 roadmap. Those are separate decisions or later work.

## Constraints (Hard Requirements)

### C-1: One OSS monorepo for the committed scope

- **Statement:** The committed M0-M3 tooling must live in this repository as one OSS monorepo; no sibling CLI repository and no cloud code in committed files.
- **Source:** owner decision (2026-10-23)
- **Verification:** code review and repository layout audit
- **Negotiable:** no

### C-2: Apache-2.0 with an enforced dependency license gate and SBOM

- **Statement:** The repository remains Apache-2.0; CI must block GPL, AGPL, and UNLICENSED dependencies; any LGPL or otherwise ambiguous dependency requires a recorded human compatibility determination before adoption; every release must attach an SBOM and checksums.
- **Source:** owner decision and internal standard
- **Verification:** CI (license audit, SBOM generation, checksum verification)
- **Negotiable:** no

### C-3: Naming firewall with a tested rename seam

- **Statement:** No new code or new user-facing documentation may hardcode a product name outside the branding module and the legacy compatibility adapter; decision records may name the current project when describing context. A forbidden-literal test over product surfaces and a rename drill must pass.
- **Source:** owner decision (naming firewall)
- **Verification:** test (forbidden-literal scan and rename drill)
- **Negotiable:** no

### C-4: OSS-only committed artifacts

- **Statement:** Committed files must contain no cloud names, cloud designs, pricing, private references, or proprietary implementation.
- **Source:** AGENTS.md and owner decision
- **Verification:** audit and code review
- **Negotiable:** no

### C-5: Coexistence and strangler migration

- **Statement:** The existing `.opencode/`, `scripts/`, `tools/`, and `doc/` layout must remain; the bash stack keeps running until a replacement engine passes parity; old tools are removed only at the last stage with a deprecation notice.
- **Source:** owner decision and AGENTS.md branch model
- **Verification:** code review and dual-run parity tests
- **Negotiable:** no

### C-6: Single source of truth for agent and command definitions

- **Statement:** `.opencode/` remains canonical; `.ados-claude/` remains generated; no hand edits to generated artifacts; CI verifies freshness.
- **Source:** AGENTS.md
- **Verification:** CI (generated plugin freshness)
- **Negotiable:** no

### C-7: Distribution registration

- **Statement:** Any installable artifact must be registered in `scripts/install.sh` (an explicit array or install path) and verified; no unregistered delivery artifact may be installed by users.
- **Source:** AGENTS.md
- **Verification:** test and audit of the install set
- **Negotiable:** no

### C-8: Running gates never weaken during migration

- **Statement:** The bash gates remain authoritative until the replacement engine passes the same parity suite; no gate is relaxed or removed early.
- **Source:** owner decision (strangler sequencing)
- **Verification:** code review and parity test results
- **Negotiable:** no

> **Table-stakes:** All non-rejected alternatives are git-native, keep secrets out of committed files, introduce no proprietary runtime, and deliver through pull requests to `main-tools`. These are acknowledged once, not repeated per alternative.

## Decision Drivers

**Business drivers:**

- **Time to first slice.** M0 must produce a usable TypeScript core quickly; structure must not become a construction project. *(high weight)*
- **Public release readiness.** The first public release must have a cheap rename, a clean OSS boundary, and a credible install story. *(high weight)*
- **Solo-developer efficiency.** One person orchestrates AI agents; every extra package, manifest, and version axis is attention spent outside shipping. *(high weight)*

**Technical drivers:**

- **Boundary enforcement.** Surfaces cannot reach core internals; adapters cannot leak provider types into core; persistence cannot couple to command code. *(highest weight)*
- **Testability.** Core rules must be testable without network or credentials; adapters need fakes, trap catalogs, and a conformance suite. *(high weight)*
- **Replaceability and future extraction.** An adapter or surface can be replaced or extracted without rewriting core. *(medium-high weight)*
- **Determinism and reproducibility.** Pinned runtime, one lockfile, strict type checking, and binding CI gates. *(high weight)*

**Operational drivers:**

- **Strangler coexistence.** The bash stack keeps delivering while the new stack runs beside it. *(high weight)*
- **Release simplicity.** One version, one release tag, one binary plus an MCP artifact, checksums and SBOM. *(medium-high weight)*
- **Rename safety.** The brand is a configuration seam, not a distributed literal. *(high weight)*
- **Agent legibility.** Package names and rules must let an AI agent place new code correctly without guessing. *(medium weight)*

**Ranked:** boundary enforcement; solo-developer efficiency; strangler coexistence; rename safety; testability; determinism; release simplicity; future extraction; agent legibility; time to first slice.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` - coordinates the analysis and drafts this record.
- **Decider / Approver:** Juliusz Ćwiąkalski - the one accountable human authority. AI does not accept this record.
- **Contributors:** Juliusz Ćwiąkalski (owner constraints and prior decisions); marksync-for-confluence (pattern evidence); `@decision-critic` (recommended independent challenge before acceptance).
- **Required reviewers:** none mandated at R2; owner review before merge. An independent `@decision-critic` pass is recommended because the decision sets long-lived precedent.
- **Performers:** `@coder` for the scaffold and engine delivery; `@toolsmith` only if a later change touches agent or command definitions, which this decision does not.
- **Informed:** ADOS users and ADOS agents (through the committed architecture and spec documentation).

The record stays `Proposed` until the owner explicitly accepts it. `decision_date` remains null until then.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| Committed scope is OSS M0-M3; cloud work is deferred and must not appear in committed files. | FACT | Owner decision, 2026-10-23 | The package set would need cloud packages or private boundaries now; the OSS-only constraint would be wrong. | High |
| The existing root layout stays and the bash stack runs until parity. | FACT | AGENTS.md and owner decision | Structure would need to move or replace existing directories; the strangler plan would change. | High |
| marksync-for-confluence is a single package with a tiered `src/` tree and four dependency-cruiser rules. | FACT | Local evaluation of the marksync repository, 2026-10-23 (`package.json`, `tsconfig.json`, `.dependency-cruiser.cjs`, `src/`) | The adaptation analysis would be based on a false template; package mapping could be simpler than assumed. | High |
| The four marksync dependency-cruiser rules do not enforce the full stated matrix: `infra -> app`, `app -> presentation`, and sibling-surface edges are unguarded. | FACT | marksync `.dependency-cruiser.cjs` read on 2026-10-23 | Copying the rules verbatim would leave real boundary gaps; the enforcement claim would be overstated. | High |
| marksync's application tier performs file I/O (`node:fs`) in journal and cache code. | FACT | marksync `src/app/journal.ts` and `src/app/cache.ts` read on 2026-10-23 | A literal port would make the application tier impure and harder to test; I/O placement must be decided. | High |
| marksync's journal silently skips malformed JSONL lines. | FACT | marksync `src/app/journal.ts` read on 2026-10-23 | A literal port would create lying state; ADOS needs hard failure and quarantine. | High |
| Bun 1.2.23 is pinned and proven in marksync CI and release builds. | FACT | marksync `package.json` and `.github/workflows/` read on 2026-10-23 | The initial runtime pin would need a different proven baseline. | Medium |
| Bun's `bun:sqlite` and single-binary compile are suitable for the state store and CLI packaging. | ASSUMPTION | marksync release evidence and Bun platform knowledge; no ADOS spike yet | The state store would need a different driver or a Node-compatible fallback. | Medium |
| The MCP SDK runs under a Bun-compiled binary or a Bun-hosted process. | TO-CONFIRM | No ADOS spike yet | MCP packaging could require a Node entry point or a separate distribution artifact. | Low |
| No external consumers need published TypeScript libraries during M0-M3; a neutral private workspace scope is acceptable. | ASSUMPTION | Owner scope and M0-M3 deliverables | If false, package names and publishing need a branded manifest transform earlier. | Medium |
| License compatibility of candidate dependencies (MCP SDK, Cliffy, ajv, Biome, test and release tools) is not determined here. | TO-CONFIRM | Human legal/license review is required; this record does not conclude compatibility | A dependency could be disallowed, changing the toolchain or adapter design. | High |
| The existing bash tests and CI can run alongside new TypeScript jobs. | ASSUMPTION | `.github/workflows/ci.yml` and `scripts/test-all.sh` read on 2026-10-23; no combined run yet | Dual-run would need a different CI topology. | Medium |
| The legacy bash exit-code convention (0-9, 100) differs from the marksync ten-class table. | FACT | `doc/guides/tools-convention.md` and marksync `src/cli/output/exit-codes.ts` | The new CLI could inherit inconsistent exit semantics; docs and consumers would diverge. | Medium |
| The exact forbidden literal set for the naming test is not frozen because the brand is open. | TO-CONFIRM | Naming firewall decision, brand pending | The test could be too narrow or too broad; the rename drill scope would change. | Medium |

## Mental Models & Techniques Used

- **First principles:** What must be isolated for the tooling to remain correct under change? Contracts, pure rules, provider integrations, persistence, surfaces, and names. The package set follows those seams, not org-chart or aesthetic preferences.
- **Separation of concerns / ports and adapters:** Domain rules know nothing about HTTP, files, SQLite, or CLI flags. Application use cases orchestrate through ports. Adapters implement ports. Surfaces translate input and output.
- **Inversion:** What would make this monorepo fail? Ungoverned cross-package imports, a bloated contracts package, duplicated utilities, package sprawl, advisory CI that everyone ignores, and a rename that touches every file. The structure and enforcement target those failure modes.
- **Second-order thinking:** Package boundaries are cheap before publication and expensive after. The cost of one extra package now is small; the cost of extracting a surface after users depend on a monolithic package is large.
- **Opportunity cost and cognitive load:** Every package adds a manifest, a test target, a version, and a place for an agent to make a mistake. The chosen set maximizes isolation per package rather than minimizing package count absolutely.
- **Strangler pattern:** New engines run beside the bash stack with dual-run parity; authority transfers only when the new signal is proven. Structure must be additive.
- **Pareto:** A small number of well-placed boundaries captures most of the isolation benefit. Twelve packages would enforce more edges but cost more attention than the solo developer can repay.
- **Reversibility:** Before the first public release, package boundaries are moderate to reverse. After package names, config paths, and telemetry schemas are public, reversal is hard. The decision front-loads the rename seam.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| Alternative | C-1 monorepo | C-2 license | C-3 firewall | C-4 OSS-only | C-5 coexist | C-6 `.opencode` | C-7 install | C-8 gates |
|-------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Alt 0 - Do nothing / bash only | No | Yes | Yes (no new code) | Yes | Yes | Yes | Yes | Yes |
| Alt 1 - Root `packages/` with eight packages (chosen) | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Alt 2 - Single package with tiered `src/` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Alt 3 - `tooling/` subtree monorepo | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Alt 4 - Maximal per-tier packages | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Alt 5 - Sibling CLI repository | No | Yes | Yes | Yes | Yes | Yes | Risk | Risk |

Legend: `Yes` = passes; `No` = fails a non-negotiable constraint; `Risk` = possible but weaker and dependent on cross-repository coordination. Alt 0 fails C-1 because it does not deliver the committed TypeScript monorepo. Alt 5 fails C-1 (one OSS monorepo) and puts C-7/C-8 at risk because installation and gate parity would span repositories.

### Alternative 0 - Do Nothing / Keep the Bash-Only Stack

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Continue with the bash delivery stack and add no TypeScript monorepo.
- **Constraint compliance:** Fails C-1; satisfies the remaining constraints vacuously or by inaction.
- **Driver fit:** Lowest on every driver except short-term cost; no boundary enforcement, no shared core for CLI and MCP, no state schema, no rename seam.
- **Pros:** Zero migration cost; no new toolchain; no new CI jobs.
- **Cons:** The committed M0-M3 scope is undeliverable; bash contracts remain implicit; the rename risk grows with every new script; MCP and CLI cannot share a typed core.
- **Why rejected:** It does not satisfy the committed scope. This is the baseline, not a viable option.

### Alternative 1 - Root `packages/` Monorepo with Eight Packages (Chosen)

- **Eligibility:** Eligible (passes C-1 through C-8).
- **Summary:** Add a root Bun workspace under `packages/` with `contracts`, `branding`, `core`, `state`, `adapters`, `cli`, `mcp`, and `testkit`. Keep the tier matrix inside `core` (`domain`, `app`, `config`) and enforce package-level edges with package exports, dependency-cruiser, and negative tests. Compose surfaces at the edge; core never imports adapters, state, or branding.
- **Constraint compliance:** Passes all constraints. C-1 is satisfied by one additive monorepo. C-2 and C-7 are explicit CI/install work. C-3 is satisfied by the branding package, neutral workspace scope, forbidden-literal test, and rename drill. C-4 is satisfied because no cloud package exists. C-5 and C-6 are satisfied because nothing moves. C-8 is satisfied by dual-run parity and binding gates.
- **Driver fit:** Best on boundary enforcement, testability, rename safety, and future extraction, while keeping the package count at eight. The contracts leaf removes the need for adapters to import core. Composition roots keep branding and provider wiring at the edge.
- **Pros:** Clear homes for every artifact class; one shared core for CLI and MCP; adapters depend only on contracts, not on core; state is replaceable; branding is injected, not imported by core; testkit is dev-only; a future split of adapters or providers has an obvious seam.
- **Cons:** Eight packages is more than one; workspace tooling and lockstep versioning add ceremony; `contracts` can become a dumping ground without review discipline; a single adapters package can accumulate dependency weight; composition wiring is duplicated in `cli` and `mcp` until it justifies extraction.
- **Why chosen:** It is the smallest package set that makes the important boundaries mechanical and keeps the rename seam at the edge. It passes every constraint and wins on the highest-weighted drivers.

### Alternative 2 - Single Package with a Tiered `src/` Tree

- **Eligibility:** Eligible (passes C-1 through C-8).
- **Summary:** Copy the marksync single-package shape into the ADOS repository: one root package, `src/domain`, `src/app`, `src/cli`, `src/infra`, `src/shared`, with dependency-cruiser enforcing tiers inside one tree.
- **Constraint compliance:** Passes all constraints on paper. C-1 is satisfied because it is one repository; C-3 is satisfiable with a branding module inside the package; C-7 is satisfiable with one binary artifact.
- **Driver fit:** Strong on time to first slice and simplicity, weak on boundary enforcement, adapter replaceability, MCP/CLI isolation, and future extraction. MCP and CLI would share one dependency graph and one package boundary.
- **Pros:** Fastest M0 scaffold; one manifest, one lockfile, one tsconfig, one test target; proven by marksync; the least new tooling.
- **Cons:** No package-level enforcement between surfaces, adapters, and state; MCP SDK and provider dependencies live in the same package as core; a surface can import `src/infra` unless a rule catches it; branding and forbidden-literal allowlists become broad; extracting a package later is a refactor across the tree.
- **Why rejected:** It satisfies the constraints but loses on the highest-weighted drivers: boundary enforcement, testability of surfaces, and future extraction. It optimizes the first month at the expense of the next year.

### Alternative 3 - `tooling/` Subtree Monorepo

- **Eligibility:** Eligible (passes C-1 through C-8).
- **Summary:** Keep the repository root as-is and place the workspace under `tooling/` with `tooling/packages/*`, `tooling/package.json`, and `tooling/tsconfig.base.json`.
- **Constraint compliance:** Passes all constraints. Installation and CI can point into the subtree.
- **Driver fit:** Slightly better root cleanliness than Alt 1, worse on cognitive load, tool discovery, and standard tooling behavior.
- **Pros:** The root stays visually clean; the new tooling is grouped under one obvious directory; existing docs and scripts are untouched.
- **Cons:** Adds a second concept (`tooling/packages` versus `packages`); workspace root is nested, so root-level scripts, lockfiles, IDE discovery, and CI paths are nonstandard; install and documentation paths get longer; agents must learn a layout that buys no boundary or testing benefit.
- **Why rejected:** It passes the constraints but loses on the cognitive-load and agent-legibility drivers without improving isolation.

### Alternative 4 - Maximal Per-Tier Packages

- **Eligibility:** Eligible (passes C-1 through C-8).
- **Summary:** Make every tier and every provider its own package: `contracts`, `domain`, `app`, `ports`, `config`, `state`, `adapters-gitlab`, `adapters-jira`, `adapters-github`, `adapters-azure`, `cli`, `mcp`, `testkit`, and so on.
- **Constraint compliance:** Passes all constraints; gives the strongest possible package-level enforcement.
- **Driver fit:** Best on isolation and independent versioning, worst on cognitive load, package count, and cross-package type churn for a solo developer.
- **Pros:** Every edge is explicit; adapters can version and publish independently; dependency weight is minimal per package; extraction is trivial.
- **Cons:** Twelve or more packages for one developer; cross-package type changes ripple through manifests and releases; a version matrix appears before there are external consumers; import ceremony and CI matrix cost grow faster than value.
- **Why rejected:** It over-fragments. The chosen set captures the high-value seams while keeping the core tiers inside one package, where they are still enforced.

### Alternative 5 - Sibling CLI Repository

- **Eligibility:** Not eligible (fails C-1; C-7 and C-8 at risk).
- **Summary:** Keep the methodology repository as-is and create a separate repository for the TypeScript CLI, MCP server, and adapters.
- **Constraint compliance:** Fails C-1 (one OSS monorepo). Installation would span repositories, and gate parity would need cross-repository coordination, putting C-7 and C-8 at risk.
- **Driver fit:** Good on independent release cadence and a clean public narrative; poor on strangler coexistence, dual-run testing, and one-PR changes across tooling and process.
- **Pros:** Independent semver and release cadence; the methodology repository stays Markdown and bash; a clean product narrative is easier.
- **Cons:** Two PR flows and two CI systems; cross-repository changes for a single engine; install.sh in the methodology repository would fetch artifacts from another repository; the naming firewall spans two repositories; the strangler dual-run is harder to keep honest.
- **Why rejected:** It violates the one-monorepo constraint and weakens the coexistence gates that make the strangler safe.

## Decision

**Adopt Alternative 1.** Add a root `packages/` Bun workspace with eight packages, keep the tier matrix inside `core`, keep adapter and surface boundaries at package level, and keep the existing repository layout in place. The decision is recorded as nine sub-decisions, each with the options considered and the recommendation.

### DEC-1 - Repository structure: root `packages/` with eight packages

**Options considered:**

- Alt 0: do nothing (rejected, C-1).
- Alt 1: root `packages/` with eight packages (chosen).
- Alt 2: single package with tiered `src/` (rejected on drivers).
- Alt 3: `tooling/` subtree (rejected on cognitive load).
- Alt 4: maximal per-tier packages (rejected on over-fragmentation).
- Alt 5: sibling repository (rejected, C-1).

**Recommendation:** Use the following package set and names. All packages are private workspace packages with a neutral scope; no package is published during M0-M3.

```text
packages/
  contracts/      Result, errors, exit codes, CommandResult, event schema,
                  port interfaces, BrandIdentity type, pure redaction
  branding/       The only current product-name source; BrandIdentity value
  core/           Domain + application + config resolution
    src/domain/   Pure rules; no I/O; no runtime APIs
    src/app/      Use-case orchestration; no I/O; ports injected
    src/config/   Schema, TypeScript defaults, merge and validate; no I/O
  state/          Append-only JSONL event log + SQLite indexes + writer lock
  adapters/       GitLab, Jira, GitHub, Azure, Git, LLM providers,
                  config sources, legacy compatibility adapter
  cli/            Cliffy presentation + composition root
  mcp/            Minimal MCP surface + composition root
  testkit/        Fakes, fixtures, trap catalogs, conformance suite (dev-only)
```

Root workspace files: a private root `package.json` with `workspaces: ["packages/*"]`, one `bun.lock`, `tsconfig.base.json`, a solution `tsconfig.json`, `biome.json`, `commitlint.config.js`, `.dependency-cruiser.cjs`, `.bun-version`, and the extended CI workflow. New `.gitignore` entries cover `node_modules/`, `dist/`, `packages/*/dist/`, and local state.

Public entry points are declared through each package's `exports` map. Deep imports into another package's `src/` are forbidden. `core` exports its application API and its config API; it does not export domain internals. `contracts` exports the shared language and ports. `adapters` uses subpath exports for each provider.

**Where the shared modules live:**

- `Result<T,E>`, error kinds, stable error codes, the exit-code table, `CommandResult`, event envelope and schema versions, port interfaces, `BrandIdentity`, and the pure redactor live in `packages/contracts`.
- Domain-error-kind to stable-error-code translation lives in `packages/core` (application tier).
- Stable-code to numeric-process-exit mapping lives in `packages/contracts` as pure data; `cli` and `mcp` consume it without naming domain types.
- The JSONL writer, SQLite index, schema migrations, and writer lock live in `packages/state`.
- Provider error classification and retry policy live in `packages/adapters`.
- Brand values live only in `packages/branding`; they are injected into core, state, and adapters at composition time.

**Rejected alternative:** A single `core` package containing adapters and surfaces. It would erase the package-level enforcement that is the point of the monorepo.

### DEC-2 - Tier and dependency rules across packages

**Options considered:**

- (a) Document the rules and rely on review.
- (b) Enforce package-level edges only, with no internal tiers.
- (c) Enforce package-level edges plus internal `core` tiers (chosen).
- (d) Make every tier a separate package (rejected, Alt 4).

**Recommendation:** Adopt (c). The package graph is acyclic and follows this matrix.

| Importer / Imported | contracts | branding | core | state | adapters | cli | mcp | testkit |
|---------------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| contracts | - | no | no | no | no | no | no | no |
| branding | yes (type-only) | - | no | no | no | no | no | no |
| core | yes | no | - | no | no | no | no | no |
| state | yes | no | no | - | no | no | no | no |
| adapters | yes | no | no | no | - | no | no | no |
| cli | yes | yes | yes | yes | yes | - | no | no |
| mcp | yes | yes | yes | yes | yes | no | - | no |
| testkit | yes | no | yes | yes | yes | no | no | - |

Additional rules:

- `contracts` has no workspace dependencies and no I/O. It is the shared language, not a utility drawer. A type belongs there only if it crosses a package boundary.
- `branding` depends only on `contracts` (type-only) and contains the only current product-name literals.
- `core` depends only on `contracts`. It never imports `adapters`, `state`, `cli`, `mcp`, `branding`, or `testkit`. Brand values and port implementations are injected.
- `state` depends only on `contracts`. It may use `bun:sqlite` and `node:fs`; `bun:sqlite` is confined here.
- `adapters` depends only on `contracts`. It may use `node:fs` for config sources and provider SDKs for provider calls. Provider subpaths may share an internal HTTP and retry module but must not import each other. No provider SDK may appear in `core` or a surface.
- `cli` and `mcp` are sibling surfaces. Neither imports the other. Cliffy is confined to `cli`; the MCP SDK is confined to `mcp`. Both compose the same core use cases.
- `testkit` is dev-only. No runtime package may import it.
- `contracts` and `core` are runtime-neutral: no `bun:*`, no `node:*`, no `process`, no ambient clock or randomness. Time and identifiers come from ports.

Inside `core`, enforce this tier matrix:

| From / To | domain | app | config | contracts |
|-----------|:---:|:---:|:---:|:---:|
| domain | - | no | no | yes |
| app | yes | - | yes | yes |
| config | no | no | - | yes |

Enforcement is mechanical, not advisory:

- `package.json` `exports` maps prevent deep imports.
- One root dependency-cruiser configuration checks the package matrix, the `core` tier matrix, and the runtime-API confinement rules.
- Negative-test fixtures prove that each forbidden edge fails. A rule without a failing fixture is treated as unenforced.
- A CI check verifies that every imported workspace package is declared in the importing package's dependencies.
- No `|| true`, no `continue-on-error` on a gate, and no advisory boundary job. Informational benchmarks may be non-blocking only when they cannot fail a merge.

**Rejected alternative:** Copying marksync's four rules. They do not cover `infra -> app`, `app -> presentation`, sibling surfaces, or the runtime-API confinement that the monorepo needs.

### DEC-3 - Runtime and toolchain

**Options considered:**

- (a) Bun pinned, ESM, strict TypeScript, Biome, commitlint plus husky, dependency-cruiser (chosen).
- (b) Node with pnpm or npm workspaces.
- (c) Bun for development but permissive TypeScript and lint settings.
- (d) Independent per-package toolchains and versions.

**Recommendation:** Adopt (a), with one root configuration for the workspace.

- **Runtime:** Bun pinned to the marksync-proven `1.2.23` as the initial baseline. The same exact version is recorded in `.bun-version`, `engines.bun`, the CI matrix, and the release build. Bumping is a reviewed change; never float the version. Bun is the development, test, build, and single-binary runtime. `contracts` and `core` remain runtime-neutral so a Node-hosted MCP consumer is not blocked later.
- **Modules:** ESM everywhere (`"type": "module"`, `moduleResolution: "bundler"`, `verbatimModuleSyntax`, `isolatedModules`).
- **TypeScript:** One `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, and `noUncheckedSideEffectImports`. Per-package `tsconfig.json` files enable `composite`, declarations, and source maps; a root solution `tsconfig.json` builds with `tsc -b`.
- **Lint and format:** One root Biome configuration. Biome checks formatting and lint; `tsc` owns type correctness. No type-aware lint duplicate.
- **Commits:** One root commitlint configuration and a husky `commit-msg` hook. CI runs commitlint against `origin/main-tools` and the pull-request base; the local hook is convenience, not authority.
- **Boundaries:** One root dependency-cruiser configuration over `packages/`, with the rules from DEC-2 and negative fixtures.
- **Tests:** Per-package unit, integration, and package-local golden tests; root-level `e2e-mock`, live `e2e`, and `bdd` suites for cross-package contracts. `e2e-mock` is secrets-free and runs on every pull request. Live `e2e` runs only with credentials and is never a merge blocker for ordinary changes.
- **Versioning and release:** Lockstep version across the workspace for M0-M3. One tag, one release. Build the CLI binary and the MCP artifact, attach `SHA256SUMS` and a CycloneDX SBOM, and run a clean-OS smoke test. Publishing TypeScript libraries is deferred; if it becomes necessary, introduce a versioning tool and a branded publish manifest in a separate decision.
- **CI:** Existing bash jobs stay. New TypeScript jobs are added and binding: install with a frozen lockfile, typecheck, Biome, unit/integration tests, boundary negative tests, license audit, and binary smoke. The fast loop targets a practical duration; liveness work moves to separate jobs, not to advisory gates.

**Rejected alternative:** Node with pnpm. It is a valid ecosystem choice, but the owner selected Bun, marksync proves the Bun compile and test path, and introducing a second runtime now doubles the delivery surface.

### DEC-4 - Configuration precedence

**Options considered:**

- (a) Built-in defaults, then repo config file, then environment, then explicit CLI flags (chosen).
- (b) Environment first, then file (strict twelve-factor).
- (c) Add central or template inheritance in M0.
- (d) Executable configuration in TypeScript.

**Recommendation:** Adopt (a), with a single schema and a single defaults source.

1. **Built-in defaults:** one TypeScript defaults source in `core/src/config/defaults.ts`, typed so a missing default is a compile error.
2. **Repository config:** one committed, brand-neutral file named `delivery.config.yaml` at the repository root. Discovery walks up from the current directory to the git root; it does not merge a global file. The file name is a stable contract and does not change with the brand.
3. **Environment:** typed environment variables with the brand prefix from `branding`. Secrets are environment-only; adapters resolve credentials from the environment or the OS keyring. Configuration may name an environment variable but must not interpolate secret values into persisted files.
4. **Explicit CLI flags:** highest precedence for the current invocation.

Rules:

- Validate the merged result once with one JSON Schema and ajv, with `allErrors` and source provenance in error messages. Unknown keys are errors, not ignored.
- Support declarative per-repository and per-work-item override blocks inside the repository config. Do not support per-file executable configuration or arbitrary includes.
- Central or template inheritance is deferred. If added later, it uses an explicit `extends` chain with cycle detection and sits between defaults and the repository file; it is not silently merged.
- The legacy adapter reads the pre-freeze environment prefix and config directory, warns once, and maps them to the new keys. No new pre-freeze-prefixed variables are introduced.
- `config show --json` emits the effective configuration with secrets redacted. An optional `--explain` flag shows which layer supplied each value.

**Rejected alternative:** Executable TypeScript configuration. It makes configuration un-auditable, unsafe for untrusted repositories, and impossible to validate without running code.

### DEC-5 - State schema: local-first JSONL plus SQLite indexes

**Options considered:**

- (a) Append-only JSONL as the source of truth plus rebuildable SQLite indexes (chosen).
- (b) SQLite only.
- (c) JSON files only, no index.
- (d) Remote-first storage.

**Recommendation:** Adopt (a). State is local-first, append-only, schema-versioned, single-writer, and cloud-shippable.

**Location:** default `${XDG_STATE_HOME:-$HOME/.local/state}/<brand.configDirName>/`, with a repository or CI override under `.ai/local/state/`. The state directory contains `events.jsonl`, `state.db`, `state.lock`, and `manifest.json`.

**Event envelope:**

```json
{
  "schemaVersion": 1,
  "eventId": "uuid-v7",
  "occurredAt": "2026-10-23T10:15:30Z",
  "type": "delivery.command.finished.v1",
  "producer": "<brand metadata>",
  "workspaceId": "uuid",
  "runId": "uuid",
  "workItemRef": "GH-123",
  "actor": { "kind": "agent", "id": "coder" },
  "payload": { "command": "status", "exitCode": 0, "durationMs": 1234 },
  "redaction": { "applied": true, "rules": ["tokens", "paths"] }
}
```

**Rules:**

- `events.jsonl` is append-only. Corrections are new events; existing events are never mutated.
- `eventId` is the idempotency key for any future sink. `runId` correlates every command result with its start and finish events.
- `state.db` is a derived index, not a source of truth. It stores `events`, `runs`, `work_items`, and `meta` tables with WAL, `busy_timeout`, and foreign keys. `state rebuild` reconstructs it from JSONL.
- The writer lock contains PID, host, start time, and a heartbeat. A stale lock is taken over after a bounded timeout. Mutating commands fail with a stable `STATE_LOCKED` code; read-only commands may read the last consistent state and report staleness.
- A malformed JSONL line is never skipped silently. A torn final line from a crash during append is quarantined and recorded as an incident; any other malformed line is a hard `STATE_CORRUPT` error with the line number. `state repair --quarantine` can move a bad segment aside and emit an incident event.
- Schema versions are explicit: `EVENT_SCHEMA_VERSION` and `COMMAND_RESULT_SCHEMA_VERSION` start at 1. Additive fields are allowed within a version; breaking changes bump the version and require a migration or dual-read window. An unknown newer version is an error, never a zero.
- The envelope is cloud-shippable: no secrets, no absolute paths, no usernames, no PII beyond configured actor IDs, UTC timestamps, a random `workspaceId`, and brand-neutral event type names such as `delivery.event.v1`. A future cloud sink consumes the same JSONL without a migration.
- One pure redactor in `contracts` is applied before every write and every output. Token, path, and PII fixtures are part of the test suite.
- Retention and export are local policy: `state export --jsonl` is the portable path. Compaction, if any, produces new segmented files and never rewrites history in place.

**Rejected alternatives:** SQLite only (opaque history, harder to ship), JSON only (no fast queries), and remote-first (violates local-first and the no-cloud-in-OSS constraint).

### DEC-6 - Adapter contract: provider-agnostic ports, GitLab and Jira first

**Options considered:**

- (a) Ports in `contracts`, implementations in one `adapters` package with provider subpaths (chosen).
- (b) One package per provider.
- (c) Provider-specific logic in core behind conditionals.
- (d) A public plugin SDK now.

**Recommendation:** Adopt (a).

Ports in `contracts/ports`:

- `VcsPort`: change request read and create, checks or pipeline status, merge, push, remote branch lookup.
- `TrackerPort`: work item read, transition, comment, label mutation, ready-set query.
- `ProviderPort`: model provider resolution, probe, and quota facts.
- `ConfigSource`: repository config and environment acquisition.
- `StateStore` and `EventLog`: state reads, appends, and index queries.
- `Clock`, `IdGenerator`, and `Logger`: injected determinism and observability.

Contract rules:

- Every port method returns `Promise<Result<T, AdapterError>>`. Expected failures return `Err`; `throw` is reserved for invariant violations.
- `AdapterError` carries a stable kind (`auth`, `forbidden`, `not_found`, `conflict`, `rate_limited`, `network`, `server`, `validation`, `unsupported`, `unknown`), a stable code, a retryable flag, an optional retry-after, and an optional provider label. No provider-specific error type escapes an adapter.
- `capabilities()` describes provider differences such as label replacement versus append, data-driven versus fixed transitions, and comment support. Core branches on capabilities, never on provider identity.
- Mutations accept an idempotency key derived from `runId` and the operation. Adapters perform GET-before-mutate and treat conflicts explicitly.
- Adapters own rate-limit budgets, backoff, and retry classification. Authentication and validation failures are never retried. Adapter calls emit redacted events at the boundary.
- A provider-agnostic conformance suite in `testkit` runs against every adapter. A new adapter needs the suite, a trap catalog, and secrets-free `e2e-mock` fixtures. A live `e2e` run is additional evidence, not the gate.

Adapter order and packaging:

| Adapter | Milestone | Notes |
|---------|-----------|-------|
| GitLab | M0 | Merge requests, pipelines, branches; seed from the existing prototype. |
| Jira | M0 | Labels replace, transitions are data, custom fields, comment quirks. |
| GitHub | M1-M3 | ADOS dogfooding; pull requests, checks, Actions. |
| Azure DevOps | On demand | No skeleton until a consumer and trap catalog exist. |
| Git | M0 | Local git CLI operations behind `VcsPort` where applicable. |
| LLM providers | M0 | Provider resolver and quota facts under `adapters/providers`. |

`packages/adapters` starts as one package with subpath exports. Split a provider into its own package when it needs a heavy optional dependency, an independent release cadence, or a build-time size reduction. Do not pre-split.

**Rejected alternative:** Provider-specific branches in core. It makes every new provider a core change and breaks the replaceability driver.

### DEC-7 - Coexistence with the existing delivery repository layout

**Options considered:**

- (a) Additive `packages/` alongside the existing layout; bash stays authoritative until parity; register artifacts in `install.sh` (chosen).
- (b) Move `.opencode/`, `scripts/`, `tools/`, and `doc/` into `packages/`.
- (c) Big-bang replacement of the bash stack.
- (d) Sibling repository (rejected, Alt 5).

**Recommendation:** Adopt (a). Nothing moves in M0-M3.

| Area | Action |
|------|--------|
| `.opencode/` | Stays canonical; no move; `.ados-claude/` stays generated and CI-verified. |
| `scripts/` | Stays; bash delivery keeps running; new TypeScript CI jobs are added beside it. |
| `tools/` | Stays; a tool is deprecated only when its replacement passes parity; removal is last. |
| `doc/` | Stays; new tooling spec, architecture, and decision records are added, not moved. |
| `packages/` | New root workspace, additive. |
| Root manifests | New private workspace `package.json`, `bun.lock`, `tsconfig.base.json`, solution `tsconfig.json`, `biome.json`, `commitlint.config.js`, `.dependency-cruiser.cjs`, `.bun-version`. |
| CI | Existing bash jobs plus new TypeScript jobs; both binding; pull requests target `main-tools`. |
| Distribution | `scripts/install.sh` gains a release-artifact array for the CLI binary and its checksum; it does not copy `packages/` source. |
| Old tool removal | Last stage, per tool, after at least one release cycle with a deprecation notice in help, docs, and release notes; remove the install registration and the file together. |

Distribution rules:

- `install.sh` verifies the SHA256 of every downloaded artifact before installing it.
- Installation of the new CLI is explicit or opt-in until parity; it never silently replaces a bash tool.
- Local development uses `bun install` and a workspace script. `packages/` is not installed into user projects as source.
- The existing delivery-script and delivery-tool install arrays remain for the bash stack. The new artifact array is separate, so old and new distribution paths can be removed independently.

Documentation rules:

- Add a tooling feature spec under `doc/spec/` without overwriting the existing delivery-system features.
- Add an architecture overview for the new packages and their dependency matrix.
- Update `doc/guides/tools-convention.md` to distinguish repo-internal bash tools from the new delivery runtime. Keep the legacy exit-code table for bash tools until they are migrated.
- Do not modify `.opencode/agent/**` or `.opencode/command/**` as part of this decision; agent routing changes go through `@toolsmith` later.

**Rejected alternative:** Moving existing directories into `packages/`. It creates a large rename blast radius before the new stack proves itself and breaks the strangler's additive property.

### DEC-8 - Naming firewall placement

**Options considered:**

- (a) Branding package plus neutral workspace scope, forbidden-literal test, legacy adapter, and rename drill (chosen).
- (b) Rename now and freeze the brand before scaffolding.
- (c) A repository-wide search-and-replace script with no seam.
- (d) No firewall until release.

**Recommendation:** Adopt (a).

- `packages/branding` exports one `BrandIdentity` value: product name, binary name, package scope, environment prefix, config directory name, MCP tool prefix, telemetry namespace, docs base URL, repository URL, and release asset prefix. It is the only place current names appear.
- `packages/contracts` defines the `BrandIdentity` type. `branding` depends on `contracts` for the type only.
- `core`, `state`, and `adapters` never import branding. Composition roots in `cli` and `mcp` read branding and pass the needed values into constructors. The legacy adapter receives current names as parameters; it does not import branding.
- Workspace package names use a neutral private scope such as `@workspace/*`. All packages are `private: true` during M0-M3. The branded package scope is applied only at a future publish step, through a release-time manifest transform or a thin branded wrapper package. The brand never enters workspace package names.
- The committed repository config file is named `delivery.config.yaml`, which is brand-neutral and stable. Branding controls the user-level config directory and environment prefix, not the committed file name.
- Telemetry event names are brand-neutral from day one (`delivery.event.v1`, `delivery.metric.v1`). The producer name is metadata from branding, not part of the schema name.
- MCP tool names are a projection of branding plus a canonical primitive ID from `contracts`. A rename changes the projection, not the primitive.
- CLI subcommands are verbs and nouns, not brand names. User-facing docs use "the CLI", "the runtime", and "the delivery factory" until the name is frozen.
- The legacy adapter is the only other place allowed to contain old literals. It reads the pre-freeze environment prefix and config directory, warns once, and maps them to the new names. No new pre-freeze-prefixed variables are introduced.
- The forbidden-literal test scans `packages/**`, root manifests, and new user-facing docs for the old token, with an allowlist for `packages/branding/**`, `packages/adapters/src/legacy/**`, decision records, historical change artifacts, and required license or source headers. The test grows with the frozen name set.
- The rename drill replaces branding constants and the legacy mapping in a temporary copy, then runs typecheck, unit and integration tests, boundary tests, the forbidden-literal test, a binary build, and an MCP tool-list snapshot. It must pass before release and whenever branding changes.

**Rejected alternative:** Renaming now. The brand is not frozen and a premature rename would create exactly the archaeology the firewall exists to prevent.

### DEC-9 - Marksync adoption verdict

**Options considered:**

- (a) Copy the marksync repository shape verbatim.
- (b) Adapt the patterns to a monorepo, reusing what is proven and rejecting what is single-package specific (chosen).
- (c) Reject marksync and design from scratch.

**Recommendation:** Adopt (b). The verdict is explicit.

**Reuse (near-verbatim):**

- `Result<T,E>` for expected failures; `throw` only for invariants.
- `CommandResult` envelope with `schemaVersion`, `runId`, `exitCode`, timing, and `data` or `error`; stable error codes; presentation never names domain types.
- The class-based exit-code table, adapted to the new CLI and documented as a contract.
- Ports-and-adapters tier model with a pure domain tier.
- Strict TypeScript flags, ESM, Biome, commitlint plus husky, and binding CI.
- Tiered tests with a secrets-free `e2e-mock` suite and provider trap catalogs.
- Release discipline: pinned Bun, cross-compiled single binary, `SHA256SUMS`, CycloneDX SBOM, license audit, and clean-OS smoke.
- Decision records with rich frontmatter, revisit triggers, and AI-assistance provenance.
- Single-writer lock, atomic writes, and journaling as a recovery pattern (adapted to the new state store).

**Adapt (changed for the monorepo and the ADOS context):**

- Single `src/` tiers become root `packages/` plus internal `core` tiers.
- Per-package `#imports` aliases become workspace package names with explicit `exports` subpaths.
- The four dependency-cruiser rules become a full package matrix plus internal tiers, runtime-API confinement, and negative fixtures.
- Application-tier file I/O moves out of core; I/O lives in `state`, `adapters`, and config sources.
- Silent skipping of malformed JSONL lines becomes a hard error with quarantine and an incident event.
- Project-only configuration becomes defaults, repository file, environment, and flags, with a legacy adapter and branding injection.
- Lock and journal state becomes append-only JSONL plus rebuildable SQLite indexes with explicit schema versions.
- One binary becomes a CLI binary plus an MCP artifact, with lockstep versioning and deferred library publishing.
- MIT assumptions and license-checker configuration become Apache-2.0 with an ADOS license gate.
- Bun-only application code becomes runtime-neutral `contracts` and `core`; Bun APIs are confined to `state` and the CLI build.

**Reject (do not adopt):**

- The single-package `src/` tree copied verbatim into the monorepo root. It defeats surface and adapter isolation.
- The four-rule dependency-cruiser configuration treated as the complete matrix. It leaves real edges unguarded.
- Alias-only boundary enforcement. Per-package aliases do not enforce cross-package edges.
- Silent malformed-line skipping. It creates lying state and false-success signals.
- Direct `node:fs` I/O in the application tier. It breaks purity and testability.
- MIT license text and license-checker assumptions. ADOS is Apache-2.0.
- Product-specific names, config keys, and examples from marksync. They are not transferable.
- A single-binary-only distribution model as the only path. ADOS needs CLI, MCP, and install.sh registration.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-8:

- **C-1 (one OSS monorepo):** The workspace is additive inside this repository; no sibling repository; no cloud code. The committed M0-M3 scope has a home.
- **C-2 (Apache-2.0, license gate, SBOM):** The repository stays Apache-2.0; CI blocks GPL, AGPL, and UNLICENSED dependencies; LGPL and other ambiguous licenses require a recorded human compatibility determination; releases attach an SBOM and checksums. Individual dependency license compatibility remains a human determination, which this constraint requires rather than bypasses.
- **C-3 (naming firewall):** Branding is the only current-name source; the legacy adapter is the only old-name source; the forbidden-literal test and rename drill are required.
- **C-4 (OSS-only):** No cloud package, name, design, or private reference is introduced. Telemetry envelopes are local-first and cloud-compatible without being cloud code.
- **C-5 (coexistence and strangler):** Nothing moves; bash remains authoritative until parity; old tools are removed last with a deprecation notice.
- **C-6 (`.opencode` source of truth):** The decision does not touch `.opencode/` or the generated plugin; CI freshness continues.
- **C-7 (distribution registration):** New release artifacts are registered in `install.sh`, checksum-verified, and separate from the bash arrays.
- **C-8 (gates never weaken):** Existing bash gates stay binding; new TypeScript jobs are binding; parity suites decide when authority transfers.

No accepted-risk exceptions are required. The chosen alternative violates no constraint.

**Decider:** Juliusz Ćwiąkalski (owner). This record remains `Proposed` until the owner accepts it.

**Conditions for revisit:** See the frontmatter `revisit_triggers`. The most likely early triggers are the MCP runtime packaging result, a need to publish TypeScript libraries, and the first adapter that justifies a separate package.

## Trade-offs & Consequences

### Positive Outcomes

- Every artifact class has a clear home: contracts, core rules, state, adapters, surfaces, testkit, branding.
- CLI and MCP share one core implementation; neither can grow a private logic path without violating a package rule.
- Adapters depend only on contracts, so a provider can be replaced without touching core.
- The naming firewall becomes a constants change plus a tested drill, not a repository-wide migration.
- State is local-first and cloud-shippable from day one; the JSONL format is the portable contract.
- The existing bash stack keeps delivering; the new stack runs beside it with dual-run parity.
- Boundary rules are executable and tested, not prose that reviewers can forget.
- The structure is legible to AI agents: package names and dependency rules tell an agent where new code belongs.

### Negative Outcomes

- Eight packages add workspace manifests, test targets, and a lockstep release process. The overhead is real, even if smaller than the alternative of ungoverned growth.
- `contracts` can become a dumping ground. It needs a review rule: a type belongs there only if it crosses a package boundary.
- A single `adapters` package can accumulate dependency weight. The split trigger is documented, but the first split will be a refactor.
- Composition wiring is duplicated in `cli` and `mcp` until it justifies a shared runtime package. Duplication is small but visible.
- The runtime-neutral rule for `contracts` and `core` forbids convenient Bun or Node APIs in those tiers. Some code will need a port that a single-package design would not need.
- Lockstep versioning couples package releases. It is simple now and may become friction when external consumers appear.
- CI time grows with typecheck, boundary, test, and binary-smoke jobs. The fast loop must be kept honest or developers will route around it.
- The new CLI exit-code table may diverge from the legacy bash convention until `tools-convention.md` is reconciled. This is a documentation and consumer risk, not a structural one.

### Unresolved Questions

- [ ] Should `core` or `contracts` ever be published as libraries, or only binaries? If libraries, when, and how is the branded scope applied? (owner)
- [ ] Should this record be escalated to R3 with an independent `@decision-critic` challenge before acceptance? (owner)
- [ ] Is Bun `1.2.23` the right initial pin at implementation time, or should the first scaffold use a newer proven patch? (owner and `@coder`)
- [ ] Must the MCP server run under Node for consumers, or is a Bun-compiled binary acceptable? The answer changes MCP packaging and the runtime-neutral rule. (owner and `@coder`)
- [ ] Should the new CLI adopt the richer class-based exit-code table while bash tools keep 0-9 and 100 until migration? When is `doc/guides/tools-convention.md` updated? (owner)
- [ ] What is the default state directory: XDG state home or repository-local `.ai/local/state`? What is the retention and export policy? (owner)
- [ ] When does `packages/adapters` split into per-provider packages? The proposed trigger is a heavy optional dependency, an independent release cadence, or build-time size. (owner and `@coder`)
- [ ] Which candidate dependencies are license-compatible under Apache-2.0? This is a human determination before the first dependency is added. (owner)
- [ ] Should `install.sh` install the new CLI by default or only with an explicit flag until parity? (owner)

## Implementation Plan

High-level only; each step is delivered as an ADOS change with a spec, test plan, and plan, targeting `main-tools`.

1. **Workspace scaffold:** Add the private root `package.json`, `bun.lock`, `.bun-version`, `tsconfig.base.json`, solution `tsconfig.json`, `biome.json`, `commitlint.config.js`, `.dependency-cruiser.cjs`, `.gitignore` entries, and the new CI jobs. No product behavior yet.
2. **Contracts, branding, and core skeleton:** Create `contracts` (Result, errors, exit codes, `CommandResult`, event schema, ports, `BrandIdentity`, redactor), `branding`, and `core` with `domain`, `app`, and `config` tiers. Add the boundary matrices and negative fixtures. Add the forbidden-literal test and the rename drill.
3. **State store:** Implement the append-only JSONL writer, the SQLite index, schema versions, the single-writer lock, rebuild, and quarantine. Add redaction and schema fixtures. Prove that malformed input fails loudly.
4. **Adapters:** Start with GitLab and Jira, the Git adapter, provider resolver, config sources, and the legacy adapter. Build the fake server, trap catalogs, and conformance suite in `testkit`. Add GitHub when dogfooding requires it; leave Azure until a consumer exists.
5. **Surfaces:** Implement `cli` with Cliffy confined to the package, `runCli(argv, streams, deps)` returning an exit code, JSON and human output, and the composition root. Implement `mcp` as a minimal tool surface over the same core use cases, with bounded outputs and branded tool-name projection.
6. **Dual-run parity:** Wire the M0 engines (status, join and exit taxonomy, provider, closeout) to run beside the bash stack. The bash stack remains authoritative until the parity suite passes and the two-week signal is clean. No gate is relaxed.
7. **Distribution and release:** Register the CLI binary and checksum in `install.sh` as a separate artifact array. Add binary smoke, SBOM, license audit, and clean-OS checks. Keep the bash install path intact.
8. **Documentation:** Add the tooling feature spec, the architecture overview, and the reader-facing CLI and MCP documentation. Update `tools-convention.md` for the new runtime distinction. Do not overwrite existing delivery-system specs.
9. **Old tool retirement:** Only after parity and a deprecation cycle, remove each bash tool and its install registration together. No permanent shims.

Rollout guardrails:

- Pull requests target `main-tools`; no direct pushes.
- Every new CI gate is binding; no `|| true` and no advisory boundary job.
- The fast loop stays fast enough to be used; expensive live tests are separate and credential-gated.
- The contracts package is reviewed for boundary-crossing justification, not convenience.
- A dependency is added only after its license is reviewed and its install weight is understood.

## Verification Criteria

- **Metric:** Package dependency-graph violations across the DEC-2 matrix - Target: 0 - Window: every pull request.
- **Metric:** Core tier violations (`domain`/`app`/`config`) - Target: 0 - Window: every pull request.
- **Metric:** Negative fixtures proving each forbidden edge fails - Target: one per rule - Window: scaffold complete.
- **Metric:** Forbidden product-name literals in `packages/**` and new user-facing docs outside the allowlist - Target: 0 - Window: every pull request.
- **Metric:** Rename drill passes after replacing branding constants and the legacy mapping - Target: pass - Window: branding changes and release gate.
- **Metric:** `tsc -b` clean with the strict flags - Target: clean - Window: every pull request.
- **Metric:** Existing bash test suite result - Target: no regression - Window: every pull request.
- **Metric:** `e2e-mock` coverage of adapters without secrets - Target: every adapter has fixtures - Window: each adapter delivery.
- **Metric:** State JSONL rebuild reproduces the SQLite index - Target: identical query results - Window: state feature delivery.
- **Metric:** Secrets or absolute user paths in state and telemetry fixtures - Target: 0 - Window: every pull request.
- **Metric:** License gate result - Target: no GPL, AGPL, or UNLICENSED dependency; LGPL or ambiguous dependencies have a recorded human determination - Window: every pull request.
- **Metric:** Release artifacts - Target: CLI binary, MCP artifact, `SHA256SUMS`, CycloneDX SBOM - Window: every release.
- **Metric:** Clean-OS binary smoke - Target: `--version` and a JSON command succeed without a language runtime - Window: every release.
- **Metric:** Dual-run parity for a migrated engine - Target: parity suite passes and the observation window is clean - Window: before authority transfer.

## Confidence Rating

**Medium-high.** The structure is grounded in a concrete, proven single-package template and in the repository's own constraints. The package graph is deliberately small and the enforcement is testable. The main uncertainties are external: whether the MCP SDK packages cleanly under Bun, whether any consumer needs Node-only APIs, the license compatibility of candidate dependencies, and whether the exit-code and state defaults match operator expectations. None of those uncertainties changes the package boundaries; they change packaging and defaults within the chosen structure. AI-generated confidence is not evidence; owner review and, ideally, an independent challenge remain required.

## References

- [AGENTS.md](../../AGENTS.md) - branch model, repository layout, `.opencode` source of truth, distribution conventions.
- [Tools Convention](../guides/tools-convention.md) - existing CLI tool standards and legacy exit codes.
- [ADR-0001: Decision-Making Framework Refactor](ADR-0001-decision-making-framework.md) - decision process and record discipline.
- [ADR-0002: Readiness Gate](ADR-0002-readiness-gate-definition-of-ready.md) - structural decision precedent.
- [Decision Record Template](../templates/decision-record-template.md) - body structure.
- [Project decision instructions](../../.ai/agent/decision-instructions.md) - tracking conventions, rigor levels, and project priorities.
- `scripts/install.sh` - current distribution registration arrays for delivery scripts and tools.
- marksync-for-confluence repository, local evaluation on 2026-10-23: `package.json`, `tsconfig.json`, `.dependency-cruiser.cjs`, `src/domain`, `src/app`, `src/cli`, `src/infra`, `tests/`, `.github/workflows/ci.yml`, and `.github/workflows/release.yml`.
- Owner decision for this delivery scope, 2026-10-23: one OSS monorepo, M0-M3 committed, Apache-2.0, naming firewall, strangler migration.
