---
id: TDR-0034
decision_type: tdr
status: Proposed
created: 2026-11-17
decision_date: null
last_updated: 2026-11-18
summary: "GitHub Issues transition mapping reuses the existing core `WorkflowMap` contract as declared, injected construction data on `createGitHubClient`, seeded with this repository's lifecycle labels, validated by a confined adapter validator — no new configuration schema, no new file format, and no per-project config branch before M3-S6 owns that layer."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider adapters (GitHub reference adapter) and core adapter contracts"
decision_scope: repo
review_date: null
business_impact: "GitHub Issues lifecycle transitions become reviewable declared data instead of adapter improvisation, so the reference adapter is a real backlog tracker and the per-project configurability M3 EC-2 requires has a concrete, testable home without inventing a configuration schema ahead of the story that owns it."
customer_impact: "An operator gets GitHub Issues states that reflect the lifecycle labels this project actually uses, and a transition that refuses a state the mapping does not declare instead of silently closing or mislabelling a ticket."
classification:
  domains: [architecture, contracts, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: medium
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-338: the specification is blocked on where the mapping lives)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-338 PR review; AI does not accept this R2 record"
  contributors:
    - "@decision-advisor (repository analysis and this record)"
    - "@pm (GH-338 clarify_scope: applied default Q-04 — project-configurable mapping seeded with this repository's labels)"
    - "@readiness-reviewer (GH-338 DoR iteration 1: F4 label-rule scope, F5 read-outcome rule; iteration 2: R7 validator rejection set) — F4 and F5 corrected in §3 on 2026-11-17; R7 recorded in §1 on 2026-11-18"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-338 PR review — this record fixes how project-specific provider data enters an adapter)"
  performers:
    - "@coder (GH-338 delivery: the seeded map, its validator, the injected option, normalization and transition wiring, fixtures)"
    - "@doc-syncer (provider-client-seeds capability and mapping tables, adapter-ports note)"
  informed:
    - "M3-S6 multi-tracker per project (owns per-project tracker composition in configuration)"
    - "M3-S2 Jira adapter completion (its `WorkflowMap` stays a module constant until the config layer exists)"
    - "M3-S5 adapter conformance and parity suite"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "M3-S6 opens the configuration layer for per-project tracker composition: decide then whether the map is loaded from project configuration and validated at startup, and whether Jira's module constant migrates to the same source. This record does not pre-empt that."
  - "A project needs a delivery alias the seed does not map (notably `canceled`): decide an additive representation for GitHub's terminal state+reason pair rather than overloading `field-update` or inventing a hidden convention."
  - "A project models completion as a label rather than issue closure, so its `done` row is not the `field-update` row on `closed` (§1 rejects such a map at construction): decide whether the terminal write gains a label representation or a project-specific terminal mechanism, rather than widening the validator to accept a map the delivered closeout write cannot resolve."
  - "A product need arises to write a declared non-terminal `field-update` alias (for example `ready`, or an injected `open` → `backlog` row): decide whether the mechanism gains label displacement or the alias gains a `label-swap` representation. Do not add a label read to `field-update`; that is the widening §3.2 exists to prevent."
  - "A third adapter needs the same map validation: promote the validator to a shared home instead of copying it a third time."
  - "A provider exposes a native status field that is neither an issue state nor a label (GitHub Projects single-select status does): decide whether a token kind is added, rather than silently accepting an ambiguous token."
links:
  related_changes: ["GH-338"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-17--GH-338--github-adapter-completion/chg-GH-338-pm-notes.yaml"
    - "doc/spec/features/feature-adapter-ports.md"
    - "doc/spec/features/feature-provider-client-seeds.md"
    - "doc/spec/features/feature-adapter-conformance.md"
  contracts:
    - "packages/core/src/contracts/ports.ts"
    - "packages/adapters/src/jira/workflow-map.ts"
    - "packages/adapters/src/github/review-state.ts"
    - "packages/core/src/config/catalog.ts"
  diagrams: []
  decisions: ["ADR-0003", "ADR-0006", "TDR-0003"]
  experiments: []
  metrics: []
  roadmap_items: ["M3-S4", "M3-S2", "M3-S6", "M3-S5"]
---

# TDR-0034: GitHub Issues Transition Mapping — The Core `WorkflowMap` as Injected, Seeded Construction Data

## Context

- **FACT:** Core already declares the mapping contract: `WorkflowMap = { systemName, states: readonly { nativeStatus, deliveryState, transitionMechanism }[] }`, with `DeliveryStateAlias` closed to `backlog | ready | in-progress | in-review | done | canceled` and `WorkflowTransitionMechanism` closed to `api-transition | field-update | label-swap | manual` (`packages/core/src/contracts/ports.ts`, read 2026-11-17).
- **FACT:** Jira consumes that contract as a module constant: `JIRA_WORKFLOW_MAP` is declared data imported directly by `createJiraClient` (not a construction option), a confined `validateWorkflowMap` checks every row against the closed sets and rejects duplicate native statuses, and the done transition resolves the native status through the map before posting a transition id (`packages/adapters/src/jira/workflow-map.ts`, `packages/adapters/src/jira/client.ts`, read 2026-11-17).
- **FACT:** GitHub's delivered issue-status truth is a local two-row table with no mechanism field and no validation: `GITHUB_WORK_ITEM_STATUS_MAP = [{ open → ready }, { closed → done }]`, consumed by `workItemStatusFor` inside normalization (`packages/adapters/src/github/review-state.ts`, read 2026-11-17).
- **FACT:** Both adapters narrow the write to one alias: the GitHub and Jira clients declare `transitionWorkItem({ …, deliveryState: "done" })`, and the core closeout write port also narrows to `"done"` (`packages/adapters/src/github/client.ts`, `packages/adapters/src/jira/client.ts`, `packages/core/src/contracts/closeout.ts`, read 2026-11-17).
- **FACT:** The production configuration catalog has no adapter, tracker, or external-system branch at all — its branches are `provider`, `commit`, `merge`, `harness`, `verify`, `metrics`, `lane`, `queue`, `daemon`, `coordinator`, `poll` (`packages/core/src/config/catalog.ts`, read 2026-11-17).
- **FACT:** GitHub addressing is not configured either: `createGitHubClient` receives `repository: { owner, name }` as injected construction data, and the CLI edge derives it by parsing the git origin remote (`packages/cli/src/edge.ts`, read 2026-11-17).
- **FACT:** This repository's lifecycle conventions live in project-local agent configuration, not in a configuration schema: `.ai/agent/pm-instructions.md` maps PM phases to GitHub issue state plus a declared label set (`change`, `planning`, `spec-ready`, `readiness-passed`, `in-progress`, `review`, `delivered`, `blocked`) (read 2026-11-17).
- **FACT:** The requirement exists in three places and is consistent: M3 EC-2 requires "transitions with configurable mapping"; the M3 README says "Jira workflow mapping is configurable per project"; GH-338's applied default Q-04 says the GitHub Issues lifecycle mapping is "project-configurable and seeded with this repository's label conventions" (M3 README, GH-338 pm-notes, read 2026-11-17).
- **FACT:** The M3 answered question on workflow mapping confirms configurability per project with project-specific mappings and multi-tracker coexistence (`doc/planning/oss-tooling/milestones/m3/open-questions.md` OQ-M3-06, read 2026-11-17).
- **FACT:** M3-S6 owns "per-project tracker composition in configuration" — a dependency of this story, not a deliverable of it (`doc/planning/oss-tooling/milestones/m3/README.md`, read 2026-11-17).
- **FACT:** Provider subpath exports are pinned exactly by `tests/structure/provider-surface.test.ts`, and per-file executable exports by `tests/structure/content-inventory.test.ts` (read 2026-11-17).
- **FACT:** ADR-0003 confines each adapter subpath: an adapter imports core by declared subpath only and never another adapter, so a shared validator cannot live in one adapter and be imported by another (`.dependency-cruiser.cjs`, read 2026-11-17).

## Problem Framing (Clarified)

The question is not whether the mapping should be data — it already is, twice. The question is **which tier owns project-specific provider data, and how early that tier is created.**

1. **A representation already exists and is under-used.** `WorkflowMap` was built for exactly this: a native status, a closed delivery alias, and the mechanism that performs a transition. Jira uses it read-side and for its done write. GitHub uses a two-row local analogue that cannot express a label-based status or a mechanism.
2. **GitHub has no native status beyond open/closed, so status is derived.** In this repository a change ticket's lifecycle position is a label. A mapping that only knows `open` and `closed` cannot express "in progress" or "in review", so a configurable mapping whose only load-bearing row is `closed` is decoration, not configurability.
3. **The configuration layer does not exist for adapters, and creating it here would be a different story.** There is no `tracker`, `adapters`, or `externalSystems` config branch, no adapter settings type, and no startup validation path for one. Adding that branch is not a schema tweak: it is the first project-level adapter configuration surface, and M3-S6 is the story chartered to design per-project tracker composition (instances, routing, references).
4. **The requirement is real, so "hard-code it" is not available.** Three sources require configurability. What varies is *when* an operator can change it without a code change — which is a configuration-layer question, not an adapter-representation question.

The unifying principle this record adopts: **an adapter consumes provider-specific declared data through its construction input, and the configuration layer is a separate, later decision about where that data is read from.** It is not a new rule — `repository` is already injected that way, Jira's map is already declared data — but stating it separates "representation" (decided here) from "configuration surface" (M3-S6).

## Constraints (Hard Requirements)

### C-1: The mapping stays declared, reviewable data — never an inference

- **Statement:** Every delivery alias the adapter can read or write must be resolvable to exactly one declared row; no alias may be produced or written by a heuristic, a default, or a hidden convention, and an alias the map does not declare must be refused visibly.
- **Source:** ADR-0006 mapping-discipline precedent ("declared, reviewable adapter data"); Jira `WorkflowMap` read-side failure discipline.
- **Verification:** Test — every declared alias resolves; an undeclared alias is a typed refusal naming the alias; no code path derives an alias from labels outside the map.
- **Negotiable:** no.

### C-2: No new configuration schema in this change

- **Statement:** This change adds no configuration catalog branch, no settings type, no new config key, no new file format, and no new `ConfigErrorCode`; the only new input is a construction option on the adapter.
- **Source:** TDR-0003 (config schema ownership); M3-S6 scope ("per-project tracker composition in configuration"); GH-338 story boundary.
- **Verification:** Review — `PRODUCTION_CATALOG` unchanged; `pnpm typecheck` and the config contract/structure tests unchanged; no new file under `doc/templates/` or project config paths.
- **Negotiable:** no.

### C-3: Additive within v1 — no core contract change, no operation change

- **Statement:** No core contract type is added, retyped, or made required; `ADAPTER_OPERATIONS` and every capability declaration are unchanged; existing `createGitHubClient` call sites keep compiling and behaving.
- **Source:** Prior additive discipline (ADR-0004, ADR-0006, TDR-0008); adapter-ports evolution rule.
- **Verification:** Test — contract-inventory and capability-parity probes; `pnpm typecheck`; conformance registry unchanged.
- **Negotiable:** no.

### C-4: Adapter confinement and no new public surface requirement

- **Statement:** The map, its validator, and its seed live inside the GitHub subpath; the adapter imports no other adapter; nothing new is required on the pinned `./github` export surface.
- **Source:** ADR-0005; `.dependency-cruiser.cjs` matrix; `tests/structure/provider-surface.test.ts`.
- **Verification:** Test — pinned surface equality unchanged; dependency-cruiser green.
- **Negotiable:** no.

### C-5: Truthful read/write symmetry

- **Statement:** A transition the adapter performs must be observable by its own read path: after a mapped transition, re-reading the issue must yield the alias that was written, or the mismatch must be a named anomaly — never a silent ready/done collapse.
- **Source:** Capability honesty (TDR-0032 C-2 principle); Jira's mapped-transition precedent.
- **Verification:** Test — round-trip per mapped alias through the mock tenant and through normalization.
- **Negotiable:** no.

### C-6: No destructive or wildcard label behaviour

- **Statement:** A label-based transition may only change labels the map declares for lifecycle purposes, must refuse when the current label set is unobserved, must never send a single-token array, and must never remove a label it was not given: every other label of the caller-supplied current read is preserved. The rule binds `label-swap` rows and only `label-swap` rows; a `field-update` transition touches no label.
- **Source:** Delivered label-write discipline (GitHub `writeWorkItem` read-modify-write; "both label-writing adapters refuse an unavailable label signal").
- **Verification:** Test — an unavailable label signal refuses a `label-swap` write; every unrelated label of the supplied current read survives; only declared `label-swap` tokens change; the write never sends a single-token array; a `field-update` write issues zero label reads and zero label writes and cannot refuse on a label signal (§3.2).
- **Negotiable:** no.

### C-7: Story and parity obligations remain satisfiable

- **Statement:** GH-338's "GitHub Issues backlog primitives (read/update, comments, transitions)" must be deliverable and parity-testable through the production client, with the reference behavior documented in the adapter contract.
- **Source:** GH-338 AC; M3 EC-2/EC-4.
- **Verification:** Offline fixtures exercising read, update, comment, and transition; reference-behavior document.
- **Negotiable:** no.

## Decision Drivers

1. **Configurability with the smallest surface that delivers it.** The requirement is that a project can express its own mapping; the cheapest honest form is injected declared data.
2. **One representation across adapters.** A shared type makes mappings comparable and lets the parity suite hold adapters to the same shape; a second local type does not.
3. **Reference-implementation fidelity.** GitHub is the bar GitLab and Jira are compared against; a map that cannot express a label-based lifecycle is a weaker bar.
4. **Blast radius and sequencing.** The configuration layer is a story of its own; pulling it forward spends the change on plumbing the story does not need.
5. **Least privilege and reversibility.** Declared data plus a confined validator can be moved, validated harder, or replaced by config later; a hard-coded convention cannot.
6. **Truthfulness of read and write.** Whatever the map says must be what both directions do.
7. **Paved road.** Jira's `WorkflowMap` and the injected `repository` option are both delivered patterns.

*(Overlap check: refusal-on-undeclared-alias, no config schema, additive-within-v1, confinement, read/write symmetry, and label safety are gates (C-1…C-6) and appear here only as ranking values — "how much configurability per unit of surface" and "how well the shape survives sequencing". The gates decide eligibility; the drivers rank survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-338: the specification is blocked on this question).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-338 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (applied default Q-04, story boundary); `@decision-advisor` (analysis and record); `@spec-writer` (carry the seed and the resolution rule into the change spec).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-338; the owner for final acceptance.
- **Performers:** `@coder` (seed, validator, option, normalization and transition wiring, fixtures); `@doc-syncer` (mapping tables and reference behavior).
- **Informed:** M3-S6 (config-layer owner), M3-S2 (Jira map parity), M3-S5 (parity suite).

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| Core already declares `WorkflowMap`, a closed delivery-alias set, and a closed mechanism set. | FACT | `packages/core/src/contracts/ports.ts` (read 2026-11-17) | A new representation would be needed; the reuse option disappears. | High |
| Jira consumes the map as a module constant with a confined validator, and resolves its done transition through it. | FACT | `packages/adapters/src/jira/workflow-map.ts`, `client.ts` (read 2026-11-17) | The injection pattern would be unprecedented for adapters. | High |
| GitHub's delivered status truth is a two-row local table with no mechanism and no validation. | FACT | `packages/adapters/src/github/review-state.ts` (read 2026-11-17) | The mapping decision would already be settled. | High |
| Both adapter clients and the closeout write port narrow transitions to `done`. | FACT | `packages/adapters/src/github/client.ts`, `packages/adapters/src/jira/client.ts`, `packages/core/src/contracts/closeout.ts` (read 2026-11-17) | Transition breadth would already exist and only representation would remain open. | High |
| The configuration catalog has no adapter/tracker branch. | FACT | `packages/core/src/config/catalog.ts` (read 2026-11-17) | The config-schema option would be cheaper than assessed. | High |
| GitHub addressing is already injected as construction data derived from the git remote. | FACT | `packages/cli/src/edge.ts` (read 2026-11-17) | Injection would be a new composition pattern. | High |
| This repository's lifecycle labels are declared in project-local agent configuration, not in any schema. | FACT | `.ai/agent/pm-instructions.md` (read 2026-11-17) | The seed would have no authoritative source and would need to be invented. | High |
| Three sources require a configurable mapping. | FACT | M3 README/EC-2; GH-338 pm-notes Q-04; M3 OQ-M3-06 answer (read 2026-11-17) | The hard-coded option would be defensible. | High |
| M3-S6 owns per-project tracker composition in configuration. | FACT | M3 README story list (read 2026-11-17) | The config layer could be built here without pre-empting a story. | High |
| GitHub returns issue lifecycle labels on the issue payload, so a label-token row can be resolved on read. | FACT | `normalizeGithubIssue` reads `payload.labels` (read 2026-11-17) | Read-side derivation for label tokens would be impossible and the seed would collapse to two rows. | High |
| The delivered read reports an omitted label container as `signals.labels: unavailable` and still normalizes the work item from its native state; such a read never fails. | FACT | `packages/adapters/src/github/normalize.ts` (`observationSignals`, `normalizeGithubIssue`, read 2026-11-17) | A read that refused on an unavailable label signal would be new behaviour and a regression for every payload without a label array. | High |
| Closeout's lifecycle label cleanup is a separate core-planned `write-work-item` step (per-label removals plus the `delivered` add) that already turns an unavailable label signal into `skipped-noop`; `transitionWorkItem` never touches labels. | FACT | `packages/core/src/domain/closeout.ts` (`lifecycle-label-sweep`), `packages/core/src/contracts/closeout.ts` (`LIFECYCLE_LABEL_DISPOSITIONS`), read 2026-11-17 | Folding a label sweep into the transition would duplicate a delivered mechanism and change a delivered terminal write's failure modes. | High |
| Delivered label comparisons are exact-string (`labels.includes(...)` in the adapter write path and in the core sweep); no delivered path matches label names case-insensitively. | FACT | `packages/adapters/src/github/client.ts`, `packages/core/src/domain/closeout.ts` (read 2026-11-17) | A case-insensitive read match would diverge from every delivered label comparison. | High |
| GitHub's issue write accepts a state change and, for a canceled-style outcome, a `state_reason` value. | ASSUMPTION (documented REST surface; proven by fixture at implementation) | GitHub REST documentation | The seed deliberately does not map `canceled`, so nothing in this change depends on it; a project-supplied canceled row would remain a declared limitation. | Medium-High |
| GitHub's label names are case-sensitive and stable in this repository's conventions. | ASSUMPTION (proven by fixture) | `pm-instructions.md` label table | Token comparison would need a declared case rule; the seed pins exact tokens and the validator rejects duplicates. | Medium |
| Consumers compare `deliveryState` only against `done` and `canceled`. | FACT | `packages/core/src/domain/{status,closeout,queue-ready,queue-deploy-gate}.ts` (read 2026-11-17) | A richer read-side status could change consumer behaviour; it does not. | High |

## Mental Models & Techniques Used

- **First principles:** What must be true for a mapping to be *configurable* without a configuration system? It must be data, it must be injectable, it must be validated, and its default must be reviewable. All four are already delivered patterns.
- **Inversion:** How does this fail? Two structurally identical mapping types drifting apart, a config branch invented ahead of its story, a hard-coded convention nobody can override, a mapping whose only writable row is `closed`, and a read path that says "ready" after a write that said "in progress". C-1, C-2, C-4, and C-5 exclude each.
- **Second-order thinking:** Making the map an injected input costs one optional construction option today and buys a single migration point when M3-S6 lands a configuration source. Hard-coding costs nothing today and a code change per project forever.
- **Systems thinking:** The map is consumed by two paths (read normalization and transition write). Any representation that only serves one path produces a system that contradicts itself; that is why the seed must drive both.
- **Least privilege / minimal surface:** one optional construction option, one internal module, one internal validator, zero exported names, zero config keys.
- **Paved road:** Jira's `WorkflowMap` for representation; `repository` injection for provider-specific construction data.
- **Reversibility:** the seed and the option are removable until a project depends on an injected map; the decision does not lock the configuration layer.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 declared data | C-2 no config schema | C-3 additive v1 | C-4 confinement | C-5 read/write symmetry | C-6 label safety | C-7 AC satisfiable |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep the delivered two-row table | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-1 reuse `WorkflowMap`, injected + seeded (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 new project-configuration section with startup validation | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 hard-code this repository's conventions in the adapter | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-4 extend the local table with a mechanism field (no core type) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails. ALT-4 is eligible but ranks below ALT-1 on driver 2 (see below).

### Alternative 0 — Do Nothing / Keep the Delivered Two-Row Table

- **Eligibility:** Not eligible (fails C-7).
- **Summary:** `GITHUB_WORK_ITEM_STATUS_MAP` stays as delivered: `open → ready`, `closed → done`, no mechanism, no injection, no label awareness; `transitionWorkItem` keeps closing the issue.
- **Constraint compliance:** Passes C-1…C-6 trivially; fails C-7 because "transitions with configurable mapping" cannot be delivered or parity-tested when nothing is configurable and no non-terminal transition exists.
- **Driver fit:** Fails drivers 1, 2, 3, and 6.
- **Pros:** Zero change; the current fixtures stay exactly as they are.
- **Cons:** The reference backlog adapter cannot express in-progress or in-review, and M3 EC-2's configurability clause has no home.
- **Why rejected:** It fails the story's own acceptance criteria and the milestone exit criterion.

### Alternative 1 — Reuse the Core `WorkflowMap` as Injected, Seeded Construction Data (chosen)

- **Eligibility:** Eligible.
- **Summary:** Inject an optional `workflowMap` into `createGitHubClient`, defaulting to a declared seed built from this repository's lifecycle labels; validate it with a GitHub-confined validator; resolve read-side status and transition writes through the same map.
- **Constraint compliance:** Passes C-1 (declared rows, visible refusal), C-2 (no catalog branch, no config key, no new file format), C-3 (no core change; the option is additive to an already-exported options type), C-4 (all new modules internal; zero new exported names), C-5 (one map drives both directions), C-6 (`label-swap` rows reuse the delivered read-modify-write and unavailable-signal refusal; `field-update` rows never touch labels), C-7 (transitions and the reference behavior become deliverable).
- **Driver fit:** Best on 1, 2, 5, and 7; strong on 3; deliberately defers 4 to M3-S6 by construction.
- **Pros:** One representation across adapters; a real migration point for configuration later; zero new public surface; the seed is reviewable data pinned by a test.
- **Cons:** `WorkflowMap`'s single `nativeStatus` token must span two GitHub token kinds (issue state and label name), which is a semantic widening the record must document; the map gains an order-sensitive resolution rule; Jira's map stays a module constant, so the two adapters are inconsistent until M3-S6.
- **Why chosen:** It is the only eligible option that delivers configurability now, keeps one representation, and spends nothing on a configuration layer the next story owns.

### Alternative 2 — New Project-Configuration Section with Startup Validation

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** Add a project-level tracker/adapter configuration branch (with a mapping section), validated at load, and read the map from resolved configuration at composition time.
- **Constraint compliance:** Fails C-2 — a new catalog branch, a new settings type, new keys, new origin/unknown-key behaviour, new docs, and new tests; it is precisely the surface this change is not allowed to pre-empt. It also lands first-of-kind adapter configuration before the story that owns multi-tracker composition.
- **Driver fit:** Best on 1 in the long run (operators change mapping without code) and worst on 4.
- **Pros:** True "project-configurable" semantics immediately; startup validation shared with every other setting.
- **Cons:** Large blast radius across config, composition, docs, and tests; a migration step for M3-S6; a schema designed before the multi-tracker requirements it must satisfy are decided.
- **Why rejected:** It answers a question the milestone explicitly sequences later, at a cost this story would pay without needing the benefit.

### Alternative 3 — Hard-Code This Repository's Conventions in the Adapter

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Replace the two-row table with a fixed, larger table inside the adapter, no injection, no validator.
- **Constraint compliance:** Fails C-1 — the mapping is declared but not *reviewable-as-data* in any injectable form, so a project cannot express its own lifecycle; and it contradicts the three sources requiring configurability.
- **Driver fit:** Strong on 4 and 5 (nothing to migrate, no new surface); fails 1, 2, and 3.
- **Pros:** Smallest possible diff.
- **Cons:** Every project inherits this repository's labels; M3 EC-2's clause is unmet; GitLab/Jira mappings remain incomparable.
- **Why rejected:** It is the requirement inverted.

### Alternative 4 — Extend the Local Table with a Mechanism Field

- **Eligibility:** Eligible.
- **Summary:** Keep `GithubWorkItemStatusRule`, add `transitionMechanism` (and possibly more token kinds), keep it as a module constant, do not touch the core type.
- **Constraint compliance:** Passes C-1…C-7, with the same label and refusal discipline as ALT-1.
- **Driver fit:** Fails driver 2: two structurally identical mapping types drift immediately, and the parity suite can only compare providers that share a shape.
- **Pros:** Smallest representation change; no core type semantics to document.
- **Cons:** A parallel type for a concept core already owns; a later unify-or-diverge decision (which is the decision this record exists to avoid).
- **Why rejected:** It solves today's row count and not the representation problem, and it makes M3-S6's mapping source ambiguous.

## Decision

- **Decision:** Adopt ALT-1. GitHub Issues transition mapping reuses the core `WorkflowMap` as **declared, injected construction data** on `createGitHubClient`, with a seeded default built from this repository's lifecycle labels, validated by a GitHub-confined validator. No configuration schema, no new file format, no new exported surface.

### 1. Representation and injection

**Amendment (2026-11-18, GH-338 DoR iteration 2 — finding R7).** The validator's rejection set and its timing are declared here in full. The `done`-row requirement was previously asserted only by GH-338's test plan (TC-BACKLOG-010) and adopted by its delivery plan; it is declared here because §3.2's binding on the delivered closeout terminal write requires it, not because a test case asked for it. No rule below widens a delivered operation.

- **Type:** the existing core `WorkflowMap` — unchanged. No core contract edit, no alias or mechanism vocabulary change.
- **Injection:** `GithubClientOptions` gains one optional `workflowMap?: WorkflowMap`; absent means the declared seed is used. This mirrors the already-injected `repository` (provider-specific declared data) and the existing optional `transport`/`timeoutMs` defaults.
- **`systemName`:** descriptive only. Identity comes from `ExternalSystemInstance.instanceName`; the adapter never compares the map's `systemName` to the instance name and never derives identity from it.
- **Validation — rejection set (normative).** An internal `validateGithubWorkflowMap` returns failure strings and never throws. It rejects a map when any of the following holds, naming the offending row in the returned detail:
  1. `systemName` is not a non-empty string.
  2. `states` is not an array, is empty, or contains a row that is not an object.
  3. A row's `nativeStatus` is not a non-empty string, or repeats a token already declared — tokens are unique.
  4. A row's `deliveryState` or `transitionMechanism` is outside its closed set.
  5. Two rows declare the same delivery alias — at most one row per alias, so a transition lookup and a precedence read are both unambiguous.
  6. No row resolves to `done`.
  7. The `done` row is not the `field-update` row on the native issue state `closed`.
- **Why the `done` row is required, and why that row specifically.** The delivered closeout terminal write is `transitionWorkItem({ deliveryState: "done" })`, and §3.2 binds it to exactly one state-only `PATCH` of the issue state with no label read and no label write. That write resolves `done` through this map. A map with no `done` row leaves it unresolvable, so a delivery run would pay for the defect at its last step instead of at construction. A `done` row reached by `label-swap`, or by any native token other than `closed`, would make §3.2's binding unsatisfiable — the closeout write would become a label write, or would target a state the map does not carry — so the same check rejects it. A project whose completion signal is a label rather than issue closure is therefore not representable in this change; that need is a revisit trigger, not a silent redefinition of the delivered terminal write.
- **Validation — timing (normative).** The validator runs exactly once per client construction, on the **resolved** map — the injected map when one is supplied, otherwise the seed — inside `createGitHubClient` and before the first operation; never lazily at the first read or write, never per request, and never at module load. The factory keeps its delivered return type, which has no failure channel, so a failure is not thrown: it is captured at construction and every subsequent operation returns one named typed refusal — the existing `provider.payload.invalid` identity, its detail naming the failed check and the offending row, no new error-table row and no new configuration code — with **zero provider requests**. An invalid map therefore never reaches a provider, an injected map is held to exactly the checks the seed satisfies, and the seed is not exempt from them.
- **Token vocabulary (declared, GitHub-specific):** a row's `nativeStatus` is either a native issue state (`open`, `closed`) or a lifecycle label name exactly as the provider spells it. This is the one semantic widening this record accepts, and it is documented in the adapter's reference behavior rather than encoded as a new type.

### 2. The seed (this repository's conventions)

Rows are declared in **precedence order**, most-specific first; that order is load-bearing and must be documented, unlike Jira's unique-status array where order is inert.

| `nativeStatus` token | `deliveryState` | `transitionMechanism` | Notes |
|---|---|---|---|
| `closed` | `done` | `field-update` | Terminal truth wins over any lingering label |
| `review` | `in-review` | `label-swap` | This repository's "ready for review" label |
| `in-progress` | `in-progress` | `label-swap` | Delivery-started label |
| `open` | `ready` | `field-update` | The delivered `open → ready` read mapping; writing `ready` through a `field-update` row is refused in this change (§3.2), so a project that needs `ready` writable declares a `label-swap` row for it |

- **Deliberately unmapped:** `change` (ticket type, not state), `planning`, `spec-ready`, `readiness-passed` (artifact and gate markers), `delivered` (coexists with terminal closure, where `closed` already wins), `blocked` (a modifier — `DeliveryStateAlias` has no `blocked` member, and inventing one is a contract change), `backlog-capture` (a milestone-exemption marker, not a lifecycle state), and `canceled`.
- **Why `readiness-passed` is not the `ready` row:** the delivered adapter already maps a plain open ticket to `ready`, and one alias may own at most one row. A project that wants the stricter reading — open ticket is `backlog`, DoR-passed ticket is `ready` — injects a map that moves `open` to `backlog` and adds `readiness-passed` to `ready`. That example is the concrete proof that the mapping is project-configurable data rather than a convention. Under §3.2 the `backlog` row is readable and refuses on write (a non-terminal `field-update` alias), while the `readiness-passed` → `ready` label-swap row is both readable and writable; a project that needs `backlog` writable declares it as a `label-swap` row.
- **`backlog` and `canceled` are declared limitations, not oversights.** This repository's GitHub conventions encode neither: an open ticket is `ready` as delivered, and a won't-do outcome would need GitHub's terminal state plus a reason, which the single-token `nativeStatus` vocabulary cannot distinguish from `done` without a hidden convention. A project that needs either alias supplies a row through the injected map (`backlog` as a label token; `canceled` only after an additive representation decision, revisit trigger) rather than an overloading of `field-update`.

### 3. Resolution rules (one map, both directions)

**Amendment (2026-11-17, GH-338 DoR iteration 1).** Two sentences of the original §3 were self-contradictory and are corrected here: the label rule is mechanism-scoped (§3.2), and the read rule has exactly one refusal class with four declared outcomes (§3.1). Both corrections narrow this record; neither adds behaviour to a delivered operation.

#### 3.1 Read — four declared outcomes, one refusal class

- **Rule 1 — terminal native state first.** A `closed` issue resolves to the `done` row regardless of labels; terminal truth never hides behind a stale label.
- **Rule 2 — declared label token, exact case.** Otherwise the first row in declared precedence order whose `nativeStatus` equals a present label name **exactly, character for character** wins. Case-folded equality never produces an alias.
- **Rule 3 — a case collision is a visible refusal.** Otherwise, when a present label differs from a **`label-swap` row's** token by case alone (for example `In-Progress` against the declared `in-progress`), the read is a visible normalization failure naming the label and the declared token it collides with, carried by the adapter's existing failure identity (`provider.payload.invalid` detail; no new error-table row, no new configuration code). A case difference on a `field-update` row's token is **not** a collision: that token is a provider state, not a label convention, so a stray `CLOSED` label resolves by rule 4 and never refuses a read.
- **Rule 4 — native state row.** Otherwise the issue resolves through the row for its native state (`open` → `ready`), which is the delivered mapping. Two consequences are declared rather than incidental: an **unrecognized label** — any label the map does not declare, such as `change`, `planning`, `blocked`, `delivered`, `backlog-capture`, or a vendor label — carries no lifecycle meaning to the adapter and does not refuse, and an issue carrying **no lifecycle label at all** resolves exactly as delivered. In both cases the labels remain visible in the normalized `labels` array and the adapter asserts nothing about them.
- **Rule 5 — an undeclared native state is a visible refusal.** Only when the map declares no row for the issue's native state (reachable through an injected map that omits it) is the read a visible normalization failure. This is the entire sense in which "an issue matching no row fails": the failure is the absence of a row for the **resolved native state**, never the absence of a label match. The original failure sentence was read as a label rule and was therefore unreachable; it is a native-state rule and it stays.
- **An unavailable label signal is never a read refusal.** A read whose label container is omitted reports `signals.labels: unavailable` and resolves by rule 4, exactly as delivered; the adapter simply claims no label-derived alias. The refusal in §3.2 is a **write** rule: a write cannot compute a safe replacement from a collapsed empty set, whereas a read makes no replacement at all.

#### 3.2 Write — mechanism-scoped, one map

- **Row resolution.** The target alias resolves to exactly one row; an alias with no row is a typed refusal naming the alias and issuing no provider request.
- **`label-swap` rows are the only transitions that touch labels.** Such a write is **one issue `PATCH` carrying the computed target set**: it removes every **declared lifecycle label token** present, adds the row's token, and preserves every other label of the current read. It never sends a single-token array, never removes an undeclared label, and never invents a label it was not given. "Declared lifecycle label token" means exactly the `nativeStatus` value of a row whose mechanism is `label-swap`; a `field-update` row's token (`open`, `closed`) is a provider state and is never a label removal. **The current read is adapter-local input data, not a read the adapter issues:** the caller supplies `current: { deliveryState, labels? }` on the transition input, which is what makes every refusal cost zero provider requests and what keeps the delivered `done` path free of a label read. Two consequences are declared rather than implied: the preserved set is that supplied read, so **a label another actor adds between the caller's read and the write is not preserved** (a read-to-write TOCTOU limitation of this mechanism, not a hidden guarantee), and per-label add/remove requests are not introduced — the whole computed set travels in one `PATCH`. If the current label signal is unobserved or `unavailable`, the write refuses with zero provider requests, because a replacement cannot be computed from a collapsed empty set. If the current read resolves to `done`, the write refuses with zero provider requests: terminal truth would outrank the token it adds, so the write could not be observed, and reopening is not part of this mechanism.
- **`field-update` rows never touch labels.** Such a write sets only the provider field the row declares (the issue state) and performs **no** label read, **no** label write, and therefore **no** label-signal refusal. A `field-update` write is admitted only for a row whose read resolution is unconditional — a terminal row — because the mechanism cannot displace a higher-precedence lifecycle label without touching labels; a transition to a declared non-terminal `field-update` alias is a named refusal in this change, not an asymmetric write. A project that needs a non-terminal alias writable declares it as a `label-swap` row instead.
- **Consequence for the delivered closeout terminal write — explicit and binding.** `transitionWorkItem({ deliveryState: "done" })` stays exactly as delivered: one `PATCH` of the issue state to `closed`, no label read, no label write, no new refusal path, and no new failure mode. Closeout's label behaviour remains where it is delivered — a separate core-planned `write-work-item` step whose per-label removals already report `label-signal-unavailable` as `skipped-noop` — and is neither duplicated into the transition nor moved out of core planning.

**Amendment (2026-11-18, GH-338 review iteration 1).** §3.2's write rule and C-6 are restated to the mechanism the delivery satisfies rather than to a wire detail it never used. The delivered `label-swap` write sends the recomputed target set in one `PATCH`, which is whole-set transmission, not a "full-array replace" in the destructive sense: the set is computed from the caller-supplied current read, every label that read does not declare is preserved, and no single-token array is ever sent. The amendment also states the realisation (current read as adapter-local input, so refusals cost zero requests) and the limit it implies (a label added between the caller's read and the write is not preserved). No rule is widened: the refusal set, the mechanism scope, the delivered `done` path and the writable set are unchanged.

#### 3.3 Symmetry (C-5) under these rules

- `done` is symmetric because terminal precedence is unconditional: `PATCH { state: "closed" }` reads back as `done` whatever labels linger.
- A `label-swap` alias is symmetric because the sweep leaves exactly one declared label token present — the row's — and it is therefore the highest-precedence label match on read.
- A non-terminal `field-update` alias is **not claimed** as symmetric and is therefore refused on write; C-5's "named anomaly" branch is satisfied by the refusal rather than by a silent mismatch.

**Rejected readings, recorded so they do not return.** (a) *Every transition sweeps declared label tokens* — would add a label read, a label write, and a new refusal path to the delivered `closed → done` closeout write, duplicating a delivered core sweep and changing a terminal operation's failure modes. (b) *No label-derived read at all* — would delete the label-aware status this story exists to deliver. (c) *A read refuses on any label outside the mapped set* — would refuse every issue carrying `change`, `planning`, `blocked`, or a vendor label, including this repository's own change tickets. (d) *Case-insensitive matching* — would diverge from every delivered label comparison and hide the typo Appendix D of the change spec asks to surface.

### 4. Explicit non-decisions

- **The configuration layer is not designed here.** No catalog branch, no settings type, no key, no startup validation path, no file format. Where the map is *read from* is M3-S6's decision.
- **Jira's module constant does not migrate.** Its `WorkflowMap` stays as delivered; moving both adapters onto one configuration source is the M3-S6 revisit trigger.
- **Core contracts, `ADAPTER_OPERATIONS`, and capability declarations are unchanged.** In particular, no new operation and no capability gap for mapping.
- **Transition breadth beyond the port's need is a spec-level scope call, not a reopening of this decision.** If the plan cannot absorb label-swap writes in this change, the safe reduction is: read-side derivation for every seeded row, write-side for `done` (delivered) plus the mapped label swaps, with the remaining writes declared as the next increment. What must not ship is a map whose rows are declared but inert in one direction. Whatever write breadth ships, its floor is §3.2: a `field-update` transition never reads, writes, or refuses on labels, and a declared non-terminal `field-update` alias refuses rather than writing asymmetrically. Extending the writable set beyond `done` plus the `label-swap` rows is a new decision (revisit trigger), not a plan-time relaxation.

- **Rationale (tied to drivers):** Configurability arrives as data at the cheapest possible surface (driver 1), in the representation core already owns (driver 2), rich enough to express a label-based lifecycle (driver 3), without spending the change on a configuration layer another story owns (driver 4, C-2). The map is removable and replaceable (driver 5), and it drives both directions so read and write cannot disagree (driver 6, C-5). Both patterns are already delivered (driver 7).
- **Decider:** Juliusz Ćwiąkalski — human acceptance at the GH-338 PR review; this record stays `Proposed` until then.
- **Conditions for revisit:** See `revisit_triggers`, notably the M3-S6 configuration decision, the `canceled` limitation, and any third adapter needing the same validation.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies every constraint C-1 through C-7. No accepted-risk exceptions are taken. The DoR-iteration-1 amendment strengthens two of them: C-6 by making the label rule mechanism-scoped and therefore incapable of touching the delivered terminal write, and C-1 by giving read resolution exactly one refusal class with four declared outcomes instead of an unreachable failure sentence. The DoR-iteration-2 amendment strengthens C-1 once more: the validator's rejection set and its construction-time timing are stated in §1 instead of being inferred by a test case, so an invalid map cannot be constructed into a client that mislabels a ticket later.

Five consequences are recorded rather than treated as exceptions:

- `WorkflowMap`'s `nativeStatus` token now spans two GitHub token kinds (issue state and label name). The type is unchanged; the widened vocabulary is declared in the adapter's reference behavior and pinned by the seed test, so it is reviewable rather than implicit (C-1).
- GitHub's read-side status becomes label-aware, so an issue labelled `in-progress` normalizes to `in-progress` instead of `ready`. Delivered consumers only distinguish `done`/`canceled` from everything else, so behaviour is unchanged and truth improves (C-5).
- `canceled` is not representable from the seed; a project needing it hits a typed refusal and a declared limitation instead of a silent close (C-1).
- A declared non-terminal `field-update` alias is readable but refuses on write, because the mechanism cannot displace a higher-precedence lifecycle label without touching labels; declaring that alias as `label-swap` is the supported route. The alternative — writing it and letting read-back disagree — is the silent asymmetry C-5 forbids.
- A map whose `done` alias is not the `field-update` row on the native `closed` state is rejected at construction, so a project that treats a label as completion cannot inject that map. This is forced by §3.2's binding on the delivered closeout terminal write: accepting such a map would either change that write's mechanism or leave it unresolvable, and both are silent contradictions of a delivered operation. Supporting that project is a revisit trigger, not an exception taken here (C-1, C-5).

## Trade-offs & Consequences

### Positive Outcomes

- Configurability exists now, as reviewable data, with zero configuration-layer surface and zero new exported names.
- One representation across adapters: GitHub's mapping becomes comparable to Jira's, which is what the parity suite needs.
- Read and write cannot drift, because one map drives both.
- A project-supplied map becomes a one-line construction change today and a configuration migration later, in one place.
- Transition refusals are typed and named, so a project that has not declared an alias learns it immediately instead of getting a mislabelled ticket.

### Negative Outcomes

- `WorkflowMap` is used with a wider token vocabulary than Jira's status names; the documentation carries that weight, not the type.
- Row order becomes semantically load-bearing, which is a property a future reader can silently break; the seed test must assert order explicitly.
- Jira and GitHub source their maps differently until M3-S6, which is an inconsistency the informed parties must expect.
- Read-side label derivation changes existing fixture expectations for labelled issues.
- `backlog` and `canceled` are unmapped, so the reference adapter is four-sixths of the alias set rather than complete.
- A declared non-terminal `field-update` alias is readable but not writable, so a project that wants such an alias (for example `ready` or a `backlog` row on `open`) writable must model it as a `label-swap` row; the reference behavior must state that modelling constraint instead of implying every declared row is writable.
- A configuration file cannot change the mapping without a code change until M3-S6, so "project-configurable" is satisfied in the adapter's contract, not yet in the operator's hands — the spec and the reference-behavior document must say so plainly.

### Unresolved Questions

- [x] Label casing and matching — **decided 2026-11-17 (§3.1)**: matching is exact-case; a case collision with a *declared `label-swap` token* is a visible read refusal, a case difference on a `field-update` token is not a collision, and no alias is ever produced from a case-folded comparison. Remaining implementation detail (fixture only): whether GitHub's label payload preserves order — the seed resolves by declared precedence, not payload order.
- [ ] Whether the plan can absorb label-swap writes for every mapped non-terminal alias in this change, or whether write-side breadth lands partially with the remainder declared (owner: `@spec-writer` and `@plan-writer`; either outcome leaves the decision intact, and §3.2 fixes the floor).
- [x] Whether the closeout label sweep and the mapped transition can disagree about which labels are lifecycle labels — **closed 2026-11-17 (§3.2)**: they no longer meet. A `field-update` transition touches no labels at all, so closeout's core-declared sweep (`LIFECYCLE_LABEL_DISPOSITIONS`) remains the sole label owner for the terminal write, while a `label-swap` transition removes only map-declared `label-swap` tokens. No second hard-coded list is introduced.
- [ ] The exact GitHub field-update surface for a project-supplied canceled row (owner: the future `canceled` representation decision).

## Implementation Plan

1. **Seed and validator.** Add an internal `github/workflow-map.ts`: the four-row seeded `WorkflowMap`, the precedence-ordered resolution helpers (token → alias, alias → row), and `validateGithubWorkflowMap` implementing §1's rejection set exactly — including the required `done` row and its `field-update`/`closed` shape — returning failure strings and never throwing. Invoke it once on the resolved map inside `createGitHubClient`, at construction, capturing any failure for the operation-path refusal (§1 timing); never per operation and never at module load. Nothing exported from `./github`; update the content-inventory per-file allowance for the new module and for `review-state.ts` when its local table is replaced.
2. **Injection.** Add the optional `workflowMap` to `GithubClientOptions`; default to the seed; pass the resolved map into the normalization context and the write paths.
3. **Read wiring.** Replace `workItemStatusFor`'s two-row lookup with the map-driven resolution in §3.1: terminal row first, then declared label rows by exact-case precedence, then the case-collision refusal for a `label-swap` token, then the native state row, then the undeclared-native-state refusal. Keep `signals.labels: unavailable` as a signal and never as a read failure; keep `open` → `ready` and `closed` → `done` behaviourally identical to the delivered adapter.
4. **Write wiring.** Resolve the target alias through the map; implement `label-swap` (read-modify-write, declared-token removal, unavailable-signal refusal, refusal when the issue currently resolves to `done`) and `field-update` (provider state only, **no** label read and **no** label write, terminal rows only) per §3.2, and refuse undeclared aliases and non-terminal `field-update` write targets with a typed failure naming the alias. Do not add a label read to `transitionWorkItem`'s delivered `done` path.
5. **Tests.** Seed and validator tests (every §1 rejection case with the offending row named, including an absent `done` row and a `done` row that is not the `field-update` row on `closed`; coverage, uniqueness, alias uniqueness, order); a construction-timing test proving an invalid injected map yields the named refusal on the first operation with zero provider requests, that no read or write path validates lazily, and that importing the module never fails, plus a positive case proving the seed passes every check; per-alias round-trip through the mock tenant and normalization for the **writable** set (`done` plus the label-swap rows); unavailable label signal refusal on a `label-swap` write; unrelated labels preserved; undeclared alias and non-terminal `field-update` write refusals; read-outcome tests for all four §3.1 outcomes (declared token, unknown label, no lifecycle label, case collision) plus the undeclared-native-state refusal and the unavailable-label-signal read that does **not** refuse; an injected fixture map proving the option is honoured; a test that read and write use the same map instance; and a regression pin that the delivered closeout `done` write still issues exactly one state-only `PATCH` with zero label reads.
6. **Docs.** Reference behavior for GitHub Issues mapping (token vocabulary, precedence, mechanisms, the unmapped set including `canceled`), and a provider-client-seeds table update. Do not touch the configuration catalog, and do not document a configuration key that does not exist.

## Verification Criteria

- Metric: representation — the GitHub adapter consumes `WorkflowMap` from core; no GitHub-local mapping type remains; `PRODUCTION_CATALOG` and the config contract are unchanged — Target: exact — Window: GH-338 CI.
- Metric: additivity — no core contract field added or reshaped; `ADAPTER_OPERATIONS` unchanged; capability declarations unchanged; `pnpm typecheck` green — Target: exact — Window: GH-338 CI.
- Metric: pinned surfaces — `EXPECTED_SURFACE` for `./github` is unchanged (no new public export); the content-inventory per-file allowance is updated to match the new and replaced internal modules — Target: exact — Window: GH-338 CI.
- Metric: injection — a project-supplied map changes every read and write outcome; the default equals the seed — Target: ≥1 case each — Window: GH-338 CI.
- Metric: map validation — the construction-time check rejects every case in §1's rejection set (non-string `systemName`, empty/non-array `states`, non-object row, empty or duplicate token, unknown alias or mechanism, duplicate alias, absent `done` row, and a `done` row that is not the `field-update` row on `closed`), each naming the offending row; the declared seed passes every check; an invalid map produces the refusal on the first operation with zero provider requests and no import-time failure — Target: exact — Window: GH-338 CI.
- Metric: symmetry — for every writable alias (`done` plus the `label-swap` rows), write-then-read through the same map returns that alias — Target: 100% of writable aliases — Window: GH-338 CI.
- Metric: refusal discipline — an undeclared alias, a non-terminal `field-update` write target, a `label-swap` write with an unavailable label signal, a `label-swap` write to an issue currently resolving to `done`, and a read case collision each produce a named failure and no provider write — Target: exact — Window: GH-338 CI.
- Metric: read outcomes — all four §3.1 outcomes and the undeclared-native-state refusal are exercised (declared token, unknown label, no lifecycle label, case collision); an unavailable label signal never refuses a read — Target: exact coverage — Window: GH-338 CI.
- Metric: label safety and mechanism scope — every unrelated label of the caller-supplied current read survives every `label-swap` transition; the write is one `PATCH` of the computed target set, so no single-token array is ever sent and no undeclared label is ever removed; a `field-update` write issues zero label reads and zero label writes — Target: exact — Window: GH-338 CI.
- Metric: delivered closeout terminal write — `transitionWorkItem({ deliveryState: "done" })` still issues exactly one state-only `PATCH` with zero label reads, and closeout label behaviour and failure modes are unchanged — Target: exact — Window: GH-338 CI.

## Confidence Rating

**High** for the representation and injection decision: the core type, Jira's precedent, GitHub's delivered table, the absence of any adapter config branch, and the injected-`repository` pattern are all verified in the repository. **High** for the read rule and for the delivered terminal write after the 2026-11-17 amendment: the delivered native-state fallback, the delivered `unavailable` label signal, and the delivered closeout label sweep are all read in the source, and §3.2 leaves them untouched. **Medium** for the seed's write-side breadth and for GitHub's exact write surface per mechanism, which are `TO-CONFIRM` against fixtures; §3.2 fixes the floor (a `field-update` write never touches labels and only a terminal row is writable through it), and an unmapped, unsupported, or asymmetric write refuses visibly rather than guessing.

## References

- GH-338 change workspace (applied defaults Q-03/Q-04/Q-07, current-state facts): `doc/changes/2026-11/2026-11-17--GH-338--github-adapter-completion/chg-GH-338-pm-notes.yaml`
- M3 blueprint — EC-2 ("transitions with configurable mapping"), M3-S4, M3-S6, M3-S2: `doc/planning/oss-tooling/milestones/m3/README.md`
- M3 answered questions — OQ-M3-04, OQ-M3-05, OQ-M3-06: `doc/planning/oss-tooling/milestones/m3/open-questions.md`
- This repository's lifecycle label conventions: `.ai/agent/pm-instructions.md`
- Delivered contract and Jira precedent: `packages/core/src/contracts/ports.ts`, `packages/adapters/src/jira/workflow-map.ts`, `packages/adapters/src/jira/client.ts`
- Delivered GitHub status truth and write paths: `packages/adapters/src/github/review-state.ts`, `packages/adapters/src/github/normalize.ts`, `packages/adapters/src/github/client.ts`
- Delivered closeout terminal write and its separate lifecycle-label sweep: `packages/core/src/domain/closeout.ts`, `packages/core/src/contracts/closeout.ts` (`LIFECYCLE_LABEL_DISPOSITIONS`)
- Configuration catalog (no adapter branch): `packages/core/src/config/catalog.ts`
- Composition precedent: `packages/cli/src/edge.ts` (injected `repository` derived from the git remote)
- [TDR-0003](TDR-0003-config-parser-schema-and-acquisition.md) — configuration schema and acquisition ownership
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — tier and subpath confinement
- [ADR-0005](ADR-0005-runtime-confinement-provider-client-subpaths.md) — provider subpath surface discipline
- [ADR-0006](ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) — declared mapping data over speculative contract surface
- [TDR-0032](TDR-0032-github-adapter-completion-contract-extensions.md) — the capability-honesty and absence discipline this record follows
