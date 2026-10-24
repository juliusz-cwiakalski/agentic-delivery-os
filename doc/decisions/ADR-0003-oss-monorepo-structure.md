---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/decisions/ADR-0003-oss-monorepo-structure.md
id: ADR-0003
decision_type: adr
status: Proposed
created: 2026-10-23
decision_date: null
last_updated: 2026-10-24
summary: "Adopt a root packages/ Bun-workspace monorepo: a contracts leaf with subpaths, a runtime-neutral core with ports-and-adapters tiers, thin cli/mcp/opencode surfaces, provider adapters, a pluggable local state store, one branding constant, and a dev-only testkit; keep the existing layout and migrate by a wrapper-based strangler."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os
decision_area: architecture
decision_scope: org
reversibility: moderate
review_date: null
business_impact: "Unblocks the M0-M3 (scope pending owner confirmation) TypeScript delivery tooling while isolating change from the running bash stack; makes the public rename a constants change inside packages/** and a separate, countable corpus migration."
customer_impact: "ADOS users keep the current behavior until each engine passes parity, then gain a deterministic CLI, a local MCP surface, and OpenCode-native tools with stable, documented error codes."
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
    - "Juliusz Ćwiąkalski (owner constraints and prior decisions)"
    - "CritiqueGrid panel (same-lineage review input, 2026-10-23)"
    - "marksync-for-confluence (pattern evidence; owner's sibling repository)"
  reviewers:
    - "@decision-critic (R3 challenge; returned REWORK on 2026-10-24; re-review completed 2026-10-24: PASS_WITH_RISKS)"
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
  human_decider: null
  reviewers: ["@decision-critic (REWORK 2026-10-24; re-review completed 2026-10-24: PASS_WITH_RISKS)"]
revisit_triggers:
  - "An OpenCode native tool or a second TypeScript harness (for example Pi.dev) needs a capability that the documented core entry points do not expose; reshape the harness surface rather than reaching into core internals"
  - "A non-Bun runtime needs state access; the pluggable state driver and its non-Bun fallback become mandatory earlier than planned"
  - "External consumers need published TypeScript libraries; the branded publish manifest, library versioning, and library notice bundle become release blockers"
  - "A package needs an independent release cadence, a heavy optional dependency, or a separate build target (split the adapters or providers package)"
  - "The MCP host requires Node-only APIs that the contracts/core runtime-neutral rule forbids; revisit the MCP artifact form and the driver fallback"
  - "The naming freeze lands and the branding constants change; the rename drill must pass without code archaeology"
  - "Bash parity is reached for an engine and the wrapper delegates to the new tool; revisit the wrapper cutover and rollback rules"
  - "The contracts package grows beyond cross-package language and becomes a dumping ground; revisit the contracts/core split and the subpath rules"
  - "The license registry denies a candidate dependency or a new license class is considered; revise the policy before adoption"
  - "Signature verification, the vulnerability gate, or the privacy assessment gate blocks a release; treat it as a decision input, not an obstacle to bypass"
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

ADOS currently delivers its own changes with a bash stack: `scripts/` (delivery automation), `tools/` (PATH utilities), `.opencode/` (canonical agent and command definitions, which are the product), and `doc/` (spec, decisions, guides). The delivery scope for the open-source part is M0-M3 (scope pending owner confirmation): a TypeScript CLI plus MCP plus OpenCode integration that replaces the bash delivery stack engine by engine using a strangler pattern. Cloud work and work beyond the confirmed scope must not appear in committed files. A later owner sequencing note records an OSS track through M4 and a cloud kickoff at M4; that note conflicts with the M0-M3 statement and is tracked as an open owner question rather than resolved here.

The owner has decided that the OSS part is one monorepo covering processes, tooling, scripting, agents, and docs; a root `packages/` layout is acceptable. The exact structure is the open question. Repository placement is resolved: the monorepo lives in this repository. The binary name and package name remain branding constants that are still to be decided. The existing root layout must stay: `.opencode/` remains canonical, `.ados-claude/` remains generated, `scripts/` and `tools/` keep running until the new engines replace them, and `doc/` remains the documentation home. Delivery goes through ADOS itself, and pull requests target `main-tools`.

### Owner decision record (verbatim owner statements)

The owner decisions that this record depends on are quoted verbatim below. They are the owner's own words and contain no secrets, so the record can cite them directly instead of pointing at a locator whose content can change or disappear.

| Owner decision | Owner statement (verbatim) | Label | Source |
|----------------|----------------------------|-------|--------|
| Monorepo | "I agree to have a monorepo for oss part that would cover all - processes, tooling, scripting, agents, docs etc. regarding exact structure do a decision record and incorporate decision advisor properly - I'm open to packages as a root." | FACT | owner direction via CEO session 2026-10-23 |
| Scope (2026-10-23) | "for now let's work on milestones M0-M3 inclusive. then I'd consider publihsing this new shape and merge main-tools to main and continue delivery on main from there." | FACT | owner direction via CEO session 2026-10-23 |
| License | "let's migrate to apache-2.0. I'm the only contributor to this repo so far so I own everything and can do it." | FACT | owner direction via CEO session 2026-10-23 |
| Naming | "the final public name will be decided soon but for the inception we should not couple anything in the code/docs to a name." | FACT | owner direction via CEO session 2026-10-23 |
| Strangler | "for now let's keep the bash stack running and let's use the strangler pattern... those old tools would be removed at the very last stage (they could print some short deprecation notice on use + info how to use the new tooling)." | FACT | owner direction via CEO session 2026-10-23 |
| Scope sequencing (2026-10-24) | "The OSS track runs M0-M4 and continues. The Cloud track starts at M4 and runs in parallel. M4 is the Cloud kickoff, not the end of OSS. M5-M7 are later directions, not date commitments." | FACT | owner sequencing note in the owner's local working notes, 2026-10-24 |

The two scope statements conflict: one says M0-M3 inclusive, the other runs the OSS track through M4. This record does not choose between them. The committed OSS scope (M0-M3 or M0-M4) is an open owner question, recorded in Unresolved Questions. Elsewhere this record writes "M0-M3 (scope pending owner confirmation)" wherever a milestone boundary is unavoidable.

The owner also chose this record to be R3 and to receive a formal `@decision-critic` challenge (source: owner direction via CEO session 2026-10-23).

The pattern source is the marksync-for-confluence repository: a single package with a strict tiered `src/` tree, a pinned Bun runtime, strict TypeScript, Biome, commitlint plus husky, dependency-cruiser boundaries, a `CommandResult` envelope, a stable exit-code table, tiered tests, and a release pipeline with a single binary and SBOM. That template is proven, but it is single-package. ADOS is a monorepo, so the tier boundaries must map to packages rather than one `src/` tree. A literal copy would either collapse the monorepo into one package or create an unenforced package graph.

Two facts make this decision urgent:

- The M0 scaffold is the first implementation step. Package boundaries set precedent for every later engine, adapter, and surface.
- The naming firewall is a hard constraint. The brand is not frozen, and renaming after packages, binaries, environment variables, MCP tools, and telemetry schemas are public is a migration program. The structure must make the rename mechanical inside `packages/**` and countable outside it.

Prior decisions constrain the answer: ADR-0001 established proportional decision records and bounded AI authority; ADR-0002 established the readiness gate. The GH-49 design work decided TypeScript, one shared core with CLI and MCP as surfaces, provider-agnostic adapters, and local-first operational state. This record decides the repository and package structure that makes those decisions enforceable.

## Problem Framing (Clarified)

The root problem is not "which folder names look tidy." It is that the new TypeScript tooling needs explicit, mechanically enforced contracts while it coexists with a running bash stack, must run in more than one host runtime, and ships an unfrozen brand.

The bash stack encodes its contracts in scripts, convention, and operator memory. That was sufficient for a solo operator and a small tool set. It is not sufficient for a CLI, an MCP server, and OpenCode-native tools that share one core, several provider adapters, a persistent local state store, and a rename that must not require archaeology. Without package boundaries, the following failures are likely:

- Surfaces reach into core internals, so CLI, MCP, and harness tools drift into separate behavior.
- Provider quirks leak into core rules, so adapters cannot be replaced or added safely.
- Persistence and telemetry formats couple to command implementations, so a future sink requires migration.
- The brand appears in package names, environment variables, config paths, MCP tool names, and telemetry event names, so renaming is a repository-wide search-and-replace with broken consumers.
- The new stack grows inside the bash tree with no ownership boundary, so removing old tools becomes a big-bang instead of a strangler.
- A Bun-only choice of driver or API leaks into domain logic, so the same engine cannot run inside OpenCode or another TypeScript harness.

The decision question is: what package set, runtime seam, and dependency rules give the strongest isolation, testability, runtime portability, and rename safety at the lowest cognitive cost for one developer orchestrating AI agents, while preserving the existing repository and the running bash stack?

Desired outcomes:

- One install, build, test, and release workflow for the TypeScript tooling.
- Enforceable boundaries between contracts, core, persistence, adapters, and surfaces.
- Runtime-neutral core logic that runs under Bun, Node, or a TypeScript plugin host without a rewrite.
- One shared implementation for CLI, MCP, and harness surfaces, with no logic in any surface.
- Provider adapters that are replaceable and testable without live credentials.
- A local state format that a future sink can consume without a migration and that is safe under concurrent writers and crash recovery.
- A rename that changes branding constants inside `packages/**` and has a separately tracked migration for the installed corpus.
- A wrapper-based strangler path that keeps the bash stack authoritative until each engine passes parity, then moves the wrapper onto the new tool.

Out of scope: cloud services, pricing, final brand selection, provider-specific API design beyond the adapter contract, the contents of the M0-M3 (scope pending owner confirmation) roadmap beyond the structure, and library publication itself. Those are separate decisions or later work.

## Constraints (Hard Requirements)

### C-1: One OSS monorepo for the committed scope

- **Statement:** The committed M0-M3 (scope pending owner confirmation) tooling must live in this repository as one OSS monorepo; no sibling CLI repository and no cloud code in committed files.
- **Source:** owner decision (monorepo and scope statements in the Owner decision record)
- **Verification:** code review and repository layout audit
- **Negotiable:** no

### C-2: Apache-2.0, enforced dependency license policy, notices, and SBOM

- **Statement:** The repository remains Apache-2.0. CI must enforce an approved/rejected license registry for every dependency; the gate accepts only OSI-approved, Apache-2.0-compatible SPDX identifiers on the allow-list; it fails closed on unknown, `NOASSERTION`, `SEE LICENSE`, and compound expressions; and it denies SSPL, BUSL, Elastic License, Commons Clause, and CC-BY-NC. Every release, binary or library, must attach an SBOM, checksums, and a `THIRD-PARTY-NOTICES` artifact or a `licenses/` bundle; the repository carries a `NOTICE` when any dependency requires one.
- **Source:** owner decision (Apache-2.0 and license registry), Apache-2.0 section 4, internal standard
- **Verification:** CI (license-registry gate, SBOM generation, notices bundle presence, checksum verification)
- **Negotiable:** no

### C-3: Naming firewall with a tested rename seam

- **Statement:** No new code or new user-facing documentation may hardcode a product name, binary name, package scope, or derived identifier outside the single branding constant and the legacy compatibility adapter; decision records may name the current project when describing context. A forbidden-literal test over `packages/**` and new user-facing docs and a rename drill must pass. The seed literal set is the legacy tokens already public in this repository: `ados`, `ADOS_`, and `~/.ados`. The test grows with the frozen name set: freezing a new public name adds it as a literal in the same change. The existing installed corpus is migrated separately and is not claimed as covered by the constant.
- **Source:** owner decision (naming firewall and single central constant)
- **Verification:** test (forbidden-literal scan and rename drill) plus a tracked corpus migration
- **Negotiable:** no

### C-4: OSS-only committed artifacts

- **Statement:** Committed files must contain no cloud names, cloud designs, pricing, private references, or proprietary implementation. C-4 forbids third-party or private-corpus identifiers; references to the owner's own local working notes are allowed as long as no private identifiers are copied. This record was scanned for private identifiers and contains none: private working paths and review records are described generically.
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

- **Statement:** Any installable artifact must be registered in `scripts/install.sh` (an explicit array or install path), including the CLI binary, the MCP artifact, the opencode surface artifact, and updated wrappers, each with its install path, update and overwrite mechanics, and signature/checksum verification, and each must be verified. The pinned runtime version in `.bun-version`, `engines.bun`, the CI matrix, and the release build must be identical and checked by CI. No unregistered delivery artifact may be installed by users.
- **Source:** AGENTS.md, owner decision, internal standard
- **Verification:** test and audit of the install set; CI pin-equality check
- **Negotiable:** no

### C-8: Running gates never weaken during migration

- **Statement:** The bash gates remain authoritative until the replacement engine passes the same parity suite. No gate is relaxed or removed early. A wrapper cutover requires a green parity suite, a clean observation window, a rehearsed rollback, and owner sign-off.
- **Source:** owner decision (strangler sequencing)
- **Verification:** code review, parity test results, and the cutover checklist
- **Negotiable:** no

### C-9: Runtime portability of core logic

- **Statement:** `contracts` and `core` (domain, application, config) must not depend on Bun, Node, OpenCode, Pi.dev, or any other runtime. They contain no `bun:*` or `node:*` imports, no ambient globals (`process`, `Bun`, `Deno`, timers, filesystem, network), and no ambient clock or randomness. Bun is a build, test, and packaging target, not a semantic dependency. Persistence must sit behind a driver port with at least one non-Bun implementation path, and each surface must be replaceable without rewriting core rules. Until an approved non-Bun driver lands, the documented degraded mode is a read-only JSONL log without SQLite indexes; that state is a design state, not a waived constraint, and the absence of an approved non-Bun state driver at scaffold is an M0 stop condition.
- **Source:** owner decision (runtime and MCP statements in the Owner decision record)
- **Verification:** dependency-cruiser rules, an AST or lint guard against ambient globals, negative fixtures, a runtime-portability smoke suite that runs the contract and core tests under a second runtime host (Node), and a surface-level non-Bun smoke: the mcp surface under Node, and the opencode surface entry point through a defined Node harness that stubs the host API and invokes the exported native-tool entry points
- **Negotiable:** no

### C-10: Security and supply-chain baseline

- **Statement:** Before the first public release, releases are signed (Sigstore or minisign) and the installer verifies the signature and checksum before installing; the installer fails closed on a non-HTTPS source or a missing checksum; the bootstrap installer is pinned to a tagged, checksummed release. CI uses SHA-pinned actions and job-scoped permissions, and release credentials use OIDC rather than long-lived secrets. A vulnerability gate (OSV or `bun audit` plus dependency review) runs on every pull request and blocks high or critical findings. An MCP tool that mutates external state requires explicit authorization and confirmation before it ships. MCP tool inputs, descriptions, and returned content are treated as untrusted: they never grant authority, and a prompt-injection fixture is required.
- **Source:** owner decision (security acceptance is human), internal security standard, prior review input CG-SEC-001 through CG-SEC-004 (same-lineage)
- **Verification:** CI (SHA-pin audit, dependency review, vulnerability scan), release checklist (signature verification, OIDC-issued release credentials), an MCP mutation authorization and confirmation test, a prompt-injection fixture, and security review sign-off
- **Negotiable:** no

### C-11: Privacy and data-lifecycle baseline

- **Statement:** Persisted events carry a field-level data classification. Redaction is fail-closed and records its `redactorVersion` and rule-set hash. Each event type has a closed payload schema. No sink may receive data before a retention policy and an erasure procedure exist. The state directory is created at `0700` and state files at `0600`.
- **Metadata-only clause for session and host inspection:** `SessionStore` (read-only reads of foreign session databases for `db` administration) and `HostPort` (host and process inspection) are metadata-only by default. They may surface identifiers, counts, timestamps, process names, and non-user file paths; they must not surface message content, prompts, transcripts, credentials, environment values, or command arguments. The field-level classification in DEC-5 applies to every field they surface, redaction applies before any write or output, and an explicit privacy sign-off is required before the `db` administration engine that uses `SessionStore` ships.
- **Source:** owner decision (privacy acceptance is human), internal standard, prior review input CG-PRIV-001 through CG-PRIV-005 (same-lineage)
- **Verification:** tests (canary secret with zero occurrences, permission check), closed-payload-schema validation at write time, a metadata-only assertion for the `SessionStore` and `HostPort` outputs, recorded privacy review sign-off before the first release that persists or exports events, and a separate privacy sign-off before the `db` administration engine ships
- **Negotiable:** no

> **Table-stakes:** All non-rejected alternatives are git-native, keep secrets out of committed files, introduce no proprietary runtime, and deliver through pull requests to `main-tools`. These are acknowledged once, not repeated per alternative.

## Decision Drivers

The earlier draft used verbal weights that disagreed with its own ranked list. Weights are removed. The single ordered list below is authoritative and is referenced by the per-sub-decision fit paragraphs.

**Business drivers:**

- **Solo-developer efficiency and cognitive load (rank 2).** One person orchestrates AI agents; every extra package, manifest, and version axis is attention spent outside shipping.
- **Public release readiness (rank 4).** The first public release must have a cheap rename inside `packages/**`, a clean OSS boundary, signed artifacts, notices, and a credible install story.
- **Time to first slice (rank 11).** M0 must produce a usable TypeScript core quickly; structure must not become a construction project.

**Technical drivers:**

- **Boundary enforcement (rank 1).** Surfaces cannot reach core internals; adapters cannot leak provider types into core; persistence cannot couple to command code.
- **Testability (rank 6).** Core rules must be testable without network or credentials; adapters need fakes, trap catalogs, a conformance suite, and runtime-portable tests.
- **Determinism and reproducibility (rank 7).** Pinned runtime, one lockfile, strict type checking, and binding CI gates.
- **Replaceability and future extraction (rank 9).** An adapter, driver, or surface can be replaced or extracted without rewriting core.

**Operational drivers:**

- **Strangler coexistence (rank 3).** The bash stack keeps delivering while the new stack runs beside it, and wrappers move engine by engine.
- **Rename safety (rank 5).** The brand is one configuration seam inside `packages/**`, not a distributed literal, and the installed corpus migration is explicit.
- **Release simplicity and distribution fidelity (rank 8).** One version, one release train, CLI and MCP artifacts plus, later, library artifacts, with checksums, signatures, SBOM, and notices.
- **Agent legibility (rank 10).** Package names and rules must let an AI agent place new code correctly without guessing.

**Ranked:** boundary enforcement; solo-developer efficiency; strangler coexistence; public release readiness; rename safety; testability; determinism and reproducibility; release simplicity and distribution fidelity; replaceability and future extraction; agent legibility; time to first slice.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` - coordinates the analysis and drafts this record.
- **Decider / Approver:** Juliusz Ćwiąkalski - the one accountable human authority. AI does not accept this record.
- **Contributors:** Juliusz Ćwiąkalski (owner constraints and prior decisions); CritiqueGrid panel (same-lineage review input, 2026-10-23); marksync-for-confluence (pattern evidence); `@decision-critic` (R3 challenge, returned REWORK on 2026-10-24, re-review completed 2026-10-24 at PASS_WITH_RISKS).
- **Required reviewers:** `@decision-critic` for the R3 challenge, plus the owner for the human final decision. Because R3 always needs a human reviewer, the critic's verdict is a first-pass check, not independent assurance; same-model agents do not constitute independent evidence.
- **Acceptance deadline:** the owner sets the date; the default is before M0 kickoff. If no date is set, the record stays Proposed and blocks the scaffold.
- **Escalation authority:** the owner (Juliusz Ćwiąkalski). Unresolved disagreement among reviewers escalates to the owner, who is the only authority able to accept or reject this record.
- **Performers:** `@coder` for the scaffold and engine delivery; `@toolsmith` only if a later change touches agent or command definitions, which this decision does not.
- **Informed:** ADOS users and ADOS agents (through the committed architecture and spec documentation).

The record stays `Proposed` until the owner explicitly accepts it. `decision_date` remains null until then. On acceptance, the owner sets `decision_date` and `review_date`; the first retrospective runs after the M0 scaffold and the first parity cutover.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The OSS tooling is one monorepo in the current repository; Apache-2.0 and the naming firewall apply. | FACT | Owner decision statements in this record; owner direction via CEO session 2026-10-23 | C-1 would be void and the sibling-repository alternative would return; the license constraint would be wrong. | High |
| The committed OSS scope is disputed: one owner statement says M0-M3 inclusive, a later sequencing note runs the OSS track through M0-M4. | FACT (both statements) / TO-CONFIRM (which governs) | Owner decision statements in this record; owner direction via CEO session 2026-10-23 and owner sequencing note in the owner's local working notes 2026-10-24 | Planning could over-commit or under-commit scope; milestone gates would be ambiguous. The conflict is carried as an open owner question. | High that both exist; Low that either is final |
| Work beyond the confirmed scope is not committed; cloud work must not appear in committed files. | FACT | Owner decision statements in this record; AGENTS.md | Committed files would leak uncommitted scope. | High |
| Core logic and domain must not be bundled to Bun or any runtime; OpenCode and possibly Pi.dev are target runtimes. | FACT | Owner direction via CEO session 2026-10-23 | C-9 would be an unfounded constraint; the state driver port and harness surface would be unnecessary. | High |
| MCP runs locally; Node or a Bun binary are both acceptable; runtimes must be swappable. | FACT | Owner direction via CEO session 2026-10-23 | MCP packaging could be forced to one runtime; the artifact form would be constrained. | High |
| The internal error table with static documented codes is primary; exit codes are a standalone-binary projection. | FACT | Owner direction via CEO session 2026-10-23 | `contracts` would mix domain and CLI presentation; harness consumers would inherit process semantics. | High |
| Packages will eventually ship as both binaries and libraries; the brand name is still to be decided. | FACT | Owner direction via CEO session 2026-10-23 | The release contract, entry points, and notice model would be binary-only and need redesign. | High |
| The state directory has an override variable and a per-platform default derived from the project name. | FACT | Owner direction via CEO session 2026-10-23 | DEC-5 would be a guess; operators could not relocate state. | High |
| The install path uses a wrapper-based strangler: installs ship the new tool plus updated wrappers, and wrappers delegate to the new tool once the engine is consumed. | FACT | Owner direction via CEO session 2026-10-23 | DEC-7 and C-5/C-8 would encode a side-by-side model the owner does not want. | High |
| Dependency licensing needs a policy and an approved/rejected registry updated on each new license. | FACT | Owner direction via CEO session 2026-10-23 | The license gate would remain a narrow deny-list with no audit artifact. | High |
| The owner chose R3 and a formal decision-critic challenge. | FACT | Owner direction via CEO session 2026-10-23 | The record would be under-governed for an org-wide, hard-to-reverse decision. | High |
| The existing root layout stays and the bash stack runs until per-engine parity. | FACT | AGENTS.md and owner decision | Structure would need to move or replace existing directories; the strangler plan would change. | High |
| marksync-for-confluence is a single package with a tiered `src/` tree and four dependency-cruiser rules. | FACT | Local evaluation of the marksync repository, 2026-10-23 (`package.json`, `tsconfig.json`, `.dependency-cruiser.cjs`, `src/`) | The adaptation analysis would be based on a false template; package mapping could be simpler than assumed. | High |
| The four marksync dependency-cruiser rules do not enforce the full stated matrix: `infra -> app`, `app -> presentation`, and sibling-surface edges are unguarded. | FACT | marksync `.dependency-cruiser.cjs` read on 2026-10-23 | Copying the rules verbatim would leave real boundary gaps; the enforcement claim would be overstated. | High |
| marksync's application tier performs file I/O (`node:fs`) in journal and cache code. | FACT | marksync `src/app/journal.ts` and `src/app/cache.ts` read on 2026-10-23 | A literal port would make the application tier impure and harder to test; I/O placement must be decided. | High |
| marksync's journal silently skips malformed JSONL lines. | FACT | marksync `src/app/journal.ts` read on 2026-10-23 | A literal port would create lying state; ADOS needs hard failure and quarantine. | High |
| marksync-for-confluence is the owner's sibling repository; its authorship and license will be verified before any source file is copied. | FACT (ownership) / TO-CONFIRM (license) | Owner statement; repository not present locally; review CG-LEG-001 and CG-LEG-007 | If it is third-party and source is copied, the MIT grant and notice obligations must be satisfied; patterns-only reuse avoids the risk. | Medium |
| The most recent stable Bun is the initial runtime pin; the exact version is fixed at scaffold time. | FACT (policy) / TO-CONFIRM (version) | Owner direction via CEO session 2026-10-23 | A different pin would change the baseline but not the structure. | High |
| Bun's `bun:sqlite` and single-binary compile are suitable for the default state driver and CLI packaging. | ASSUMPTION | marksync release evidence and Bun platform knowledge; no ADOS spike yet | `bun:sqlite` is already behind a driver port, so the default driver could change without touching core. | Medium |
| A non-Bun SQLite driver path is available for Node and other hosts. | TO-CONFIRM | Node built-in SQLite is version-dependent; `better-sqlite3` is a candidate pending license registry approval | The state driver port would have no second implementation; state-backed use cases would stay Bun-hosted until a fallback is approved. | Medium |
| The MCP SDK runs under a Bun-compiled binary or a Node-hosted process; both are acceptable. | TO-CONFIRM | Owner direction via CEO session 2026-10-23; no ADOS spike yet | The artifact form changes at scaffold, not the package boundaries. | Medium |
| No external library consumers are expected during M0-M3 (scope pending owner confirmation); libraries ship afterwards, but entry points and notice obligations are designed now. | ASSUMPTION | Owner direction via CEO session 2026-10-23 and M0-M3 (scope pending owner confirmation) deliverables | If a consumer appears early, the branded publish manifest and library versioning move earlier; the package graph does not change. | Medium |
| The exact set of packages published as libraries, and when publishing starts, is not yet decided. | TO-CONFIRM | Owner direction via CEO session 2026-10-23 | A wrong guess would change the release train, not the internal structure. | Medium |
| License compatibility of candidate dependencies (MCP SDK, Cliffy, ajv, Biome, test and release tools) is not determined here. | TO-CONFIRM | Human legal/license review is required; this record defines the policy and registry, not the verdicts | A dependency could be disallowed, changing the toolchain or adapter design. | High |
| The existing bash tests and CI can run alongside new TypeScript jobs. | ASSUMPTION | `.github/workflows/ci.yml` and `scripts/test-all.sh` read on 2026-10-23; no combined run yet | Dual-run would need a different CI topology. | Medium |
| The legacy bash exit-code convention (0-9, 100) differs from the new error table's projection. | FACT | `doc/guides/tools-convention.md` and marksync `src/cli/output/exit-codes.ts` | The new CLI could inherit inconsistent exit semantics; docs and consumers would diverge. | Medium |
| The forbidden-literal test starts from the legacy tokens already public in this repository (`ados`, `ADOS_`, `~/.ados`); the full set grows with each frozen name. | FACT (seed set) / TO-CONFIRM (frozen set) | Naming firewall decision; repository inspection | A test limited to the seed set would miss a newly frozen name, so freezing a name must add its literal in the same change. | High for the seed; Medium for the frozen set |
| The existing committed corpus and install path still contain the current name; the constant does not cover them. | FACT | Review CG-DEC-007 (2026-10-23) and `scripts/install.sh` inspection | The "one constant" claim would be overstated; a corpus migration is required before a public rename. | High |
| The bootstrap installer currently fetches from `main`, while delivery targets `main-tools`. | FACT | `scripts/install.sh` inspection; AGENTS.md branch model | The bootstrap or development install would fetch the wrong branch until the owner confirms the source; delivery installs are pinned to tagged, checksummed releases (C-10). | High |

## Mental Models & Techniques Used

- **First principles:** What must be isolated for the tooling to remain correct under change? Contracts, pure rules, provider integrations, persistence, surfaces, and names. The package set follows those seams, not org-chart or aesthetic preferences.
- **Separation of concerns / ports and adapters:** Domain rules know nothing about HTTP, files, SQLite, CLI flags, or a host runtime. Application use cases orchestrate through ports. Adapters implement ports. Surfaces translate input and output.
- **Runtime portability as a first-class axis:** Ask at every seam whether the code would still run if Bun disappeared tomorrow. The answer moves persistence behind a port and keeps the harness surface thin.
- **Inversion and premortem:** What would make this monorepo fail? Ungoverned cross-package imports, a bloated contracts package, duplicated utilities, package sprawl, advisory CI that everyone ignores, a rename that touches every file, a state lock that corrupts on resume, and a wrapper that delegates before parity. The structure and enforcement target those failure modes.
- **Second-order thinking:** Package boundaries are cheap before publication and expensive after. The cost of one extra package now is small; the cost of extracting a surface after users depend on a monolithic package is large.
- **Opportunity cost and cognitive load:** Every package adds a manifest, a test target, a version, and a place for an agent to make a mistake. The chosen set maximizes isolation per package rather than minimizing package count absolutely.
- **Strangler pattern:** New engines run beside the bash stack; wrappers delegate engine by engine only after parity. Structure must be additive and reversible.
- **Pareto:** A small number of well-placed boundaries captures most of the isolation benefit. More packages would enforce more edges but cost more attention than the solo developer can repay.
- **Reversibility:** Before the first public release, package boundaries are moderate to reverse. After package names, config paths, and telemetry schemas are public, reversal is hard. The decision front-loads the rename seam and defers publication.
- **Sensitivity:** The largest uncertainties are the non-Bun driver, the OpenCode harness form, library publication timing, and the license verdicts. None changes the package graph; each changes packaging, defaults, or release timing.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| Alternative | C-1 | C-2 | C-3 | C-4 | C-5 | C-6 | C-7 | C-8 | C-9 | C-10 | C-11 |
|-------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Alt 0 - Do nothing / bash only | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Risk | Yes | Yes |
| Alt 1 - Root `packages/` with nine packages (chosen) | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Alt 2 - Single package with tiered `src/` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Alt 3 - `tooling/` subtree monorepo | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Alt 4 - Maximal per-tier packages | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Alt 5 - Sibling CLI repository | No | Yes | Risk | Yes | Risk | Yes | Risk | Risk | Yes | Yes | Yes |

Legend, aligned with the record template: `Yes` = passes; `No` = fails a `negotiable: no` constraint and is disqualified; `Risk` = an accepted-risk exception, which is valid only for a `negotiable: yes` constraint. Every constraint in this record is `negotiable: no`, so no alternative can pass one through an accepted-risk exception: a `negotiable: no` failure is written as `No`. Where an eligible alternative meets a constraint by convention or with a documented enforcement gap, the table records `Yes` and the gap is stated in that alternative's constraint-compliance and driver-fit text (Alt 2, C-9). For an alternative already disqualified by another constraint (Alt 0, Alt 5), `Risk` is not an exception; it records design exposure that would need mitigation if the alternative were eligible. Alt 0 fails C-1 because it does not deliver the committed TypeScript monorepo. Alt 2 meets C-9 by design inside one package but has no package-level enforcement against a runtime leak; that gap is recorded in its driver fit. Alt 5 fails C-1 (one OSS monorepo) and would put C-3, C-5, C-7, and C-8 at risk because installation, naming, and gate parity would span repositories.

### Alternative 0 - Do Nothing / Keep the Bash-Only Stack

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Continue with the bash delivery stack and add no TypeScript monorepo.
- **Constraint compliance:** Fails C-1; satisfies the remaining constraints vacuously or by inaction, with C-9 at risk.
- **Driver fit:** Lowest on every driver except short-term cost; no boundary enforcement, no shared core for the surfaces, no state schema, no rename seam.
- **Pros:** Zero migration cost; no new toolchain; no new CI jobs.
- **Cons:** The M0-M3 (scope pending owner confirmation) scope is undeliverable; bash contracts remain implicit; the rename risk grows with every new script; MCP and harness tools cannot share a typed core.
- **Why rejected:** It does not satisfy the committed scope. This is the baseline, not a viable option.

### Alternative 1 - Root `packages/` Monorepo with Nine Packages (Chosen)

- **Eligibility:** Eligible (passes C-1 through C-11).
- **Summary:** Add a root Bun workspace under `packages/` with `contracts`, `branding`, `core`, `state`, `adapters`, `cli`, `mcp`, `opencode`, and `testkit`. Keep the tier matrix inside `core` (`domain`, `app`, `config`) and enforce package-level and subpath-level edges with package exports, dependency-cruiser, an ambient-global guard, and negative tests. Compose surfaces at the edge; core never imports adapters, state, branding, or a runtime API.
- **Constraint compliance:** Passes all constraints. C-1 is satisfied by one additive monorepo. C-2 and C-7 are explicit CI, registry, notices, and install work. C-3 is satisfied by the branding package, neutral workspace scope, forbidden-literal test, and rename drill inside `packages/**`, with the corpus migration tracked separately. C-4 is satisfied because no cloud package exists. C-5 and C-8 are satisfied by the wrapper-based strangler and per-engine parity gate. C-6 is satisfied because nothing moves. C-9 is satisfied by runtime-neutral `contracts` and `core`, a state driver port with a non-Bun fallback path, and harness surfaces that consume public entry points. C-10 and C-11 are satisfied by the release, supply-chain, and privacy gates.
- **Driver fit:** Best on boundary enforcement, runtime portability, testability, rename safety, and future extraction, while keeping the package count at nine. The contracts leaf removes the need for adapters to import core. Composition roots keep branding and provider wiring at the edge. A dedicated thin OpenCode surface keeps harness integration from leaking into `cli` or `mcp`.
- **Pros:** Clear homes for every artifact class; one shared core for CLI, MCP, and harness tools; adapters depend only on contracts, not on core; state is replaceable and driver-pluggable; branding is injected, not imported by core; testkit is dev-only; a future split of adapters or providers has an obvious seam; the library publish path is designed now.
- **Cons:** Nine packages is more than one; workspace tooling and lockstep versioning add ceremony; `contracts` can become a dumping ground without review discipline; a single adapters package can accumulate dependency weight; composition wiring is duplicated across three surfaces until it justifies extraction.
- **Why chosen:** It is the smallest package set that makes the important boundaries mechanical, keeps core runtime-neutral, and keeps the rename seam at the edge. It passes every constraint and wins on the highest-ranked drivers.

### Alternative 2 - Single Package with a Tiered `src/` Tree

- **Eligibility:** Eligible (passes C-1 through C-11).
- **Summary:** Copy the marksync single-package shape into the ADOS repository: one root package, `src/domain`, `src/app`, `src/cli`, `src/infra`, `src/shared`, with dependency-cruiser enforcing tiers inside one tree.
- **Constraint compliance:** Passes all constraints on paper. C-1 is satisfied because it is one repository; C-3 is satisfiable with a branding module inside the package; C-7 is satisfiable with one binary artifact. C-9 is met by design inside one package: the ambient-global, runtime-import, and driver-port rules apply to `src/domain` and `src/app` as they do to `packages/contracts` and `packages/core`. The gap is enforcement, not capability: with no package boundary, a runtime leak is caught only by the lint and dependency-cruiser rules inside one tree.
- **Driver fit:** Strong on time to first slice and simplicity, weak on boundary enforcement, adapter replaceability, harness isolation, and future extraction. CLI, MCP, and harness consumers would share one dependency graph and one package boundary. C-9 carries a documented enforcement gap: a Bun or Node API can reach the domain tier unless every rule and fixture is maintained perfectly inside one tree, so the design relies on review discipline where Alt 1 relies on package exports.
- **Pros:** Fastest M0 scaffold; one manifest, one lockfile, one tsconfig, one test target; proven by marksync; the least new tooling.
- **Cons:** No package-level enforcement between surfaces, adapters, and state; MCP SDK and provider dependencies live in the same package as core; a surface can import `src/infra` unless a rule catches it; branding and forbidden-literal allowlists become broad; extracting a package later is a refactor across the tree.
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
- **Summary:** Make every tier and every provider its own package: `contracts`, `domain`, `app`, `ports`, `config`, `state`, `adapters-gitlab`, `adapters-jira`, `adapters-github`, `adapters-azure`, `cli`, `mcp`, `opencode`, `testkit`, and so on.
- **Constraint compliance:** Passes all constraints; gives the strongest possible package-level enforcement.
- **Driver fit:** Best on isolation and independent versioning, worst on cognitive load, package count, and cross-package type churn for a solo developer.
- **Pros:** Every edge is explicit; adapters can version and publish independently; dependency weight is minimal per package; extraction is trivial.
- **Cons:** Twelve or more packages for one developer; cross-package type changes ripple through manifests and releases; a version matrix appears before there are external consumers; import ceremony and CI matrix cost grow faster than value.
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

**Adopt Alternative 1.** Add a root `packages/` Bun workspace with nine packages, keep the tier matrix inside `core`, keep adapter and surface boundaries at package level and `contracts` subpath level, and keep the existing repository layout in place. The decision is recorded as ten sub-decisions, each with the options considered, the recommendation, and a constraint and driver fit note.

### DEC-1 - Repository structure: root `packages/` with nine packages

**Options considered:**

- Alt 0: do nothing (rejected, C-1).
- Alt 1: root `packages/` with nine packages (chosen).
- Alt 2: single package with tiered `src/` (rejected on drivers).
- Alt 3: `tooling/` subtree (rejected on cognitive load).
- Alt 4: maximal per-tier packages (rejected on over-fragmentation).
- Alt 5: sibling repository (rejected, C-1).

**Recommendation:** Use the following package set and names. All packages are private workspace packages with a neutral scope; no package is published during M0-M3 (scope pending owner confirmation), but every package declares the public entry points it would expose if published.

```text
packages/
  contracts/      Shared language: Result, error table and stable codes,
                  CommandResult, event schema, port interfaces, BrandIdentity
                  type, pure redaction. Subpaths: values, ports, presentation.
  branding/       The only current product-name source; BrandIdentity value
  core/           Domain + application + config + provider selection policy
    src/domain/   Pure rules; no I/O; no runtime APIs
    src/app/      Use-case orchestration; no I/O; ports injected
    src/config/   Schema, TypeScript defaults, merge and validate; no I/O
  state/          Append-only JSONL event log, SQLite indexes behind a driver
                  port, migrations, writer lock with fencing
  adapters/       GitLab, Jira, GitHub, Azure, Git, LLM provider probes,
                  config sources, repo/file stores, host and CI probes,
                  legacy compatibility adapter
  cli/            Cliffy presentation + composition root; exit-code projection
  mcp/            Local MCP surface + composition root
  opencode/       Thin OpenCode native-tool surface + composition root
  testkit/        Fakes, fixtures, trap catalogs, conformance suite (dev-only)
```

Root workspace files: a private root `package.json` with `workspaces: ["packages/*"]`, one `bun.lock`, `tsconfig.base.json`, a solution `tsconfig.json`, `biome.json`, `commitlint.config.js`, `.dependency-cruiser.cjs`, `.bun-version`, and the extended CI workflow. New `.gitignore` entries cover `node_modules/`, `dist/`, `packages/*/dist/`, and local state.

Public entry points are declared through each package's `exports` map. Deep imports into another package's `src/` are forbidden, including relative imports such as `../../core/src/domain/foo`. `core` exports its application API and its config API; it does not export domain internals. `contracts` exposes three subpaths: `values` (Result, error codes, schema versions, `BrandIdentity` type, pure redactor), `ports` (port interfaces and DTOs), and `presentation` (`CommandResult` and the pure exit-code projection). `adapters` uses subpath exports for each provider and I/O adapter.

**Harness consumption model (resolved):** OpenCode gets a dedicated thin surface package, `packages/opencode`, because it is a committed M3 deliverable with a known host. Pi.dev and other TypeScript plugin harnesses consume the documented `core` application and `contracts/values` entry points, with dependencies injected by the host, and no dedicated package until a harness-specific shape is proven. Neither model permits a harness to import `core/src/**`, `state/src/**`, or another surface.

**Where the shared modules live:**

- `Result<T,E>`, the internal error table and stable codes, event envelope and schema versions, port interfaces, `BrandIdentity`, and the pure redactor live in `packages/contracts`.
- Domain-error-kind to stable-error-code translation lives in `packages/core` (application tier).
- `CommandResult` and the stable-code to numeric-process-exit mapping live in `packages/contracts/presentation`; only the standalone CLI imports them. MCP and OpenCode propagate stable codes, never process exit codes.
- The JSONL writer, SQLite index, driver port implementation, schema migrations, and writer lock live in `packages/state`.
- Provider error classification, retry and timeout defaults, and provider probes live in `packages/adapters`.
- Brand values live only in `packages/branding`; they are injected into core, state, adapters, and surfaces at composition time.
- Provider selection policy (ordering, budget, hysteresis, park and unpark decisions) lives in `packages/core`; the hysteresis and park state is persisted through the `state` package.

**Fit:** This is the smallest set that gives every artifact class a home while keeping core runtime-neutral and giving harness consumers a public entry point. It satisfies C-1, C-3, C-9, and C-10 structurally and ranks first on boundary enforcement (rank 1) and fifth on rename safety (rank 5). The cost is one extra package and one extra composition root compared with a two-surface design.

**Rejected alternative:** A single `core` package containing adapters and surfaces. It would erase the package-level enforcement that is the point of the monorepo.

### DEC-2 - Tier and dependency rules across packages

**Options considered:**

- (a) Document the rules and rely on review.
- (b) Enforce package-level edges only, with no internal tiers or subpaths.
- (c) Enforce package-level edges, `contracts` subpaths, and internal `core` tiers (chosen).
- (d) Make every tier a separate package (rejected, Alt 4).

**Recommendation:** Adopt (c). The package graph is acyclic and follows this matrix.

| Importer / Imported | contracts | branding | core | state | adapters | cli | mcp | opencode | testkit |
|---------------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| contracts | - | no | no | no | no | no | no | no | no |
| branding | yes (type-only) | - | no | no | no | no | no | no | no |
| core | yes | no | - | no | no | no | no | no | no |
| state | yes | no | no | - | no | no | no | no | no |
| adapters | yes | no | no | no | - | no | no | no | no |
| cli | yes | yes | yes | yes | yes | - | no | no | no |
| mcp | yes | yes | yes | yes | yes | no | - | no | no |
| opencode | yes | yes | yes | yes | yes | no | no | - | no |
| testkit | yes | no | yes | yes | yes | no | no | no | - |

Additional rules:

- `contracts` has no workspace dependencies and no I/O. It is the shared language, not a utility drawer. A type belongs there only if it crosses a package boundary.
- `contracts` subpaths are enforced as edges: `domain` may import `contracts/values` only; `app` and `config` may import `contracts/values` and `contracts/ports`; surfaces may import all three; no package may import `contracts/presentation` except `cli` and the release/install tooling. `domain` must never import the exit-code projection.
- `branding` depends only on `contracts` (type-only) and contains the only current product-name literals.
- `core` depends only on `contracts`. It never imports `adapters`, `state`, `cli`, `mcp`, `opencode`, `branding`, or `testkit`. Brand values and port implementations are injected.
- `state` depends only on `contracts`. SQLite access is confined to this package behind the `SqliteDriverPort`; a non-Bun driver implementation is provided here or in a dedicated subpath.
- `adapters` depends only on `contracts`. It may use `node:fs` for config and file stores and provider SDKs for provider calls. Provider subpaths may share an internal HTTP, retry, and timeout module but must not import each other. No provider SDK may appear in `core` or a surface.
- `cli`, `mcp`, and `opencode` are sibling surfaces. None imports another. Cliffy is confined to `cli`; the MCP SDK is confined to `mcp`; host APIs are confined to `opencode`. All compose the same core use cases.
- `testkit` is dev-only. No runtime package may import it.
- `contracts` and `core` are runtime-neutral: no `bun:*`, no `node:*`, no `process`, no `Bun`, no `Deno`, no ambient clock or randomness, no filesystem or network globals. Time and identifiers come from ports.
- No package may import another package through a relative path that escapes its own root. Cross-package imports use the declared package name and an exported subpath only.

Inside `core`, enforce this tier matrix:

| From / To | domain | app | config | contracts/values | contracts/ports | contracts/presentation |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|
| domain | - | no | no | yes | no | no |
| app | yes | - | yes | yes | yes | no |
| config | no | no | - | yes | yes | no |

Dev-edge rules for `testkit`:

| From | To `testkit` | Allowed | Enforcement |
|------|:---:|:---:|-------------|
| `packages/*/src/**` | yes | no | dependency-cruiser plus a negative fixture per package |
| `packages/*/test/**`, `*.test.ts`, `*.spec.ts`, fixtures | yes | yes, via `devDependencies` | dependency-cruiser plus a passing fixture |
| root `e2e/**` and `bdd/**` | yes | yes, via root `devDependencies` | dependency-cruiser plus a passing fixture |
| `testkit/src/**` | - | may import `contracts`, `core`, `state`, and `adapters`; never `cli`, `mcp`, or `opencode` | dependency-cruiser |

Enforcement is mechanical, not advisory:

- `package.json` `exports` maps prevent deep imports. The map is the public contract; `src` is never an exported subpath in a released artifact.
- A CI "public entry point" check verifies that every workspace import resolves through an `exports` subpath, that no `exports` target points at `src` in a publishable package, and that no deep or relative cross-package import exists.
- One root dependency-cruiser configuration checks the package matrix, the `contracts` subpath matrix, the `core` tier matrix, the testkit dev-edge table, and the runtime-API confinement rules.
- An AST or lint guard rejects ambient runtime globals in `packages/contracts/src/**` and `packages/core/src/**`; dependency-cruiser alone cannot see a global.
- Negative-test fixtures prove that each forbidden edge fails, including a cross-package relative import (`../../core/src/domain/...`), a `src` import into `testkit`, a `domain -> contracts/ports` import, a `domain -> contracts/presentation` import, and a `core -> node:fs` import. A rule without a failing fixture is treated as unenforced.
- A CI check verifies that every imported workspace package is declared in the importing package's dependencies, and that a `testkit` import appears only in dev dependencies.
- No `|| true`, no `continue-on-error` on a gate, and no advisory boundary job. Informational benchmarks may be non-blocking only when they cannot fail a merge.

**Fit:** This is the mechanism that converts C-9 and the architecture drivers into executable rules. It ranks first on boundary enforcement (rank 1), sixth on testability (rank 6), and seventh on determinism (rank 7). Its cost is CI time and rule maintenance, which is accepted because an unenforced boundary is worse than no boundary at all.

**Rejected alternative:** Copying marksync's four rules. They do not cover `infra -> app`, `app -> presentation`, sibling surfaces, subpaths, testkit dev edges, relative cross-package imports, or the runtime-API confinement that the monorepo needs.

### DEC-3 - Runtime and toolchain

**Options considered:**

- (a) Bun pinned to the most recent stable version at scaffold, ESM, strict TypeScript, Biome, commitlint plus husky, dependency-cruiser, with a runtime-neutral core and a driver port for state (chosen).
- (b) Node with pnpm or npm workspaces.
- (c) Bun for development but permissive TypeScript and lint settings.
- (d) Independent per-package toolchains and versions.

**Recommendation:** Adopt (a), with one root configuration for the workspace.

- **Runtime pin:** Use the most recent stable Bun release at scaffold time. The exact version is fixed in the scaffold change, recorded in `.bun-version`, `engines.bun`, the CI matrix, and the release build, and checked for equality by CI. Bumping is a reviewed change; never float the version. Bun is the development, test, build, and single-binary packaging runtime; it is not a semantic dependency of `contracts` or `core`.
- **Runtime portability:** `contracts` and `core` compile and test under both Bun and a second host (Node) and contain no runtime imports or ambient globals. A runtime-portability smoke suite runs the contract and core test suites under Node in CI. Bun-specific APIs are confined to `state` drivers, the CLI build, and host adapters.
- **Host runtimes:** The supported consumption matrix is CLI (Bun-compiled binary), MCP (local process; either Bun or Node acceptable), OpenCode native tool (TypeScript in the OpenCode host), and Pi.dev or another TypeScript plugin harness (library consumer with injected ports). Adding a runtime is a packaging and composition change, not a core change.
- **State driver:** `SqliteDriverPort` lives in `contracts/ports`. The default implementation uses `bun:sqlite` in `state`. At least one non-Bun path is implemented: `node:sqlite` where the supported Node version provides it, otherwise an approved pure-JS or native driver selected through the license registry. The fallback is chosen at scaffold; the port is mandatory regardless. A runtime without an approved SQLite driver runs in the documented degraded mode: read-only JSONL without SQLite indexes, with index rebuild requiring an approved driver. The absence of an approved non-Bun state driver at scaffold is an M0 stop condition (see the milestone table).
- **MCP artifact form and lifecycle:** The MCP server runs locally and may be packaged as a Bun binary or a Node entry point. The concrete artifact form is a scaffold-step decision recorded in the scaffold change; either form must be registered in `install.sh` and covered by the release smoke test. The MCP process defines startup and shutdown, health and readiness, concurrency limits, a log channel, and runbooks for state error codes; these are M3 gates. Mutating tools require authorization and confirmation, and MCP inputs and outputs are treated as untrusted for prompt injection.
- **CLI startup time:** Startup time is measured in the release smoke test with a budget set at scaffold. It is a selection consideration between runtimes, not a structural constraint; the owner expects comparable performance and does not want startup time to dominate the design.
- **Modules:** ESM everywhere (`"type": "module"`, `moduleResolution: "bundler"`, `verbatimModuleSyntax`, `isolatedModules`).
- **TypeScript:** One `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`, and `noUncheckedSideEffectImports`. Per-package `tsconfig.json` files enable `composite`, declarations, and source maps; a root solution `tsconfig.json` builds with `tsc -b`.
- **Lint and format:** One root Biome configuration. Biome checks formatting and lint; `tsc` owns type correctness. No type-aware lint duplicate.
- **Commits:** One root commitlint configuration and a husky `commit-msg` hook. CI runs commitlint against `origin/main-tools` and the pull-request base; the local hook is convenience, not authority.
- **Boundaries:** One root dependency-cruiser configuration over `packages/`, with the rules and fixtures from DEC-2.
- **Tests:** Per-package unit, integration, and package-local golden tests; root-level `e2e-mock`, live `e2e`, and `bdd` suites for cross-package contracts. `e2e-mock` is secrets-free and runs on every pull request. Live `e2e` runs only with credentials and is never a merge blocker for ordinary changes.
- **Versioning and release:** Lockstep version across the workspace for M0-M3 (scope pending owner confirmation). One tag, one release train. Build the CLI binary, the MCP artifact, and the OpenCode surface; attach `SHA256SUMS`, a signature, a CycloneDX SBOM, and `THIRD-PARTY-NOTICES` (or a `licenses/` bundle). Library publication is deferred, but the entry points are publish-ready.
- **Library publish path (designed now, published later):** The intended public libraries are `contracts` (values, ports, presentation), `core` (application and config API), `adapters` (provider subpaths), and `testkit` (dev). `cli`, `mcp`, and `opencode` ship as binaries or host plugins, not libraries. Internal names use the neutral scope; at release time a manifest transform applies the branded package scope, rewrites `exports` to `dist`, sets `files`, and attaches the license, notice, and provenance metadata. Versioning is lockstep until an external consumer needs an independent cadence; then a versioning tool is introduced in a separate decision. A `bun pm pack` or `npm pack --dry-run` plus an import smoke test is part of every release so the library path does not rot.
- **CI:** Existing bash jobs stay. New TypeScript jobs are added and binding: install with a frozen lockfile, typecheck, Biome, unit/integration tests, boundary negative tests, runtime-portability smoke, license-registry audit, vulnerability scan, and binary smoke. The fast loop targets a practical duration; liveness work moves to separate jobs, not to advisory gates.

**Fit:** This satisfies C-9 directly and C-7 through the pin-equality check, while keeping time to first slice affordable. It ranks second on solo-developer efficiency and seventh on determinism. The cost is one runtime-portability CI job and one driver abstraction that a Bun-only design would not need; that cost is the price of the owner's portability requirement.

**Rejected alternative:** Node with pnpm. It is a valid ecosystem choice, but the owner selected Bun as the build and packaging baseline, marksync proves the Bun compile and test path, and introducing a second runtime as the primary baseline now doubles the delivery surface. Bun is nevertheless not a semantic dependency, so a Node host remains possible.

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
- Central or template inheritance is deferred to a later change. If added, it uses an explicit `extends` chain with cycle detection and sits between defaults and the repository file; it is not silently merged.
- The legacy adapter reads the pre-freeze environment prefix and config directory, warns once, and maps them to the new keys. No new pre-freeze-prefixed variables are introduced.
- `config show --json` emits the effective configuration with secrets redacted. An optional `--explain` flag shows which layer supplied each value.

**Supersession entry (pending owner confirmation):** This sub-decision supersedes the GH-49 M0 configuration-inheritance item. GH-49 decided that central or template configuration inheritance would ship in M0; this record moves it out of the M0-M3 (scope pending owner confirmation) scope. The item is carried here explicitly, not dropped. If the owner declines the re-scope, inheritance returns to M0 and this entry is removed.

**Fit:** This satisfies C-4 and the determinism driver while keeping configuration auditable and testable without executing repository code. It ranks fourth on public release readiness and seventh on determinism. Its main cost is one deferred GH-49 item, which is recorded as a supersession rather than silently lost.

**Rejected alternative:** Executable TypeScript configuration. It makes configuration un-auditable, unsafe for untrusted repositories, and impossible to validate without running code.

### DEC-5 - State schema: local-first JSONL plus SQLite indexes

**Options considered:**

- (a) Append-only JSONL as the source of truth plus rebuildable SQLite indexes behind a driver port (chosen).
- (b) SQLite only.
- (c) JSON files only, no index.
- (d) Remote-first storage.

**Recommendation:** Adopt (a). State is local-first, append-only, schema-versioned, single-writer per workspace, runtime-portable, and sink-ready.

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

The state root is created at `0700`; files are created at `0600`. A permissions check runs at open and on every write on POSIX platforms.

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
- The semantics of tenant boundaries and any future multi-user sharing are out of scope until a sink exists.

**Event and redaction rules:**

- `events.jsonl` is append-only. Corrections are new events; existing events are never mutated.
- `eventId` is the idempotency key for any future sink. `runId` correlates every command result with its start and finish events. `operationId` is deterministic for mutating operations (see DEC-6).
- `state.db` is a derived index, not a source of truth. It stores `events`, `runs`, `operations`, `work_items`, and `meta` tables with WAL, `busy_timeout`, and foreign keys. `state rebuild` reconstructs it from JSONL.
- Each event type has a closed payload schema. Unknown fields are rejected at write time. The schema is versioned with the event type suffix.
- `dataClassification` is one of `public`, `internal`, `personal`, or `sensitive`. The field-level table below is binding and is extended per event type in the state spec.
- One pure redactor in `contracts` runs before every write and every output. Redaction is fail-closed: if the redactor cannot run or a rule fails, the write aborts. `redaction.applied: true` is only written after a successful pass with the recorded `redactorVersion` and `ruleSetHash`. A canary secret fixture must produce zero occurrences in state and telemetry.
- Schema versions are explicit: `EVENT_SCHEMA_VERSION` and `COMMAND_RESULT_SCHEMA_VERSION` start at 1. Additive fields are allowed within a version; breaking changes bump the version and require a migration or dual-read window. An unknown newer version is an error, never a zero.
- Retention, rotation, and erasure: rotation segments the log at a configured size; older segments may be compacted only into new segments, never rewritten in place. A low-disk preflight fails the write with a stable code before the disk is full. A restore drill rebuilds the index and queries it from a backup copy. Retention horizon, compaction cadence, and the erasure procedure are policy values still to be set (see Unresolved Questions); no sink may receive data before they exist.
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

**Fit:** This satisfies C-11 and the determinism, testability, and durability drivers while keeping state portable across hosts. It ranks third on strangler coexistence and seventh on determinism. The cost is a driver abstraction, a fencing protocol, and rotation/restore work that a single-host SQLite-only design would not need; those costs are accepted because the owner requires runtime portability and because silent state corruption would undermine every later engine.

**Rejected alternatives:** SQLite only (opaque history, harder to ship, runtime-coupled), JSON only (no fast queries), and remote-first (violates local-first and the no-cloud-in-OSS constraint).

### DEC-6 - Adapter contract: provider-agnostic ports, GitLab and Jira first

**Options considered:**

- (a) Ports in `contracts`, implementations in one `adapters` package with provider subpaths, and provider selection policy in `core` (chosen).
- (b) One package per provider.
- (c) Provider-specific logic in core behind conditionals.
- (d) A public plugin SDK now.

**Recommendation:** Adopt (a).

Ports in `contracts/ports`:

- `VcsPort`: change request read and create, checks or pipeline status, merge, push, remote branch lookup.
- `TrackerPort`: work item read, transition, comment, label mutation, ready-set query.
- `ConfigSource`: repository config and environment acquisition.
- `StateStore` and `EventLog`: state reads, appends, and index queries.
- `SqliteDriverPort`: the persistence driver seam used by `state`.
- `RepoStore` and `FileStore`: repository file reads/writes and atomic file operations that are not config or state.
- `HostPort`: host and process inspection (platform, load, disk, process list, signals) without ambient `node:os` or `process` calls in core. Metadata-only per the C-11 clause: no command arguments, environment values, or user content.
- `CiHealthPort`: CI status and health reads that are not already covered by `VcsPort`.
- `SessionStore`: read-only access to foreign session databases for `db` administration; never a mutation path. Metadata-only per the C-11 clause: no message content, prompts, or transcripts; privacy sign-off is required before the `db` administration engine ships.
- `ProviderProbePort` and `QuotaFactsPort`: provider availability and quota facts returned to core policy.
- `Clock`, `IdGenerator`, and `Logger`: injected determinism and observability.

Provider policy split:

- `ProviderPolicy` lives in `core`: it decides ordering, budget, hysteresis, and when to park or unpark a provider, using `QuotaFactsPort` facts and `capabilities()`.
- `ProviderProbePort` and `QuotaFactsPort` implementations live in `adapters/providers`. They report facts; they do not decide selection.
- Hysteresis and park state are persisted by `state` as events and indexed for fast reads. Core reads them through `StateStore`; it does not keep process-local selection state as the source of truth.
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
- The first outcome for an `operationId` is persisted in `state` (`operations` index plus an event). A repeat with the same identity returns the persisted outcome instead of re-mutating the tracker or VCS.
- During dual-run, a mutating engine runs in shadow or read-only mode: it computes the operation and records the would-be outcome without calling the mutation. Live mutation is enabled only at the explicit per-engine transfer, after parity.
- A mutating engine transfer requires a clean shadow window, a rehearsed rollback, and owner sign-off (C-8).
- **Scope of the operation index:** it prevents replay for the new tool within one workspace. The bash path does not consult the index, so it does not protect against a bash replay, a cross-workspace duplicate, or an operator invoking the old tool directly.
- **Transfer guard:** every mutating engine transfer adds a guard that only one writer path is live per engine. The wrapper feature switch selects the active path; the other path is disabled rather than merely unused; during dual-run the new engine stays shadow or read-only. The guard is a cutover checklist item and a stop condition.
- **Rollback for a transferred engine:** while the retention window is open, a wrapper or feature switch returns to the bash implementation; after the window closes, rollback is reinstall-only of the previous signed release. State remains readable in both cases. The operation index prevents the new tool from replaying a completed mutation within one workspace; it does not cover the bash path.

Adapter order and packaging:

| Adapter | Milestone | Notes |
|---------|-----------|-------|
| GitLab | M0 | Merge requests, pipelines, branches; seed from the existing prototype. |
| Jira | M0 | Labels replace, transitions are data, custom fields, comment quirks. |
| GitHub | M1-M3 | ADOS dogfooding; pull requests, checks, Actions. |
| Azure DevOps | On demand | No skeleton until a consumer and trap catalog exist. |
| Git | M0 | Local git CLI operations behind `VcsPort` where applicable. |
| LLM providers | M0 | Provider probes and quota facts under `adapters/providers`; selection policy in core. |
| Host, repo, file, CI, session | M0-M3 (scope pending owner confirmation) | Implement the non-provider ports above; no engine may land without a port home. |

`packages/adapters` starts as one package with subpath exports. Split a provider into its own package when it needs a heavy optional dependency, an independent release cadence, or a build-time size reduction. Do not pre-split.

**Fit:** This satisfies C-9 and C-11 at the I/O boundary and moves provider choice into testable core policy. It ranks first on boundary enforcement and sixth on testability. The cost is a larger port list and a persisted operation index; both are required for runtime portability and safe dual-run.

**Rejected alternative:** Provider-specific branches in core. It makes every new provider a core change and breaks the replaceability driver.

### DEC-7 - Coexistence with the existing delivery repository layout

**Options considered:**

- (a) Additive `packages/` alongside the existing layout; bash stays authoritative until per-engine parity; the install ships the new tool plus updated wrappers; wrappers delegate only at the cutover (chosen).
- (b) Move `.opencode/`, `scripts/`, `tools/`, and `doc/` into `packages/`.
- (c) Big-bang replacement of the bash stack.
- (d) Sibling repository (rejected, Alt 5).

**Recommendation:** Adopt (a). Nothing moves in M0-M3 (scope pending owner confirmation), and the wrapper-based strangler is the delivery model.

| Area | Action |
|------|--------|
| `.opencode/` | Stays canonical; no move; `.ados-claude/` stays generated and CI-verified. |
| `scripts/` | Stays; bash delivery keeps running; new TypeScript CI jobs are added beside it. |
| `tools/` | Stays; a tool is deprecated only when its replacement passes parity; removal is last. |
| `doc/` | Stays; new tooling spec, architecture, and decision records are added, not moved. |
| `packages/` | New root workspace, additive. |
| Root manifests | New private workspace `package.json`, `bun.lock`, `tsconfig.base.json`, solution `tsconfig.json`, `biome.json`, `commitlint.config.js`, `.dependency-cruiser.cjs`, `.bun-version`. |
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
- The new tool and MCP artifact are registered in explicit install arrays. The MCP artifact is registered even when it ships as a Node entry point. The opencode surface artifact is registered in its own array with the same update and verification mechanics.
- **Legibility trap:** `packages/opencode` is a workspace surface package; it does not replace, shadow, or become the canonical `.opencode/` agent and command definitions directory. The two coexist by design: `.opencode/` remains the source of truth for agent and command definitions (C-6), while `packages/opencode` contains only the OpenCode native-tool surface code and its composition root. The canonical directory stays at the repository root and is never moved under `packages/`.
- Local development uses `bun install` and a workspace script. `packages/` is not installed into user projects as source.
- The existing delivery-script and delivery-tool install arrays remain for the bash stack. The new artifact arrays are separate, so old and new distribution paths can be removed independently.
- **Open item:** delivery-phase installs use pinned, tagged, checksummed releases (C-10). The unconfirmed item is only the bootstrap and development install source: whether it defaults to `main` or `main-tools`, and whether development installs may point at the delivery branch with the same checksum verification. The current installer fetches from `main`; the wrapper model points at `main-tools`. Until the owner confirms, release and development checklists must state which branch was used.

Documentation rules:

- Add a tooling feature spec under `doc/spec/` without overwriting the existing delivery-system features.
- Add an architecture overview for the new packages and their dependency matrix.
- Update `doc/guides/tools-convention.md` to distinguish repo-internal bash tools from the new delivery runtime. Keep the legacy exit-code table for bash tools until they are migrated.
- Do not modify `.opencode/agent/**` or `.opencode/command/**` as part of this decision; agent routing changes go through `@toolsmith` later.

**Fit:** This satisfies C-5, C-7, and C-8 and makes the owner's adoption path executable without a big-bang. It ranks third on strangler coexistence and fourth on public release readiness. The cost is a temporary period when both implementations are installed; the wrapper switch and the operation index keep that period honest.

**Rejected alternative:** Moving existing directories into `packages/`. It creates a large rename blast radius before the new stack proves itself and breaks the strangler's additive property.

### DEC-8 - Naming firewall placement

**Options considered:**

- (a) One branding constant plus a neutral workspace scope, forbidden-literal test, legacy adapter, and rename drill (chosen).
- (b) Rename now and freeze the brand before scaffolding.
- (c) A repository-wide search-and-replace script with no seam.
- (d) No firewall until release.

**Recommendation:** Adopt (a).

- `packages/branding` exports one `BrandIdentity` value derived from a single central project constant: product name, binary name, package scope, environment prefix, config directory name, state directory name, MCP tool prefix, telemetry namespace, docs base URL, repository URL, release asset prefix, and install path. It is the only place current names appear. Every other name is derived, so a rebrand is one edit plus a drill.
- `packages/contracts` defines the `BrandIdentity` type. `branding` depends on `contracts` for the type only.
- `core`, `state`, and `adapters` never import branding. Composition roots in `cli`, `mcp`, and `opencode` read branding and pass the needed values into constructors. The legacy adapter receives current names as parameters; it does not import branding.
- Workspace package names use a neutral private scope such as `@workspace/*`. All packages are `private: true` during M0-M3 (scope pending owner confirmation). The branded package scope is applied only at a future publish step, through a release-time manifest transform or a thin branded wrapper package. The brand never enters workspace package names.
- The committed repository config file is named `delivery.config.yaml`, which is brand-neutral and stable. Branding controls the user-level config and state directories and the environment prefix, not the committed file name.
- Telemetry event names are brand-neutral from day one (`delivery.event.v1`, `delivery.metric.v1`). The producer name is metadata from branding, not part of the schema name.
- MCP tool names are a projection of branding plus a canonical primitive ID from `contracts`. A rename changes the projection, not the primitive.
- CLI subcommands are verbs and nouns, not brand names. User-facing docs use "the CLI", "the runtime", and "the delivery factory" until the name is frozen.
- The legacy adapter is the only other place allowed to contain old literals. It reads the pre-freeze environment prefix and config directory, warns once, and maps them to the new names. No new pre-freeze-prefixed variables are introduced.
- The forbidden-literal test scans `packages/**`, root manifests, and new user-facing docs for the seed literal set `ados`, `ADOS_`, and `~/.ados` (the legacy tokens already public in this repository), with an allowlist for `packages/branding/**`, `packages/adapters/src/legacy/**`, decision records, historical change artifacts, and required license or source headers. The test grows with the frozen name set: freezing a public name adds its literal to the scanned set in the same change.
- The rename drill replaces branding constants and the legacy mapping in a temporary copy, then runs typecheck, unit and integration tests, boundary tests, the forbidden-literal test, a binary build, an MCP tool-list snapshot, and an OpenCode tool-list snapshot. It must pass before release and whenever branding changes.
- **Scope of the claim:** the single-constant guarantee covers `packages/**` and new user-facing docs. The existing installed corpus (agent and command content, guides, install paths, and the files counted in the 2026-10-23 review) still contains the current name. That corpus migration is a separate, tracked change; the rename drill extends to it when that change lands. Do not claim a repository-wide rename is free until then.

**Fit:** This satisfies C-3 for the new code and makes the future brand decision cheap inside the monorepo. It ranks fifth on rename safety and fourth on public release readiness. The cost is one branding package, one forbidden-literal allowlist, and a separate corpus migration; the alternative is a distributed literal that breaks consumers.

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

- Single `src/` tiers become root `packages/` plus internal `core` tiers.
- Per-package `#imports` aliases become workspace package names with explicit `exports` subpaths.
- The four dependency-cruiser rules become a full package matrix plus subpath rules, internal tiers, runtime-API confinement, ambient-global checks, and negative fixtures.
- Application-tier file I/O moves out of core; I/O lives in `state`, `adapters`, repo/file stores, and config sources.
- Silent skipping of malformed JSONL lines becomes a hard error with checksums, quarantine, and an incident event.
- Project-only configuration becomes defaults, repository file, environment, and flags, with a legacy adapter and branding injection.
- Lock and journal state becomes append-only JSONL plus rebuildable SQLite indexes with explicit schema versions and a driver port.
- One binary becomes a CLI binary plus an MCP artifact and an OpenCode surface, with lockstep versioning and a designed library publish path.
- MIT assumptions and license-checker configuration become Apache-2.0 with an allow-list license policy and a registry.
- Bun-only application code becomes runtime-neutral `contracts` and `core`; Bun APIs are confined to state drivers, the CLI build, and host adapters.

**Reject (do not adopt):**

- The single-package `src/` tree copied verbatim into the monorepo root. It defeats surface and adapter isolation.
- The four-rule dependency-cruiser configuration treated as the complete matrix. It leaves real edges unguarded.
- Alias-only boundary enforcement. Per-package aliases do not enforce cross-package edges.
- Silent malformed-line skipping. It creates lying state and false-success signals.
- Direct `node:fs` I/O in the application tier. It breaks purity and testability.
- MIT license text and license-checker assumptions. ADOS is Apache-2.0.
- Product-specific names, config keys, and examples from marksync. They are not transferable.
- A single-binary-only distribution model as the only path. ADOS needs CLI, MCP, harness, and install.sh registration, and later libraries.

**Fit:** This satisfies C-2 and C-9 and reuses a proven shape without importing its single-package assumptions. It ranks first on boundary enforcement and eleventh on time to first slice because the adaptation is deliberately not a copy. The cost is re-deriving the boundaries; the benefit is a graph that matches the monorepo and the runtime model.

**Rejected alternative:** Designing from scratch. It discards proven contracts and patterns and adds no isolation benefit that the adaptation lacks.

### DEC-10 - Error contract and exit-code projection

**Options considered:**

- (a) Internal error table with static documented codes in `contracts/values`; `CommandResult` and process exit codes in `contracts/presentation` for the CLI only (chosen).
- (b) A single flat `contracts` entry point with the error table and exit codes together.
- (c) Provider-specific error types propagated to callers.
- (d) HTTP-status-style codes as the primary taxonomy.

**Recommendation:** Adopt (a).

- The internal error table is the primary contract. Each entry has a stable code, a category, a severity, a retryable flag, a message key, and a documentation anchor. Codes are static, versioned, and looked up in generated documentation. Examples: `CONFIG_INVALID`, `STATE_LOCKED`, `STATE_FENCED`, `STATE_CORRUPT`, `ADAPTER_AUTH`, `ADAPTER_RATE_LIMITED`, `ENGINE_PARITY_FAILED`.
- Every layer propagates the stable code and structured details through `Result`. Adapters map provider failures to the table; core maps domain error kinds to the table; surfaces render the code and a human message without inventing a new taxonomy.
- `CommandResult` and the numeric process-exit mapping live in `contracts/presentation`. Only the standalone CLI imports that subpath. MCP and OpenCode return the stable code and structured error in their protocol; they never expose a process exit code.
- `domain` and `core` must not import `contracts/presentation` (DEC-2 fixture).
- Exit codes are a lossy projection of the error table for shell consumers. The projection is documented, stable, and tested; it is not the error model.
- The legacy bash exit-code convention remains valid for bash tools until they are migrated. The CLI projection is documented separately in `tools-convention.md`.

**Fit:** This satisfies the owner's error-model decision and C-9 for harness consumers. It ranks first on boundary enforcement and fifth on rename safety through stable schemas. The cost is two subpaths and a generated documentation page; the alternative is a flat contract that forces every harness to inherit shell semantics.

**Rejected alternative:** A flat `contracts` entry point that exposes process exit codes to every consumer. It leaks CLI presentation into domain and harness code.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-11:

- **C-1 (one OSS monorepo):** The workspace is additive inside this repository; no sibling repository; no cloud code. The M0-M3 (scope pending owner confirmation) delivery scope has a home.
- **C-2 (Apache-2.0, license registry, notices, SBOM):** The repository stays Apache-2.0; the allow-list gate reads the approved/rejected registry and fails closed on unknown or compound expressions; SSPL, BUSL, Elastic, Commons Clause, and CC-BY-NC are denied; releases attach an SBOM, checksums, and `THIRD-PARTY-NOTICES` for binaries and libraries. Individual dependency license compatibility remains a human determination recorded in the registry, which this constraint requires rather than bypasses.
- **C-3 (naming firewall):** Branding is the only current-name source inside `packages/**`; the legacy adapter is the only old-name source; the forbidden-literal test and rename drill are required; the installed corpus migration is explicitly separate.
- **C-4 (OSS-only):** No cloud package, name, design, or private reference is introduced. Telemetry envelopes are local-first and sink-ready without being cloud code. This record was scanned for private identifiers and contains none; private working paths and review records are described generically.
- **C-5 (wrapper-based coexistence):** Nothing moves; bash remains authoritative per engine until parity; the install ships the new tool plus wrappers; cutover is per engine and reversible.
- **C-6 (`.opencode` source of truth):** The decision does not touch `.opencode/` or the generated plugin; CI freshness continues.
- **C-7 (distribution registration and pin equality):** New release artifacts, including the MCP artifact and the opencode surface artifact, are registered in `install.sh` with explicit install paths and update mechanics, signature- and checksum-verified, and separate from the bash arrays; the four-copy Bun pin is checked for equality.
- **C-8 (gates never weaken):** Existing bash gates stay binding; new TypeScript jobs are binding; the parity suite, a clean observation window, a rehearsed rollback, and owner sign-off decide each cutover.
- **C-9 (runtime portability):** `contracts` and `core` have no runtime imports or ambient globals; the state driver is a port with a non-Bun path; harness surfaces consume public entry points; a runtime-portability smoke suite runs in CI. The absence of an approved non-Bun state driver at scaffold is an M0 stop condition, and the documented degraded mode until it lands is read-only JSONL without SQLite indexes.
- **C-10 (security and supply chain):** Signed releases, a fail-closed installer, a pinned bootstrap, SHA-pinned actions, job-scoped permissions, OIDC release credentials, a high/critical vulnerability gate, and MCP mutation authorization are required before release.
- **C-11 (privacy and data lifecycle):** Field-level classification, fail-closed redaction with a version and rule-set hash, closed payload schemas, retention and erasure before any sink, `0700`/`0600` state permissions, and the metadata-only clause for `SessionStore` and `HostPort` with privacy sign-off before the `db` administration engine ships are required.

The chosen alternative meets every constraint; no constraint is waived. C-9 is satisfied by design, with the absence of an approved non-Bun state driver at scaffold treated as an M0 stop condition. The documented degraded mode is read-only JSONL without SQLite indexes until that driver lands; it is a designed operating state, not a relaxed gate. Every constraint is marked `Negotiable: no`, so compliance is pass/fail rather than a documented-risk exception.

**Decider:** Juliusz Ćwiąkalski (owner). This record remains `Proposed` until the owner accepts it. At acceptance the owner sets `decision_date` and `review_date`; the first post-implementation retrospective follows the M0 scaffold.

**Conditions for revisit:** See the frontmatter `revisit_triggers`. The most likely early triggers are the non-Bun state driver result, the OpenCode harness form, a need to publish TypeScript libraries, and the first adapter that justifies a separate package.

## Trade-offs & Consequences

### Positive Outcomes

- Every artifact class has a clear home: contracts, core rules, state, adapters, surfaces, testkit, branding.
- CLI, MCP, and OpenCode share one core implementation; none can grow a private logic path without violating a package rule.
- Core logic is runtime-neutral, so a new harness is a composition change rather than a rewrite.
- Adapters depend only on contracts, so a provider can be replaced without touching core.
- The naming firewall becomes a constants change inside `packages/**` plus a countable corpus migration, not an unbounded search-and-replace.
- State is local-first, sink-ready, fence-protected, and driver-pluggable from day one; the JSONL format is the portable contract.
- The existing bash stack keeps delivering; wrappers move engine by engine only after parity.
- Boundary rules are executable and tested, not prose that reviewers can forget.
- The library publish path is designed now, so eventual library delivery does not force a redesign.
- The structure is legible to AI agents: package names and dependency rules tell an agent where new code belongs.

### Negative Outcomes

- Nine packages add workspace manifests, test targets, and a lockstep release process. The overhead is real, even if smaller than the alternative of ungoverned growth.
- `contracts` can become a dumping ground. It needs a review rule: a type belongs there only if it crosses a package boundary.
- A single `adapters` package can accumulate dependency weight. The split trigger is documented, but the first split will be a refactor.
- Composition wiring is duplicated in `cli`, `mcp`, and `opencode` until it justifies a shared runtime package. Duplication is small but visible.
- The runtime-neutral rule for `contracts` and `core` forbids convenient Bun or Node APIs in those tiers. Some code will need a port that a single-package design would not need.
- The state driver port and the non-Bun fallback add work before the first state-backed engine ships.
- Lockstep versioning couples package releases. It is simple now and may become friction when external consumers appear.
- The library publish path adds a release-time manifest transform and a pack dry-run to every release, even while publication is deferred.
- CI time grows with typecheck, boundary, runtime-portability, test, and binary-smoke jobs. The fast loop must be kept honest or developers will route around it.
- The new CLI exit-code projection may diverge from the legacy bash convention until `tools-convention.md` is reconciled. This is a documentation and consumer risk, not a structural one.
- The installed corpus still carries the current name until the separate migration lands; a public rename before then is not free.

### Unresolved Questions

These are the only open owner decision questions. All are owner-dependent, small, and do not block acceptance. Two evidence-level TO-CONFIRMs - marksync authorship and license, and the dependency license verdicts - remain tracked in the Evidence, Assumptions & Unknowns table; they are evidence gaps, not owner decisions.

- [ ] **UQ-1 Committed OSS scope:** is it M0-M3 inclusive or M0-M4? Both owner statements are quoted in the Owner decision record; this record does not choose between them. (owner)
- [ ] **UQ-2 Bootstrap and development install source:** delivery-phase installs already use pinned, tagged, checksummed releases (C-10), so the open question is only what the bootstrap and development installs fetch by default: `main-tools` (the delivery branch) or `main`. It also covers whether development installs may point at the delivery branch while keeping the same checksum verification. Owner's stated lean: `main-tools`. (owner)
- [ ] **UQ-3 License registry location and format:** a committed file in this repository or a separate compliance artifact, and in what format? (owner)
- [ ] **UQ-4 GH-49 M0 configuration-inheritance supersession:** confirm the DEC-4 supersession, or return inheritance to M0? (owner)
- [ ] **UQ-5 Library publication set and start date:** which packages publish as libraries, and when? The intended set is `contracts`, `core`, `adapters`, and `testkit`. (owner)
- [ ] **UQ-6 Retention horizon and erasure values:** what are the retention horizon, compaction cadence, and erasure procedure values for state and any future sink? (owner)
- [ ] **UQ-7 MCP v1 mutation scope:** read-only only, or mutating tools with authorization and confirmation? Owner's stated lean: read-only first. (owner)
- [ ] **UQ-8 Workspace identity confirmation:** after the first multi-workspace exercise, confirm the workspace identity, the per-workspace partition, and the lock-scope model defined in DEC-5. (owner)
- [ ] **UQ-9 Brand name:** product name, binary name, and naming-freeze date; blocks publication, not the scaffold. (owner)

## Implementation Plan

High-level only; each step is delivered as an ADOS change with a spec, test plan, and plan, targeting `main-tools`.

1. **Workspace scaffold:** Add the private root `package.json`, `bun.lock`, `.bun-version` (most recent stable Bun fixed here), `tsconfig.base.json`, solution `tsconfig.json`, `biome.json`, `commitlint.config.js`, `.dependency-cruiser.cjs`, `.gitignore` entries, and the new CI jobs. Record the scaffold-step decisions in the change spec: exact Bun version, `exports` targeting `dist` for publishable packages (never `src`), the MCP artifact form (Bun binary or Node entry), the non-Bun SQLite driver fallback, and the CLI startup budget. No product behavior yet.
2. **Contracts, branding, and core skeleton:** Create `contracts` with `values`, `ports`, and `presentation` subpaths; `branding` with the single central constant; and `core` with `domain`, `app`, and `config` tiers. Add the boundary matrices, the exports-map check, the ambient-global guard, and negative fixtures including cross-package relative imports and testkit dev edges. Add the forbidden-literal test and the rename drill.
3. **State store:** Implement the append-only JSONL writer with sequence and checksum framing, fsync, quarantine, the SQLite index behind `SqliteDriverPort`, the non-Bun fallback path, schema versions, fence-epoch locking, rebuild, rotation, low-disk preflight, permissions, and the restore drill. Add redaction with `redactorVersion` and rule-set hash, closed payload schemas, and the canary-secret test. Prove that malformed input fails loudly and that a `SIGSTOP`-ed writer is fenced.
4. **Adapters and I/O ports:** Start with GitLab and Jira, the Git adapter, provider probes, config sources, the legacy adapter, and the non-provider ports (`RepoStore`, `FileStore`, `HostPort`, `CiHealthPort`, `SessionStore`). Build the fake server, trap catalogs, conformance suite, per-operation timeouts, retry budgets, and circuit breakers in `testkit`. Add GitHub when dogfooding requires it; leave Azure until a consumer exists.
5. **Surfaces:** Implement `cli` with Cliffy confined to the package, `runCli(argv, streams, deps)` returning an exit code, JSON and human output, and the composition root. Implement `mcp` as a minimal local tool surface over the same core use cases, with bounded outputs and branded tool-name projection. Implement `opencode` as a thin native-tool surface that consumes public core entry points, and add the Node harness smoke that stubs the host API and invokes its exported entry points. Add the MCP lifecycle, health/readiness, concurrency, and runbook gates.
6. **Dual-run and wrapper cutover:** Wire the M0 engines (status, join and exit taxonomy, provider, closeout) to run beside the bash stack. Mutating engines run shadow or read-only with deterministic `operationId` and a persisted key-to-outcome. Cut a wrapper over only after the parity suite passes, the observation window is clean, the rollback is rehearsed, and the owner signs off. No gate is relaxed.
7. **Distribution and release:** Register the CLI binary, the MCP artifact, the opencode surface artifact, and updated wrappers in `install.sh` as separate artifact arrays, each with an install path, update and overwrite mechanics, and signature/checksum verification. Add signature and checksum verification, fail-closed source checks, the pin-equality CI check, binary smoke, SBOM, notices, license-registry audit, vulnerability scan, and clean-OS checks. Keep the bash install path intact.
8. **Library readiness:** Run `bun pm pack` or `npm pack --dry-run` for the publishable packages, smoke-test the packed entry points, and verify that the branded manifest transform, `exports` to `dist`, `files`, `LICENSE`, and `THIRD-PARTY-NOTICES` are present. Publication itself stays deferred.
9. **Documentation:** Add the tooling feature spec, the architecture overview, and the reader-facing CLI, MCP, and OpenCode documentation. Update `tools-convention.md` for the new runtime distinction and the error-table projection. Do not overwrite existing delivery-system specs.
10. **Old tool retirement:** Only after parity and a deprecation cycle, remove each bash tool and its install registration together. No permanent shims.

**Milestone stop conditions, leading indicator, and rollback statement:**

| Milestone | Stop condition: do not proceed if... | Rollback statement |
|-----------|--------------------------------------|--------------------|
| M0 scaffold | Core or contracts contains a runtime import or ambient global; a non-provider I/O need has no port home; the lock fencing test fails; a dependency has no license-registry entry; the exports check permits a `src` import; there is no approved non-Bun state driver at scaffold (the degraded mode would otherwise become the only mode). | Revert the scaffold PR. The bash stack is untouched and no user-facing artifact was shipped. |
| M1 engines | A boundary or subpath fixture fails; a shadow run produces a duplicate mutation; an adapter has no conformance or trap coverage; the runtime-portability smoke fails. | Disable the engine in config; the wrapper keeps the bash body; state is append-only and replay-safe. |
| M2 wrappers | A parity regression appears; the observation window is dirty; signature verification fails; the rename drill fails. | Switch the wrapper feature flag back to bash; reinstall the previous signed release; no state deletion is required. |
| M3 harness and release | The OpenCode surface reaches into core internals; the MCP lifecycle or authorization model is undefined; library pack exposes deep imports or missing notices; notices or SBOM are absent. | Revert the surface or release PR; the CLI and bash paths remain available; publication stays blocked. |

**Leading indicator:** time from scaffold merge to the first owner-usable `status --json` command, measured in days. It is reviewed at each milestone and trended down; if it grows without a matching risk reduction, the structure is over-built.

## Rollback / Reversal

**Reversal class:** moderate before the first public release; costly after package names, library names, MCP tool names, or release tags are public.

- **Before any wrapper cutover:** Revert the `packages/` addition, the root manifests, and the new CI jobs in one PR. The bash stack, install paths, and user-facing behavior are unchanged. No data migration is involved beyond local `.ai/local/state`.
- **After a wrapper cutover:** During the two-milestone retention window, flip the per-engine feature switch back to the bash implementation, then revert the wrapper change. After the window closes, roll back by reinstalling the previous signed release from the pinned tag (reinstall-only). State remains readable: the JSONL log is append-only, the index is rebuildable, and the operation index prevents the new tool from replaying a completed mutation within one workspace. The transfer guard keeps only one writer path live; the bash path does not consult the operation index.
- **After a state schema change:** Keep a dual-read window for one release. Rebuild the index from JSONL rather than mutating it in place. Quarantined segments are retained until the rollback window closes.
- **After the first public release:** Distributed package names, published library names, MCP tool names, and release tags cannot be un-published. Rollback means deprecating the artifact, publishing a corrective release, and keeping the old install path working for one cycle. This is why publication is deferred until the naming freeze and the library publish path are proven.
- **Irrecoverable data:** none if the append-only log and its backup are retained. Deleting a state root, an external tracker mutation, or a published release is not reversible by this decision. Retention and backup reduce the chance of losing state history; the operation index prevents the new tool from replaying a completed mutation within one workspace, but it does not prevent deletion of a state root; notice requirements reduce the chance of an unwanted public release.
- **Stop conditions that trigger rollback:** any boundary violation in a merged change; any duplicate external mutation in a shadow or live run; any `STATE_CORRUPT` event not explained by a torn tail; a failed signature or checksum verification; a high or critical vulnerability; a privacy gate failure; a runtime-portability violation; or a parity regression.

## Communication Plan

| Audience | Message | Channel | Timing |
|----------|---------|---------|--------|
| Owner (decider) | R3 record revised after a REWORK verdict; re-review completed 2026-10-24 at PASS_WITH_RISKS with all non-blocking corrections applied; acceptance sets date and review date. | PR #163 review and decision record | Before acceptance |
| `@decision-critic` | Re-review this revision after the REWORK fixes; return PASS, PASS_WITH_RISKS, or REWORK with findings mapped to constraints and drivers. | PR review using `/review-decision` | Before acceptance |
| `@coder` and contributors | The scaffold contract: package set, subpaths, driver port, error table, wrapper cutover, and stop conditions. | Change spec, plan, and this record | At M0 start and at each milestone |
| ADOS users | The bash stack keeps working; new tools appear beside it and take over only after parity; install and checksums are verified. | Release notes, `doc/guides/` updates, installer help | At each release that ships a new artifact |
| ADOS agents | Where new code belongs: package boundaries, subpaths, testkit dev edges, and the error table. | `doc/spec/`, architecture overview, decision record | At M0 and when a rule changes |
| Security, privacy, and legal reviewers | Signed releases, vulnerability gate, license registry, notices, redaction, retention, and erasure gates are release blockers. | Change spec and release checklist | Before the first public release |
| Future maintainers | Why the monorepo has nine packages, why Bun is not a semantic dependency, and why publication is deferred. | This decision record and the retrospective | On acceptance and at review_date |

## Verification Criteria

- **Metric:** Package dependency-graph violations across the DEC-2 matrix - Target: 0 - Window: every pull request.
- **Metric:** `contracts` subpath violations, including `domain -> presentation` - Target: 0 - Window: every pull request.
- **Metric:** Core tier violations (`domain`/`app`/`config`) - Target: 0 - Window: every pull request.
- **Metric:** Ambient runtime globals or runtime imports in `contracts` and `core` - Target: 0 - Window: every pull request.
- **Metric:** Negative fixtures proving each forbidden edge fails, including a cross-package relative import and a testkit dev edge - Target: one per rule - Window: scaffold complete.
- **Metric:** Public entry point check: every workspace import resolves through an `exports` subpath; no published `exports` target points at `src` - Target: 0 violations - Window: every pull request and every release.
- **Metric:** Forbidden product-name literals in `packages/**` and new user-facing docs outside the allowlist - Target: 0 - Window: every pull request.
- **Metric:** Rename drill passes after replacing branding constants and the legacy mapping - Target: pass - Window: branding changes and release gate.
- **Metric:** `tsc -b` clean with the strict flags - Target: clean - Window: every pull request.
- **Metric:** Runtime-portability smoke: contract and core tests pass under a second runtime host - Target: pass - Window: every pull request.
- **Metric:** Existing bash test suite result - Target: no regression - Window: every pull request.
- **Metric:** `e2e-mock` coverage of adapters without secrets - Target: every adapter has fixtures - Window: each adapter delivery.
- **Metric:** State JSONL rebuild reproduces the SQLite index - Target: identical query results - Window: state feature delivery.
- **Metric:** Lock fencing tests (`SIGSTOP` resume, PID reuse, clock step forward and backward) - Target: pass - Window: state feature delivery.
- **Metric:** Dual-run mutating engines produce duplicate external mutations - Target: 0 - Window: every shadow run and cutover.
- **Metric:** Dual-run parity for a migrated engine - Target: parity suite passes and the observation window is clean - Window: before each wrapper cutover.
- **Metric:** Secrets or absolute user paths in state and telemetry fixtures - Target: 0 - Window: every pull request.
- **Metric:** Canary secret occurrences in state and telemetry - Target: 0 - Window: every pull request.
- **Metric:** State directory and file permissions - Target: `0700` directory, `0600` files - Window: every state open and every release check.
- **Metric:** License registry coverage - Target: every dependency has an entry with SPDX id, verdict, approver, date, scope, and review date; no denied license; unknown and compound expressions fail closed - Window: every pull request.
- **Metric:** Vulnerability gate - Target: 0 high or critical findings - Window: every pull request.
- **Metric:** GitHub Actions pinned by commit SHA; unpinned action references - Target: 0 - Window: every pull request.
- **Metric:** Release credentials issued through OIDC; long-lived release secrets - Target: 0 - Window: every release and every change to release configuration.
- **Metric:** MCP mutating tools require authorization and confirmation before execution; unconfirmed mutation attempts blocked - Target: 0 unconfirmed mutations - Window: every MCP change and every release that ships an MCP artifact.
- **Metric:** Prompt-injection fixture: untrusted MCP tool input, description, or returned content cannot grant authority or trigger a mutation - Target: fixture passes - Window: every MCP change.
- **Metric:** Privacy review sign-off recorded before the first release that persists or exports events - Target: recorded - Window: release gate.
- **Metric:** Metadata-only clause for `SessionStore` and `HostPort`: no message content, prompts, transcripts, credentials, environment values, or command arguments surfaced; field classification applied to every surfaced field - Target: 0 violations - Window: every pull request that touches either port, and privacy sign-off before the `db` administration engine ships.
- **Metric:** Closed payload schema validation rejects unknown fields for every event type at write time - Target: 0 unknown-field writes accepted - Window: every pull request and each new event type.
- **Metric:** Surface-level non-Bun smoke (defined host per surface): (a) the mcp surface starts and completes a read-only command under Node; (b) the opencode surface entry point starts and completes a read-only command under a Node harness that stubs the OpenCode host API and invokes the exported native-tool entry points; both assert that the surface imports only documented `core` and `contracts` entry points - Target: pass - Window: every pull request.
- **Metric:** Release artifacts - Target: CLI binary, MCP artifact, OpenCode surface, `SHA256SUMS`, signature, CycloneDX SBOM, `THIRD-PARTY-NOTICES` - Window: every release.
- **Metric:** Library pack dry-run - Target: entry points, `exports` to `dist`, license, and notices present for every publishable package - Window: every release.
- **Metric:** Installer verification - Target: signature and checksum verified before install; non-HTTPS or missing checksum fails closed - Window: every install and release.
- **Metric:** Pin equality across `.bun-version`, `engines.bun`, CI, and release build - Target: identical - Window: every pull request.
- **Metric:** Clean-OS binary smoke - Target: `--version` and a JSON command succeed without a language runtime - Window: every release.
- **Metric:** CLI startup time - Target: within the scaffold-set budget, measured - Window: every release.

## Confidence Rating

**Medium-high.** The structure is grounded in a concrete, proven single-package template and in the repository's own constraints. The package graph is deliberately small and the enforcement is testable. The remaining uncertainties are external or packaging-level: the non-Bun SQLite driver, the OpenCode harness form, the MCP artifact form, library publication timing, and the license verdicts. None of those changes the package boundaries; they change packaging, defaults, or release timing. AI-generated confidence is not evidence. The formal `@decision-critic` returned REWORK on 2026-10-24 and, on re-review of this revision on 2026-10-24, returned PASS_WITH_RISKS with non-blocking corrections; the owner's final decision remains required.

## Adversarial Challenge (R3)

**Prior same-lineage review input:** CritiqueGrid review `CG-2026-10-23-PR-163-ADR-0003` (2026-10-23), covering decision quality, architecture, security, legal, SRE, and privacy, with four adversarial challenge packets. The review found 0 critical findings after challenge, 16 warnings, and 22 additional findings, and returned verdict `CONCERNS`. It is cited as review input, not as independent evidence.

**Owner responses:** Owner direction via CEO session 2026-10-23 answered the eight open questions recorded as review file comments and chose R3. The review addendum records those eight answers plus the R3 choice and maps each one to the findings; it states the then-current verdict as `CONCERNS` because the ADR text had not yet incorporated the answers.

**What this revision changes in response:** rigor is R3 with the required sections; owner decisions are quoted from the owner's own words instead of an unverifiable locator; the M0-M3 and M0-M4 scope statements are both recorded and the conflict is an open owner question; C-9 is stated as a design obligation with a documented degraded mode and an M0 stop condition, not as a waived risk; DEC-5 makes the platform table primary and records the resolved path in `manifest.json`; DEC-7 keeps the bash body for a two-milestone retention window as the rehearsed rollback; DEC-6 scopes the operation index and adds a transfer guard; C-10 and C-11 gain verification metrics; C-3 names the seed literal set; DEC-1 and DEC-2 rank citations match the ranked list; the formal REWORK verdict and a finding-by-finding disposition table are recorded below. The 2026-10-24 PASS_WITH_RISKS re-review then added: the re-review verdict and accepted-risk list; the M0-M3 scope label sweep; `packages/opencode` in the install and distribution arrays plus the legibility-trap note; the C-11 metadata-only clause for `SessionStore` and `HostPort`; a defined Node-harness opencode non-Bun smoke; the "owner decision questions" wording; a template-aligned alternatives legend with Alt 2 C-9 marked `Yes`; unified "retention window" terminology; the qualified operation-index statement; and the reframed UQ-2.

**Formal `@decision-critic` verdict (first pass):** Verdict (verbatim): `REWORK`. Date: 2026-10-24. Outcome at first pass: `REWORK-fixed-pending-re-review`; the reviewer outcome is now `PASS_WITH_RISKS` (re-review below). The critic returned REWORK on the previous revision. This revision addresses all 15 items below. The record did not move to `Accepted` with an open REWORK verdict.

**Formal `@decision-critic` re-review verdict:** Verdict: `PASS_WITH_RISKS`. Date: 2026-10-24. Scope: re-review of the REWORK revision described in this section. The critic confirmed the 15 REWORK items were addressed and returned 10 non-blocking corrections. All 10 are applied in this text; no blocking finding remains. The verdict is not acceptance: `status` stays `Proposed` and `decision_date` stays null until the owner decides.

**Accepted risks from the PASS_WITH_RISKS re-review (8 items, faithfully condensed; the critic's exact wording was not available to the record writer):**

| # | Accepted risk | Why it was accepted | Where handled |
|---|---------------|---------------------|---------------|
| R-1 | Bare `M0-M3` labels remained outside the owner decision record, so a reader could take an unconfirmed scope as settled; the underlying M0-M3 versus M0-M4 conflict is still unresolved. | The conflict is an owner question (UQ-1), not a record defect, and the labels can be qualified without choosing a scope. | Every remaining scope boundary now reads "M0-M3 (scope pending owner confirmation)"; historical disposition mentions and verbatim owner quotes are unchanged. |
| R-2 | `packages/opencode` coexists with the canonical root `.opencode/` directory, a legibility trap for agents and contributors. | Renaming either side would break C-6 or the agreed package set, so the risk is managed by an explicit statement, not by a move. | DEC-1 harness consumption model; DEC-7 distribution rules legibility-trap sentence. |
| R-3 | `SessionStore` (foreign session database reads) and `HostPort` (process inspection) can expose personal data. | Both are needed for `db` administration and host facts; a metadata-only bound plus a sign-off gate contains the exposure. | C-11 metadata-only clause; DEC-6 port bullets; new verification metric. |
| R-4 | The opencode half of the non-Bun smoke metric was underspecified, so it could not be verified as written. | Dropping it would weaken C-9; defining a host simulation keeps the metric testable. | C-9 verification; the surface-level non-Bun smoke metric now names the Node harness and stubbed host API. |
| R-5 | Two evidence-level TO-CONFIRMs remain: marksync authorship and license, and the dependency license verdicts. | Both require human verification outside this record; they do not change the package graph. | Evidence table rows; the Unresolved Questions preamble now says they are evidence gaps, not owner decisions. |
| R-6 | Alt 2 was marked `Risk` on C-9, a `negotiable: no` constraint, which contradicts the template's accepted-risk rule. | The alternative does meet C-9 by design; only enforcement is weaker, so the fit text carries the gap and the table follows the template. | Alternatives legend; Alt 2 C-9 now `Yes`; Alt 2 constraint-compliance and driver-fit text. |
| R-7 | The operation-index text implied it protects against state-root deletion; retention and backup do. | The index only de-duplicates replay within a workspace; the overclaim can be qualified without changing the design. | Rollback / Reversal "Irrecoverable data" bullet. |
| R-8 | Install-source ambiguity and terminology drift (`deprecation window` versus `retention window`) made obligations harder to read. | Delivery installs are already pinned, tagged, and checksummed under C-10; only the bootstrap and development default remains open, and one term suffices. | UQ-2 reframed; DEC-7 open item; Evidence row; unified "retention window". |

**Non-blocking corrections applied from the re-review (10):**

| # | Correction | Where applied |
|---|------------|---------------|
| 1 | Record the re-review verdict, date, scope, and the 8 accepted risks; replace "re-review pending"; fix the "nine open questions" wording to eight file comments plus the R3 choice. | Frontmatter `reviewers`; this section; Confidence Rating. |
| 2 | Sweep bare `M0-M3` to `M0-M3 (scope pending owner confirmation)` at scope boundaries; keep historical mentions. | DEC-1, DEC-3, DEC-6, DEC-7, DEC-8, Evidence table. |
| 3 | Register `packages/opencode` in install and distribution arrays with update mechanics; note the `.opencode/` coexistence trap. | C-7; DEC-7; Implementation Plan step 7; attestation. |
| 4 | Add the C-11 metadata-only clause for `SessionStore` and `HostPort`. | C-11; DEC-6; attestation; verification metric. |
| 5 | Define the opencode non-Bun smoke host instead of dropping the metric. | C-9 verification; verification metric. |
| 6 | Soften "only open owner questions" and name the two evidence-level TO-CONFIRMs. | Unresolved Questions preamble. |
| 7 | Align the alternatives legend with the template; mark Alt 2 C-9 `Yes` with the enforcement gap in the driver fit. | Alternatives legend; Alt 2. |
| 8 | Unify "deprecation window" and "retention window" to "retention window". | DEC-7. |
| 9 | Qualify the operation-index claim: retention and backup protect a state root, not the index. | Rollback / Reversal. |
| 10 | Reframe UQ-2 to bootstrap and development install source only, with delivery installs pinned and checksummed. | UQ-2; DEC-7 open item; Evidence table. |

**Disposition of prior CritiqueGrid findings:**

| Finding group | Disposition | Where addressed |
|---------------|-------------|-----------------|
| Decision quality: unverifiable locator, scope conflict, stale-scope claims, rank citations, review-label overreach | closed | Owner decision record; Evidence table; DEC-1; DEC-2; this section |
| Architecture: package boundaries, harness shape, state driver, contracts split | closed | DEC-1; DEC-2; DEC-3; DEC-9 |
| SRE and operations: lock and fencing, index rebuild, rollback, distribution | closed | DEC-5; DEC-6; DEC-7; Rollback / Reversal |
| CG-SEC-001 through CG-SEC-004 | closed | C-10; DEC-3; DEC-7; Verification Criteria |
| CG-PRIV-001 through CG-PRIV-005 | closed | C-11; DEC-5; Verification Criteria |
| CG-LEG-001 and CG-LEG-007 (marksync provenance and license) | closed | DEC-9 provenance rule; C-2 |
| CG-DEC-007 (naming corpus scope) | closed | C-3; DEC-8 scope-of-the-claim rule |
| Remaining CritiqueGrid warnings (16) and additional findings (22) not individually cited | deferred | First retrospective; none changes the package graph |
| Open owner questions | open | UQ-1 through UQ-9 (Unresolved Questions) |

**Disposition of the 15 `@decision-critic` REWORK items (2026-10-24):**

| # | Critic item | Disposition | Where addressed |
|---|-------------|-------------|-----------------|
| 1 | Owner-decision locator used unverifiable claims | closed | Owner decision record quotes the 2026-10-23 owner statements as FACT rows; Evidence table re-sourced to owner direction via CEO session 2026-10-23 |
| 2 | M0-M3 versus M0-M4 scope conflict | closed (owner question open: UQ-1) | Owner decision record records both statements verbatim; stale-scope and addendum-reconciliation claims removed; every scope boundary uses "M0-M3 (scope pending owner confirmation)" |
| 3 | C-9 attestation implied an accepted-risk waiver | closed | C-9 statement; DEC-3 state driver; Constraint Compliance Attestation; M0 stop condition "no approved non-Bun state driver at scaffold" |
| 4 | DEC-5 state default contradicted itself | closed | DEC-5 Location and precedence: platform table is primary; override > Linux XDG_STATE_HOME > per-platform default; resolved path in `manifest.json` |
| 5 | DEC-7 cutover and rollback contradicted each other | closed | DEC-7 keeps the bash body for a two-milestone retention window as the rehearsed rollback; post-window rollback is reinstall-only |
| 6 | Operation-index claim overstated; concurrent first-run race | closed | DEC-6 scope and transfer guard; DEC-5 root manifest lock; Rollback / Reversal states that retention and backup protect a state root, not the index |
| 7 | C-10 and C-11 verification gaps | closed | Verification Criteria adds SHA pins, OIDC credentials, MCP authorization and confirmation, prompt-injection fixture, privacy sign-off, payload schema validation, the C-11 metadata-only clause, and a surface-level non-Bun smoke with a defined Node harness for the opencode entry point |
| 8 | C-3 forbidden-literal seed set unnamed | closed | C-3 and DEC-8 name `ados`, `ADOS_`, and `~/.ados`; the test grows with the frozen name set |
| 9 | DEC-1 and DEC-2 rank citations wrong | closed | DEC-1 and DEC-2 fit paragraphs aligned to the authoritative ranked list |
| 10 | CritiqueGrid called "independent review evidence" | closed | Frontmatter and Decision Rights call it same-lineage review input; formal REWORK verdict recorded |
| 11 | Alt 2 matrix Risk legend undefined for negotiable:no | closed | Alternatives legend aligned to the template (`Risk` only for `negotiable: yes`); Alt 2 C-9 marked `Yes` with the enforcement gap recorded in its driver fit |
| 12 | R3 acceptance deadline and escalation missing | closed | Decision Rights adds the acceptance deadline and owner escalation authority |
| 13 | C-4 private-reference interpretation and scan | closed | C-4 interpretation sentence added; private paths replaced with generic descriptions; scan found no private identifiers |
| 14 | No finding disposition table | closed | This section: the CritiqueGrid table and the 15-item table above |
| 15 | Owner-dependent items not consolidated | closed (all open items in UQ-1 through UQ-9) | Unresolved Questions lists owner-dependent items with the owner's stated lean where known |

**Open items:** the only open owner decision items are UQ-1 through UQ-9 in Unresolved Questions. Each is small and owner-scoped. Two evidence-level TO-CONFIRMs (marksync authorship and license, and the dependency license verdicts) remain tracked in the Evidence table; they are evidence gaps, not owner decisions. None of these blocks acceptance; the re-review is complete at PASS_WITH_RISKS.

**Independence caveat:** same-model reviewers share lineage and are not independent evidence. R3 still requires the owner's human decision. The owner is the only authority who can accept this record.

**Explicit dissent:** the formal critic returned REWORK on 2026-10-24; that dissent is recorded here and resolved item by item in the 15-item disposition table. The re-review of 2026-10-24 returned PASS_WITH_RISKS and cleared the REWORK verdict with 10 non-blocking corrections, all applied above. No dissent is recorded from the decider. CritiqueGrid residual concerns are listed above and in the Unresolved Questions. The record does not move to `Accepted` until the owner decides.

**Residual risks after this revision:** the non-Bun driver is unproven; the OpenCode native-tool shape is unproven; the license verdicts are not yet recorded; the installed corpus migration is not done; the bootstrap and development install source is unconfirmed; the registry location and format are unconfirmed; the committed scope M0-M3 versus M0-M4 is unresolved; the retention and erasure values are unset; the library publish set is unconfirmed; the MCP mutation scope is unconfirmed; and the workspace identity model is unproven. The eight PASS_WITH_RISKS accepted risks are listed above. These are recorded as owner questions, evidence gaps, or scaffold-step decisions rather than hidden.

## Structured Retrospective

**Status:** TODO: first retrospective after the M0 scaffold and the first wrapper cutover. `review_date` is null until acceptance; the owner sets it at acceptance.

### Process quality

- Was R3 the right rigor, and did the formal challenge arrive before acceptance?
- Did the owner answers reach the record without being reinterpreted?

### Evidence quality

- Did the runtime-portability smoke and the non-Bun driver spike confirm the assumption?
- Did the license registry resolve every candidate, and were any verdicts reversed?
- Did the CritiqueGrid findings prove accurate in implementation?

### Execution quality

- Did the scaffold keep the package graph and subpath rules green without advisory exceptions?
- Did the wrapper cutover follow the parity gate, and was the rollback rehearsed?
- Did any engine land without a port home or with a runtime leak?

### Realized outcome

- Did time to first slice stay acceptable, and did the leading indicator trend down?
- Did the rename drill pass on the first attempt, and did the corpus migration stay countable?
- Did the library pack dry-run expose defects before publication?

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
- Owner sequencing note in the owner's local working notes, 2026-10-24 - later scope sequencing statement quoted verbatim in the Owner decision record (private working note, described generically; not committed).
- CritiqueGrid review `CG-2026-10-23-PR-163-ADR-0003`, 2026-10-23 - prior same-lineage review input (private working record, described generically; not committed).
- Review addendum, 2026-10-24 - owner answers mapped to the CritiqueGrid findings (private working record, described generically; not committed).
- `scripts/install.sh` - current distribution registration arrays and installer verification behavior.
- marksync-for-confluence repository (owner's sibling repository; license and authorship to be verified before any source reuse), local evaluation on 2026-10-23: `package.json`, `tsconfig.json`, `.dependency-cruiser.cjs`, `src/domain`, `src/app`, `src/cli`, `src/infra`, `tests/`, `.github/workflows/ci.yml`, and `.github/workflows/release.yml`.
