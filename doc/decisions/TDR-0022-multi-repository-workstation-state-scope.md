---
id: TDR-0022
decision_type: tdr
status: Proposed
created: 2026-11-11
decision_date: null
last_updated: 2026-11-11
summary: "Adopt a two-layer workstation state scope — the delivered host root (an absolute `<PREFIX>_STATE_DIR` override wins, otherwise the injected home plus `brand.stateDirectoryName`) holding one project state root per checkout at `<host root>/projects/<project key>` and one host index at `<host root>/host-index.json` (`delivery.projects.host-index.v1`) — with the project key minted once into a create-once, `0600` marker inside the checkout's git common directory, one runtime-neutral state-scope policy in the core app tier exported from the existing `@delivery-os/core` root entry and consumed by every state-opening surface, and help/reference-page gates that resolve a per-command page root; the state layer's record contract, schema version, workspace id `default`, and file layout are unchanged because isolation comes from the root, and no error identity, state record kind, workspace package, or core subpath is added."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os state scope, checkout identity, and reference-page gates
decision_scope: repo
review_date: null
classification:
  domains: [architecture, tooling, operations]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-288 DEC-19 delegates authoring; delivery plan phase 1 item 1.0)"
  decider: "Juliusz Ćwiąkalski (owner; acceptance pending at the GH-288 PR review)"
  contributors:
    - "@spec-writer (chg-GH-288-spec F-1, F-6, F-9, DM-1..DM-3, §15 DEC-1/DEC-3/DEC-12/DEC-13, §15.1)"
    - "@plan-writer (plan phase 1 scope and ordering)"
    - "@decision-advisor (repository analysis and record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Owner (human final acceptance)"
  performers:
    - "@coder (GH-288 plan phases 1-4)"
  informed:
    - "M2-S4 board and every M2 story that attributes state to a repository"
    - "MCP serve surface (must resolve the same root as the CLI)"
    - "Operators performing the one-step migration"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A new host-level artifact beyond the host index and the host-wide owner-hold marker is proposed at the host root: decide its layer deliberately instead of adding another host-wide file."
  - "A surface needs to derive a state path without going through the app-tier policy (a new runtime, an MCP tool that resolves a path itself, a script): reopen the single-policy decision rather than adding a second derivation."
  - "A repository's durable identity is needed by a surface that does not sit inside a checkout: the marker-read rule cannot be satisfied from outside a work tree, so that attribution question needs its own decision."
  - "The project-key shape must change (basename bound, discriminator length, fallback, or the `unbound` reservation) or the marker schema must be extended: a persisted identity change is a migration question, not a format tweak."
  - "A new command family lands its reference page by editing an earlier milestone snapshot instead of its own page root: the per-command page root has been bypassed and the gate must be strengthened."
  - "Per-project owner holds are taken up (GH-288 §7.3 deferred): the hold stops being host-wide and the owner-hold read site must move."
links:
  related_changes: ["GH-288"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-11--GH-288--multi-repo-workstations/chg-GH-288-spec.md"
    - "doc/spec/features/feature-state-layer.md"
    - "doc/spec/features/feature-cli-entrypoint.md"
    - "doc/spec/features/feature-branding-seam.md"
  contracts:
    - "packages/core/src/contracts/projects.ts"
    - "packages/core/src/app/state-scope.ts"
    - "packages/core/src/config/catalog.ts"
    - "packages/core/src/index.ts"
    - "packages/cli/src/production.ts"
    - "packages/mcp/src/serve.ts"
    - "packages/adapters/src/repo/index.ts"
    - "packages/adapters/src/file/dispatch-identity.ts"
    - "scripts/lib/dispatch-authority.sh"
  diagrams: []
  decisions: ["ADR-0003", "TDR-0004"]
  experiments: []
  metrics: []
  roadmap_items: ["M2-S11", "M2-S4"]
---

# TDR-0022: Multi-Repository Workstation State Scope — Host Root and Project Root Layout, Marker-Minted Project Identity, One App-Tier Policy, and Per-Command Reference-Page Roots

## Context

- **FACT:** The production composition composes the state directory inline as `${homeDirectory}/${brand.stateDirectoryName}` and opens the store with workspace identifier `default` (`packages/cli/src/production.ts` lines 286 and 309, read 2026-11-11). That one directory serves every managed checkout on the host.
- **FACT:** The MCP surface repeats the same inline composition independently rather than consuming a shared rule (`packages/mcp/src/serve.ts` line 90, read 2026-11-11).
- **FACT:** An override-aware rule is already delivered in the configuration catalog: `resolveStateDirectoryScope` returns an absolute `<PREFIX>_STATE_DIR` outright when set, otherwise the injected home plus `stateDirectoryName`, and classifies a relative override as `config.value.invalid` (`packages/core/src/config/catalog.ts` lines 879–909, read 2026-11-11). It is exported from the `@delivery-os/core` root entry (`packages/core/src/index.ts` line 223), and its only delivered consumer is the runtime-aware edge that composes the command audit store (`packages/cli/src/edge.ts` line 1400) — so the shipped delivery store does not honour the override today.
- **FACT:** Store artifacts and derived documents are workspace-scoped, never repository-scoped: `ledger.<workspace>.jsonl`, `documents.<workspace>/`, `chain-key.<workspace>.json`, `quarantine.<workspace>/` and the retro sidecar all carry the workspace segment, while phase state is the document `phase-state.<REF>.json` and a queue entry is the ledger key `queue.entries:<REF>` (GH-288 spec §2.1, read 2026-11-11). With one workspace identifier for the host, two checkouts of different repositories working one ref write the same document name and the same ledger key.
- **FACT:** The brand derives `stateDirectoryName` as the dot directory plus `-state` (`packages/core/src/branding/index.ts` line 128), so the host root's default is brand-derived and contains no hardcoded product name.
- **FACT:** The core tier matrix is machine-enforced: `tier-domain-only-contracts` forbids `domain` from importing `app|config|branding|state`, `tier-config-only-contracts` forbids `config` from importing `domain`, and `tier-app-allowed-set` forbids only `branding` and `state` from `app` — so `app` is the only core tier that may import `domain`, `config`, and `./contracts` together (`.dependency-cruiser.cjs` lines 124–156, read 2026-11-11).
- **FACT:** Both host packages already declare the `@delivery-os/core` root entry `.` in their `workspaceImports` (`packages/cli/package.json` lines 27–34; `packages/mcp/package.json` lines 26–33), and `scripts/checks/workspace-entrypoints.ts` with `tests/structure/subpaths.test.ts` keeps every imported subpath declared.
- **FACT:** Checkout resolution returns the git directory and the git common directory from the working directory, treating a `.git` directory as a normal root and a `gitdir:` file as a linked-worktree root (`packages/adapters/src/repo/index.ts` lines 40–109, read 2026-11-11). The delivered checkout-scoped marker discipline creates the marker with an exclusive `0600` sibling that is linked into place, so an interrupted write cannot publish a partial marker and a later rename cannot change it (`packages/adapters/src/file/dispatch-identity.ts` lines 54 and 85–110, read 2026-11-11).
- **FACT:** Both help gates carry one M1 page root: the coverage gate declares `PAGE_ROOT = "doc/planning/oss-tooling/milestones/m1/commands"` (`scripts/checks/help-guide-coverage.ts` line 15) and the parity test builds every command page from the same M1 segment (`tests/checks/reference-page-parity.test.ts` line 32), while the coverage inventory registers M1 pages only (`tests/fixtures/help-guide/coverage.json`). The M2 command page for the new family already exists at `doc/planning/oss-tooling/milestones/m2/commands/projects.md`.
- **FACT:** The CLI-independent shell fallback resolves its state root from its own environment override, then a repository-local directory, then a home default, and searches at most two directory levels for the derived authority document (`scripts/lib/dispatch-authority.sh` lines 52–61 and 94–108; GH-288 spec §2.1).
- **FACT:** GH-288 fixes these four decisions at §15 (DEC-1, DEC-3, DEC-12, DEC-13) and requires exactly one record at the next free identifier covering them, authored as delivery plan phase 1 item 1.0 before any dependent code (§15.1, DEC-19; `chg-GH-288-plan.yaml` phase 1).
- **Scope note:** The host index maintenance rules, the `projects list` contract, the three error identities, the migration procedure, and the mount/coverage obligations are decided elsewhere in GH-288 (DEC-4, DEC-5, DEC-8, DEC-11, DEC-14, DEC-16, DEC-18, DM-6). This record adopts the four decisions §15.1 graduates, records the consequences that bind later changes, and re-opens none of the others.

## Problem Framing (Clarified)

Four separate defects are usually described as one. They have to be answered together because each one's answer is another one's precondition.

1. **The root is the only place the contract can be scoped.** Nothing about the state layer's record contract is wrong: names, key prefixes, fold rules, and permissions are sound, and the colliding artifacts (`phase-state.<REF>.json`, `queue.entries:<REF>`) are correct for a store that serves one repository. What is wrong is that *one store serves every repository on the host*. Re-keying the workspace would make the collision disappear by renaming every artifact and every derived document, which converts the only migration the contract permits — a directory move — into a rewrite, and breaks every consumer that pins a document name. Introducing the repository dimension at the *root* keeps the contract and makes migration a move.
2. **A root cannot be named after an identity that does not yet exist.** Any identity derived from a path breaks on rename; any identity derived from a remote collapses two clones of that remote, which is the collision this change removes; a bare readable slug collides whenever two checkout directories share a basename. The only input that survives a rename, a move, and linked-worktree use while remaining distinct between clones is the checkout's git common directory. It must be written once, read afterwards, and never recomputed — otherwise the state root moves when the working directory does.
3. **A rule implemented at three sites is not a rule.** The override-aware helper exists and the store does not use it; the CLI and MCP each compose their own copy. A per-project root applied at one site and not the others would split one repository's state across two locations, which is worse than the collision it replaces. So the host-root rule needs exactly one home and one consumer path, and the tier matrix decides where that home may be: `domain` cannot import `config`, `config` cannot import `domain`, so only `app` may consume configuration, contracts, and domain policy together — with filesystem and git I/O left in the adapter tier behind injected ports. A single policy is also the only shape a structural assertion can pin.
4. **A new command family forces a dated snapshot to change unless the gates can name a page root per command.** The M1 milestone pack is a dated record that stays as written. Placing an M2 page inside it misrepresents the snapshot; keeping the family out of the gates leaves it unreachable. The gates therefore need a declared per-command page root, not a single hardcoded milestone segment.

The decision question is therefore: **where does a repository's state live, what durable name identifies it, where does the rule that produces both live, and how does a new command family enter the help gates without editing a dated snapshot?** The answer must keep the state contract, honour the delivered override at every site, satisfy the tier matrix, and leave the milestone snapshot byte-unchanged.

## Constraints (Hard Requirements)

> **Table stakes:** no new external dependency, no new workspace package, no schema-version bump, and no new state record kind — acknowledged once rather than per alternative.

### C-1: State-contract preservation

- **Statement:** The state layer's record contract, schema version, record kinds, key prefixes, validation predicates, permissions, and store file layout inside a root are unchanged; the workspace identifier stays `default`; isolation is produced by the root alone. 0 artifact names, modes, or semantics change.
- **Source:** AC (GH-288 NG-1, NFR-2, DEC-2)
- **Verification:** test (existing state suites green unmodified; artifact-name and mode diff zero)
- **Negotiable:** no

### C-2: One host-root rule, override honoured everywhere

- **Statement:** The host root resolves by exactly one rule — an absolute `<PREFIX>_STATE_DIR` wins outright, a relative override is `config.value.invalid`, otherwise the injected home plus `brand.stateDirectoryName` — and every store-opening surface resolves through it. 0 inline home-plus-brand compositions remain, and the override precedence is identical at every site.
- **Source:** AC (GH-288 F-6, NFR-9, AC-F6-1, AC-F1-1)
- **Verification:** test (structural single-implementation assertion plus per-site override probes)
- **Negotiable:** no

### C-3: Durable identity, minted once from the checkout marker

- **Statement:** The project key is minted once and persisted in a create-once marker inside the checkout's git common directory (atomic synced sibling plus link, `0600`, never rewritten, shared by the repository's linked worktrees, travelling with a rename or move), and is never derived from a path or a remote. Two checkouts whose directories share a basename mint distinct keys by construction; the key and state root are unchanged across a working-directory rename, a linked worktree, a moved checkout, and a nested-subdirectory invocation.
- **Source:** AC (GH-288 F-1, DEC-3, NFR-6, AC-F1-3, AC-F1-4, AC-F1-6)
- **Verification:** test (identity-stability suite with real temporary checkouts)
- **Negotiable:** no

### C-4: Single policy in the app tier, exported from the core root entry

- **Statement:** Exactly one implementation of the state-scope rule exists, at `packages/core/src/app/state-scope.ts`; it is a runtime-neutral pure function over injected facts that reads no filesystem, git metadata, clock, or process environment, with filesystem and git I/O behind injected ports in the adapter tier. It is exported from the existing `@delivery-os/core` root entry — no new workspace package and no new core subpath — and every state-deriving surface consumes it.
- **Source:** internal standard (ADR-0003 DEC-2 tier matrix) + AC (GH-288 F-6, DEC-12, NFR-9, AC-F6-1)
- **Verification:** test (`tests/structure` boundary and single-implementation assertions) and code review
- **Negotiable:** no

### C-5: Gate parity with milestone-snapshot immutability

- **Statement:** The help-coverage gate and the reference-page parity gate resolve a per-command reference-page root, both are green with the new family registered, its page carries `--help` and `--version`, and every M1 milestone-snapshot page remains byte-unchanged.
- **Source:** AC (GH-288 F-9, DEC-13, AC-F9-2)
- **Verification:** test (both gates in-tree) and review (diff against the merge base for the snapshot half)
- **Negotiable:** no

### C-6: Closed vocabulary and no hardcoded names

- **Statement:** The record introduces no error identity and no state record kind. Identity and state-location outcomes reuse the identities GH-288 DM-6 declares (`projects.identity-unreadable`, `projects.state-unavailable`). No new product or binary literal appears in code, docs, or fixtures; every name resolves from the injected brand identity.
- **Source:** AC (GH-288 DM-6, NFR-10, AC-F9-3, AC-F9-4)
- **Verification:** test (error-table equality, forbidden-literal and branding scans)
- **Negotiable:** no

### C-7: Move-never-rewrite migration on both layers

- **Statement:** Migration of a populated pre-migration store is a directory move that preserves every byte and every mode and is reversible by the inverse move; no state file is rewritten. The host index, the host-wide owner-hold marker, the project container, and the `unbound` scope are not store artifacts and are not moved.
- **Source:** AC (GH-288 DEC-11, NFR-7, AC-F8-1)
- **Verification:** test (byte-identity, mode preservation, audit-chain verification, inverse move)
- **Negotiable:** no

## Decision Drivers

1. **Isolation by construction (the defect).** Two checkouts of different repositories must not be able to observe or mutate each other's state for the same ref, and distinctness must not depend on operator care.
2. **Contract preservation with a cheap exit (compatibility).** The state contract stays intact and migration stays a reversible move, because a rewrite would break every consumer that pins a document name and would make the loss unrecoverable.
3. **Stable identity an operator expects (trust).** One project per clone and its worktrees, distinct projects for distinct clones, and an unchanged state root when a checkout is renamed or moved.
4. **One policy, one place to change (coupling and cognitive load).** A per-repository rule applied at one site and not another silently splits state; one rule with one home is both correct and cheap to reason about.
5. **Boundary integrity (paved road).** The rule belongs in the tier the matrix permits, behind the existing ports, so the boundary gates remain the guard rather than an obstacle to route around.
6. **Honest surfaces (reachability and gates).** A new family that cannot be advertised or documented is not delivered, and a gate that forces a dated snapshot to change is a gate that lies about history.
7. **Solo-maintainer cost.** No new package, no new subpath, no new dependency, no new record kind, and no new error identity.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — GH-288 DEC-19 delegates authoring; plan phase 1 item 1.0.
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-288 PR review. AI does not accept this R2 record.
- **Contributors:** `@spec-writer` (F-1, F-6, F-9, DM-1…DM-3, §15, §15.1); `@plan-writer` (phase ordering); `@decision-advisor` (repository analysis and record).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-288; the owner for final acceptance of this record.
- **Performers:** `@coder` — contracts module, app-tier policy, adapter seams, composition consumption, gates, and tests across plan phases 1–4.
- **Informed:** the M2-S4 board and every M2 story that attributes state to a repository; the MCP serve surface; operators performing the one-step migration.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The production composition resolves one inline home-plus-brand state directory and opens the store with workspace id `default`. | FACT | `packages/cli/src/production.ts` 286, 309 (read 2026-11-11) | The store might already be repository-scoped; the layout decision would be void. | High |
| The MCP surface repeats the inline derivation instead of consuming a shared rule. | FACT | `packages/mcp/src/serve.ts` 90 (read 2026-11-11) | One fewer consumer to converge; the single-policy decision still stands. | High |
| An override-aware host-root helper exists, requires an absolute override, is exported from the core root entry, and has exactly one delivered consumer. | FACT | `packages/core/src/config/catalog.ts` 879–909; `packages/core/src/index.ts` 223; `packages/cli/src/edge.ts` 1400 (read 2026-11-11) | If several consumers existed, the override precedence would already be uniform and C-2 shrinks — but the store still would not honour it. | High |
| Store artifacts and derived documents are workspace-scoped only, and the colliding artifacts are keyed by ref alone. | FACT | GH-288 spec §2.1; `doc/spec/features/feature-state-layer.md` (read 2026-11-11) | Without ref-keyed collisions the isolation requirement would be weaker; it is not. | High |
| The app tier is the only core tier permitted to import `domain`, `config`, and `./contracts` together; `domain` → `config` is an error. | FACT | `.dependency-cruiser.cjs` 124–156 (read 2026-11-11) | If `domain` could import `config`, the policy could live lower and C-4's placement would be a preference rather than a gate. | High |
| Both CLI and MCP declare the core root entry `.` in `workspaceImports`. | FACT | `packages/cli/package.json` 27–34; `packages/mcp/package.json` 26–33 (read 2026-11-11) | A new subpath would be required, which C-4 forbids; the export shape would change. | High |
| The git common directory is shared by a repository's linked worktrees and by no second repository, and the delivered marker discipline is create-once, atomic, and `0600`. | FACT | `packages/adapters/src/repo/index.ts` 40–109; `packages/adapters/src/file/dispatch-identity.ts` 54, 85–110 (read 2026-11-11) | If the common directory were not repository-unique, identity would need a different anchor and the layout would change. | High |
| Both help gates hardcode a single M1 command page root, and the M2 command page for the new family already exists. | FACT | `scripts/checks/help-guide-coverage.ts` 15; `tests/checks/reference-page-parity.test.ts` 32; `tests/fixtures/help-guide/coverage.json` (read 2026-11-11) | If the gates already resolved a per-command root, the page-root decision would be a no-op; they do not. | High |
| The shell fallback resolves state by its own precedence and searches at most two levels for the derived authority document. | FACT | `scripts/lib/dispatch-authority.sh` 52–61, 94–108 (read 2026-11-11) | A deeper document could be invisible to the fallback, which is the unsafe direction; C-2 and AC-F6-5 exist for this. | High |
| The enumerated consumers are the complete set of state-deriving surfaces. | ASSUMPTION | Bounded repository search (2026-11-11); GH-288 §16 component list | An unenumerated surface would keep reading the old root and silently report empty state; the structural assertion, not the list, is the guard. | Medium-High |
| The derived authority document's depth under a project root stays inside the fallback's two-level search. | TO-CONFIRM | GH-288 AC-F6-5 owns the proof | The fallback would report `dual-run` after an engine handover, so both stacks could claim authority. | Medium |
| Declaring the host-index artifact name and schema identity in the contracts tier lets the legacy detector exclude the index by name rather than by shape. | ASSUMPTION | GH-288 §12; DM-2 | The legacy predicate would have to match a shape, which is brittle against a future host-level file. | High |
| The state-layer store facade accepts an injected state directory per open and creates missing parents, so no state-layer change is needed to open a store at a deeper root. | ASSUMPTION | GH-288 §12; delivered store facade | A deeper root would need a state-layer change, which C-1/NG-1 forbid; the layout would have to be reconsidered. | Medium-High |

## Mental Models & Techniques Used

- **First principles:** What must be true for two checkouts never to see each other's state? Disjoint roots, plus a name for a repository that is both stable across rename/move and unique among clones. Every decision here follows from those two requirements; nothing about the record contract has to move.
- **Inversion:** What would make isolation unsafe? A key derived from the current path (a rename forks the project), a key derived from the remote (two clones merge), a per-repository workspace re-key (migration becomes a rewrite), a per-project rule applied at one site (one repository's state splits in two), and a page appended to a dated snapshot (the snapshot lies). C-1, C-2, C-3, and C-5 exclude exactly those failures.
- **Second-order thinking:** The layout is the durable part of this decision. Every future host-level artifact must now choose a layer, and every future command family inherits the per-command page root, so deciding the layers and the mapping once removes a recurring placement argument.
- **Systems thinking:** Root, identity, policy, and gates are one chain: a root named after a key is only as stable as the key; the key is only as stable as its marker; the marker is only reachable through a policy that is only effective if every surface uses it. Weakness anywhere in the chain restores the original collision.
- **Opportunity cost:** Placing the policy in `domain` looks cheaper (no new file in `app`) but fails `tier-domain-only-contracts` in the same phase; re-keying the workspace looks cheaper than adding a root layer but converts a move into a rewrite and breaks pinned document names.
- **Constraint-first elimination:** Every alternative is screened against the constraints before any driver ranking, so no attractive option can win while violating a `negotiable: no` gate.
- **Paved road / KISS:** Reuse the exported core root entry, the delivered marker discipline, the delivered override contract, the existing gates, and the existing store facade. No new package, subpath, dependency, record kind, or error identity.
- **Reversibility:** The layout is a path, the marker is one file, the page root is a mapping. Reverting the change restores single-root behaviour, and a migrated host is restored by the inverse move because nothing was rewritten.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails. Every constraint is `negotiable: no`, so no accepted-risk exception exists and no driver score rescues a failing option.

| | C-1 contract | C-2 one host root | C-3 marker identity | C-4 app-tier policy | C-5 gate parity | C-6 vocabulary | C-7 move migration |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 do nothing | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| ALT-1 re-key the workspace per repository | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| ALT-2 one host root per repository, remote-derived key | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| ALT-3 two-layer root, path-derived key, per-site policy, M1 page | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| ALT-4 selected: two-layer root, marker key, one app-tier policy, per-command page root | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-5 as ALT-4 but a new core subpath for the policy | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |

### Alternative 0 — Do Nothing / Keep the User-Scoped Store

- **Eligibility:** Not eligible (fails C-2, C-3, C-4).
- **Summary:** Keep one store per user under the inline home-plus-brand directory, with workspace id `default` and ref-keyed documents and queue entries.
- **Constraint compliance:** Passes C-1, C-5, C-6, C-7 trivially by changing nothing; fails C-2 (two of three derivation sites ignore the override and the store is not one of the override-aware ones), C-3 (no durable repository identity exists at all), and C-4 (three derivation sites, no single policy).
- **Driver fit:** Fails driver 1 outright; drivers 2 and 3 are moot; driver 4 is inverted because three sites are exactly the problem.
- **Pros:** Zero change, zero migration, zero risk of a wrong move.
- **Cons:** The same-ref collision stands: two checkouts can observe and mutate each other's phase state and queue entries, and no surface can report the contamination.
- **Why rejected:** It fails the change's reason to exist and leaves one host-wide ledger serving every repository.

### Alternative 1 — Re-Key the Workspace per Repository

- **Eligibility:** Not eligible (fails C-1, C-2, C-3, C-4, C-7).
- **Summary:** Keep one host root and open the store with a per-repository workspace identifier derived from the checkout, so `documents.<workspace>/`, `ledger.<workspace>.jsonl`, and the rest separate by name.
- **Constraint compliance:** Fails C-1 (every artifact and derived document is renamed, so the layout and its pinned names change), C-7 (a populated store cannot be moved into the new naming without rewriting it), C-2 and C-4 (the derivation still happens per site), and C-3 (the identifier would be path- or remote-derived).
- **Driver fit:** Serves driver 1 only by spending driver 2 entirely; drivers 4 and 5 are violated.
- **Pros:** One root, no new directory layer, and the collision disappears in the short term.
- **Cons:** Every consumer that pins a document name or a key prefix must change; migration becomes a rewrite of state files, which the contract forbids; the delivered audit chain and retro reads would have to be re-established.
- **Why rejected:** It buys isolation by discarding the contract-preservation property that makes this change cheap and reversible.

### Alternative 2 — One Host Root per Repository, Key Derived from the Remote

- **Eligibility:** Not eligible (fails C-2, C-3, C-4).
- **Summary:** Give each repository its own top-level state directory named from its normalized remote identity, leaving the single delivered root as a legacy location.
- **Constraint compliance:** Passes C-1 (layout inside a root is untouched), C-5, C-6, and C-7 (a new per-repository directory is still reached by a move). Fails C-3 (two clones of one remote collapse into one project — the exact collision class this change removes), C-2 (the override names one root, not N roots, so precedence has to fork per site), and C-4 (the rule is still composed per surface).
- **Driver fit:** Fails driver 3 (clone semantics wrong) and driver 1 for the clone case; driver 4 is unaddressed.
- **Pros:** No project container and no host index; the state root is human-recognizable.
- **Cons:** Clones share state; the override becomes ambiguous; a host overview has no single root to enumerate.
- **Why rejected:** A remote identity describes where a repository came from, not which checkout it is, and the override contract cannot name a set of roots.

### Alternative 3 — Two-Layer Root with a Path-Derived Key and Per-Site Policy

- **Eligibility:** Not eligible (fails C-2, C-3, C-4, C-5).
- **Summary:** Add `<host root>/projects/<project key>` where the key is the sanitised current checkout basename, leave each surface to derive the root, and place the new family's page in the M1 snapshot.
- **Constraint compliance:** Passes C-1, C-6, C-7. Fails C-3 (a rename changes the key and therefore the state root, and two same-basename checkouts collide), C-2 and C-4 (no single rule, no single policy), and C-5 (editing a dated snapshot instead of declaring a page root).
- **Driver fit:** Fails drivers 1, 3, 4, and 6; only driver 2 is served, and it is undermined the first time a checkout is renamed.
- **Pros:** The smallest visible change to the delivered tree: no new marker, no new policy module.
- **Cons:** State silently forks on rename and collides on a shared basename; the split-state risk becomes routine; the milestone snapshot stops being a record.
- **Why rejected:** It reproduces the collision in a new location and adds a second failure mode (silent forking) to the one it removes.

### Alternative 4 — Selected: Two-Layer Root, Marker-Minted Key, One App-Tier Policy, Per-Command Page Root

- **Eligibility:** Eligible.
- **Summary:** Keep the delivered host root, add `<host root>/projects/<project key>` and `<host root>/host-index.json` (`delivery.projects.host-index.v1`), mint the key once into a create-once `0600` marker in the checkout's git common directory, implement the whole rule as one pure app-tier policy exported from the existing core root entry, and teach both help gates a per-command page root so the M2 page serves the M2 command while the M1 snapshot stays untouched.
- **Constraint compliance:** Passes C-1…C-7 (matrix above). The contract is untouched and the workspace identifier stays `default` (C-1); the host root has one implementation and one override precedence (C-2); identity is minted once from the common directory and stable across rename, move, and worktree use (C-3); the policy is a pure app-tier function exported from `.` with I/O behind adapter ports (C-4); both gates resolve a per-command page root and the snapshot is unchanged (C-5); no identity, record kind, or hardcoded name is added (C-6); migration stays a reversible move on both layers (C-7).
- **Driver fit:** Best on every driver: isolation is structural (1), the contract and the move survive (2), identity matches operator expectation for clones and worktrees (3), one place to change (4), the tier matrix stays the guard (5), the family is advertised without rewriting history (6), and the cost is one policy, one marker seam, one index seam, and gate wiring (7).
- **Pros:** No contract change; a same-tree, reversible migration; a single policy that a structural assertion can pin; the delivered marker discipline reused rather than reinvented; the milestone snapshot stays a record.
- **Cons:** Every surface must be updated in one change, because a partially applied rule splits state; one more host-level file (the index) and one more derived cache to maintain; the key carries an opaque discriminator; deleting a marker re-mints a new key and orphans the old root.
- **Why chosen:** It is the only alternative that satisfies every `negotiable: no` constraint, and it does so by adding structure where the contract is silent (the root, the identity, one policy, the gate mapping) rather than by changing anything the contract already fixes.

### Alternative 5 — As ALT-4, but the Policy Ships as a New Core Subpath

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Implement the same rule in the app tier but expose it as a new declared subpath (for example a dedicated state-scope entry) instead of the existing root entry.
- **Constraint compliance:** Passes C-1, C-2, C-3, C-5, C-6, C-7. Fails C-4: one function does not justify a second declared import surface, both host packages already declare `.`, and a new subpath adds an entrypoint inventory, a declaration, and a parity obligation for no semantic gain.
- **Driver fit:** Identical to ALT-4 on correctness; weaker on driver 7 (surface growth) and driver 5 (the paved road is the existing root entry).
- **Pros:** A narrower import surface in principle.
- **Cons:** A new subpath must be declared, inventoried, and kept in parity for one pure function; consumers that already import `@delivery-os/core` gain a second specifier for the same module family.
- **Why rejected:** It is the same decision with strictly more surface, and the constraint against a new subpath is explicit.

## Decision

- **Decision:** Adopt **ALT-4**, recorded as four decisions that bind together. Each names the GH-288 decision it adopts.

  1. **D-1 — Durable workstation state layout (GH-288 DEC-1).**
     - The **host root** keeps the delivered resolution rule: an absolute `<PREFIX>_STATE_DIR` override wins outright; otherwise the injected home plus `brand.stateDirectoryName`. A relative override is `config.value.invalid`. The default remains brand-derived, so no product name is spelled anywhere.
     - Beneath it, a **project state root** is `<host root>/projects/<project key>`.
     - The **host index** is `<host root>/host-index.json`, schema identity `delivery.projects.host-index.v1`, with its artifact name and schema identity declared in the `projects` contracts module so no consumer spells the literal.
     - The host root holds the host index, the project container, the host-wide owner-hold marker, and the declared `unbound` scope — nothing else.
     - **Consequence for later changes:** every future host-level artifact lives either at the host root or inside a project root; the move-never-rewrite migration rule applies to both layers; and the state layer's record contract, schema version, workspace identifier `default`, and file layout are unchanged, because isolation comes from the root. A future artifact that cannot name its layer must be decided as a placement question rather than added to whichever directory is convenient.

  2. **D-2 — Project identity minted from the checkout identity marker (GH-288 DEC-3).**
     - Identity is minted once, at first registration, into a **checkout identity marker** inside the checkout's git **common** directory: create-once, written atomically through a synced sibling plus a link, mode `0600`, never rewritten, shared by every linked worktree of that repository, and travelling with a rename or move. The marker carries the project key, the project identifier, and the mint-time basename under a declared schema identity.
     - The project identifier is a random 128-bit value minted with the key, rendered as lowercase hexadecimal. The key has the shape `<sanitised mint-time basename>-<first eight lowercase hex of the project identifier>`.
     - Basename sanitisation: lowercased, every run outside `[a-z0-9]` collapsed to one `-`, leading and trailing separators stripped, bounded to 32 characters, with the constant `project` as the fallback when nothing survives, and `unbound` refused as a basename. The key is validated as a single path segment before use, so it cannot escape the project container.
     - The key is never derived from a path or a remote. A missing marker mints one; an unreadable or internally inconsistent marker is an identity refusal rather than a re-mint, because a silent re-mint would orphan the existing state root.
     - **Consequence for later changes:** any future surface that needs a repository's durable identity must read the marker rather than derive one from a path, a remote, or a recorded string. A surface that cannot reach a checkout's git metadata cannot obtain this identity at all.

  3. **D-3 — One state-scope policy in the core app tier (GH-288 DEC-12).**
     - The rule — host root, project state root, `unbound` scope, key minting and marker validation — is implemented once at `packages/core/src/app/state-scope.ts`, as a runtime-neutral pure function over injected facts (host-root inputs, the resolved checkout facts, and the marker and index facts).
     - The app tier is the only core tier permitted to import `domain`, `config`, and `contracts` together: `tier-domain-only-contracts` forbids `domain` → `config`, so a policy consuming the host-root rule cannot live in `domain`. Filesystem and git reads stay in the adapter tier behind injected ports.
     - It is exported from the existing `@delivery-os/core` root entry. No new workspace package and no new subpath; both host packages already declare `.`, and the workspace-entrypoint checks keep every imported subpath declared.
     - Every surface that opens a store or derives a state path consumes it: the CLI production composition, the MCP serve composition, the runtime-aware edge's audit store, the daemon settings composing site, the dispatch state root, the retro sidecar, the owner-hold read, and the CLI-independent shell fallback. The owner-hold read consumes the policy only for the host root and stays host-wide.
     - **Consequence for later changes:** a new surface may not derive a state path itself. The boundary rules and a structural assertion pin the single policy, so a bypass is a red gate rather than a silent second home for the rule.

  4. **D-4 — Help gates resolve a per-command reference-page root (GH-288 DEC-13).**
     - The help-coverage gate and the reference-page parity gate resolve each command's page through a declared per-command reference-page root instead of a single hardcoded milestone segment. The M2 command page for the new family therefore serves an M2 command, and every M1 milestone-snapshot page stays byte-unchanged.
     - The coverage inventory gains the new page in the same unit as the prompt-required entry, because adding a command to the prompt set before its page and inventory exist turns both gates red in both directions.
     - The page keeps its `--help` and `--version` contract and the milestone pack's own status semantics; only the gate's resolution changes.
     - **Consequence for later changes:** a new command family places its page in its own milestone page root rather than editing an earlier snapshot. A family that instead edits a snapshot has bypassed the mapping and the gate must be strengthened.

- **Rationale (tied to drivers):** D-1 puts isolation where the contract is silent and keeps migration a move (drivers 1, 2). D-2 makes the identity stable across rename, move, and worktree use and distinct between clones by construction, which is the only way the root can stay put (driver 3) and the only way distinctness stops depending on operator care (driver 1). D-3 gives the rule one home in the tier the matrix permits, so a per-repository rule cannot be applied at one site and forgotten at another (drivers 4, 5) and so a structural assertion can pin it (driver 1). D-4 makes the family reachable without rewriting a dated snapshot (driver 6). All four add structure only where nothing is yet fixed, which is what keeps the cost at one policy, two adapter seams, and gate wiring (driver 7).
- **Record type:** TDR per GH-288 DEC-19. The `blast_radius: team` classification was weighed against the guide's ADR tie-breaker; the record is a TDR because it fixes implementation shape — directory layout, identity minting, module placement, gate wiring — inside the delivered architecture, and changes no interface contract of a delivered surface: the state schema, record kinds, key prefixes, and the delivered commands' envelopes and exit projections are all unchanged. The new command family's own contract is decided elsewhere in GH-288.
- **Decider:** Juliusz Ćwiąkalski (owner).
- **Authorization:** Status `Proposed`. Human acceptance is recorded at the GH-288 PR review; AI does not accept this R2 record and grants no authority until then. On acceptance, `decision_date` is set and a `review_date` is fixed for the first post-implementation retrospective.
- **Conditions for revisit:** See `revisit_triggers`; the first GH-288 post-implementation retrospective confirms that one policy implementation exists, that no surface derives a state path beside it, that the M1 snapshot pages are unchanged, and that identity survives a rename, a move, and a worktree invocation.

### Constraint Compliance Attestation

The chosen alternative (ALT-4) satisfies every constraint C-1 through C-7. No accepted-risk exceptions are taken and no constraint is violated.

| Constraint | Attestation |
|---|---|
| C-1 | The store is opened at a deeper root with the delivered artifact set, modes, workspace identifier `default`, and schema version; nothing inside a root is renamed or re-keyed. |
| C-2 | The host-root rule has one implementation (the app-tier policy) and every store-opening surface consumes it, including the store, the MCP surface, and the runtime-aware edge; a relative override classifies as `config.value.invalid`. |
| C-3 | The key is minted once into the common-directory marker (atomic sibling plus link, `0600`, never rewritten) and is never path- or remote-derived; the discriminator makes same-basename checkouts distinct by construction. |
| C-4 | The policy is a pure function in `packages/core/src/app/state-scope.ts`, exported from the existing `@delivery-os/core` root entry, with I/O behind adapter ports and no new package or subpath; `tier-domain-only-contracts` is respected because `domain` is untouched. |
| C-5 | Both gates resolve a per-command page root; the new page is registered and carries `--help` and `--version`; the M1 snapshot pages are byte-unchanged (review-verified diff). |
| C-6 | The record adds no error identity and no state record kind; the declared `projects.*` identities from GH-288 DM-6 are reused, and every name resolves from the injected brand identity. |
| C-7 | Migration is a same-tree directory move preserving bytes and modes on both layers, reversible by the inverse move; the host index, owner-hold marker, project container, and `unbound` scope are excluded from the moved set. |

## Trade-offs & Consequences

### Positive Outcomes

- Two checkouts of different repositories can no longer observe or mutate each other's phase state, queue entries, leases, or derived documents for the same ref, and the isolation does not depend on the operator remembering anything.
- The state contract is untouched, so migration is a reversible directory move and the audit chain and retro reads survive it.
- Project identity matches operator expectation: one project per clone and all of its worktrees, distinct projects for distinct clones, and an unchanged state root after a rename or move.
- The host-root rule has one home, so the delivered override finally reaches the store and a future surface has one obvious consumer path.
- A new command family can be advertised and documented without editing a dated milestone snapshot.

### Negative Outcomes

- The change is all-or-nothing: a partially applied policy splits one repository's state across two roots, which is worse than the collision it replaces, so every enumerated surface must land in the same change.
- The host root gains a second host-level file (the index) and a derived cache that must be maintained within declared bounds.
- The project key carries an opaque eight-character discriminator; it is stable and unique but less readable than a bare slug.
- Deleting or replacing a marker re-mints a new key and orphans the previous state root, so the marker is load-bearing evidence that the operator must not delete.
- The shell fallback's documented search depth is now a correctness dependency, not an incidental detail.
- The gates gain a mapping concept (command → page root) that a future family can bypass if it edits a snapshot instead.

### Unresolved Questions

- [ ] Whether the derived authority document's depth under a project root stays inside the fallback's two-level search; AC-F6-5 owns the proof (owner: `@coder`, GH-288 delivery).
- [ ] Whether the enumerated consumer set is complete; the structural assertion in AC-F6-1 is the guard rather than the enumeration itself (owner: `@coder`, GH-288 delivery).
- [ ] Whether any future host-level artifact is needed at the host root beyond the index and the owner-hold marker; each such proposal is a placement decision under D-1, not an addition (owner: future named need).

## Implementation Plan

1. **Contracts:** declare the state-scope vocabulary once in `packages/core/src/contracts/projects.ts` — the identity-marker schema identity and field shape, the host-index artifact name and `delivery.projects.host-index.v1`, the project container and `unbound` segments, the key bounds (basename cap, fallback, discriminator length, single-segment pattern), and the `projects.*` identities GH-288 DM-6 declares. Types and constants only; no behavior and no product literal.
2. **App-tier policy:** add `packages/core/src/app/state-scope.ts` as the single implementation of the host root (absolute override wins, relative override is `config.value.invalid`, otherwise injected home plus brand state-directory name), the sanitised basename, the discriminator, the key shape, the project state root, the host-index path, and the `unbound` scope. It reads no filesystem, git, clock, or process environment; marker and index facts arrive through injected ports. Export it from the existing `@delivery-os/core` root entry and from the app tier's aggregate module.
3. **Adapter seams:** keep the git and filesystem reads in the adapter tier — the checkout resolution already returns the git and common directories, and the project identity marker follows the delivered dispatch-identity discipline (exclusive `0600` sibling, link into place, read-and-validate, never rewrite). The marker seam is separate from the dispatch identity marker: one records a repository's durable state identity, the other a normalized remote identity.
4. **Composition consumption:** route the CLI production composition, the runtime-aware edge audit store, the dispatch state root, the retro sidecar, and the coordinator state through the policy; the owner-hold read consumes it for the host root only and stays host-wide. The MCP serve composition and the daemon settings composing site consume the same policy, and the CLI-independent shell fallback resolves the project state root with its override precedence unchanged and its search depth not widened. Remove the duplicate host-root derivation so exactly one home-plus-brand composition and one override precedence remain.
5. **Gates:** give the help-coverage gate and the reference-page parity gate a per-command reference-page root, register the new family's page, and keep every M1 milestone-snapshot page untouched. The prompt-required entry, the help entries, the coverage entry, the page root, and the page land as one unit.
6. **Tests:** carry the isolation contract — per-test host root, a home distinct by construction, the brand-derived override, a pre-write guard, and a leak fingerprint — plus identity stability across nested invocation, linked worktree, rename, and move; key distinctness for same-basename checkouts; single-policy structural assertions; and gate parity including the snapshot-unchanged half.
7. **Docs:** the phase-7 reconciliation states the two-layer state root and names the host index as the only host-wide *index* document (the owner-hold marker also lives at the host root), states that the store now honours the override, names the state directory name as naming the host root, and states that the authority document is read under the project root.

## Verification Criteria

- Metric: cross-repository isolation — phase documents and queue records for one ref under two project roots are disjoint file and key sets, and no surface observes the other's state. Target: 0 shared artifacts, 0 cross-observed documents. Window: GH-288 CI (AC-F1-1, AC-F1-2).
- Metric: identity stability — identical key and state location across a nested invocation, a linked worktree, a rename, and a move; distinct keys for two same-basename checkouts. Target: 100% (AC-F1-3, AC-F1-4, AC-F1-6).
- Metric: single policy — exactly one state-scope implementation, in the app tier, exported from the core root entry, with 0 inline home-plus-brand compositions and the override honoured at every store-opening site. Target: 1 implementation, 0 bypasses (AC-F6-1).
- Metric: write placement — every store artifact produced by `phase complete`, `queue add`, `commit`, and `dispatch` exists under the project root, and no store artifact exists at the host root. Target: 100% (AC-F6-2).
- Metric: surface parity — the MCP surface and the CLI open the identical project root for one checkout. Target: identical (AC-F6-3).
- Metric: gate parity with snapshot immutability — both help gates green, the new page registered with `--help` and `--version`, and every M1 snapshot page byte-unchanged. Target: exact (AC-F9-2; the snapshot half review-verified against the merge base).
- Metric: migration integrity — every store artifact byte-identical with its original mode after the move, audit chain verifies, retro sidecar reads, inverse move restores pre-migration reads. Target: 0 content changes (AC-F8-1).
- Metric: vocabulary stability — no new error identity beyond the declared `projects.*` set, no new state record kind, no new workspace package, no hardcoded product or binary literal. Target: exact set equality (AC-F9-3, AC-F9-4).

## Confidence Rating

**High** for the layout, the identity mechanism, and the policy placement: every input is verified in delivered source — the inline compositions, the unused override helper, the tier matrix, the declared root entry, the checkout resolution, the marker discipline, and the gates' single hardcoded page root — and the spec fixes these four decisions with testable acceptance criteria.

**Medium-High** for the completeness of the consumer set and the fallback's depth assumption: the enumeration is bounded by repository search and by the change's component list, and the depth question is proven by AC-F6-5 rather than by inspection. Neither gap changes the decision; both are the reasons the structural assertion and the fallback test exist. AI-generated confidence is not evidence, and the human decider owns acceptance.

## References

- GH-288 change spec (F-1, F-6, F-9, DM-1…DM-3, §15 DEC-1/DEC-3/DEC-12/DEC-13, §15.1, AC-F1/AC-F6/AC-F8/AC-F9): `doc/changes/2026-11/2026-11-11--GH-288--multi-repo-workstations/chg-GH-288-spec.md`
- GH-288 delivery plan (phase 1 item 1.0 authors this record before dependent code): `doc/changes/2026-11/2026-11-11--GH-288--multi-repo-workstations/chg-GH-288-plan.yaml`
- Current system spec (state root and store layout): `doc/spec/features/feature-state-layer.md`
- Current system spec (prompt-required composition and help surface): `doc/spec/features/feature-cli-entrypoint.md`
- Current system spec (brand-derived directory name): `doc/spec/features/feature-branding-seam.md`
- Delivered seams: `packages/cli/src/production.ts`, `packages/cli/src/edge.ts`, `packages/mcp/src/serve.ts`, `packages/core/src/config/catalog.ts`, `packages/core/src/index.ts`, `packages/adapters/src/repo/index.ts`, `packages/adapters/src/file/dispatch-identity.ts`
- Delivered gates: `scripts/checks/help-guide-coverage.ts`, `tests/checks/reference-page-parity.test.ts`, `tests/fixtures/help-guide/coverage.json`
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — monorepo structure and the core tier matrix that places the policy in the app tier
- [TDR-0004](TDR-0004-state-storage-engine.md) — state storage engine; the artifact layout this record opens one directory deeper and does not change
