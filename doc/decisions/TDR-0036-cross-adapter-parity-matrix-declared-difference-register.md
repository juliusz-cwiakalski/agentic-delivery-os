---
id: TDR-0036
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-18
summary: "Cross-adapter parity becomes ONE declared matrix in testkit — nine closed operations as rows, registered adapters as columns, GitHub as the reference, and exactly one closed cell value per intersection (`same-as-reference`, `declared-difference` pointing at its register entry, or `gap` with the contract's own reason) — adjudicated by a committed difference register whose entry for a pair carries a NON-EMPTY SET of classes from the closed six-class vocabulary, where each class IS one parity dimension with its own offline oracle (identity form, pipeline granularity and composition, state resolution mechanism, declared page bound and reported count, declared carriers plus carrier-step participation, trap-family classification), so `same-as-reference` means all six observations agree and a `declared-difference` entry's class set names exactly the dimensions that differ — enforced by a gate that rides `pnpm test` in the existing TypeScript test job and returns clause-tagged violation RECORDS with named fields (provider, operation, clause, differing dimension, bounded detail, scalar expected/received, evidence reference — a string form is only their rendering), with the `delivery.conformance.v1` artifact left unchanged."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider adapters and the @delivery-os/testkit conformance suite"
decision_scope: repo
review_date: null
business_impact: "M3 EC-4 (`a parity suite proves the same primitive behavior across adapters`) becomes a mechanical, reviewable property with a named adjudication record per difference, instead of a claim that the three shipped adapters happen to agree; M3-S2 and M3-S3 inherit a gate that tells a legitimate provider-model difference apart from a regression before their code is written."
customer_impact: "A team that switches a project between GitHub, GitLab, and Jira learns which behaviors differ and why before the switch, because every difference is declared with a rationale and evidence rather than discovered during a delivery."
classification:
  domains: [architecture, contracts, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: medium
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-339: @pm routed the cross-adapter parity question during clarification)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-339 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-339 clarify_scope: current-state facts and the gap analysis naming the absent parity matrix)"
    - "@decision-advisor (repository analysis and this record)"
    - "@spec-writer (carry the matrix, the register, and the gate clauses into the GH-339 change spec)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-339 PR review — this record fixes what `same behavior` means across adapters)"
  performers:
    - "@coder (GH-339 delivery: the declared matrix, the difference register, the parity engine, the fixtures, and the gate tests)"
    - "@doc-syncer (adapter-conformance spec reconciliation: matrix, register, gate clauses, and the unchanged artifact boundary)"
  informed:
    - "M3-S2 Jira backlog adapter — supplies its matrix column and its registered differences"
    - "M3-S3 GitLab code-host adapter — supplies its matrix column and its registered differences"
    - "M3-S4 GitHub reference adapter — owns the reference column's behavior"
    - "Consumers of the `delivery.conformance.v1` artifact (the run report is unchanged)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A registered difference is later found to be a defect rather than a provider-model fact: correct the adapter, delete the register entry, and change the cell — a difference register is an adjudication record, never a waiver set."
  - "A provider-model fact that no class can name becomes material (for example a provider-asserted field with no analogue in the reference that consumers read): add a class by a recorded extension that also binds its offline oracle — the dimension and the class are one thing — never by writing free text into a cell or a register field, and never as a dimension the mock tier cannot observe."
  - "A second reference adapter is proposed (for example Jira becoming the reference for backlog semantics): that changes what `same-as-reference` means for every column and is its own decision; this record admits exactly one reference."
  - "The parity gate grows slow enough to threaten the `pnpm test` budget: split it by operation into separately named checks inside the same job, never into a new workflow job (C-1)."
  - "A conformance adapter is added for a system that is not a tracker or code host (a CI provider, a harness): the matrix is scoped to the nine closed adapter operations and does not automatically extend to a non-provider port family."
  - "More than one adapter legitimately needs the same registered difference and the register starts duplicating rationale: promote the shared rationale into the difference-class description and keep one register entry per adapter-operation, never a free-text incident log."
links:
  related_changes: ["GH-339"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-18--GH-339--adapter-conformance-parity/chg-GH-339-pm-notes.yaml"
    - "doc/planning/oss-tooling/milestones/m3/README.md"
    - "doc/planning/oss-tooling/milestones/m3/contracts.md"
    - "doc/spec/features/feature-adapter-conformance.md"
    - "doc/spec/features/feature-adapter-reference-behavior.md"
    - "doc/spec/features/feature-adapter-ports.md"
  contracts:
    - "packages/core/src/contracts/adapter-capabilities.ts"
    - "packages/testkit/src/conformance/coverage.ts"
    - "packages/testkit/src/conformance/adapters.ts"
    - "packages/testkit/src/conformance/flows.ts"
    - "packages/testkit/src/conformance/artifact.ts"
  diagrams: []
  decisions: ["ADR-0003", "TDR-0008", "TDR-0032", "TDR-0033", "TDR-0037"]
  experiments: []
  metrics: []
  roadmap_items: ["M3-S5", "M3-S2", "M3-S3", "M3-S4"]
---

# TDR-0036: Cross-Adapter Parity Matrix, Declared-Difference Register, and the Parity Gate

## Context

- **FACT:** The adapter capability declaration is explicit that sameness is not assumed: `AdapterCapabilityDeclaration` carries `supportedOperations`, `declaredGaps`, and the two carrier arrays, and its module header states "Absence of a capability flag is a machine-readable gap; **parity is never implied**" (`packages/core/src/contracts/adapter-capabilities.ts`, read 2026-11-18).
- **FACT:** GitHub is the declared reference: "The GitHub adapter is the reference implementation: every other adapter is compared against these declarations", with a capability posture of GitHub 9 supported/0 gaps, GitLab 2 supported/7 `adapter-not-implemented` gaps, Jira 3 supported/6 gaps (`adapter-not-implemented`, `provider-unsupported`) (`doc/spec/features/feature-adapter-reference-behavior.md`, read 2026-11-18).
- **FACT:** M3 EC-4 requires "a parity suite proves the same primitive behavior across adapters (including error taxonomy and trap catalogs)", and M3-S5's acceptance criterion is "the suite fails on undeclared behavior differences; new adapters plug in without changing the lifecycle" (`doc/planning/oss-tooling/milestones/m3/README.md`, read 2026-11-18).
- **FACT:** The delivered coverage gates are single-adapter by construction. `structuralCoverageViolations` and `runtimeCoverageViolations` compare one registration's capability declaration against the shared flow registry and its own run results; neither function takes two adapters, and neither can express "this adapter differs from that one" (`packages/testkit/src/conformance/coverage.ts`, read 2026-11-18).
- **FACT:** One `(adapter, operation)` pair can differ from the reference on more than one parity dimension at once. The two closed pipeline reads differ in **pagination model**: GitLab's takes no bound and returns no truncation signal — `readPipelineRun(commitSha)` yields `ProviderReadResult<readonly PipelineRun[]>` (`packages/adapters/src/gitlab/client.ts:38-39,106-112`) and `normalizePipelines` iterates every `payload.pipelines` entry without a limit or a page count (`packages/adapters/src/gitlab/normalize.ts:156-195`) — where GitHub's takes a limit and returns `{ items, pageItemCount }` (`packages/adapters/src/github/client.ts:127-132,419-425`).
- **FACT:** The assertion family is a property of the shared registry, not of an adapter: `ConformanceFlowStep` carries `assertionFamily` (`packages/testkit/src/conformance/types.ts:76-82`) and the registry is one imported constant (`packages/testkit/src/conformance/flows.ts`), so a cross-column comparison of "the same assertion families apply and pass" compares the same value in every column and cannot express an identity form, a pipeline vehicle, or a state mechanism difference.
- **FACT:** On the mock tier an adapter cannot choose to skip a step: a step is skipped only for a declared unsupported operation (`packages/testkit/src/conformance/runner.ts:620-639`), the live-tier read-only deferral (`runner.ts:642-651`), or a missing declared carrier (`runner.ts:766-778`). The first two are impossibility-not-difference (the second cannot occur on the mock tier) and the third is the carrier dimension; no other step-participation divergence is producible by adapter code.
- **FACT:** Every oracle this record binds exists as delivered data: identity form — GitHub `number` (`packages/adapters/src/github/normalize.ts:320`), GitLab `iid ?? id` (`packages/adapters/src/gitlab/normalize.ts:102`), Jira `key ?? id` (`packages/adapters/src/jira/normalize.ts:109`), and pipeline item identity `<commitSha>:<runId>` (`github/normalize.ts:256`) against a bare pipeline id (`gitlab/normalize.ts:170-171`); pipeline composition — one synthesised job plus a `check-run` evidence entry per item (`github/normalize.ts:224-271`) against the pipeline's own job list and trace (`gitlab/normalize.ts:156-195`); state resolution — a label-aware, terminal-first delivery-state rule that refuses only an unmapped native state (`packages/adapters/src/github/workflow-map.ts:184-230`) against an exact native-state row that refuses the unmapped (`packages/adapters/src/jira/workflow-map.ts:101-104`), and a review-state resolver with an unknown-decision fallback (`packages/adapters/src/github/review-state.ts:52-63`) against a merge-status table that fails an unknown native value (`packages/adapters/src/gitlab/merge-status.ts:52-60`); page bound and count — a declared limit plus `pageItemCount` (`github/client.ts:419-425`) against neither (`gitlab/client.ts:106-112`).
- **FACT:** All three adapters declare both carrier arrays empty (`github/capabilities.ts:28-29`, `gitlab/capabilities.ts:25-26`, `jira/capabilities.ts:26-27`) and the runner therefore skips the carrier step with `skipKind: "capability-absent"` and `skipReason: "no-declared-carrier"` (`runner.ts:766-778`); the carrier dimension has an oracle but agrees on every pair today.
- **FACT:** Failure classification is observable from the structured result alone and differs by delivered design: GitLab's transport wrapper builds every payload failure with no status (`packages/adapters/src/gitlab/client.ts:89,94`) while `httpStatus` is optional and attached only when supplied (`packages/adapters/src/io/provider-transport.ts:77-85`), so a status-less payload failure resolves to a different API-2 class than the reference's status-bearing one.
- **FACT:** The delivered flow registry is three flows and fourteen ordered steps covering all nine closed operations, and step ids, operations, and assertion families are provider-stable data (`packages/testkit/src/conformance/flows.ts`, read 2026-11-18).
- **FACT:** The adapter registry is the sole participant list and is pinned to exactly the three shipped contracts; a structural scan fails a provider contract with no registration and a registration that names no declared contract (`packages/testkit/src/conformance/adapters.ts`, `tests/structure/conformance-coverage.test.ts`, read 2026-11-18).
- **FACT:** The mock tier already rides `pnpm test` inside the existing TypeScript test job (`.github/workflows/ci.yml` `ts-test` runs `pnpm test`; `doc/spec/features/feature-adapter-conformance.md` states "The mock suite rides `pnpm test` in the existing TypeScript jobs; no workflow job is added to the pinned CI topology").
- **FACT:** The one scheduled workflow is pinned clause by clause — triggers, permissions, SHA pins, secret scope, upload path, retention — by `tests/checks/conformance-workflow.test.ts`, so a workflow edit is a test failure by design (read 2026-11-18).
- **FACT:** The `delivery.conformance.v1` artifact is bounded run evidence with a fixed field set, closed status/skip vocabularies, and hard caps (16 providers, 16 flows, 64 steps per flow, 512 total steps, 256 KiB serialized) (`doc/spec/features/feature-adapter-conformance.md`, `packages/testkit/src/conformance/artifact.ts`, read 2026-11-18).
- **FACT:** One parity property is already proven, but only inside one adapter: the same replayed tenant routes are driven through the CLI transport and the native-`fetch` transport of GitHub and must produce identical normalized views, failure identities, structured statuses, and page counts (`tests/conformance/github-transport-parity.test.ts`; spec §Mock tier, read 2026-11-18).
- **FACT:** The testkit package is runtime-neutral: no `node:*` or `bun:*` import, no ambient environment, clock, or randomness; filesystem loading and artifact writing live under `tests/` (`doc/spec/features/feature-adapter-conformance.md` §Security and boundaries, read 2026-11-18).

## Problem Framing (Clarified)

The acceptance criterion says the suite must fail on *undeclared behavior differences*. Today it cannot fail on a difference at all, because no difference is ever declared or compared. Three separable questions hide in one sentence:

1. **What is compared, given that adapters cannot be byte-equal?** GitHub returns a pull-request number and a check-run set; GitLab returns an MR `iid` and a pipeline; Jira returns an issue key and a workflow state. A parity rule stated as "the normalized views are identical" is unimplementable and would be corrected into prose the moment GitLab landed. So parity must be defined over *dimensions that are provider-independent* — but "provider-independent" is not enough: a dimension is only a dimension if the mock tier can produce a value for it that adapters can disagree on. The six facts that survive that test are the six delivered provider-model observables this record names: the normalized identity form, the pipeline observation's granularity and item composition, the state resolution mechanism, the declared page bound and reported count, the declared carriers plus the carrier step's participation, and the trap-family classification (TDR-0037). Each of the six closed difference classes *is* one of those dimensions, so a recorded difference names a dimension that has an oracle rather than a dimension that can only be reinterpreted.
2. **Where does the claim live?** Capability data answers "is this operation supported"; it explicitly refuses to answer "is this behavior the same". A parity claim that lives only in a spec page is documentation; a parity claim that lives only in test code is unreadable. It has to be declared data that a reviewer reads and a gate executes.
3. **How is a legitimate difference distinguished from a regression?** That is the whole decision. Without an adjudication artifact, every legitimate provider-model difference becomes either a permanent red gate (and then a waiver culture) or an invisible tolerance in test code (and then no gate at all). With an adjudication artifact, a difference is a recorded, reviewable fact with a rationale and evidence, and *an unrecorded difference is by definition a failure*.

The trap to avoid is the two-way version of the same mistake: a free-text `notes` column ("GitLab differs because pipelines") that nobody can machine-check, or a numeric similarity score that hides which behavior regressed. Both make the gate untestable and the record unreviewable.

A second-order constraint decides the shape: M3-S2 and M3-S3 are *dependants* of this story. Whatever is declared here is what those adapters must satisfy, so the declaration must be writable before their behavior exists — which rules out deriving the matrix from observations and requires it to be authored data that observations can contradict.

## Constraints (Hard Requirements)

### C-1: The gate rides the existing TypeScript test job

- **Statement:** The parity gate executes inside `pnpm test` in the existing `ts-test` job. No new workflow job is added, and the pinned scheduled workflow is unchanged.
- **Source:** M3-S5 AC; adapter-conformance spec §Quality assurance ("no workflow job is added to the pinned CI topology"); GH-339 clarify-scope doc-impact risk note.
- **Verification:** Test — `tests/checks/conformance-workflow.test.ts` stays green with no edit to the workflow or the test; review of the `ci.yml` diff (zero workflow lines).
- **Negotiable:** no.

### C-2: One declared matrix, one participant list

- **Statement:** There is exactly one cross-adapter parity declaration, and its columns are exactly the providers of the registration list the declaration is evaluated against — the shipped conformance registry in production, and the composition-injected list in a control run (TDR-0039 §3). No second adapter list, no hand-maintained column set, no "known adapters" table in the engine.
- **Source:** The delivered invariant that `CONFORMANCE_ADAPTERS` is the sole participant list; the same invariant is already proven for the harness registry.
- **Verification:** Test — a gate clause fails when a registered adapter has no column and when a column names no registration.
- **Negotiable:** no.

### C-3: Closed cell vocabulary; every difference is adjudicated

- **Statement:** Every matrix intersection carries exactly one value from a closed set — `same-as-reference`, `declared-difference` (carrying the register id of its adjudication), or `gap` (carrying the reason the capability declaration already states). A cell never carries free text, and a `declared-difference` cell without a register entry is a failure. A register entry carries a non-empty **set** of difference classes from the closed six-class vocabulary; each class **is** one parity dimension with its own declared oracle (item 5), so the entry's class set names exactly the dimensions that differ. The cell carries no class, so an entry's class set has exactly one home. An empty class set, a class outside the vocabulary, a class that names no declared dimension, or a declared dimension with no class is a failure.
- **Source:** Capability-gap discipline (`FeatureProviderClientSeeds` gap records are enumerated values); the AC's "undeclared differences fail"; the delivered reads that differ on several dimensions at once (`packages/adapters/src/gitlab/client.ts:38-39,89,94,106-112`; `packages/adapters/src/github/client.ts:127-132,419-425`), which make a one-class-per-pair register falsifiable by omission.
- **Verification:** Test — type-level closed unions plus structure tests over untrusted copies; a mutation control for each clause, including an empty class set, an out-of-vocabulary class, a declared dimension with no class, and a multi-class entry that must pass with all its classes present and fail with any one removed.
- **Negotiable:** no.

### C-4: Every failure is a structured record naming provider, operation, and the failing clause

- **Statement:** A parity violation is a clause-tagged **record with named fields**, never a formatted string: the engine returns `{ provider, operation, clause, dimensions, detail, expected, received, evidence }`, where `clause` is one of the declared clause ids (Decision item 4), `dimensions` names the differing parity dimension(s) by class id — the class id *is* the dimension id, so exactly one id per differing dimension — on an observed contradiction and is empty otherwise, `detail` is bounded (≤1024 characters), `expected` and `received` are scalar only, and `evidence` references the fixture or committed evidence that resolves the violation. A string form is explicitly the record's rendering: the engine's return value and every gate test's assertion target is the record, never the rendering. No violation is reported as an anonymous count, an aggregate score, or a difference with no owner.
- **Source:** Delivered coverage-gate diagnostics ("Every violation names the registry, provider, flow, step, or operation at fault"); the conformance failure-diagnostic discipline; the change's bounded-diagnostics requirement (every violation names provider, operation and clause, carries an evidence reference, keeps detail within the declared bound, and uses scalar expected/received values only).
- **Verification:** Test — one mutation control per clause id, each asserting the returned record's `provider`, `operation`, and `clause` fields rather than a rendered message; a separate control asserts the full field set, the detail bound, scalar-only expected/received, and the evidence reference.
- **Negotiable:** no.

### C-5: Runtime-neutral declaration and engine

- **Statement:** The matrix, the difference classes, the register, and the parity engine are pure data and pure functions in `packages/testkit/src/conformance/`. Fixture loading, filesystem access, and any environment read stay under `tests/`.
- **Source:** Adapter-conformance spec §Security and boundaries; `.ai/rules/typescript.md` purity and runtime-neutrality rules for testkit.
- **Verification:** Test — the existing testkit source scan (ambient patterns) stays green, extended to the new modules; no `node:*`/`bun:*` import.
- **Negotiable:** no.

### C-6: No growth of the contract, the artifact, or the operation set

- **Statement:** `delivery.conformance.v1` is unchanged — no schema bump, no new field, no serialized matrix, no serialized register. `ADAPTER_OPERATIONS` is unchanged. No core contract type is added or retyped. The parity verdict is a gate result with diagnostics, never artifact payload.
- **Source:** Artifact boundedness and its fixed field set; additive-within-v1 discipline (TDR-0008); GH-339 scope boundary.
- **Verification:** Test — artifact schema and bounds tests unchanged and green; contract-inventory probe shows no core change.
- **Negotiable:** no.

### C-7: Parity is a declared comparison basis, never byte equality

- **Statement:** The comparison basis is provider-independent by construction, and every dimension on it has an oracle the mock tier can produce (item 5). A legitimate provider-model difference is a first-class `declared-difference`, not a failure and not a waiver; conversely a difference may not be declared on a dimension whose observation agrees, and a dimension that differs may not be left out of the entry's class set.
- **Source:** The three delivered adapters' divergent identity, pipeline, and state models (`feature-adapter-reference-behavior.md`); the transport-parity precedent, which proves equality only where equality is meaningful.
- **Verification:** Review of the declared basis in the spec page; test — a `declared-difference` whose per-class evidence does not reproduce that dimension's observation (including evidence showing the dimension agreeing) fails naming the class, and an entry whose class set does not equal the observed difference set fails naming both.
- **Negotiable:** no.

### C-8: The reference cannot differ from itself

- **Statement:** The reference column is uniformly `same-as-reference`, and the gate fails any attempt to declare a difference, a gap, or an absence for the reference adapter on any operation in the closed set.
- **Source:** M3-S4 ("capture the reference behavior the other adapters are parity-tested against"); the delivered capability posture (GitHub: 9 supported, 0 gaps).
- **Verification:** Test — a mutation control that writes a non-`same-as-reference` reference cell fails naming the reference and the operation.
- **Negotiable:** no.

## Decision Drivers

1. **Honesty per byte of claim.** A parity statement is only worth what it can falsify. The declaration should make the smallest claim that a gate can refute — and a dimension is only a dimension if an adapter can differ on it and the gate can see the difference. A dimension whose observable is the same value in every column (an assertion family declared by the shared registry) buys no claim at any price.
2. **Diagnosability.** When a parity claim breaks, the operator should learn which adapter, which operation, which clause, and which dimension — not that "conformance failed".
3. **Reviewability.** The claim is read by humans at PR time and by dependants (M3-S2/S3) before their code exists; it must be one readable declaration, not a diff of test expectations.
4. **Ceremony proportional to risk.** Every new artifact is maintenance a solo maintainer pays forever; a fourth tier, a second workflow, or a serialized score would be paid without buying a stronger claim.
5. **Extensibility at the registration edge.** A new adapter must add one column and its adjudications, and touch no engine.
6. **Reversibility.** Withdrawing or reshaping the parity claim must be a data change plus a test change, never a consumer migration.

*(Overlap check: riding the existing job, single participant list, closed cell vocabulary, named diagnostics, runtime-neutrality, and artifact non-growth are gates (C-1…C-8) and appear here only as ranking values — "how much falsifiable claim per unit of maintenance". The gates decide eligibility; the drivers rank survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-339 clarify_scope routed this call here).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-339 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (GH-339 scope and the gap analysis); `@decision-advisor` (analysis and record); `@spec-writer` (carry the matrix shape, the register, and the clauses into the change spec).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-339; the owner for final acceptance of this record.
- **Performers:** `@coder` (declared matrix, difference classes, register, parity engine, fixtures, mutation controls); `@doc-syncer` (spec reconciliation and the unchanged-artifact statement).
- **Informed:** M3-S2 (Jira column), M3-S3 (GitLab column), M3-S4 (reference behavior), and consumers of the conformance artifact.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The delivered coverage gates take one registration at a time and cannot express cross-adapter difference. | FACT | `packages/testkit/src/conformance/coverage.ts` (read 2026-11-18) | If they could, the new engine would be redundant and the decision would be a data-only change. | High |
| The capability declaration deliberately declines to imply parity. | FACT | `packages/core/src/contracts/adapter-capabilities.ts` (read 2026-11-18) | If parity were already implied, a parity gate would restate a contract instead of adding one. | High |
| GitHub is the declared reference implementation with 9 supported operations and 0 gaps; GitLab and Jira carry 7 and 6 declared gaps respectively. | FACT | `doc/spec/features/feature-adapter-reference-behavior.md`, `doc/spec/features/feature-adapter-conformance.md` (read 2026-11-18) | A reference with gaps would force the reference column to admit `gap`, changing C-8. | High |
| The flow registry and step ids are provider-stable, so "which steps execute for an operation" is comparable across adapters. | FACT | `packages/testkit/src/conformance/flows.ts` (read 2026-11-18) | Without a stable step vocabulary, the parity basis would collapse to per-adapter test lists. | High |
| The mock tier already runs inside `pnpm test`, and the CI test job runs `pnpm test`. | FACT | `.github/workflows/ci.yml` (read 2026-11-18); spec §Quality assurance | A gate that needed a new job would fail C-1 immediately. | High |
| The scheduled workflow is contract-pinned clause by clause, so a workflow edit fails a test. | FACT | `tests/checks/conformance-workflow.test.ts` (read 2026-11-18) | A softer pin would make C-1 a convention rather than a gate. | High |
| The artifact is bounded and its field set is fixed; 256 KiB serialized cap. | FACT | `packages/testkit/src/conformance/artifact.ts`, spec §Artifact contract (read 2026-11-18) | If the artifact had headroom for a matrix, the non-serialization decision would be a choice rather than a necessity — it stays a choice regardless (C-6). | High |
| The three adapters' normalized views are not byte-comparable: identity schemes and pipeline carriers differ by design. | FACT | `doc/spec/features/feature-adapter-reference-behavior.md`; delivered normalizers (read 2026-11-18) | If they were comparable, ALT-2 (observation-only comparison) would be eligible. | High |
| A per-adapter, per-operation difference register is small enough to review: 27 intersections today (9 closed operations × 3 registered adapters) — 13 `gap` (GitLab 7, Jira 6), 14 supported (GitHub 9, GitLab 2, Jira 3), of which the 9 reference-column cells are `same-as-reference` by construction, leaving exactly 5 non-reference supported intersections to adjudicate. | ASSUMPTION | Arithmetic over the delivered capability posture in `doc/spec/features/feature-adapter-reference-behavior.md` §Capability posture (read 2026-11-18) | A much larger matrix would need register grouping; the revisit trigger covers the duplicated-rationale case. | High |
| The mock-tier report alone is **not** a sufficient observation source: `ConformanceStepResult` carries `provider, flowId, stepId, operation, status, skipReason, skipKind, assertionCount, failure?` and no `assertionFamily`, no state field, and no page bound or count (`packages/testkit/src/conformance/types.ts:228-240`), so the six oracles must be composed from the report plus the flow registry by `stepId` plus the adapter's declaration and the replayed evidence. The gate consumes that composed record (item 5.2). | FACT | `packages/testkit/src/conformance/types.ts`, `flows.ts`, `runner.ts` (read 2026-11-18) | If the report carried every observation, the observation record would be redundant; as it does not, a gate reading the report directly would compare `undefined` to `undefined` and pass vacuously. | High |
| Which of the 5 non-reference supported intersections are genuinely `declared-difference` versus `same-as-reference` is unknown until each is adjudicated at delivery time (GitLab `read-delivery-request`, GitLab `read-pipeline-run`, Jira `read-work-item`, Jira `write-work-item`, Jira `transition-work-item`). | TO-CONFIRM (owner: `@coder` in GH-339, per-cell adjudication with evidence) | Not yet determined | If an intersection cannot be adjudicated honestly, the safe value is `declared-difference` with a register entry — never an unexamined `same-as-reference`. | Low (by design) |

## Mental Models & Techniques Used

- **First principles:** What is the minimum a parity claim needs to be falsifiable? Rows (what can differ), columns (who is compared), one reference, one closed value per intersection, and an adjudication record for every non-equal value. Everything else — scores, tiers, serialized reports — is presentation.
- **Inversion:** How does this fail? A free-text cell nobody can check; a gate that fails on a legitimate provider-model difference until someone silences it; a gate that passes because it compares nothing; a dimension whose observable is the same value in every column, so its rule can never fail; a difference register that becomes a waiver log; a matrix that drifts from the capability declaration; a matrix serialized into the artifact and blowing its cap. C-2, C-3, C-6, C-7 and the six gate clauses exclude each.
- **Second-order thinking:** The matrix is authored before M3-S2/S3 exist, so it is a *specification* for those adapters as well as a gate for the current three. That is the reason the register must carry rationale and evidence rather than a boolean tolerance: the next author reads it to learn what "same behavior" means.
- **Systems thinking:** The matrix sits above two already-delivered structures — the capability declaration (support) and the flow registry (behavior). It adds the missing third axis (sameness) without duplicating either; a cell's `gap` value is a *reference to* the capability declaration, not a copy, so the two cannot disagree.
- **KISS / opportunity cost:** One data module, one register, one pure function, one test entry point. Every hour spent on a parity dashboard is an hour not spent on the trap taxonomy (TDR-0037) that gives the matrix something to compare.
- **Reversibility:** The whole declaration is data; withdrawing it is deleting a module and its test, with no consumer impact.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 existing job | C-2 one list | C-3 closed cells | C-4 named failures | C-5 runtime-neutral | C-6 no contract growth | C-7 no byte equality | C-8 no self-difference |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 do nothing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 one declared matrix + register + gate in testkit (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 observation-only pairwise comparison at run time | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| ALT-3 spec-page parity table, human-reviewed | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 separate parity workflow job | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-5 parity clauses folded into the existing coverage gate | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception. ALT-5 is eligible but ranks below ALT-1 on drivers 2 and 6 (see below).

### Alternative 0 — Do Nothing

- **Eligibility:** Eligible.
- **Summary:** The suite keeps proving each adapter against its own deck and its own capability declaration; cross-adapter sameness stays a documented claim in the reference-behavior page.
- **Constraint compliance:** Passes every gate trivially, because it declares nothing.
- **Driver fit:** Fails drivers 1, 2, and 5: the milestone's parity claim stays unfalsifiable, a divergence is diagnosed only as "GitLab's expectation differs", and a new adapter gets no declaration to satisfy.
- **Pros:** Zero new surface; nothing to maintain; no risk of a false-parity claim.
- **Cons:** M3-S5's acceptance criterion ("the suite fails on undeclared behavior differences") is unmet; M3-S2/S3 inherit no bar; EC-4 remains prose.
- **Why rejected:** It fails the story's own acceptance criterion by construction.

### Alternative 1 — One Declared Matrix, a Difference Register, and a Gate in Testkit (chosen)

- **Eligibility:** Eligible.
- **Summary:** One data module declares the closed operations as rows, the registered adapters as columns, GitHub as the reference, one closed value per intersection, a closed difference-class set that *is* the six-dimension parity basis, and one register entry per `declared-difference` carrying the set of classes that entry adjudicates; one pure engine evaluates the six declared clauses — reported under nine closed clause ids — over that data plus a gate-local observation record of six observations per pair (composed from the report, the flow registry, and declared evidence) and returns clause-tagged violation records; one test invokes it inside `pnpm test`.
- **Constraint compliance:** C-1 by riding `pnpm test` with no workflow edit; C-2 by deriving columns from the registration list under a fail-closed coverage clause; C-3 by closed unions, a non-empty class set per entry, and a register bijection over the entry; C-4 by clause-tagged violation records with named fields; C-5 by pure data and functions in testkit; C-6 by leaving the artifact and the operation set untouched; C-7 by defining the basis over provider-independent dimensions with differences as first-class values; C-8 by a uniform reference column plus a self-difference clause.
- **Driver fit:** Best on all six: the smallest falsifiable claim (1), clause-named diagnostics (2), one readable declaration that dependants can author against (3), no new tier or job (4), a new column and nothing else for a new adapter (5), and a data-only rollback (6).
- **Pros:** The milestone criterion becomes mechanical; differences get rationale, evidence, and an adjudication reference; the register is the artifact M3-S2/S3 authors read first; the gate reuses the run report the suite already produces.
- **Cons:** One new data module, one register, and one engine to maintain; the initial per-cell adjudication is real work at delivery time; an entry that differs on several dimensions carries several classes, so the evidence obligation multiplies per class; a register can rot into a waiver log if reviewers stop reading it (mitigated by the first revisit trigger and by requiring evidence per entry).
- **Why chosen:** It is the only eligible option that makes the parity claim falsifiable without a new tier, a new job, or a contract change.

### Alternative 2 — Observation-Only Pairwise Comparison at Run Time

- **Eligibility:** Not eligible (fails C-3 and C-7).
- **Summary:** Compare every adapter's normalized output against the reference adapter's for the same logical input, and fail on any inequality; no declared matrix.
- **Constraint compliance:** Fails C-7 — the delivered identity and pipeline models make inequality the normal case, so the gate would fail on the first GitLab read and stay red; fails C-3 — there is no closed value and no adjudication, so the only remedy is code-level tolerance, which is precisely the "invisible tolerance" failure mode.
- **Driver fit:** Strong on 1 (a strict claim) and 5 (no data to author), weak on 2 (a failure names an inequality, not a dimension the maintainer owns) and 4 (the tolerance logic is permanent engine code).
- **Pros:** No declaration to maintain; catches any divergence immediately.
- **Cons:** Unimplementable as stated across three providers; the practical result is a hard-coded allowlist inside the engine — a register with worse reviewability.
- **Why rejected:** It arrives at the same artifact (a list of tolerated differences) by an unreviewable route.

### Alternative 3 — A Spec-Page Parity Table, Human-Reviewed

- **Eligibility:** Not eligible (fails C-3 and C-4 in gate terms).
- **Summary:** Document the matrix and the differences in the adapter-conformance page, and rely on review to keep it accurate.
- **Constraint compliance:** Passes C-1, C-2, C-5, C-6, C-7, C-8; fails the gate clauses entirely — a prose table cannot fail a build, cannot enforce a bijection with the capability declaration, and cannot name a clause when it drifts.
- **Driver fit:** Good on 3 (maximally readable) and 4 (zero machinery), failing 1 and 2.
- **Pros:** Cheapest to author; reads well.
- **Cons:** An undeclared difference still passes; the AC's "fails on" is not met; prose and declaration rot independently.
- **Why rejected:** It records the claim without making it falsifiable, which is the one thing the story exists to change.

### Alternative 4 — A Separate Parity Workflow Job

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Add a dedicated `parity` job to CI that runs the parity gate as its own check.
- **Constraint compliance:** Fails C-1 outright — the spec states no workflow job is added to the pinned topology, and the workflow contract test would have to be edited to admit the job, which is the drift the pin exists to prevent.
- **Driver fit:** Slightly better on 2 (a dedicated, greppable check name) and neutral elsewhere.
- **Pros:** Obvious check name in the PR UI; independent failure attribution.
- **Cons:** A topology change for a test that already runs in under the existing job; a second place to keep pinned.
- **Why rejected:** It buys a check name at the cost of the milestone's own CI invariant.

### Alternative 5 — Parity Clauses Folded into the Existing Coverage Gate

- **Eligibility:** Eligible.
- **Summary:** Extend `structuralCoverageViolations` / `runtimeCoverageViolations` with cross-adapter clauses rather than adding a parity module.
- **Constraint compliance:** Passes C-1…C-4 and C-6…C-8; C-4 only via an accepted-risk exception, because coverage violations are already scoped to "declaration completeness" and mixing in parity dilutes what a coverage failure means.
- **Driver fit:** Weaker on 2 (a parity failure would be indistinguishable from an incomplete declaration) and 6 (the parity claim could not be withdrawn without editing the coverage contract that three stories depend on).
- **Pros:** No new module; one gate entry point.
- **Cons:** Two different claims in one function; the coverage gate would gain a dependency on the matrix, so a parity data error would masquerade as a coverage defect.
- **Why rejected:** It couples the declaration-completeness gate to a new claim and loses clause-level diagnosis.

## Decision

- **Decision:** Adopt ALT-1. Cross-adapter parity is declared once, as testkit data, and enforced by a gate that rides the existing TypeScript test job.

### 1. The matrix

- **Home:** `packages/testkit/src/conformance/parity.ts` — declared data plus one pure engine, runtime-neutral (no filesystem, environment, clock, or randomness).
- **Rows:** exactly `ADAPTER_OPERATIONS` — the nine closed operations, imported and never re-declared.
- **Columns:** exactly the providers of `CONFORMANCE_ADAPTERS` — the registration list is the participant source, and the matrix names no adapter the registry does not register. In a control run the same derivation applies to the composition-injected adapter list (TDR-0039 §3), so the engine reads columns from the list it is given and never from a hand-authored key.
- **Reference:** `github`, declared once as the matrix's reference adapter, consistent with M3-S4 and the reference-behavior page.
- **Cell shape (closed):** `{ kind: "same-as-reference" }` | `{ kind: "declared-difference", registerId }` | `{ kind: "gap", reason }`, where `reason` is the adapter's own `CapabilityGapReason` value for that operation. A `gap` cell is a *reference to* the capability declaration; the gate fails when the two disagree, so the matrix cannot become a second, divergent capability statement. A `declared-difference` cell carries only the register id: the classes live on the entry (item 3), so the cell and its adjudication cannot disagree about which dimensions differ, and a pair that differs on several dimensions stays one cell with one entry. A cell's value is defined against item 5's six observations: `same-as-reference` means all six agree for that pair, `gap` means the operation is unsupported so no observation exists, and `declared-difference` means the entry's class set names exactly the dimensions that differ.

### 2. Closed difference classes — and the parity dimensions they are

The class set is closed and additive only by a recorded extension. **Each class is one parity dimension**: the class id is the dimension id, so the dimension set and the class set are the same six-member closed set, one for one. The oracle for each dimension is bound in item 5.

| Class = dimension id | What it names |
|---|---|
| `identity-scheme` | The normalized entity identity **form** differs (a provider numeric id, a project-scoped `iid`, an issue key, a `<commitSha>:<runId>` item identity where the reference has another scheme), while the primitive contract is the same. |
| `pipeline-model` | The pipeline observation's **granularity unit and item composition** differ (one item per check run with one synthesised job and a check-run evidence entry, versus one item per pipeline with the pipeline's own job list and trace). |
| `state-vocabulary` | The **state resolution mechanism or outcome** differs (the signal a state is read from, whether an unmapped native value refuses or falls back, or the aliases the declared map can produce), while the delivered alias set is the same. |
| `pagination-model` | The read's **declared page bound** or **reported page count** differs (a declared limit and a reported count, or neither), so a bounded read signals its exposure differently. |
| `carrier-absent` | The adapter's **declared carriers or carrier-step participation** differs (a declared writable/readable carrier, or the carrier step skipped with `capability-absent`/`no-declared-carrier`). |
| `failure-classification` | A trap family provably classifies into a different tracker-error class than on the reference, with the structured field that decides it named in the register entry. |

**The dimension set is exactly the class set.** There are six dimensions because there are six classes, and no others: a class declared without a dimension, a dimension declared without a class, or a class outside the closed set is a failure (`difference-class`). A recorded extension therefore adds a class **and** its oracle in one act — it cannot add either alone. This is what makes the class set the gate's observed-divergence vocabulary: a differing dimension is reported by naming its class id, there is exactly one id per dimension, so no divergence has two candidate names and none has zero.

A class is a *category of legitimate provider-model difference*, never a severity and never a waiver. `failure-classification` is deliberately last and narrowest: it is the only class that can be used to register a difference in the trap taxonomy (TDR-0037), and the register entry must name the structured field, so an adapter cannot register a difference in *how a failure is classified* by prose.

### 3. The declared-difference register

- **Shape:** one entry per `declared-difference` cell, keyed by exactly `(provider, operation)`. Fields: `differenceId`, the adapter, the operation, a non-empty **set** of difference classes (`differenceClasses`, each element drawn from the closed vocabulary of item 2, where the class id *is* the dimension id, so the set names exactly the dimensions that differ), the rationale, per-class evidence (a resolving committed fixture or trap id for **each** class in the set), and the adjudication reference (the record or PR discussion where the difference was accepted).
- **Unit of adjudication: the entry, not the class.** A pair that differs on three dimensions is one entry carrying three classes and three evidence references, adjudicated once; it is never three entries (the key admits one) and never one class standing in for the other two (the set must name every differing dimension the entry claims). The entry arithmetic is therefore unchanged by this rule: one entry per `declared-difference` cell, so the 5 non-reference supported intersections remain at most 5 entries however many dimensions each names.
- **Bijection (over the entry):** a `declared-difference` cell whose `registerId` resolves to no entry fails; an entry naming no cell fails; two entries for one `(provider, operation)` fail. The cell and its adjudication therefore cannot drift apart, and the register cannot become a general note file.
- **The class set is checked against the observation.** When an observation is supplied (item 5), the entry's class set must equal the set of dimensions whose observations differ for that pair: a differing dimension absent from the set is an unrecorded difference, and a class whose dimension agrees is an over-claim — both fail under `observed-contradiction`, naming the dimension. So an entry can neither hide a dimension nor pad its set.
- **Evidence is mandatory per class:** a class in an entry whose evidence does not resolve, or whose evidence does not reproduce **that dimension's** observation (including evidence that shows the dimension agreeing), fails naming the class — so one dimension's evidence cannot be used to justify another dimension's class. A register without per-class evidence is a waiver, which this decision explicitly refuses.

### 4. The gate and its clauses

The gate is one pure function returning clause-tagged violation **records** (C-4); a rendered message is derived from a record outside the engine and is never returned in its place. It evaluates:

- **(a) declaration agreement** — a cell disagrees with the adapter's capability declaration (a `same-as-reference` or `declared-difference` cell on a declared-gap operation, or a `gap` cell whose reason differs from the declaration).
- **(b) observed contradiction** — an observation contradicts its cell, when one is supplied: for a `same-as-reference` cell, any dimension whose observation differs for that pair; for a `declared-difference` cell, a dimension that differs but is absent from the entry's class set, or a class whose dimension agrees. The violation's `dimensions` names exactly the class id(s) implicated — one id per dimension.
- **(c) unregistered difference** — a `declared-difference` cell has no register entry.
- **(d) orphan register entry** — a register entry names no cell.
- **(e) column/registration mismatch** — a registered adapter has no column, or a column names no registration.
- **(f) incomplete coverage** — the cell set is not exactly operations × adapters, or the reference column is not uniformly `same-as-reference`.

Every violation names the provider, the operation, and the clause that failed. **The clause id vocabulary is closed and declared here**, so the change specification and the gate's tests enumerate ids that are traceable to this record instead of inventing them downstream:

| Clause id | Declared under | What it observes |
|---|---|---|
| `declaration-agreement` | (a) | a cell disagrees with the adapter's capability declaration, in either direction, including a `gap` reason that differs from the declared one. |
| `observed-contradiction` | (b) | an observation contradicts its cell: a differing dimension on a `same-as-reference` cell, a differing dimension missing from an entry's class set, or a class whose dimension agrees; `dimensions` names exactly the implicated class id(s), one per dimension. |
| `register-bijection` | (c), (d) | a `declared-difference` cell with no resolvable entry, an entry naming no cell, or two entries for one `(provider, operation)`. |
| `column-registration` | (e) | a registered adapter has no column, or a column names no registration. |
| `cell-set` | (f) | the cell set is not exactly operations × adapters (missing, duplicate, or extra cell). |
| `reference-purity` | (f) | the reference column is not uniformly `same-as-reference`, or a register entry names the reference. |
| `cell-vocabulary` | C-3 | a cell kind outside the three-member closed set. |
| `difference-class` | C-3 | an entry whose class set is empty or contains a class outside the closed vocabulary, or a declared dimension set that is not exactly the class set (a class with no dimension, or a dimension with no class). |
| `evidence-reproduction` | C-7 | a class in an entry with no resolving evidence, or whose evidence does not reproduce that dimension's observation — including evidence that shows the dimension agreeing. |

Nine ids, each traceable to a numbered clause or a declared constraint, and no diagnosis without an id: a violation carrying an id outside this set is an engine defect, not a new finding. Clauses (c) and (d) are one *rule* with two directions and one id, and clause (f) is one rule with two ids because its two halves fail for unrelated reasons and are mutated independently; `cell-vocabulary`, `difference-class`, and `evidence-reproduction` diagnose the closed vocabulary and the evidence obligation rather than a numbered clause, and are declared here so no gate test has to invent them.

### 5. The parity basis (what "same" means)

Parity for an operation means the agreement of **six** provider-model dimensions — exactly the six closed classes of item 2 — each with a concrete oracle the mock tier can produce offline, not byte equality of normalized views.

#### 5.1 The six oracles

| Dimension (= class id) | Oracle — what the mock tier observes offline | Observable when |
|---|---|---|
| `identity-scheme` | The normalized entity **identity form** for the operation on its declared tenant: the scheme of the read's `identity.entityId` (provider numeric id, project-scoped `iid`, issue `key`, `<commitSha>:<runId>` item identity, bare provider id), or the identity field of a write's declared projection (`write-comment` → the provider comment id). The observed value is carried for evidence and diagnosis; the parity predicate is the **scheme**. | Any operation whose normalized result carries an identity — in practice the three reads (the only operations with more than one supported column) and, on the reference only, `write-comment` and the delivery-request create, because the other adapters declare those operations as gaps. |
| `pipeline-model` | The pipeline observation's **granularity unit and per-item composition** for one commit: what one `PipelineRun` item represents (one check run vs one pipeline) and the fields it carries (`jobs` synthesised one-per-check-run plus a `check-run`/`details_url` evidence entry, vs the pipeline's own job list plus its trace). The item count is reported for diagnosis but is **not** part of equality, because each adapter replays its own declared tenant, so a count difference is a fixture difference rather than a provider-model difference. | `read-pipeline-run` only. |
| `state-vocabulary` | The operation's **state resolution mechanism and outcome** for a declared native value: the signal the state is read from (`native-status` plus exact-case label tokens with terminal-first precedence, vs `native-status` alone, vs a review-state table), the refusal rule (an unmapped native value refuses, or an unknown decision falls back), and the aliases the declared map can produce. Row spelling is not compared — only the signal, the refusal rule, and reachable aliases. | `read-work-item` (`status.deliveryState`) and `read-delivery-request` (`reviewState`); `not-observable` on every other operation. |
| `pagination-model` | The read's **declared page bound** (a declared limit argument or constant, or "no bound declared") plus **whether a page count is reported** (`pageItemCount` present, or absent). The numeric bound and the numeric count are carried for diagnosis and are not part of equality: a provider's chosen limit is a tuning value, not a parity fact. | `read-pipeline-run` — the only closed operation whose normalized view is a collection. |
| `carrier-absent` | The adapter's **declared carriers** (`writableCarriers`/`readableCarriers`, a subset of the closed `CARRIER_KINDS`) plus the **carrier step's participation** (`comment-provenance.carrier-roundtrip` executed, or skipped with `skipKind: "capability-absent"` and `skipReason: "no-declared-carrier"`). | Every pair, from the declaration; the participation half on `write-comment`. |
| `failure-classification` | The API-2 class resolved from the structured result of a trap-family stimulus on the family's declared operation — identity plus status presence and value, never prose. | Any operation for which that adapter declares a family fixture. |

#### 5.2 The observation record

The gate consumes **one gate-local observation per dimension per `(provider, operation)` pair**, composed by its caller from the report, the flow registry, and declared or ephemeral evidence (item 4). Each observation is either `{ state: "observed", value }` or `{ state: "not-observable", why }`. The record is an input to the gate only: never a report property, never a `delivery.conformance.v1` field, never persisted. A pair whose operation is a declared gap has no observation at all.

`not-observable` is not agreement by default: two `not-observable` values agree only when both report it, and an `observed` value against a `not-observable` one is a difference that must be recorded.

#### 5.3 What each cell value means

- **`same-as-reference`** means **all six** observations agree for that pair.
- **`gap`** means the operation is unsupported, so no observation exists; the cell cites the capability declaration's own reason.
- **`declared-difference`** means the pair's entry names, in its class set, **exactly** the dimensions whose observations differ — no unrecorded dimension and no padding (item 3).

#### 5.4 What is not a dimension, and why

Assertion-family outcome and non-carrier step participation are **not** parity dimensions, because no legitimate provider-model difference can produce them: the assertion family is declared on the shared registry step (`types.ts:76-82`), so it is the same value in every column, and on the mock tier a step is skipped only for a declared unsupported operation (`runner.ts:620-639`), the live-only deferral (`runner.ts:642-651`), or a missing declared carrier (`runner.ts:766-778`). A divergence there is a defect rather than a provider-model fact — a `declared-gap` skip on a supported operation already fails clause (a), the runtime coverage gate fails a supported operation with no executed step and a declared carrier that was never exercised (`coverage.ts:245-300`), and the carrier step is this record's `carrier-absent` dimension. Giving those facts a class would invent a legitimate-looking difference for an illegitimate one.

Byte-level equality of normalized views is never a parity requirement, because the delivered identity and pipeline models make it untrue by design (C-7).

### 6. Gate placement

The gate is a check, not a job: `pnpm test` in the existing TypeScript test job, invoked from a conformance test that loads the committed matrix, the register, and the registry, and composes the gate-local observation record (item 5.2) from the mock-tier report and the declared evidence. No workflow file changes; `tests/checks/conformance-workflow.test.ts` stays unedited and green (C-1).

### 7. Explicit non-decisions

- **The artifact does not change.** `delivery.conformance.v1` keeps its field set and bounds; the matrix is not serialized into it, and no parity field is added. The artifact remains bounded run evidence; a parity verdict is a gate result with diagnostics.
- **The closed operation set does not change.** No tenth operation, no operation rename, no reordering.
- **The capability declaration does not change.** No new gap reason, no new carrier kind, no new `AdapterCapabilityDeclaration` field; `gap` cells cite the declaration instead of extending it.
- **No new tier, job, or report.** No `parity` workflow, no parity artifact, no score.
- **No cell-level class and no string-only violation.** The class set lives on the register entry and a violation is a record; neither is a new artifact field, a new output surface, or a change to `delivery.conformance.v1`.
- **No seventh dimension and no class without an oracle.** A class exists only as a dimension with a declared offline oracle; a recorded extension adds the class and its oracle together, with this record's own evidence and a non-vacuity control. No dimension is added that the mock tier cannot observe, and no observation is added to the artifact to make a dimension observable.
- **GitLab and Jira behavior is not decided here.** Their cells and their registered differences are authored against M3-S2/S3 reality; this record fixes the declaration, not those adapters' semantics.

- **Rationale (tied to drivers):** The declaration is the smallest claim that can be refuted (driver 1), it names a clause and exactly one dimension id per differing dimension when it fails (driver 2), it is one readable module that M3-S2/S3 can author against (driver 3) at no new tier or job (driver 4), it extends by adding a column (driver 5), and it is withdrawable as data (driver 6). C-7 and C-8 are the gates that keep it honest rather than aspirational.
- **Decider:** Juliusz Ćwiąkalski — human acceptance at the GH-339 PR review; this record stays `Proposed` until then.
- **Conditions for revisit:** See `revisit_triggers`, notably a registered difference revealed as a defect, a provider-model fact with no class (which needs a class *and* an oracle), and any proposal for a second reference adapter.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies every constraint C-1 through C-8. No accepted-risk exceptions are taken.

Five consequences are recorded rather than treated as exceptions:

- The initial matrix contains cells that must be adjudicated at delivery time; a cell that cannot be adjudicated honestly is `declared-difference` with an evidence-bearing register entry, never an unexamined `same-as-reference` (C-3, C-7).
- The register is a reviewed artifact whose value depends on reviewers reading it; requiring per-class evidence and an adjudication reference per entry is the structural mitigation, and "a registered difference found to be a defect" is the first revisit trigger (C-3).
- A `declared-difference` is adjudicated at the *entry*, so a pair that differs on several dimensions records all of them in one class set with evidence per class instead of one arbitrarily chosen dimension standing for the pair; the gate checks each class separately against its own oracle (C-3, C-7).
- The basis is six *provider-model* dimensions. Assertion-family outcome and non-carrier step participation are invariants of the shared registry and of the mock tier — no adapter can differ on them — so they carry no class and no dimension, and a divergence there is a defect reported by another gate rather than a registrable difference (C-3, C-7).
- `failure-classification` differences create a legitimate path for two adapters to classify one trap family differently; that path is narrow (class + structured field + evidence) so that TDR-0037's taxonomy cannot be silently forked (C-7).

## Trade-offs & Consequences

### Positive Outcomes

- EC-4's parity claim becomes mechanical: nine operations, three columns today, one declared value per intersection, one reference.
- A new adapter participates by adding a column and its adjudications — no engine edit, no test edit.
- Every legitimate difference carries a rationale, evidence for each dimension it names, and an adjudication reference, so a future maintainer learns *why* GitLab's pipeline read is not GitHub's check read instead of rediscovering it.
- A pair that differs on several dimensions is adjudicated once: GitLab's pipeline read records pipeline model, pagination model, and failure classification together, so no dimension is silently unrecorded.
- Each declared difference is exactly the set of dimensions observed to differ, so an entry cannot hide one dimension behind a coarser one and a `same-as-reference` cell cannot pass with an unobserved divergence.
- The gate reuses the run report the suite already produces and the CI job that already exists.
- The capability declaration stays the single source of "is it supported", so the matrix cannot become a second capability statement.

### Negative Outcomes

- Per-cell adjudication is genuine work, and a poorly justified `declared-difference` is a defect that only review catches (the gate checks evidence exists, not that it is convincing).
- A multi-class entry multiplies the evidence obligation per entry, and a class added to an entry that has already been reviewed is itself a change to an adjudication — it must be reviewed again rather than slipped in.
- The matrix is authored before two of its three columns' adapters are complete, so some cells will be authored from declarations rather than behavior and will need adjustment when M3-S2/S3 land.
- Three of the six oracles are observable on one or two operations only (`pipeline-model` and `pagination-model` on `read-pipeline-run`; `state-vocabulary` on the two reads that carry a state field), and `identity-scheme`'s write half is reference-only because the other adapters declare those writes as gaps — so most pairs agree trivially on most dimensions and few dimensions can ever produce a difference. That is a property of the delivered surface, not a gap in the gate, but it means the basis's falsifiability rests on the per-dimension mutation controls rather than on breadth of observation.
- `carrier-absent` has an oracle but no delivered divergence: all three adapters declare both carrier arrays empty, so its first real use is the first adapter that declares a carrier.
- Parity no longer aggregates assertion-family outcome or non-carrier step participation; a reader must consult the runtime coverage gate for those, and a divergence there appears as a coverage or declaration failure rather than as a registered difference.
- A sixth closed class is a permanent vocabulary cost; the temptation to add a class rather than fix an adapter must be resisted by review.
- The parity basis (six dimensions with one oracle each) is a definition reviewers must hold in mind; an operator reading only the artifact learns nothing about parity by design (C-6).

### Unresolved Questions

- [ ] Which of the currently adjudicable intersections (GitLab's two supported reads, Jira's three supported operations) are `same-as-reference` versus `declared-difference`, and with what evidence (owner: `@coder` in GH-339 delivery).
- [ ] Whether a `declared-difference` on a supported operation should ever be permitted to hide a *narrower* behavior than the reference without a named consumer (owner: `@decision-advisor` on the first such entry).
- [ ] Whether the register should carry a `review_date`-style staleness signal so that a difference adjudicated against one provider version is revisited (owner: `@decision-advisor`; default is no new mechanism until a difference is observed to rot).
- [x] ~~Whether `state-vocabulary` differences belong in the matrix at all, or whether the delivered `WorkflowMap` injection (TDR-0035) already makes them configuration rather than difference~~ — **closed by the six-dimension basis.** The class is a dimension whose oracle is the state *resolution mechanism and outcome* (signal, refusal rule, reachable aliases), never the map's row spelling, so the injected `WorkflowMap` is exactly what the dimension observes rather than a reason to exclude it (item 5.1).

## Implementation Notes and Constraints

1. **Declaration module.** One data module holds the reference id, the six closed difference classes (each *is* one dimension, with its oracle and the operations it is observable on declared alongside), the cells, and the register; rows import the closed operation set and columns derive from the registration list. Each cell carries one closed value (the register id for a declared difference, never a class), each entry carries a non-empty class set and per-class evidence, and the declared dimension set must equal the class set exactly. No second provider list.
2. **Engine.** One pure evaluator over `{ cells, register, adapters, observation? }` returning clause-tagged violation **records** with named fields; any rendering is derived outside the engine. `observation` is the gate-local record of item 5.2 — one observation per dimension per pair — never a report field. The structural clauses evaluate without it, the observed clause only when it is supplied. The engine contains no adapter identity construct (TDR-0039 §2).
3. **Fixtures and evidence.** Register evidence points at committed conformance fixtures or trap ids, one resolving reference per class in the entry's set, and each reference must reproduce that dimension's observation; loading and any filesystem access stay under `tests/`.
4. **Test entry point.** One conformance test invokes the engine over the committed declaration and the observation record, and a suite of mutation controls exercises every clause id; at least one control per dimension flips **only** that dimension's observation and must produce an `observed-contradiction` naming that class.
5. **What must not change.** The artifact module, the flow registry, the coverage gates, the capability declaration, `ADAPTER_OPERATIONS`, and the workflow files. Any of these needing an edit is a signal that the decision is being widened and must be re-decided rather than absorbed.

## Verification Criteria

- Metric: matrix completeness — cells cover operations × registered adapters exactly, with a uniform `same-as-reference` reference column — Target: exact — Window: GH-339 CI (`pnpm test`).
- Metric: declaration agreement — every `gap` cell equals its capability declaration and no cell claims support for a declared-gap operation — Target: exact — Window: GH-339 CI.
- Metric: register bijection — one entry per `(provider, operation)`, zero unregistered differences and zero orphan entries — Target: exact — Window: GH-339 CI.
- Metric: dimension identity — the declared dimension set equals the closed six-class set exactly, every dimension declares an oracle and the operations it is observable on, and a class without a dimension or a dimension without a class fails — Target: exact — Window: GH-339 CI.
- Metric: per-class evidence — every class in every entry has a resolving evidence reference that reproduces **that dimension's** observation — Target: 100% of classes — Window: GH-339 CI.
- Metric: observed-difference set — for every supported pair with an observation, the set of dimensions whose observations differ equals the entry's class set (no unrecorded dimension, no padding), and a `same-as-reference` pair has all six agreeing — Target: exact — Window: GH-339 CI.
- Metric: oracle non-vacuity — for each of the six dimensions, at least one mutation flips only that dimension's observation and produces an `observed-contradiction` whose `dimensions` names that class — Target: 6/6 dimensions — Window: GH-339 CI.
- Metric: clause diagnosis — every clause id in the declared nine has at least one mutation control whose returned violation record carries provider, operation, and that clause id — Target: 100% of ids — Window: GH-339 CI.
- Metric: violation structure — 100% of violations are records with the declared field set, detail ≤ 1024 characters, scalar-only expected/received, and an evidence reference; no test asserts a rendered string as its target — Target: 100% — Window: GH-339 CI.
- Metric: no topology change — `tests/checks/conformance-workflow.test.ts` green with an unmodified workflow file, and `ci.yml` diff contains no workflow job — Target: exact — Window: GH-339 CI and review.
- Metric: artifact non-growth — schema id, field set, closed vocabularies, and all seven caps unchanged; no matrix or register content appears in a serialized artifact — Target: exact — Window: GH-339 CI.
- Metric: runtime neutrality — the testkit source scan finds zero ambient-time, randomness, or environment hits in the new modules; no `node:*`/`bun:*` import — Target: zero — Window: GH-339 CI.

## Confidence Rating

**High** for the declaration shape and the gate's necessity: the delivered coverage gates, the capability module's explicit disclaimer, the reference-behavior posture, the pinned CI job, and the fixed artifact are all verified in the repository and together leave exactly one viable form (declared data plus a pure gate inside `pnpm test`). **High** for the six oracles' existence — each is a delivered fact cited by file and line (identity forms, pipeline composition, state resolvers, page bound and count, carrier declarations, trap classification), and none requires a new artifact field or a new observation surface. **Medium** for two properties of the basis itself: four dimensions are observable on only one or two operations and `carrier-absent` has no delivered divergence, so the basis is narrow in practice while being exact in definition; and the per-cell adjudications are authored before M3-S2/S3 exist. Both are reversible as data, and the revisit triggers name the conditions under which a class, an oracle, or a cell must be re-decided rather than quietly relaxed.

## References

- GH-339 change workspace (clarify-scope facts, gap analysis, CI-topology constraint): `doc/changes/2026-11/2026-11-18--GH-339--adapter-conformance-parity/chg-GH-339-pm-notes.yaml`
- M3 blueprint — EC-4, M3-S5 tasks/AC, sequencing, risk table: `doc/planning/oss-tooling/milestones/m3/README.md`
- M3 contracts — the parity sentence ("fails on undeclared differences"): `doc/planning/oss-tooling/milestones/m3/contracts.md`
- Conformance concept (gate discipline, "a conformance failure is a blocker, never a warning; waivers require a decision record"): `doc/planning/concepts/adapter-conformance.md`
- Delivered conformance contract — registry, coverage gates, mock tier, artifact, CI topology: `doc/spec/features/feature-adapter-conformance.md`
- Reference behavior and capability posture: `doc/spec/features/feature-adapter-reference-behavior.md`
- Capability/gap vocabulary and the "parity is never implied" clause: `packages/core/src/contracts/adapter-capabilities.ts`, `doc/spec/features/feature-adapter-ports.md`
- Delivered gates and registry: `packages/testkit/src/conformance/coverage.ts`, `packages/testkit/src/conformance/adapters.ts`, `packages/testkit/src/conformance/flows.ts`
- Artifact bounds and fixed field set: `packages/testkit/src/conformance/artifact.ts`
- Delivered single-adapter parity precedent: `tests/conformance/github-transport-parity.test.ts`
- Workflow contract pin: `tests/checks/conformance-workflow.test.ts`, `.github/workflows/ci.yml` (`ts-test`)
- [TDR-0037](TDR-0037-tracker-error-taxonomy-delivered-identities.md) — the failure-classification dimension this matrix compares
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — tier rules and the no-parallel-adapter-surface discipline
- [TDR-0008](TDR-0008-additive-adapter-contract-extensions-closeout-v1.md) — additive-within-v1 discipline (the constraint this record deliberately does not need to invoke)

## Revision

### 2026-11-18 — multi-dimension register entries, structured violations, clause ids (readiness iteration 1)

- **Status:** unchanged — `Proposed`, `decision_date: null`. The owner accepts or rejects this record at the GH-339 PR review; this revision grants no authority and records no acceptance.
- **Trigger:** GH-339 readiness review iteration 1 (`doc/changes/2026-11/2026-11-18--GH-339--adapter-conformance-parity/readiness-review/readiness-iter-1.md`), findings **1**, **7**, **11** and **12**, plus the PM direction recorded in `chg-GH-339-pm-notes.yaml` (decision of 2026-11-18) so the specification revision that follows this record is bounded.
- **What this record had wrong:** three statements that a coder or a spec author could read as authority for an untruthful or unassertable gate.
  - **Findings 1 and 12 — one class per pair.** The record keyed one difference class per `(adapter, operation)` and put that class on the cell. One pair genuinely differs on several dimensions at once: GitLab's closed pipeline read takes no bound and returns no page count (`packages/adapters/src/gitlab/client.ts:38-39,106-112`; `packages/adapters/src/gitlab/normalize.ts:156-195`) where GitHub's takes a limit and returns `{ items, pageItemCount }` (`packages/adapters/src/github/client.ts:127-132,419-425`), its pipeline vehicle is a list rather than a check-run set, and its transport path builds payload failures with no status (`gitlab/client.ts:89,94`; `packages/adapters/src/io/provider-transport.ts:77-85`). Recording one class left the other two dimensions unrecorded and unchecked, and left the `pagination-truncation` family with no truthful posture on GitLab.
  - **Finding 11 — string violations.** C-4 and Implementation Notes 2 said a violation is "reported as a string" and the engine returns "clause-tagged strings", while the change's acceptance criteria require a structured violation naming provider, operation, failing clause, bounded scalar detail, expected/received, and a resolving evidence reference. A coder reading this record as authority could have emitted a formatted message.
  - **Finding 7 — unenumerated clause ids.** The record declared six clauses (a)–(f) while the gate's tests already need nine stable ids, so ids were being invented downstream with no traceable authority.
- **Corrected statements now carried by this record:** a register entry carries a **non-empty set** of classes from the closed six-class vocabulary with **per-class evidence**, and is the unit of adjudication (one entry per `(provider, operation)`); the cell keeps one closed value and carries the register id only, so the class set has exactly one home; the class set is the gate's **observed-divergence vocabulary** (the iteration-2 subsection below supersedes this revision's "one of the four parity dimensions" wording and makes each class exactly one dimension with its own oracle); a violation is a **clause-tagged record with named fields** whose string form is only a rendering; and the gate's clause ids are **enumerated here as nine ids**, each mapped to a numbered clause or constraint.
- **Sections amended in this revision:** front-matter `summary` and revisit trigger 2; Context (two added FACT bullets on the delivered GitLab/GitHub pipeline reads and status-less failures); C-2 (columns read from the registration list the declaration is evaluated against, so a control run and the shipped registry use one derivation); C-3 (cell value, entry class set, dimension rule, source, verification); C-4 (title, statement, source, verification); C-7 verification (per-class evidence); Decision Drivers 2; Decision item 1 (cell shape, and the column-derivation note that keeps a control run's column on the same derivation), item 2 (class table gains a dimension column plus the shared-vocabulary rule), item 3 (entry shape, unit of adjudication, bijection, per-class evidence), item 4 (violation records and the nine-id clause table), item 5 (dimension naming), item 7 (one added non-decision), and the Rationale line; the ALT-1 summary, constraint compliance and cons; the constraint attestation (now four recorded consequences); Trade-offs (one positive, one negative); Implementation Notes 1–4; Verification Criteria (register bijection, dimension vocabulary, per-class evidence, clause diagnosis, violation structure); and the Confidence Rating. **No constraint changes number or intent**, the alternative set and the DACI assignment are unchanged, and no adjudicated cell value is decided here.
- **Follow-ups this revision forces on other artifacts (not made here):** the change specification's DM-1/DM-2 must drop the cell-level class and give the entry a non-empty `differenceClasses` set with per-class evidence; its F-1/AC-F1-4/AC-F1-6 must speak of the entry's class set; AC-F1-5's observed-divergence dimension must be named as a class id from this record's closed set; API-1 must enumerate the nine clause ids instead of describing them and must state that a violation is a record; and AC-F2-10/DM-4 must allow a family's `recorded-difference` posture to reference the entry whose class set names the pagination-model class rather than requiring the `failure-classification` class. The delivery plan's phase-2 contract comment repeats the old cell shape (`differenceClass` on the cell), the old single `differenceClass` register field, and the "identity lives in the column KEYS" reading, and must follow for the same reasons. No code, spec, test-plan, or plan file was changed by this revision.

### 2026-11-18 — six-dimension basis, one class per dimension (readiness iteration 2)

- **Status:** unchanged — `Proposed`, `decision_date: null`. The owner accepts or rejects this record at the GH-339 PR review; this revision grants no authority and records no acceptance.
- **Trigger:** GH-339 readiness review iteration 2 (`readiness-review/readiness-iter-2.md`), finding **1** — blocking, and the persistent narrowed form of iteration-1 finding 3. The PM's remediation direction for iteration 1 had already re-cut the register (one entry, class set, per-class evidence); this finding is about the **basis** those classes name.
- **What this record had wrong.** It declared four parity dimensions and mapped the six classes onto them many-to-one: `identity-scheme`, `pipeline-model`, and `state-vocabulary` all named "assertion-family outcome", whose observable was "the same assertion family applies and the step passes". That observable cannot distinguish those three classes. The assertion family is a property of the shared registry, not of an adapter (`ConformanceFlowStep.assertionFamily`, `packages/testkit/src/conformance/types.ts:76-82`; one imported registry in `flows.ts`), so comparing it across columns compares a constant with itself. And a difference in identity form, pipeline vehicle, or state mechanism leaves the family name and the pass/fail status **equal on both sides** — normalization is precisely what makes them equal at the primitive boundary. Consequences, each verified by the gate: AC-F1-6's per-class evidence oracle was unsatisfiable for three of six classes; the record's own instruction to record all three on `(gitlab, read-pipeline-run)` would be rejected by the gate the record defines; AC-F1-5's "the differing dimension as a class id" had three candidate ids and no rule to choose one; and the non-vacuity set had no control for that dimension (two of four mutations hit step participation).
- **Corrected statement now carried by this record.** The basis is **six dimensions, and each closed class is exactly one of them** — the class id *is* the dimension id, so the dimension set and the class set are one six-member closed set: a class with no dimension or a dimension with no class is a failure (`difference-class`). Each dimension declares a concrete, offline-observable oracle the mock tier can produce (item 5.1). `same-as-reference` means all six observations agree; `gap` means the operation is unsupported so no observation exists; `declared-difference` means the entry's class set equals the set of dimensions observed to differ, no more and no fewer. The gate consumes one gate-local observation per dimension per pair (item 5.2), never an artifact field. Non-vacuity is now per dimension: at least one mutation flips only that dimension's observation and names that class. This supersedes the "six classes onto four dimensions" statement recorded in the previous subsection.
- **Where a delivered oracle was weaker than the brief, and what was bound instead.** Each of these is recorded in item 5.1 as the bound oracle:
  - `state-vocabulary` — the brief's "delivery-state resolution outcome" holds only on `read-work-item` (`WorkItem.status.deliveryState`, `github/normalize.ts:346-357`; `jira/normalize.ts:120,154`). `read-delivery-request` carries no delivery state at all; it carries `reviewState` (`github/normalize.ts:176,214`; `gitlab/normalize.ts:143`). Bound instead to "the operation's state resolution mechanism and outcome", with the field named per operation (`deliveryState` on `read-work-item`, `reviewState` on `read-delivery-request`), so the dimension is observable on two operations rather than one and `not-observable` elsewhere. The bound oracle still separates the delivered resolvers: label-aware terminal-first with a missing-row refusal (GitHub) against an exact-row lookup that refuses the unmapped (Jira), and an unknown-decision fallback (GitHub) against a merge-status table that fails an unknown native value (GitLab).
  - `pagination-model` — the reported count's **value** is fixture-derived (`pageItemCount = payload.check_runs.length`, `github/normalize.ts:235`), so comparing numbers would compare tenant fixtures, not providers. Bound to the declared bound's presence/form plus whether a count is reported at all; the numeric bound and count are carried for diagnosis only.
  - `pipeline-model` — item **counts** are likewise fixture-derived, so equality is bound to the granularity unit (one item per check run vs one item per pipeline) and the per-item composition (jobs and evidence entries), not to how many items a tenant yields.
  - `carrier-absent` — the oracle exists but no delivered pair diverges: all three adapters declare both carrier arrays empty (`github/capabilities.ts:28-29`, `gitlab/capabilities.ts:25-26`, `jira/capabilities.ts:26-27`) and the runner skips the carrier step identically (`runner.ts:766-778`). Recorded as a negative outcome rather than hidden.
  - `identity-scheme` on writes — only operations whose declared write projection carries an identity are observable (`write-comment` → the provider comment id; the delivery-request create → the created view), and both of those are declared gaps on GitLab and Jira (`capabilities.ts`), so the identity oracle is **cross-adapter only on the three reads**. The other writes declare a void result and are `not-observable`.
  - Two facts the earlier basis called dimensions are removed: assertion-family outcome and non-carrier step participation are registry/mock-tier invariants that no adapter can differ on (evidence above and `runner.ts:620-651`), so they carry no class and a divergence there is a defect reported by another gate. Recorded as a consequence, a negative outcome, and an explicit non-decision.
- **Preserved unchanged by this revision:** the six class names, the three-value cell vocabulary, the `(provider, operation)` entry key, the entry↔cell bijection rules, the derived-column rule (TDR-0039 §2), the structured-violation record shape (C-4), and the nine clause ids.
- **Sections amended:** front-matter `summary` and revisit trigger 2; Problem Framing item 1 (paragraph rewritten); Context (four FACT bullets added — registry-owned assertion family, mock-tier skip set, the delivered oracles with file:line, carrier emptiness and status-less failure classification); the Evidence table (the "report is a sufficient observation source" assumption is replaced by the FACT that it is not, and that the six oracles compose from report + registry + declaration + evidence); C-3 (statement and verification); C-4 (`dimensions` naming); C-7 (statement/source/verification); Decision Drivers 1; Decision item 1 (cell value defined against six observations), item 2 (table becomes class = dimension; 1:1 closure rule replaces the many-to-one mapping rule), item 3 (class-set-vs-observation check added; evidence wording), item 4 (clause (b) semantics and three clause-table rows), item 5 (rewritten: 5.1 oracles, 5.2 observation record, 5.3 cell values, 5.4 what is not a dimension), item 6 (the composed observation record), item 7 (one added non-decision), Rationale and Conditions for revisit; one Unresolved Question closed by the new basis; ALT-1 summary; the constraint attestation (now five consequences); Trade-offs (one positive, three negative); Implementation Notes 1–4; Verification Criteria (dimension identity, per-class evidence, observed-difference set, oracle non-vacuity, clause diagnosis); Confidence Rating; and the Mental Models inversion line.
- **Follow-ups this revision forces on other artifacts (not made here).** The specification's F-1, DM-1, API-1, AC-F1-5 and AC-F1-6 must restate the basis as six dimensions that are the six classes, each with the oracle and observable-operation scope of item 5.1, and AC-F1-5's differing dimension becomes exactly one class id per differing dimension; DM-1's total-in-both-directions mapping sentence becomes the 1:1 identity; API-1's dimension-to-source paragraph must name the six oracles and the `not-observable` state. The test plan's TC-PARITY-005/006/008 and §7.5 must replace the four-dimension mutation set with one per dimension (identity form, pipeline granularity/composition, state mechanism, bound/count presence, carriers, classification), each flipping only its own observation; TC-PMUT-005 and the `difference-class` wording follow the class = dimension rule. The plan's phase-2 contract, arm registry and mutation block repeat the four-dimension basis and must follow. No code, spec, test plan, plan, or other decision record was changed by this revision.


