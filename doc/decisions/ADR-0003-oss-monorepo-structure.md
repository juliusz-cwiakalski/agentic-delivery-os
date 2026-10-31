---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/decisions/ADR-0003-oss-monorepo-structure.md
id: ADR-0003
decision_type: adr
status: Accepted
created: 2026-10-23
decision_date: 2026-10-24
last_updated: 2026-10-31
summary: "Adopt a root packages/ pnpm-workspace monorepo with Bun pinned as the runtime and build target: a runtime-neutral core with contracts, state, and branding subpaths plus one createRuntime composition root, one adapters package with per-provider and per-I/O subpaths, thin cli/mcp/opencode surfaces, and a private dev-only testkit; six packages, one lockstep publish line, a layered configuration model, and a wrapper-based strangler from the bash stack."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os
decision_area: architecture
decision_scope: org
reversibility: moderate
review_date: 2026-10-24
business_impact: "Unblocks the OSS TypeScript delivery tooling for every roadmap phase that includes any OSS part (the roadmap is to be revised) while isolating change from the running bash stack; makes the public rename a branding-module change inside packages/core and a separate, countable corpus migration."
customer_impact: "ADOS users keep the current behavior until each engine passes parity, then gain a deterministic CLI, a local MCP surface, and OpenCode-native tools with stable documented error codes, layered configuration, and verifiable installs."
classification:
  domains: [architecture, security, privacy, operations, tooling, legal]
  archetype: design
  environment: complicated
  rigor: R3
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
    - "Juliusz Ćwiąkalski (owner constraints, prior decisions, and the 2026-10-24 UQ answers)"
    - "CritiqueGrid panel (same-lineage review input, 2026-10-23)"
    - "marksync-for-confluence (pattern evidence; owner's sibling repository)"
    - "External research 2026-10-24 (package structure and configuration precedence; owner-approved)"
  reviewers:
    - "@decision-critic (R3 challenge; first pass REWORK 2026-10-24; re-review PASS_WITH_RISKS 2026-10-24; focused re-review of the six-package revision REWORK 2026-10-24 with findings F1-F16, all closed; confirmation re-review of the F1-F16 revision PASS_WITH_RISKS 2026-10-24)"
    - "Owner (human final decision; accepts residual security, privacy, and legal risk)"
  performers:
    - "@coder"
    - "@toolsmith (only if a later change touches agent or command definitions)"
  informed:
    - "ADOS users"
    - "ADOS agents and contributors"
ai_assistance:
  used: true
  roles: [researcher, analyst, critic, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: "Juliusz Ćwiąkalski (owner, accepted 2026-10-24 via PR #163)"
  reviewers: ["@decision-critic (first pass REWORK 2026-10-24; re-review PASS_WITH_RISKS 2026-10-24; focused re-review of the six-package revision REWORK 2026-10-24, findings F1-F16 all closed; confirmation re-review of the F1-F16 revision PASS_WITH_RISKS 2026-10-24)"]
revisit_triggers:
  - "An OpenCode native tool or a second TypeScript harness (for example Pi.dev) needs a capability that the documented core entry points do not expose; reshape the harness surface rather than reaching into core internals"
  - "A non-Bun runtime needs state access; the non-Bun state driver and its documented degraded mode become mandatory earlier than planned"
  - "External consumers need published TypeScript libraries before the naming freeze; publication stays blocked, but the publish manifest, version line, and notice bundle move earlier"
  - "A package needs an independent release cadence, a heavy optional dependency, or a separate build target; apply the documented split triggers, and split a state driver out of core if its runtime-specific dependency demands it"
  - "The MCP host requires Node-only APIs that the core runtime-neutral rule forbids; revisit the MCP artifact form and the driver fallback"
  - "The naming freeze lands and the branding module changes; the rename drill must pass without code archaeology"
  - "Bash parity is reached for an engine and the wrapper delegates to the new tool; revisit the wrapper cutover and rollback rules"
  - "The core contracts subpath grows beyond cross-package language and becomes a dumping ground; revisit the subpath rules"
  - "A published package grows a deep re-export chain, or a surface re-implements composition wiring instead of calling createRuntime; treat it as a design defect, not a style preference"
  - "The license registry denies a candidate dependency or a new license class is considered; revise the policy before adoption"
  - "Signature verification, the vulnerability gate, or the privacy assessment gate blocks a release; treat it as a decision input, not an obstacle to bypass"
  - "A team or managed configuration overlay (a restrict-only policy layer) or template `extends` proves necessary; revisit the DEC-4 layer set. The system and user-global layers ship in v1, so they are not future work"
links:
  related_changes: ["GH-49"]
  supersedes: []
  superseded_by: []
  spec: []
  contracts: []
  diagrams: []
  decisions: ["ADR-0001", "ADR-0002", "ADR-0005"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# ADR-0003: OSS Tooling Monorepo Structure

## Context

ADOS currently delivers its own changes with a bash stack: `scripts/` (delivery automation), `tools/` (PATH utilities), `.opencode/` (canonical agent and command definitions, which are the product), and `doc/` (spec, decisions, guides). The OSS delivery scope is every roadmap phase that includes any OSS part; the roadmap is to be revised (owner answer UQ-1, 2026-10-24). The first phases deliver a TypeScript CLI plus MCP plus OpenCode integration that replaces the bash delivery stack engine by engine using a strangler pattern. Cloud work must not appear in committed files, and the roadmap revision does not change that boundary. Roadmap phases with no OSS part are out of scope for this record.

The owner has decided that the OSS part is one monorepo covering processes, tooling, scripting, agents, and docs; a root `packages/` layout is acceptable. The exact structure was the open question; this revision records the owner-approved six-package structure and the owner-approved configuration model (external research 2026-10-24). Repository placement is resolved: the monorepo lives in this repository. The binary name and package name remain branding values that are still to be decided. The existing root layout must stay: `.opencode/` remains canonical, `.ados-claude/` remains generated, `scripts/` and `tools/` keep running until the new engines replace them, and `doc/` remains the documentation home. Delivery goes through ADOS itself, and pull requests target `main-tools`. Installs use `main-tools` while the tools are delivered there; once the tools are stable and public-ready they merge to `main`, `main-tools` is retired, and installs move to `main` (owner answer UQ-2, 2026-10-24).

### Owner decision record (verbatim owner statements)

The owner decisions that this record depends on are quoted verbatim below. They are the owner's own words and contain no secrets, so the record can cite them directly instead of pointing at a locator whose content can change or disappear.

| Owner decision | Owner statement (verbatim) | Label | Source | Status |
|----------------|----------------------------|-------|--------|--------|
| Monorepo | "I agree to have a monorepo for oss part that would cover all - processes, tooling, scripting, agents, docs etc. regarding exact structure do a decision record and incorporate decision advisor properly - I'm open to packages as a root." | FACT | owner direction via CEO session 2026-10-23 | Active |
| Scope (2026-10-23) | "for now let's work on milestones M0-M3 inclusive. then I'd consider publihsing this new shape and merge main-tools to main and continue delivery on main from there." | FACT | owner direction via CEO session 2026-10-23 | Superseded by the UQ-1 answer (2026-10-24) |
| License | "let's migrate to apache-2.0. I'm the only contributor to this repo so far so I own everything and can do it." | FACT | owner direction via CEO session 2026-10-23 | Active |
| Naming | "the final public name will be decided soon but for the inception we should not couple anything in the code/docs to a name." | FACT | owner direction via CEO session 2026-10-23 | Active |
| Strangler | "for now let's keep the bash stack running and let's use the strangler pattern... those old tools would be removed at the very last stage (they could print some short deprecation notice on use + info how to use the new tooling)." | FACT | owner direction via CEO session 2026-10-23 | Active |
| Scope sequencing (2026-10-24) | "The OSS track runs M0-M4 and continues. The Cloud track starts at M4 and runs in parallel. M4 is the Cloud kickoff, not the end of OSS. M5-M7 are later directions, not date commitments." | FACT | owner sequencing note in the owner's local working notes, 2026-10-24 | Superseded by the UQ-1 answer (2026-10-24) |

The scope question above is closed. The committed OSS scope is every roadmap phase that includes any OSS part, and the roadmap itself is to be revised so its milestone boundaries match. This record therefore no longer qualifies milestone boundaries as scope-pending, and the earlier M0-M3 versus M0-M4 conflict is historical, not open.

### Owner answers of 2026-10-24 (PR #163 review 5636881026)

These are the owner's answers to the eight open questions raised in the PR #163 review. They are recorded as owner FACTs; the wording is the owner's, condensed only where the table says so.

| UQ | Topic | Owner statement | Label | Source |
|----|-------|-----------------|-------|--------|
| UQ-1 | Committed OSS scope | "all phases from roadmap may contain the OSS tooling part so all roadmap phases that include any OSS should be in scope - roadmap to be revised" | FACT | PR #163 review 5636881026, 2026-10-24 |
| UQ-2 | Install source | "so the tools project will be delivered on main-tools until we change that (next few months probably). so install should use this branch for now. once we reach a state that tools are stable and public ready then we'll merge to main and then we'll kill the main-tools branch. then installs should go for main and until then from main-tools" | FACT | PR #163 review 5636881026, 2026-10-24 |
| UQ-3 | License registry location and format | "if we don't have a better place yet for legal/compliance then we can start with doc/legal etc. format can be something machine parseable + human readable = yaml" | FACT | PR #163 review 5636881026, 2026-10-24 |
| UQ-4 | Configuration levels | "I'd like to follow best practices... support different levels of configuration like per project/global per user and reasonable defaults provided by the tool" | FACT | PR #163 review 5636881026, 2026-10-24 |
| UQ-5 | Library publication set | "we can start with that and let's see how packages evolves over time. in general we should publish what could be included in other software in principle (like opencode plugin with our tools)" | FACT | PR #163 review 5636881026, 2026-10-24 |
| UQ-6 | State retention | "I'd start with forever retention. As I'll use it I'll see how it grows... Then I can decide on adding custom retention policies/configs that user could setup" | FACT | PR #163 review 5636881026, 2026-10-24 |
| UQ-7 | MCP v1 scope | "If it's technically easy then we should maintain same scope of what can be done via mcp and cli... But if in specific cases there will be good reason to drift then we can consider it case by case" | FACT | PR #163 review 5636881026, 2026-10-24 |
| UQ-8 | State shape and future sharing | "I'm ok with proposed state shape for now. But we should build an abstraction that would hide implementation details... in the future we should allow plugging in some shared in cloud state management where multiple agents teams distributed between multiple hosts could share. initial implementation should be local first but abstraction layer should not depend on implementation. Probably we'll have to define different state layers/levels and distinguish local vs project (shared across all workstation/operators) and maybe vs global (all projects)?" | FACT | PR #163 review 5636881026, 2026-10-24 |

Two further inputs were owner-approved from external research on 2026-10-24 and are incorporated here as FACTs with that source: the six-package structure (package set, split triggers, and boundary enforcement) and the layered configuration precedence model (DEC-3 and DEC-4).

The owner also chose this record to be R3 and to receive a formal `@decision-critic` challenge (source: owner direction via CEO session 2026-10-23).

The pattern source is the marksync-for-confluence repository: a single package with a strict tiered `src/` tree, a pinned Bun runtime, strict TypeScript, Biome, commitlint plus husky, dependency-cruiser boundaries, a `CommandResult` envelope, a stable exit-code table, tiered tests, and a release pipeline with a single binary and SBOM. That template is proven, but it is single-package. ADOS is a monorepo, so the tier boundaries must map to packages rather than one `src/` tree. A literal copy would either collapse the monorepo into one package or create an unenforced package graph.

Two facts make this decision urgent:

- The first scaffold is the first implementation step. Package boundaries set precedent for every later engine, adapter, and surface.
- The naming firewall is a hard constraint. The brand is not frozen, and renaming after packages, binaries, environment variables, MCP tools, and telemetry schemas are public is a migration program. The structure must make the rename mechanical inside `packages/**` and countable outside it.

Prior decisions constrain the answer: ADR-0001 established proportional decision records and bounded AI authority; ADR-0002 established the readiness gate. The GH-49 design work decided TypeScript, one shared core with CLI and MCP as surfaces, provider-agnostic adapters, and local-first operational state. GH-49 also decided that repository configuration inheritance would ship in the first milestone; DEC-4 now absorbs that item into a layered configuration model instead of deferring it. This record decides the repository and package structure that makes those decisions enforceable.

## Problem Framing (Clarified)

The root problem is not "which folder names look tidy." It is that the new TypeScript tooling needs explicit, mechanically enforced contracts while it coexists with a running bash stack, must run in more than one host runtime, must be configurable by users at several levels, and ships an unfrozen brand.

The bash stack encodes its contracts in scripts, convention, and operator memory. That was sufficient for a solo operator and a small tool set. It is not sufficient for a CLI, an MCP server, and OpenCode-native tools that share one core, several provider adapters, a persistent local state store, layered configuration, and a rename that must not require archaeology. Without package boundaries, the following failures are likely:

- Surfaces reach into core internals, so CLI, MCP, and harness tools drift into separate behavior.
- Provider quirks leak into core rules, so adapters cannot be replaced or added safely.
- Persistence and telemetry formats couple to command implementations, so a future sink requires migration.
- Each surface re-implements the same wiring, so behavior diverges by construction path rather than by intent.
- The brand appears in package names, environment variables, config paths, MCP tool names, and telemetry event names, so renaming is a repository-wide search-and-replace with broken consumers.
- The new stack grows inside the bash tree with no ownership boundary, so removing old tools becomes a big-bang instead of a strangler.
- A Bun-only choice of driver or API leaks into domain logic, so the same engine cannot run inside OpenCode or another TypeScript harness.
- Configuration is either one unreachable file or twenty environment variables, so a team cannot configure a project, a user cannot set a machine-wide default, and nobody can explain why a value won.

The decision question is: what package set, runtime seam, configuration model, and dependency rules give the strongest isolation, testability, runtime portability, and rename safety at the lowest cognitive cost for one developer orchestrating AI agents, while preserving the existing repository and the running bash stack?

Desired outcomes:

- One install, build, test, and release workflow for the TypeScript tooling.
- Enforceable boundaries between contracts, core rules, persistence, adapters, and surfaces, with six packages rather than a package per layer.
- Runtime-neutral core logic that runs under Bun, Node, or a TypeScript plugin host without a rewrite, with runtime-specific state drivers isolated behind ports.
- One shared implementation for CLI, MCP, and harness surfaces, with no logic in any surface and no duplicated composition wiring.
- Provider adapters that are replaceable and testable without live credentials.
- A local state format behind an implementation-neutral abstraction, so a shared or cloud state backend can be added later without rewriting core rules.
- A configuration model with reasonable built-in defaults, per-user and per-project levels, deterministic precedence, per-key provenance, and actionable validation errors.
- A rename that changes branding values inside `packages/core` and has a separately tracked migration for the installed corpus.
- A wrapper-based strangler path that keeps the bash stack authoritative until each engine passes parity, then moves the wrapper onto the new tool.

Out of scope: cloud services, pricing, final brand selection, provider-specific API design beyond the adapter contract, the content of the revised roadmap beyond the structure, the shared or cloud state backend itself, and the publication date of the packages. Those are separate decisions or later work.

## Constraints (Hard Requirements)

### C-1: One OSS monorepo for the committed scope

- **Statement:** The committed OSS tooling must live in this repository as one OSS monorepo; no sibling CLI repository and no cloud code in committed files. The committed OSS scope is every roadmap phase that includes any OSS part; the roadmap is to be revised so its milestone boundaries match (owner answer UQ-1, 2026-10-24).
- **Source:** owner decision (monorepo and scope statements in the Owner decision record; UQ-1 answer)
- **Verification:** code review and repository layout audit
- **Negotiable:** no

### C-2: Apache-2.0, enforced dependency license policy, notices, and SBOM

- **Statement:** The repository remains Apache-2.0. CI must enforce an approved/rejected license registry for every dependency; the gate accepts only OSI-approved, Apache-2.0-compatible SPDX identifiers on the allow-list; it fails closed on unknown, `NOASSERTION`, `SEE LICENSE`, and compound expressions; and it denies SSPL, BUSL, Elastic License, Commons Clause, and CC-BY-NC. The registry is a committed YAML file under `doc/legal/` (for example `doc/legal/dependency-licenses.yaml`), machine-parseable and human-readable, and the CI gate reads it directly. Every release, binary or library, must attach an SBOM, checksums, and a `THIRD-PARTY-NOTICES` artifact or a `licenses/` bundle; the repository carries a `NOTICE` when any dependency requires one.
- **Source:** owner decision (Apache-2.0, license registry, and the UQ-3 registry location and format answer)
- **Verification:** CI (license-registry gate, SBOM generation, notices bundle presence, checksum verification)
- **Negotiable:** no

### C-3: Naming firewall with a tested rename seam

- **Statement:** No new code or new user-facing documentation may hardcode a product name, binary name, package scope, or derived identifier outside the single branding module and the legacy compatibility adapter; decision records may name the current project when describing context. The branding module lives at `packages/core/src/branding` and is the only name seam: product name, binary name, environment prefix, and config directory name, with the strings derived from them. The branding resolver is pure: the build-time define supplies the compile-time default, and the environment override is read at a runtime-aware edge (a surface, or a composition root that receives injected environment facts) and passed into the resolver, so the `./branding` subpath performs no ambient environment read. A forbidden-literal test over `packages/**` and new user-facing docs, a rename drill, and an ambient-global negative fixture that rejects `process.env` and `Bun.env` in `packages/core/src/branding` must pass. The seed literal set is the legacy tokens already public in this repository: `ados`, `ADOS_`, and `~/.ados`. The test grows with the frozen name set: freezing a new public name adds it as a literal in the same change. The existing installed corpus is migrated separately and is not claimed as covered by the module.
- **Source:** owner decision (naming firewall and single central seam), external research 2026-10-24 (branding as configuration)
- **Verification:** test (forbidden-literal scan and rename drill) plus a tracked corpus migration
- **Negotiable:** no

### C-4: OSS-only committed artifacts

- **Statement:** Committed files must contain no cloud names, cloud designs, pricing, private references, or proprietary implementation. C-4 forbids third-party or private-corpus identifiers; references to the owner's own local working notes are allowed as long as no private identifiers are copied. This record was scanned for private identifiers and contains none: private working paths and review records are described generically. Planned shared or cloud state backends are named as future integration points only; their implementation is a separate decision and is not committed here.
- **Source:** AGENTS.md and owner decision
- **Verification:** audit and code review
- **Negotiable:** no

### C-5: Wrapper-based coexistence and strangler migration

- **Statement:** The existing `.opencode/`, `scripts/`, `tools/`, and `doc/` layout must remain. Installing from the delivery branch may install the new tool plus updated legacy wrappers. A wrapper may delegate to the new tool only after that engine passes the per-engine parity gate. Until then the bash implementation stays authoritative. Old tools and wrappers are removed only after a deprecation cycle.
- **Source:** owner decision (wrapper model), AGENTS.md branch model
- **Verification:** code review, parity suite results, and a wrapper cutover checklist per engine
- **Negotiable:** no

### C-6: Single source of truth for agent and command definitions

- **Statement:** `.opencode/` remains canonical; `.ados-claude/` remains generated; no hand edits to generated artifacts; CI verifies freshness.
- **Source:** AGENTS.md
- **Verification:** CI (generated plugin freshness)
- **Negotiable:** no

### C-7: Distribution registration and artifact consistency

- **Statement:** Any installable artifact must be registered in `scripts/install.sh` (an explicit array or install path), including the CLI binary, the MCP artifact, the opencode surface artifact, and updated wrappers, each with its install path, update and overwrite mechanics, and signature/checksum verification, and each must be verified. The pinned runtime version in `.bun-version`, `engines.bun`, the CI matrix, and the release build must be identical and checked by CI. The package manager is pnpm, pinned by the root `packageManager` field with a committed `pnpm-lock.yaml`. No unregistered delivery artifact may be installed by users.
- **Source:** AGENTS.md, owner decision, external research 2026-10-24 (pnpm workspaces), internal standard
- **Verification:** test and audit of the install set; CI pin-equality check for the four Bun copies and the pnpm pin
- **Negotiable:** no

### C-8: Running gates never weaken during migration

- **Statement:** The bash gates remain authoritative until the replacement engine passes the same parity suite. No gate is relaxed or removed early. A wrapper cutover requires a green parity suite, a clean observation window, a rehearsed rollback, and owner sign-off.
- **Source:** owner decision (strangler sequencing)
- **Verification:** code review, parity test results, and the cutover checklist
- **Negotiable:** no

### C-9: Runtime neutrality of core logic

- **Statement:** The runtime-neutral part of `core` (domain, application, config, branding, and the contract and port surface of the `.` and `./contracts` subpaths) must not depend on Bun, Node, OpenCode, Pi.dev, or any other runtime. It contains no `bun:*` or `node:*` imports, no ambient globals (`process`, `Bun`, `Deno`, timers, filesystem, network), and no ambient clock or randomness. Bun is the pinned runtime, build, and packaging target, not a semantic dependency. Persistence sits behind ports exported from `core ./contracts`; the JSONL and SQLite drivers live in `core ./state`, the only core subpath allowed to import runtime APIs, and at least one non-Bun driver path must exist. Each surface is replaceable without rewriting core rules. Until an approved non-Bun driver lands, the documented degraded mode is a read-only JSONL log without SQLite indexes; that state is a design state, not a waived constraint, and the absence of an approved non-Bun driver at scaffold is a scaffold stop condition. A host that cannot host the SQLite driver imports `core ./contracts` and supplies its own driver.
- **Source:** owner decision (runtime and MCP statements in the Owner decision record), external research 2026-10-24 (state subpath boundaries)
- **Verification:** dependency-cruiser rules on declared entrypoints, an AST or lint guard against ambient globals, negative fixtures, a runtime-portability smoke suite that runs the contract and core tests under a second runtime host (Node), a surface-level non-Bun smoke (the mcp surface under Node, and the opencode surface through a defined Node harness that stubs the host API and invokes the exported native-tool entry points), and a packed-artifact import test proving that `core` `.`, `core ./contracts`, and `core ./branding` load without any state driver, that only `core ./state` requires the driver, plus a Node import smoke for `core` `.`
- **Negotiable:** no

### C-10: Security and supply-chain baseline

- **Statement:** Before the first public release, releases are signed (Sigstore or minisign) and the installer verifies the signature and checksum before installing; the installer fails closed on a non-HTTPS source or a missing checksum; the bootstrap installer is pinned to a tagged, checksummed release. CI uses SHA-pinned actions and job-scoped permissions, and release credentials use OIDC rather than long-lived secrets. A vulnerability gate (OSV or `pnpm audit` plus dependency review) runs on every pull request and blocks high or critical findings. Published packages are built from a clean, reproducible install with provenance attestation. An MCP tool that mutates external state requires explicit authorization and confirmation before it ships. MCP tool inputs, descriptions, and returned content are treated as untrusted: they never grant authority, and a prompt-injection fixture is required.
- **Source:** owner decision (security acceptance is human), internal security standard, prior review input CG-SEC-001 through CG-SEC-004 (same-lineage), external research 2026-10-24 (publish provenance)
- **Verification:** CI (SHA-pin audit, dependency review, vulnerability scan), release checklist (signature verification, OIDC-issued release credentials, publish provenance), an MCP mutation authorization and confirmation test, a prompt-injection fixture, and security review sign-off
- **Negotiable:** no

### C-11: Privacy and data-lifecycle baseline

- **Statement:** Persisted events carry a field-level data classification. Redaction is fail-closed and records its `redactorVersion` and rule-set hash. Each event type has a closed payload schema. No sink may receive data before a retention policy and an erasure procedure exist. On POSIX platforms the state directory is created at `0700` and state files at `0600`; on Windows the equivalent is a restrictive ACL that grants only the current user (plus SYSTEM and administrators where the OS requires it), denies other users, and inherits to child objects. POSIX mode bits do not apply on Windows.
- **Metadata-only clause for session and host inspection:** `SessionStore` (read-only reads of foreign session databases for `db` administration) and `HostPort` (host and process inspection) are metadata-only by default. They may surface identifiers, counts, timestamps, process names, and non-user file paths; they must not surface message content, prompts, transcripts, credentials, environment values, or command arguments. The field-level classification in DEC-5 applies to every field they surface, redaction applies before any write or output, and an explicit privacy sign-off is required before the `db` administration engine that uses `SessionStore` ships.
- **Source:** owner decision (privacy acceptance is human), internal standard, prior review input CG-PRIV-001 through CG-PRIV-005 (same-lineage)
- **Verification:** tests (canary secret with zero occurrences, platform-qualified permission check: POSIX mode bits or the Windows ACL), closed-payload-schema validation at write time, a metadata-only assertion for the `SessionStore` and `HostPort` outputs, recorded privacy review sign-off before the first release that persists or exports events, and a separate privacy sign-off before the `db` administration engine ships
- **Negotiable:** no

> **Table-stakes:** All non-rejected alternatives are git-native, keep secrets out of committed files, introduce no proprietary runtime, and deliver through pull requests to `main-tools`. These are acknowledged once, not repeated per alternative.

## Decision Drivers

The earlier draft used verbal weights that disagreed with its own ranked list. Weights are removed. The single ordered list below is authoritative and is referenced by the per-sub-decision fit paragraphs.

**Business drivers:**

- **Solo-developer efficiency and cognitive load (rank 2).** One person orchestrates AI agents; every extra package, manifest, and version axis is attention spent outside shipping.
- **Public release readiness (rank 4).** The first public release must have a cheap rename inside `packages/**`, a clean OSS boundary, signed artifacts, notices, a credible install story, and a publishable package set.
- **Time to first slice (rank 11).** The first scaffold must produce a usable TypeScript core quickly; structure must not become a construction project.

**Technical drivers:**

- **Boundary enforcement (rank 1).** Surfaces cannot reach core internals; adapters cannot leak provider types into core; persistence cannot couple to command code; no package reaches into a subpath that is not declared for it.
- **Testability (rank 6).** Core rules must be testable without network or credentials; adapters need fakes, trap catalogs, a conformance suite, and runtime-portable tests.
- **Determinism and reproducibility (rank 7).** Pinned runtime and package manager, one lockfile, strict type checking, one resolved configuration tree with provenance, and binding CI gates.
- **Replaceability and future extraction (rank 9).** An adapter, driver, or surface can be replaced or extracted without rewriting core; a state backend can be swapped behind the state ports.

**Operational drivers:**

- **Strangler coexistence (rank 3).** The bash stack keeps delivering while the new stack runs beside it, and wrappers move engine by engine.
- **Rename safety (rank 5).** The brand is one configuration seam inside `packages/core`, not a distributed literal, and the installed corpus migration is explicit.
- **Release simplicity and distribution fidelity (rank 8).** One lockstep version line for all published packages, one release train, CLI and MCP artifacts plus the published packages, with checksums, signatures, SBOM, and notices.
- **Agent legibility (rank 10).** Package names and rules must let an AI agent place new code correctly without guessing.

**Ranked:** boundary enforcement; solo-developer efficiency; strangler coexistence; public release readiness; rename safety; testability; determinism and reproducibility; release simplicity and distribution fidelity; replaceability and future extraction; agent legibility; time to first slice.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` - coordinates the analysis and drafts this record.
- **Decider / Approver:** Juliusz Ćwiąkalski - the one accountable human authority. AI does not accept this record.
- **Contributors:** Juliusz Ćwiąkalski (owner constraints, prior decisions, and the 2026-10-24 UQ answers); CritiqueGrid panel (same-lineage review input, 2026-10-23); marksync-for-confluence (pattern evidence); external research 2026-10-24 (package structure and configuration precedence, owner-approved); `@decision-critic` (R3 challenge, first pass REWORK 2026-10-24, re-review PASS_WITH_RISKS 2026-10-24, focused re-review of the six-package revision REWORK 2026-10-24 with all findings closed, confirmation re-review of the F1-F16 revision PASS_WITH_RISKS 2026-10-24).
- **Required reviewers:** `@decision-critic` for the R3 challenge, plus the owner for the human final decision. Because R3 always needs a human reviewer, the critic's verdict is a first-pass check, not independent assurance; same-model agents do not constitute independent evidence.
- **Acceptance deadline:** the owner sets the date; the default is before the first scaffold kickoff. If no date is set, the record stays Proposed and blocks the scaffold.
- **Escalation authority:** the owner (Juliusz Ćwiąkalski). Unresolved disagreement among reviewers escalates to the owner, who is the only authority able to accept or reject this record.
- **Performers:** `@coder` for the scaffold and engine delivery; `@toolsmith` only if a later change touches agent or command definitions, which this decision does not.
- **Informed:** ADOS users and ADOS agents (through the committed architecture and spec documentation).

The owner accepted this record on 2026-10-24 via PR #163 (`status: Accepted`, `decision_date: 2026-10-24`, `review_date: 2026-10-24`). The first retrospective runs after the scaffold and the first parity cutover. The brand name (UQ-9) is deferred until before the first public release and is protected by the branding seam.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The OSS tooling is one monorepo in the current repository; Apache-2.0 and the naming firewall apply. | FACT | Owner decision statements in this record; owner answers 2026-10-24 | C-1 would be void and the sibling-repository alternative would return; the license constraint would be wrong. | High |
| The committed OSS scope is every roadmap phase that includes any OSS part, and the roadmap is to be revised. | FACT | Owner answer UQ-1, PR #163 review 5636881026, 2026-10-24 | Planning would under- or over-commit scope and milestone gates would be wrong. | High |
| Work beyond the intended OSS scope is not committed; cloud work must not appear in committed files. | FACT | Owner decision statements in this record; AGENTS.md | Committed files would leak uncommitted scope. | High |
| Core logic and domain must not be bundled to Bun or any runtime; OpenCode and possibly Pi.dev are target runtimes. | FACT | Owner direction via CEO session 2026-10-23 | C-9 would be an unfounded constraint; the state port and harness surface would be unnecessary. | High |
| MCP runs locally; Node or a Bun binary are both acceptable; runtimes must be swappable. | FACT | Owner direction via CEO session 2026-10-23 | MCP packaging could be forced to one runtime; the artifact form would be constrained. | High |
| The MCP surface mirrors the CLI capability scope where technically easy; drift happens case by case with a recorded reason. | FACT | Owner answer UQ-7, PR #163 review 5636881026, 2026-10-24 | The MCP surface could be narrower than users expect, or drift without a record. | High |
| The internal error table with static documented codes is primary; the CLI numeric exit code is a projection of it. | FACT | Owner direction via CEO session 2026-10-23; DEC-10 | Contract types would mix domain and CLI presentation; harness consumers would inherit process semantics. | High |
| Five packages are intended to publish after the naming freeze (core, adapters, cli, mcp, opencode); testkit never publishes; until the freeze all six are `private: true`; the criterion is whether a package could be embedded in other software; the set evolves from evidence. | FACT | Owner answer UQ-5, PR #163 review 5636881026, 2026-10-24; external research 2026-10-24 | A wrong publication set would change the release train, not the internal structure. | High |
| Packages are managed with pnpm workspaces, chosen for dependency isolation and publish provenance, while Bun is the pinned runtime and build target. | FACT (tool choice) / ASSUMPTION (isolation benefit) | External research 2026-10-24, owner-approved | A workspace-tool change would alter the toolchain and CI, not the package graph. | High for the choice; Medium for the isolation benefit |
| Publishing uses one lockstep version line for all published packages through a changeset fixed group; testkit is excluded; builds use tsdown or tsc; exports point at `dist` with types; publint and attw run in CI. | FACT | External research 2026-10-24, owner-approved | Release-time rework; the package graph is unaffected. | High |
| Boundaries are enforced by real `package.json` dependencies plus dependency-cruiser rules over declared entrypoints, with pnpm isolation as the intended second layer (ASSUMPTION until the workspace is verified); a package may not import a subpath outside its declared entrypoints. | FACT (tool and rule choice) / ASSUMPTION (pnpm isolation behavior) | External research 2026-10-24, owner-approved | Enforcement would weaken to review discipline if the isolation layer does not behave as expected, which is the failure this record exists to prevent. | High for the rules; Medium for the isolation layer |
| Layered configuration with built-in defaults, optional system, user-global, project committed, project local, environment, and CLI levels is the owner-approved model. | FACT | Owner answer UQ-4, PR #163 review 5636881026, 2026-10-24; external research 2026-10-24 | DEC-4 would revert to a single-file model and user or project-wide defaults would be impossible. | High |
| State retention starts at forever; custom per-user retention policies and configuration come later. | FACT | Owner answer UQ-6, PR #163 review 5636881026, 2026-10-24 | Retention defaults and storage planning would be wrong; unbounded growth risk would be unmanaged. | High |
| State stays local-first behind an implementation-neutral abstraction; shared or cloud state is a plausible future integration, with planned local, project, and maybe global levels. | FACT | Owner answer UQ-8, PR #163 review 5636881026, 2026-10-24 | The abstraction could bake local-file semantics into core rules and block later sharing. | High |
| The state directory has an override variable and a per-platform default derived from the project name. | FACT | Owner direction via CEO session 2026-10-23 | DEC-5 would be a guess; operators could not relocate state. | High |
| The install path uses a wrapper-based strangler: installs ship the new tool plus updated wrappers, and wrappers delegate to the new tool once the engine is consumed. | FACT | Owner direction via CEO session 2026-10-23 | DEC-7 and C-5/C-8 would encode a side-by-side model the owner does not want. | High |
| Installs use `main-tools` during delivery; after the tools are public-ready they merge to `main`, `main-tools` is retired, and installs move to `main`. | FACT | Owner answer UQ-2, PR #163 review 5636881026, 2026-10-24 | The installer would fetch the wrong branch during delivery or after the merge. | High |
| Dependency licensing needs a policy and an approved/rejected registry updated on each new license; the registry is committed YAML under `doc/legal/`. | FACT | Owner direction via CEO session 2026-10-23; owner answer UQ-3, 2026-10-24 | The license gate would remain a narrow deny-list with no audit artifact or no readable location. | High |
| The owner chose R3 and a formal decision-critic challenge. | FACT | Owner direction via CEO session 2026-10-23 | The record would be under-governed for an org-wide, hard-to-reverse decision. | High |
| The existing root layout stays and the bash stack runs until per-engine parity. | FACT | AGENTS.md and owner decision | Structure would need to move or replace existing directories; the strangler plan would change. | High |
| marksync-for-confluence is a single package with a tiered `src/` tree and four dependency-cruiser rules. | FACT | Local evaluation of the marksync repository, 2026-10-23 (`package.json`, `tsconfig.json`, `.dependency-cruiser.cjs`, `src/`) | The adaptation analysis would be based on a false template; package mapping could be simpler than assumed. | High |
| The four marksync dependency-cruiser rules do not enforce the full stated matrix: `infra -> app`, `app -> presentation`, and sibling-surface edges are unguarded. | FACT | marksync `.dependency-cruiser.cjs` read on 2026-10-23 | Copying the rules verbatim would leave real boundary gaps; the enforcement claim would be overstated. | High |
| marksync's application tier performs file I/O (`node:fs`) in journal and cache code. | FACT | marksync `src/app/journal.ts` and `src/app/cache.ts` read on 2026-10-23 | A literal port would make the application tier impure and harder to test; I/O placement must be decided. | High |
| marksync's journal silently skips malformed JSONL lines. | FACT | marksync `src/app/journal.ts` read on 2026-10-23 | A literal port would create lying state; ADOS needs hard failure and quarantine. | High |
| marksync-for-confluence is the owner's sibling repository; its authorship and license will be verified before any source file is copied. | FACT (ownership) / TO-CONFIRM (license) | Owner statement; repository not present locally; review CG-LEG-001 and CG-LEG-007 | If it is third-party and source is copied, the MIT grant and notice obligations must be satisfied; patterns-only reuse avoids the risk. | Medium |
| The most recent stable Bun is the initial runtime pin; the exact version is fixed at scaffold time. | FACT (policy) / TO-CONFIRM (version) | Owner direction via CEO session 2026-10-23; external research 2026-10-24 | A different pin would change the baseline but not the structure. | High |
| pnpm's isolated `node_modules` layout rejects an undeclared cross-package import at install and build time. | ASSUMPTION | pnpm documented isolation model; no ADOS workspace yet | The structural enforcement layer would be weaker; dependency-cruiser rules remain the primary gate. | Medium |
| Bun's `bun:sqlite` and single-binary compile are suitable for the default state driver and CLI packaging. | ASSUMPTION | marksync release evidence and Bun platform knowledge; no ADOS spike yet | The SQLite driver is behind a port, so the default driver could change without touching core. | Medium |
| A non-Bun SQLite driver path is available for Node and other hosts. | TO-CONFIRM | Node built-in SQLite is version-dependent; `better-sqlite3` is a candidate pending license registry approval | The state port would have no second implementation; state-backed use cases would stay Bun-hosted until a fallback is approved. | Medium |
| A SQLite driver may carry a runtime-specific dependency that would justify splitting a state driver package out of core later. | TO-CONFIRM | External research 2026-10-24; no ADOS dependency resolution yet | The six-package set would grow to seven, or the `core ./state` subpath would carry an optional runtime dependency. | Medium |
| CommonJS consumers are not required; ESM-only is acceptable for published packages. | TO-CONFIRM | External research 2026-10-24 (CJS need flagged); no consumer evidence | Dual ESM/CJS output would add a build target and an `exports.require` condition to every published package. | Medium |
| A third-party embed API (for example a plugin host's tool registration) can be satisfied by core's `createRuntime` composition API plus a thin surface. | TO-CONFIRM | External research 2026-10-24; no ADOS harness spike yet | A host-specific adapter shape would be needed, or `core` would grow a host-specific entry point it should not own. | Medium |
| The MCP SDK runs under a Bun-compiled binary or a Node-hosted process; both are acceptable. | TO-CONFIRM | Owner direction via CEO session 2026-10-23; no ADOS spike yet | The artifact form changes at scaffold, not the package boundaries. | Medium |
| No external library consumers are expected before the first publication; publication starts with the intended set and evolves from evidence. | ASSUMPTION | Owner answer UQ-5, 2026-10-24; external research 2026-10-24 | If a consumer appears early, the publish line starts earlier; the package graph does not change. | Medium |
| License compatibility of candidate dependencies (MCP SDK, Cliffy, ajv, Biome, test and release tools) is not determined here. | TO-CONFIRM | Human legal/license review is required; this record defines the policy and registry, not the verdicts | A dependency could be disallowed, changing the toolchain or adapter design. | High |
| The existing bash tests and CI can run alongside new TypeScript jobs. | ASSUMPTION | `.github/workflows/ci.yml` and `scripts/test-all.sh` read on 2026-10-23; no combined run yet | Dual-run would need a different CI topology. | Medium |
| The legacy bash exit-code convention (0-9, 100) differs from the new error table's projection. | FACT | `doc/guides/tools-convention.md` and marksync `src/cli/output/exit-codes.ts` | The new CLI could inherit inconsistent exit semantics; docs and consumers would diverge. | Medium |
| The forbidden-literal test starts from the legacy tokens already public in this repository (`ados`, `ADOS_`, `~/.ados`); the full set grows with each frozen name. | FACT (seed set) / TO-CONFIRM (frozen set) | Naming firewall decision; repository inspection | A test limited to the seed set would miss a newly frozen name, so freezing a name must add its literal in the same change. | High for the seed; Medium for the frozen set |
| The existing committed corpus and install path still contain the current name; the branding module does not cover them. | FACT | Review CG-DEC-007 (2026-10-23) and `scripts/install.sh` inspection | The "one seam" claim would be overstated; a corpus migration is required before a public rename. | High |

## Mental Models & Techniques Used

- **First principles:** What must be isolated for the tooling to remain correct under change? Contracts, pure rules, provider integrations, persistence, surfaces, composition, and names. The six-package set follows those seams rather than layer symmetry: contracts, branding, and state are core subpaths because they share core's version, runtime, and release line.
- **Separation of concerns / ports and adapters:** Domain rules know nothing about HTTP, files, SQLite, CLI flags, or a host runtime. Application use cases orchestrate through ports. Adapters implement ports. Surfaces translate input and output. One composition root wires the graph.
- **Runtime portability as a first-class axis:** Ask at every seam whether the code would still run if Bun disappeared tomorrow. The answer moves persistence behind ports, confines runtime-specific drivers to one subpath, and keeps the harness surface thin.
- **Layered defaults and least astonishment:** Configuration has an expected hierarchy (defaults, system, user, project, local, environment, flags), one schema, and visible provenance. Surprise comes from implicit merging, so merging is explicit, lists replace, and every value can name its source.
- **Inversion and premortem:** What would make this monorepo fail? Ungoverned cross-package imports, a bloated contracts subpath, duplicated utilities, package sprawl, a package per layer that nobody installs, duplicated composition wiring per surface, configuration nobody can debug, advisory CI that everyone ignores, a rename that touches every file, a state lock that corrupts on resume, and a wrapper that delegates before parity. The structure and enforcement target those failure modes.
- **Second-order thinking:** Package boundaries are cheap before publication and expensive after. The cost of a well-chosen boundary now is small; the cost of extracting a surface after users depend on a monolithic package is large. The opposite error is also real: a package per layer adds release and mapping cost with no isolation benefit.
- **Opportunity cost and cognitive load:** Every package adds a manifest, a test target, a version, and a place for an agent to make a mistake. The chosen set maximizes isolation per package rather than minimizing package count absolutely.
- **Strangler pattern:** New engines run beside the bash stack; wrappers delegate engine by engine only after parity. Structure must be additive and reversible.
- **Pareto:** A small number of well-placed boundaries captures most of the isolation benefit. More packages would enforce more edges but cost more attention than the solo developer can repay.
- **Reversibility:** Before the first public release, package boundaries are moderate to reverse. After package names, config paths, and telemetry schemas are public, reversal is hard. The decision front-loads the rename seam and defers publication.
- **Sensitivity:** The largest uncertainties are the non-Bun driver, the OpenCode harness form, publication timing, the license verdicts, and the CJS question. None changes the package graph; each changes packaging, defaults, or release timing.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| Alternative | C-1 | C-2 | C-3 | C-4 | C-5 | C-6 | C-7 | C-8 | C-9 | C-10 | C-11 |
|-------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Alt 0 - Do nothing / bash only | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Risk | Yes | Yes |
| Alt 1 - Root `packages/` with six packages (chosen) | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Alt 2 - Single package with tiered `src/` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Alt 3 - `tooling/` subtree monorepo | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Alt 4 - Maximal per-tier packages | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Alt 5 - Sibling CLI repository | No | Yes | Risk | Yes | Risk | Yes | Risk | Risk | Yes | Yes | Yes |

Legend, aligned with the record template: `Yes` = passes; `No` = fails a `negotiable: no` constraint and is disqualified; `Risk` = an accepted-risk exception, which is valid only for a `negotiable: yes` constraint. Every constraint in this record is `negotiable: no`, so no alternative can pass one through an accepted-risk exception: a `negotiable: no` failure is written as `No`. Where an eligible alternative meets a constraint by convention or with a documented enforcement gap, the table records `Yes` and the gap is stated in that alternative's constraint-compliance and driver-fit text (Alt 2, C-9). For an alternative already disqualified by another constraint (Alt 0, Alt 5), `Risk` is not an exception; it records design exposure that would need mitigation if the alternative were eligible. Alt 0 fails C-1 because it does not deliver the committed TypeScript monorepo. Alt 2 meets C-9 by design inside one package but has no package-level enforcement against a runtime leak; that gap is recorded in its driver fit. Alt 5 fails C-1 (one OSS monorepo) and would put C-3, C-5, C-7, and C-8 at risk because installation, naming, and gate parity would span repositories.

### Alternative 0 - Do Nothing / Keep the Bash-Only Stack

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Continue with the bash delivery stack and add no TypeScript monorepo.
- **Constraint compliance:** Fails C-1; satisfies the remaining constraints vacuously or by inaction, with C-9 at risk.
- **Driver fit:** Lowest on every driver except short-term cost; no boundary enforcement, no shared core for the surfaces, no state schema, no configuration levels, no rename seam.
- **Pros:** Zero migration cost; no new toolchain; no new CI jobs.
- **Cons:** The committed OSS scope is undeliverable; bash contracts remain implicit; the rename risk grows with every new script; MCP and harness tools cannot share a typed core.
- **Why rejected:** It does not satisfy the committed scope. This is the baseline, not a viable option.

### Alternative 1 - Root `packages/` Monorepo with Six Packages (Chosen)

- **Eligibility:** Eligible (passes C-1 through C-11).
- **Summary:** Add a root pnpm workspace under `packages/` with `core` (subpaths `.`, `./contracts`, `./state`, `./branding`), `adapters`, `cli`, `mcp`, `opencode`, and a private `testkit`. Keep the tier matrix inside `core` (`domain`, `app`, `config`, `branding`, `state`) and enforce package-level and subpath-level edges with real dependencies, pnpm isolation (expected; ASSUMPTION pending verification), package `exports`, dependency-cruiser rules over declared entrypoints, an ambient-global guard, and negative tests. Compose surfaces once, through `createRuntime` in `core`.
- **Constraint compliance:** Passes all constraints. C-1 is satisfied by one additive monorepo. C-2 and C-7 are explicit CI, registry, notices, provenance, and install work. C-3 is satisfied by the branding module plus the legacy compatibility adapter, the forbidden-literal test, the ambient-global negative fixture for branding, and the rename drill inside `packages/**`, with the corpus migration tracked separately. C-4 is satisfied because no cloud package exists. C-5 and C-8 are satisfied by the wrapper-based strangler and per-engine parity gate. C-6 is satisfied because nothing moves. C-9 is satisfied by a runtime-neutral core contract surface, a state driver port with a non-Bun fallback path, and harness surfaces that consume public entry points. C-10 and C-11 are satisfied by the release, supply-chain, and privacy gates.
- **Driver fit:** Best on boundary enforcement, runtime portability, testability, rename safety, and future extraction, at six packages. The `./contracts` subpath lets adapters import core without importing core runtime internals. `createRuntime` removes duplicated composition wiring across the three surfaces. A dedicated thin OpenCode surface keeps harness integration from leaking into `cli` or `mcp`.
- **Pros:** Clear homes for every artifact class; one shared core for CLI, MCP, and harness tools; adapters depend only on core; state is replaceable and driver-pluggable; branding is a core module whose values the composition roots inject; testkit is dev-only and never shipped; a future split of a provider or a state driver has an obvious seam; the publish path is designed now.
- **Cons:** Six packages still carry workspace manifests, a lockstep version line, and CI matrix cost; the `contracts` subpath can become a dumping ground without review discipline; a single `adapters` package can accumulate dependency weight; `core ./state` carries a runtime-specific dependency that a separate state package would isolate; two toolchains (pnpm for dependencies, Bun for runtime and build) must both stay pinned.
- **Why chosen:** It is the smallest package set that makes the important boundaries mechanical, keeps the core contract surface runtime-neutral, keeps the rename seam in one module, and keeps composition in one place. It passes every constraint and wins on the highest-ranked drivers.

### Alternative 2 - Single Package with a Tiered `src/` Tree

- **Eligibility:** Eligible (passes C-1 through C-11).
- **Summary:** Copy the marksync single-package shape into the ADOS repository: one root package, `src/domain`, `src/app`, `src/cli`, `src/infra`, `src/shared`, with dependency-cruiser enforcing tiers inside one tree.
- **Constraint compliance:** Passes all constraints on paper. C-1 is satisfied because it is one repository; C-3 is satisfiable with a branding module inside the package; C-7 is satisfiable with one binary artifact. C-9 is met by design inside one package: the ambient-global, runtime-import, and driver-port rules apply to the domain and application tiers as they do to `packages/core`. The gap is enforcement, not capability: with no package boundary, a runtime leak is caught only by the lint and dependency-cruiser rules inside one tree.
- **Driver fit:** Strong on time to first slice and simplicity, weak on boundary enforcement, adapter replaceability, harness isolation, and future extraction. CLI, MCP, and harness consumers would share one dependency graph and one package boundary, and publication would force the whole tree into one package. C-9 carries a documented enforcement gap: a Bun or Node API can reach the domain tier unless every rule and fixture is maintained perfectly inside one tree, so the design relies on review discipline where Alt 1 relies on package entrypoints.
- **Pros:** Fastest first scaffold; one manifest, one lockfile, one tsconfig, one test target; proven by marksync; the least new tooling.
- **Cons:** No package-level enforcement between surfaces, adapters, and persistence; MCP SDK and provider dependencies live in the same package as core; a surface can import `src/infra` unless a rule catches it; branding and forbidden-literal allowlists become broad; publishing one package for every consumer type is a poor fit; extracting a package later is a refactor across the tree.
- **Why rejected:** It satisfies the constraints but loses on the highest-ranked drivers: boundary enforcement, testability of surfaces, runtime portability, and future extraction. It optimizes the first month at the expense of the next year.

### Alternative 3 - `tooling/` Subtree Monorepo

- **Eligibility:** Eligible (passes C-1 through C-11).
- **Summary:** Keep the repository root as-is and place the workspace under `tooling/` with `tooling/packages/*`, `tooling/package.json`, and `tooling/tsconfig.base.json`.
- **Constraint compliance:** Passes all constraints. Installation and CI can point into the subtree.
- **Driver fit:** Slightly better root cleanliness than Alt 1, worse on cognitive load, tool discovery, and standard tooling behavior.
- **Pros:** The root stays visually clean; the new tooling is grouped under one obvious directory; existing docs and scripts are untouched.
- **Cons:** Adds a second concept (`tooling/packages` versus `packages`); workspace root is nested, so root-level scripts, lockfiles, IDE discovery, and CI paths are nonstandard; install and documentation paths get longer; agents must learn a layout that buys no boundary or testing benefit.
- **Why rejected:** It passes the constraints but loses on the cognitive-load and agent-legibility drivers without improving isolation.

### Alternative 4 - Maximal Per-Tier Packages

- **Eligibility:** Eligible (passes C-1 through C-11).
- **Summary:** Make every tier, every provider, and every core subpath its own package: `contracts`, `domain`, `app`, `config`, `branding`, `state`, `adapters-gitlab`, `adapters-jira`, `adapters-github`, `adapters-azure`, `cli`, `mcp`, `opencode`, `testkit`, and so on.
- **Constraint compliance:** Passes all constraints; gives the strongest possible package-level enforcement.
- **Driver fit:** Best on isolation and independent versioning, worst on cognitive load, package count, and cross-package type churn for a solo developer.
- **Pros:** Every edge is explicit; adapters can version and publish independently; dependency weight is minimal per package; extraction is trivial.
- **Cons:** Twelve or more packages for one developer; cross-package type changes ripple through manifests and releases; a version matrix appears before there are external consumers; import ceremony and CI matrix cost grow faster than value; most of the packages would never be installed directly by a user.
- **Why rejected:** It over-fragments. The chosen set captures the high-value seams while keeping the core tiers inside one package, where they are still enforced.

### Alternative 5 - Sibling CLI Repository

- **Eligibility:** Not eligible (fails C-1; C-3, C-5, C-7, and C-8 at risk).
- **Summary:** Keep the methodology repository as-is and create a separate repository for the TypeScript CLI, MCP server, harness surfaces, and adapters.
- **Constraint compliance:** Fails C-1 (one OSS monorepo). Installation would span repositories, and gate parity would need cross-repository coordination, putting C-5, C-7, and C-8 at risk.
- **Driver fit:** Good on independent release cadence and a clean public narrative; poor on strangler coexistence, dual-run testing, and one-PR changes across tooling and process.
- **Pros:** Independent semver and release cadence; the methodology repository stays Markdown and bash; a clean product narrative is easier.
- **Cons:** Two PR flows and two CI systems; cross-repository changes for a single engine; install.sh in the methodology repository would fetch artifacts from another repository; the naming firewall spans two repositories; the strangler dual-run is harder to keep honest.
- **Why rejected:** It violates the one-monorepo constraint and weakens the coexistence gates that make the strangler safe.

## Decision

**Adopt Alternative 1.** Add a root `packages/` pnpm workspace with six packages, use pnpm for dependency management and Bun (pinned) as the runtime, build, and packaging target, keep the tier matrix inside `core`, keep adapter and surface boundaries at package level and core subpath level, and keep the existing repository layout in place. The decision is recorded as ten sub-decisions, each with the options considered, the recommendation, and a constraint and driver fit note.

### DEC-1 - Repository structure: root `packages/` with six packages

**Options considered:**

- Alt 0: do nothing (rejected, C-1).
- Alt 1: root `packages/` with six packages (chosen).
- Alt 2: single package with tiered `src/` (rejected on drivers).
- Alt 3: `tooling/` subtree (rejected on cognitive load).
- Alt 4: maximal per-tier packages (rejected on over-fragmentation).
- Alt 5: sibling repository (rejected, C-1).

**Recommendation:** Use the following package set. The intended publish set is five packages (`core`, `adapters`, `cli`, `mcp`, `opencode`); `testkit` is dev-only and never publishes. Until the naming freeze, all six packages carry `private: true`, and the release job has a publish guard that fails if any intended publishable package is still private or if the branded scope has not been applied, so an accidental pre-freeze publish is blocked twice: at the manifest and at the release job. The freeze change sets `private: false` on the five intended packages, applies the branded scope, and removes the guard in one reviewed change. Every package declares in its `exports` map the entry points it exposes, and every package declares which entrypoints of its workspace dependencies it may import.

```text
packages/
  core/           Publishable after the freeze (private: true until then). Domain and application logic, ports, result and
                  exit-code types, schema constants, branding module, state
                  ports plus local JSONL/SQLite drivers, and one composition root.
                  Subpaths: . | ./contracts | ./state | ./branding
    src/domain/     Pure rules; no I/O; no runtime APIs
    src/app/        Use-case orchestration; no I/O; ports injected
    src/config/     Schema, defaults source, layered merge, validation, provenance
    src/branding/   The single name seam: product name, binary name, environment
                    prefix, config directory; a pure resolver whose environment
                    override is read at a runtime-aware edge (a surface or a
                    composition root with injected environment facts), never
                    inside this module
    src/state/      Implementations of the state ports declared in ./contracts:
                    local JSONL and SQLite drivers, migrations, and the writer
                    lock with fencing
  adapters/       Publishable after the freeze (private: true until then). GitLab, Jira, GitHub, Azure, and CI adapters plus the
                  non-provider I/O adapters (repo, file, host, session, legacy)
                  and the provider registry; imports core only; per-provider and
                  per-I/O subpaths. Publishing this package makes the metadata-only
                  SessionStore and HostPort contracts a public API obligation.
  cli/            Publishable after the freeze (private: true until then). Binary, argument parsing, rendering; the argument
                  framework is confined here; imports core and adapters.
  mcp/            Publishable after the freeze (private: true until then). MCP entrypoint mapping tools and resources to core
                  application services; .mcpb manifest; imports core and adapters.
  opencode/       Publishable after the freeze (private: true until then). Plugin and tool wrapper around core services; depends
                  on @opencode-ai/plugin as a peer; imports core and adapters.
  testkit/        Private (private: true), dev-only. Fakes, trap catalogs, and
                  conformance scenarios shared by all surfaces; never appears in
                  a published package's dependencies.
```

Core subpath contracts. Throughout this record, `core ./state` means the `./state` subpath of `packages/core`:

- `.` - the application service API and `createRuntime({ config, adapters, store, clock })`, the one composition root. It returns the wired application services. Every surface calls it; no surface re-implements wiring.
- `./contracts` - the shared language: `Result`, the error table and stable codes, exit-code types, schema version constants, port interfaces and DTOs, and the `BrandIdentity` type. Runtime-neutral and I/O-free.
- `./state` - the local JSONL and SQLite driver implementations, migrations, rebuild, and the writer lock. This is the only core subpath allowed to import runtime APIs. A host that cannot run these drivers imports `./contracts` and supplies its own driver.
- `./branding` - the pure branding values and the strings derived from them. The resolver accepts the environment override as an argument and performs no ambient environment read. A runtime-aware edge (a surface, or a runtime-aware composition root that receives injected environment facts) reads the override and passes it in.

Root workspace files: `pnpm-workspace.yaml` (workspace globs), a private root `package.json` with a pinned `packageManager` field, one `pnpm-lock.yaml`, `tsconfig.base.json`, a solution `tsconfig.json`, `biome.json`, `commitlint.config.js`, `.dependency-cruiser.cjs`, `.bun-version` and `engines.bun`, and the extended CI workflow. New `.gitignore` entries cover `node_modules/`, `dist/`, `packages/*/dist/`, local state, and the project-local config file. The project-local config stays untracked through a brand-free glob that matches the branded directory without naming it (`.*/config.local.yaml`, a dot-directory at the repository root; the embedded slash anchors the pattern to the repository root, so it does not match a nested dot-directory); the rename drill asserts that the root `.gitignore` still matches the renamed path, so the ignore rule is not part of the branding seam and cannot drift with a rename.

Public entry points are declared through each package's `exports` map. Deep imports into another package's `src/` are forbidden, including relative imports such as `../../core/src/domain/foo`. No package may import a subpath of another package that is not listed in its declared entrypoints. `core` exposes the four subpaths above and nothing else; domain internals are never exported. `adapters` uses one subpath per provider (`./gitlab`, `./jira`, `./github`, `./azure`, `./ci`) plus `./registry` and the non-provider I/O subpaths (`./repo`, `./file`, `./host`, `./session`, `./legacy`) named in DEC-6. Because `adapters` is published, the metadata-only `SessionStore` and `HostPort` contracts are a public API obligation: their metadata-only guarantee is part of the published contract, and any widening of what they surface is a semver-visible change.

**Composition root (resolved):** `createRuntime` in `core` is the single place where configuration, adapters, state, and the clock are combined. A surface passes its adapter and driver instances plus the resolved configuration; `core` returns application services. This removes the per-surface composition duplication that an earlier revision accepted and makes the surfaces thin by construction. Whether a third-party embed API (for example a plugin host's tool registration) can consume `createRuntime` directly or needs a host-specific shim is a TO-CONFIRM item, not a reason to add a second composition root.

**Harness consumption model (resolved):** OpenCode gets a dedicated thin surface package, `packages/opencode`, because it is a committed deliverable with a known host. Pi.dev and other TypeScript plugin harnesses consume the documented `core` `.` and `./contracts` entry points, with dependencies injected by the host, and no dedicated package until a harness-specific shape is proven. Neither model permits a harness to import `core/src/**`, another surface, or an undeclared subpath. The OpenCode surface depends on `@opencode-ai/plugin` as a peer dependency so the host supplies exactly one plugin runtime.

**Where the shared modules live:**

- `Result<T,E>`, the internal error table and stable codes, the exit-code types, the event envelope and schema version constants, port interfaces and DTOs, the `BrandIdentity` type, and the pure redactor live in `packages/core` `./contracts`.
- Domain-error-kind to stable-error-code translation lives in `packages/core` (application tier).
- `CommandResult` and the stable-code to numeric-process-exit mapping live in `packages/cli`, because only the standalone CLI owns process semantics. MCP and OpenCode propagate stable codes from `./contracts`, never process exit codes.
- The branding values live in `packages/core/src/branding` and are exposed through `./branding`. The module is a pure resolver: a runtime-aware edge (a surface, or a runtime-aware composition root with injected environment facts) reads the environment override and passes it in; the module itself never reads `process.env`, `Bun.env`, or any ambient global. Surfaces read the resolved values and pass them into `createRuntime`. Domain and application code never import them.
- Provider error classification, retry and timeout defaults, provider probes, and the provider registry live in `packages/adapters`.
- The JSONL writer, SQLite index, driver implementations, schema migrations, and writer lock live in `packages/core` `./state`, behind ports declared in `./contracts`.
- Provider selection policy (ordering, budget, hysteresis, park and unpark decisions) lives in `packages/core` (application tier); hysteresis and park state is persisted through the state ports.

**Fit:** This is the smallest set that gives every artifact class a home while keeping the contract surface runtime-neutral, giving harness consumers one public entry point, and keeping composition in one place. It satisfies C-1, C-3, C-7, C-9, and C-10 structurally and ranks first on boundary enforcement (rank 1) and fifth on rename safety (rank 5). The cost compared with a single-package design is one workspace, one publish line, and one extra layer of build configuration.

**Rejected alternative:** A separate package per core concern (contracts, branding, state). It adds three release units and three composition seams without adding isolation: the subpaths already prevent cross-tier imports, and these modules share core's version, runtime, and release line. They are subpaths until one of them acquires an independent release cadence, an external maintainer, or a heavy runtime-specific dependency.

### DEC-2 - Tier and dependency rules across packages

**Options considered:**

- (a) Document the rules and rely on review.
- (b) Enforce package-level edges only, with no internal tiers or subpaths.
- (c) Enforce package-level edges, declared core subpaths, internal `core` tiers, and pnpm dependency isolation (chosen).
- (d) Make every tier a separate package (rejected, Alt 4).

**Recommendation:** Adopt (c). The package graph is acyclic and follows this matrix.

| Importer / Imported | core | adapters | cli | mcp | opencode | testkit |
|---------------------|:---:|:---:|:---:|:---:|:---:|:---:|
| core | - | no | no | no | no | no |
| adapters | yes | - | no | no | no | no |
| cli | yes | yes | - | no | no | no |
| mcp | yes | yes | no | - | no | no |
| opencode | yes | yes | no | no | - | no |
| testkit | yes | yes | no | no | no | - |

Subpath permissions. A `no` here is a forbidden edge, and a subpath that is not listed is forbidden for that importer:

| Importer | core `.` | core `./contracts` | core `./state` | core `./branding` |
|----------|:---:|:---:|:---:|:---:|
| core (internal tiers) | - | yes | yes | yes |
| adapters | no | yes | no | no |
| cli | yes | yes | yes | yes |
| mcp | yes | yes | yes | yes |
| opencode | yes | yes | yes | yes |
| testkit | yes | yes | yes | yes |

Additional rules:

- `core` has no workspace dependencies. Its domain and application tiers are pure; its contracts surface is the shared language, not a utility drawer. A type belongs there only if it crosses a package boundary or a runtime boundary.
- `core` internal tiers: `domain` may import `./contracts` only; `app` and `config` may import `./contracts` and the state ports; `branding` may import `./contracts` only (for the `BrandIdentity` type) and is a pure resolver that reads no ambient environment; `state` implements the ports declared in `./contracts`. `domain` must never import the CLI exit-code projection, the state drivers, the filesystem, or a runtime API.
- `adapters` depends on `core` only, and only on `.` and `./contracts`. It never imports `core ./state` (a driver is chosen by the composition root, not by an adapter), `core ./branding` (brand values are injected), a surface, or `testkit` in production code. Provider subpaths may share an internal HTTP, retry, and timeout module but must not import each other. No provider SDK may appear in `core` or a surface.
- `cli`, `mcp`, and `opencode` are sibling surfaces. None imports another. The argument-parsing framework is confined to `cli`; the MCP SDK is confined to `mcp`; host APIs are confined to `opencode`. All call the same `createRuntime` composition root.
- `testkit` is dev-only and `private: true`. No published package may list it in `dependencies` or `peerDependencies`.
- `core` `.`, `./contracts`, and `./branding` are runtime-neutral: no `bun:*`, no `node:*`, no `process`, no `Bun`, no `Deno`, no ambient clock or randomness, no filesystem or network globals, and no ambient environment read. In `./branding` this is explicit: the environment override arrives as an argument from a runtime-aware edge, and the module never reads `process.env` or `Bun.env`. Time and identifiers come from ports. Runtime APIs are confined to the `core ./state` driver code, the adapter I/O subpaths, the CLI build, and the OpenCode host integration. *(Editorial pointer: [ADR-0005](ADR-0005-runtime-confinement-provider-client-subpaths.md) refines the adapter I/O reading — provider client subpaths performing network I/O are admitted per subpath as exact, reason-bearing entries; the provider registry subpath stays non-I/O.)*
- No package may import another package through a relative path that escapes its own root. Cross-package imports use the declared package name and a declared subpath only. Because pnpm is expected to install an isolated dependency graph (ASSUMPTION until the scaffold verifies it), an undeclared cross-package import should also fail to resolve at install and build time; that is a second enforcement layer once verified, not a substitute for the rules below.

Inside `core`, enforce this tier matrix:

| From / To | domain | app | config | branding | state | ./contracts |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|
| domain | - | no | no | no | no | yes |
| app | yes | - | yes | no | ports only | yes |
| config | no | no | - | no | no | yes |
| branding | no | no | no | - | no | yes (type only) |
| state | no | no | no | no | - | yes |

Dev-edge rules for `testkit`:

| From | To `testkit` | Allowed | Enforcement |
|------|:---:|:---:|-------------|
| `packages/*/src/**` | yes | no | dependency-cruiser plus a negative fixture per package |
| `packages/*/test/**`, `*.test.ts`, `*.spec.ts`, fixtures | yes | yes, via `devDependencies` | dependency-cruiser plus a passing fixture |
| root `e2e/**` and `bdd/**` | yes | yes, via root `devDependencies` | dependency-cruiser plus a passing fixture |
| `testkit/src/**` | - | may import `core` and `adapters`; never `cli`, `mcp`, or `opencode` | dependency-cruiser |

Enforcement is mechanical, not advisory:

- `package.json` `exports` maps prevent deep imports. The map is the public contract; `src` is never an exported subpath in a published package.
- Each package declares in its own manifest which entrypoints of its workspace dependencies it may import. Dependency-cruiser reads those declarations, so a new allowed edge requires a manifest change and a review, not a comment.
- A CI "public entry point" check verifies that every workspace import resolves through a declared subpath, that no `exports` target points at `src`, that `exports` targets point at `dist` with a `types` condition, and that no deep or relative cross-package import exists.
- pnpm's isolated `node_modules` is expected to reject an undeclared dependency at install and build time (ASSUMPTION until the scaffold verifies it); no `hoist-pattern` or `shamefully-hoist` setting may be added to weaken this without recording the reason.
- One root dependency-cruiser configuration checks the package matrix, the core subpath matrix, the core tier matrix, the testkit dev-edge table, and the runtime-API confinement rules.
- An AST or lint guard rejects ambient runtime globals in the runtime-neutral core tiers, including `packages/core/src/branding`; dependency-cruiser alone cannot see a global.
- Negative-test fixtures prove that each forbidden edge fails, including a cross-package relative import (`../../core/src/domain/...`), an `adapters -> core ./state` import, an `adapters -> core ./branding` import, a `src` import into `testkit`, a `domain -> app` import, a `cli -> mcp` import, a `node:fs` import in the domain tier, and a `process.env` or `Bun.env` read in `packages/core/src/branding`. A rule without a failing fixture is treated as unenforced.
- A CI check verifies that every imported workspace package and subpath is declared in the importing package's manifest, and that a `testkit` import appears only in dev dependencies.
- No `|| true`, no `continue-on-error` on a gate, and no advisory boundary job. Informational benchmarks may be non-blocking only when they cannot fail a merge.

**Fit:** This is the mechanism that converts C-9 and the architecture drivers into executable rules. It ranks first on boundary enforcement (rank 1), sixth on testability (rank 6), and seventh on determinism (rank 7). Its cost is CI time and rule maintenance, which is accepted because an unenforced boundary is worse than no boundary at all.

**Rejected alternative:** Copying marksync's four rules. They do not cover `infra -> app`, `app -> presentation`, sibling surfaces, subpaths, testkit dev edges, relative cross-package imports, or the runtime-API confinement that the monorepo needs.

### DEC-3 - Runtime, package manager, and toolchain

**Options considered:**

- (a) pnpm workspaces for dependency management, publishing, and isolation; Bun pinned as the runtime and build target; ESM; strict TypeScript; Biome; commitlint plus husky; dependency-cruiser (chosen).
- (b) Bun workspaces with `bun install` for everything.
- (c) Node with npm or pnpm and no Bun pin.
- (d) Independent per-package toolchains and versions.

**Recommendation:** Adopt (a), with one root configuration for the workspace. The package manager and publishing model below are the owner-approved conclusions of external research 2026-10-24.

- **Package manager:** pnpm workspaces. The repository has one `pnpm-workspace.yaml`, one `pnpm-lock.yaml`, and a root `packageManager` field pinning the exact pnpm version. pnpm is chosen for two reasons that matter after publication: dependency isolation as the intended second enforcement layer (a package can only import what it declares, which makes the boundary rules structural rather than advisory; this is an ASSUMPTION until the scaffold verifies it) and publish provenance (a package published from a pnpm workspace resolves its dependencies from the same lockfile that CI verified). Bun workspaces and npm workspaces are rejected as the dependency layer; Bun remains the runtime and build target.
- **Runtime pin:** Use the most recent stable Bun release at scaffold time. The exact version is fixed in the scaffold change, recorded in `.bun-version`, `engines.bun`, the CI matrix, and the release build, and checked for equality by CI (the four-copy check required by C-7). Bumping is a reviewed change; never float the version. Bun is the development, test, build, and single-binary packaging runtime; it is not a semantic dependency of the runtime-neutral core tiers.
- **Runtime portability:** The core contract surface and the domain and application tiers compile and test under both Bun and a second host (Node) and contain no runtime imports or ambient globals. A runtime-portability smoke suite runs the contract and core test suites under Node in CI. A packed-artifact import test proves that `core` `.`, `core ./contracts`, and `core ./branding` load without any state driver and that only `core ./state` requires the driver, and a Node import smoke imports `core` `.` from the packed artifact. Bun-specific APIs are confined to `core ./state`, the CLI build, and host adapters.
- **Build:** `tsdown` or `tsc` produces `dist` for every published package; the scaffold chooses one and records the choice in the change spec. Every `exports` entry points at `dist` with a `types` condition; no `exports` target points at `src`. `publint` and `attw` run in CI for every publishable package, so a broken `exports` map or a type-resolution mismatch fails before a release rather than after an install.
- **Host runtimes:** The supported consumption matrix is CLI (Bun-compiled binary or published package), MCP (local process; either Bun or Node acceptable), OpenCode native tool (TypeScript in the OpenCode host), and Pi.dev or another TypeScript plugin harness (library consumer with injected ports). Adding a runtime is a packaging and composition change, not a core change.
- **State driver:** The state ports live in `core ./contracts`. The default implementation lives in `core ./state`, with `bun:sqlite` as the Bun path and an approved non-Bun path (`node:sqlite` where the supported Node version provides it, otherwise an approved pure-JS or native driver selected through the license registry). The fallback is chosen at scaffold; the port is mandatory regardless. A runtime without an approved SQLite driver runs in the documented degraded mode: read-only JSONL without SQLite indexes, with index rebuild requiring an approved driver. If the SQLite driver's runtime-specific dependency proves to be a real burden on consumers, that is the documented trigger to split a state driver package out of `core`; it is a TO-CONFIRM item, not a pre-emptive package.
- **MCP artifact form and lifecycle:** The MCP server runs locally and is published as a package with a `.mcpb` manifest; it may additionally ship as a Bun binary or a Node entry point. The concrete artifact form is a scaffold-step decision recorded in the scaffold change; every form must be registered in `install.sh` and covered by the release smoke test. The MCP process defines startup and shutdown, health and readiness, concurrency limits, a log channel, and runbooks for state error codes; these are milestone gates. Mutating tools require authorization and confirmation, and MCP inputs and outputs are treated as untrusted for prompt injection. MCP v1 mirrors the CLI capability scope wherever it is technically easy; a deliberate divergence is allowed case by case and must record its reason in the change spec (owner answer UQ-7, 2026-10-24).
- **CLI startup time:** Startup time is measured in the release smoke test with a budget set at scaffold. It is a selection consideration between packaging forms, not a structural constraint; the owner expects comparable performance and does not want startup time to dominate the design.
- **Modules:** ESM everywhere (`"type": "module"`, `moduleResolution: "bundler"`, `verbatimModuleSyntax`, `isolatedModules`). ESM-only is the v1 position; whether a published package also needs a CommonJS entry point is a TO-CONFIRM item that would add one build target and one `exports.require` condition, not a redesign.
- **TypeScript:** One `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, and `noUncheckedSideEffectImports`. Per-package `tsconfig.json` files enable `composite`, declarations, and source maps; a root solution `tsconfig.json` builds with `tsc -b`.
- **Lint and format:** One root Biome configuration. Biome checks formatting and lint; `tsc` owns type correctness. No type-aware lint duplicate.
- **Commits:** One root commitlint configuration and a husky `commit-msg` hook. CI runs commitlint against `origin/main-tools` and the pull-request base; the local hook is convenience, not authority.
- **Boundaries:** One root dependency-cruiser configuration over `packages/`, with the rules and fixtures from DEC-2.
- **Tests:** Per-package unit, integration, and package-local golden tests; root-level `e2e-mock`, live `e2e`, and `bdd` suites for cross-package contracts. `e2e-mock` is secrets-free and runs on every pull request. Live `e2e` runs only with credentials and is never a merge blocker for ordinary changes.
- **Versioning and release:** One lockstep version line for the five intended publishable packages, managed as a changesets fixed group. `testkit` is private and excluded from the group and from every published dependency graph. One version, one tag, one release train. Build the CLI binary and the MCP artifact, publish the five packages after the naming freeze, and attach `SHA256SUMS`, a signature, a CycloneDX SBOM, and `THIRD-PARTY-NOTICES` (or a `licenses/` bundle).
- **Library publish path (designed now, published after the naming freeze):** The published set starts with `core`, `adapters`, `cli`, `mcp`, and `opencode`; the criterion is whether a package could be embedded in other software in principle, and the set evolves from evidence (owner answer UQ-5, 2026-10-24). Publication is blocked on the branding freeze (UQ-9) because package names carry the brand scope. Until the freeze, all six packages carry `private: true` and the release job runs a publish guard that fails when the branded scope has not been applied or an intended publishable package is still private; the freeze change sets `private: false` on the five intended packages, applies the branded scope, and removes the guard in one reviewed change. The release step publishes from the fixed group with `publishConfig` pointing at `dist`, `files` restricted to build output and notices, and provenance attestation. `publint` and `attw` are release blockers, and a packed-import smoke test runs on every release so the publish path does not rot.
- **CI:** Existing bash jobs stay. New TypeScript jobs are added and binding: install with a frozen pnpm lockfile, typecheck, Biome, unit and integration tests, boundary negative tests, runtime-portability smoke, packed-artifact import test, `publint` and `attw`, license-registry audit, vulnerability scan, and binary smoke. The fast loop targets a practical duration; liveness work moves to separate jobs, not to advisory gates.

**Fit:** This satisfies C-9 directly and C-7 through the pin-equality check, while keeping time to first slice affordable. It ranks second on solo-developer efficiency and seventh on determinism. The cost is two pinned tools (pnpm and Bun) instead of one, a runtime-portability CI job, and the driver abstraction that a Bun-only design would not need; that cost is the price of the owner's portability and publishability requirements, and it is lower than the cost of a package per core concern.

**Rejected alternative:** Bun workspaces with `bun install`. It is simpler and would work for a private, unpublished workspace, but it gives weaker dependency isolation (an unresolved import can be hoisted into reach) and a less proven publish provenance path, which are exactly the properties the boundary rules and the publication plan depend on. Node with pnpm and no Bun pin is rejected because marksync proves the Bun compile and test path and the owner selected Bun as the runtime baseline.

### DEC-4 - Configuration levels and precedence

**Options considered:**

- (a) Layered configuration: built-in defaults, optional system, user-global, project committed, project local, environment, CLI flags, with one schema and per-key provenance (chosen).
- (b) Built-in defaults, one repository file, environment, and CLI flags, with central or template inheritance deferred.
- (c) Environment first, then file (strict twelve-factor).
- (d) Executable configuration in TypeScript.

**Recommendation:** Adopt (a). Owner direction (UQ-4 answer, 2026-10-24): follow best practice and support per-project and per-user configuration levels with reasonable defaults provided by the tool. The precedence chain, merge semantics, and validation rules below are the owner-approved model from external research 2026-10-24.

**Precedence, lowest to highest:**

| # | Layer | Location | Required |
|---|-------|----------|----------|
| 1 | Built-in defaults | one typed defaults source in `core/src/config/defaults.ts`; a missing default is a compile error | always |
| 2 | System | platform-specific, see the platform table below | optional |
| 3 | User-global | platform-specific, see the platform table below | optional |
| 4 | Project committed | `<repo>/.<product>/config.yaml` | optional |
| 5 | Project local | `<repo>/.<product>/config.local.yaml`, gitignored | optional |
| 6 | Environment variables | the curated `<PRODUCT>_*` typed mapping | optional |
| 7 | CLI flags | the current invocation | optional |

**Platform locations for the system and user-global layers (mirrors the DEC-5 platform table):**

| Platform | System | User-global |
|----------|--------|-------------|
| Linux | `$XDG_CONFIG_DIRS/<product>/config.yaml`, first existing directory in `$XDG_CONFIG_DIRS` order; default `/etc/xdg/<product>/config.yaml` | `$XDG_CONFIG_HOME/<product>/config.yaml`; default `$HOME/.config/<product>/config.yaml` |
| macOS | `/Library/Application Support/<product>/config.yaml` | `$HOME/Library/Application Support/<product>/config.yaml` |
| Windows | `%PROGRAMDATA%/<product>/config.yaml` | `%APPDATA%/<product>/config.yaml` |

The precedence is unchanged and platform-independent: system is lower than user-global, which is lower than project committed. Both layers are optional on every platform, and a missing file is skipped with a recorded reason. `$XDG_CONFIG_DIRS` and `$XDG_CONFIG_HOME` are consulted only on Linux.

A restrict-only policy overlay (a layer that can tighten but never loosen values, for example a managed policy) may be added later. It is not part of v1 and does not change the chain above.

**Merge semantics:** the resolver produces one resolved tree with per-key provenance, not a concatenation of files.

- Maps merge recursively by key. A key present in a higher layer wins for that key only.
- Scalars replace the lower value.
- Lists replace the whole value. There is no union or append by default; additive behavior exists only through explicitly named fields whose schema says so.
- An explicit `reset: [dotted.paths]` clears a lower-layer value for the listed paths, so a user or project layer can unset an inherited key without inventing a sentinel.
- `null` is invalid unless the schema for that key explicitly allows it.
- Environment variables map through a typed key mapping: `<PRODUCT>_SERVER__PORT` maps to `server.port`, and an unknown or unmapped environment key is an error under the same unknown-key rule. This typed mapping is the only environment mechanism in v1. In-file interpolation (`{env:...}` and `${VAR:-default}`) is not supported and is rejected as an unknown or invalid value; a file cannot read the environment.

**Debug and explainability:**

- Ship `config debug`, which prints `key | value | origin`.
- Ship `config get <key> --show-origin`, which prints the winning value and its origin.
- Origin grammar is fixed per layer so a non-file value never invents a file or line:
  - File-backed layers (defaults, system, user-global, project committed, project local): `layer=<layer> file=<path> line=<n>`.
  - Built-in defaults: `layer=defaults file=core/src/config/defaults.ts line=<n>`.
  - Environment: `layer=environment env=<PRODUCT>_KEY`, with no file or line.
  - CLI flags: `layer=cli flag=<--flag>`, with no file or line.
- Print the list of loaded files and the list of skipped layers, including why a layer was skipped.
- In CI (`CI=true`), the system and user-global layers and the project-local layer are disabled by default so a pipeline cannot pick up a developer's machine configuration. An explicit flag may re-enable them for a deliberate test. A CI-disabled layer is reported in the skipped list with the reason `ci-disabled`.

**Validation:**

- One JSON Schema for the resolved configuration, published as `$schema` so editors and CI can validate the same contract.
- Validate every layer against the schema, then validate the merged result. A layer error names the layer and the line.
- Unknown keys are errors, except the reserved keys `$schema`, `reset`, and any key in the `x-` vendor namespace. `$schema` is metadata and never a configuration value; `reset` is the documented clearing directive; `x-` is the only vendor extension escape hatch.
- A malformed file fails closed with a distinct exit code from the internal error table; it is never partially applied.
- Warn on deprecated keys and on a value shadowed by a higher layer. `--strict` turns warnings into errors.
- Layer-restricted keys: secrets are environment-only and machine-specific paths are system or user-global only. A secret in any repository-scoped layer is a hard `CONFIG_INVALID` error, fail-closed, regardless of `--strict`; a canary-secret fixture asserts that the error occurs. A **repository-scoped layer** is any layer that lives in the repository working tree, whether tracked or not: the project committed layer (`<repo>/.<product>/config.yaml`) and the project local layer (`<repo>/.<product>/config.local.yaml`). Being gitignored does not exempt the project local layer, because a gitignored file is still readable by anything with working-tree access and can still be force-added by mistake; the rule is about location, not about tracking state. The system, user-global, environment, and CLI layers do not live in the repository working tree and are not repository-scoped for this rule. Keyring-backed secret sources are not part of v1; if one is added later it enters as an explicit source with a defined precedence position, an origin label, and a runtime-neutral access port.
- There is no in-file environment interpolation. `{env: ...}` and `${VAR:-default}` are not part of v1 and are rejected; the typed `<PRODUCT>_*` mapping is the only environment mechanism. This keeps one source grammar and prevents a committed file from reading the environment.

**Discovery:** walk up from the current working directory to the git root, never above it. v1 resolves repository layers at the git root only. Outside a git repository, no repository layers are loaded: the project committed and project local layers are skipped and reported in `config debug` with the reason `no-git-root`, while the defaults, system, user-global, environment, and CLI layers still apply. An explicit `--project-root` may point discovery at a directory for a deliberate test, but discovery never walks above that root. Template or central configuration inheritance, if added later, uses an explicit `extends:` key with cycle detection and origin labels; implicit directory inheritance is forbidden.

**GH-49 supersession entry (resolved):** the GH-49 M0 repository-config-inheritance item is absorbed by this layered model. GH-49 decided that central or template configuration inheritance would ship in the first milestone; the owner chose the best-practice multi-level model instead (UQ-4 answer, 2026-10-24), so the earlier deferral is superseded. The initial implementation includes the built-in defaults, the project committed layer, and the project local layer, plus the system, user-global, environment, and CLI layers defined above. Central or template `extends` remains an explicit later feature, not a silent merge.

**Legacy adapter:** the legacy compatibility adapter is the `ConfigSource` implementation in `packages/adapters/src/legacy`, exposed as `adapters ./legacy`; it reads the pre-freeze environment prefix and config directory through the `ConfigSource` port declared in `core ./contracts`, warns once, and maps them to the new keys. No new pre-freeze-prefixed variables are introduced.

**Fit:** This satisfies C-4 and the determinism driver while keeping configuration auditable and testable without executing repository code. It ranks fourth on public release readiness and seventh on determinism, and it removes a duplicated per-surface config loader because the resolver lives once in `core`. Its cost is one schema, one provenance layer, and a test matrix per merge rule.

**Rejected alternative:** Executable TypeScript configuration. It makes configuration un-auditable, unsafe for untrusted repositories, and impossible to validate without running code. A single-file model (option b) is rejected because the owner asked for per-user and per-project levels with tool-provided defaults; the layered model is the best-practice answer to that requirement.

### DEC-5 - State schema: local-first JSONL plus SQLite indexes

**Options considered:**

- (a) Append-only JSONL as the source of truth plus rebuildable SQLite indexes behind a state port, with local-first defaults and an implementation-neutral abstraction (chosen).
- (b) SQLite only.
- (c) JSON files only, no index.
- (d) Remote-first or shared-first storage.

**Recommendation:** Adopt (a). State is local-first, append-only, schema-versioned, single-writer per workspace, runtime-portable, sink-ready, and accessed only through ports, so a shared backend can be added later without rewriting core rules (owner answer UQ-8, 2026-10-24).

**Abstraction boundary:**

- Every read and write goes through `StateStore`, `EventLog`, and `SqliteDriverPort`, declared in `core ./contracts`. The JSONL writer, index, and lock are one implementation in `core ./state`.
- No core rule may depend on local-file behavior. Where a behavior is implementation-specific (for example a file lock), it is expressed as a port capability, not assumed.
- The planned state levels are local (this state root), project (shared across all workstations and operators of one project), and possibly global (all projects). v1 implements local only; the higher levels are named here so the ports and the event envelope do not preclude them. The event envelope's local-scope fields `workspaceId` and `fenceEpoch` are correct for v1 but must be generalized or explicitly scoped per level before project or global state ships; that is a milestone gate, not a v1 defect.
- A shared or cloud backend is a separate decision and a separate repository: C-4 forbids cloud code in this repository. Tenant-boundary semantics are out of scope until that backend exists.

**Location and precedence (the platform table is the primary rule):**

1. An explicit override variable, derived from the branding prefix (for example `<BRAND>_STATE_DIR`), has highest precedence on every platform.
2. Linux: `$XDG_STATE_HOME/<stateDirName>` when `XDG_STATE_HOME` is set; otherwise `$HOME/.local/state/<stateDirName>`. `XDG_STATE_HOME` is consulted only on Linux.
3. macOS: `$HOME/Library/Application Support/<stateDirName>/state`, unless the explicit override variable is set.
4. Windows: `%LOCALAPPDATA%/<stateDirName>/state`, unless the explicit override variable is set.
5. CI and containers: the explicit override variable, or the workspace `.ai/local/state/` path when explicitly configured; never an implicit default for a developer.
6. The resolved path is written to `manifest.json` at first initialization. Changing it requires an explicit move or a new state root, never a silent fallback.

The precedence is therefore: explicit environment override > `XDG_STATE_HOME` on Linux > the per-platform default table below for macOS and Windows.

**Platform resolution:**

| Platform | Default resolution | Notes |
|----------|--------------------|-------|
| Linux | `$XDG_STATE_HOME/<stateDirName>` or `$HOME/.local/state/<stateDirName>` | POSIX permissions apply; the only platform that consults `XDG_STATE_HOME`. |
| macOS | `$HOME/Library/Application Support/<stateDirName>/state` | The explicit override variable wins when set; `XDG_STATE_HOME` is not consulted. |
| Windows | `%LOCALAPPDATA%/<stateDirName>/state` | ACLs are set at creation; POSIX mode checks are skipped; the explicit override variable wins when set. |
| CI | Workspace `.ai/local/state/` when explicitly configured | Ephemeral; never the default for a developer. |
| Container | The override variable, mounted volume | No implicit host-path assumption. |

The state filesystem must be local. Network, distributed, or synced filesystems (NFS, SMB, iCloud, OneDrive, Dropbox, and similar) are refused at startup with a stable error code; an explicit developer override may allow a documented test-only mode but never the default.

**Layout and permissions:**

```text
<stateRoot>/
  manifest.json                 workspace registry, schema versions, state root
  workspaces/<workspaceId>/
    events.jsonl                append-only source of truth
    state.db                    derived index
    state.lock                  writer lock with fencing epoch
    quarantine/                 torn or malformed segments, retained for diagnosis
```

The state root is created at `0700` and files at `0600` on POSIX platforms; a permissions check runs at open and on every write. On Windows the equivalent is a restrictive ACL: the state directory and files grant only the current user (plus SYSTEM and administrators where the OS requires it), inherit to child objects, and deny other users; POSIX mode checks are skipped.

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
  "operationId": "sha256-hex",
  "fenceEpoch": 7,
  "workItemRef": "GH-123",
  "actor": { "kind": "agent", "id": "coder" },
  "payload": { "command": "status", "resultCode": "OK", "durationMs": 1234 },
  "dataClassification": "internal",
  "redaction": {
    "applied": true,
    "redactorVersion": "1",
    "ruleSetHash": "sha256-hex"
  }
}
```

**Byte-level contract (binding on the state spec):**

- Each record is one UTF-8 JSON object followed by a single newline. There is no multi-line framing.
- Each record carries a monotonic `sequence` per workspace and a `checksum` (SHA-256 of the canonical record body without the checksum field).
- Every append is flushed and `fsync`-ed before the writer acknowledges success.
- A torn final line is detected by parse failure or checksum mismatch. It is quarantined and reported as an incident. Any earlier malformed or checksum-failing line is a hard `STATE_CORRUPT` error with the line number; it is never skipped.
- `state rebuild` writes a new index to a temporary file, `fsync`s it, and atomically renames it over the old index. A failed rebuild leaves the previous index intact.
- The lock file is also `fsync`-ed on acquisition and heartbeat. Implementation details of canonicalization and sequence assignment belong in the state spec, not in this record.

**Writer lock and fencing:**

- The lock contains `lockId`, a monotonically increasing `fenceEpoch`, PID, host, start time, and a heartbeat timestamp.
- Every append carries the writer's `fenceEpoch`. A writer whose epoch is lower than the persisted epoch is fenced: the append fails with `STATE_FENCED`, and the writer must stop mutating.
- Takeover increments `fenceEpoch`. OS file locks are used where available; a lease timeout alone is not sufficient.
- Tests must cover a `SIGSTOP`-ed writer resuming after takeover, PID reuse, a clock step forward, and a clock step backward. State is not a remote source of truth, but it must not silently interleave.
- Root manifest lock: first initialization takes an exclusive root-level lock before `manifest.json` is created or updated. The implementation uses an atomic create of `manifest.lock` (create-exclusive) or a compare-and-swap merge of `manifest.json`, so two concurrent first runs cannot create two workspaces or overwrite each other's registry. The loser waits for the lock or fails with `STATE_LOCKED`. This closes the concurrent-first-run race that a workspace-scoped lock alone cannot cover.

**Workspace identity and partition:**

- `workspaceId` is a UUIDv7 generated once at state initialization and stored in `manifest.json`. It identifies the local working context (repository plus operator), not a remote tenant.
- Each workspace has its own `events.jsonl`, `state.db`, and lock under `workspaces/<workspaceId>/`. The lock scope is the workspace, so two workspaces may run concurrently without contention.
- A workspace is never merged implicitly. Cross-workspace queries are a read-only projection over per-workspace stores.
- The semantics of tenant boundaries and any future multi-user or multi-host sharing are out of scope until a shared backend exists; the local model above is the v1 shape, confirmed by the owner (UQ-8 answer, 2026-10-24).

**Event and redaction rules:**

- `events.jsonl` is append-only. Corrections are new events; existing events are never mutated.
- `eventId` is the idempotency key for any future sink. `runId` correlates every command result with its start and finish events. `operationId` is deterministic for mutating operations (see DEC-6).
- `state.db` is a derived index, not a source of truth. It stores `events`, `runs`, `operations`, `work_items`, and `meta` tables with WAL, `busy_timeout`, and foreign keys. `state rebuild` reconstructs it from JSONL.
- Each event type has a closed payload schema. Unknown fields are rejected at write time. The schema is versioned with the event type suffix.
- `dataClassification` is one of `public`, `internal`, `personal`, or `sensitive`. The field-level table below is binding and is extended per event type in the state spec.
- One pure redactor in `core ./contracts` runs before every write and every output. Redaction is fail-closed: if the redactor cannot run or a rule fails, the write aborts. `redaction.applied: true` is only written after a successful pass with the recorded `redactorVersion` and `ruleSetHash`. A canary secret fixture must produce zero occurrences in state and telemetry.
- Schema versions are explicit: `EVENT_SCHEMA_VERSION` and `COMMAND_RESULT_SCHEMA_VERSION` start at 1. Additive fields are allowed within a version; breaking changes bump the version and require a migration or dual-read window. An unknown newer version is an error, never a zero.
- Retention and rotation: the default retention horizon is forever (owner answer UQ-6, 2026-10-24). Rotation still segments the log at a configured size so a single file does not grow without bound, and older segments may be compacted only into new segments, never rewritten in place. User-configurable custom retention policies are a later feature; when they arrive, they are configuration, not a new event format. An erasure procedure remains a release gate before any sink receives data, and a low-disk preflight fails the write with a stable code before the disk is full. A restore drill rebuilds the index and queries it from a backup copy.
- The envelope is sink-ready: no secrets, no absolute paths, no usernames, and no free-form payload. Personal data is limited to what the field table permits and is retained only for the stated purpose.

**Field-level data classification (baseline):**

| Field | Class | Scope and lifetime | Handling |
|-------|-------|--------------------|----------|
| `eventId`, `runId`, `operationId`, `workspaceId` | internal | Workspace lifetime; retained with the event | Not personal data by itself; never joined to an external identity. |
| `occurredAt`, `sequence`, `fenceEpoch` | internal | Event lifetime | No redaction. |
| `type`, `schemaVersion`, `producer` | public/internal | Event lifetime | Brand-neutral. |
| `workItemRef` | internal | Event lifetime; may identify a project | Not redacted by default; can be redacted in exported bundles. |
| `actor.id` | personal (operator or agent identity) | Event lifetime | Pseudonymous; redactable on export; retained only for audit. |
| `payload` | depends on event type; default internal | Per event type, closed schema | Only allow-listed fields; free-form text is forbidden. |
| `dataClassification` | internal | Event lifetime | Drives retention and export policy. |
| `redaction.*` | internal | Event lifetime | Audit evidence; never redacted. |

**Fit:** This satisfies C-11 and the determinism, testability, and durability drivers while keeping state portable across hosts and portable across backends. It ranks third on strangler coexistence and seventh on determinism. The cost is a port abstraction, a fencing protocol, and rotation and restore work that a single-host SQLite-only design would not need; those costs are accepted because the owner requires runtime portability, because silent state corruption would undermine every later engine, and because a local-only schema with local-only assumptions would block the shared state the owner anticipates.

**Rejected alternatives:** SQLite only (opaque history, harder to ship, runtime-coupled), JSON only (no fast queries), and remote-first or shared-first storage (violates local-first and the no-cloud-in-OSS constraint).

### DEC-6 - Adapter contract: provider-agnostic ports, GitLab and Jira first

**Options considered:**

- (a) Ports in `core ./contracts`, implementations in one `adapters` package with per-provider subpaths, and provider selection policy in `core` (chosen).
- (b) One package per provider.
- (c) Provider-specific logic in core behind conditionals.
- (d) A public plugin SDK now.

**Recommendation:** Adopt (a).

Ports in `core ./contracts`:

- `VcsPort`: change request read and create, checks or pipeline status, merge, push, remote branch lookup.
- `TrackerPort`: work item read, transition, comment, label mutation, ready-set query.
- `ConfigSource`: repository config and environment acquisition for the DEC-4 resolver.
- `StateStore` and `EventLog`: state reads, appends, and index queries.
- `SqliteDriverPort`: the persistence driver seam implemented in `core ./state`.
- `RepoStore` and `FileStore`: repository file reads and writes, and atomic file operations that are not config or state.
- `HostPort`: host and process inspection (platform, load, disk, process list, signals) without ambient `node:os` or `process` calls in core. Metadata-only per the C-11 clause: no command arguments, environment values, or user content.
- `CiHealthPort`: CI status and health reads that are not already covered by `VcsPort`.
- `SessionStore`: read-only access to foreign session databases for `db` administration; never a mutation path. Metadata-only per the C-11 clause: no message content, prompts, or transcripts; privacy sign-off is required before the `db` administration engine ships.
- `ProviderProbePort` and `QuotaFactsPort`: provider availability and quota facts returned to core policy.
- `Clock`, `IdGenerator`, and `Logger`: injected determinism and observability.

Provider policy split:

- `ProviderPolicy` lives in `core`: it decides ordering, budget, hysteresis, and when to park or unpark a provider, using `QuotaFactsPort` facts and `capabilities()`.
- `ProviderProbePort` and `QuotaFactsPort` implementations live in `adapters`, under the provider subpaths and `./registry`. They report facts; they do not decide selection.
- Hysteresis and park state are persisted through the state ports as events and indexed for fast reads. Core reads them through `StateStore`; it does not keep process-local selection state as the source of truth.
- Core branches on capabilities, never on provider identity.

Contract rules:

- Every port method returns `Promise<Result<T, AdapterError>>`. Expected failures return `Err`; `throw` is reserved for invariant violations.
- `AdapterError` carries a stable code from the internal error table, a stable kind (`auth`, `forbidden`, `not_found`, `conflict`, `rate_limited`, `network`, `server`, `validation`, `unsupported`, `unknown`), a retryable flag, an optional retry-after, and an optional provider label. No provider-specific error type escapes an adapter.
- Mutations accept an idempotency key derived from deterministic operation identity (see below), not from a per-invocation `runId` alone.
- Adapters own rate-limit budgets, backoff, and retry classification. Authentication and validation failures are never retried. Adapter calls emit redacted events at the boundary.
- A provider-agnostic conformance suite in `testkit` runs against every adapter. A new adapter needs the suite, a trap catalog, and secrets-free `e2e-mock` fixtures. A live `e2e` run is additional evidence, not the gate.

Per-operation adapter defaults (overridable by config, binding as defaults):

| Operation class | Per-attempt timeout | Total deadline | Retry budget | Circuit breaker |
|-----------------|:---:|:---:|:---:|---|
| Read (status, query, get) | 10 s | 30 s | 3 attempts, exponential backoff with jitter | Open after 5 consecutive failures; half-open probe after 30 s |
| Mutation (comment, transition, label, merge) | 30 s | 120 s | 2 attempts, only when the operation is idempotent | Open after 3 consecutive failures; never auto-retry a non-idempotent call |
| Provider probe or quota read | 5 s | 15 s | 1 attempt | Failure parks the provider through policy, not through a retry storm |
| Local file or repo operation | 5 s | 30 s | 2 attempts | Open after 5 failures; surfaces a stable local I/O error |

**Deterministic operation identity and dual-run safety:**

- `operationId = sha256(workspaceId, workItemRef, engine, operation, canonical args, provider target)`.
- The first outcome for an `operationId` is persisted in state (`operations` index plus an event). A repeat with the same identity returns the persisted outcome instead of re-mutating the tracker or VCS.
- During dual-run, a mutating engine runs in shadow or read-only mode: it computes the operation and records the would-be outcome without calling the mutation. Live mutation is enabled only at the explicit per-engine transfer, after parity.
- A mutating engine transfer requires a clean shadow window, a rehearsed rollback, and owner sign-off (C-8).
- **Scope of the operation index:** it prevents replay for the new tool within one workspace. The bash path does not consult the index, so it does not protect against a bash replay, a cross-workspace duplicate, or an operator invoking the old tool directly.
- **Transfer guard:** every mutating engine transfer adds a guard that only one writer path is live per engine. The wrapper feature switch selects the active path; the other path is disabled rather than merely unused; during dual-run the new engine stays shadow or read-only. The guard is a cutover checklist item and a stop condition.
- **Rollback for a transferred engine:** while the retention window is open, a wrapper or feature switch returns to the bash implementation; after the window closes, rollback is reinstall-only of the previous signed release. State remains readable in both cases. The operation index prevents the new tool from replaying a completed mutation within one workspace; it does not cover the bash path.

Adapter order and packaging:

| Adapter | Milestone | Notes |
|---------|-----------|-------|
| GitLab | First delivery | Merge requests, pipelines, branches; seed from the existing prototype. |
| Jira | First delivery | Labels replace, transitions are data, custom fields, comment quirks. |
| GitHub | Following delivery | ADOS dogfooding; pull requests, checks, Actions. |
| Azure DevOps | On demand | No skeleton until a consumer and trap catalog exist. |
| CI | First delivery | `CiHealthPort` reads that `VcsPort` does not already cover. |
| Non-provider I/O (repo, file, host, session, legacy) | First delivery onward | These are the only I/O home besides `core ./state`; no engine may land without a port home. |

> **Editorial pointer:** [ADR-0005](ADR-0005-runtime-confinement-provider-client-subpaths.md) refines the reading of the adapter I/O edge: provider client subpaths performing network I/O (`github`, `gitlab`, `jira`) are admitted per subpath as exact, reason-bearing entries, while the provider registry subpath stays non-I/O. The decision content above is not amended; ADR-0005 records the refinement and is the current confinement truth.

`packages/adapters` starts as one package with subpath exports and a `./registry` that enumerates the available providers. The owner-approved package list names the five provider adapters; the non-provider I/O adapters also live here because core must stay runtime-neutral and no other package owns I/O. That keeps the package count at six. Split a provider (or a driver) into its own package only when it needs a vendor SDK with heavy transitive dependencies, an external maintainer, or an independent version line. Split the non-provider I/O group (`./repo`, `./file`, `./host`, `./session`, `./legacy`) into its own package when that group grows a heavy or runtime-specific dependency, acquires an independent consumer or maintainer, or needs a separate release cadence; a split moves implementations, never the ports, which stay in `core ./contracts`. Do not pre-split.

**Fit:** This satisfies C-9 and C-11 at the I/O boundary and moves provider choice into testable core policy. It ranks first on boundary enforcement and sixth on testability. The cost is a larger port list and a persisted operation index; both are required for runtime portability and safe dual-run.

**Rejected alternative:** Provider-specific branches in core. It makes every new provider a core change and breaks the replaceability driver.

### DEC-7 - Coexistence with the existing delivery repository layout

**Options considered:**

- (a) Additive `packages/` alongside the existing layout; bash stays authoritative until per-engine parity; the install ships the new tool plus updated wrappers; wrappers delegate only at the cutover (chosen).
- (b) Move `.opencode/`, `scripts/`, `tools/`, and `doc/` into `packages/`.
- (c) Big-bang replacement of the bash stack.
- (d) Sibling repository (rejected, Alt 5).

**Recommendation:** Adopt (a). Nothing moves, and the wrapper-based strangler is the delivery model.

| Area | Action |
|------|--------|
| `.opencode/` | Stays canonical; no move; `.ados-claude/` stays generated and CI-verified. |
| `scripts/` | Stays; bash delivery keeps running; new TypeScript CI jobs are added beside it. |
| `tools/` | Stays; a tool is deprecated only when its replacement passes parity; removal is last. |
| `doc/` | Stays; new tooling spec, architecture, and decision records are added, not moved. |
| `packages/` | New root workspace, additive. |
| Root manifests | New `pnpm-workspace.yaml`, private workspace `package.json` with a pinned `packageManager`, `pnpm-lock.yaml`, `tsconfig.base.json`, solution `tsconfig.json`, `biome.json`, `commitlint.config.js`, `.dependency-cruiser.cjs`, `.bun-version`. |
| CI | Existing bash jobs plus new TypeScript jobs; both binding; pull requests target `main-tools`. |
| Distribution | `scripts/install.sh` gains arrays for the CLI binary, the MCP artifact, the opencode surface artifact, and updated wrappers, each with install path, update mechanics, and signature/checksum verification; it does not copy `packages/` source. |
| Wrapper cutover | Per engine, only after the parity gate. Before cutover, the wrapper runs the bash implementation; the new tool is installed but dark. After cutover, the wrapper calls the new tool; the bash body is retained behind the feature switch for a two-milestone retention window as the rehearsed rollback target, then removed. |
| Old tool removal | Last stage, per tool, after the two-milestone retention window plus at least one release cycle with a deprecation notice in help, docs, and release notes; remove the install registration and the file together. |

**Wrapper-based strangler sequence (per engine):**

1. **Dark install:** The release installs the new tool and the unchanged wrapper. The wrapper still runs bash. The new tool is available for explicit invocation and shadow runs.
2. **Shadow or read-only:** The engine runs beside bash, computes results, and records them without mutating external state. Parity signals are compared.
3. **Parity gate:** The parity suite passes, the observation window is clean, the rollback is rehearsed, and the owner signs off. The gate is per engine, not per release.
4. **Cutover:** The wrapper delegates to the new tool internally, preserving its CLI contract and exit-code projection. The bash body is retained for a two-milestone retention window and remains the rehearsed rollback target; it is removed after that window, not at cutover.
5. **Consolidation:** After the two-milestone retention window, the install ships the new tool plus wrappers only and the bash body is removed. Wrappers remain as compatibility shims until the deprecation cycle ends, then are removed.

**Rollback path:** Each engine has a feature switch (config or environment, brand-neutral) that selects the bash implementation during the two-milestone retention window; this switch is the rehearsed rollback. Reverting the wrapper commit or reinstalling the previous signed release also restores the old path. After the retention window closes, rollback is reinstall-only. State is append-only and readable by both paths; the operation index prevents the new tool from replaying a completed mutation within one workspace, while the transfer guard keeps only one writer path live. A rollback never requires deleting state, and it never re-enables a weakened gate.

Distribution rules:

- `install.sh` verifies the signature and SHA256 of every downloaded artifact before installing it, and fails closed on a non-HTTPS source or a missing checksum.
- The bootstrap installer is pinned to a tagged, checksummed release; it does not run an unpinned `main` script.
- **Install source (resolved):** installs use `main-tools` while the tools are delivered there. Once the tools are stable and public-ready, the work merges to `main`, `main-tools` is retired, and installs move to `main` (`main` then becomes the only source) (owner answer UQ-2, 2026-10-24). Delivery-phase installs additionally stay pinned to tagged, checksummed releases under C-10; the branch rule governs where an update check looks, not whether verification happens.
- The new tool and MCP artifact are registered in explicit install arrays. The MCP artifact is registered even when it ships as a Node entry point. The opencode surface artifact is registered in its own array with the same update and verification mechanics.
- **Legibility trap:** `packages/opencode` is a workspace surface package; it does not replace, shadow, or become the canonical `.opencode/` agent and command definitions directory. The two coexist by design: `.opencode/` remains the source of truth for agent and command definitions (C-6), while `packages/opencode` contains only the OpenCode native-tool surface code. The canonical directory stays at the repository root and is never moved under `packages/`.
- Local development uses `pnpm install` and a workspace script. `packages/` is not installed into user projects as source.
- The existing delivery-script and delivery-tool install arrays remain for the bash stack. The new artifact arrays are separate, so old and new distribution paths can be removed independently.

Documentation rules:

- Add a tooling feature spec under `doc/spec/` without overwriting the existing delivery-system features.
- Add an architecture overview for the new packages and their dependency matrix.
- Update `doc/guides/tools-convention.md` to distinguish repo-internal bash tools from the new delivery runtime. Keep the legacy exit-code table for bash tools until they are migrated.
- Do not modify `.opencode/agent/**` or `.opencode/command/**` as part of this decision; agent routing changes go through `@toolsmith` later.

**Fit:** This satisfies C-5, C-7, and C-8 and makes the owner's adoption path executable without a big-bang. It ranks third on strangler coexistence and fourth on public release readiness. The cost is a temporary period when both implementations are installed; the wrapper switch and the operation index keep that period honest.

**Rejected alternative:** Moving existing directories into `packages/`. It creates a large rename blast radius before the new stack proves itself and breaks the strangler's additive property.

### DEC-8 - Naming firewall placement

**Options considered:**

- (a) One branding module plus a neutral workspace scope, forbidden-literal test, legacy adapter, and rename drill (chosen).
- (b) Rename now and freeze the brand before scaffolding.
- (c) A repository-wide search-and-replace script with no seam.
- (d) No firewall until release.

**Recommendation:** Adopt (a).

- `packages/core/src/branding` exports one `BrandIdentity` value derived from a single central project constant: product name, binary name, package scope, environment prefix, config directory name, state directory name, MCP tool prefix, telemetry namespace, docs base URL, repository URL, release asset prefix, and install path. It is the only place current names appear. Every other name is derived, so a rebrand is one edit plus a drill. The module is a pure resolver: a runtime-aware edge (a surface, or a runtime-aware composition root that receives injected environment facts) reads the environment override, with the build-time define supplying the compile-time default, and passes it into the resolver, so `packages/core/src/branding` itself reads no ambient environment and an operator can test a name without a rebuild. A negative fixture forbids `process.env` and `Bun.env` in this module.
- `core ./contracts` defines the `BrandIdentity` type. The branding module imports `./contracts` for the type only.
- Surfaces, or a host-specific edge that receives injected environment facts, read branding and pass the resolved values into `createRuntime`; `createRuntime` passes the brand values to the adapter constructors. This keeps one composition root (DEC-1): a surface passes instances plus the resolved configuration into `createRuntime` and never wires adapters itself. Core application and config code never imports branding directly; neither do the adapters. The legacy adapter receives current names as parameters; it does not import branding.
- Workspace package names use a neutral private scope such as `@workspace/*` until the naming freeze. All six packages carry `private: true` until the freeze; `testkit` stays `private: true` permanently. The other five are intended to publish, but publication is blocked until the freeze by both the `private: true` manifest field and a release-job publish guard, because published package names carry the branded scope; the freeze change sets `private: false` on the five, applies the branded scope in one reviewed rename, and removes the guard. The brand never enters a workspace package name before that change.
- The branding module owns the config directory name and the environment prefix. The committed configuration path is therefore `<repo>/.<product>/config.yaml` with `<product>` supplied by branding (DEC-4), not a separately reserved name. That keeps one seam: freezing the name renames exactly one value, one directory, and the documented migration for existing files and consumers.
- Telemetry event names are brand-neutral from day one (`delivery.event.v1`, `delivery.metric.v1`). The producer name is metadata from branding, not part of the schema name.
- MCP tool names are a projection of branding plus a canonical primitive ID from `core ./contracts`. A rename changes the projection, not the primitive.
- CLI subcommands are verbs and nouns, not brand names. User-facing docs use "the CLI", "the runtime", and "the delivery factory" until the name is frozen.
- The legacy adapter is the only other place allowed to contain old literals. It reads the pre-freeze environment prefix and config directory, warns once, and maps them to the new names. No new pre-freeze-prefixed variables are introduced.
- The forbidden-literal test scans `packages/**`, root manifests, root workspace files, `.gitignore`, and new user-facing docs for the seed literal set `ados`, `ADOS_`, and `~/.ados` (the legacy tokens already public in this repository), with an allowlist for `packages/core/src/branding/**`, `packages/adapters/src/legacy/**`, decision records, historical change artifacts, and required license or source headers. The test grows with the frozen name set: freezing a public name adds its literal to the scanned set in the same change.
- The rename drill replaces branding values and the legacy mapping in a temporary copy, then runs typecheck, unit and integration tests, boundary tests, the forbidden-literal test, a binary build, a package publish dry-run, an MCP tool-list snapshot, and an OpenCode tool-list snapshot. It also asserts that the root `.gitignore` still matches the renamed project-local config path and that every root workspace file (the pnpm workspace, tsconfig, Biome, commitlint, dependency-cruiser, and `.bun-version` files) is name-free or derived from branding. It must pass before release and whenever branding changes.
- **Scope of the claim:** the single-seam guarantee covers `packages/**` and new user-facing docs. The existing installed corpus (agent and command content, guides, install paths, and the files counted in the 2026-10-23 review) still contains the current name. That corpus migration is a separate, tracked change; the rename drill extends to it when that change lands. Do not claim a repository-wide rename is free until then.

**Fit:** This satisfies C-3 for the new code and makes the future brand decision cheap inside the monorepo, without the overhead of a separate package. It ranks fifth on rename safety and fourth on public release readiness. The cost is one branding module, one forbidden-literal allowlist, and a separate corpus migration; the alternative is a distributed literal that breaks consumers.

**Rejected alternative:** Renaming now. The brand is not frozen and a premature rename would create exactly the archaeology the firewall exists to prevent.

### DEC-9 - Marksync adoption verdict

**Options considered:**

- (a) Copy the marksync repository shape verbatim.
- (b) Adapt the patterns to a monorepo, reusing contracts and patterns and rejecting what is single-package specific (chosen).
- (c) Reject marksync and design from scratch.

**Recommendation:** Adopt (b). The verdict is explicit.

**Reuse (near-verbatim contracts and patterns):**

- `Result<T,E>` for expected failures; `throw` only for invariants.
- `CommandResult` envelope with `schemaVersion`, `runId`, result code, timing, and `data` or `error`; presentation never names domain types.
- The class-based error and exit-code table, adapted to the internal error table and the standalone projection.
- Ports-and-adapters tier model with a pure domain tier.
- Strict TypeScript flags, ESM, Biome, commitlint plus husky, and binding CI.
- Tiered tests with a secrets-free `e2e-mock` suite and provider trap catalogs.
- Release discipline: pinned Bun, cross-compiled single binary, `SHA256SUMS`, CycloneDX SBOM, license audit, notices, and clean-OS smoke.
- Decision records with rich frontmatter, revisit triggers, and AI-assistance provenance.
- Single-writer lock, atomic writes, and journaling as a recovery pattern (adapted to the fence-epoch state store).

**Provenance and license rule:** "Near-verbatim" here means contracts and patterns, not copied source files. Any source file copied from marksync carries a provenance note in its header and its license notice in `THIRD-PARTY-NOTICES`. marksync-for-confluence is the owner's sibling repository; its authorship and license are verified before any source file is copied. Until that verification is recorded, reuse is patterns-only.

**Adapt (changed for the monorepo and the ADOS context):**

- A single `src/` tier tree becomes root `packages/` plus internal `core` tiers.
- Per-package `#imports` aliases become workspace package names with explicit `exports` subpaths and declared entrypoints.
- The four dependency-cruiser rules become a full package matrix plus subpath rules, internal tiers, runtime-API confinement, ambient-global checks, and negative fixtures, with pnpm dependency isolation as the expected second layer (ASSUMPTION pending verification).
- Application-tier file I/O moves out of core; I/O lives in `core ./state`, `adapters`, and config sources.
- Silent skipping of malformed JSONL lines becomes a hard error with checksums, quarantine, and an incident event.
- Project-only configuration becomes a layered model with built-in defaults, system, user, project, local, environment, and flag layers, with provenance and a legacy adapter.
- Lock and journal state becomes append-only JSONL plus rebuildable SQLite indexes with explicit schema versions and a driver port.
- One binary becomes a CLI binary plus an MCP artifact plus an OpenCode surface plus five published packages, with one lockstep version line.
- MIT assumptions and license-checker configuration become Apache-2.0 with an allow-list license policy and a committed YAML registry.
- Bun-only application code becomes a runtime-neutral core contract surface; Bun APIs are confined to the state drivers, the CLI build, and host adapters.

**Reject (do not adopt):**

- The single-package `src/` tree copied verbatim into the monorepo root. It defeats surface and adapter isolation.
- The four-rule dependency-cruiser configuration treated as the complete matrix. It leaves real edges unguarded.
- Alias-only boundary enforcement. Per-package aliases do not enforce cross-package edges.
- Silent malformed-line skipping. It creates lying state and false-success signals.
- Direct `node:fs` I/O in the application tier. It breaks purity and testability.
- MIT license text and license-checker assumptions. ADOS is Apache-2.0.
- Product-specific names, config keys, and examples from marksync. They are not transferable.
- A single-binary-only distribution model as the only path. ADOS needs CLI, MCP, harness, and install.sh registration, and published packages.

**Fit:** This satisfies C-2 and C-9 and reuses a proven shape without importing its single-package assumptions. It ranks first on boundary enforcement and eleventh on time to first slice because the adaptation is deliberately not a copy. The cost is re-deriving the boundaries; the benefit is a graph that matches the monorepo and the runtime model.

**Rejected alternative:** Designing from scratch. It discards proven contracts and patterns and adds no isolation benefit that the adaptation lacks.

### DEC-10 - Error contract and exit-code projection

**Options considered:**

- (a) Internal error table with static documented codes in `core ./contracts`; exit-code types in `core ./contracts` and the numeric process-exit projection in `cli` (chosen).
- (b) A single flat contracts entry point with the error table and the numeric projection together.
- (c) Provider-specific error types propagated to callers.
- (d) HTTP-status-style codes as the primary taxonomy.

**Recommendation:** Adopt (a).

- The internal error table is the primary contract. Each entry has a stable code, a category, a severity, a retryable flag, a message key, and a documentation anchor. Codes are static, versioned, and looked up in generated documentation. Examples: `CONFIG_INVALID`, `STATE_LOCKED`, `STATE_FENCED`, `STATE_CORRUPT`, `ADAPTER_AUTH`, `ADAPTER_RATE_LIMITED`, `ENGINE_PARITY_FAILED`.
- Every layer propagates the stable code and structured details through `Result`. Adapters map provider failures to the table; core maps domain error kinds to the table; surfaces render the code and a human message without inventing a new taxonomy.
- `core ./contracts` defines the exit-code types (the stable semantic categories and their metadata). `cli` holds the numeric projection table and `CommandResult` rendering, because process exit codes are a surface concern that only a POSIX process has.
- `domain`, `app`, and `config` must not import `cli`; the package matrix already forbids it. MCP and OpenCode return the stable code and structured error in their protocol; they never expose a process exit code.
- Exit codes remain a lossy projection of the error table for shell consumers. The projection is documented, stable, and tested; it is not the error model.
- The legacy bash exit-code convention remains valid for bash tools until they are migrated. The CLI projection is documented separately in `tools-convention.md`.

**Fit:** This satisfies the owner's error-model decision and C-9 for harness consumers. It ranks first on boundary enforcement and fifth on rename safety through stable schemas. The cost is one extra projection module in `cli` and a generated documentation page; the alternative is a flat contract that forces every harness to inherit shell semantics.

**Rejected alternative:** A flat contracts entry point that exposes process exit codes to every consumer. It leaks CLI presentation into domain and harness code.

### Anti-patterns This Structure Forbids

- **Package-per-layer symmetry.** Contracts, branding, and state are core subpaths. Splitting them into packages would add release units without adding isolation, and the split would be re-merged as soon as the version lines converged.
- **Publishing what nobody installs.** A package is published because another piece of software could embed it, not because the folder exists. `testkit` never publishes; a provider subpath publishes only when it satisfies a split trigger.
- **Deep re-export chains.** A package exposes its own API. It does not re-export another package's internals to spare an importer a dependency declaration; that would move the boundary into prose.
- **Duplicated composition wiring per surface.** Every surface calls `createRuntime`; a surface that builds its own dependency graph is a defect, because behavior then diverges by construction path.
- **Branding as code instead of configuration.** Names, prefixes, and directories come from one branding module with an environment override and a build-time define. A literal in a surface, an adapter, or a config key reintroduces the rename problem.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-11:

- **C-1 (one OSS monorepo):** The workspace is additive inside this repository; no sibling repository; no cloud code. The committed OSS scope, which covers every roadmap phase that includes any OSS part, has a home.
- **C-2 (Apache-2.0, license registry, notices, SBOM):** The repository stays Apache-2.0; the allow-list gate reads the committed YAML registry under `doc/legal/` and fails closed on unknown or compound expressions; SSPL, BUSL, Elastic, Commons Clause, and CC-BY-NC are denied; releases attach an SBOM, checksums, and `THIRD-PARTY-NOTICES` for binaries and libraries. Individual dependency license compatibility remains a human determination recorded in the registry, which this constraint requires rather than bypasses.
- **C-3 (naming firewall):** No new code or user-facing documentation hardcodes a product name outside the branding module and the legacy compatibility adapter. The branding module is the only current-name source and is a pure resolver whose environment override is read at a runtime-aware edge; the legacy adapter is the only old-name source. The forbidden-literal test, the branding ambient-global negative fixture, and the rename drill are required, and the installed corpus migration is explicitly separate.
- **C-4 (OSS-only):** No cloud package, name, design, or private reference is introduced. Telemetry envelopes are local-first and sink-ready without being cloud code. Planned shared state is a future integration point, not committed code. This record was scanned for private identifiers and contains none; private working paths and review records are described generically.
- **C-5 (wrapper-based coexistence):** Nothing moves; bash remains authoritative per engine until parity; the install ships the new tool plus wrappers; cutover is per engine and reversible.
- **C-6 (`.opencode` source of truth):** The decision does not touch `.opencode/` or the generated plugin; CI freshness continues.
- **C-7 (distribution registration and pin equality):** New release artifacts, including the MCP artifact and the opencode surface artifact, are registered in `install.sh` with explicit install paths and update mechanics, signature- and checksum-verified, and separate from the bash arrays; the four-copy Bun pin is checked for equality and the pnpm version is pinned in the root manifest. The release job also blocks any pre-freeze publish (DEC-3).
- **C-8 (gates never weaken):** Existing bash gates stay binding; new TypeScript jobs are binding; the parity suite, a clean observation window, a rehearsed rollback, and owner sign-off decide each cutover.
- **C-9 (runtime neutrality):** The core contract surface and `./branding` have no runtime imports or ambient globals, including no ambient environment read in branding; runtime APIs are confined to `core ./state`; the state driver is a port with a non-Bun path; harness surfaces consume public entry points; a runtime-portability smoke suite and a packed-artifact import test run in CI, proving that `core` `.`, `core ./contracts`, and `core ./branding` load without any state driver while only `core ./state` requires the driver, plus a Node `core` `.` import smoke. The absence of an approved non-Bun state driver at scaffold is a scaffold stop condition, and the documented degraded mode until it lands is read-only JSONL without SQLite indexes.
- **C-10 (security and supply chain):** Signed releases, a fail-closed installer, a pinned bootstrap, SHA-pinned actions, job-scoped permissions, OIDC release credentials, publish provenance, a high/critical vulnerability gate, and MCP mutation authorization are required before release.
- **C-11 (privacy and data lifecycle):** Field-level classification, fail-closed redaction with a version and rule-set hash, closed payload schemas, retention and erasure before any sink, POSIX `0700`/`0600` state permissions with the Windows ACL equivalent, and the metadata-only clause for `SessionStore` and `HostPort` with privacy sign-off before the `db` administration engine ships are required.

The chosen alternative meets every constraint; no constraint is waived. C-9 is satisfied by design, with the absence of an approved non-Bun state driver at scaffold treated as a scaffold stop condition. The documented degraded mode is read-only JSONL without SQLite indexes until that driver lands; it is a designed operating state, not a relaxed gate. Every constraint is marked `Negotiable: no`, so compliance is pass/fail rather than a documented-risk exception.

**Decider:** Juliusz Ćwiąkalski (owner). The owner accepted this record on 2026-10-24 via PR #163, setting `status: Accepted`, `decision_date: 2026-10-24`, and `review_date: 2026-10-24`. The first post-implementation retrospective follows the scaffold and the first parity cutover.

**Conditions for revisit:** See the frontmatter `revisit_triggers`. The most likely early triggers are the non-Bun state driver result, the OpenCode harness form, a need to publish before the naming freeze, and the first adapter or driver that justifies a separate package.

## Trade-offs & Consequences

### Positive Outcomes

- Every artifact class has a clear home: core contracts, core rules, core state drivers, core branding, adapters, surfaces, testkit.
- CLI, MCP, and OpenCode share one core implementation and one composition root; none can grow a private logic path without violating a package rule.
- Core logic is runtime-neutral, so a new harness is a composition change rather than a rewrite; a host that cannot run the SQLite driver still consumes the contract surface.
- Adapters depend only on core, so a provider can be replaced without touching core rules.
- The naming firewall becomes a constants change inside one module plus a countable corpus migration, not an unbounded search-and-replace.
- State is local-first, sink-ready, fence-protected, and backend-pluggable from day one; the JSONL format is the portable contract and the ports are the backend seam.
- Configuration has the hierarchy users expect, one schema, deterministic merging, per-key provenance, and an explain mode, so a value can always be traced to its layer.
- The existing bash stack keeps delivering; wrappers move engine by engine only after parity.
- Boundary rules are executable and tested, not prose that reviewers can forget, and pnpm isolation is expected to back them structurally once the scaffold verifies it.
- The publish path is designed now (fixed version group, `dist` exports, publint and attw), so publication after the naming freeze does not force a redesign.
- The structure is legible to AI agents: package names and dependency rules tell an agent where new code belongs.

### Negative Outcomes

- Six packages still add workspace manifests, test targets, and a lockstep release line. The overhead is real, even if smaller than a package per layer.
- The `contracts` subpath can become a dumping ground. It needs a review rule: a type belongs there only if it crosses a package boundary or a runtime boundary.
- A single `adapters` package can accumulate dependency weight. The split trigger is documented, but the first split will be a refactor.
- `core ./state` carries a runtime-specific dependency (the SQLite driver) inside a package whose other subpaths are runtime-neutral. It is contained by subpath exports, but a consumer that bundles carelessly could pull the driver in. The documented remedy is a state driver package split.
- Two pinned toolchains (pnpm for dependencies, Bun for runtime and build) mean two version bumps and two failure modes; pin equality and a single install command keep it manageable, but it is more moving parts than one.
- Configuration layering adds a resolver, a provenance model, a schema publication, and a test matrix. A single-file model is simpler; it is also unable to serve per-user and per-project configuration.
- Forever retention means state grows without bound by default until the owner adds custom retention policies. Disk preflight and rotation limit the failure mode but do not remove it.
- The runtime-neutral rule forbids convenient Bun or Node APIs in the contract surface and the pure tiers. Some code will need a port that a single-package design would not need.
- The state port and the non-Bun fallback add work before the first state-backed engine ships.
- Lockstep versioning couples package releases. It is simple now and may become friction when an external consumer needs a different cadence.
- The publish path adds a release-time manifest step, `publint` and `attw` gates, and a pack dry-run to every release, even before publication starts.
- CI time grows with typecheck, boundary, runtime-portability, packed-artifact, test, and binary-smoke jobs. The fast loop must be kept honest or developers will route around it.
- The new CLI exit-code projection may diverge from the legacy bash convention until `tools-convention.md` is reconciled. This is a documentation and consumer risk, not a structural one.
- The installed corpus still carries the current name until the separate migration lands; a public rename before then is not free.

### Unresolved Questions

The owner answered UQ-1 through UQ-8 on 2026-10-24; those answers are recorded as FACTs in the Owner answers section and are reflected throughout this record. Only one owner decision remains open.

- [ ] **UQ-9 Brand name (deferred):** product name, binary name, and naming-freeze date. Owner decision (2026-10-24): defer until before the first public release. Protected by design via the branding seam, the `private: true` publish guard, and the forbidden-literal test. Blocks publication only, not the scaffold (owner).

**Milestone gate note (not an owner question):** after the first multi-workspace exercise, confirm the workspace identity, the per-workspace partition, and the lock-scope model defined in DEC-5. The local-scope envelope fields `workspaceId` and `fenceEpoch` are part of that gate: before project or global state ships, confirm whether each is generalized, re-scoped per level, or replaced. The owner accepted the proposed state shape for now (UQ-8 answer, 2026-10-24); this is a confirmation checkpoint before the shared-state work, not a pending decision.

**Evidence-level TO-CONFIRMs (not owner decisions):** marksync authorship and license; the dependency license verdicts; the runtime-specific SQLite driver dependency and the possible state driver package split; the need for a CommonJS entry point; whether a third-party embed API equals core's composition API; the exact Bun and pnpm versions; and the non-Bun driver path. They are tracked in the Evidence, Assumptions & Unknowns table.

## Implementation Plan

High-level only; each step is delivered as an ADOS change with a spec, test plan, and plan, targeting `main-tools`. The roadmap is being revised; these steps are the first OSS delivery sequence, not a claim that later OSS phases are excluded.

1. **Workspace scaffold:** Add `pnpm-workspace.yaml`, the private root `package.json` with a pinned `packageManager`, `pnpm-lock.yaml`, `.bun-version` and `engines.bun` (most recent stable Bun fixed here), `tsconfig.base.json`, solution `tsconfig.json`, `biome.json`, `commitlint.config.js`, `.dependency-cruiser.cjs`, `.gitignore` entries, and the new CI jobs. All six package manifests start with `private: true`, and the release job gets the publish guard that blocks a pre-freeze publish. Record the scaffold-step decisions in the change spec: exact Bun and pnpm versions, build tool (`tsdown` or `tsc`), `exports` targeting `dist` with types (never `src`), the MCP artifact form, the non-Bun SQLite driver path, and the CLI startup budget. No product behavior yet.
2. **Core contract surface and branding:** Create `core ./contracts` (Result, error table and stable codes, exit-code types, schema constants, ports, `BrandIdentity` type), `core ./branding` (the pure single name seam; the environment override and build-time define are read at a runtime-aware edge and passed in), and the `domain`, `app`, and `config` tiers. Add `createRuntime` with the injected configuration, adapters, store, and clock. Add the boundary matrices, the declared-entrypoint check, the ambient-global guard including `packages/core/src/branding` with a `process.env`/`Bun.env` negative fixture, and negative fixtures including cross-package relative imports and testkit dev edges. Add the forbidden-literal test, the rename drill including `.gitignore` and root workspace files, and the packed-artifact import test plus the Node `core` `.` import smoke.
3. **Configuration resolver:** Implement the DEC-4 chain, the merge rules (recursive maps, scalar replace, list replace, `reset`, null rejection), the typed environment mapping as the only environment mechanism (no in-file interpolation), the fail-closed secret-in-repository-scoped-layer rule with a canary fixture, the reserved `$schema`/`reset`/`x-` keys, the platform location table, the origin grammar for file, environment, and CLI layers, discovery with the outside-git behavior, the CI layer mode, and the legacy prefix adapter at `packages/adapters/src/legacy`. Test every layer, every merge rule, every warning, every rejection, and the fail-closed path.
4. **State store:** Implement the append-only JSONL writer with sequence and checksum framing, fsync, quarantine, the SQLite index behind `SqliteDriverPort` in `core ./state`, the non-Bun fallback path, schema versions, fence-epoch locking, rebuild, rotation, low-disk preflight, permissions, and the restore drill. Add redaction with `redactorVersion` and rule-set hash, closed payload schemas, the canary-secret test, and the forever-retention default. Prove that malformed input fails loudly and that a `SIGSTOP`-ed writer is fenced.
5. **Adapters and I/O ports:** Start with GitLab and Jira, the CI adapter, provider probes, the provider registry, the `ConfigSource` implementations including the legacy config adapter at `adapters ./legacy`, and the non-provider ports (`RepoStore`, `FileStore`, `HostPort`, `CiHealthPort`, `SessionStore`) under their `./repo`, `./file`, `./host`, `./session`, and `./legacy` subpaths. Build the fake server, trap catalogs, and conformance suite in `testkit`. Add GitHub when dogfooding requires it; leave Azure until a consumer exists.
6. **Surfaces:** Implement `cli` with the argument framework confined to the package, `runCli(argv, streams, deps)`, JSON and human output, the numeric exit-code projection, and a call into `createRuntime`. Implement `mcp` as a local tool surface over the same core services, with bounded outputs, a branded tool-name projection, and a capability set that mirrors the CLI where technically easy. Implement `opencode` as a thin native-tool surface with `@opencode-ai/plugin` as a peer, and add the Node harness smoke that stubs the host API and invokes its exported entry points. Add the MCP lifecycle, health and readiness, concurrency, and runbook gates.
7. **Dual-run and wrapper cutover:** Wire the first engines (status, join and exit taxonomy, provider, closeout) to run beside the bash stack. Mutating engines run shadow or read-only with deterministic `operationId` and a persisted key-to-outcome record. Cut a wrapper over only after the parity suite passes, the observation window is clean, the rollback is rehearsed, and the owner signs off. No gate is relaxed.
8. **Distribution and release:** Register the CLI binary, the MCP artifact, the opencode surface artifact, and updated wrappers in `install.sh` as separate artifact arrays, each with an install path, update and overwrite mechanics, and signature/checksum verification. Point the install source at `main-tools` for the delivery period (DEC-7). Add signature and checksum verification, fail-closed source checks, the four-copy pin-equality check, the pnpm pin check, binary smoke, SBOM, notices, license-registry audit, vulnerability scan, and clean-OS checks. Keep the bash install path intact.
9. **Publish readiness and publication:** Configure the changesets fixed group over the five intended publishable packages, `publishConfig` pointing at `dist`, `files`, `LICENSE`, and `THIRD-PARTY-NOTICES`, and run `pnpm pack`/`npm pack --dry-run` plus an import smoke test on every release. `publint` and `attw` are release blockers. Until the naming freeze, keep `private: true` on all six packages and keep the release-job publish guard active; the freeze change sets `private: false` on the five, applies the branded scope, publishes from the fixed group with provenance, and removes the guard.
10. **Documentation:** Add the tooling feature spec, the architecture overview, and the reader-facing CLI, MCP, and OpenCode documentation. Update `tools-convention.md` for the new runtime distinction and the error-table projection. Document the configuration layers and the provenance commands for users. Do not overwrite existing delivery-system specs.
11. **Old tool retirement:** Only after parity and a deprecation cycle, remove each bash tool and its install registration together. No permanent shims.

**Milestone stop conditions, leading indicator, and rollback statement:**

| Milestone | Stop condition: do not proceed if... | Rollback statement |
|-----------|--------------------------------------|--------------------|
| Scaffold | A runtime-neutral core tier contains a runtime import or ambient global; a non-provider I/O need has no port home; the lock fencing test fails; a dependency has no license-registry entry; the declared-entrypoint check permits an undeclared subpath or a `src` import; there is no approved non-Bun state driver at scaffold; the configuration resolver violates the precedence chain or cannot name a value's origin. | Revert the scaffold PR. The bash stack is untouched and no user-facing artifact was shipped. |
| First engines | A boundary or subpath fixture fails; a shadow run produces a duplicate mutation; an adapter has no conformance or trap coverage; the runtime-portability smoke or the packed-artifact import test fails. | Disable the engine in config; the wrapper keeps the bash body; state is append-only and replay-safe. |
| Wrappers | A parity regression appears; the observation window is dirty; signature verification fails; the rename drill fails. | Switch the wrapper feature flag back to bash; reinstall the previous signed release; no state deletion is required. |
| Harness and release | The OpenCode surface reaches into core internals; the MCP lifecycle or authorization model is undefined; a surface re-implements composition wiring; `publint` or `attw` fails; notices or SBOM are absent; `testkit` appears in a published dependency graph. | Revert the surface or release PR; the CLI and bash paths remain available; publication stays blocked. |

**Leading indicator:** time from scaffold merge to the first owner-usable `status --json` command, measured in days. It is reviewed at each milestone and trended down; if it grows without a matching risk reduction, the structure is over-built.

## Rollback / Reversal

**Reversal class:** moderate before the first public release; costly after package names, published package names, MCP tool names, or release tags are public.

- **Before any wrapper cutover:** Revert the `packages/` addition, `pnpm-workspace.yaml`, the root manifests, the lockfile, and the new CI jobs in one PR. The bash stack, install paths, and user-facing behavior are unchanged. No data migration is involved beyond local `.ai/local/state`. Nothing was published, so no consumer is affected.
- **After a wrapper cutover:** During the two-milestone retention window, flip the per-engine feature switch back to the bash implementation, then revert the wrapper change. After the window closes, roll back by reinstalling the previous signed release from the pinned tag (reinstall-only). State remains readable: the JSONL log is append-only, the index is rebuildable, and the operation index prevents the new tool from replaying a completed mutation within one workspace. The transfer guard keeps only one writer path live; the bash path does not consult the operation index.
- **After a state schema change:** Keep a dual-read window for one release. Rebuild the index from JSONL rather than mutating it in place. Quarantined segments are retained until the rollback window closes.
- **After a configuration layer change:** The resolver is versioned with the tool. An older tool ignores a newer layer only if the layer did not exist for it; a committed config written for a newer schema fails closed with `CONFIG_INVALID`, and the fix is to install the matching version or to run `--strict` diagnostics. No layer is silently dropped.
- **After the first public release:** Published package names, published library names, MCP tool names, and release tags cannot be un-published. Rollback means deprecating the artifact, publishing a corrective release, and keeping the old install path working for one cycle. This is why publication is deferred until the naming freeze and the publish path is proven.
- **Irrecoverable data:** none if the append-only log and its backup are retained. Deleting a state root, an external tracker mutation, or a published release is not reversible by this decision. Retention and backup reduce the chance of losing state history; the operation index prevents the new tool from replaying a completed mutation within one workspace, but it does not prevent deletion of a state root; notice requirements reduce the chance of an unwanted public release.
- **Stop conditions that trigger rollback:** any boundary violation in a merged change; any duplicate external mutation in a shadow or live run; any `STATE_CORRUPT` event not explained by a torn tail; a configuration precedence violation or a silently dropped layer; a failed signature or checksum verification; a high or critical vulnerability; a privacy gate failure; a runtime-portability violation; or a parity regression.

## Communication Plan

| Audience | Message | Channel | Timing |
|----------|---------|---------|--------|
| Owner (decider) | R3 record revised with the 2026-10-24 UQ-1 to UQ-8 answers, the owner-approved six-package structure, and the layered configuration model; the focused `@decision-critic` re-review of the six-package revision returned a narrow REWORK on 2026-10-24 (findings F1-F16), all findings are closed, and the confirmation re-review completed on 2026-10-24 with PASS_WITH_RISKS; the owner accepted on 2026-10-24 (`status: Accepted`, `decision_date: 2026-10-24`, `review_date: 2026-10-24`); UQ-9 (brand name) is deferred until before the first public release, protected by the branding seam. | PR #163 review and decision record | Accepted 2026-10-24 |
| `@decision-critic` | Confirmation re-review of the F1-F16 revision completed 2026-10-24: verdict PASS_WITH_RISKS, F1-F16 confirmed closed, residual risks CR-1 to CR-8 accepted. No further review round is scheduled for this revision; a new finding opens a new round. | PR review using `/review-decision` | Completed before acceptance |
| `@coder` and contributors | The scaffold contract: six packages and their subpaths, `createRuntime`, the state driver port, the layered config resolver, the error table, the wrapper cutover, and stop conditions. | Change spec, plan, and this record | At scaffold start and at each milestone |
| ADOS users | The bash stack keeps working; new tools appear beside it and take over only after parity; configuration is layered and explainable; installs and checksums are verified. | Release notes, `doc/guides/` updates, installer help | At each release that ships a new artifact |
| ADOS agents | Where new code belongs: package boundaries, core subpaths, declared entrypoints, testkit dev edges, and the error table. | `doc/spec/`, architecture overview, decision record | At scaffold and when a rule changes |
| Security, privacy, and legal reviewers | Signed releases, publish provenance, vulnerability gate, license registry under `doc/legal/`, notices, redaction, retention, and erasure gates are release blockers. | Change spec and release checklist | Before the first public release |
| Future maintainers | Why the monorepo has six packages, why pnpm manages dependencies while Bun builds, why branding and state are core subpaths, and why publication is deferred. | This decision record and the retrospective | On acceptance and at review_date |

## Verification Criteria

- **Metric:** Package dependency-graph violations across the DEC-2 matrix - Target: 0 - Window: every pull request.
- **Metric:** Imports of a core subpath that is not in the importer's declared entrypoints, including `adapters -> core ./state` and `adapters -> core ./branding` - Target: 0 - Window: every pull request.
- **Metric:** Core tier violations (`domain`/`app`/`config`/`branding`/`state`) - Target: 0 - Window: every pull request.
- **Metric:** Ambient runtime globals or runtime imports in the runtime-neutral core tiers, including `process.env`/`Bun.env` in `packages/core/src/branding` - Target: 0 - Window: every pull request.
- **Metric:** Undeclared workspace imports that pnpm isolation rejects - Target: 0 bypasses; no `hoist-pattern` or `shamefully-hoist` weakening without a recorded reason - Window: every pull request.
- **Metric:** Negative fixtures proving each forbidden edge fails, including a cross-package relative import, an undeclared subpath import, and a testkit dev edge - Target: one per rule - Window: scaffold complete.
- **Metric:** Public entry point check: every workspace import resolves through a declared subpath; no `exports` target points at `src`; every `exports` target points at `dist` with types - Target: 0 violations - Window: every pull request and every release.
- **Metric:** Forbidden product-name literals in `packages/**` and new user-facing docs outside the allowlist - Target: 0 - Window: every pull request.
- **Metric:** Rename drill passes after replacing branding values and the legacy mapping, including the `.gitignore` project-local pattern assertion and the root workspace files check - Target: pass - Window: branding changes and release gate.
- **Metric:** `tsc -b` clean with the strict flags - Target: clean - Window: every pull request.
- **Metric:** Runtime-portability smoke: contract and core tests pass under a second runtime host - Target: pass - Window: every pull request.
- **Metric:** Packed-artifact import test: `core` `.`, `core ./contracts`, and `core ./branding` load without any state driver; only `core ./state` requires the driver; the Node import smoke imports `core` `.` - Target: pass - Window: every pull request and every release.
- **Metric:** Configuration precedence: each layer contributes in the documented order, and the reported provenance matches the winning layer - Target: pass for every layer - Window: every pull request.
- **Metric:** Configuration merge semantics: recursive map merge, scalar replace, list replace, `reset`, null rejection, and typed environment mapping - Target: pass for every rule - Window: every pull request.
- **Metric:** Configuration validation: unknown key error; `$schema`, `reset`, and `x-` reserved keys accepted; malformed file fails closed with a distinct exit code; `--strict` promotes warnings; a secret in a repository-scoped layer (project committed or project local) fails with `CONFIG_INVALID` (canary fixture) - Target: pass - Window: every pull request.
- **Metric:** Configuration discovery and origin: platform location table matches; the walk stops at the git root and never reads a config above it; outside a git repository the project layers are skipped with reason `no-git-root`; `CI=true` disables the system and user-global layers and the project-local layer; file, environment, and CLI origins follow the defined grammar - Target: pass - Window: every pull request.
- **Metric:** Existing bash test suite result - Target: no regression - Window: every pull request.
- **Metric:** `e2e-mock` coverage of adapters without secrets - Target: every adapter has fixtures - Window: each adapter delivery.
- **Metric:** State JSONL rebuild reproduces the SQLite index - Target: identical query results - Window: state feature delivery.
- **Metric:** Lock fencing tests (`SIGSTOP` resume, PID reuse, clock step forward and backward) - Target: pass - Window: state feature delivery.
- **Metric:** State retention default - Target: no automatic deletion of events under the default forever policy; rotation does not lose events - Window: every release.
- **Metric:** Dual-run mutating engines produce duplicate external mutations - Target: 0 - Window: every shadow run and cutover.
- **Metric:** Dual-run parity for a migrated engine - Target: parity suite passes and the observation window is clean - Window: before each wrapper cutover.
- **Metric:** Secrets or absolute user paths in state and telemetry fixtures - Target: 0 - Window: every pull request.
- **Metric:** Canary secret occurrences in state and telemetry - Target: 0 - Window: every pull request.
- **Metric:** State directory and file permissions, platform-qualified - Target: POSIX `0700` directory and `0600` files; Windows restrictive ACL granting only the current user (plus SYSTEM and administrators where required) and denying other users - Window: every state open and every release check.
- **Metric:** License registry coverage - Target: every dependency has an entry with SPDX id, verdict, approver, date, scope, and review date; the registry is readable YAML under `doc/legal/`; no denied license; unknown and compound expressions fail closed - Window: every pull request.
- **Metric:** Vulnerability gate - Target: 0 high or critical findings - Window: every pull request.
- **Metric:** GitHub Actions pinned by commit SHA; unpinned action references - Target: 0 - Window: every pull request.
- **Metric:** Release credentials issued through OIDC; long-lived release secrets - Target: 0 - Window: every release and every change to release configuration.
- **Metric:** MCP mutating tools require authorization and confirmation before execution; unconfirmed mutation attempts blocked - Target: 0 unconfirmed mutations - Window: every MCP change and every release that ships an MCP artifact.
- **Metric:** MCP and CLI capability parity: every CLI capability is available through MCP or has a recorded divergence reason - Target: 0 undocumented divergences - Window: every MCP change.
- **Metric:** Prompt-injection fixture: untrusted MCP tool input, description, or returned content cannot grant authority or trigger a mutation - Target: fixture passes - Window: every MCP change.
- **Metric:** Privacy review sign-off recorded before the first release that persists or exports events - Target: recorded - Window: release gate.
- **Metric:** Metadata-only clause for `SessionStore` and `HostPort`: no message content, prompts, transcripts, credentials, environment values, or command arguments surfaced; field classification applied to every surfaced field - Target: 0 violations - Window: every pull request that touches either port, and privacy sign-off before the `db` administration engine ships.
- **Metric:** Closed payload schema validation rejects unknown fields for every event type at write time - Target: 0 unknown-field writes accepted - Window: every pull request and each new event type.
- **Metric:** Surface-level non-Bun smoke (defined host per surface): (a) the mcp surface starts and completes a read-only command under Node; (b) the opencode surface entry point starts and completes a read-only command under a Node harness that stubs the OpenCode host API and invokes the exported native-tool entry points; both assert that the surface imports only declared `core` entrypoints - Target: pass - Window: every pull request.
- **Metric:** Release artifacts - Target: CLI binary, MCP artifact, OpenCode surface, the five published packages, `SHA256SUMS`, signature, CycloneDX SBOM, `THIRD-PARTY-NOTICES` - Window: every release.
- **Metric:** Publish gates - Target: `publint` and `attw` clean for every publishable package; `exports` point at `dist`; the packed-import smoke test passes; all published packages share one version; `testkit` absent from every published dependency graph; before the naming freeze all six packages are `private: true` and the release-job publish guard blocks a pre-freeze publish - Window: every release.
- **Metric:** Installer verification - Target: signature and checksum verified before install; non-HTTPS or missing checksum fails closed; the install source matches the DEC-7 branch rule - Window: every install and release.
- **Metric:** Pin equality across `.bun-version`, `engines.bun`, CI, and release build, plus the pnpm `packageManager` pin - Target: identical - Window: every pull request.
- **Metric:** Clean-OS binary smoke - Target: `--version` and a JSON command succeed without a language runtime - Window: every release.
- **Metric:** CLI startup time - Target: within the scaffold-set budget, measured - Window: every release.

## Confidence Rating

**Medium-high.** The structure is grounded in a concrete, proven single-package template, in the repository's own constraints, in the owner's specific answers to the eight open questions, and in owner-approved research on the package set and the configuration model. The package graph is deliberately small and the enforcement is testable. The remaining uncertainties are external or packaging-level: the non-Bun SQLite driver, the OpenCode harness form, the MCP artifact form, the CJS question, publish timing, and the license verdicts. None of those changes the package boundaries; they change packaging, defaults, or release timing. AI-generated confidence is not evidence. The formal `@decision-critic` returned REWORK on 2026-10-24; on re-review of the following revision on 2026-10-24 it returned PASS_WITH_RISKS with non-blocking corrections. A focused re-review of the six-package revision on 2026-10-24 returned a narrow REWORK: the package graph was endorsed, but findings F1-F16 required correction. All 16 findings are closed in this revision (F1-F8 plus the process item were required; F9-F16 were non-blocking corrections). The confirmation re-review of that revision completed on 2026-10-24 with PASS_WITH_RISKS: it confirmed F1-F16 closed and accepted residual risks CR-1 to CR-8. The owner's final decision remains required, and UQ-9 (brand name) remains the only open owner question, blocking publication only.

## Adversarial Challenge (R3)

**Prior same-lineage review input:** CritiqueGrid review `CG-2026-10-23-PR-163-ADR-0003` (2026-10-23), covering decision quality, architecture, security, legal, SRE, and privacy, with four adversarial challenge packets. The review found 0 critical findings after challenge, 16 warnings, and 22 additional findings, and returned verdict `CONCERNS`. It is cited as review input, not as independent evidence.

**Owner responses:** Owner direction via CEO session 2026-10-23 answered the eight open questions recorded as review file comments and chose R3. The review addendum records those eight answers plus the R3 choice and maps each one to the findings; it states the then-current verdict as `CONCERNS` because the ADR text had not yet incorporated the answers.

**Owner answers to this revision (2026-10-24):** the owner answered UQ-1 through UQ-8 in PR #163 review 5636881026 and approved the six-package structure and the layered configuration precedence model from external research 2026-10-24. Those answers are recorded verbatim (or faithfully condensed where the table says so) in the Owner answers section of Context, are reflected in DEC-1 through DEC-10, and are listed in the Evidence table.

**What this revision changes in response (revision 1, REWORK fixes):** rigor is R3 with the required sections; owner decisions are quoted from the owner's own words instead of an unverifiable locator; C-9 is stated as a design obligation with a documented degraded mode and a scaffold stop condition, not as a waived risk; DEC-5 makes the platform table primary and records the resolved path in `manifest.json`; DEC-7 keeps the bash body for a two-milestone retention window as the rehearsed rollback; DEC-6 scopes the operation index and adds a transfer guard; C-10 and C-11 gain verification metrics; C-3 names the seed literal set; DEC-1 and DEC-2 rank citations match the ranked list; the formal REWORK verdict and a finding-by-finding disposition table are recorded below. The 2026-10-24 PASS_WITH_RISKS re-review then added: the re-review verdict and accepted-risk list; the scope-label sweep; `packages/opencode` in the install and distribution arrays plus the legibility-trap note; the C-11 metadata-only clause for `SessionStore` and `HostPort`; a defined Node-harness opencode non-Bun smoke; the "owner decision questions" wording; a template-aligned alternatives legend with Alt 2 C-9 marked `Yes`; unified "retention window" terminology; the qualified operation-index statement; and the reframed UQ-2.

**What this revision changes in response (revision 2, 2026-10-24, owner UQ answers and owner-approved research):**

- **Structure:** nine packages become six. `contracts`, `branding`, and `state` are now `core` subpaths (`.`/`./contracts`/`./state`/`./branding`) rather than packages; `createRuntime` is the single composition root, which removes the per-surface wiring duplication that revision 1 accepted as a cost. Every reference to the old set, the dependency matrix, the subpath rules, the dev-edge table, the install arrays, the distribution rules, the verification criteria, and the implementation plan was swept.
- **Toolchain:** pnpm workspaces manage dependencies (isolation and publish provenance) while Bun stays the pinned runtime and build target; one lockstep version line via a changeset fixed group; `dist`-targeted exports with `publint` and `attw` gates; boundary enforcement rests on real dependencies plus dependency-cruiser over declared entrypoints, with pnpm isolation as the expected second layer (ASSUMPTION pending verification).
- **Scope:** UQ-1 is resolved. The committed OSS scope is every roadmap phase that includes any OSS part; the roadmap is to be revised. The M0-M3 versus M0-M4 conflict and every "scope pending owner confirmation" qualifier are removed.
- **Install, license registry, publishing, MCP, state, retention:** UQ-2 is reflected in DEC-7 and C-7; UQ-3 in C-2; UQ-5 in DEC-3; UQ-6 and UQ-8 in DEC-5; UQ-7 in DEC-3 and DEC-6.
- **Configuration:** DEC-4 is rewritten as the owner-approved layered model with per-key provenance, explicit merge rules, debug and explain commands, and the GH-49 inheritance item absorbed into the model rather than deferred.

**What this revision changes in response (revision 3, 2026-10-24, focused REWORK fixes):**

- **Branding/runtime seam (F1):** the environment override is read at a runtime-aware edge and passed into a pure branding resolver; `./branding` performs no ambient environment read; an ambient-global negative fixture and metric cover `packages/core/src/branding`.
- **Packed-artifact metric (F2):** `core` `.`, `core ./contracts`, and `core ./branding` must load without any state driver; only `core ./state` requires it; a Node import smoke imports `core` `.`.
- **Configuration hardening (F3-F6, F14):** secret in any repository-scoped layer (project committed or project local) is a hard `CONFIG_INVALID` error; keyring is removed from v1; the typed `<PRODUCT>_*` mapping is the only environment mechanism and in-file interpolation is rejected; `$schema`, `reset`, and `x-` are reserved; macOS and Windows locations are defined for the system and user-global layers; the debug origin grammar and the outside-git behavior are defined.
- **Platform and repository seams (F7, F8):** POSIX `0700`/`0600` is qualified and paired with the Windows ACL equivalent; the project-local config uses a brand-free `.gitignore` pattern and the rename drill covers `.gitignore` and root workspace files.
- **Publishing, adapters, and state (F9, F13, F15, F16):** all six packages are `private: true` until the freeze and the release job has a publish guard; the legacy `ConfigSource` adapter and non-provider I/O subpaths are named, with a split trigger; the adapters package states the published metadata-only obligation; the envelope's local-scope fields are named in the shared/global state gate.

**Formal `@decision-critic` verdict (first pass):** Verdict (verbatim): `REWORK`. Date: 2026-10-24. Outcome at first pass: `REWORK-fixed`; the reviewer outcome later became `PASS_WITH_RISKS` (re-review below). The critic returned REWORK on the previous revision. This record addresses all 15 items below. The record did not move to `Accepted` with an open REWORK verdict.

**Formal `@decision-critic` re-review verdict:** Verdict: `PASS_WITH_RISKS`. Date: 2026-10-24. Scope: re-review of the REWORK revision described above. The critic confirmed the 15 REWORK items were addressed and returned 10 non-blocking corrections. All 10 were applied in revision 1; revision 2 preserves them except where an owner answer or the six-package restructure supersedes the earlier text. The verdict is not acceptance: `status` stays `Proposed` and `decision_date` stays null until the owner decides.

**Focused `@decision-critic` re-review verdict (revision 2):** Verdict: `REWORK` (narrow). Date: 2026-10-24. Scope: focused re-review of the six-package revision (the six-package restructure, the pnpm toolchain, the resolved UQs, and the DEC-4 rewrite). The critic endorsed the package graph, the six-package set, and the general direction, and returned 8 required findings (F1-F8) plus a required process finding, with non-blocking corrections F9-F16. All 16 findings are closed in this revision; the disposition table below maps each finding to its closure. The verdict is not acceptance: `status` stays `Proposed` and `decision_date` stays null until the owner decides. A confirmation re-review of that revision was requested and is recorded next.

**Confirmation `@decision-critic` re-review verdict (revision 3):** Verdict: `PASS_WITH_RISKS`. Date: 2026-10-24. Scope: confirmation re-review of the F1-F16 revision (the six-package structure, the pnpm dependency layer with Bun as the pinned runtime and build target, the DEC-4 layered configuration model, the branding seam, and the revision-3 corrections). Result: all 16 findings, F1-F16, are confirmed closed; none was reopened and no new blocking finding was raised. The verdict is not acceptance: `status` stays `Proposed`, `decision_date` stays null, and the owner remains the only authority who can accept the record. The residual risks the confirmation accepted are listed below; they are recorded, accepted risks, not open findings.

**Accepted residual risks from the confirmation re-review (2026-10-24, faithfully condensed by the record writer):**

| # | Accepted residual risk | Why it is accepted | Where handled |
|---|------------------------|--------------------|---------------|
| CR-1 | The non-Bun SQLite driver path is unproven. | The port abstraction contains the exposure, and an approved driver is a scaffold stop condition rather than a design assumption. | DEC-5; DEC-3; scaffold stop condition "no approved non-Bun state driver at scaffold"; revisit trigger; TO-CONFIRM row |
| CR-2 | The OpenCode native-tool shape is unproven, including the exact host API the surface may use. | The surface is thin by construction and the host simulation makes the shape testable before it is depended on. | DEC-1 harness consumption model; surface-level non-Bun smoke metric; revisit trigger |
| CR-3 | The CommonJS entry point question and whether a third-party embed API can consume `createRuntime` directly remain open. | Neither affects package boundaries; both are packaging questions recorded as evidence-level TO-CONFIRMs, and neither justifies a second composition root. | DEC-1 composition root; Unresolved Questions TO-CONFIRMs |
| CR-4 | Dependency license verdicts and marksync-for-confluence authorship and license are not yet recorded. | Both are human verification steps outside the record writer's authority, and neither changes the package graph. | C-2; DEC-9 provenance rule; Evidence table; Unresolved Questions |
| CR-5 | The installed corpus migration has not happened; the rename claim covers `packages/**` and new user-facing docs only. | The scope of the claim is stated explicitly, and the corpus migration is a separate tracked change with its own drill extension. | C-3; DEC-8 scope-of-the-claim rule |
| CR-6 | The six-package set may need a state driver package split if its runtime-specific dependency becomes a consumer burden. | A documented split trigger makes the change cheap and the split would not disturb the other five packages. | DEC-1; DEC-6 split trigger; revisit trigger |
| CR-7 | Forever retention means unbounded state growth until custom retention policies exist. | The owner chose forever retention for v1; disk preflight and rotation bound the failure mode, and retention policy is a later owner decision. | DEC-5; Negative Outcomes; UQ-6 answer |
| CR-8 | The workspace identity model, the per-workspace partition, and the lock scope are unproven until the first multi-workspace exercise. | They are a milestone gate before shared-state work, not a v1 defect; the envelope fields are named so the generalization is explicit. | DEC-5; Unresolved Questions milestone gate note |

Three risks accepted in the earlier PASS_WITH_RISKS round remain open and are carried forward: R-2 (the `packages/opencode` versus `.opencode/` legibility trap), R-3 (`SessionStore` and `HostPort` personal-data exposure, bounded by the metadata-only clause), and R-5 (the two remaining evidence-level TO-CONFIRMs on marksync and the license verdicts). R-1, R-4, R-6, R-7, and R-8 are closed as recorded in the table above.

**Publication gate:** UQ-9 (brand name: product name, binary name, and naming-freeze date) is deferred by the owner (2026-10-24) until before the first public release. It blocks publication only, and the design already protects against the deferred rename: the branding seam, the `private: true` publish guard, the forbidden-literal test, and the rename drill. It does not block the scaffold, the dual-run work, or any implementation step that keeps `private: true` and the publish guard in place. The record was accepted by the owner on 2026-10-24.

**Disposition of the focused re-review findings F1-F16 (2026-10-24):** the confirmation re-review of 2026-10-24 verified every row below as closed; no finding was reopened.

| # | Finding | Type | Disposition | Where addressed |
|---|---------|------|-------------|-----------------|
| F1 | Branding environment override read inside the branding module, breaking runtime neutrality | required | closed | C-3; DEC-1 branding tree, `./branding` subpath, shared-module bullet; DEC-2 tier rule, ambient rule, guard, negative fixture; DEC-8; C-3 attestation; ambient-global metric; step 2 |
| F2 | Packed-artifact metric required a state driver for too many core entry points | required | closed | C-9 verification; DEC-3 runtime portability; packed-artifact metric; step 2 |
| F3 | Secret-in-committed-layer rule was contradictory (warning plus error) | required | closed | DEC-4 validation (hard `CONFIG_INVALID`); configuration validation metric; step 3 |
| F4 | Keyring was an undefined v1 secret source | required | closed | DEC-4 validation: keyring removed from v1 with a defined path to return as an explicit source |
| F5 | Two environment mechanisms and an overly narrow unknown-key rule | required | closed | DEC-4 merge semantics and validation: typed mapping only, no in-file interpolation; `$schema`, `reset`, `x-` reserved |
| F6 | macOS and Windows config locations missing; CI-disabled layer names drifted | required | closed | DEC-4 platform table; debug/explainability CI sentence; discovery metric |
| F7 | `0700`/`0600` stated without platform qualification | required | closed | C-11; DEC-5 layout and permissions; C-11 attestation; permissions metric |
| F8 | Project-local config ignore rule and rename-drill scope | required | closed | DEC-1 root workspace files; DEC-8 forbidden-literal and rename drill; rename-drill metric |
| Process | Focused REWORK verdict not recorded in the record's verdict trail | required | closed | Frontmatter `reviewers` and `ai_assistance.reviewers`; this section; Communication Plan; Confidence Rating |
| F9 | Legacy config adapter port/home unnamed; adapters non-provider subpaths and split trigger incomplete | non-blocking | closed | DEC-1 package tree and public entry points; DEC-4 legacy adapter; DEC-6 split trigger; step 5 |
| F10 | pnpm isolation labelled as fact inconsistently | non-blocking | closed | Evidence table; DEC-2 dependency rules and enforcement; DEC-3 package manager; Positive Outcomes |
| F11 | C-3 attestation wording narrower than the full C-3 scope | non-blocking | closed | Alt 1 constraint compliance; C-3 attestation |
| F12 | Revisit trigger treated the system config layer as future | non-blocking | closed | Frontmatter `revisit_triggers` |
| F13 | No guard against accidental pre-freeze publishing | non-blocking | closed | DEC-1 recommendation; DEC-3 publish path; DEC-8 package names; C-7; steps 1 and 9; publish-gates metric |
| F14 | Config debug origin grammar and behaviour outside a git repository undefined | non-blocking | closed | DEC-4 debug and discovery; discovery/origin metric |
| F15 | Shared and global state levels not tied to the envelope's local-scope fields | non-blocking | closed | DEC-5 state levels; Unresolved Questions milestone gate note |
| F16 | Published adapters make the metadata-only contract a public API obligation, unstated | non-blocking | closed | DEC-1 adapters package description and public entry points |

**Accepted risks from the PASS_WITH_RISKS re-review (8 items, faithfully condensed; the critic's exact wording was not available to the record writer):**

| # | Accepted risk | Why it was accepted | Where handled | Status after revision 2 |
|---|---------------|---------------------|---------------|-------------------------|
| R-1 | Bare scope labels remained outside the owner decision record, so a reader could take an unconfirmed scope as settled; the underlying M0-M3 versus M0-M4 conflict was unresolved. | The conflict was an owner question (UQ-1), not a record defect. | Every scope boundary was qualified in revision 1. | Closed by the UQ-1 answer: the committed OSS scope is every roadmap phase that includes any OSS part. |
| R-2 | `packages/opencode` coexists with the canonical root `.opencode/` directory, a legibility trap for agents and contributors. | Renaming either side would break C-6 or the agreed package set, so the risk is managed by an explicit statement, not by a move. | DEC-1 harness consumption model; DEC-7 distribution rules legibility-trap sentence. | Open, accepted. |
| R-3 | `SessionStore` (foreign session database reads) and `HostPort` (process inspection) can expose personal data. | Both are needed for `db` administration and host facts; a metadata-only bound plus a sign-off gate contains the exposure. | C-11 metadata-only clause; DEC-6 port bullets; verification metric. | Open, accepted. |
| R-4 | The opencode half of the non-Bun smoke metric was underspecified, so it could not be verified as written. | Dropping it would weaken C-9; defining a host simulation keeps the metric testable. | C-9 verification; the surface-level non-Bun smoke metric names the Node harness and stubbed host API. | Open, accepted. |
| R-5 | Two evidence-level TO-CONFIRMs remain: marksync authorship and license, and the dependency license verdicts. | Both require human verification outside this record; they do not change the package graph. | Evidence table rows; the Unresolved Questions section states they are evidence gaps, not owner decisions. | Open, accepted; revision 2 adds the SQLite driver, CJS, and embed-API TO-CONFIRMs. |
| R-6 | Alt 2 was marked `Risk` on C-9, a `negotiable: no` constraint, which contradicts the template's accepted-risk rule. | The alternative does meet C-9 by design; only enforcement is weaker, so the fit text carries the gap. | Alternatives legend; Alt 2 C-9 now `Yes`. | Closed, accepted as corrected. |
| R-7 | The operation-index text implied it protects against state-root deletion; retention and backup do. | The index only de-duplicates replay within a workspace; the overclaim can be qualified without changing the design. | Rollback / Reversal "Irrecoverable data" bullet. | Closed, accepted as corrected. |
| R-8 | Install-source ambiguity and terminology drift (`deprecation window` versus `retention window`) made obligations harder to read. | Delivery installs were already pinned, tagged, and checksummed under C-10; only the default source remained open. | UQ-2 reframed in revision 1; DEC-7 open item. | Closed by the UQ-2 answer: `main-tools` now, `main` after the public-ready merge. |

**Non-blocking corrections applied from the re-review (10):**

| # | Correction | Where applied |
|---|------------|---------------|
| 1 | Record the re-review verdict, date, scope, and the 8 accepted risks; replace "re-review pending"; fix the "nine open questions" wording to eight file comments plus the R3 choice. | Frontmatter `reviewers`; this section; Confidence Rating. |
| 2 | Sweep bare scope labels at scope boundaries. | Superseded in revision 2 by the UQ-1 answer: the qualifiers are removed entirely. |
| 3 | Register `packages/opencode` in install and distribution arrays with update mechanics; note the `.opencode/` coexistence trap. | C-7; DEC-7; Implementation Plan step 8; attestation. |
| 4 | Add the C-11 metadata-only clause for `SessionStore` and `HostPort`. | C-11; DEC-6; attestation; verification metric. |
| 5 | Define the opencode non-Bun smoke host instead of dropping the metric. | C-9 verification; verification metric. |
| 6 | Soften "only open owner questions" and name the two evidence-level TO-CONFIRMs. | Unresolved Questions preamble. |
| 7 | Align the alternatives legend with the template; mark Alt 2 C-9 `Yes` with the enforcement gap in the driver fit. | Alternatives legend; Alt 2. |
| 8 | Unify "deprecation window" and "retention window" to "retention window". | DEC-7. |
| 9 | Qualify the operation-index claim: retention and backup protect a state root, not the index. | Rollback / Reversal. |
| 10 | Reframe the install-source question to the bootstrap and development source only, with delivery installs pinned and checksummed. | Closed by the UQ-2 answer in revision 2. |

**Disposition of prior CritiqueGrid findings:**

| Finding group | Disposition | Where addressed |
|---------------|-------------|-----------------|
| Decision quality: unverifiable locator, scope conflict, stale-scope claims, rank citations, review-label overreach | closed | Owner decision record; Owner answers; Evidence table; DEC-1; DEC-2; this section |
| Architecture: package boundaries, harness shape, state driver, contracts split | closed | DEC-1; DEC-2; DEC-3; DEC-9 |
| SRE and operations: lock and fencing, index rebuild, rollback, distribution | closed | DEC-5; DEC-6; DEC-7; Rollback / Reversal |
| CG-SEC-001 through CG-SEC-004 | closed | C-10; DEC-3; DEC-7; Verification Criteria |
| CG-PRIV-001 through CG-PRIV-005 | closed | C-11; DEC-5; Verification Criteria |
| CG-LEG-001 and CG-LEG-007 (marksync provenance and license) | closed | DEC-9 provenance rule; C-2 |
| CG-DEC-007 (naming corpus scope) | closed | C-3; DEC-8 scope-of-the-claim rule |
| Remaining CritiqueGrid warnings (16) and additional findings (22) not individually cited | deferred | First retrospective; none changes the package graph |
| Open owner questions | deferred (owner, 2026-10-24) | UQ-9 Brand name (Unresolved Questions) - decided before the first public release, protected by the branding seam |

**Disposition of the 15 `@decision-critic` REWORK items (2026-10-24):**

| # | Critic item | Disposition | Where addressed |
|---|-------------|-------------|-----------------|
| 1 | Owner-decision locator used unverifiable claims | closed | Owner decision record quotes the 2026-10-23 owner statements as FACT rows; Evidence table re-sourced; the 2026-10-24 answers are recorded with the review ID |
| 2 | Scope conflict between two owner statements | closed by the UQ-1 answer | Owner answers section; C-1; Context; DEC-1; every scope qualifier removed |
| 3 | C-9 attestation implied an accepted-risk waiver | closed | C-9 statement; DEC-3 state driver; Constraint Compliance Attestation; scaffold stop condition "no approved non-Bun state driver at scaffold" |
| 4 | DEC-5 state default contradicted itself | closed | DEC-5 Location and precedence: platform table is primary; override > Linux XDG_STATE_HOME > per-platform default; resolved path in `manifest.json` |
| 5 | DEC-7 cutover and rollback contradicted each other | closed | DEC-7 keeps the bash body for a two-milestone retention window as the rehearsed rollback; post-window rollback is reinstall-only |
| 6 | Operation-index claim overstated; concurrent first-run race | closed | DEC-6 scope and transfer guard; DEC-5 root manifest lock; Rollback / Reversal states that retention and backup protect a state root, not the index |
| 7 | C-10 and C-11 verification gaps | closed | Verification Criteria adds SHA pins, OIDC credentials, publish provenance, MCP authorization and confirmation, prompt-injection fixture, privacy sign-off, payload schema validation, the C-11 metadata-only clause, and a surface-level non-Bun smoke with a defined Node harness |
| 8 | C-3 forbidden-literal seed set unnamed | closed | C-3 and DEC-8 name `ados`, `ADOS_`, and `~/.ados`; the test grows with the frozen name set |
| 9 | DEC-1 and DEC-2 rank citations wrong | closed | DEC-1 and DEC-2 fit paragraphs aligned to the authoritative ranked list |
| 10 | CritiqueGrid called "independent review evidence" | closed | Frontmatter and Decision Rights call it same-lineage review input; formal REWORK verdict recorded |
| 11 | Alt 2 matrix Risk legend undefined for negotiable:no | closed | Alternatives legend aligned to the template (`Risk` only for `negotiable: yes`); Alt 2 C-9 marked `Yes` with the enforcement gap in its driver fit |
| 12 | R3 acceptance deadline and escalation missing | closed | Decision Rights adds the acceptance deadline and owner escalation authority |
| 13 | C-4 private-reference interpretation and scan | closed | C-4 interpretation sentence; private paths replaced with generic descriptions; scan found no private identifiers |
| 14 | No finding disposition table | closed | This section: the CritiqueGrid table and the 15-item table |
| 15 | Owner-dependent items not consolidated | closed | Unresolved Questions lists the one remaining owner item (UQ-9); the eight answered questions are facts in Context |

**Open items:** no owner decision item remains open. UQ-9 (brand name) is deferred by the owner (2026-10-24) until before the first public release and is protected by the branding seam. The post-exercise workspace identity confirmation is a milestone gate note, not an open question. The evidence-level TO-CONFIRMs listed in Unresolved Questions remain evidence gaps, not owner decisions. The focused re-review of revision 2 returned a narrow REWORK on 2026-10-24 and all F1-F16 findings are closed in revision 3; the confirmation re-review of revision 3 returned PASS_WITH_RISKS on 2026-10-24, confirmed F1-F16 closed, and accepted the residual risks CR-1 to CR-8 listed above. The owner accepted the record on 2026-10-24 via PR #163.

**Independence caveat:** same-model reviewers share lineage and are not independent evidence. R3 still requires the owner's human decision. The owner is the only authority who can accept this record.

**Explicit dissent:** the formal critic returned REWORK on 2026-10-24; that dissent is recorded here and resolved item by item in the 15-item disposition table. The re-review of 2026-10-24 returned PASS_WITH_RISKS and cleared the REWORK verdict with 10 non-blocking corrections, all applied in revision 1. The focused re-review of revision 2 on 2026-10-24 returned a narrow REWORK with findings F1-F16; all 16 are closed in revision 3, and the confirmation re-review of revision 3 on 2026-10-24 returned PASS_WITH_RISKS with the residual risks listed above. No dissent is recorded from the decider. CritiqueGrid residual concerns are listed above and in the Unresolved Questions. The record does not move to `Accepted` until the owner decides.

**Residual risks after this revision:** the non-Bun driver is unproven; the OpenCode native-tool shape is unproven; the CJS question is open; the third-party embed API is unproven; the license verdicts are not yet recorded; the installed corpus migration is not done; the six-package set may need a state driver package split if its runtime dependency becomes a consumer burden; forever retention means unbounded growth unless custom retention policies are added later; and the workspace identity model is unproven until the first multi-workspace exercise. The eight PASS_WITH_RISKS accepted risks from the earlier round are listed above with their current status, and the confirmation re-review of 2026-10-24 accepted residual risks CR-1 to CR-8 with PASS_WITH_RISKS. These are recorded as owner questions, evidence gaps, milestone gates, or scaffold-step decisions rather than hidden.

## Structured Retrospective

**Status:** TODO: first retrospective after the scaffold and the first wrapper cutover. `review_date` is set to 2026-10-24 (acceptance).

### Process quality

- Was R3 the right rigor, and did the formal challenge arrive before acceptance?
- Did the owner answers reach the record verbatim, and did the six-package restructure preserve every constraint?
- Did the focused re-review of revision 2 find a defect that the earlier reviews missed?

### Evidence quality

- Did the runtime-portability smoke and the non-Bun driver spike confirm the assumption?
- Did the license registry resolve every candidate, and were any verdicts reversed?
- Did the CritiqueGrid findings prove accurate in implementation?
- Did pnpm isolation and the declared-entrypoint rules catch a real boundary violation in practice?

### Execution quality

- Did the scaffold keep the package graph and subpath rules green without advisory exceptions?
- Did the wrapper cutover follow the parity gate, and was the rollback rehearsed?
- Did any engine land without a port home or with a runtime leak?
- Did every surface call `createRuntime` rather than build its own wiring?

### Realized outcome

- Did time to first slice stay acceptable, and did the leading indicator trend down?
- Did the rename drill pass on the first attempt, and did the corpus migration stay countable?
- Did `publint`, `attw`, and the packed-import smoke test expose defects before publication?
- Did the layered configuration model answer real user questions, or did the extra layers cost more than they solved?

### Luck and variance

- Which outcomes were driven by the structure, and which by timing, a favorable Bun release, or an unplanned dependency change?
- Would a simpler structure have produced the same outcome with less ceremony?

## References

- [AGENTS.md](../../AGENTS.md) - branch model, repository layout, `.opencode` source of truth, distribution conventions.
- [Tools Convention](../guides/tools-convention.md) - existing CLI tool standards and legacy exit codes.
- [ADR-0001: Decision-Making Framework Refactor](ADR-0001-decision-making-framework.md) - decision process and record discipline.
- [ADR-0002: Readiness Gate](ADR-0002-readiness-gate-definition-of-ready.md) - structural decision precedent.
- [Decision Record Template](../templates/decision-record-template.md) - body structure and R3 rendering.
- [Project decision instructions](../../.ai/agent/decision-instructions.md) - tracking conventions, rigor levels, and project priorities.
- Owner direction via CEO session 2026-10-23 - owner decisions on the monorepo, scope, license, naming, and strangler; the statements are quoted verbatim in the Owner decision record.
- Owner answers to UQ-1 through UQ-8, PR #163 review 5636881026, 2026-10-24 - scope, install source, license registry, configuration levels, publication set, retention, MCP scope, and state abstraction; quoted in the Owner answers section.
- Owner sequencing note in the owner's local working notes, 2026-10-24 - later scope sequencing statement quoted verbatim in the Owner decision record (private working note, described generically; not committed; superseded by the UQ-1 answer).
- CritiqueGrid review `CG-2026-10-23-PR-163-ADR-0003`, 2026-10-23 - prior same-lineage review input (private working record, described generically; not committed).
- Review addendum, 2026-10-24 - owner answers mapped to the CritiqueGrid findings (private working record, described generically; not committed).
- External research, 2026-10-24 - owner-approved monorepo package structure (six packages, pnpm workspaces with Bun as runtime and build target, lockstep publish line, declared-entrypoint enforcement) and the layered configuration precedence model (DEC-3 and DEC-4).
- Focused `@decision-critic` re-review of revision 2, 2026-10-24 - narrow REWORK: package graph endorsed; findings F1-F16 (review record described generically; not committed).
- Confirmation `@decision-critic` re-review of revision 3 (the F1-F16 revision), 2026-10-24 - PASS_WITH_RISKS: F1-F16 confirmed closed; residual risks CR-1 to CR-8 accepted (review record described generically; not committed).
- `scripts/install.sh` - current distribution registration arrays and installer verification behavior.
- marksync-for-confluence repository (owner's sibling repository; license and authorship to be verified before any source reuse), local evaluation on 2026-10-23: `package.json`, `tsconfig.json`, `.dependency-cruiser.cjs`, `src/domain`, `src/app`, `src/cli`, `src/infra`, `tests/`, `.github/workflows/ci.yml`, and `.github/workflows/release.yml`.
